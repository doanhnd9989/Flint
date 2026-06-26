import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  CircleDashed,
  Flag,
  UserRound,
  Tag,
  FolderClosed,
  Diamond,
  IterationCw,
  PenLine,
  Link2,
  GitBranch,
  Keyboard,
  ChevronRight,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { PriorityIcon } from '@/components/PriorityIcon'
import { StatusIcon } from '@/components/StatusIcon'
import { PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/constants'
import { timeAgo } from '@/lib/utils'
import type { Activity, ActivityKind, Issue, Priority, User, WorkflowState } from '@/lib/types'

// ── Stat card (matches InsightsView's Stat) ──────────────────────────────────

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-4 py-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-tight text-fg tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-bg p-5">
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold text-fg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

// ── Breakdown bar (matches InsightsView's By-status block) ───────────────────

interface Bar {
  key: string
  label: string
  value: number
  color: string
}

function BarChart({ bars, max }: { bars: Bar[]; max: number }) {
  if (bars.length === 0) {
    return <div className="px-1 py-6 text-center text-[12px] text-faint">Nothing open — you're all caught up.</div>
  }
  return (
    <div className="space-y-2.5">
      {bars.map((b) => (
        <div key={b.key} className="group flex items-center gap-3">
          <div className="flex w-28 shrink-0 items-center gap-1.5" title={b.label}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
            <span className="truncate text-[12px] text-muted group-hover:text-fg">{b.label}</span>
          </div>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{ width: `${max > 0 ? (b.value / max) * 100 : 0}%`, backgroundColor: b.color }}
            />
          </div>
          <div className="w-7 shrink-0 text-right text-[12px] tabular-nums text-fg">{b.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Priority breakdown (open assigned work, by priority) ─────────────────────

interface PriorityBar {
  priority: Priority
  value: number
}

/**
 * Open assigned work grouped by priority — Linear renders priority with its
 * glyph rather than a colored dot, so this mirrors that (urgent first, none
 * last) and tints the bar with the urgent token for the Urgent row.
 */
function PriorityBreakdown({ bars, max }: { bars: PriorityBar[]; max: number }) {
  if (bars.length === 0) {
    return <div className="px-1 py-6 text-center text-[12px] text-faint">Nothing open — you're all caught up.</div>
  }
  return (
    <div className="space-y-2.5">
      {bars.map((b) => (
        <div key={b.priority} className="group flex items-center gap-3">
          <div className="flex w-28 shrink-0 items-center gap-1.5">
            <PriorityIcon priority={b.priority} size={14} />
            <span className="truncate text-[12px] text-muted group-hover:text-fg">
              {PRIORITY_LABELS[b.priority]}
            </span>
          </div>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{
                width: `${max > 0 ? (b.value / max) * 100 : 0}%`,
                backgroundColor: b.priority === 1 ? 'var(--priority-urgent)' : 'var(--accent)',
              }}
            />
          </div>
          <div className="w-7 shrink-0 text-right text-[12px] tabular-nums text-fg">{b.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Recent activity ──────────────────────────────────────────────────────────

const VERB: Record<ActivityKind | 'comment', string> = {
  comment: 'commented on',
  created: 'created',
  status: 'changed the status of',
  priority: 'changed the priority of',
  assignee: 'reassigned',
  label: 'updated labels on',
  project: 'changed the project of',
  milestone: 'changed the milestone of',
  cycle: 'changed the cycle of',
  title: 'renamed',
  estimate: 'changed the estimate of',
  dueDate: 'changed the due date of',
  link: 'added a link to',
  parent: 'changed the parent of',
  description: 'updated the description of',
}

function KindIcon({ kind }: { kind: ActivityKind | 'comment' }) {
  const c = 'text-faint'
  const s = 13
  switch (kind) {
    case 'comment':
      return <MessageSquare size={s} className={c} />
    case 'status':
      return <CircleDashed size={s} className={c} />
    case 'priority':
      return <Flag size={s} className={c} />
    case 'assignee':
      return <UserRound size={s} className={c} />
    case 'label':
      return <Tag size={s} className={c} />
    case 'project':
      return <FolderClosed size={s} className={c} />
    case 'milestone':
      return <Diamond size={s} className={c} />
    case 'cycle':
      return <IterationCw size={s} className={c} />
    case 'link':
      return <Link2 size={s} className={c} />
    case 'parent':
      return <GitBranch size={s} className={c} />
    case 'title':
    case 'created':
    default:
      return <PenLine size={s} className={c} />
  }
}

interface RecentEvent {
  id: string
  issueId: string
  kind: ActivityKind | 'comment'
  createdAt: string
}

// ── Contribution heatmap (GitHub-style activity grid) ────────────────────────

/** A single day cell in the heatmap. */
interface HeatDay {
  /** Local YYYY-MM-DD key. */
  key: string
  date: Date
  count: number
}

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Local-date key (YYYY-MM-DD) — avoids UTC drift across day boundaries. */
function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Map an activity count onto Linear/GitHub's 5-step intensity ramp (0–4). */
function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

/** Token-driven fill for each intensity step (empty cells use the surface). */
const HEAT_FILL = [
  'bg-bg-tertiary',
  'bg-accent/25',
  'bg-accent/45',
  'bg-accent/70',
  'bg-accent',
]

/**
 * GitHub-style contribution grid: 7 rows (Sun→Sat) × N week-columns covering
 * roughly the last 3 months, each square shaded by that day's activity count.
 * Columns are padded so the first column starts on a Sunday, matching Linear.
 */
function ContributionHeatmap({ weeks, total }: { weeks: HeatDay[][]; total: number }) {
  // Month labels sit above the first column whose week introduces a new month.
  const monthCols = useMemo(() => {
    const out: { col: number; label: string }[] = []
    let lastMonth = -1
    weeks.forEach((week, col) => {
      const first = week.find((d) => d.count >= 0) ?? week[0]
      if (!first) return
      const m = first.date.getMonth()
      if (m !== lastMonth) {
        out.push({ col, label: MONTH_NAMES[m] })
        lastMonth = m
      }
    })
    return out
  }, [weeks])

  return (
    <div>
      <div className="flex gap-2">
        {/* Weekday scale */}
        <div className="flex flex-col gap-[3px] pt-[18px]">
          {WEEKDAY_LABELS.map((w, i) => (
            <div key={i} className="h-[11px] text-[9px] leading-[11px] text-faint">
              {w}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          {/* Month scale */}
          <div className="relative mb-1 h-[14px]" style={{ width: weeks.length * 14 }}>
            {monthCols.map((m) => (
              <span
                key={`${m.col}-${m.label}`}
                className="absolute top-0 text-[9px] text-faint"
                style={{ left: m.col * 14 }}
              >
                {m.label}
              </span>
            ))}
          </div>
          {/* Week columns */}
          <div className="flex gap-[3px]">
            {weeks.map((week, col) => (
              <div key={col} className="flex flex-col gap-[3px]">
                {week.map((d) => (
                  <div
                    key={d.key}
                    title={`${d.count} ${d.count === 1 ? 'contribution' : 'contributions'} on ${d.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`}
                    className={`h-[11px] w-[11px] rounded-[2px] ${HEAT_FILL[heatLevel(d.count)]}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Footer: total + legend */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-faint">
        <span>
          {total} {total === 1 ? 'contribution' : 'contributions'} in the last 3 months
        </span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {HEAT_FILL.map((fill, i) => (
            <span key={i} className={`h-[11px] w-[11px] rounded-[2px] ${fill}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  )
}

// ── Time-period scope ────────────────────────────────────────────────────────

type Period = 'all' | 'week' | 'month'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
]

/** Inclusive lower bound (ms) for a period, or 0 for "all time". */
function periodStart(period: Period): number {
  if (period === 'all') return 0
  const now = new Date()
  if (period === 'week') {
    // Start of the current week (Monday), matching Linear's week boundary.
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const day = (d.getDay() + 6) % 7 // 0 = Monday
    d.setDate(d.getDate() - day)
    return d.getTime()
  }
  // Start of the current month.
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
}

/** True when an ISO timestamp falls within the period (after its start). */
function inPeriod(iso: string | undefined, start: number): boolean {
  if (start === 0) return true
  if (!iso) return false
  return new Date(iso).getTime() >= start
}

// A segmented control matching Linear's compact header toggles.
function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg-tertiary p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={
            value === p.id
              ? 'rounded px-2 py-0.5 text-[12px] font-medium text-fg bg-bg-selected'
              : 'rounded px-2 py-0.5 text-[12px] text-muted hover:text-fg'
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

// ── Keyboard shortcuts reference ─────────────────────────────────────────────

/** A single keyboard-key chip (border + secondary surface), Linear-style. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-secondary px-1 font-mono text-[11px] font-medium leading-none text-muted">
      {children}
    </kbd>
  )
}

/** One shortcut row: its key chips on the left, a description on the right. */
interface Shortcut {
  /** Sequence of key chips (e.g. ['G', 'I'] for the G-then-I chord). */
  keys: string[]
  /** Joiner between chips: 'then' for chords, undefined for combos. */
  then?: boolean
  label: string
}

interface ShortcutGroup {
  title: string
  items: Shortcut[]
}

// Mirrors the real bindings registered in src/lib/useShortcuts.ts.
const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    items: [
      { keys: ['G', 'I'], then: true, label: 'Go to Inbox' },
      { keys: ['G', 'M'], then: true, label: 'Go to My Issues' },
      { keys: ['G', 'B'], then: true, label: 'Go to Board (active)' },
      { keys: ['G', 'C'], then: true, label: 'Go to Cycles' },
      { keys: ['G', 'P'], then: true, label: 'Go to Projects' },
      { keys: ['G', 'V'], then: true, label: 'Go to Views' },
      { keys: ['J'], label: 'Move focus down' },
      { keys: ['K'], label: 'Move focus up' },
      { keys: ['↵'], label: 'Open focused issue' },
      { keys: ['C'], label: 'Create new issue' },
      { keys: ['⌘', 'K'], label: 'Open command menu' },
      { keys: ['/'], label: 'Search issues' },
    ],
  },
  {
    title: 'Issues',
    items: [
      { keys: ['S'], label: 'Change status' },
      { keys: ['P'], label: 'Change priority' },
      { keys: ['A'], label: 'Change assignee' },
      { keys: ['L'], label: 'Change labels' },
      { keys: ['X'], label: 'Select / deselect issue' },
    ],
  },
  {
    title: 'Help',
    items: [{ keys: ['?'], label: 'Show all keyboard shortcuts' }],
  },
]

/**
 * Collapsible reference of the app's real keyboard shortcuts. Presentational
 * only — a local toggle expands a tidy grouped grid of key chips. Mirrors the
 * bindings in useShortcuts.ts so the Profile doubles as a cheat sheet.
 */
function ShortcutsReference() {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-xl border border-border bg-bg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-4 text-left"
      >
        <Keyboard size={15} className="text-faint" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold text-fg">Keyboard shortcuts</h2>
          <p className="mt-0.5 text-[12px] text-muted">A quick reference for getting around faster</p>
        </div>
        <ChevronRight
          size={16}
          className={`shrink-0 text-faint transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 border-t border-border px-5 py-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                {group.title}
              </div>
              <div className="space-y-1.5">
                {group.items.map((sc) => (
                  <div key={sc.label} className="flex items-center justify-between gap-3">
                    <span className="truncate text-[12px] text-muted">{sc.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {sc.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && sc.then && (
                            <span className="text-[10px] text-faint">then</span>
                          )}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Profile / "Your work" — a personal dashboard for the current user: their
 * profile header, a row of work stats, an open-issues-by-status breakdown, and
 * their most recent activity.
 */
export function ProfileView() {
  const data = useStore()
  const setPeek = useStore((s) => s.setPeek)
  const navigate = useNavigate()

  // Local-only header scope: bound the stats and activity feed by timestamp.
  const [period, setPeriod] = useState<Period>('all')
  const start = useMemo(() => periodStart(period), [period])
  // Lower-cased label for stat-card hints ("all time", "this week", …).
  const periodHint = (PERIODS.find((p) => p.id === period)?.label ?? 'All time').toLowerCase()

  const me = useMemo<User | undefined>(
    () => data.users.find((u) => u.isMe) ?? data.users.find((u) => u.id === data.currentUserId),
    [data.users, data.currentUserId],
  )

  const stateById = useMemo(() => {
    const m = new Map<string, WorkflowState>()
    data.states.forEach((s) => m.set(s.id, s))
    return m
  }, [data.states])

  // ── work stats (scoped to the selected period) ───────────────────────────────
  const stats = useMemo(() => {
    const meId = me?.id
    const assigned: Issue[] = data.issues.filter(
      (i) => !i.triage && !i.archivedAt && i.assigneeId === meId,
    )
    // "Created" / "Completed" are counted within the period by timestamp;
    // "Assigned" reflects current open work assigned to you.
    const created = data.issues.filter(
      (i) => i.creatorId === meId && !i.archivedAt && inPeriod(i.createdAt, start),
    ).length
    const completed = assigned.filter(
      (i) => stateById.get(i.stateId)?.type === 'completed' && inPeriod(i.completedAt, start),
    ).length
    // Completion rate is "% of your assigned work that's done" — period-agnostic,
    // so narrowing the period (which scopes the Completed card) doesn't collapse it.
    const completedAll = assigned.filter(
      (i) => stateById.get(i.stateId)?.type === 'completed',
    ).length
    const rate = assigned.length > 0 ? Math.round((completedAll / assigned.length) * 100) : 0
    return { assigned: assigned.length, created, completed, rate }
  }, [data.issues, me, stateById, start])

  // ── my open issues by status ─────────────────────────────────────────────────
  const byStatus = useMemo<Bar[]>(() => {
    const meId = me?.id
    const open = data.issues.filter(
      (i) =>
        !i.triage &&
        !i.archivedAt &&
        i.assigneeId === meId &&
        stateById.get(i.stateId)?.type !== 'completed',
    )
    const order = [...data.states].sort((a, b) => a.position - b.position)
    return order
      .map((s) => ({
        key: s.id,
        label: s.name,
        value: open.filter((i) => i.stateId === s.id).length,
        color: s.color,
      }))
      .filter((b) => b.value > 0)
  }, [data.issues, data.states, me, stateById])

  const maxStatus = byStatus.reduce((m, b) => Math.max(m, b.value), 0)

  // ── my open issues by priority ───────────────────────────────────────────────
  const byPriority = useMemo<PriorityBar[]>(() => {
    const meId = me?.id
    const open = data.issues.filter(
      (i) =>
        !i.triage &&
        !i.archivedAt &&
        i.assigneeId === meId &&
        stateById.get(i.stateId)?.type !== 'completed',
    )
    return PRIORITY_ORDER.map((p) => ({
      priority: p,
      value: open.filter((i) => i.priority === p).length,
    })).filter((b) => b.value > 0)
  }, [data.issues, me, stateById])

  const maxPriority = byPriority.reduce((m, b) => Math.max(m, b.value), 0)

  // ── my active issues (open work assigned to me, capped for a tidy list) ──────
  // Open == not completed and not canceled. Sorted urgent-first by priority,
  // then by workflow-state position so the list reads like My Issues. Capped at
  // 8 rows with a "View all" link when there's more.
  const activeIssues = useMemo(() => {
    const meId = me?.id
    const posById = new Map(data.states.map((s) => [s.id, s.position]))
    const open = data.issues.filter((i) => {
      if (i.triage || i.archivedAt || i.assigneeId !== meId) return false
      const type = stateById.get(i.stateId)?.type
      return type !== 'completed' && type !== 'canceled'
    })
    const sorted = [...open].sort((a, b) => {
      // Priority order: Urgent(1) → High(2) → Medium(3) → Low(4) → None(0) last.
      const pa = a.priority === 0 ? 99 : a.priority
      const pb = b.priority === 0 ? 99 : b.priority
      if (pa !== pb) return pa - pb
      return (posById.get(a.stateId) ?? 0) - (posById.get(b.stateId) ?? 0)
    })
    return { rows: sorted.slice(0, 8), total: sorted.length }
  }, [data.issues, data.states, me, stateById])

  // ── recent activity (my own actions, newest first) ───────────────────────────
  const recent = useMemo<RecentEvent[]>(() => {
    const meId = me?.id
    const acts: RecentEvent[] = data.activities
      .filter((a: Activity) => a.userId === meId && inPeriod(a.createdAt, start))
      .map((a) => ({ id: a.id, issueId: a.issueId, kind: a.kind, createdAt: a.createdAt }))
    const comments: RecentEvent[] = data.comments
      .filter((c) => c.userId === meId && inPeriod(c.createdAt, start))
      .map((c) => ({ id: c.id, issueId: c.issueId, kind: 'comment' as const, createdAt: c.createdAt }))
    return [...acts, ...comments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
  }, [data.activities, data.comments, me, start])

  // ── contribution heatmap (per-day activity over the last ~3 months) ──────────
  // Counts my activities + comments per local day, then lays them out into
  // Sunday-aligned week columns. Period-agnostic by design — the heatmap always
  // shows the trailing 3 months so the toggle above scopes only the stat cards.
  const heatmap = useMemo(() => {
    const meId = me?.id
    // Tally contributions by local day-key.
    const counts = new Map<string, number>()
    const bump = (iso: string | undefined) => {
      if (!iso) return
      const k = dayKey(new Date(iso))
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    data.activities.forEach((a) => a.userId === meId && bump(a.createdAt))
    data.comments.forEach((c) => c.userId === meId && bump(c.createdAt))

    // Window: today back ~13 weeks, padded forward to the end of this week and
    // back to the Sunday that starts the first week (so columns are clean).
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date(today)
    end.setDate(end.getDate() + (6 - end.getDay())) // forward to Saturday
    const startDay = new Date(end)
    startDay.setDate(startDay.getDate() - (13 * 7 - 1)) // 13 weeks back, inclusive

    const weeks: HeatDay[][] = []
    let total = 0
    const cursor = new Date(startDay)
    while (cursor <= end) {
      const week: HeatDay[] = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(cursor)
        const key = dayKey(date)
        // Future days within the trailing week render as empty (count 0).
        const count = date > today ? 0 : counts.get(key) ?? 0
        if (date <= today) total += count
        week.push({ key, date, count })
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(week)
    }
    return { weeks, total }
  }, [data.activities, data.comments, me])

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Profile">
        {/* Time-period scope — bounds the stats and activity feed below. */}
        <div className="ml-auto">
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>
      </ViewHeader>
      <div className="flex-1 overflow-y-auto bg-bg-secondary">
        <div className="mx-auto max-w-4xl px-8 py-8">
          {/* Header card */}
          <section className="flex items-center gap-5 rounded-xl border border-border bg-bg p-6">
            <Avatar user={me} size={64} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[20px] font-semibold tracking-tight text-fg">
                  {me?.name ?? 'You'}
                </h1>
                {me && (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[11px] capitalize text-muted">
                    {me.role}
                  </span>
                )}
              </div>
              {me?.email && <div className="mt-0.5 truncate text-[13px] text-muted">{me.email}</div>}
              <button
                type="button"
                onClick={() => navigate('/settings?page=profile')}
                className="mt-2 text-[12px] text-faint hover:text-muted hover:underline"
              >
                Edit profile in Settings → Profile
              </button>
            </div>
          </section>

          {/* Stat cards — Created/Completed scoped to the selected period. */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Assigned" value={stats.assigned} hint="open right now" />
            <Stat label="Created" value={stats.created} hint={periodHint} />
            <Stat label="Completed" value={stats.completed} hint={periodHint} />
            <Stat label="Completion rate" value={`${stats.rate}%`} hint="of your assigned work" />
          </div>

          {/* Contribution heatmap — trailing 3 months, GitHub-style. */}
          <div className="mt-6">
            <Card title="Contribution activity" subtitle="Your issue activity over the last 3 months">
              <ContributionHeatmap weeks={heatmap.weeks} total={heatmap.total} />
            </Card>
          </div>

          {/* Active issues — current open work assigned to you, urgent first. */}
          <div className="mt-6">
            <Card title="Active issues" subtitle="Open issues assigned to you">
              {activeIssues.rows.length === 0 ? (
                <div className="px-1 py-6 text-center text-[12px] text-faint">
                  Nothing open — you're all caught up.
                </div>
              ) : (
                <>
                  <div className="space-y-0.5">
                    {activeIssues.rows.map((issue) => {
                      const state = stateById.get(issue.stateId)
                      return (
                        <button
                          key={issue.id}
                          type="button"
                          onClick={() => setPeek(issue.id)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-bg-hover"
                        >
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                            <PriorityIcon priority={issue.priority} />
                          </span>
                          {state && (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                              <StatusIcon type={state.type} color={state.color} />
                            </span>
                          )}
                          <span className="w-14 shrink-0 font-mono text-[12px] text-faint">
                            {issue.identifier}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
                            {issue.title}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {activeIssues.total > activeIssues.rows.length && (
                    <button
                      type="button"
                      onClick={() => navigate('/my-issues/assigned')}
                      className="mt-2 px-2 text-[12px] text-accent hover:underline"
                    >
                      View all {activeIssues.total} in My Issues
                    </button>
                  )}
                </>
              )}
            </Card>
          </div>

          {/* Keyboard shortcuts — collapsible cheat sheet of the app's bindings. */}
          <div className="mt-6">
            <ShortcutsReference />
          </div>

          {/* Breakdowns + activity */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="My open issues by status" subtitle="Active work assigned to you">
              <BarChart bars={byStatus} max={maxStatus} />
            </Card>

            <Card title="My open issues by priority" subtitle="Where your urgent work sits">
              <PriorityBreakdown bars={byPriority} max={maxPriority} />
            </Card>

            <Card title="Recent activity" subtitle={`Your latest changes across issues (${periodHint})`}>
              {recent.length === 0 ? (
                <div className="px-1 py-6 text-center text-[12px] text-faint">No activity yet.</div>
              ) : (
                <div className="space-y-0.5">
                  {recent.map((e) => {
                    const issue = data.issues.find((i) => i.id === e.issueId)
                    if (!issue) return null
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setPeek(issue.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-bg-hover"
                      >
                        <KindIcon kind={e.kind} />
                        <span className="min-w-0 flex-1 truncate text-muted">
                          You {VERB[e.kind]}{' '}
                          <span className="font-mono text-[12px] text-fg">{issue.identifier}</span>
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-faint">
                          {timeAgo(e.createdAt)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
