import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Activity as ActivityGlyph,
  FolderClosed,
  Download,
  Copy,
  ArrowUpRight,
} from 'lucide-react'
import { copyToClipboard } from '@/lib/toast'
import { useStore, useStoreShallow, useDisplayName } from '@/lib/store'
import { Markdown } from '@/lib/markdown'
import { HealthBadge } from '@/components/ProjectUpdates'
import type {
  Activity,
  ActivityKind,
  Comment,
  InitiativeUpdate,
  ProjectHealth,
  ProjectUpdate,
} from '@/lib/types'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { ActivityItem } from '@/components/ActivityItem'
import { EmptyState, CheckIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { cn, timeAgo } from '@/lib/utils'

// ── Pulse — the workspace-wide activity feed (Linear's "Pulse"). ──────────────
// Unlike My Issues › Activity (the *current user's* own actions), Pulse merges
// EVERY actor's activities, comments and project/initiative updates into one
// newest-first stream, day-bucketed with sticky, collapsible headers.

// How many feed events to reveal per "Load more" press. The window starts at
// one page and grows by this many on each click, so long feeds stay cheap to
// render until the reader actually scrolls deeper (Linear paginates its
// activity streams the same way).
const PAGE_SIZE = 50

const FILTERS = ['all', 'issues', 'comments', 'projects'] as const
type Filter = (typeof FILTERS)[number]

const FILTER_LABEL: Record<Filter, string> = {
  all: 'All',
  issues: 'Issues',
  comments: 'Comments',
  projects: 'Projects',
}

// Date-scope quick filter — narrows the feed by event timestamp.
const SCOPES = ['all', 'today', 'week'] as const
type Scope = (typeof SCOPES)[number]

const SCOPE_LABEL: Record<Scope, string> = {
  all: 'All time',
  today: 'Today',
  week: 'This week',
}

/** Earliest timestamp (ms) included for a given scope, or 0 for "all". */
function scopeFloor(scope: Scope): number {
  if (scope === 'all') return 0
  const now = new Date()
  if (scope === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  }
  // "This week" — last 7 days from the start of today.
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - 6)
  return start.getTime()
}

const HEALTH_LABEL: Record<ProjectHealth, string> = {
  'on-track': 'on-track',
  'at-risk': 'at-risk',
  'off-track': 'off-track',
}

/** A normalized feed entry spanning the four source kinds. */
type Event =
  | { type: 'activity'; id: string; userId: string; createdAt: string; activity: Activity }
  | { type: 'comment'; id: string; userId: string; createdAt: string; issueId: string }
  | {
      type: 'project'
      id: string
      userId: string
      createdAt: string
      projectId: string
      health: ProjectHealth
    }
  | {
      type: 'initiative'
      id: string
      userId: string
      createdAt: string
      initiativeId: string
      health: ProjectHealth
    }

/** Day-bucket label like Linear ("Today" / "Yesterday" / "Monday, Jun 12"). */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

/** Quote a value for CSV (RFC 4180): wrap in quotes, double any inner quote. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** Trigger a client-side download of `text` as a UTF-8 file via a Blob URL. */
function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Build a one-line plain-text summary of a feed event for the copy-to-clipboard
 * action — e.g. "Alice commented on CLA-123" or "Bob posted an at-risk update on
 * Mobile App". Mirrors the human-readable sentence each row renders.
 */
function summarizeEvent(
  e: Event,
  lookups: Pick<RowProps, 'issues' | 'projects' | 'initiatives' | 'users' | 'fmt'>,
): string {
  const { issues, projects, initiatives, users, fmt } = lookups
  const name = fmt(users.find((u) => u.id === e.userId)?.name)
  if (e.type === 'activity') {
    const issue = issues.find((i) => i.id === e.activity.issueId)
    return `${name} ${e.activity.kind} ${issue?.identifier ?? '—'}`.trim()
  }
  if (e.type === 'comment') {
    const issue = issues.find((i) => i.id === e.issueId)
    return `${name} commented on ${issue?.identifier ?? '—'}`
  }
  if (e.type === 'project') {
    const project = projects.find((p) => p.id === e.projectId)
    return `${name} posted a ${HEALTH_LABEL[e.health]} update on ${project?.name ?? 'project'}`
  }
  const initiative = initiatives.find((i) => i.id === e.initiativeId)
  return `${name} posted a ${HEALTH_LABEL[e.health]} update on ${initiative?.name ?? 'initiative'}`
}

