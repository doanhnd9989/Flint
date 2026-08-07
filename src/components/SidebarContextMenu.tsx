import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight, Eye, Link2, MailCheck, SlidersHorizontal } from 'lucide-react'
import { useStore } from '@/lib/store'
import { SIDEBAR_VISIBILITY_LABELS } from '@/lib/constants'
import type { SidebarRowBadge, SidebarVisibility } from '@/lib/types'
import { copyToClipboard } from '@/lib/toast'

const MENU_W = 210
const SUB_W = 180

const rowCls =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

function Row({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={rowCls}>
      <span className="flex h-4 w-4 items-center justify-center text-faint">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  )
}

/** A hover flyout, the way Linear opens `Visibility ▸` and `Badge ▸`. */
function Flyout({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span className={rowCls}>
        <span className="flex h-4 w-4 items-center justify-center text-faint">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        <ChevronRight size={13} className="text-faint" />
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

/** A flyout leaf with Linear's right-aligned check on the active choice. */
function Choice({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={rowCls}>
      <span className="flex-1 truncate">{label}</span>
      {active && <Check size={13} className="text-faint" />}
    </button>
  )
}

const Divider = () => <div className="my-1 h-px bg-border" />

/**
 * Right-click menu for a sidebar row, in Linear's four shapes:
 *
 * - Inbox — `Mark all as read` · `Visibility ▸` / `Badge ▸` / `Customize
 *   sidebar` · `Copy link`
 * - a configurable row (My issues, Projects, Teams, Views) — `Visibility ▸` /
 *   `Customize sidebar` · `Copy link`
 * - a plain row (a team's Home/Triage/Issues/…, a favourite, a pin) — just
 *   `Copy link`
 * - a section header — just `Customize sidebar`
 *
 * `itemKey` is what turns the first two on: it is the registry key the
 * Visibility and Badge choices are saved against.
 */
export function SidebarContextMenu({
  x,
  y,
  onClose,
  itemKey,
  href,
  badgeable,
  alwaysAvailable,
  markAllRead,
  customize,
}: {
  x: number
  y: number
  onClose: () => void
  /** Registry key — present only on rows Customize sidebar can configure. */
  itemKey?: string
  /** Path to put on the clipboard; omitted on section headers. */
  href?: string
  /** Rows that can actually badge are the only ones offered `Badge ▸`. */
  badgeable?: boolean
  /** Rows Linear never lets you hide drop "Don't show" from `Visibility ▸`. */
  alwaysAvailable?: boolean
  /** Inbox only — Linear puts `Mark all as read` at the top. */
  markAllRead?: boolean
  /** Whether to offer `Customize sidebar` (rows and section headers, not links). */
  customize?: boolean
}) {
  const visibility = useStore((s) =>
    itemKey ? s.sidebarPrefs.visibility[itemKey] : undefined,
  )
  const rowBadge = useStore((s) => (itemKey ? s.sidebarPrefs.badges[itemKey] : undefined))
  const badgeStyle = useStore((s) => s.sidebarPrefs.badgeStyle)
  const setVisibility = useStore((s) => s.setSidebarVisibility)
  const setRowBadge = useStore((s) => s.setSidebarRowBadge)
  const openCustomize = useStore((s) => s.setCustomizeSidebarOpen)
  const markRead = useStore((s) => s.markAllNotificationsRead)
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

  // Keep the panel — and the room its flyout needs — inside the viewport.
  const [pos, setPos] = useState({ top: y, left: x })
  useLayoutEffect(() => {
    const h = panelRef.current?.offsetHeight ?? 180
    setPos({
      top: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
      left: Math.max(8, Math.min(x, window.innerWidth - MENU_W - SUB_W - 16)),
    })
  }, [x, y])

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  // Linear offers "Show when badged" only where a badge can arrive, and drops
  // "Don't show" on rows it never lets you hide.
  const visibilityOptions = (Object.keys(SIDEBAR_VISIBILITY_LABELS) as SidebarVisibility[])
    .filter((v) => v !== 'badged' || badgeable)
    .filter((v) => v !== 'hidden' || !alwaysAvailable)

  const badgeOptions: { label: string; value: SidebarRowBadge | undefined }[] = [
    { label: `Default (${badgeStyle === 'dot' ? 'Dot' : 'Count'})`, value: undefined },
    { label: 'Count', value: 'count' },
    { label: 'Dot', value: 'dot' },
    { label: 'None', value: 'none' },
  ]

  const configurable = !!itemKey
  return createPortal(
    <div
      ref={panelRef}
      style={{ top: pos.top, left: pos.left, width: MENU_W }}
      className="fixed z-50 rounded-lg border border-border bg-bg-elevated p-1 shadow-lg"
    >
      {markAllRead && (
        <>
          <Row
            icon={<MailCheck size={14} />}
            label="Mark all as read"
            onClick={run(markRead)}
          />
          <Divider />
        </>
      )}
      {configurable && (
        <Flyout icon={<Eye size={14} />} label="Visibility">
          {visibilityOptions.map((v) => (
            <Choice
              key={v}
              label={SIDEBAR_VISIBILITY_LABELS[v]}
              // An unset row sits at its registry default, which is "Always
              // show" for everything that offers this menu.
              active={(visibility ?? 'always') === v}
              onClick={run(() => setVisibility(itemKey, v))}
            />
          ))}
        </Flyout>
      )}
      {configurable && badgeable && (
        <Flyout icon={<span className="text-[11px] leading-none">●</span>} label="Badge">
          {badgeOptions.map((o) => (
            <Choice
              key={o.label}
              label={o.label}
              active={rowBadge === o.value}
              onClick={run(() => setRowBadge(itemKey, o.value))}
            />
          ))}
        </Flyout>
      )}
      {customize && (
        <Row
          icon={<SlidersHorizontal size={14} />}
          label="Customize sidebar"
          onClick={run(() => openCustomize(true))}
        />
      )}
      {href && customize && <Divider />}
      {href && (
        <Row
          icon={<Link2 size={14} />}
          label="Copy link"
          onClick={run(() =>
            copyToClipboard(`${window.location.origin}${href}`, 'Link copied'),
          )}
        />
      )}
    </div>,
    document.body,
  )
}
