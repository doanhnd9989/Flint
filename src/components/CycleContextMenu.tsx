import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronRight,
  Download,
  Link2,
  Pencil,
  PlayCircle,
  Star,
} from 'lucide-react'
import { DatePicker } from './DatePicker'
import { useStore } from '@/lib/store'
import { copyToClipboard, toast } from '@/lib/toast'
import { cn, formatDate } from '@/lib/utils'
import { cycleState } from '@/lib/selectors'
import type { Cycle } from '@/lib/types'

const MENU_W = 258
const SUB_W = 272

const rowCls =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

function Hint({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto whitespace-nowrap pl-3 text-[12px] tracking-wide text-faint">
      {children}
    </span>
  )
}

/** A plain action row. */
function Row({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode
  label: string
  hint?: string
  onClick?: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={rowCls}>
      <span className="flex h-4 w-4 items-center justify-center text-faint">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {hint && <Hint>{hint}</Hint>}
    </button>
  )
}

/** A checkbox row — the shape Linear's notification submenu uses. */
function CheckRow({
  label,
  checked,
  onClick,
}: {
  label: string
  checked: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={rowCls}>
      <span className="flex h-4 w-4 items-center justify-center text-faint">
        {checked && <Check size={13} className="text-accent" />}
      </span>
      <span className="flex-1 whitespace-normal leading-snug">{label}</span>
    </button>
  )
}

/**
 * The static half of a date row — label on the left, the date it currently
 * holds on the right. Handed to DatePicker as its trigger.
 */
function dateRow(label: string, value: string) {
  return (
    <span className={rowCls}>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-faint">
        <CalendarDays size={14} />
      </span>
      <span className="flex-1 whitespace-nowrap">{label}</span>
      <span className="whitespace-nowrap pl-2 text-[12px] text-muted">{value}</span>
    </span>
  )
}

const Divider = () => <div className="my-1 h-px bg-border" />

/**
 * A row that expands a flyout to the right on hover. Module scope on purpose:
 * declared inside the menu it would be a fresh component type on every render,
 * so each `sub` change remounted every row and swallowed the mouseenter that
 * should have moved the flyout (see PROGRESS.md, projects-initiatives pass).
 */