export function PulseView() {
  const {
    activities,
    comments,
    projectUpdates,
    initiativeUpdates,
    issues,
    projects,
    initiatives,
    teams,
    users,
  } = useStoreShallow((s) => ({
    activities: s.activities,
    comments: s.comments,
    projectUpdates: s.projectUpdates,
    initiativeUpdates: s.initiativeUpdates,
    issues: s.issues,
    projects: s.projects,
    initiatives: s.initiatives,
    teams: s.teams,
    users: s.users,
  }))
  const fmt = useDisplayName()
  const [filter, setFilter] = useState<Filter>('all')
  // 'all' = every team; otherwise a specific team id.
  const [teamFilter, setTeamFilter] = useState<string>('all')
  // 'all' = every actor; otherwise a specific user id (the person who acted).
  const [actorFilter, setActorFilter] = useState<string>('all')
  const [scope, setScope] = useState<Scope>('all')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  // Which project/initiative-update rows are expanded to reveal their full
  // markdown body + health badge inline (Linear lets you peek an update in
  // place). Keyed by event id.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  // Windowed pagination — how many events of the filtered stream are revealed.
  // Starts at one page; "Load more" grows it. Reset to the first page whenever
  // the filters change so a fresh selection always opens at the top.
  const [shown, setShown] = useState(PAGE_SIZE)
  useEffect(() => {
    setShown(PAGE_SIZE)
  }, [filter, teamFilter, actorFilter, scope])

  // Merge all sources into a single newest-first stream.
  const events = useMemo<Event[]>(() => {
    const out: Event[] = []
    for (const a of activities as Activity[]) {
      out.push({ type: 'activity', id: a.id, userId: a.userId, createdAt: a.createdAt, activity: a })
    }
    for (const c of comments as Comment[]) {
      out.push({
        type: 'comment',
        id: c.id,
        userId: c.userId,
        createdAt: c.createdAt,
        issueId: c.issueId,
      })
    }
    for (const u of projectUpdates as ProjectUpdate[]) {
      out.push({
        type: 'project',
        id: u.id,
        userId: u.userId,
        createdAt: u.createdAt,
        projectId: u.projectId,
        health: u.health,
      })
    }
    for (const u of initiativeUpdates as InitiativeUpdate[]) {
      out.push({
        type: 'initiative',
        id: u.id,
        userId: u.userId,
        createdAt: u.createdAt,
        initiativeId: u.initiativeId,
        health: u.health,
      })
    }
    return out.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [activities, comments, projectUpdates, initiativeUpdates])

  // Resolve the team an event belongs to (or undefined when it can't be
  // team-resolved): issue activities/comments via the issue's teamId; project
  // updates via the project's teamIds; initiative updates via the teamIds of the
  // projects that roll up into the initiative.
  const teamIdsForEvent = useMemo(() => {
    const fn = (e: Event): Set<string> | undefined => {
      if (e.type === 'activity') {
        const issue = issues.find((i) => i.id === e.activity.issueId)
        return issue ? new Set([issue.teamId]) : undefined
      }
      if (e.type === 'comment') {
        const issue = issues.find((i) => i.id === e.issueId)
        return issue ? new Set([issue.teamId]) : undefined
      }
      if (e.type === 'project') {
        const project = projects.find((p) => p.id === e.projectId)
        return project ? new Set(project.teamIds) : undefined
      }
      // initiative — union of the teams of its member projects.
      const ids = new Set<string>()
      for (const p of projects) {
        if (p.initiativeId === e.initiativeId) for (const t of p.teamIds) ids.add(t)
      }
      return ids.size ? ids : undefined
    }
    return fn
  }, [issues, projects])

  // Apply the segmented kind filter, the team filter, the actor filter and the
  // date scope.
  const filtered = useMemo(() => {
    const floor = scopeFloor(scope)
    return events.filter((e) => {
      // Date scope.
      if (floor && new Date(e.createdAt).getTime() < floor) return false
      // Kind.
      if (filter === 'issues' && e.type !== 'activity') return false
      if (filter === 'comments' && e.type !== 'comment') return false
      if (filter === 'projects' && e.type !== 'project' && e.type !== 'initiative')
        return false
      // Actor — narrow to a single person who performed the event.
      if (actorFilter !== 'all' && e.userId !== actorFilter) return false
      // Team — events that can't be team-resolved are hidden for a specific team.
      if (teamFilter !== 'all') {
        const ids = teamIdsForEvent(e)
        if (!ids || !ids.has(teamFilter)) return false
      }
      return true
    })
  }, [events, filter, teamFilter, actorFilter, scope, teamIdsForEvent])

  // Windowed slice of the filtered stream — only the first `shown` events are
  // materialized into rows. `hasMore` drives the "Load more" footer.
  const windowed = useMemo(() => filtered.slice(0, shown), [filtered, shown])
  const hasMore = filtered.length > windowed.length

  // Group into day buckets (stream is already newest-first).
  const days = useMemo(() => {
    const out: { label: string; events: Event[] }[] = []
    for (const e of windowed) {
      const label = dayLabel(e.createdAt)
      const last = out[out.length - 1]
      if (last && last.label === label) last.events.push(e)
      else out.push({ label, events: [e] })
    }
    return out
  }, [windowed])

  const setPeek = (id: string) => useStore.getState().setPeek(id)

  // CSV export of the currently-filtered feed (Linear lets you export any view).
  // Columns mirror the visible row: timestamp, kind, actor, target & a short
  // human summary. Downloads via a Blob — no network round-trip.
  const exportCsv = () => {
    const header = ['Date', 'Type', 'Actor', 'Target', 'Summary']
    const rows = filtered.map((e) => {
      const actor = fmt(users.find((u) => u.id === e.userId)?.name)
      let kind = 'Activity'
      let target = ''
      let summary = ''
      if (e.type === 'activity') {
        const issue = issues.find((i) => i.id === e.activity.issueId)
        kind = 'Issue'
        target = issue ? `${issue.identifier} ${issue.title}` : ''
        summary = e.activity.kind
      } else if (e.type === 'comment') {
        const issue = issues.find((i) => i.id === e.issueId)
        kind = 'Comment'
        target = issue ? `${issue.identifier} ${issue.title}` : ''
        summary = `commented on ${issue?.identifier ?? '—'}`
      } else if (e.type === 'project') {
        const project = projects.find((p) => p.id === e.projectId)
        kind = 'Project update'
        target = project?.name ?? ''
        summary = `${HEALTH_LABEL[e.health]} update`
      } else {
        const initiative = initiatives.find((i) => i.id === e.initiativeId)
        kind = 'Initiative update'
        target = initiative?.name ?? ''
        summary = `${HEALTH_LABEL[e.health]} update`
      }
      return [
        new Date(e.createdAt).toISOString(),
        kind,
        actor,
        target,
        summary,
      ].map(csvCell)
    })
    const csv = [header.map(csvCell), ...rows].map((r) => r.join(',')).join('\r\n')
    const stamp = new Date().toISOString().slice(0, 10)
    downloadText(`pulse-${stamp}.csv`, csv)
  }

  // Team filter dropdown options — "All teams" plus one per team.
  const teamOptions = useMemo<SelectOption[]>(
    () => [
      { id: 'all', label: 'All teams', selected: teamFilter === 'all' },
      ...teams.map((t) => ({
        id: t.id,
        label: t.name,
        hint: t.key,
        keywords: t.key,
        selected: teamFilter === t.id,
      })),
    ],
    [teams, teamFilter],
  )
  const activeTeam = teams.find((t) => t.id === teamFilter)

  // Actor filter — only offer people who actually appear in the feed, so the
  // list stays meaningful (Linear scopes its activity feed by member the same
  // way). Avatars render inline via the option's `icon` slot.
  const actorOptions = useMemo<SelectOption[]>(() => {
    const seen = new Set(events.map((e) => e.userId))
    const people = users
      .filter((u) => seen.has(u.id))
      .sort((a, b) => fmt(a.name).localeCompare(fmt(b.name)))
    return [
      { id: 'all', label: 'All members', selected: actorFilter === 'all' },
      ...people.map((u) => ({
        id: u.id,
        label: fmt(u.name),
        icon: <Avatar user={u} size={16} />,
        keywords: u.name,
        selected: actorFilter === u.id,
      })),
    ]
  }, [events, users, actorFilter, fmt])
  const activeActor = users.find((u) => u.id === actorFilter)

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Pulse" />

      {/* Filter bar — kind segmented control + team & date-scope quick filters */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-4 py-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[13px] text-muted hover:bg-bg-hover',
              filter === f && 'bg-bg-selected font-medium text-fg',
            )}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}

        {/* Team filter — All teams + each team by name */}
        <div className="ml-auto flex items-center gap-1">
          <SelectMenu
            options={teamOptions}
            onSelect={setTeamFilter}
            align="end"
            placeholder="Filter team…"
            trigger={
              <span className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg">
                {activeTeam ? activeTeam.name : 'All teams'}
                <ChevronDown size={13} className="text-faint" />
              </span>
            }
          />

          {/* Member filter — scope the feed to a single actor's activity */}
          <SelectMenu
            options={actorOptions}
            onSelect={setActorFilter}
            align="end"
            placeholder="Filter member…"
            trigger={
              <span className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg">
                {activeActor ? (
                  <>
                    <Avatar user={activeActor} size={16} />
                    {fmt(activeActor.name)}
                  </>
                ) : (
                  'All members'
                )}
                <ChevronDown size={13} className="text-faint" />
              </span>
            }
          />

          {/* Date scope — All time / Today / This week */}
          <div className="flex items-center gap-0.5">
            {SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={cn(
                  'rounded-md px-2 py-1 text-[13px] text-muted hover:bg-bg-hover',
                  scope === s && 'bg-bg-selected font-medium text-fg',
                )}
              >
                {SCOPE_LABEL[s]}
              </button>
            ))}
          </div>

          {/* Export the filtered feed to CSV */}
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            title="Export to CSV"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={13} className="text-faint" />
            Export
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          illustration={<CheckIllustration />}
          title={events.length === 0 ? 'No activity yet' : 'No matching activity'}
          description={
            events.length === 0
              ? 'Recent activity across your workspace will show up here.'
              : 'No activity matches the current filters. Try widening your selection.'
          }
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {days.map((day) => {
            const open = !collapsed[day.label]
            return (
              <div key={day.label}>
                {/* Sticky, collapsible day header with per-day event count */}
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [day.label]: !c[day.label] }))
                  }
                  className="sticky top-0 z-10 flex w-full items-center gap-1.5 border-b border-border bg-bg/95 px-4 py-1.5 text-[13px] font-medium text-fg backdrop-blur hover:bg-bg-hover"
                >
                  <ChevronRight
                    size={14}
                    className={cn(
                      'text-faint transition-transform',
                      open && 'rotate-90',
                    )}
                  />
                  <span>{day.label}</span>
                  <span className="text-faint">{day.events.length}</span>
                </button>
                {open &&
                  day.events.map((e) => (
                    <PulseRow
                      key={e.id}
                      event={e}
                      issues={issues}
                      projects={projects}
                      initiatives={initiatives}
                      projectUpdates={projectUpdates}
                      initiativeUpdates={initiativeUpdates}
                      users={users}
                      fmt={fmt}
                      onPeek={setPeek}
                      expanded={expanded.has(e.id)}
                      onToggleExpand={() => toggleExpand(e.id)}
                    />
                  ))}
              </div>
            )
          })}

          {/* "Load more" footer — reveals the next page of the filtered feed,
              with a remaining-count hint like Linear's paginated lists. */}
          {hasMore && (
            <div className="flex items-center justify-center px-4 py-3">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE_SIZE)}
                className="rounded-md border border-border px-3 py-1 text-[13px] text-muted transition-colors hover:bg-bg-hover hover:text-fg"
              >
                Load more
                <span className="ml-1.5 text-faint">
                  {filtered.length - windowed.length} more
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── A single feed row ─────────────────────────────────────────────────────────

