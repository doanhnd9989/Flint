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

/** 9am on the given day — Linear's snooze presets all land on the morning. */
export function morning(d: Date): Date {
  d.setHours(9, 0, 0, 0)
  return d
}

/**
 * Linear renders a snooze preset's resolved moment on the right of the row
 * ("Sat, 8 Aug, 9:00"). Same shape here — day-first, short month, 24h clock.
 */
export function stamp(d: Date): string {
  const day = d.toLocaleDateString('en-US', { weekday: 'short' })
  // en-US keeps September as "Sep"; en-GB renders "Sept", which Linear doesn't.
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  return `${day}, ${d.getDate()} ${month}, ${d.getHours()}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}

/**
 * The four fixed rows of Linear's `Snooze ▸` flyout, in its order. `Next cycle`
 * and `Custom…` depend on the surface (the first needs the issue's team, the
 * second opens a date picker), so callers append those themselves.
 */
export function snoozePresets(): { label: string; at: Date }[] {
  const now = new Date()
  const nextWeek = morning(new Date(now))
  // "Next week" is the coming Monday, not now+7d — Linear lands it on the week
  // start (Fri 7 Aug → Mon 10 Aug).
  nextWeek.setDate(nextWeek.getDate() + ((8 - nextWeek.getDay()) % 7 || 7))
  const nextMonth = morning(new Date(now))
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  return [
    { label: 'An hour from now', at: new Date(now.getTime() + 3_600_000) },
    { label: 'Tomorrow', at: morning(new Date(now.getTime() + 86_400_000)) },
    { label: 'Next week', at: nextWeek },
    { label: 'A month from now', at: nextMonth },
  ]
}
