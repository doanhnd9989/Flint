import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Archive,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Calendar,
  ChevronRight,
  Clipboard,
  FileText,
  Link2,
  MessageSquarePlus,
  Move,
  Pencil,
  Star,
  Trash2,
  Type,
  User,
} from 'lucide-react'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { SelectMenu, type SelectOption } from './ui/SelectMenu'
import { DatePicker } from './DatePicker'
import { Avatar } from './Avatar'
import { useStore } from '@/lib/store'
import { INITIATIVE_STATUS, INITIATIVE_STATUS_ORDER } from '@/lib/constants'
import { copyToClipboard } from '@/lib/toast'
import { cn, formatDate } from '@/lib/utils'
import type { Initiative, InitiativeStatus } from '@/lib/types'

const MENU_W = 258
const SUB_W = 264

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
  danger,
}: {
  icon: ReactNode
  label: string
  hint?: string
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        rowCls,
        disabled && 'cursor-default text-faint hover:bg-transparent',
        danger && !disabled && 'hover:text-[var(--priority-urgent)]',
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

/** Module scope on purpose — see the same note on ProjectContextMenu's SubRow. */
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

/** The static half of a picker row — property, current value, then the ▸. */
function pickRow(icon: ReactNode, label: string, value?: string) {
  return (
    <span className={rowCls}>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {value && (
        <span className="whitespace-nowrap pl-2 text-[12px] text-muted">{value}</span>
      )}
      <ChevronRight size={13} className="ml-1 text-faint" />
    </span>
  )
}

/** Colored ring matching the initiative's lifecycle status. */
function StatusRing({ status }: { status: InitiativeStatus }) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border-2"
      style={{ borderColor: INITIATIVE_STATUS[status].color }}
    />
  )
}

