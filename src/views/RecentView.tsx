import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { StatusIcon } from '@/components/StatusIcon'
import { EmptyState, IssuesIllustration } from '@/components/EmptyState'
import type { Issue } from '@/lib/types'

/**
 * Recently viewed — the issues you've opened most recently, newest first.
 * Reads the persisted `recentIssueIds` (capped at 30) and resolves each id to a
 * live issue, skipping any whose issue no longer exists. Rows are a lightweight
 * self-rendered version of `IssueRow` (no list-context plumbing) so this view
 * stays decoupled from the issues board/list state.
 */
export function RecentView() {
  const navigate = useNavigate()
  const fmtName = useDisplayName()
  const recentIssueIds = useStore((s) => s.recentIssueIds)
  const issues = useStore((s) => s.issues)
  const states = useStore((s) => s.states)
  const users = useStore((s) => s.users)

  // Resolve ids → issues in recency order, dropping ids that no longer resolve.
  const recent = useMemo(() => {
    const byId = new Map(issues.map((i) => [i.id, i]))
    return recentIssueIds
      .map((id) => byId.get(id))
      .filter((i): i is Issue => Boolean(i))
  }, [recentIssueIds, issues])

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Recently viewed">
        {recent.length > 0 && (
          <span className="text-[12px] tabular-nums text-faint">{recent.length}</span>
        )}
      </ViewHeader>

      {recent.length === 0 ? (
        <EmptyState
          illustration={<IssuesIllustration />}
          title="No recently viewed issues"
          description="Issues you open will appear here for quick access."
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {recent.map((issue) => {
            const state = states.find((s) => s.id === issue.stateId)
            const assignee = users.find((u) => u.id === issue.assigneeId)
            return (
              <button
                key={issue.id}
                type="button"
                onClick={() => navigate(`/issue/${issue.identifier}`)}
                className="flex w-full items-center gap-2.5 border-b border-border/40 px-4 py-1.5 text-left transition-colors hover:bg-bg-hover"
              >
                {state && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <StatusIcon type={state.type} color={state.color} />
                  </span>
                )}
                <span className="w-14 shrink-0 font-mono text-[12px] text-faint">
                  {issue.identifier}
                </span>
                <span className="flex-1 truncate text-[13px] text-fg">{issue.title}</span>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center"
                  title={assignee ? fmtName(assignee.name) : 'Unassigned'}
                >
                  <Avatar user={assignee} size={20} />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
