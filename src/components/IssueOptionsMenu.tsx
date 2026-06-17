import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '@/lib/store'
import type { Issue, RelationPickerKind } from '@/lib/types'
import { branchName, issueUrl } from '@/lib/utils'
import { copyToClipboard, copyToast } from '@/lib/toast'
import {
  MoreHorizontal,
  Link2,
  ChevronRight,
  GitBranchPlus,
  CopyPlus,
  CornerLeftUp,
  CircleSlash,
  Ban,
  GitBranch,
  Spline,
  Copy,
  Star,
  Bell,
  BellOff,
  Trash2,
  ArrowRightLeft,
  GitFork,
} from 'lucide-react'

const MENU_W = 232
const SUB_W = 220

const rowCls =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

function Hint({ children }: { children: ReactNode }) {
  return <span className="ml-auto pl-3 text-[12px] tracking-wide text-faint">{children}</span>
}

function Row({
  icon,
  label,
  hint,
  danger,
  onClick,
}: {
  icon: ReactNode
  label: string
  hint?: ReactNode
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${rowCls} ${danger ? 'hover:text-[var(--priority-urgent)]' : ''}`}
    >
      <span className="flex h-4 w-4 items-center justify-center text-faint">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {hint && <Hint>{hint}</Hint>}
    </button>
  )
}

/**
 * Linear's issue ⋯ ("Issue options") header menu. Reproduces the two relation
 * submenus 1:1 — **Create related** (creates a new, linked issue) and **Mark
 * as** (links an existing issue) — plus Add link / Copy / Favorite / Subscribe
 * / Delete. Shared by the full-page detail and the peek panel.
 */
export function IssueOptionsMenu({
  issue,
  onOpenIssue,
  onDeleted,
}: {
  issue: Issue
  /** Open another issue (navigate on detail, re-peek in the panel). */
  onOpenIssue: (identifier: string) => void
  /** Called after the issue is deleted (navigate back / close peek). */
  onDeleted: () => void
}) {
  const store = useStore()
  const [open, setOpen] = useState(false)
  const [sub, setSub] = useState<string | null>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    setPos({
      top: Math.min(r.bottom + 4, window.innerHeight - 8),
      left: Math.min(r.left, window.innerWidth - MENU_W - SUB_W - 16),
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Consume Escape so an enclosing peek panel doesn't also close.
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  const close = () => {
    setOpen(false)
    setSub(null)
  }

  const me = store.users.find((u) => u.isMe)
  const starred = store.favorites.some((f) => f.type === 'issue' && f.id === issue.id)
  const subscribed = issue.subscriberIds.includes(store.currentUserId)

  // Create a fresh issue (same team/project) and run a linker against it.
  const createRelated = (title: string, link: (newId: string) => void) => {
    const created = store.createIssue({
      title,
      teamId: issue.teamId,
      projectId: issue.projectId,
    })
    link(created.id)
    close()
    onOpenIssue(created.identifier)
  }

  // "Mark as" opens the shared centered relation picker (Linear's behavior),
  // so the ⋯ menu and the M-chord / ⌘⇧P shortcuts share one surface.
  const markAs = (label: string, kind: RelationPickerKind) => (
    <Row
      key={kind}
      icon={MARK_ICONS[label]}
      label={`${label}…`}
      hint={MARK_HINTS[label]}
      onClick={() => {
        close()
        store.openRelationPicker(issue.id, kind)
      }}
    />
  )

  const copy = (text: string, message: string) => {
    copyToClipboard(text, message)
    close()
  }

  /** A top-level row that expands a flyout panel to the right on hover. */
  const SubRow = ({
    id,
    icon,
    label,
    children,
  }: {
    id: string
    icon: ReactNode
    label: string
    children: ReactNode
  }) => (
    <div className="relative" onMouseEnter={() => setSub(id)}>
      <div className={`${rowCls} ${sub === id ? 'bg-bg-hover' : ''}`}>
        <span className="flex h-4 w-4 items-center justify-center text-faint">{icon}</span>
        <span className="flex-1">{label}</span>
        <ChevronRight size={14} className="text-faint" />
      </div>
      {sub === id && (
        <div
          className="absolute left-full top-[-5px] z-50 ml-1 rounded-lg border border-border bg-bg-elevated p-1 shadow-lg animate-pop"
          style={{ width: SUB_W }}
        >
          {children}
        </div>
      )}
    </div>
  )

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        title="Issue options"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover hover:text-fg"
      >
        <MoreHorizontal size={15} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            data-overlay
            className="fixed inset-0 z-50"
            onMouseDown={close}
            onContextMenu={(e) => {
              e.preventDefault()
              close()
            }}
          >
            <div
              ref={menuRef}
              className="absolute rounded-lg border border-border bg-bg-elevated p-1 shadow-lg animate-pop"
              style={{ top: pos.top, left: pos.left, width: MENU_W }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Row
                icon={<Link2 size={14} />}
                label="Add link…"
                hint="Ctrl L"
                onClick={() => {
                  close()
                  store.openLinkModal(issue.id)
                }}
              />

              <div className="my-1 h-px bg-border" />

              <SubRow id="create" icon={<GitFork size={14} />} label="Create related">
                <Row
                  icon={<CopyPlus size={14} />}
                  label="Issue…"
                  onClick={() => createRelated('New issue', (id) => store.addRelation(issue.id, id, 'related'))}
                />
                <Row
                  icon={<GitBranchPlus size={14} />}
                  label="Sub-issue…"
                  hint="⌘⇧O"
                  onClick={() => createRelated('New sub-issue', (id) => store.setIssueParent(id, issue.id))}
                />
                <Row
                  icon={<CornerLeftUp size={14} />}
                  label="Parent issue…"
                  onClick={() => createRelated('New issue', (id) => store.setIssueParent(issue.id, id))}
                />
                <Row
                  icon={<CircleSlash size={14} />}
                  label="Blocked issue…"
                  onClick={() => createRelated('New issue', (id) => store.addRelation(issue.id, id, 'blocks'))}
                />
                <Row
                  icon={<Ban size={14} />}
                  label="Blocking issue…"
                  onClick={() => createRelated('New issue', (id) => store.addRelation(id, issue.id, 'blocks'))}
                />
              </SubRow>

              <SubRow id="mark" icon={<ArrowRightLeft size={14} />} label="Mark as">
                {markAs('Parent of', 'parentOf')}
                {markAs('Sub-issue of', 'subIssueOf')}
                {markAs('Related to', 'related')}
                {markAs('Blocked by', 'blockedBy')}
                {markAs('Blocking', 'blocking')}
                {markAs('Duplicate of', 'duplicateOf')}
              </SubRow>

              <div className="my-1 h-px bg-border" />

              <SubRow id="copy" icon={<Copy size={14} />} label="Copy">
                <Row
                  icon={<Copy size={14} />}
                  label="Copy issue ID"
                  onClick={() => copy(issue.identifier, copyToast.id(issue.identifier))}
                />
                <Row
                  icon={<Link2 size={14} />}
                  label="Copy issue URL"
                  onClick={() => copy(issueUrl(issue.identifier), copyToast.url())}
                />
                <Row
                  icon={<GitBranch size={14} />}
                  label="Copy git branch name"
                  onClick={() => copy(branchName(issue.identifier, issue.title, me), copyToast.branch())}
                />
              </SubRow>

              <div className="my-1 h-px bg-border" />

              <Row
                icon={<Star size={14} fill={starred ? 'currentColor' : 'none'} className={starred ? 'text-[var(--status-started)]' : ''} />}
                label={starred ? 'Unfavorite' : 'Favorite'}
                hint="⌥F"
                onClick={() => {
                  store.toggleFavorite('issue', issue.id)
                  close()
                }}
              />
              <Row
                icon={subscribed ? <BellOff size={14} /> : <Bell size={14} />}
                label={subscribed ? 'Unsubscribe' : 'Subscribe'}
                hint="⇧S"
                onClick={() => {
                  store.toggleIssueSubscriber(issue.id, store.currentUserId)
                  close()
                }}
              />

              <div className="my-1 h-px bg-border" />

              <Row
                icon={<Trash2 size={14} />}
                label="Delete"
                hint="⌘⌫"
                danger
                onClick={() => {
                  close()
                  store.deleteIssue(issue.id)
                  onDeleted()
                }}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

const MARK_ICONS: Record<string, ReactNode> = {
  'Parent of': <CornerLeftUp size={14} />,
  'Sub-issue of': <GitBranch size={14} />,
  'Related to': <Spline size={14} />,
  'Blocked by': <CircleSlash size={14} />,
  Blocking: <Ban size={14} />,
  'Duplicate of': <Copy size={14} />,
}

const MARK_HINTS: Record<string, string> = {
  'Sub-issue of': '⌘⇧P',
  'Related to': 'M R',
  'Blocked by': 'M B',
  Blocking: 'M X',
  'Duplicate of': 'M M',
}
