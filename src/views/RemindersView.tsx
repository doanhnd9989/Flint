import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Search, X } from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { StatusIcon } from '@/components/StatusIcon'
import { Popover } from '@/components/ui/Popover'
import { EmptyState, CycleIllustration } from '@/components/EmptyState'
import { formatDate, isOverdue } from '@/lib/utils'
import type { Issue } from '@/lib/types'

/** Local time formatter ("9:00 AM") for reminder preset times. */
function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** "Today", "Yesterday", "Jun 26" + a clock time ("Jun 26, 2:30 PM"). */
function formatReminder(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(new Date(iso))}`
}

// Reschedule preset math — mirrors IssueReminders.tsx so the two surfaces agree.

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

// Upcoming-reminder time buckets — mirrors how Linear groups reminders by
// proximity (Today / Tomorrow / This week / Later) instead of one flat list.
type Bucket = 'today' | 'tomorrow' | 'week' | 'later'

const BUCKET_LABELS: Record<Bucket, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
  later: 'Later',
}

/** Which upcoming bucket an ISO timestamp falls into, relative to now. */
function bucketFor(iso: string): Bucket {
  const d = new Date(iso)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  // Whole days between today's midnight and the reminder's day.
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const days = Math.round((day.getTime() - start.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days <= 7) return 'week'
  return 'later'
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

  // Free-text filter over reminders by issue title / identifier (Linear-style).
  const [query, setQuery] = useState('')

  // Issues with a live reminder, soonest first, split into overdue + upcoming
  // time buckets (Today / Tomorrow / This week / Later), Linear-style. A
  // case-insensitive `query` narrows the set by title or identifier.
  const { overdue, upcomingBuckets, total, matches } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = issues
      .filter((i): i is Issue & { remindAt: string } =>
        Boolean(i.remindAt) && !i.archivedAt,
      )
      .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
    const withReminder = all.filter(
      (i) =>
        !q ||
        i.title.toLowerCase().includes(q) ||
        i.identifier.toLowerCase().includes(q),
    )
    const upcoming = withReminder.filter((i) => !isOverdue(i.remindAt))
    // Group upcoming into ordered buckets, dropping empty ones.
    const order: Bucket[] = ['today', 'tomorrow', 'week', 'later']
    const upcomingBuckets = order
      .map((bucket) => ({
        bucket,
        items: upcoming.filter((i) => bucketFor(i.remindAt) === bucket),
      }))
      .filter((g) => g.items.length > 0)
    return {
      overdue: withReminder.filter((i) => isOverdue(i.remindAt)),
      upcomingBuckets,
      total: all.length,
      matches: withReminder.length,
    }
  }, [issues, query])

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

        <span
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Popover
            align="end"
            width={240}
            trigger={
              <span
                title="Reschedule reminder"
                className="flex h-6 w-6 items-center justify-center rounded text-faint transition-colors hover:bg-bg-selected hover:text-fg"
              >
                <Clock size={14} />
              </span>
            }
          >
            {(close) => {
              const options: { label: string; at: Date }[] = [
                { label: 'In 1 hour', at: inHours(1) },
                { label: 'This evening', at: thisEvening() },
                { label: 'Tomorrow', at: atTime(1, 9) },
                { label: 'Next week', at: nextMonday() },
              ]
              return (
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
                      <span className="text-[12px] text-faint">{formatTime(o.at)}</span>
                    </button>
                  ))}
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
                    Remove
                  </button>
                </div>
              )
            }}
          </Popover>
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
        <>
          {/* Search bar — filter reminders by issue title or identifier. */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-1.5">
            <Search size={14} className="shrink-0 text-faint" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter reminders…"
              className="flex-1 bg-transparent text-[13px] text-fg placeholder:text-faint focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                title="Clear filter"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-faint transition-colors hover:bg-bg-selected hover:text-fg"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {matches === 0 ? (
            <EmptyState
              illustration={<CycleIllustration />}
              title="No matching reminders"
              description="No reminders match your filter."
            />
          ) : (
            <div className="flex-1 overflow-y-auto">
              {overdue.length > 0 && (
                <>
                  <div className="flex items-center justify-between bg-bg-secondary px-4 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                    <div className="flex items-center gap-2">
                      <span style={{ color: 'var(--priority-urgent)' }}>Overdue</span>
                      <span className="tabular-nums text-faint">{overdue.length}</span>
                    </div>
                    {/* Bulk-reschedule every overdue reminder to one preset at once. */}
                    <Popover
                      align="end"
                      width={240}
                      trigger={
                        <span
                          title="Reschedule all overdue reminders"
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-muted transition-colors hover:bg-bg-selected hover:text-fg"
                        >
                          <Clock size={12} />
                          Reschedule all
                        </span>
                      }
                    >
                      {(close) => {
                        const options: { label: string; at: Date }[] = [
                          { label: 'In 1 hour', at: inHours(1) },
                          { label: 'This evening', at: thisEvening() },
                          { label: 'Tomorrow', at: atTime(1, 9) },
                          { label: 'Next week', at: nextMonday() },
                        ]
                        return (
                          <div className="flex flex-col">
                            {options.map((o) => (
                              <button
                                key={o.label}
                                type="button"
                                onClick={() => {
                                  const iso = o.at.toISOString()
                                  overdue.forEach((i) => setIssueReminder(i.id, iso))
                                  close()
                                }}
                                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
                              >
                                <span>{o.label}</span>
                                <span className="text-[12px] text-faint">{formatTime(o.at)}</span>
                              </button>
                            ))}
                          </div>
                        )
                      }}
                    </Popover>
                  </div>
                  {overdue.map(renderRow)}
                </>
              )}
              {upcomingBuckets.map(({ bucket, items }) => (
                <div key={bucket}>
                  <div className="flex items-center justify-between bg-bg-secondary px-4 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                    <span>{BUCKET_LABELS[bucket]}</span>
                    <span className="tabular-nums text-faint">{items.length}</span>
                  </div>
                  {items.map(renderRow)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
