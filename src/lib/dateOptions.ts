/**
 * Date presets shared by every "when?" surface — the Properties reminder row
 * and the issue ⋯ menu's `Due date` / `Remind me` submenus. Linear computes
 * these once and reuses them everywhere; keeping them here stops the two
 * surfaces from drifting apart on what "Next week" means.
 *
 * Every helper returns a fresh `Date` in local time.
 */

/** now + `n` hours. */
export function inHours(n: number): Date {
  const d = new Date()
  d.setHours(d.getHours() + n)
  return d
}

/** `dayOffset` days from now, pinned to a local hour:minute. */
export function atTime(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}

/** The next Monday at `hour` local — never today, even if today is Monday. */
export function nextMonday(hour = 9): Date {
  const d = new Date()
  // 0 = Sun … 1 = Mon. Days until the *next* Monday (always ≥ 1).
  const delta = ((1 - d.getDay() + 7) % 7) || 7
  d.setDate(d.getDate() + delta)
  d.setHours(hour, 0, 0, 0)
  return d
}

/** 18:00 today, rolling to tomorrow evening once today's has passed. */
export function thisEvening(): Date {
  const evening = atTime(0, 18)
  return evening.getTime() <= Date.now() ? atTime(1, 18) : evening
}

/**
 * `dueDate` minus `leadDays`, pinned to 09:00 local on that day — the moment
 * we'd nudge you "N days before this is due".
 */
export function beforeDue(dueIso: string, leadDays: number): Date {
  const d = new Date(dueIso)
  d.setDate(d.getDate() - leadDays)
  d.setHours(9, 0, 0, 0)
  return d
}

/** The coming Friday at 09:00 — Linear's "End of this week". */
export function endOfThisWeek(hour = 9): Date {
  const d = new Date()
  // 5 = Fri. Today counts, so a Friday resolves to itself.
  const delta = (5 - d.getDay() + 7) % 7
  d.setDate(d.getDate() + delta)
  d.setHours(hour, 0, 0, 0)
  return d
}

/** Local `9:00 AM` — the time half of a reminder label. */
export function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
