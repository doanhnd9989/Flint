import { useStoreShallow } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { StatusPicker, PriorityPicker, AssigneePicker } from './pickers'
import { cn, formatDate, isOverdue } from '@/lib/utils'

export function IssueRow({
  issue,
  showStatus = true,
}: {
  issue: Issue
  showStatus?: boolean
}) {
  const { states, users, labels, setIssueStatus, setIssuePriority, setIssueAssignee, setPeek } =
    useStoreShallow((s) => ({
      states: s.states,
      users: s.users,
      labels: s.labels,
      setIssueStatus: s.setIssueStatus,
      setIssuePriority: s.setIssuePriority,
      setIssueAssignee: s.setIssueAssignee,
      setPeek: s.setPeek,
    }))

  const state = states.find((s) => s.id === issue.stateId)
  const assignee = users.find((u) => u.id === issue.assigneeId)
  const issueLabels = issue.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter(Boolean)

  return (
    <div
      onClick={() => setPeek(issue.id)}
      className="group flex cursor-pointer items-center gap-2 px-4 py-1.5 hover:bg-bg-hover border-b border-border/40"
    >
      <PriorityPicker
        priority={issue.priority}
        onChange={(p) => setIssuePriority(issue.id, p)}
        trigger={
          <span className="flex h-5 w-5 items-center justify-center rounded hover:bg-bg-selected">
            <PriorityIcon priority={issue.priority} />
          </span>
        }
      />

      <span className="w-14 shrink-0 font-mono text-[12px] text-faint">
        {issue.identifier}
      </span>

      {showStatus && state && (
        <StatusPicker
          stateId={issue.stateId}
          onChange={(id) => setIssueStatus(issue.id, id)}
          trigger={
            <span className="flex h-5 w-5 items-center justify-center rounded hover:bg-bg-selected">
              <StatusIcon type={state.type} color={state.color} />
            </span>
          }
        />
      )}

      <span className="flex-1 truncate text-[13px] text-fg">{issue.title}</span>

      <div className="flex items-center gap-1.5 shrink-0">
        {issue.dueDate && (
          <span
            className={cn(
              'text-[11px]',
              isOverdue(issue.dueDate) ? 'text-[var(--priority-urgent)]' : 'text-faint',
            )}
          >
            {formatDate(issue.dueDate)}
          </span>
        )}
        {issueLabels.length > 0 && (
          <div className="hidden items-center gap-1 sm:flex">
            {issueLabels.slice(0, 3).map((l) => (
              <span
                key={l!.id}
                className="flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-[11px] text-muted"
              >
                <LabelDot color={l!.color} />
                {l!.name}
              </span>
            ))}
          </div>
        )}
        <span className="w-10 text-right text-[11px] text-faint">
          {formatDate(issue.createdAt)}
        </span>
        <AssigneePicker
          assigneeId={issue.assigneeId}
          onChange={(id) => setIssueAssignee(issue.id, id)}
          align="end"
          trigger={
            <span className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-bg-selected">
              <Avatar user={assignee} size={20} />
            </span>
          }
        />
      </div>
    </div>
  )
}
