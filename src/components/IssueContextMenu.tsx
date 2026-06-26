import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import {
  StatusPicker,
  PriorityPicker,
  AssigneePicker,
  LabelPicker,
  ProjectPicker,
} from './pickers'
import { DatePicker } from './DatePicker'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import {
  ChevronRight,
  Tag,
  Calendar,
  Box,
  Copy,
  Link2,
  GitBranch,
  GitFork,
  GitBranchPlus,
  CopyPlus,
  CornerLeftUp,
  CircleSlash,
  Ban,
  Spline,
  ArrowRightLeft,
  Star,
  Bell,
  BellOff,
  Archive,
  ArchiveRestore,
  ArrowUpFromLine,
  Trash2,
} from 'lucide-react'
import type { RelationPickerKind } from '@/lib/types'
import { branchName, issueUrl } from '@/lib/utils'
import { copyToClipboard, copyToast } from '@/lib/toast'

const MENU_W = 232
const SUB_W = 220

const rowCls =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

function Hint({ children }: { children: ReactNode }) {
  return <span className="ml-auto pl-3 text-[12px] tracking-wide text-faint">{children}</span>
}

function ActionRow({
  icon,
  label,
  hint,
  onClick,
  danger,
}: {
  icon: ReactNode
  label: string
  hint?: ReactNode
  onClick: () => void
  danger?: boolean
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
 * Right-click menu for an issue row — reproduces Linear's list-row context menu
 * 1:1: the property pickers up top (Status / Priority / Assignee / Due date /
 * Labels / Project), then the **More properties**, **Create related**, **Mark
 * as** and **Copy** flyouts, then Favorite / Subscribe / Delete. Property rows
 * open the shared pickers; the relation flyouts reuse the same store surfaces as
 * the ⋯ issue-options menu so both stay in lockstep.
 */
export function IssueContextMenu() {
  const navigate = useNavigate()
  const store = useStore()
  const [sub, setSub] = useState<string | null>(null)
  const ctx = store.contextMenu
  const issue = store.issues.find((i) => i.id === ctx?.issueId)

  useEffect(() => {
    if (!ctx) return
    setSub(null)
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') store.closeContextMenu()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ctx, store])

  if (!ctx || !issue) return null

  const close = () => store.closeContextMenu()
  const state = store.states.find((s) => s.id === issue.stateId)!
  const assignee = store.users.find((u) => u.id === issue.assigneeId)
  const project = store.projects.find((p) => p.id === issue.projectId)
  const me = store.users.find((u) => u.isMe)
  const starred = store.favorites.some((f) => f.type === 'issue' && f.id === issue.id)
  const subscribed = issue.subscriberIds.includes(store.currentUserId)

  const copy = (text: string, message: string) => {
    copyToClipboard(text, message)
    close()
  }

  // Create a fresh issue (same team/project) and link it to the current one.
  const createRelated = (title: string, link: (newId: string) => void) => {
    const created = store.createIssue({
      title,
      teamId: issue.teamId,
      projectId: issue.projectId,
    })
    link(created.id)
    close()
    navigate(`/issue/${created.identifier}`)
  }

  // "Mark as" opens the shared centered relation picker (Linear's behavior).
  const markAs = (label: string, kind: RelationPickerKind) => (
    <ActionRow
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

  const left = Math.min(ctx.x, window.innerWidth - MENU_W - SUB_W - 16)
  const top = Math.min(ctx.y, window.innerHeight - 460)

  // A property row that opens one of the shared pickers (click-to-open).
  const pickRow = (icon: ReactNode, label: string, hint: string) => (
    <span className={rowCls}>
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      <Hint>{hint}</Hint>
      <ChevronRight size={13} className="text-faint" />
    </span>
  )

  // A row that expands a flyout panel to the right on hover.
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

  return createPortal(
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
        className="absolute rounded-lg border border-border bg-bg-elevated p-1 shadow-lg animate-pop"
        style={{ top, left, width: MENU_W }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Property pickers — click a row to open the shared picker flyout. */}
        <div onMouseEnter={() => setSub(null)}>
          <StatusPicker
            stateId={issue.stateId}
            onChange={(id) => { store.setIssueStatus(issue.id, id); close() }}
            align="start"
            trigger={pickRow(<StatusIcon type={state.type} color={state.color} />, 'Status', 'S')}
          />
          <PriorityPicker
            priority={issue.priority}
            onChange={(p) => { store.setIssuePriority(issue.id, p); close() }}
            align="start"
            trigger={pickRow(<PriorityIcon priority={issue.priority} />, 'Priority', 'P')}
          />
          <AssigneePicker
            assigneeId={issue.assigneeId}
            onChange={(id) => { store.setIssueAssignee(issue.id, id); close() }}
            align="start"
            trigger={pickRow(<Avatar user={assignee} size={16} />, 'Assignee', 'A')}
          />
          <DatePicker
            value={issue.dueDate}
            onChange={(iso) => { store.setIssueDueDate(issue.id, iso); close() }}
            align="start"
            trigger={pickRow(<Calendar size={14} className="text-faint" />, 'Due date', '⇧D')}
          />
          <LabelPicker
            labelIds={issue.labelIds}
            onToggle={(id) => store.toggleIssueLabel(issue.id, id)}
            align="start"
            trigger={pickRow(<Tag size={14} className="text-faint" />, 'Labels', 'L')}
          />
          <ProjectPicker
            projectId={issue.projectId}
            onChange={(id) => { store.setIssueProject(issue.id, id); close() }}
            align="start"
            trigger={pickRow(
              project ? <span className="text-[13px] leading-none">{project.icon}</span> : <Box size={14} className="text-faint" />,
              'Project',
              '⇧P',
            )}
          />
        </div>

        <SubRow id="more" icon={<Link2 size={14} />} label="More properties">
          <ActionRow
            icon={<Link2 size={14} />}
            label="Add link…"
            hint="Ctrl L"
            onClick={() => { close(); store.openLinkModal(issue.id) }}
          />
        </SubRow>

        <div className="my-1 h-px bg-border" />

        <SubRow id="create" icon={<GitFork size={14} />} label="Create related">
          <ActionRow
            icon={<CopyPlus size={14} />}
            label="Issue…"
            onClick={() => createRelated('New issue', (id) => store.addRelation(issue.id, id, 'related'))}
          />
          <ActionRow
            icon={<GitBranchPlus size={14} />}
            label="Sub-issue…"
            hint="⌘⇧O"
            onClick={() => createRelated('New sub-issue', (id) => store.setIssueParent(id, issue.id))}
          />
          <ActionRow
            icon={<CornerLeftUp size={14} />}
            label="Parent issue…"
            onClick={() => createRelated('New issue', (id) => store.setIssueParent(issue.id, id))}
          />
          <ActionRow
            icon={<CircleSlash size={14} />}
            label="Blocked issue…"
            onClick={() => createRelated('New issue', (id) => store.addRelation(issue.id, id, 'blocks'))}
          />
          <ActionRow
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
          <ActionRow
            icon={<Copy size={14} />}
            label="Copy issue ID"
            hint="⌘."
            onClick={() => copy(issue.identifier, copyToast.id(issue.identifier))}
          />
          <ActionRow
            icon={<Link2 size={14} />}
            label="Copy issue URL"
            hint="⌘⇧,"
            onClick={() => copy(issueUrl(issue.identifier), copyToast.url())}
          />
          <ActionRow
            icon={<GitBranch size={14} />}
            label="Copy git branch name"
            hint="⌘⇧."
            onClick={() => copy(branchName(issue.identifier, issue.title, me), copyToast.branch())}
          />
        </SubRow>

        <div className="my-1 h-px bg-border" />

        <ActionRow
          icon={<Star size={14} fill={starred ? 'currentColor' : 'none'} className={starred ? 'text-[var(--status-started)]' : ''} />}
          label={starred ? 'Unfavorite' : 'Favorite'}
          hint="⌥F"
          onClick={() => { store.toggleFavorite('issue', issue.id); close() }}
        />
        <ActionRow
          icon={subscribed ? <BellOff size={14} /> : <Bell size={14} />}
          label={subscribed ? 'Unsubscribe' : 'Subscribe'}
          hint="⇧S"
          onClick={() => { store.toggleIssueSubscriber(issue.id, store.currentUserId); close() }}
        />

        <div className="my-1 h-px bg-border" />

        <ActionRow
          icon={<CopyPlus size={14} />}
          label="Duplicate"
          onClick={() => {
            const dupe = store.duplicateIssue(issue.id)
            close()
            if (dupe) navigate(`/issue/${dupe.identifier}`)
          }}
        />
        {issue.parentId && (
          <ActionRow
            icon={<ArrowUpFromLine size={14} />}
            label="Convert to issue"
            onClick={() => { store.setIssueParent(issue.id, undefined); close() }}
          />
        )}
        {issue.archivedAt ? (
          <ActionRow
            icon={<ArchiveRestore size={14} />}
            label="Restore from archive"
            onClick={() => { store.unarchiveIssue(issue.id); close() }}
          />
        ) : (
          <ActionRow
            icon={<Archive size={14} />}
            label="Archive"
            onClick={() => { store.archiveIssue(issue.id); close() }}
          />
        )}
        <ActionRow
          icon={<Trash2 size={14} />}
          label="Delete"
          hint="⌘⌫"
          danger
          onClick={() => { store.deleteIssue(issue.id); close() }}
        />
      </div>
    </div>,
    document.body,
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
