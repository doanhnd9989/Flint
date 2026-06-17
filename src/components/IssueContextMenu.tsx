import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import {
  StatusPicker,
  PriorityPicker,
  AssigneePicker,
  LabelPicker,
} from './pickers'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { PRIORITY_LABELS } from '@/lib/constants'
import { ChevronRight, Tag, Copy, Maximize2, Trash2, PanelRight, Link2, GitBranch } from 'lucide-react'
import { branchName, issueUrl } from '@/lib/utils'
import type { ReactNode } from 'react'

const MENU_W = 220

const rowCls =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

function ActionRow({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode
  label: string
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
      <span className="flex-1">{label}</span>
    </button>
  )
}

/** Right-click menu for an issue row. Reuses the property pickers as sub-menus. */
export function IssueContextMenu() {
  const navigate = useNavigate()
  const store = useStore()
  const ctx = store.contextMenu
  const issue = store.issues.find((i) => i.id === ctx?.issueId)

  useEffect(() => {
    if (!ctx) return
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
  const me = store.users.find((u) => u.isMe)
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text)
    close()
  }

  const left = Math.min(ctx.x, window.innerWidth - MENU_W - 8)
  const top = Math.min(ctx.y, window.innerHeight - 320)

  const subRow = (icon: ReactNode, label: string, value: string) => (
    <span className={rowCls}>
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="max-w-24 truncate text-[12px] text-faint">{value}</span>
      <ChevronRight size={13} className="text-faint" />
    </span>
  )

  return createPortal(
    <div className="fixed inset-0 z-50" onMouseDown={close} onContextMenu={(e) => { e.preventDefault(); close() }}>
      <div
        className="absolute rounded-lg border border-border bg-bg-elevated p-1 shadow-lg animate-pop"
        style={{ top, left, width: MENU_W }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <StatusPicker
          stateId={issue.stateId}
          onChange={(id) => { store.setIssueStatus(issue.id, id); close() }}
          align="start"
          trigger={subRow(<StatusIcon type={state.type} color={state.color} />, 'Status', state.name)}
        />
        <PriorityPicker
          priority={issue.priority}
          onChange={(p) => { store.setIssuePriority(issue.id, p); close() }}
          align="start"
          trigger={subRow(<PriorityIcon priority={issue.priority} />, 'Priority', PRIORITY_LABELS[issue.priority])}
        />
        <AssigneePicker
          assigneeId={issue.assigneeId}
          onChange={(id) => { store.setIssueAssignee(issue.id, id); close() }}
          align="start"
          trigger={subRow(<Avatar user={assignee} size={16} />, 'Assignee', assignee?.name ?? 'Unassigned')}
        />
        <LabelPicker
          labelIds={issue.labelIds}
          onToggle={(id) => store.toggleIssueLabel(issue.id, id)}
          align="start"
          trigger={subRow(<Tag size={14} className="text-faint" />, 'Labels', issue.labelIds.length ? `${issue.labelIds.length}` : 'None')}
        />

        <div className="my-1 h-px bg-border" />

        <ActionRow icon={<PanelRight size={14} />} label="Open in peek" onClick={() => { store.setPeek(issue.id); close() }} />
        <ActionRow icon={<Maximize2 size={14} />} label="Open full page" onClick={() => { close(); navigate(`/issue/${issue.identifier}`) }} />
        <ActionRow icon={<Copy size={14} />} label="Copy issue ID" onClick={() => copy(issue.identifier)} />
        <ActionRow icon={<Link2 size={14} />} label="Copy issue URL" onClick={() => copy(issueUrl(issue.identifier))} />
        <ActionRow icon={<GitBranch size={14} />} label="Copy git branch name" onClick={() => copy(branchName(issue.identifier, issue.title, me))} />

        <div className="my-1 h-px bg-border" />

        <ActionRow icon={<Trash2 size={14} />} label="Delete" danger onClick={() => { store.deleteIssue(issue.id); close() }} />
      </div>
    </div>,
    document.body,
  )
}
