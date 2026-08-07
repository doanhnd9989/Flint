import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Bell,
  BellOff,
  Calendar,
  ChevronRight,
  Clipboard,
  Copy,
  FileText,
  Link2,
  MessageSquarePlus,
  Move,
  Pencil,
  Spline,
  Star,
  Trash2,
  Type,
  Users,
} from 'lucide-react'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { SelectMenu, type SelectOption } from './ui/SelectMenu'
import { DatePicker } from './DatePicker'
import { Avatar } from './Avatar'
import { PriorityIcon } from './PriorityIcon'
import { ProjectStatusIcon } from './ProjectStatusIcon'
import { useStore, useDisplayName } from '@/lib/store'
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  PROJECT_STATUS,
  PROJECT_STATUS_ORDER,
} from '@/lib/constants'
import { copyToClipboard } from '@/lib/toast'
import { cn, formatDate } from '@/lib/utils'
import type { Priority, Project, ProjectStatus } from '@/lib/types'

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

/** A plain action row. */
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

/**
 * A row that expands a flyout to the right on hover. Module scope on purpose:
 * declared inside the menu it would be a fresh component type on every render,
 * so each `sub` change remounted every row and the mouseenter that should have
 * moved the flyout was swallowed by the remount.
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
  /**
   * Where the flyout sits, in px relative to the row. Normally just past the
   * menu's right edge; the parent flips or clamps it when there's no room.
   */
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
 * The static half of a picker row — Linear draws the property name, its
 * current value (dates only), the shortcut hint, then the ▸ that says a flyout
 * lives here. Handed to SelectMenu / DatePicker as their trigger.
 */
function pickRow(icon: ReactNode, label: string, hint: string, value?: string) {
  return (
    <span className={rowCls}>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {value && (
        <span className="whitespace-nowrap pl-2 text-[12px] text-muted">{value}</span>
      )}
      <Hint>{hint}</Hint>
      <ChevronRight size={13} className="ml-1 text-faint" />
    </span>
  )
}

/**
 * Rename dialog — Linear's `Rename…` (⇧R) edits the project name without
 * leaving the list. One field: Enter commits, Escape backs out.
 */
