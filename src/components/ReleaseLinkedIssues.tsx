import { useMemo } from 'react'
import { useStoreShallow } from '@/lib/store'
import { StatusIcon } from '@/components/StatusIcon'
import { Avatar } from '@/components/Avatar'
import type { Issue, User, WorkflowState } from '@/lib/types'

/**
 * Read-only list of the issues belonging to a release, grouped by workflow
 * state — mirrors Linear's release "Issues" view. A {@link Release} has no
 * direct issue link; it carries an optional `projectId`, so (like
 * {@link ReleasesView} and {@link ReleaseBurndownChart}) we derive the issues
 * from the linked project: `projectId === release.projectId`, archived excluded.
 *
 * Each row shows the issue's StatusIcon, identifier, title, and assignee avatar.
 * Groups are ordered by workflow-state position; a header summarises counts
 * ("8 issues · 3 done"). With no linked project we show an empty hint.
 */
export function ReleaseLinkedIssues({ projectId }: { projectId?: string }) {
  const { issues, states, users } = useStoreShallow((s) => ({
    issues: s.issues,
    states: s.states,
    users: s.users,
  }))

  const userById = useMemo(() => {
    const m: Record<string, User> = {}
    for (const u of users as User[]) m[u.id] = u
    return m
  }, [users])

  /** This release's issues (linked project, not archived). */
  const linked = useMemo(() => {
    if (!projectId) return [] as Issue[]
    return (issues as Issue[]).filter(
      (i) => i.projectId === projectId && !i.archivedAt,
    )
  }, [issues, projectId])

  /** doneCount = issues in a completed/canceled workflow state. */
  const doneCount = useMemo(() => {
    const doneIds = new Set(
      (states as WorkflowState[])
        .filter((s) => s.type === 'completed' || s.type === 'canceled')
        .map((s) => s.id),
    )
    return linked.filter((i) => doneIds.has(i.stateId)).length
  }, [linked, states])

  /** Issues grouped by workflow state, ordered by state position. */
  const groups = useMemo(() => {
    const ordered = [...(states as WorkflowState[])].sort(
      (a, b) => a.position - b.position,
    )
    return ordered
      .map((st) => ({
        state: st,
        items: linked
          .filter((i) => i.stateId === st.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .filter((g) => g.items.length > 0)
  }, [linked, states])

  if (!projectId) {
    return (
      <div className="rounded-lg border border-border bg-bg-secondary px-3 py-3 text-[12px] text-faint">
        No project is linked to this release, so there are no issues to show.
      </div>
    )
  }

  if (linked.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-secondary px-3 py-3 text-[12px] text-faint">
        The linked project has no issues yet.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-bg-secondary">
      {/* Summary header — total + done count */}
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-faint">
        Issues
        <span className="tabular-nums normal-case">
          {linked.length} issue{linked.length === 1 ? '' : 's'} · {doneCount}{' '}
          done
        </span>
      </div>

      {groups.map((g) => (
        <div key={g.state.id}>
          {/* state group header */}
          <div className="flex items-center gap-1.5 bg-bg-tertiary px-3 py-1 text-[11px] font-medium text-muted">
            <StatusIcon type={g.state.type} color={g.state.color} size={13} />
            <span>{g.state.name}</span>
            <span className="text-faint tabular-nums">{g.items.length}</span>
          </div>

          {g.items.map((i) => {
            const assignee = i.assigneeId ? userById[i.assigneeId] : undefined
            return (
              <div
                key={i.id}
                className="flex items-center gap-2 px-3 py-1.5 text-[13px]"
              >
                <StatusIcon
                  type={g.state.type}
                  color={g.state.color}
                  size={14}
                />
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-faint">
                  {i.identifier}
                </span>
                <span className="min-w-0 flex-1 truncate text-fg">
                  {i.title}
                </span>
                <Avatar user={assignee} size={18} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
