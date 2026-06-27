import type { Issue } from '@/lib/types'
import { useStore } from '@/lib/store'
import { Popover } from './ui/Popover'
import { cn, formatDate, isOverdue } from '@/lib/utils'
import { Bell, BellPlus, X } from 'lucide-react'

/** Local time formatter ("9:00 AM") for reminder times. */
function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** "Tomorrow, 9:00 AM" — Linear's reminder label (relative date + local time). */
function formatReminder(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(new Date(iso))}`
}

/** now + n hours, as a fresh Date. */
function inHours(n: number): Date {
  const d = new Date()
  d.setHours(d.getHours() + n)
  return d
}

/** Today (or `dayOffset` days from now) at a given local hour:minute. */
function atTime(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}

/** Next Monday at 09:00 local. */
function nextMonday(hour = 9): Date {
  const d = new Date()
  // 0 = Sun … 1 = Mon. Days until the *next* Monday (always ≥ 1).
  const delta = ((1 - d.getDay() + 7) % 7) || 7
  d.setDate(d.getDate() + delta)
  d.setHours(hour, 0, 0, 0)
  return d
}

function thisEvening(): Date {
  const evening = atTime(0, 18)
  // If 18:00 already passed today, roll to tomorrow evening.
  return evening.getTime() <= Date.now() ? atTime(1, 18) : evening
}

/**
 * `dueDate` minus `leadDays`, pinned to 09:00 local on that day — the moment
 * we'd nudge you "N days before this is due". Returns a fresh Date.
 */
function beforeDue(dueIso: string, leadDays: number): Date {
  const d = new Date(dueIso)
  d.setDate(d.getDate() - leadDays)
  d.setHours(9, 0, 0, 0)
  return d
}

const triggerCls =
  'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-fg hover:bg-bg-hover'

/**
 * Linear's "Remind me…" control for an issue — a personal reminder you can
 * set on any issue. Rendered as a Properties-panel row; opens a Popover with
 * quick presets ("In 1 hour", "Tomorrow", …).
 */
export function IssueReminders({ issue }: { issue: Issue }) {
  const setIssueReminder = useStore((s) => s.setIssueReminder)

  const overdue = issue.remindAt ? isOverdue(issue.remindAt) : false

  const options: { label: string; at: Date }[] = [
    { label: 'In 1 hour', at: inHours(1) },
    { label: 'This evening', at: thisEvening() },
    { label: 'Tomorrow', at: atTime(1, 9) },
    { label: 'Next week', at: nextMonday() },
  ]

  // Due-date-relative presets — only meaningful when the issue has a due date.
  // Each computes remindAt = dueDate − N days (at 09:00) and reuses the same
  // setIssueReminder action, so the resolved date shows up like any reminder.
  const leadOptions: { label: string; days: number }[] = [
    { label: '1 day before due', days: 1 },
    { label: '3 days before due', days: 3 },
    { label: '7 days before due', days: 7 },
  ]

  return (
    <Popover
      align="end"
      width={240}
      trigger={
        <span className={triggerCls}>
          {issue.remindAt ? (
            <>
              <Bell size={14} className="text-faint" />
              <span className={cn(overdue && 'text-[var(--priority-urgent)]')}>
                {formatReminder(issue.remindAt)}
              </span>
            </>
          ) : (
            <>
              <BellPlus size={14} className="text-faint" />
              <span className="text-faint">Set reminder…</span>
            </>
          )}
        </span>
      }
    >
      {(close) => (
        <div className="flex flex-col">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => {
                setIssueReminder(issue.id, o.at.toISOString())
                close()
              }}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
            >
              <span>{o.label}</span>
              <span className="text-[12px] text-faint">
                {formatTime(o.at)}
              </span>
            </button>
          ))}
          {issue.dueDate && (
            <>
              <div className="my-1 border-t border-border" />
              <div className="px-2 pb-0.5 pt-1 text-[11px] font-medium text-faint">
                Before due date · {formatDate(issue.dueDate)}
              </div>
              {leadOptions.map((o) => {
                const at = beforeDue(issue.dueDate!, o.days)
                return (
                  <button
                    key={o.days}
                    type="button"
                    onClick={() => {
                      setIssueReminder(issue.id, at.toISOString())
                      close()
                    }}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
                  >
                    <span>{o.label}</span>
                    <span className="text-[12px] text-faint">{formatDate(at.toISOString())}</span>
                  </button>
                )
              })}
            </>
          )}
          {issue.remindAt && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => {
                  setIssueReminder(issue.id, undefined)
                  close()
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] text-muted hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
              >
                <X size={13} />
                Remove reminder
              </button>
            </>
          )}
        </div>
      )}
    </Popover>
  )
}
