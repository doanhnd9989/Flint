import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'

/** Tailwind-friendly className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}

/** First name (first whitespace-delimited token) of a full name. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

/**
 * Render a user's name per the "Display names" preference.
 * `'first'` shows just the first name; `'full'` (default) the whole name.
 */
export function displayName(
  name: string,
  mode: 'full' | 'first' = 'full',
): string {
  return mode === 'first' ? firstName(name) : name
}

/** Initials from a display name, max 2 chars. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Relative-ish date label like Linear ("Jun 16", "Today", "Yesterday"). */
export function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return 'Today'
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
  return d.toLocaleDateString(DATE_LOCALE, opts)
}

/**
 * The app renders dates in one language everywhere. Pin it explicitly — a bare
 * `toLocaleDateString()` follows the browser locale, which made some surfaces
 * (the cycle burndown axis, the changelog headings) render in the visitor's
 * language while the rest of the UI stayed English.
 */
export const DATE_LOCALE = 'en-US'

export function formatFullDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(DATE_LOCALE, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Short relative time ("2h", "3d", "now"). */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(mo / 12)}y`
}

/** Fractional sort key between two neighbors (LexoRank-lite). */
export function midSort(a: number, b: number): number {
  return (a + b) / 2
}

let lastNow = 0
/**
 * Monotonic ISO timestamp so items created in the same tick keep a stable
 * order. It still tracks the wall clock: taking `max(last + 1, Date.now())`
 * means a long-lived tab can't drift behind real time the way a pure counter
 * seeded at module load would (which made everything read "5m ago" forever).
 */
export function nowIso(): string {
  lastNow = Math.max(lastNow + 1, Date.now())
  return new Date(lastNow).toISOString()
}

/**
 * True while a menu-level overlay (a picker, popover, mention/slash menu) is
 * open. Menus render into a portal, so a modal can't detect them by DOM
 * containment — they mark themselves with `data-overlay="menu"` instead.
 * Modals use this to let Escape / an outside click dismiss the *menu* first
 * rather than tearing down the whole modal underneath it.
 */
export function menuOverlayOpen(): boolean {
  return !!document.querySelector('[data-overlay="menu"]')
}

/** Kebab-case slug from arbitrary text (for branch names / URLs). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * Git branch name in Linear's format: `handle/cla-123-issue-title`.
 * The handle is derived from the user's email local-part (fallback: name).
 */
export function branchName(
  identifier: string,
  title: string,
  user?: { email?: string; name?: string },
): string {
  const handle =
    user?.email?.split('@')[0]?.toLowerCase() ||
    (user?.name ? slugify(user.name) : 'me')
  const slug = slugify(title)
  return `${handle}/${identifier.toLowerCase()}${slug ? `-${slug}` : ''}`
}

/** Shareable URL for an issue, rooted at the running app's origin. */
export function issueUrl(identifier: string): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/issue/${identifier}`
}

export function isDueSoon(iso?: string): boolean {
  if (!iso) return false
  const due = new Date(iso).getTime()
  const days = (due - Date.now()) / 86_400_000
  return days <= 3
}

export function isOverdue(iso?: string): boolean {
  if (!iso) return false
  return new Date(iso).getTime() < Date.now()
}
