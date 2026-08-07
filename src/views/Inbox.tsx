import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  Clock,
  X,
  AlarmClock,
  MoreHorizontal,
  ListFilter,
  SlidersHorizontal,
  CheckCheck,
  Trash2,
  Bell,
  BellOff,
  BellRing,
  UserPlus,
  Users,
  AtSign,
  MessageSquare,
  CircleCheck,
  Box,
  BarChart3,
  Circle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Inbox as InboxIcon,
  Maximize2,
  Minus,
  CalendarDays,
} from 'lucide-react'
import { EmptyState, InboxIllustration } from '@/components/EmptyState'
import { DatePicker } from '@/components/DatePicker'
import { InboxBulkActions } from '@/components/InboxBulkActions'
import { NotificationContextMenu } from '@/components/NotificationContextMenu'
import { useStore, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { IssueDetailBody } from '@/components/IssueDetailBody'
import { Avatar } from '@/components/Avatar'
import { Popover } from '@/components/ui/Popover'
import { PriorityIcon } from '@/components/PriorityIcon'
import { StatusIcon } from '@/components/StatusIcon'
import { PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/constants'
import { timeAgo, cn } from '@/lib/utils'
import { Toggle } from '@/components/ui/Toggle'
import type {
  NotificationType,
  Priority,
  StatusType,
  Notification,
} from '@/lib/types'

// Linear's own wording for the notification-type facet, in its order.
const TYPE_LABEL: Record<NotificationType, string> = {
  assigned: 'Assignments',
  comment: 'Comments and replies',
  mention: 'Mentions',
  status: 'Status changes',
  subscribed: 'Subscriptions',
}
const TYPE_ORDER: NotificationType[] = [
  'assigned',
  'comment',
  'mention',
  'status',
  'subscribed',
]

// ── reason glyph ─────────────────────────────────────────────────────────────
// Linear does not print a reason *pill*; it stamps a small glyph on the corner
// of the actor's avatar (✓ completed, ✎ edited, + added, @ mentioned, 💬
// commented) and lets the subtitle carry the sentence. Derived purely from the
// notification's type — no store state.
const REASON_GLYPH: Record<NotificationType, typeof Bell> = {
  assigned: UserPlus,
  mention: AtSign,
  comment: MessageSquare,
  status: CircleCheck,
  subscribed: Bell,
}

const STATUS_TYPE_LABEL: Record<StatusType, string> = {
  backlog: 'Backlog',
  unstarted: 'Todo',
  started: 'In Progress',
  completed: 'Done',
  canceled: 'Canceled',
}
const STATUS_TYPE_COLOR: Record<StatusType, string> = {
  backlog: 'var(--text-faint)',
  unstarted: 'var(--text-muted)',
  started: 'var(--priority-medium, #f2c94c)',
  completed: 'var(--accent)',
  canceled: 'var(--text-faint)',
}
const STATUS_TYPES: StatusType[] = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
]

function isSnoozed(until: string | undefined, now: number) {
  return !!until && new Date(until).getTime() > now
}

// ── snooze menu body ─────────────────────────────────────────────────────────
// Shared across every snooze popover in the inbox (reading pane, bulk action
// bar, notification row). The fixed presets snooze relative to `now`; the
// trailing "Custom…" row reveals a DatePicker (reusing the same calendar as the
// issue due-date picker) and snoozes to the picked date's ISO. Picking from the
// calendar closes both popovers via the parent's `close`.
const SNOOZE_PRESETS = [
  { label: 'In 1 hour', ms: 3_600_000 },
  { label: 'Tomorrow', ms: 86_400_000 },
  { label: 'Next week', ms: 7 * 86_400_000 },
]
function SnoozeMenu({
  onSnoozeMs,
  onSnoozeAt,
  close,
}: {
  onSnoozeMs: (ms: number) => void
  onSnoozeAt: (iso: string) => void
  close: () => void
}) {
  return (
    <div>
      {SNOOZE_PRESETS.map((o) => (
        <button
          key={o.label}
          onClick={() => {
            onSnoozeMs(o.ms)
            close()
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
        >
          <Clock size={13} className="text-faint" /> {o.label}
        </button>
      ))}
      <DatePicker
        align="start"
        onChange={(iso) => {
          if (iso) {
            onSnoozeAt(iso)
            close()
          }
        }}
        trigger={
          <span
            onClick={(e) => e.stopPropagation()}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
          >
            <CalendarDays size={13} className="text-faint" /> Custom…
          </span>
        }
      />
    </div>
  )
}

// ── date-group buckets (Linear groups the inbox list into Today / Yesterday /
// This week / Older sticky sections) ─────────────────────────────────────────
function dateGroup(iso: string, now: number): string {
  const startOfDay = (t: number) => {
    const d = new Date(t)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const today = startOfDay(now)
  const created = startOfDay(new Date(iso).getTime())
  const dayMs = 86_400_000
  if (created >= today) return 'Today'
  if (created >= today - dayMs) return 'Yesterday'
  if (created >= today - 7 * dayMs) return 'This week'
  if (created >= today - 30 * dayMs) return 'This month'
  return 'Older'
}

// ── view + filter state (local, like the Issues view's display options) ──────
type Ordering = 'newest' | 'oldest'
interface InboxDisplay {
  ordering: Ordering
  showSnoozed: boolean
  showRead: boolean
  showUnreadFirst: boolean
}
const DEFAULT_DISPLAY: InboxDisplay = {
  ordering: 'newest',
  showSnoozed: false,
  showRead: true,
  showUnreadFirst: false,
}
interface InboxFilters {
  types: NotificationType[]
  /** Project ids the current user subscribes to (Linear's "Subscription"). */
  subscriptions: string[]
  from: string[]
  teams: string[]
  projects: string[]
  priorities: Priority[]
  statusTypes: StatusType[]
}
const EMPTY_FILTERS: InboxFilters = {
  types: [],
  subscriptions: [],
  from: [],
  teams: [],
  projects: [],
  priorities: [],
  statusTypes: [],
}
function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}
function anyFilter(f: InboxFilters) {
  // Persisted filter state predates the newer dimensions, so every list is read
  // through `?? []` rather than indexed directly.
  return (
    (f.types?.length ?? 0) > 0 ||
    (f.subscriptions?.length ?? 0) > 0 ||
    (f.from?.length ?? 0) > 0 ||
    (f.teams?.length ?? 0) > 0 ||
    (f.projects?.length ?? 0) > 0 ||
    (f.priorities?.length ?? 0) > 0 ||
    (f.statusTypes?.length ?? 0) > 0
  )
}

// ── Inbox / Read segmented tabs ──────────────────────────────────────────────
// Linear splits the inbox into an active queue and a "Read" archive. The Inbox
// tab shows the live queue; the Read tab shows notifications you've already read
// (and/or snoozed away) with a "mark unread" affordance to pull them back.
type Tab = 'inbox' | 'read'

// ── issue threads ────────────────────────────────────────────────────────────
// Notifications that target the same issue collapse into one thread row: the
// latest event is the representative, older events hide behind a "+N more"
// count until the thread is expanded. Group actions iterate every member id
// through the existing single-notification store actions.
interface Thread {
  key: string // issueId, or the lone notification id when there's no issue
  rep: Notification // representative (first in the sorted member list)
  members: Notification[] // newest-first, includes rep
}
function buildThreads(list: Notification[]): Thread[] {
  const order: string[] = []
  const byKey = new Map<string, Notification[]>()
  for (const n of list) {
    // Only fold rows that share a real issue; orphan notifications stay solo.
    const key = n.issueId ? `issue:${n.issueId}` : `n:${n.id}`
    if (!byKey.has(key)) {
      byKey.set(key, [])
      order.push(key)
    }
    byKey.get(key)!.push(n)
  }
  // `list` is already sorted, so members preserve that order and members[0] is
  // the representative for the current ordering.
  return order.map((key) => {
    const members = byKey.get(key)!
    return { key, rep: members[0], members }
  })
}

// ── ⋯ options menu ───────────────────────────────────────────────────────────
// Linear's four rows, in order and with its shortcut hints: Mark all as read
// (⌥U) / Delete all · Delete all read (⇧⌫) · Delete all read for completed
// issues.
function OptionRow({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
    >
      <span className="flex h-4 w-4 items-center justify-center text-faint">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {hint && (
        <span className="pl-3 text-[12px] tracking-wide text-faint">{hint}</span>
      )}
    </button>
  )
}

function InboxOptionsMenu({
  onDeleteAll,
  onDeleteAllRead,
  onDeleteAllReadCompleted,
}: {
  onDeleteAll: () => void
  onDeleteAllRead: () => void
  onDeleteAllReadCompleted: () => void
}) {
  const markAll = useStore((s) => s.markAllNotificationsRead)
  return (
    <Popover
      align="start"
      width={264}
      trigger={
        <span className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg">
          <MoreHorizontal size={15} />
        </span>
      }
    >
      {(close) => (
        <div>
          <OptionRow
            icon={<CheckCheck size={14} />}
            label="Mark all as read"
            hint="⌥U"
            onClick={() => {
              markAll()
              close()
            }}
          />
          <div className="my-1 border-t border-border" />
          <OptionRow
            icon={<Trash2 size={14} />}
            label="Delete all"
            onClick={() => {
              close()
              onDeleteAll()
            }}
          />
          <OptionRow
            icon={<Trash2 size={14} />}
            label="Delete all read"
            hint="⇧⌫"
            onClick={() => {
              close()
              onDeleteAllRead()
            }}
          />
          <OptionRow
            icon={<Trash2 size={14} />}
            label="Delete all read for completed issues"
            onClick={() => {
              close()
              onDeleteAllReadCompleted()
            }}
          />
        </div>
      )}
    </Popover>
  )
}

// ── filter popover (dimension → values) ──────────────────────────────────────
// Linear's dimension list, in Linear's order. Its "Document" row is not built
// here: a Notification carries no documentId in this model, so the facet could
// never match anything (logged in BACKLOG.md rather than shipped empty).
type Dim =
  | 'types'
  | 'subscriptions'
  | 'from'
  | 'teams'
  | 'projects'
  | 'priorities'
  | 'statusTypes'
const DIMS: { id: Dim; label: string; icon: typeof Bell }[] = [
  { id: 'types', label: 'Notification type', icon: Bell },
  { id: 'subscriptions', label: 'Subscription', icon: BellRing },
  { id: 'from', label: 'From', icon: UserPlus },
  { id: 'teams', label: 'Team', icon: Users },
  { id: 'projects', label: 'Project', icon: Box },
  { id: 'priorities', label: 'Issue priority', icon: BarChart3 },
  { id: 'statusTypes', label: 'Issue status type', icon: Circle },
]

function ValueRow({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean
  /** Faceted count — Linear prints "N notifications" on the right of each row. */
  count?: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
    >
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {active && <Check size={13} className="text-accent" />}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
        {children}
      </span>
      {count !== undefined && (
        <span className="shrink-0 pl-3 text-[12px] text-faint">
          {count} notification{count === 1 ? '' : 's'}
        </span>
      )}
    </button>
  )
}

/**
 * One dimension's value list. Linear prints a faceted count on every row and
 * folds the zero-count options behind a "N options not matching any
 * notifications" footer, so a long facet stays short until you ask for it.
 */
function ValueList({
  options,
}: {
  options: {
    key: string
    count: number
    active: boolean
    onClick: () => void
    node: React.ReactNode
  }[]
}) {
  const [showEmpty, setShowEmpty] = useState(false)
  const matching = options.filter((o) => o.count > 0 || o.active)
  const empty = options.filter((o) => o.count === 0 && !o.active)
  return (
    <>
      {matching.map((o) => (
        <ValueRow
          key={o.key}
          active={o.active}
          count={o.count}
          onClick={o.onClick}
        >
          {o.node}
        </ValueRow>
      ))}
      {showEmpty &&
        empty.map((o) => (
          <ValueRow
            key={o.key}
            active={o.active}
            count={o.count}
            onClick={o.onClick}
          >
            {o.node}
          </ValueRow>
        ))}
      {!showEmpty && empty.length > 0 && (
        <button
          onClick={() => setShowEmpty(true)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-muted hover:bg-bg-hover"
        >
          <ListFilter size={13} className="shrink-0 text-faint" />
          {empty.length} option{empty.length === 1 ? '' : 's'} not matching any
          notifications
        </button>
      )}
    </>
  )
}

function InboxFilterMenu({
  filters,
  setFilters,
  base,
}: {
  filters: InboxFilters
  setFilters: (f: InboxFilters) => void
  /** Rows the tab/display pass already accepted — the facet counts run on it. */
  base: Notification[]
}) {
  const { users, projects, teams, issues, states, currentUserId } = useStore()
  const fmt = useDisplayName()
  const [dim, setDim] = useState<Dim | null>(null)
  const issueOf = (n: Notification) => issues.find((i) => i.id === n.issueId)
  const stateTypeOf = (stateId: string) =>
    states.find((s) => s.id === stateId)?.type
  const countOf = (pred: (n: Notification) => boolean) =>
    base.filter(pred).length

  return (
    <Popover
      align="end"
      width={232}
      trigger={
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg',
            anyFilter(filters) && 'text-fg',
          )}
        >
          <ListFilter size={15} />
        </span>
      }
    >
      {() => {
        if (!dim) {
          return (
            <div>
              <input
                autoFocus
                readOnly
                placeholder="Add Filter..."
                className="mb-1 w-full bg-transparent px-2 py-1 text-[13px] text-fg outline-none placeholder:text-faint"
              />
              {DIMS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDim(d.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
                >
                  <d.icon size={14} className="text-faint" /> {d.label}
                </button>
              ))}
            </div>
          )
        }
        return (
          <div>
            <button
              onClick={() => setDim(null)}
              className="mb-1 flex items-center gap-1 px-2 py-1 text-[11px] text-faint hover:text-fg"
            >
              <ChevronLeft size={12} /> {DIMS.find((d) => d.id === dim)!.label}
            </button>
            {dim === 'types' && (
              <ValueList
                options={TYPE_ORDER.map((t) => ({
                  key: t,
                  count: countOf((n) => n.type === t),
                  active: (filters.types ?? []).includes(t),
                  onClick: () =>
                    setFilters({
                      ...filters,
                      types: toggle(filters.types ?? [], t),
                    }),
                  node: TYPE_LABEL[t],
                }))}
              />
            )}
            {dim === 'subscriptions' && (
              <ValueList
                options={projects
                  .filter((p) => (p.subscriberIds ?? []).includes(currentUserId))
                  .map((p) => ({
                    key: p.id,
                    count: countOf((n) => issueOf(n)?.projectId === p.id),
                    active: (filters.subscriptions ?? []).includes(p.id),
                    onClick: () =>
                      setFilters({
                        ...filters,
                        subscriptions: toggle(filters.subscriptions ?? [], p.id),
                      }),
                    node: (
                      <>
                        <span>{p.icon}</span>
                        <span className="truncate">{p.name}</span>
                        <span className="shrink-0 text-faint">Project</span>
                      </>
                    ),
                  }))}
              />
            )}
            {dim === 'from' && (
              <ValueList
                options={users.map((u) => ({
                  key: u.id,
                  count: countOf((n) => n.actorId === u.id),
                  active: (filters.from ?? []).includes(u.id),
                  onClick: () =>
                    setFilters({
                      ...filters,
                      from: toggle(filters.from ?? [], u.id),
                    }),
                  node: (
                    <>
                      <Avatar user={u} size={16} />
                      <span className="truncate">{fmt(u.name)}</span>
                    </>
                  ),
                }))}
              />
            )}
            {dim === 'teams' && (
              <ValueList
                options={teams.map((t) => ({
                  key: t.id,
                  count: countOf((n) => issueOf(n)?.teamId === t.id),
                  active: (filters.teams ?? []).includes(t.id),
                  onClick: () =>
                    setFilters({
                      ...filters,
                      teams: toggle(filters.teams ?? [], t.id),
                    }),
                  node: (
                    <>
                      <span>{t.icon}</span>
                      <span className="truncate">{t.name}</span>
                    </>
                  ),
                }))}
              />
            )}
            {dim === 'projects' && (
              <ValueList
                options={projects.map((p) => ({
                  key: p.id,
                  count: countOf((n) => issueOf(n)?.projectId === p.id),
                  active: (filters.projects ?? []).includes(p.id),
                  onClick: () =>
                    setFilters({
                      ...filters,
                      projects: toggle(filters.projects ?? [], p.id),
                    }),
                  node: (
                    <>
                      <span>{p.icon}</span>
                      <span className="truncate">{p.name}</span>
                    </>
                  ),
                }))}
              />
            )}
            {dim === 'priorities' && (
              <ValueList
                options={PRIORITY_ORDER.map((p) => ({
                  key: String(p),
                  count: countOf((n) => issueOf(n)?.priority === p),
                  active: (filters.priorities ?? []).includes(p),
                  onClick: () =>
                    setFilters({
                      ...filters,
                      priorities: toggle(filters.priorities ?? [], p),
                    }),
                  node: (
                    <>
                      <PriorityIcon priority={p} />
                      <span className="truncate">{PRIORITY_LABELS[p]}</span>
                    </>
                  ),
                }))}
              />
            )}
            {dim === 'statusTypes' && (
              <ValueList
                options={STATUS_TYPES.map((t) => ({
                  key: t,
                  count: countOf((n) => {
                    const iss = issueOf(n)
                    return !!iss && stateTypeOf(iss.stateId) === t
                  }),
                  active: (filters.statusTypes ?? []).includes(t),
                  onClick: () =>
                    setFilters({
                      ...filters,
                      statusTypes: toggle(filters.statusTypes ?? [], t),
                    }),
                  node: (
                    <>
                      <StatusIcon type={t} color={STATUS_TYPE_COLOR[t]} />
                      <span className="truncate">{STATUS_TYPE_LABEL[t]}</span>
                    </>
                  ),
                }))}
              />
            )}
          </div>
        )
      }}
    </Popover>
  )
}

// ── display options popover ──────────────────────────────────────────────────
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <span className="text-[13px] text-fg">{label}</span>
      <Toggle
        checked={checked}
        onChange={() => onChange(!checked)}
        size="sm"
      />
    </div>
  )
}

