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
  BellOff,
  CalendarDays,
  ChevronRight,
  Clock,
  Clipboard,
  Copy,
  Inbox as InboxIcon,
  Link2,
  Star,
  Type,
  X,
} from 'lucide-react'
import { DatePicker } from '@/components/DatePicker'
import { morning, stamp } from '@/lib/dateOptions'
import { useStore } from '@/lib/store'
import { copyToClipboard, copyToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/types'

const MENU_W = 232
// Same snooze flyout as Triage's, and it needs the same room: at 248 both
// "An hour from now" and its stamp were clipped.
const SUB_W = 280

const rowCls =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

function Hint({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto pl-3 text-[12px] tracking-wide text-faint">
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
      <span className="flex h-4 w-4 items-center justify-center text-faint">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {hint && <Hint>{hint}</Hint>}
    </button>
  )
}

const Divider = () => <div className="my-1 h-px bg-border" />

/** Flyout wrapper — hover opens it to the right, exactly like Linear's ▸ rows. */
function Flyout({
  icon,
  label,
  hint,
  children,
}: {
  icon: ReactNode
  label: string
  hint?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className={rowCls}>
        <span className="flex h-4 w-4 items-center justify-center text-faint">
          {icon}
        </span>
        <span className="flex-1">{label}</span>
        {hint && <Hint>{hint}</Hint>}
        <ChevronRight size={13} className="ml-1 text-faint" />
      </span>
      {open && (
        <div
          style={{ width: SUB_W }}
          className="absolute left-full top-0 ml-1 rounded-lg border border-border bg-bg-elevated p-1 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Right-click menu for an inbox notification — Linear's order exactly:
 * Mark as read · Delete notification · Snooze ▸ · Subscribe ⇧S / Favorite ⌥F ·
 * Copy ▸. Linear's trailing "Open in desktop app" row is omitted: there is no
 * desktop build to hand off to, and a dead row is worse than an absent one.
 */
export function NotificationContextMenu({
  notification,
  x,
  y,
  onClose,
  onMarkRead,
  onDelete,
  onSnoozeAt,
}: {
  notification: Notification
  x: number
  y: number
  onClose: () => void
  onMarkRead: (read: boolean) => void
  onDelete: () => void
  onSnoozeAt: (iso: string) => void
}) {
  const issue = useStore((s) =>
    s.issues.find((i) => i.id === notification.issueId),
  )
  const cycles = useStore((s) => s.cycles)
  const favorites = useStore((s) => s.favorites)
  const currentUserId = useStore((s) => s.currentUserId)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const toggleIssueSubscriber = useStore((s) => s.toggleIssueSubscriber)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onDown(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  // Flip the panel back on screen when the row is near the bottom/right edge.
  const [pos, setPos] = useState({ top: y, left: x })
  useLayoutEffect(() => {
    const h = panelRef.current?.offsetHeight ?? 260
    setPos({
      top: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
      left: Math.max(8, Math.min(x, window.innerWidth - MENU_W - SUB_W - 16)),
    })
  }, [x, y])

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  const starred =
    !!issue && favorites.some((f) => f.type === 'issue' && f.id === issue.id)
  const subscribed = !!issue && issue.subscriberIds.includes(currentUserId)

  // ── snooze presets ────────────────────────────────────────────────────────
  const now = new Date()
  const hour = new Date(now.getTime() + 3_600_000)
  const tomorrow = morning(new Date(now.getTime() + 86_400_000))
  // "Next week" is the coming Monday, not now+7d — Linear lands it on the week
  // start (Fri 7 Aug → Mon 10 Aug).
  const nextWeek = morning(new Date(now))
  nextWeek.setDate(nextWeek.getDate() + ((8 - nextWeek.getDay()) % 7 || 7))
  const nextMonth = morning(new Date(now))
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  // "Next cycle" resolves against the issue's own team, so it is blank (and
  // inert) for a notification whose team has nothing upcoming.
  const nextCycle = issue
    ? cycles
        .filter(
          (c) =>
            c.teamId === issue.teamId &&
            !c.pausedAt &&
            new Date(c.startsAt).getTime() > now.getTime(),
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
    : undefined

  const url = issue ? `${window.location.origin}/issue/${issue.identifier}` : ''

  return createPortal(
    <div
      ref={panelRef}
      style={{ top: pos.top, left: pos.left, width: MENU_W }}
      className="fixed z-50 rounded-lg border border-border bg-bg-elevated p-1 shadow-lg"
    >
      <Row
        icon={<InboxIcon size={14} />}
        label={notification.read ? 'Mark as unread' : 'Mark as read'}
        hint="U"
        onClick={run(() => onMarkRead(!notification.read))}
      />
      <Row
        icon={<X size={14} />}
        label="Delete notification"
        hint="⌫"
        onClick={run(onDelete)}
      />
      <Flyout icon={<Clock size={14} />} label="Snooze" hint="H">
        <Row
          icon={<Clock size={14} />}
          label="An hour from now"
          hint={stamp(hour)}
          onClick={run(() => onSnoozeAt(hour.toISOString()))}
        />
        <Row
          icon={<Clock size={14} />}
          label="Tomorrow"
          hint={stamp(tomorrow)}
          onClick={run(() => onSnoozeAt(tomorrow.toISOString()))}
        />
        <Row
          icon={<Clock size={14} />}
          label="Next week"
          hint={stamp(nextWeek)}
          onClick={run(() => onSnoozeAt(nextWeek.toISOString()))}
        />
        <Row
          icon={<Clock size={14} />}
          label="A month from now"
          hint={stamp(nextMonth)}
          onClick={run(() => onSnoozeAt(nextMonth.toISOString()))}
        />
        <Row
          icon={<Clock size={14} />}
          label="Next cycle"
          hint={nextCycle ? stamp(new Date(nextCycle.startsAt)) : undefined}
          disabled={!nextCycle}
          onClick={
            nextCycle
              ? run(() =>
                  onSnoozeAt(new Date(nextCycle.startsAt).toISOString()),
                )
              : undefined
          }
        />
        <DatePicker
          align="start"
          onChange={(iso) => {
            if (iso) {
              onSnoozeAt(iso)
              onClose()
            }
          }}
          trigger={
            <span className={rowCls}>
              <span className="flex h-4 w-4 items-center justify-center text-faint">
                <CalendarDays size={14} />
              </span>
              <span className="flex-1">Custom…</span>
            </span>
          }
        />
      </Flyout>
      <Row
        icon={subscribed ? <BellOff size={14} /> : <Bell size={14} />}
        label={subscribed ? 'Unsubscribe' : 'Subscribe'}
        hint="⇧S"
        disabled={!issue}
        onClick={
          issue
            ? run(() => toggleIssueSubscriber(issue.id, currentUserId))
            : undefined
        }
      />
      <Divider />
      <Row
        icon={
          <Star
            size={14}
            className={starred ? 'fill-current text-yellow-500' : undefined}
          />
        }
        label={starred ? 'Unfavorite' : 'Favorite'}
        hint="⌥F"
        disabled={!issue}
        onClick={issue ? run(() => toggleFavorite('issue', issue.id)) : undefined}
      />
      <Flyout icon={<Clipboard size={14} />} label="Copy">
        <Row
          icon={<Copy size={14} />}
          label="Copy ID"
          hint="⌘."
          disabled={!issue}
          onClick={
            issue
              ? run(() =>
                  copyToClipboard(
                    issue.identifier,
                    copyToast.id(issue.identifier),
                  ),
                )
              : undefined
          }
        />
        <Row
          icon={<Link2 size={14} />}
          label="Copy URL"
          hint="⌘⇧,"
          disabled={!issue}
          onClick={issue ? run(() => copyToClipboard(url, copyToast.url())) : undefined}
        />
        <Row
          icon={<Type size={14} />}
          label="Copy title"
          hint="⌘⇧'"
          disabled={!issue}
          onClick={
            issue
              ? run(() =>
                  copyToClipboard(issue.title, 'Title copied to clipboard'),
                )
              : undefined
          }
        />
        <Row
          icon={<Link2 size={14} />}
          label="Copy title as link"
          hint="⌘C"
          disabled={!issue}
          onClick={
            issue
              ? run(() =>
                  copyToClipboard(
                    `[${issue.identifier} ${issue.title}](${url})`,
                    'Title copied to clipboard',
                  ),
                )
              : undefined
          }
        />
        <Row
          icon={<Copy size={14} />}
          label="Copy description as Markdown"
          disabled={!issue}
          onClick={
            issue
              ? run(() =>
                  copyToClipboard(
                    issue.description,
                    'Description copied to clipboard',
                  ),
                )
              : undefined
          }
        />
        <Row
          icon={<Copy size={14} />}
          label="Copy content as Markdown"
          hint="⌘⌥C"
          disabled={!issue}
          onClick={
            issue
              ? run(() =>
                  copyToClipboard(
                    `# ${issue.identifier} ${issue.title}\n\n${issue.description}`,
                    'Content copied to clipboard',
                  ),
                )
              : undefined
          }
        />
      </Flyout>
    </div>,
    document.body,
  )
}
