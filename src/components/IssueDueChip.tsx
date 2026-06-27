import { CalendarClock } from 'lucide-react'
import type { Issue } from '@/lib/types'
import { cn } from '@/lib/utils'

// Relative due-date pill (Linear: "Due in 3d" / "Overdue by 2d").
export function IssueDueChip({ issue }: { issue: Issue }) {
  if (!issue.dueDate) return null

  const startOfDay = (ms: number) => {
    const d = new Date(ms)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const days = Math.round(
    (startOfDay(new Date(issue.dueDate).getTime()) - startOfDay(Date.now())) / 86400000,
  )
  const overdue = days < 0

  const label =
    days < 0
      ? `Overdue by ${-days}d`
      : days === 0
        ? 'Due today'
        : days === 1
          ? 'Due tomorrow'
          : `Due in ${days}d`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-bg-secondary px-1.5 py-0.5 text-[11px] font-medium',
        overdue
          ? 'text-[var(--priority-urgent)]'
          : days <= 2
            ? 'text-[var(--status-started)]'
            : 'text-muted',
      )}
    >
      <CalendarClock size={11} />
      {label}
    </span>
  )
}