function RenameDialog({
  project,
  onClose,
}: {
  project: Project
  onClose: () => void
}) {
  const updateProject = useStore((s) => s.updateProject)
  const [name, setName] = useState(project.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const commit = () => {
    const next = name.trim()
    if (next && next !== project.name) updateProject(project.id, { name: next })
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
 * Right-click / ⋯ menu for a project row, in Linear's order and wording:
 *
 *   Status ▸ · Priority ▸ · Project lead ▸ · Members ▸ · Start date… ·
 *   Target date… · Teams ▸ · More properties ▸ · Copy ▸ · Move ▸ ·
 *   Favorite · Subscribe · New comment… · Delete
 *
 * Linear's `Labels ▸`, its Jira / Slack / update-schedule entries under More
 * properties, and `Open in desktop app` are deliberately absent rather than
 * dead — none of them has a model or a target here. All logged in BACKLOG.md.
 */
export function ProjectContextMenu({
  projectId,
  x,
  y,
  onClose,
  manualOrdering,
}: {
  projectId: string
  x: number
  y: number
  onClose: () => void
  /** Linear greys out Move ▸ unless the list is manually ordered. */
  manualOrdering: boolean
}) {
  const navigate = useNavigate()
  const store = useStore()
  const fmt = useDisplayName()
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

  // Flip the panel back on screen when the row sits near an edge. The flyout
  // needs room to its right, so the left clamp reserves MENU_W + SUB_W.
  const [pos, setPos] = useState({ top: y, left: x, sub: MENU_W - 4 })
  useLayoutEffect(() => {
    const h = panelRef.current?.offsetHeight ?? 440
    const vw = window.innerWidth
    const left = Math.max(8, Math.min(x, vw - MENU_W - SUB_W - 16))
    // The flyout normally sits just past the menu's right edge. Rows carry the
    // panel's 4px padding, so offsets are measured from `left + 4`.
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

  const project = store.projects.find((p) => p.id === projectId)
  if (!project) return null

  const starred = store.favorites.some(
    (f) => f.type === 'project' && f.id === projectId,
  )
  const subscribed = (project.subscriberIds ?? []).includes(store.currentUserId)
  const ordered = [...store.projects].sort((a, b) => a.sortOrder - b.sortOrder)
  const at = ordered.findIndex((p) => p.id === projectId)
  const isFirst = at <= 0
  const isLast = at === ordered.length - 1
  const url = `${window.location.origin}/project/${project.id}`

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }


  const statusOptions: SelectOption[] = PROJECT_STATUS_ORDER.map((s) => ({
    id: s,
    label: PROJECT_STATUS[s].label,
    icon: <ProjectStatusIcon status={s} />,
    selected: s === project.status,
  }))

  const priorityOptions: SelectOption[] = PRIORITY_ORDER.map((p) => ({
    id: String(p),
    label: PRIORITY_LABELS[p],
    icon: <PriorityIcon priority={p} />,
    selected: (project.priority ?? 0) === p,
  }))

  const leadOptions: SelectOption[] = [
    { id: '__none', label: 'No lead', selected: !project.leadId },
    ...store.users.map((u) => ({
      id: u.id,
      label: fmt(u.name),
      icon: <Avatar user={u} />,
      selected: u.id === project.leadId,
    })),
  ]

  const memberOptions: SelectOption[] = store.users.map((u) => ({
    id: u.id,
    label: fmt(u.name),
    icon: <Avatar user={u} />,
    selected: project.memberIds.includes(u.id),
  }))

  const teamOptions: SelectOption[] = store.teams.map((t) => ({
    id: t.id,
    label: t.name,
    icon: <span className="text-[13px]">{t.icon}</span>,
    selected: project.teamIds.includes(t.id),
  }))

  const dependencyOptions: SelectOption[] = store.projects
    .filter((p) => p.id !== projectId)
    .map((p) => ({
      id: p.id,
      label: p.name,
      icon: <span className="text-[13px]">{p.icon}</span>,
      selected: (project.dependsOn ?? []).includes(p.id),
    }))

  /** Toggle an id in/out of a string[] project field. */
  const toggleIn = (field: 'memberIds' | 'teamIds', id: string) => {
    const cur = project[field]
    store.updateProject(project.id, {
      [field]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    })
  }

  return createPortal(
    <>
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${project.name}?`}
        description="This deletes the project along with its milestones and updates, and detaches its issues. It can't be undone."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          store.deleteProject(project.id)
          onClose()
        }}
      />
      {renaming && (
        <RenameDialog
          project={project}
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
          {/* Property pickers — click a row, its flyout opens. */}
          <div onMouseEnter={() => setSub(null)}>
            <SelectMenu
              options={statusOptions}
              onSelect={(id) => {
                store.updateProject(project.id, { status: id as ProjectStatus })
                onClose()
              }}
              align="start"
              placeholder="Change project status…"
              trigger={pickRow(
                <ProjectStatusIcon status={project.status} />,
                'Status',
                'P then S',
              )}
            />
            <SelectMenu
              options={priorityOptions}
              onSelect={(id) => {
                store.updateProject(project.id, { priority: Number(id) as Priority })
                onClose()
              }}
              align="start"
              placeholder="Set priority…"
              trigger={pickRow(
                <PriorityIcon priority={project.priority ?? 0} />,
                'Priority',
                'P then P',
              )}
            />
            <SelectMenu
              options={leadOptions}
              onSelect={(id) => {
                store.updateProject(project.id, {
                  leadId: id === '__none' ? undefined : id,
                })
                onClose()
              }}
              align="start"
              placeholder="Set project lead…"
              trigger={pickRow(
                <Avatar
                  user={store.users.find((u) => u.id === project.leadId)}
                  size={16}
                />,
                'Project lead',
                'P then A',
              )}
            />
            <SelectMenu
              options={memberOptions}
              onSelect={(id) => toggleIn('memberIds', id)}
              align="start"
              keepOpen
              placeholder="Add members…"
              trigger={pickRow(<Users size={14} />, 'Members', 'P then M')}
            />
            <DatePicker
              value={project.startDate}
              onChange={(iso) => {
                store.updateProject(project.id, { startDate: iso })
                onClose()
              }}
              align="start"
              trigger={pickRow(
                <Calendar size={14} />,
                'Start date…',
                '⌃⌥S',
                project.startDate ? formatDate(project.startDate) : undefined,
              )}
            />
            <DatePicker
              value={project.targetDate}
              onChange={(iso) => {
                store.updateProject(project.id, { targetDate: iso })
                onClose()
              }}
              align="start"
              trigger={pickRow(
                <Calendar size={14} />,
                'Target date…',
                '⌃⌥D',
                project.targetDate ? formatDate(project.targetDate) : undefined,
              )}
            />
            <SelectMenu
              options={teamOptions}
              onSelect={(id) => toggleIn('teamIds', id)}
              align="start"
              keepOpen
              placeholder="Add teams…"
              trigger={pickRow(<Users size={14} />, 'Teams', 'P then T')}
            />
          </div>

          <Divider />

          <SubRow
            id="more"
            icon={<Copy size={14} />}
            label="More properties"
            open={sub === 'more'}
            onOpen={setSub}
            offsetLeft={pos.sub}
          >
            <div onMouseEnter={(e) => e.stopPropagation()}>
              <SelectMenu
                options={dependencyOptions}
                onSelect={(id) => {
                  if ((project.dependsOn ?? []).includes(id)) {
                    store.removeProjectDependency(project.id, id)
                  } else {
                    store.addProjectDependency(project.id, id)
                  }
                }}
                align="start"
                keepOpen
                placeholder="Blocked by…"
                trigger={
                  <span className={rowCls}>
                    <span className="flex h-4 w-4 items-center justify-center text-faint">
                      <Spline size={14} />
                    </span>
                    <span className="flex-1">Dependencies</span>
                    <ChevronRight size={13} className="text-faint" />
                  </span>
                }
              />
              <Row
                icon={<Pencil size={14} />}
                label="Rename…"
                hint="⇧R"
                onClick={() => setRenaming(true)}
              />
            </div>
          </SubRow>

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
                copyToClipboard(url, 'Project URL copied to clipboard'),
              )}
            />
            <Row
              icon={<Type size={14} />}
              label="Copy title"
              hint="⌘⇧'"
              onClick={run(() =>
                copyToClipboard(project.name, `"${project.name}" copied to clipboard`),
              )}
            />
            <Row
              icon={<Link2 size={14} />}
              label="Copy title as link"
              hint="⌘C"
              onClick={run(() =>
                copyToClipboard(
                  `[${project.name}](${url})`,
                  'Project link copied to clipboard',
                ),
              )}
            />
            <Row
              icon={<FileText size={14} />}
              label="Copy overview as Markdown"
              hint="⌘⌥C"
              onClick={run(() =>
                copyToClipboard(
                  `# ${project.name}\n\n${project.readme ?? project.description ?? ''}`.trim(),
                  'Project overview copied to clipboard',
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
            {/* Linear greys these out whenever the list isn't manually ordered. */}
            <Row
              icon={<ArrowUpToLine size={14} />}
              label="Move to top"
              hint="⌥⇧↑"
              disabled={!manualOrdering || isFirst}
              onClick={run(() => store.moveProject(project.id, 'top'))}
            />
            <Row
              icon={<ArrowUp size={14} />}
              label="Move up"
              hint="⌥↑"
              disabled={!manualOrdering || isFirst}
              onClick={run(() => store.moveProject(project.id, 'up'))}
            />
            <Row
              icon={<ArrowDown size={14} />}
              label="Move down"
              hint="⌥↓"
              disabled={!manualOrdering || isLast}
              onClick={run(() => store.moveProject(project.id, 'down'))}
            />
            <Row
              icon={<ArrowDownToLine size={14} />}
              label="Move to bottom"
              hint="⌥⇧↓"
              disabled={!manualOrdering || isLast}
              onClick={run(() => store.moveProject(project.id, 'bottom'))}
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
              onClick={run(() => store.toggleFavorite('project', project.id))}
            />
            <Row
              icon={subscribed ? <BellOff size={14} /> : <Bell size={14} />}
              label={subscribed ? 'Unsubscribe' : 'Subscribe'}
              hint="⇧S"
              onClick={run(() =>
                store.toggleProjectSubscriber(project.id, store.currentUserId),
              )}
            />
            <Row
              icon={<MessageSquarePlus size={14} />}
              label="New comment…"
              hint="N then C"
              onClick={run(() => navigate(`/project/${project.id}?tab=updates`))}
            />
            <Divider />
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
