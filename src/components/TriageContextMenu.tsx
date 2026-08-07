import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Clock,
  Copy,
  Link2,
  MoveRight,
  XSquare,
} from 'lucide-react'
import { DatePicker } from './DatePicker'
import { useStore } from '@/lib/store'
import { copyToClipboard, copyToast } from '@/lib/toast'
import { snoozePresets, stamp } from '@/lib/dateOptions'
import { cn } from '@/lib/utils'

const MENU_W = 232
// Wide enough for "An hour from now" beside its resolved stamp ("Sat, 8 Aug,
// 2:16") without either being truncated — at 248 both ends clipped.
const SUB_W = 280

const rowCls =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

function Hint({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto whitespace-nowrap pl-3 text-[12px] tracking-wide text-faint">
      {children}
    </span>
  )
}

function Row({
  icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: ReactNode
  label: string
  hint?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        rowCls,
        disabled && 'cursor-default text-faint hover:bg-transparent',
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-faint">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {hint && <Hint>{hint}</Hint>}
    </button>
  )
}

const Divider = () => <div className="my-1 h-px bg-border" />

/**
 * Hover-opened flyout row. Module scope on purpose: declared inside the menu it
 * would be a fresh component type every render, remounting each row and eating
 * the mouseenter that should move the flyout (PROGRESS.md, projects pass).
 */
function Flyout({
  icon,
  label,
  hint,
  offsetLeft,
  children,
}: {
  icon: ReactNode
  label: string
  hint?: string
  offsetLeft: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className={cn(rowCls, open && 'bg-bg-hover')}>
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-faint">
          {icon}
        </span>
        <span className="flex-1">{label}</span>
        {hint && <Hint>{hint}</Hint>}
        <ChevronRight size={13} className="ml-1 shrink-0 text-faint" />
      </span>
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
 * Right-click / ⋯ menu for a row in the Triage queue, in Linear's order,
 * wording and shortcut hints:
 *
 *   Accept… 1 · Decline… 2 · Mark as duplicate… 3 · — · Snooze H ▸ · Copy URL ⌘⇧,
 *
 * `Move to team ▸` is ours only. Linear moves a triage issue through the issue's
 * own ⋯ menu rather than the triage row's, but re-homing a mis-filed report is
 * the single most common thing done to a triage row here, so it stays — below
 * the divider, out of the way of Linear's five.
 */
export function TriageContextMenu({
  issueId,
  x,
  y,
  nowMs,
  onClose,
}: {
  issueId: string
  x: number
  y: number
  /**
   * "Now" for the `Next cycle` lookup — stamped by the opener in its event
   * handler so this component stays pure across renders.
   */
  nowMs: number
  onClose: () => void
}) {
  const store = useStore()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Flip the panel back on screen near an edge. The flyout needs room to its
  // right, so the left clamp reserves MENU_W + SUB_W.
  const [pos, setPos] = useState({ top: y, left: x, sub: MENU_W - 4 })
  useLayoutEffect(() => {
    const h = panelRef.current?.offsetHeight ?? 220
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

  const issue = store.issues.find((i) => i.id === issueId)
  if (!issue) return null

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  const snoozeAt = (d: Date) => store.setIssueSnooze(issue.id, d.toISOString())

  // "Next cycle" resolves against the issue's own team — inert when that team
  // has nothing upcoming, exactly as Linear greys it out.
  const nextCycle = store.cycles
    .filter(
      (c) =>
        c.teamId === issue.teamId &&
        !c.pausedAt &&
        new Date(c.startsAt).getTime() > nowMs,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]

  // Every other team, in name order — the "Move to team" targets.
  const otherTeams = store.teams
    .filter((t) => t.id !== issue.teamId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const url = `${window.location.origin}/issue/${issue.identifier}`

  return createPortal(
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
        <Row
          icon={<CheckSquare size={14} />}
          label="Accept…"
          hint="1"
          onClick={run(() => store.acceptTriage(issue.id))}
        />
        <Row
          icon={<XSquare size={14} />}
          label="Decline…"
          hint="2"
          onClick={run(() => store.declineTriage(issue.id))}
        />
        <Row
          icon={<Copy size={14} />}
          label="Mark as duplicate…"
          hint="3"
          onClick={run(() => store.openRelationPicker(issue.id, 'duplicateOf'))}
        />
        <Divider />
        <Flyout
          icon={<Clock size={14} />}
          label="Snooze"
          hint="H"
          offsetLeft={pos.sub}
        >
          {snoozePresets().map((p) => (
            <Row
              key={p.label}
              icon={<Clock size={14} />}
              label={p.label}
              hint={stamp(p.at)}
              onClick={run(() => snoozeAt(p.at))}
            />
          ))}
          <Row
            icon={<Clock size={14} />}
            label="Next cycle"
            hint={nextCycle ? stamp(new Date(nextCycle.startsAt)) : undefined}
            disabled={!nextCycle}
            onClick={
              nextCycle
                ? run(() => snoozeAt(new Date(nextCycle.startsAt)))
                : undefined
            }
          />
          <DatePicker
            align="start"
            onChange={(iso) => {
              if (iso) {
                store.setIssueSnooze(issue.id, iso)
                onClose()
              }
            }}
            trigger={
              <span className={rowCls}>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-faint">
                  <CalendarDays size={14} />
                </span>
                <span className="flex-1">Custom…</span>
              </span>
            }
          />
        </Flyout>
        <Row
          icon={<Link2 size={14} />}
          label="Copy URL"
          hint="⌘⇧,"
          onClick={run(() => copyToClipboard(url, copyToast.url()))}
        />

        {otherTeams.length > 0 && (
          <>
            <Divider />
            <Flyout
              icon={<MoveRight size={14} />}
              label="Move to team"
              offsetLeft={pos.sub}
            >
              {otherTeams.map((t) => (
                <Row
                  key={t.id}
                  icon={<span className="text-[13px] leading-none">{t.icon}</span>}
                  label={t.name}
                  hint={t.key}
                  onClick={run(() => store.moveIssueToTeam(issue.id, t.id))}
                />
              ))}
            </Flyout>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
