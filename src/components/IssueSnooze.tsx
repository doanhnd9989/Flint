import type { Issue } from '@/lib/types'
import { useStore } from '@/lib/store'
import { Popover } from './ui/Popover'
import { DatePicker } from './DatePicker'
import { formatDate } from '@/lib/utils'
import { Moon, MoonStar, X, CalendarClock } from 'lucide-react'

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
  const delta = ((1 - d.getDay() + 7) % 7) || 7
  d.setDate(d.getDate() + delta)
  d.setHours(hour, 0, 0, 0)
  return d
}

function laterToday(): Date {
  const later = atTime(0, 18)
  // If 18:00 has passed, fall back to three hours from now.
  if (later.getTime() <= Date.now()) {
    const d = new Date()
    d.setHours(d.getHours() + 3, 0, 0, 0)
    return d
  }
  return later
}

const triggerCls =
  'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-fg hover:bg-bg-hover'

/**
 * Linear's "Snooze" control for an issue — temporarily hides the issue from
 * active lists until a chosen time (it resurfaces afterward). Rendered as a
 * Properties-panel row, mirroring {@link IssueReminders}: quick presets plus a
 * custom date, and an Unsnooze action while snoozed.
 */
export function IssueSnooze({ issue }: { issue: Issue }) {
  const setIssueSnooze = useStore((s) => s.setIssueSnooze)
  const snoozed = !!issue.snoozedUntil && new Date(issue.snoozedUntil).getTime() > Date.now()

  const options: { label: string; at: Date }[] = [
    { label: 'Later today', at: laterToday() },
    { label: 'Tomorrow', at: atTime(1, 9) },
    { label: 'Next week', at: nextMonday() },
  ]

  return (
    <Popover
      align="end"
      width={248}
      trigger={
        <span className={triggerCls}>
          {snoozed ? (
            <>
              <MoonStar size={14} className="text-faint" />
              <span>Until {formatDate(issue.snoozedUntil)}</span>
            </>
          ) : (
            <>
              <Moon size={14} className="text-faint" />
              <span className="text-faint">Snooze…</span>
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
                setIssueSnooze(issue.id, o.at.toISOString())
                close()
              }}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
            >
              <span>{o.label}</span>
              <span className="text-[12px] text-faint">{formatDate(o.at.toISOString())}</span>
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <DatePicker
            value={issue.snoozedUntil}
            onChange={(iso) => {
              setIssueSnooze(issue.id, iso)
              close()
            }}
            align="end"
            trigger={
              <span className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover">
                <CalendarClock size={13} className="text-faint" />
                Custom date…
              </span>
            }
          />
          {snoozed && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => {
                  setIssueSnooze(issue.id, undefined)
                  close()
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] text-muted hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
              >
                <X size={13} />
                Unsnooze
              </button>
            </>
          )}
        </div>
      )}
    </Popover>
  )
}