function InboxDisplayMenu({
  display,
  setDisplay,
}: {
  display: InboxDisplay
  setDisplay: (d: InboxDisplay) => void
}) {
  return (
    <Popover
      align="end"
      width={252}
      trigger={
        <span className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg">
          <SlidersHorizontal size={15} />
        </span>
      }
    >
      {() => (
        <div>
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[13px] text-fg">Ordering</span>
            <select
              value={display.ordering}
              onChange={(e) =>
                setDisplay({ ...display, ordering: e.target.value as Ordering })
              }
              className="rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-fg outline-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
          <div className="my-1 border-t border-border" />
          <ToggleRow
            label="Show snoozed"
            checked={display.showSnoozed}
            onChange={(v) => setDisplay({ ...display, showSnoozed: v })}
          />
          <ToggleRow
            label="Show read"
            checked={display.showRead}
            onChange={(v) => setDisplay({ ...display, showRead: v })}
          />
          <ToggleRow
            label="Show unread first"
            checked={display.showUnreadFirst}
            onChange={(v) => setDisplay({ ...display, showUnreadFirst: v })}
          />
        </div>
      )}
    </Popover>
  )
}

// ── active-filter chips ──────────────────────────────────────────────────────
function FilterChips({
  filters,
  setFilters,
}: {
  filters: InboxFilters
  setFilters: (f: InboxFilters) => void
}) {
  const { users, projects, teams } = useStore()
  const fmt = useDisplayName()
  const chips: { key: Dim; label: string; clear: () => void }[] = []
  if (filters.types?.length)
    chips.push({
      key: 'types',
      label: `Type · ${filters.types.map((t) => TYPE_LABEL[t]).join(', ')}`,
      clear: () => setFilters({ ...filters, types: [] }),
    })
  if (filters.subscriptions?.length)
    chips.push({
      key: 'subscriptions',
      label: `Subscription · ${filters.subscriptions
        .map((id) => projects.find((p) => p.id === id)?.name ?? '?')
        .join(', ')}`,
      clear: () => setFilters({ ...filters, subscriptions: [] }),
    })
  if (filters.from?.length)
    chips.push({
      key: 'from',
      label: `From · ${filters.from
        .map((id) => fmt(users.find((u) => u.id === id)?.name) || '?')
        .join(', ')}`,
      clear: () => setFilters({ ...filters, from: [] }),
    })
  if (filters.teams?.length)
    chips.push({
      key: 'teams',
      label: `Team · ${filters.teams
        .map((id) => teams.find((t) => t.id === id)?.name ?? '?')
        .join(', ')}`,
      clear: () => setFilters({ ...filters, teams: [] }),
    })
  if (filters.projects?.length)
    chips.push({
      key: 'projects',
      label: `Project · ${filters.projects
        .map((id) => projects.find((p) => p.id === id)?.name ?? '?')
        .join(', ')}`,
      clear: () => setFilters({ ...filters, projects: [] }),
    })
  if (filters.priorities?.length)
    chips.push({
      key: 'priorities',
      label: `Priority · ${filters.priorities
        .map((p) => PRIORITY_LABELS[p])
        .join(', ')}`,
      clear: () => setFilters({ ...filters, priorities: [] }),
    })
  if (filters.statusTypes?.length)
    chips.push({
      key: 'statusTypes',
      label: `Status · ${filters.statusTypes
        .map((t) => STATUS_TYPE_LABEL[t])
        .join(', ')}`,
      clear: () => setFilters({ ...filters, statusTypes: [] }),
    })
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
      {chips.map((c) => (
        <span
          key={c.key}
          className="flex items-center overflow-hidden rounded-md border border-border text-[12px]"
        >
          <span className="px-2 py-1 text-fg">{c.label}</span>
          <button
            onClick={c.clear}
            className="border-l border-border px-1.5 py-1 text-faint hover:bg-bg-hover hover:text-fg"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <button
        onClick={() => setFilters(EMPTY_FILTERS)}
        className="px-1.5 py-1 text-[12px] text-muted hover:text-fg"
      >
        Clear
      </button>
    </div>
  )
}

// ── delete-all confirm dialog ────────────────────────────────────────────────
function ConfirmDeleteAll({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onMouseDown={onCancel}
    >
      <div
        data-overlay
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[380px] rounded-xl border border-border bg-bg-elevated p-5 shadow-xl"
      >
        <div className="text-[15px] font-medium text-fg">
          Delete all notifications?
        </div>
        <div className="mt-1.5 text-[13px] text-muted">
          You cannot undo this action.
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-[13px] text-fg hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-[var(--priority-urgent)] px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
          >
            Delete all
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function Inbox() {
  const navigate = useNavigate()
  const store = useStore()
  const [tab, setTab] = useState<Tab>('inbox')
  const [display, setDisplay] = useState<InboxDisplay>(DEFAULT_DISPLAY)
  const [filters, setFilters] = useState<InboxFilters>(EMPTY_FILTERS)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Bulk-select set (the checkboxes), independent from the reading-pane focus.
  const [checked, setChecked] = useState<Set<string>>(() => new Set())
  // Threads collapsed by default; expanded keys reveal their member rows.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  // Right-click menu. `act` runs a store action over the row the menu was
  // opened on — the whole thread for a head row, the single row for a member.
  const [ctxMenu, setCtxMenu] = useState<{
    n: Notification
    x: number
    y: number
    act: (fn: (id: string) => void) => void
  } | null>(null)
  const now = Date.now()

  const statusTypeOf = (issueId: string): StatusType | undefined => {
    const issue = store.issues.find((i) => i.id === issueId)
    if (!issue) return undefined
    return store.states.find((st) => st.id === issue.stateId)?.type
  }

  // Rows the tab + display pass accepts, before any dimension filter. This is
  // what the filter menu counts its facets against, so a count reads as "how
  // many would this option leave me with".
  const base = store.notifications.filter((n) => {
    const snoozed = isSnoozed(n.snoozedUntil, now)
    if (tab === 'read') {
      // Read tab is the archive: only already-read or snoozed-away rows.
      if (!n.read && !snoozed) return false
    } else {
      // Inbox tab honours the display toggles for read/snoozed visibility.
      if (snoozed && !display.showSnoozed) return false
      if (!display.showRead && n.read) return false
    }
    // Muted issues never surface in the inbox (Linear's mute).
    if (n.issueId && store.mutedIssueIds.includes(n.issueId)) return false
    return true
  })

  const list = base
    .filter((n) => {
      // Persisted filter state predates the newer dimensions — read every list
      // through `?? []` rather than indexing it.
      const issue = store.issues.find((i) => i.id === n.issueId)
      const f = filters
      if (f.types?.length && !f.types.includes(n.type)) return false
      if (
        f.subscriptions?.length &&
        !(issue?.projectId && f.subscriptions.includes(issue.projectId))
      )
        return false
      if (f.from?.length && !f.from.includes(n.actorId)) return false
      if (f.teams?.length && !(issue && f.teams.includes(issue.teamId)))
        return false
      if (
        f.projects?.length &&
        !(issue?.projectId && f.projects.includes(issue.projectId))
      )
        return false
      if (
        f.priorities?.length &&
        !(issue && f.priorities.includes(issue.priority))
      )
        return false
      if (f.statusTypes?.length) {
        const t = statusTypeOf(n.issueId)
        if (!t || !f.statusTypes.includes(t)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (display.showUnreadFirst && a.read !== b.read) return a.read ? 1 : -1
      return display.ordering === 'newest'
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt)
    })

  const snooze = (id: string, ms: number) =>
    store.snoozeNotification(id, new Date(now + ms).toISOString())

  // ── threads ──────────────────────────────────────────────────────────────
  // Fold same-issue notifications into collapsible threads, then flatten back to
  // the sequence of *visible* rows (a collapsed thread contributes only its
  // representative; an expanded thread contributes rep + members) so keyboard
  // nav, selection and date-group headers all run over one flat list.
  const threads = buildThreads(list)
  const navList: Notification[] = []
  for (const th of threads) {
    navList.push(th.rep)
    if (th.members.length > 1 && expanded.has(th.key)) {
      for (const m of th.members.slice(1)) navList.push(m)
    }
  }

  // ── selection ────────────────────────────────────────────────────────────
  const selected = navList.find((n) => n.id === selectedId) ?? null
  const select = (id: string) => {
    store.markNotificationRead(id)
    setSelectedId(id)
  }
  // Mark-done / snooze removes the row from the inbox — keep a notification
  // selected by jumping to its neighbour, exactly like Linear's reading pane.
  const actThenAdvance = (id: string, act: (id: string) => void) => {
    const idx = navList.findIndex((n) => n.id === id)
    const next = navList[idx + 1] ?? navList[idx - 1] ?? null
    act(id)
    setSelectedId(next ? next.id : null)
  }
  // Run a store action across every notification in a thread (rep + members).
  const threadAct = (th: Thread, act: (id: string) => void) => {
    const ids = th.members.map((m) => m.id)
    const idx = navList.findIndex((n) => n.id === th.rep.id)
    // Pick the first neighbour that isn't part of this thread (skips members
    // whether the thread is collapsed — only the rep is in navList — or expanded).
    const next =
      navList.slice(idx + 1).find((n) => !ids.includes(n.id)) ??
      navList.slice(0, idx).reverse().find((n) => !ids.includes(n.id)) ??
      null
    ids.forEach((id) => act(id))
    if (selectedId && ids.includes(selectedId))
      setSelectedId(next ? next.id : null)
  }

  // ── bulk selection (checkboxes) ──────────────────────────────────────────
  // Keep the checked set pruned to the currently-visible rows so toggle-all and
  // the action-bar count never reference notifications hidden by the filters.
  // Select-all spans every notification in the filtered list (including the
  // collapsed members of threads), not just the rows currently rendered.
  const visibleIds = list.map((n) => n.id)
  const checkedVisible = visibleIds.filter((id) => checked.has(id))
  const allChecked = list.length > 0 && checkedVisible.length === list.length
  const someChecked = checkedVisible.length > 0
  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const toggleAll = () =>
    setChecked(allChecked ? new Set() : new Set(visibleIds))
  const clearChecked = () => setChecked(new Set())
  // Run a store action over every checked notification, then drop the selection.
  const bulkAct = (act: (id: string) => void) => {
    checkedVisible.forEach((id) => act(id))
    if (selectedId && checkedVisible.includes(selectedId)) setSelectedId(null)
    clearChecked()
  }
  // Bulk-assign: map each checked notification to its underlying issue and set
  // the assignee on the issue (de-duped — a thread of events shares one issue).
  // Notifications without a linked issue are skipped. Keeps the rows selected so
  // a different assignee can be picked again, matching Linear's bulk reassign.
  const bulkAssign = (assigneeId?: string) => {
    const issueIds = new Set<string>()
    for (const id of checkedVisible) {
      const n = store.notifications.find((x) => x.id === id)
      if (n?.issueId) issueIds.add(n.issueId)
    }
    issueIds.forEach((iid) => store.setIssueAssignee(iid, assigneeId))
  }

  // Inbox keyboard shortcuts (soi'd Linear's shortcut reference, workspace
  // "Claude Test App"): ↑/↓ + j/k move the selection · Esc clears it ·
  // ⌫ mark as done · ⇧⌫ delete all read · U mark read/unread · ⌥U mark all
  // read · H snooze. The handler reads fresh closures via a ref so it always
  // sees the current list / selection without re-binding the listener.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onKeyRef.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      return
    if (document.querySelector('[data-overlay]')) return
    const items = navList
    const idx = items.findIndex((n) => n.id === selectedId)
    const cur = items[idx]
    // Inbox owns this key — stop the global shortcut handler (which also binds
    // j/k/arrows) from double-firing.
    const own = () => {
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    // ── navigation ──
    if (e.key === 'ArrowDown' || e.key === 'j') {
      if (!items.length) return
      own()
      // Move the cursor only (don't mark read) — marking read here would drop the
      // row from the list when "show read" is off, desyncing the next move.
      setSelectedId((items[Math.min(idx + 1, items.length - 1)] ?? items[0]).id)
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'k') {
      if (!items.length) return
      own()
      setSelectedId((idx <= 0 ? items[0] : items[idx - 1]).id)
      return
    }
    if (e.key === 'Escape' && (selectedId || someChecked)) {
      own()
      setSelectedId(null)
      clearChecked()
      return
    }

    // ── mark all as read (⌥U) — checked before plain U ──
    if (e.code === 'KeyU' && e.altKey && !e.metaKey && !e.ctrlKey) {
      own()
      store.markAllNotificationsRead()
      return
    }
    // ── mark as read/unread (U) ──
    if (e.code === 'KeyU' && !e.altKey && !e.metaKey && !e.ctrlKey) {
      if (!cur) return
      own()
      store.setNotificationRead(cur.id, !cur.read)
      return
    }
    // ── delete all read (⇧⌫) ──
    if ((e.key === 'Backspace' || e.key === 'Delete') && e.shiftKey) {
      own()
      store.deleteAllReadNotifications()
      if (cur?.read) setSelectedId(null)
      return
    }
    // ── mark as done / delete (⌫) ──
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (!cur) return
      own()
      actThenAdvance(cur.id, store.deleteNotification)
      return
    }
    // ── snooze (H) — default to tomorrow; the picker stays on the button ──
    if (e.code === 'KeyH' && !e.altKey && !e.metaKey && !e.ctrlKey) {
      if (!cur || isSnoozed(cur.snoozedUntil, Date.now())) return
      own()
      actThenAdvance(cur.id, (x) => snooze(x, 86_400_000))
      return
    }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyRef.current(e)
    // Capture phase so we run before — and can pre-empt — the global handler.
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  const unreadCount = store.notifications.filter(
    (n) =>
      !n.read &&
      !isSnoozed(n.snoozedUntil, now) &&
      !(n.issueId && store.mutedIssueIds.includes(n.issueId)),
  ).length

  return (
    <div className="flex h-full">
      {/* ── list pane ─────────────────────────────────────────────────────── */}
      <div className="flex h-full w-[340px] shrink-0 flex-col border-r border-border">
        <ViewHeader
          title="Inbox"
          right={
            <div className="flex items-center gap-1">
              <InboxFilterMenu
                filters={filters}
                setFilters={setFilters}
                base={base}
              />
              <InboxDisplayMenu display={display} setDisplay={setDisplay} />
            </div>
          }
        >
          <InboxOptionsMenu
            onDeleteAll={() => setConfirmDelete(true)}
            onDeleteAllRead={() => {
              store.deleteAllReadNotifications()
              setSelectedId(null)
            }}
            onDeleteAllReadCompleted={() => {
              // Linear's narrower sweep: only read rows whose issue is done.
              store.notifications
                .filter(
                  (n) => n.read && statusTypeOf(n.issueId) === 'completed',
                )
                .forEach((n) => store.deleteNotification(n.id))
              setSelectedId(null)
            }}
          />
        </ViewHeader>

        {/* ── Inbox / Read segmented tabs ── */}
        <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 py-1.5">
          {(['inbox', 'read'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                if (t === tab) return
                setTab(t)
                // Selection/checkboxes reference rows that may not exist in the
                // other tab — reset them on switch.
                setSelectedId(null)
                clearChecked()
              }}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] font-medium capitalize transition-colors',
                tab === t
                  ? 'bg-bg-tertiary text-fg'
                  : 'text-faint hover:bg-bg-hover hover:text-fg',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <FilterChips filters={filters} setFilters={setFilters} />

        {/* select-all bar — Linear reveals a master checkbox above the list */}
        {list.length > 0 && (
          <div className="flex h-8 shrink-0 items-center gap-2.5 border-b border-border px-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={allChecked ? true : someChecked ? 'mixed' : false}
              onClick={toggleAll}
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors',
                allChecked || someChecked
                  ? 'border-accent bg-accent text-white'
                  : 'border-border text-transparent hover:border-faint',
              )}
            >
              {allChecked ? (
                <Check size={11} strokeWidth={3} />
              ) : someChecked ? (
                <Minus size={11} strokeWidth={3} />
              ) : null}
            </button>
            <span className="text-[12px] text-faint">
              {someChecked
                ? `${checkedVisible.length} selected`
                : 'Select all'}
            </span>
          </div>
        )}

        <div className="relative flex-1 overflow-y-auto">
          {list.length === 0 && (
            <div className="px-4 py-10 text-center text-[13px] text-faint">
              {anyFilter(filters)
                ? 'No notifications match your filters.'
                : tab === 'read'
                  ? 'Nothing read yet.'
                  : "You're all caught up."}
            </div>
          )}
          {threads.map((th, i) => {
            const n = th.rep
            // Sticky date-section header keyed off the thread representative.
            // Group order matches `navList`, so j/k nav stays in sync with the
            // rendered sequence even with threads collapsed/expanded.
            const group = dateGroup(n.createdAt, now)
            // With "Show unread first" on, the list is partitioned [unread…]
            // [read…]; force a fresh header at that boundary and compare dates
            // only within a block so a label can't repeat across the partition.
            const prev = threads[i - 1]?.rep
            const showHeader =
              i === 0 ||
              (display.showUnreadFirst && prev!.read !== n.read) ||
              dateGroup(prev!.createdAt, now) !== group
            const isThread = th.members.length > 1
            const isExpanded = isThread && expanded.has(th.key)
            // A thread counts as checked only when every member is checked.
            const threadChecked = th.members.every((m) => checked.has(m.id))
            return (
              <div key={th.key}>
                {showHeader && (
                  <div className="sticky top-0 z-10 bg-bg/90 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-faint backdrop-blur-sm">
                    {group}
                  </div>
                )}
                <NotificationRow
                  n={n}
                  now={now}
                  selected={n.id === selectedId}
                  checked={threadChecked}
                  anyChecked={someChecked}
                  threadCount={isThread ? th.members.length : 0}
                  expanded={isExpanded}
                  onToggleExpand={
                    isThread
                      ? () =>
                          setExpanded((cur) => {
                            const next = new Set(cur)
                            next.has(th.key)
                              ? next.delete(th.key)
                              : next.add(th.key)
                            return next
                          })
                      : undefined
                  }
                  onToggleCheck={() =>
                    // Toggle the whole thread together.
                    setChecked((cur) => {
                      const next = new Set(cur)
                      const turnOff = th.members.every((m) => next.has(m.id))
                      th.members.forEach((m) =>
                        turnOff ? next.delete(m.id) : next.add(m.id),
                      )
                      return next
                    })
                  }
                  onOpen={() => select(n.id)}
                  // A thread's context menu acts on every member at once.
                  onContextMenu={(x, y) =>
                    setCtxMenu({
                      n,
                      x,
                      y,
                      act: (fn) => threadAct(th, fn),
                    })
                  }
                />
                {/* expanded thread members (rep already shown above) */}
                {isExpanded &&
                  th.members.slice(1).map((m) => (
                    <NotificationRow
                      key={m.id}
                      n={m}
                      now={now}
                      member
                      selected={m.id === selectedId}
                      checked={checked.has(m.id)}
                      anyChecked={someChecked}
                      threadCount={0}
                      expanded={false}
                      onToggleCheck={() => toggleChecked(m.id)}
                      onOpen={() => select(m.id)}
                      onContextMenu={(x, y) =>
                        setCtxMenu({
                          n: m,
                          x,
                          y,
                          act: (fn) => actThenAdvance(m.id, fn),
                        })
                      }
                    />
                  ))}
              </div>
            )
          })}

        </div>
      </div>

      {/* ── right-click menu on a notification row (Linear's) ── */}
      {ctxMenu && (
        <NotificationContextMenu
          notification={ctxMenu.n}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onMarkRead={(read) =>
            ctxMenu.act((id) => store.setNotificationRead(id, read))
          }
          onDelete={() => ctxMenu.act(store.deleteNotification)}
          onSnoozeAt={(iso) =>
            ctxMenu.act((id) => store.snoozeNotification(id, iso))
          }
        />
      )}

      {/* ── bulk action bar — floats bottom-centre while rows are checked ── */}
      <InboxBulkActions
        count={checkedVisible.length}
        onAssign={bulkAssign}
        onMarkRead={() => bulkAct(store.markNotificationRead)}
        onDelete={() => bulkAct(store.deleteNotification)}
        onClear={clearChecked}
        snoozeMenu={
          <Popover
            align="start"
            width={160}
            trigger={
              <span className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] text-muted hover:bg-bg-hover hover:text-fg">
                <Clock size={14} /> Snooze
              </span>
            }
          >
            {(close) => (
              <SnoozeMenu
                close={close}
                onSnoozeMs={(ms) =>
                  bulkAct((id) =>
                    store.snoozeNotification(
                      id,
                      new Date(now + ms).toISOString(),
                    ),
                  )
                }
                onSnoozeAt={(iso) =>
                  bulkAct((id) => store.snoozeNotification(id, iso))
                }
              />
            )}
          </Popover>
        }
      />

      {/* ── reading pane ──────────────────────────────────────────────────── */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {selected ? (
          <ReadingPane
            key={selected.id}
            n={selected}
            onSnooze={(ms) => actThenAdvance(selected.id, (x) => snooze(x, ms))}
            onSnoozeAt={(iso) =>
              actThenAdvance(selected.id, (x) =>
                store.snoozeNotification(x, iso),
              )
            }
            onUnsnooze={() => store.unsnoozeNotification(selected.id)}
            onDone={() => actThenAdvance(selected.id, store.deleteNotification)}
            onOpenFull={(identifier) => navigate(`/issue/${identifier}`)}
          />
        ) : (
          // With rows waiting, Linear's reading pane is a bare line of text —
          // no illustration, no heading. Only a genuinely empty inbox gets one.
          <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-muted">
            {list.length === 0
              ? "You're all caught up. New notifications will show up here."
              : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDeleteAll
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            store.deleteAllNotifications()
            setSelectedId(null)
            setConfirmDelete(false)
          }}
        />
      )}
    </div>
  )
}

// ── reading pane: the selected notification's issue ──────────────────────────
function ReadingPane({
  n,
  onSnooze,
  onSnoozeAt,
  onUnsnooze,
  onDone,
  onOpenFull,
}: {
  n: Notification
  onSnooze: (ms: number) => void
  onSnoozeAt: (iso: string) => void
  onUnsnooze: () => void
  onDone: () => void
  onOpenFull: (identifier: string) => void
}) {
  const store = useStore()
  const issue = store.issues.find((i) => i.id === n.issueId)
  const now = Date.now()
  const snoozed = isSnoozed(n.snoozedUntil, now)
  // Subscribe toggle — Linear lets you opt in/out of an issue's updates straight
  // from the reading pane. Reads the live subscriber list off the issue.
  const subscribed = !!issue && issue.subscriberIds.includes(store.currentUserId)

  const header = (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3 text-[13px]">
      {issue && (
        <>
          <span className="text-faint">
            {store.teams.find((t) => t.id === issue.teamId)?.name}
          </span>
          <span className="text-faint">›</span>
          <span className="font-mono text-faint">{issue.identifier}</span>
        </>
      )}
      <div className="flex-1" />
      {issue && (
        <button
          onClick={() => store.toggleIssueSubscriber(issue.id, store.currentUserId)}
          title={subscribed ? 'Unsubscribe' : 'Subscribe'}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded hover:bg-bg-hover hover:text-fg',
            subscribed ? 'text-fg' : 'text-muted',
          )}
        >
          {subscribed ? <Bell size={15} /> : <BellOff size={15} />}
        </button>
      )}
      {snoozed ? (
        <button
          onClick={onUnsnooze}
          title="Unsnooze"
          className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover hover:text-fg"
        >
          <AlarmClock size={15} />
        </button>
      ) : (
        <Popover
          align="end"
          width={160}
          trigger={
            <span
              title="Snooze (H)"
              className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover hover:text-fg"
            >
              <Clock size={15} />
            </span>
          }
        >
          {(close) => (
            <SnoozeMenu
              close={close}
              onSnoozeMs={onSnooze}
              onSnoozeAt={onSnoozeAt}
            />
          )}
        </Popover>
      )}
      <button
        onClick={onDone}
        title="Mark as done (⌫)"
        className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover hover:text-fg"
      >
        <InboxIcon size={15} />
      </button>
      {issue && (
        <button
          onClick={() => onOpenFull(issue.identifier)}
          title="Open full page"
          className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover hover:text-fg"
        >
          <Maximize2 size={15} />
        </button>
      )}
    </header>
  )

  if (!issue) {
    return (
      <>
        {header}
        <EmptyState
          illustration={<InboxIllustration />}
          title={n.body || 'Notification'}
          description="This notification isn't linked to an issue."
        />
      </>
    )
  }

  return (
    <>
      {header}
      <IssueDetailBody
        issue={issue}
        compact
        onOpenIssue={(identifier) => {
          const next = store.issues.find((i) => i.identifier === identifier)
          if (next) onOpenFull(next.identifier)
        }}
      />
    </>
  )
}

