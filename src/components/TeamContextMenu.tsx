import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Star, Settings, Link2, Archive, Bell, BellOff, Blocks, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { copyToClipboard } from '@/lib/toast'
import { cn } from '@/lib/utils'

const MENU_W = 232
const SUB_W = 200

const rowCls =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

function Hint({ children }: { children: ReactNode }) {
  return <span className="ml-auto pl-3 text-[12px] tracking-wide text-faint">{children}</span>
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
      className={cn(rowCls, disabled && 'cursor-default text-faint hover:bg-transparent')}
    >
      <span className="flex h-4 w-4 items-center justify-center text-faint">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {hint && <Hint>{hint}</Hint>}
    </button>
  )
}

const Divider = () => <div className="my-1 h-px bg-border" />

/**
 * Right-click menu for a team row in the sidebar — Linear's order exactly:
 * Favorite / Team settings · Copy URL · Open archive / Subscribe ▸ · Configure
 * Slack notifications… / Leave team… (disabled for the only owner, as Linear
 * greys it out rather than hiding it).
 */
export function TeamContextMenu({
  teamId,
  x,
  y,
  onClose,
}: {
  teamId: string
  x: number
  y: number
  onClose: () => void
}) {
  const navigate = useNavigate()
  const team = useStore((s) => s.teams.find((t) => t.id === teamId))
  const favorites = useStore((s) => s.favorites)
  const currentUserId = useStore((s) => s.currentUserId)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const toggleTeamSubscription = useStore((s) => s.toggleTeamSubscription)
  const panelRef = useRef<HTMLDivElement>(null)
  const [sub, setSub] = useState(false)

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

  if (!team) return null

  const starred = favorites.some((f) => f.type === 'team' && f.id === team.id)
  const subscribed = (team.subscriberIds ?? []).includes(currentUserId)
  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return createPortal(
    <div
      ref={panelRef}
      style={{ top: pos.top, left: pos.left, width: MENU_W }}
      className="fixed z-50 rounded-lg border border-border bg-bg-elevated p-1 shadow-lg"
    >
      <Row
        icon={<Star size={14} className={starred ? 'fill-current text-yellow-500' : undefined} />}
        label={starred ? 'Unfavorite' : 'Favorite'}
        hint="⌥F"
        onClick={run(() => toggleFavorite('team', team.id))}
      />
      <Divider />
      <Row
        icon={<Settings size={14} />}
        label="Team settings"
        onClick={run(() => navigate(`/settings?page=team-${team.id}`))}
      />
      <Row
        icon={<Link2 size={14} />}
        label="Copy URL"
        hint="⌘⇧,"
        onClick={run(() =>
          copyToClipboard(
            `${window.location.origin}/team/${team.key}/active`,
            'Team URL copied',
          ),
        )}
      />
      <Row
        icon={<Archive size={14} />}
        label="Open archive"
        onClick={run(() => navigate('/archive'))}
      />
      <Divider />
      {/* Subscribe is a flyout in Linear — the leaf toggles the subscription. */}
      <div className="relative" onMouseEnter={() => setSub(true)} onMouseLeave={() => setSub(false)}>
        <span className={rowCls}>
          <span className="flex h-4 w-4 items-center justify-center text-faint">
            {subscribed ? <Bell size={14} /> : <BellOff size={14} />}
          </span>
          <span className="flex-1">Subscribe</span>
          <ChevronRight size={13} className="text-faint" />
        </span>
        {sub && (
          <div
            style={{ width: SUB_W }}
            className="absolute left-full top-0 ml-1 rounded-lg border border-border bg-bg-elevated p-1 shadow-lg"
          >
            <Row
              icon={<Bell size={14} />}
              label={subscribed ? 'Unsubscribe' : 'Subscribe to all activity'}
              onClick={run(() => toggleTeamSubscription(team.id))}
            />
          </div>
        )}
      </div>
      <Row
        icon={<Blocks size={14} />}
        label="Configure Slack notifications…"
        onClick={run(() => navigate('/settings?page=integrations'))}
      />
      <Divider />
      {/* Linear greys this out for the last member rather than hiding it. */}
      <Row icon={<span />} label="Leave team…" disabled />
    </div>,
    document.body,
  )
}