function SubRow({
  id,
  icon,
  label,
  open,
  onOpen,
  offsetLeft,
  children,
}: {
  id: string
  icon: ReactNode
  label: string
  open: boolean
  onOpen: (id: string) => void
  offsetLeft: number
  children: ReactNode
}) {
  return (
    <div className="relative" onMouseEnter={() => onOpen(id)}>
      <div className={cn(rowCls, open && 'bg-bg-hover')}>
        <span className="flex h-4 w-4 items-center justify-center text-faint">
          {icon}
        </span>
        <span className="flex-1">{label}</span>
        <ChevronRight size={13} className="text-faint" />
      </div>
      {open && (
        <div
          style={{ width: SUB_W, left: offsetLeft }}
          className="absolute top-[-5px] z-50 rounded-lg border border-border bg-bg-elevated p-1 shadow-lg animate-pop"
        >
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * `Edit cycle name and description…` — Linear's one dialog for both fields.
 * Enter (or ⌘Enter from the textarea) commits, Escape backs out.
 */
function EditDialog({
  cycle,
  onClose,
}: {
  cycle: Cycle
  onClose: () => void
}) {
  const updateCycle = useStore((s) => s.updateCycle)
  const [name, setName] = useState(cycle.name ?? '')
  const [goal, setGoal] = useState(cycle.goal ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const commit = () => {
    updateCycle(cycle.id, {
      name: name.trim() || undefined,
      goal: goal.trim() || undefined,
    })
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/25 pt-[18vh]"
      onMouseDown={onClose}
    >
      <div
        className="w-[480px] rounded-lg border border-border bg-bg-elevated p-3 shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-[12px] font-medium text-muted">
          Cycle {cycle.number}
        </div>
        <input
          ref={inputRef}
          value={name}
          placeholder="Cycle name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') onClose()
          }}
          className="w-full rounded-md border border-border bg-bg px-2.5 py-2 text-[14px] text-fg outline-none placeholder:text-faint focus:border-accent"
        />
        <textarea
          value={goal}
          placeholder="Description"
          rows={3}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit()
            if (e.key === 'Escape') onClose()
          }}
          className="mt-2 w-full resize-none rounded-md border border-border bg-bg px-2.5 py-2 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2.5 py-1.5 text-[13px] text-muted hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={commit}
            className="rounded-md bg-accent px-2.5 py-1.5 text-[13px] text-white hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Pad to two digits for the .ics UTC stamps. */
const p2 = (n: number) => String(n).padStart(2, '0')

/** An RFC 5545 UTC timestamp: 20260813T050153Z. */
function icsStamp(iso: string): string {
  const d = new Date(iso)
  return (
    `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}` +
    `T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`
  )
}

/** A one-event .ics calendar for the cycle's date range. */
function icsFor(cycle: Cycle, title: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Flint Task//Cycles//EN',
    'BEGIN:VEVENT',
    `UID:${cycle.id}@flinttask`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(cycle.startsAt)}`,
    `DTEND:${icsStamp(cycle.endsAt)}`,
    `SUMMARY:${title}`,
    cycle.goal ? `DESCRIPTION:${cycle.goal.replace(/\n/g, '\\n')}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

/**
 * Right-click / ⋯ menu for a cycle, in Linear's order and wording:
 *
 *   Edit cycle name and description… · Change cycle dates ▸ ·
 *   Start cycle today… · — · Subscribe to cycle notifications ▸ · Favorite ·
 *   Copy link · Subscribe to cycle calendar ▸
 *
 * Linear varies the menu by cycle phase, and so does this: `Change cycle
 * dates ▸` and the notification submenu are absent on a completed cycle,
 * `Start cycle today…` shows only on one that hasn't started, and `Change
 * cycle dates ▸` offers `Move start date…` only while the start is still in
 * the future. `Open in desktop app` is deliberately absent — there is no
 * desktop app to hand off to (same call as the inbox and projects passes).
 */
export function CycleContextMenu({
  cycleId,
  x,
  y,
  nowMs,
  onClose,
}: {
  cycleId: string
  x: number
  y: number
  /** "Now" for the phase test — passed in so this stays pure across renders. */
  nowMs: number
  onClose: () => void
}) {
  const store = useStore()
  const panelRef = useRef<HTMLDivElement>(null)
  const [sub, setSub] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Flip the panel back on screen when the row sits near an edge. The flyout
  // needs room to its right, so the left clamp reserves MENU_W + SUB_W.
  const [pos, setPos] = useState({ top: y, left: x, sub: MENU_W - 4 })
  useLayoutEffect(() => {
    const h = panelRef.current?.offsetHeight ?? 300
    const vw = window.innerWidth
    const left = Math.max(8, Math.min(x, vw - MENU_W - SUB_W - 16))
    const right = MENU_W - 4
    const flipped = -SUB_W - 4
    setPos({
      top: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
      left,
      sub:
        left + 4 + right + SUB_W + 8 <= vw
          ? right
          : left + 4 + flipped >= 8
            ? flipped
            : // Too narrow for either side — overlay the menu but stay on screen.
              8 - (left + 4),
    })
  }, [x, y])

  const cycle = store.cycles.find((c) => c.id === cycleId)
  if (!cycle) return null

  const status = cycleState(cycle.startsAt, cycle.endsAt, nowMs).status
  const started = status !== 'upcoming'
  const completed = status === 'past'
  const title = cycle.name ? `Cycle ${cycle.number} · ${cycle.name}` : `Cycle ${cycle.number}`

  const team = store.teams.find((t) => t.id === cycle.teamId)
  const url = `${window.location.origin}/team/${team?.key ?? ''}/cycle/${cycle.number}`
  const starred = store.favorites.some(
    (f) => f.type === 'cycle' && f.id === cycle.id,
  )
  const me = store.currentUserId

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  /** Google Calendar's event-template URL for this cycle's range. */
  const googleUrl =
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${icsStamp(cycle.startsAt)}/${icsStamp(cycle.endsAt)}` +
    (cycle.goal ? `&details=${encodeURIComponent(cycle.goal)}` : '')

  const downloadIcs = () => {
    const blob = new Blob([icsFor(cycle, title)], {
      type: 'text/calendar;charset=utf-8;',
    })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `cycle-${cycle.number}.ics`
    a.click()
    URL.revokeObjectURL(href)
    toast(`${title} downloaded as .ics`)
  }

  return createPortal(
    <>
      {editing && (
        <EditDialog
          cycle={cycle}
          onClose={() => {
            setEditing(false)
            onClose()
          }}
        />
      )}
      <div
        data-overlay
        className="fixed inset-0 z-50"
        onMouseDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      >
        <div
          ref={panelRef}
          className="absolute rounded-lg border border-border bg-bg-elevated p-1 shadow-lg animate-pop"
          style={{ top: pos.top, left: pos.left, width: MENU_W }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div onMouseEnter={() => setSub(null)}>
            <Row
              icon={<Pencil size={14} />}
              label="Edit cycle name and description…"
              onClick={() => setEditing(true)}
            />
          </div>

          {/* Linear drops the date submenu once the cycle has finished. */}
          {!completed && (
            <SubRow
              id="dates"
              icon={<CalendarRange size={14} />}
              label="Change cycle dates"
              open={sub === 'dates'}
              onOpen={setSub}
              offsetLeft={pos.sub}
            >
              {/* A cycle already under way can only have its end moved. */}
              {!started && (
                <DatePicker
                  value={cycle.startsAt}
                  onChange={(iso) => {
                    if (iso) store.updateCycle(cycle.id, { startsAt: iso })
                    onClose()
                  }}
                  align="start"
                  trigger={dateRow(
                    'Move start date…',
                    formatDate(cycle.startsAt),
                  )}
                />
              )}
              <DatePicker
                value={cycle.endsAt}
                onChange={(iso) => {
                  if (iso) store.updateCycle(cycle.id, { endsAt: iso })
                  onClose()
                }}
                align="start"
                trigger={dateRow('Move end date…', formatDate(cycle.endsAt))}
              />
            </SubRow>
          )}

          {/* Only a cycle that hasn't begun can be pulled forward. */}
          {!started && (
            <div onMouseEnter={() => setSub(null)}>
              <Row
                icon={<PlayCircle size={14} />}
                label="Start cycle today…"
                onClick={run(() => {
                  store.startCycleToday(cycle.id)
                  toast(`${title} started today`)
                })}
              />
            </div>
          )}

          <Divider />

          {/* Linear hides the notification submenu on a finished cycle. */}
          {!completed && (
            <SubRow
              id="notify"
              icon={<Bell size={14} />}
              label="Subscribe to cycle notifications"
              open={sub === 'notify'}
              onOpen={setSub}
              offsetLeft={pos.sub}
            >
              <CheckRow
                label="An issue is added to the upcoming cycle"
                checked={(cycle.notifyAddedIds ?? []).includes(me)}
                onClick={run(() =>
                  store.toggleCycleNotification(cycle.id, 'added', me),
                )}
              />
              <CheckRow
                label="An issue is marked completed or canceled"
                checked={(cycle.notifyCompletedIds ?? []).includes(me)}
                onClick={run(() =>
                  store.toggleCycleNotification(cycle.id, 'completed', me),
                )}
              />
            </SubRow>
          )}

          <div onMouseEnter={() => setSub(null)}>
            <Row
              icon={
                <Star
                  size={14}
                  fill={starred ? 'currentColor' : 'none'}
                  className={starred ? 'text-[var(--status-started)]' : ''}
                />
              }
              label={starred ? 'Unfavorite' : 'Favorite'}
              hint="⌥F"
              onClick={run(() => store.toggleFavorite('cycle', cycle.id))}
            />
            <Row
              icon={<Link2 size={14} />}
              label="Copy link"
              onClick={run(() => copyToClipboard(url, 'Cycle link copied to clipboard'))}
            />
          </div>

          <SubRow
            id="calendar"
            icon={<Bell size={14} />}
            label="Subscribe to cycle calendar"
            open={sub === 'calendar'}
            onOpen={setSub}
            offsetLeft={pos.sub}
          >
            <Row
              icon={<CalendarDays size={14} />}
              label="Add to Google Calendar"
              onClick={run(() => window.open(googleUrl, '_blank', 'noopener'))}
            />
            <Row
              icon={<Link2 size={14} />}
              label="Copy feed URL for your calendar"
              onClick={run(() =>
                copyToClipboard(
                  url.replace(/^https?:/, 'webcal:') + '.ics',
                  'Calendar feed URL copied to clipboard',
                ),
              )}
            />
            <Row
              icon={<Download size={14} />}
              label="Download .ics calendar file"
              onClick={run(downloadIcs)}
            />
          </SubRow>
        </div>
      </div>
    </>,
    document.body,
  )
}
