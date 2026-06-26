import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { StatusIcon } from '@/components/StatusIcon'
import { EmptyState, CycleIllustration } from '@/components/EmptyState'
import { formatDate, isOverdue } from '@/lib/utils'
import type { Issue } from '@/lib/types'

/** "Today", "Yesterday", "Jun 26" + a clock time ("Jun 26, 2:30 PM"). */
function formatReminder(iso: string): string {
  const time = new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${formatDate(iso)}, ${time}`
}

/**
 * Reminders — every issue you've set a reminder on, soonest first.
 * Reminders are issues whose `remindAt` is set and which aren't archived. They're
 * split into "Overdue" (remindAt in the past) and "Upcoming". Each row links to
 * the issue and offers a hover dismiss "×" that clears the reminder via
 * `setIssueReminder(id, undefined)`. Rows are self-rendered (no list-context
 * plumbing) so this view stays decoupled from the issues board/list state.
 */
export function RemindersView() {
  const navigate = useNavigate()
  const fmtName = useDisplayName()
  const issues = useStore((s) => s.issues)
  const states = useStore((s) => s.states)
  const users = useStore((s) => s.users)
  const setIssueReminder = useStore((s) => s.setIssueReminder)

  // Issues with a live reminder, soonest first, split into overdue / upcoming.
  const { overdue, upcoming, total } = useMemo(() => {
    const withReminder = issues
      .filter((i): i is Issue & { remindAt: string } =>
        Boolean(i.remindAt) && !i.archivedAt,
      )
      .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
    return {
      overdue: withReminder.filter((i) => isOverdue(i.remindAt)),
      upcoming: withReminder.filter((i) => !isOverdue(i.remindAt)),
      total: withReminder.length,
    }
  }, [issues])

  function renderRow(issue: Issue & { remindAt: string }) {
    const state = states.find((s) => s.id === issue.stateId)
    const assignee = users.find((u) => u.id === issue.assigneeId)
    const past = isOverdue(issue.remindAt)
    return (
      <div
        key={issue.id}
        className="group flex w-full items-center gap-2.5 border-b border-border/40 px-4 py-1.5"
      >
        <button
          type="button"
          onClick={() => navigate(`/issue/${issue.identifier}`)}
          className="flex flex-1 items-center gap-2.5 overflow-hidden text-left"
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
        </button>

        <span
          className="shrink-0 text-[12px] tabular-nums"
          style={past ? { color: 'var(--priority-urgent)' } : undefined}
          title={new Date(issue.remindAt).toLocaleString()}
        >
          {!past ? <span className="text-muted">{formatReminder(issue.remindAt)}</span> : formatReminder(issue.remindAt)}
        </span>

        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center"
          title={assignee ? fmtName(assignee.name) : 'Unassigned'}
        >
          <Avatar user={assignee} size={20} />
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIssueReminder(issue.id, undefined)
          }}
          title="Dismiss reminder"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint opacity-0 transition-colors hover:bg-bg-selected hover:text-fg group-hover:opacity-100"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Reminders">
        {total > 0 && (
          <span className="text-[12px] tabular-nums text-faint">{total}</span>
        )}
      </ViewHeader>

      {total === 0 ? (
        <EmptyState
          illustration={<CycleIllustration />}
          title="No reminders"
          description="Set a reminder on an issue to have it resurface here."
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {overdue.length > 0 && (
            <>
              <div className="bg-bg-secondary px-4 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                Overdue
              </div>
              {overdue.map(renderRow)}
            </>
          )}
          {upcoming.length > 0 && (
            <>
              <div className="bg-bg-secondary px-4 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                Upcoming
              </div>
              {upcoming.map(renderRow)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
