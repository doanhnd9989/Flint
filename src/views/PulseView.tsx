import { useMemo, useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Activity as ActivityGlyph,
  FolderClosed,
} from 'lucide-react'
import { useStore, useStoreShallow, useDisplayName } from '@/lib/store'
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

  // Group into day buckets (stream is already newest-first).
  const days = useMemo(() => {
    const out: { label: string; events: Event[] }[] = []
    for (const e of filtered) {
      const label = dayLabel(e.createdAt)
      const last = out[out.length - 1]
      if (last && last.label === label) last.events.push(e)
      else out.push({ label, events: [e] })
    }
    return out
  }, [filtered])

  const setPeek = (id: string) => useStore.getState().setPeek(id)

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
                      users={users}
                      fmt={fmt}
                      onPeek={setPeek}
                    />
                  ))}
              </div>
            )
          })}
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
  users: ReturnType<typeof useStore.getState>['users']
  fmt: (name: string | undefined) => string
  onPeek: (issueId: string) => void
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
  users,
  fmt,
  onPeek,
}: RowProps) {
  // Issue activities reuse ActivityItem verbatim (it already renders the
  // Linear-style sentence), wrapped so the whole row peeks the issue.
  if (e.type === 'activity') {
    const issue = issues.find((i) => i.id === e.activity.issueId)
    return (
      <button
        type="button"
        onClick={() => issue && onPeek(issue.id)}
        className="flex w-full items-center gap-2 px-4 py-1.5 pl-9 text-left transition-colors hover:bg-bg-hover"
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
    )
  }

  const actor = users.find((u) => u.id === e.userId)
  const name = fmt(actor?.name)

  if (e.type === 'comment') {
    const issue = issues.find((i) => i.id === e.issueId)
    return (
      <button
        type="button"
        onClick={() => issue && onPeek(issue.id)}
        className="flex w-full items-center gap-2 px-4 py-1.5 pl-9 text-left text-[12px] text-muted transition-colors hover:bg-bg-hover"
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
    )
  }

  // project / initiative update
  const target =
    e.type === 'project'
      ? projects.find((p) => p.id === e.projectId)
      : initiatives.find((i) => i.id === e.initiativeId)
  return (
    <div className="flex w-full items-center gap-2 px-4 py-1.5 pl-9 text-[12px] text-muted">
      <GlyphFor kind="project" />
      <Avatar user={actor} size={18} />
      <span className="text-fg">{name}</span>
      <span>posted a</span>
      <span className="font-medium text-fg">{HEALTH_LABEL[e.health]}</span>
      <span>update on</span>
      <span className="font-medium text-fg">{target?.name ?? 'project'}</span>
      <span className="ml-auto shrink-0 text-faint">· {timeAgo(e.createdAt)}</span>
    </div>
  )
}