interface RowProps {
  event: Event
  issues: ReturnType<typeof useStore.getState>['issues']
  projects: ReturnType<typeof useStore.getState>['projects']
  initiatives: ReturnType<typeof useStore.getState>['initiatives']
  projectUpdates: ReturnType<typeof useStore.getState>['projectUpdates']
  initiativeUpdates: ReturnType<typeof useStore.getState>['initiativeUpdates']
  users: ReturnType<typeof useStore.getState>['users']
  fmt: (name: string | undefined) => string
  onPeek: (issueId: string) => void
  /** Whether this row's update body is expanded inline. */
  expanded?: boolean
  /** Toggle inline expansion (project/initiative-update rows only). */
  onToggleExpand?: () => void
}

function GlyphFor({ kind }: { kind: ActivityKind | 'comment' | 'project' }) {
  const c = 'shrink-0 text-faint'
  if (kind === 'comment') return <MessageSquare size={13} className={c} />
  if (kind === 'project') return <FolderClosed size={13} className={c} />
  return <ActivityGlyph size={13} className={c} />
}

function PulseRow({
  event: e,
  issues,
  projects,
  initiatives,
  projectUpdates,
  initiativeUpdates,
  users,
  fmt,
  onPeek,
  expanded,
  onToggleExpand,
}: RowProps) {
  const navigate = useNavigate()
  // Issue activities reuse ActivityItem verbatim (it already renders the
  // Linear-style sentence), wrapped so the whole row peeks the issue.
  // One-line plain-text summary for the hover copy action.
  const summary = summarizeEvent(e, { issues, projects, initiatives, users, fmt })

  if (e.type === 'activity') {
    const issue = issues.find((i) => i.id === e.activity.issueId)
    return (
      <div className="group relative flex items-center transition-colors hover:bg-bg-hover">
        <button
          type="button"
          onClick={() => issue && onPeek(issue.id)}
          className="flex w-full items-center gap-2 px-4 py-1.5 pl-9 text-left"
        >
          <GlyphFor kind={e.activity.kind} />
          <span className="min-w-0 flex-1">
            <ActivityItem activity={e.activity} />
          </span>
          {issue && (
            <span className="ml-auto shrink-0 truncate text-[12px] text-faint">
              {issue.identifier} · {issue.title}
            </span>
          )}
        </button>
        <CopyButton summary={summary} />
      </div>
    )
  }

  const actor = users.find((u) => u.id === e.userId)
  const name = fmt(actor?.name)

  if (e.type === 'comment') {
    const issue = issues.find((i) => i.id === e.issueId)
    return (
      <div className="group relative flex items-center transition-colors hover:bg-bg-hover">
        <button
          type="button"
          onClick={() => issue && onPeek(issue.id)}
          className="flex w-full items-center gap-2 px-4 py-1.5 pl-9 text-left text-[12px] text-muted"
        >
          <GlyphFor kind="comment" />
          <Avatar user={actor} size={18} />
          <span className="text-fg">{name}</span>
          <span>commented on</span>
          <span className="font-mono text-[11px] text-faint">
            {issue?.identifier ?? '—'}
          </span>
          {issue && (
            <span className="ml-auto shrink-0 truncate text-faint">
              {issue.title}
            </span>
          )}
          <span className="ml-auto shrink-0 text-faint">· {timeAgo(e.createdAt)}</span>
        </button>
        <CopyButton summary={summary} />
      </div>
    )
  }

  // project / initiative update — clicking the row toggles an inline expansion
  // that reveals the update's full markdown body + health badge, plus a link
  // through to the project/initiative detail.
  const isProject = e.type === 'project'
  const target = isProject
    ? projects.find((p) => p.id === e.projectId)
    : initiatives.find((i) => i.id === e.initiativeId)
  // Resolve the update record so we can render its body when expanded.
  const update = isProject
    ? projectUpdates.find((u) => u.id === e.id)
    : initiativeUpdates.find((u) => u.id === e.id)
  const targetId = isProject ? e.projectId : e.initiativeId
  const detailPath = isProject ? `/project/${targetId}` : `/initiative/${targetId}`

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-2 px-4 py-1.5 pl-9 text-left text-[12px] text-muted transition-colors hover:bg-bg-hover"
      >
        <ChevronRight
          size={13}
          className={cn(
            'shrink-0 text-faint transition-transform',
            expanded && 'rotate-90',
          )}
        />
        <Avatar user={actor} size={18} />
        <span className="text-fg">{name}</span>
        <span>posted a</span>
        <span className="font-medium text-fg">{HEALTH_LABEL[e.health]}</span>
        <span>update on</span>
        <span className="font-medium text-fg">{target?.name ?? 'project'}</span>
        <span className="ml-auto shrink-0 text-faint">· {timeAgo(e.createdAt)}</span>
      </button>
      <CopyButton summary={summary} />

      {/* Inline expansion — full update body, health badge & a link through to
          the project/initiative detail. */}
      {expanded && (
        <div className="border-b border-border bg-bg-secondary px-4 py-3 pl-[3.25rem] text-[13px]">
          <div className="mb-2 flex items-center gap-2">
            <HealthBadge health={e.health} />
            <button
              type="button"
              onClick={() => navigate(detailPath)}
              className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted transition-colors hover:bg-bg-hover hover:text-fg"
            >
              View {isProject ? 'project' : 'initiative'}
              <ArrowUpRight size={13} className="text-faint" />
            </button>
          </div>
          {update?.body ? (
            <div className="text-muted">
              <Markdown source={update.body} />
            </div>
          ) : (
            <p className="text-faint">No update details.</p>
          )}
        </div>
      )}
    </div>
  )
}

// Hover-revealed button that copies the row's plain-text summary to the
// clipboard, confirming with a Linear-style toast. Overlaid at the row's right
// edge (the rows are dense, so it floats above the trailing metadata).
function CopyButton({ summary }: { summary: string }) {
  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation()
        copyToClipboard(summary, 'Copied to clipboard')
      }}
      title="Copy summary"
      className="absolute right-2 top-1/2 -translate-y-1/2 shrink-0 rounded bg-bg p-1 text-faint opacity-0 transition-opacity hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
    >
      <Copy size={13} />
    </button>
  )
}
