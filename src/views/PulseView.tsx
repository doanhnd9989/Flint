import { useMemo, useState } from 'react'
import {
  ChevronRight,
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
    users,
  } = useStoreShallow((s) => ({
    activities: s.activities,
    comments: s.comments,
    projectUpdates: s.projectUpdates,
    initiativeUpdates: s.initiativeUpdates,
    issues: s.issues,
    projects: s.projects,
    initiatives: s.initiatives,
    users: s.users,
  }))
  const fmt = useDisplayName()
  const [filter, setFilter] = useState<Filter>('all')
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

  // Apply the segmented filter.
  const filtered = useMemo(() => {
    if (filter === 'all') return events
    return events.filter((e) => {
      if (filter === 'issues') return e.type === 'activity'
      if (filter === 'comments') return e.type === 'comment'
      return e.type === 'project' || e.type === 'initiative' // projects
    })
  }, [events, filter])

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

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Pulse" />

      {/* Segmented filter — All / Issues / Comments / Projects */}
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          illustration={<CheckIllustration />}
          title="No activity yet"
          description="Recent activity across your workspace will show up here."
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
        className="flex w-full items-center gap-2 px-4 py-1.5 pl-9 text-left hover:bg-bg-hover"
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
        className="flex w-full items-center gap-2 px-4 py-1.5 pl-9 text-left text-[12px] text-muted hover:bg-bg-hover"
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