function NotificationRow({
  n,
  now,
  member = false,
  threadCount,
  expanded,
  onToggleExpand,
  selected,
  checked,
  anyChecked,
  onToggleCheck,
  onOpen,
  onContextMenu,
}: {
  n: Notification
  now: number
  member?: boolean
  threadCount: number // >1 ⇒ this row is a thread head with N members
  expanded: boolean
  onToggleExpand?: () => void
  selected: boolean
  checked: boolean
  anyChecked: boolean
  onToggleCheck: () => void
  onOpen: () => void
  onContextMenu: (x: number, y: number) => void
}) {
  const store = useStore()
  const fmt = useDisplayName()
  const actor = store.users.find((u) => u.id === n.actorId)
  const issue = store.issues.find((i) => i.id === n.issueId)
  const state = store.states.find((st) => st.id === issue?.stateId)
  const snoozed = isSnoozed(n.snoozedUntil, now)
  const isThread = threadCount > 1
  const Glyph = REASON_GLYPH[n.type]

  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e.clientX, e.clientY)
      }}
      className={cn(
        'group flex w-full cursor-pointer items-start gap-2.5 border-b border-border py-2.5 text-left outline-none',
        // Indent expanded member rows so the thread reads as a tree.
        member ? 'pl-9 pr-3' : 'px-3',
        selected ? 'bg-bg-selected' : 'hover:bg-bg-hover',
      )}
    >
      {/* leading slot: the actor avatar with a corner glyph naming the event
          (Linear stamps ✓ / ✎ / + / @ on the avatar), swapped for the bulk
          checkbox on hover or once any row is checked */}
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <span
          className={cn(
            'relative',
            checked || anyChecked ? 'invisible' : 'group-hover:invisible',
          )}
        >
          <Avatar user={actor} size={20} />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-bg text-faint">
            <Glyph size={9} strokeWidth={2.5} />
          </span>
        </span>
        <span
          role="checkbox"
          aria-checked={checked}
          onClick={(e) => {
            e.stopPropagation()
            onToggleCheck()
          }}
          className={cn(
            'absolute inset-0 flex h-4 w-4 cursor-pointer items-center justify-center self-center rounded-[4px] border transition-colors',
            checked
              ? 'border-accent bg-accent text-white'
              : 'border-border text-transparent hover:border-faint',
            checked || anyChecked
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100',
          )}
        >
          {checked && <Check size={11} strokeWidth={3} />}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {/* unread dot sits between the avatar and the title, as in Linear */}
          <span className="flex h-4 w-2 shrink-0 items-center">
            {!n.read && <span className="h-2 w-2 rounded-full bg-accent" />}
          </span>
          <div
            className={cn(
              'flex-1 truncate text-[13px] font-medium',
              n.read ? 'text-muted' : 'text-fg',
            )}
          >
            {issue?.title ?? fmt(actor?.name)}
          </div>
          {/* +N more — expand/collapse the thread of same-issue events */}
          {isThread && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand?.()
              }}
              title={expanded ? 'Collapse thread' : 'Expand thread'}
              className="flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-faint hover:bg-bg-hover hover:text-fg"
            >
              {expanded ? (
                <ChevronDown size={11} />
              ) : (
                <ChevronRight size={11} />
              )}
              +{threadCount - 1} more
            </button>
          )}
          {/* the issue's own status glyph closes the first line (Linear) */}
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {state && (
              <StatusIcon
                type={state.type}
                color={state.color}
                size={13}
              />
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 pl-3.5 text-[12px] text-faint">
          <span className="flex-1 truncate">
            <span className="text-muted">{fmt(actor?.name)}</span> {n.body}
          </span>
          {/* Linear puts the age on the second line, under the status glyph */}
          <span className="shrink-0 text-[11px] text-faint">
            {timeAgo(n.createdAt)}
          </span>
        </div>
        {snoozed && (
          <div className="mt-0.5 flex items-center gap-1 pl-3.5 text-[11px] text-faint">
            <AlarmClock size={11} />
            {new Date(n.snoozedUntil!).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
            })}
          </div>
        )}
      </div>
    </div>
  )
}
