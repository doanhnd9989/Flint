import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  CircleDashed,
  Flag,
  UserRound,
  Tag,
  FolderClosed,
  Diamond,
  IterationCw,
  PenLine,
  Link2,
  GitBranch,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { timeAgo } from '@/lib/utils'
import type { Activity, ActivityKind, Issue, User, WorkflowState } from '@/lib/types'

// ── Stat card (matches InsightsView's Stat) ──────────────────────────────────

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-4 py-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-tight text-fg tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-bg p-5">
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold text-fg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

// ── Breakdown bar (matches InsightsView's By-status block) ───────────────────

interface Bar {
  key: string
  label: string
  value: number
  color: string
}

function BarChart({ bars, max }: { bars: Bar[]; max: number }) {
  if (bars.length === 0) {
    return <div className="px-1 py-6 text-center text-[12px] text-faint">Nothing open — you're all caught up.</div>
  }
  return (
    <div className="space-y-2.5">
      {bars.map((b) => (
        <div key={b.key} className="group flex items-center gap-3">
          <div className="flex w-28 shrink-0 items-center gap-1.5" title={b.label}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
            <span className="truncate text-[12px] text-muted group-hover:text-fg">{b.label}</span>
          </div>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{ width: `${max > 0 ? (b.value / max) * 100 : 0}%`, backgroundColor: b.color }}
            />
          </div>
          <div className="w-7 shrink-0 text-right text-[12px] tabular-nums text-fg">{b.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Recent activity ──────────────────────────────────────────────────────────

const VERB: Record<ActivityKind | 'comment', string> = {
  comment: 'commented on',
  created: 'created',
  status: 'changed the status of',
  priority: 'changed the priority of',
  assignee: 'reassigned',
  label: 'updated labels on',
  project: 'changed the project of',
  milestone: 'changed the milestone of',
  cycle: 'changed the cycle of',
  title: 'renamed',
  estimate: 'changed the estimate of',
  dueDate: 'changed the due date of',
  link: 'added a link to',
  parent: 'changed the parent of',
}

function KindIcon({ kind }: { kind: ActivityKind | 'comment' }) {
  const c = 'text-faint'
  const s = 13
  switch (kind) {
    case 'comment':
      return <MessageSquare size={s} className={c} />
    case 'status':
      return <CircleDashed size={s} className={c} />
    case 'priority':
      return <Flag size={s} className={c} />
    case 'assignee':
      return <UserRound size={s} className={c} />
    case 'label':
      return <Tag size={s} className={c} />
    case 'project':
      return <FolderClosed size={s} className={c} />
    case 'milestone':
      return <Diamond size={s} className={c} />
    case 'cycle':
      return <IterationCw size={s} className={c} />
    case 'link':
      return <Link2 size={s} className={c} />
    case 'parent':
      return <GitBranch size={s} className={c} />
    case 'title':
    case 'created':
    default:
      return <PenLine size={s} className={c} />
  }
}

interface RecentEvent {
  id: string
  issueId: string
  kind: ActivityKind | 'comment'
  createdAt: string
}

/**
 * Profile / "Your work" — a personal dashboard for the current user: their
 * profile header, a row of work stats, an open-issues-by-status breakdown, and
 * their most recent activity.
 */
export function ProfileView() {
  const data = useStore()
  const setPeek = useStore((s) => s.setPeek)
  const navigate = useNavigate()

  const me = useMemo<User | undefined>(
    () => data.users.find((u) => u.isMe) ?? data.users.find((u) => u.id === data.currentUserId),
    [data.users, data.currentUserId],
  )

  const stateById = useMemo(() => {
    const m = new Map<string, WorkflowState>()
    data.states.forEach((s) => m.set(s.id, s))
    return m
  }, [data.states])

  // ── work stats ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const meId = me?.id
    const assigned: Issue[] = data.issues.filter((i) => !i.triage && i.assigneeId === meId)
    const created = data.issues.filter((i) => i.creatorId === meId).length
    const completed = assigned.filter((i) => stateById.get(i.stateId)?.type === 'completed').length
    const rate = assigned.length > 0 ? Math.round((completed / assigned.length) * 100) : 0
    return { assigned: assigned.length, created, completed, rate }
  }, [data.issues, me, stateById])

  // ── my open issues by status ─────────────────────────────────────────────────
  const byStatus = useMemo<Bar[]>(() => {
    const meId = me?.id
    const open = data.issues.filter(
      (i) => !i.triage && i.assigneeId === meId && stateById.get(i.stateId)?.type !== 'completed',
    )
    const order = [...data.states].sort((a, b) => a.position - b.position)
    return order
      .map((s) => ({
        key: s.id,
        label: s.name,
        value: open.filter((i) => i.stateId === s.id).length,
        color: s.color,
      }))
      .filter((b) => b.value > 0)
  }, [data.issues, data.states, me, stateById])

  const maxStatus = byStatus.reduce((m, b) => Math.max(m, b.value), 0)

  // ── recent activity (my own actions, newest first) ───────────────────────────
  const recent = useMemo<RecentEvent[]>(() => {
    const meId = me?.id
    const acts: RecentEvent[] = data.activities
      .filter((a: Activity) => a.userId === meId)
      .map((a) => ({ id: a.id, issueId: a.issueId, kind: a.kind, createdAt: a.createdAt }))
    const comments: RecentEvent[] = data.comments
      .filter((c) => c.userId === meId)
      .map((c) => ({ id: c.id, issueId: c.issueId, kind: 'comment' as const, createdAt: c.createdAt }))
    return [...acts, ...comments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
  }, [data.activities, data.comments, me])

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Profile" />
      <div className="flex-1 overflow-y-auto bg-bg-secondary">
        <div className="mx-auto max-w-4xl px-8 py-8">
          {/* Header card */}
          <section className="flex items-center gap-5 rounded-xl border border-border bg-bg p-6">
            <Avatar user={me} size={64} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[20px] font-semibold tracking-tight text-fg">
                  {me?.name ?? 'You'}
                </h1>
                {me && (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[11px] capitalize text-muted">
                    {me.role}
                  </span>
                )}
              </div>
              {me?.email && <div className="mt-0.5 truncate text-[13px] text-muted">{me.email}</div>}
              <button
                type="button"
                onClick={() => navigate('/settings?page=profile')}
                className="mt-2 text-[12px] text-faint hover:text-muted hover:underline"
              >
                Edit profile in Settings → Profile
              </button>
            </div>
          </section>

          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Assigned" value={stats.assigned} />
            <Stat label="Created" value={stats.created} />
            <Stat label="Completed" value={stats.completed} />
            <Stat label="Completion rate" value={`${stats.rate}%`} hint="of your assigned work" />
          </div>

          {/* Breakdowns + activity */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="My open issues by status" subtitle="Active work assigned to you">
              <BarChart bars={byStatus} max={maxStatus} />
            </Card>

            <Card title="Recent activity" subtitle="Your latest changes across issues">
              {recent.length === 0 ? (
                <div className="px-1 py-6 text-center text-[12px] text-faint">No activity yet.</div>
              ) : (
                <div className="space-y-0.5">
                  {recent.map((e) => {
                    const issue = data.issues.find((i) => i.id === e.issueId)
                    if (!issue) return null
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setPeek(issue.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-bg-hover"
                      >
                        <KindIcon kind={e.kind} />
                        <span className="min-w-0 flex-1 truncate text-muted">
                          You {VERB[e.kind]}{' '}
                          <span className="font-mono text-[12px] text-fg">{issue.identifier}</span>
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-faint">
                          {timeAgo(e.createdAt)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