/** Rename dialog — one field, Enter commits, Escape backs out. */
function RenameDialog({
  initiative,
  onClose,
}: {
  initiative: Initiative
  onClose: () => void
}) {
  const updateInitiative = useStore((s) => s.updateInitiative)
  const [name, setName] = useState(initiative.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const commit = () => {
    const next = name.trim()
    if (next && next !== initiative.name)
      updateInitiative(initiative.id, { name: next })
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/25 pt-[18vh]"
      onMouseDown={onClose}
    >
      <div
        className="w-[440px] rounded-lg border border-border bg-bg-elevated p-3 shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') onClose()
          }}
          className="w-full rounded-md border border-border bg-bg px-2.5 py-2 text-[14px] text-fg outline-none focus:border-accent"
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
            Rename
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Right-click / ⋯ menu for an initiative row. Before this the row had no
 * context menu at all — right-clicking it produced nothing.
 *
 * Shape follows ProjectContextMenu, which is Linear's own project-row menu, cut
 * down to the properties an `Initiative` actually has: Status ▸ · Owner ▸ ·
 * Target date… · Rename… · Copy ▸ · Move ▸ · Favorite · New update… · Archive ·
 * Delete. Linear's own initiative-row menu could not be read from the reference
 * workspace (it holds no initiatives, and creating one there is off limits), so
 * the exact row order is inferred rather than verified — recorded as such in
 * `.audit/controls/projects-initiatives.md`.
 *
 * Health is deliberately absent: it is derived from the newest initiative
 * update here, not a settable field, so there is nothing for a picker to write.
 */
export function InitiativeContextMenu({
  initiativeId,
  x,
  y,
  onClose,
  manualOrdering,
}: {
  initiativeId: string
  x: number
  y: number
  onClose: () => void
  /** Linear greys out Move ▸ unless the list is manually ordered. */
  manualOrdering: boolean
}) {
  const navigate = useNavigate()
  const store = useStore()
  const panelRef = useRef<HTMLDivElement>(null)
  const [sub, setSub] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [renaming, setRenaming] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Flip the panel back on screen near an edge; the flyout needs room on the
  // right, so the left clamp reserves MENU_W + SUB_W.
  const [pos, setPos] = useState({ top: y, left: x, sub: MENU_W - 4 })
  useLayoutEffect(() => {
    const h = panelRef.current?.offsetHeight ?? 380
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
            : 8 - (left + 4),
    })
  }, [x, y])

  const initiative = store.initiatives.find((i) => i.id === initiativeId)
  if (!initiative) return null

  const starred = store.favorites.some(
    (f) => f.type === 'initiative' && f.id === initiativeId,
  )
  const ordered = [...store.initiatives].sort((a, b) => a.sortOrder - b.sortOrder)
  const at = ordered.findIndex((i) => i.id === initiativeId)
  const isFirst = at <= 0
  const isLast = at === ordered.length - 1
  const url = `${window.location.origin}/initiative/${initiative.id}`

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  const statusOptions: SelectOption[] = INITIATIVE_STATUS_ORDER.map((s) => ({
    id: s,
    label: INITIATIVE_STATUS[s].label,
    icon: <StatusRing status={s} />,
    selected: s === initiative.status,
  }))

  const ownerOptions: SelectOption[] = [
    { id: '__none', label: 'No owner', selected: !initiative.ownerId },
    ...store.users.map((u) => ({
      id: u.id,
      label: u.name,
      icon: <Avatar user={u} size={16} />,
      selected: u.id === initiative.ownerId,
    })),
  ]

  return createPortal(
    <>
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${initiative.name}?`}
        description="This deletes the initiative and its updates. Its projects are kept and simply unlinked. It can't be undone."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          store.deleteInitiative(initiative.id)
          onClose()
        }}
      />
      {renaming && (
        <RenameDialog
          initiative={initiative}
          onClose={() => {
            setRenaming(false)
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
          {/* SelectMenu / DatePicker wrap their trigger in an inline-flex
              button, so left to themselves the picker rows sit side by side and
              wrap mid-menu. Stack them and let each take the full width. */}
          <div
            className="flex flex-col [&>button]:w-full"
            onMouseEnter={() => setSub(null)}
          >
            <SelectMenu
              options={statusOptions}
              onSelect={(id) => {
                store.updateInitiative(initiative.id, {
                  status: id as InitiativeStatus,
                })
                onClose()
              }}
              align="start"
              placeholder="Change initiative status…"
              trigger={pickRow(<StatusRing status={initiative.status} />, 'Status')}
            />
            <SelectMenu
              options={ownerOptions}
              onSelect={(id) => {
                store.updateInitiative(initiative.id, {
                  ownerId: id === '__none' ? undefined : id,
                })
                onClose()
              }}
              align="start"
              placeholder="Set initiative owner…"
              trigger={pickRow(
                initiative.ownerId ? (
                  <Avatar
                    user={store.users.find((u) => u.id === initiative.ownerId)}
                    size={16}
                  />
                ) : (
                  <User size={14} />
                ),
                'Owner',
              )}
            />
            <DatePicker
              value={initiative.targetDate}
              onChange={(iso) => {
                store.updateInitiative(initiative.id, { targetDate: iso })
                onClose()
              }}
              align="start"
              trigger={pickRow(
                <Calendar size={14} />,
                'Target date…',
                initiative.targetDate ? formatDate(initiative.targetDate) : undefined,
              )}
            />
            <Row
              icon={<Pencil size={14} />}
              label="Rename…"
              hint="⇧R"
              onClick={() => setRenaming(true)}
            />
          </div>

          <Divider />

          <SubRow
            id="copy"
            icon={<Clipboard size={14} />}
            label="Copy"
            open={sub === 'copy'}
            onOpen={setSub}
            offsetLeft={pos.sub}
          >
            <Row
              icon={<Link2 size={14} />}
              label="Copy URL"
              hint="⌘⇧,"
              onClick={run(() =>
                copyToClipboard(url, 'Initiative URL copied to clipboard'),
              )}
            />
            <Row
              icon={<Type size={14} />}
              label="Copy title"
              hint="⌘⇧'"
              onClick={run(() =>
                copyToClipboard(
                  initiative.name,
                  `"${initiative.name}" copied to clipboard`,
                ),
              )}
            />
            <Row
              icon={<Link2 size={14} />}
              label="Copy title as link"
              hint="⌘C"
              onClick={run(() =>
                copyToClipboard(
                  `[${initiative.name}](${url})`,
                  'Initiative link copied to clipboard',
                ),
              )}
            />
            <Row
              icon={<FileText size={14} />}
              label="Copy overview as Markdown"
              hint="⌘⌥C"
              onClick={run(() =>
                copyToClipboard(
                  `# ${initiative.name}\n\n${initiative.description ?? ''}`.trim(),
                  'Initiative overview copied to clipboard',
                ),
              )}
            />
          </SubRow>

          <SubRow
            id="move"
            icon={<Move size={14} />}
            label="Move"
            open={sub === 'move'}
            onOpen={setSub}
            offsetLeft={pos.sub}
          >
            <Row
              icon={<ArrowUpToLine size={14} />}
              label="Move to top"
              hint="⌥⇧↑"
              disabled={!manualOrdering || isFirst}
              onClick={run(() => store.moveInitiative(initiative.id, 'top'))}
            />
            <Row
              icon={<ArrowUp size={14} />}
              label="Move up"
              hint="⌥↑"
              disabled={!manualOrdering || isFirst}
              onClick={run(() => store.moveInitiative(initiative.id, 'up'))}
            />
            <Row
              icon={<ArrowDown size={14} />}
              label="Move down"
              hint="⌥↓"
              disabled={!manualOrdering || isLast}
              onClick={run(() => store.moveInitiative(initiative.id, 'down'))}
            />
            <Row
              icon={<ArrowDownToLine size={14} />}
              label="Move to bottom"
              hint="⌥⇧↓"
              disabled={!manualOrdering || isLast}
              onClick={run(() => store.moveInitiative(initiative.id, 'bottom'))}
            />
          </SubRow>

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
              onClick={run(() => store.toggleFavorite('initiative', initiative.id))}
            />
            <Row
              icon={<MessageSquarePlus size={14} />}
              label="New update…"
              hint="N then C"
              onClick={run(() => navigate(`/initiative/${initiative.id}?tab=updates`))}
            />
            <Divider />
            <Row
              icon={<Archive size={14} />}
              label={initiative.archivedAt ? 'Unarchive' : 'Archive'}
              onClick={run(() =>
                store.updateInitiative(initiative.id, {
                  archivedAt: initiative.archivedAt
                    ? undefined
                    : new Date().toISOString(),
                }),
              )}
            />
            <Row
              icon={<Trash2 size={14} />}
              label="Delete"
              danger
              onClick={() => setConfirmDelete(true)}
            />
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
