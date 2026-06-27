import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { StatusIcon } from '@/components/StatusIcon'
import { MemberContributionHeatmap } from '@/components/MemberContributionHeatmap'
import { PriorityIcon } from '@/components/PriorityIcon'
import type { Issue, User, WorkflowState } from '@/lib/types'

// ── Stat card (mirrors ProfileView's Stat) ───────────────────────────────────

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

// How many issues to show per status group before collapsing into "+N more".
const GROUP_CAP = 6

/**
 * Member detail / profile page — Linear's member view: clicking a workspace
 * member opens a page with their avatar, name, role, a row of work stats, and
 * their open assigned issues grouped by workflow state. Read-only; mirrors
 * ProfileView's container width, paddings, and heading styles so it feels native.
 */
export function MemberDetailView() {
  const { userId } = useParams()
  const users = useStore((s) => s.users)
  const issues = useStore((s) => s.issues)
  const states = useStore((s) => s.states)
  const setPeek = useStore((s) => s.setPeek)
  const fmt = useDisplayName()

  const user = useMemo<User | undefined>(
    () => users.find((u) => u.id === userId),
    [users, userId],
  )

  const stateById = useMemo(() => {
    const m = new Map<string, WorkflowState>()
    states.forEach((s) => m.set(s.id, s))
    return m
  }, [states])

  // ── work stats ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const id = user?.id
    const assigned = issues.filter((i) => !i.triage && !i.archivedAt && i.assigneeId === id)
    const openAssigned = assigned.filter((i) => {
      const type = stateById.get(i.stateId)?.type
      return type !== 'completed' && type !== 'canceled'
    })
    const created = issues.filter((i) => !i.archivedAt && i.creatorId === id).length
    const completed = assigned.filter((i) => stateById.get(i.stateId)?.type === 'completed').length
    return { assigned: openAssigned.length, created, completed }
  }, [issues, user, stateById])

  // ── open assigned issues, grouped by workflow state (active states only) ─────
  const groups = useMemo(() => {
    const id = user?.id
    const open = issues.filter((i) => {
      if (i.triage || i.archivedAt || i.assigneeId !== id) return false
      const type = stateById.get(i.stateId)?.type
      return type !== 'completed' && type !== 'canceled'
    })
    const ordered = [...states].sort((a, b) => a.position - b.position)
    return ordered
      .map((s) => ({
        state: s,
        rows: open
          .filter((i) => i.stateId === s.id)
          .sort((a, b) => {
            // Urgent(1) → … → Low(4) → None(0) last, like My Issues.
            const pa = a.priority === 0 ? 99 : a.priority
            const pb = b.priority === 0 ? 99 : b.priority
            return pa - pb
          }),
      }))
      .filter((g) => g.rows.length > 0)
  }, [issues, states, user, stateById])

  // ── not found ────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title="Member" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-bg-secondary text-center">
          <Users size={28} className="text-faint" />
          <div className="text-[14px] font-medium text-fg">Member not found</div>
          <p className="max-w-xs text-[12px] text-muted">
            This member doesn’t exist or has been removed from the workspace.
          </p>
          <Link
            to="/members"
            className="mt-1 text-[12px] text-accent hover:underline"
          >
            Back to Members
          </Link>
        </div>
      </div>
    )
  }

  const IssueRowItem = ({ issue }: { issue: Issue }) => {
    const state = stateById.get(issue.stateId)
    return (
      <button
        type="button"
        onClick={() => setPeek(issue.id)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-bg-hover"
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <PriorityIcon priority={issue.priority} />
        </span>
        {state && (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            <StatusIcon type={state.type} color={state.color} />
          </span>
        )}
        <span className="w-14 shrink-0 font-mono text-[12px] text-faint">{issue.identifier}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{issue.title}</span>
      </button>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Member">
        <Link
          to="/members"
          className="ml-auto flex items-center gap-1 text-[12px] text-muted hover:text-fg"
        >
          <ArrowLeft size={13} />
          Members
        </Link>
      </ViewHeader>
      <div className="flex-1 overflow-y-auto bg-bg-secondary">
        <div className="mx-auto max-w-4xl px-8 py-8">
          {/* Header card */}
          <section className="flex items-center gap-5 rounded-xl border border-border bg-bg p-6">
            <Avatar user={user} size={64} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[20px] font-semibold tracking-tight text-fg">
                  {fmt(user.name)}
                </h1>
                <span className="rounded border border-border px-1.5 py-0.5 text-[11px] capitalize text-muted">
                  {user.role}
                </span>
                {user.pending && (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted">
                    Pending
                  </span>
                )}
                {user.suspended && (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-[var(--priority-urgent)]">
                    Suspended
                  </span>
                )}
              </div>
              {user.email && <div className="mt-0.5 truncate text-[13px] text-muted">{user.email}</div>}
              {user.bio && <p className="mt-2 text-[12px] text-muted">{user.bio}</p>}
            </div>
          </section>

          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Assigned" value={stats.assigned} hint="open right now" />
            <Stat label="Created" value={stats.created} hint="issues created" />
            <Stat label="Completed" value={stats.completed} hint="assigned & done" />
          </div>

          {/* Contribution heatmap */}
          <div className="mt-6">
            <Card title="Contributions" subtitle="Issues completed and created">
              <MemberContributionHeatmap userId={user.id} />
            </Card>
          </div>

          {/* Assigned issues, grouped by workflow state */}
          <div className="mt-6">
            <Card title="Assigned issues" subtitle={`Open work assigned to ${fmt(user.name)}`}>
              {groups.length === 0 ? (
                <div className="px-1 py-6 text-center text-[12px] text-faint">
                  Nothing open — all caught up.
                </div>
              ) : (
                <div className="space-y-5">
                  {groups.map((g) => {
                    const shown = g.rows.slice(0, GROUP_CAP)
                    const extra = g.rows.length - shown.length
                    return (
                      <div key={g.state.id}>
                        <div className="mb-1.5 flex items-center gap-1.5 px-2">
                          <StatusIcon type={g.state.type} color={g.state.color} />
                          <span className="text-[12px] font-medium text-fg">{g.state.name}</span>
                          <span className="text-[11px] tabular-nums text-faint">{g.rows.length}</span>
                        </div>
                        <div className="space-y-0.5">
                          {shown.map((issue) => (
                            <IssueRowItem key={issue.id} issue={issue} />
                          ))}
                        </div>
                        {extra > 0 && (
                          <div className="mt-1 px-2 text-[11px] text-faint">+{extra} more</div>
                        )}
                      </div>
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
