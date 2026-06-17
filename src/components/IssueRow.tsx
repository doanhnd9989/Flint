import { useEffect, useRef } from 'react'
import { CalendarClock, Diamond, Link2 } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { StatusPicker, PriorityPicker, AssigneePicker } from './pickers'
import { ProgressDonut } from './ProgressDonut'
import { cn, formatDate, isDueSoon, isOverdue } from '@/lib/utils'

export function IssueRow({
  issue,
  showStatus = true,
}: {
  issue: Issue
  showStatus?: boolean
}) {
  const {
    states, users, labels, issues, projects, milestones, issueLinks, displayProperties, selectedIssueIds, focusedIssueId,
    setIssueStatus, setIssuePriority, setIssueAssignee, setPeek, toggleSelectIssue, setFocusedIssue, openContextMenu,
  } = useStoreShallow((s) => ({
    states: s.states,
    users: s.users,
    labels: s.labels,
    issues: s.issues,
    projects: s.projects,
    milestones: s.milestones,
    issueLinks: s.issueLinks,
    displayProperties: s.displayProperties,
    selectedIssueIds: s.selectedIssueIds,
    focusedIssueId: s.focusedIssueId,
    setIssueStatus: s.setIssueStatus,
    setIssuePriority: s.setIssuePriority,
    setIssueAssignee: s.setIssueAssignee,
    setPeek: s.setPeek,
    toggleSelectIssue: s.toggleSelectIssue,
    setFocusedIssue: s.setFocusedIssue,
    openContextMenu: s.openContextMenu,
  }))
  const dp = displayProperties

  const selected = selectedIssueIds.includes(issue.id)
  const anySelected = selectedIssueIds.length > 0
  const focused = focusedIssueId === issue.identifier

  // Keep the keyboard-focused row scrolled into view as `j`/`k` walk the list.
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focused) rowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [focused])

  const state = states.find((s) => s.id === issue.stateId)
  const assignee = users.find((u) => u.id === issue.assigneeId)
  const project = projects.find((p) => p.id === issue.projectId)
  const milestone = milestones.find((m) => m.id === issue.milestoneId)
  const issueLabels = issue.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter(Boolean)
  const linkCount = issueLinks.filter((l) => l.issueId === issue.id).length
  const children = issues.filter((i) => i.parentId === issue.id)
  const childDone = children.filter((i) => {
    const st = states.find((s) => s.id === i.stateId)
    return st?.type === 'completed'
  }).length
  const childPercent = children.length
    ? Math.round((childDone / children.length) * 100)
    : 0

  return (
    <div
      ref={rowRef}
      data-issue-focus={issue.identifier}
      onClick={() => setPeek(issue.id)}
      onMouseEnter={() => setFocusedIssue(issue.identifier)}
      onContextMenu={(e) => {
        e.preventDefault()
        openContextMenu(issue.id, e.clientX, e.clientY)
      }}
      className={cn(
        'group flex cursor-pointer items-center gap-2 px-4 py-1.5 border-b border-border/40',
        selected
          ? 'bg-accent-subtle'
          : focused
            ? 'bg-bg-hover'
            : 'hover:bg-bg-hover',
        focused && 'ring-1 ring-inset ring-border-strong',
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          toggleSelectIssue(issue.id)
        }}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-opacity',
          selected
            ? 'border-accent bg-accent text-white opacity-100'
            : 'border-border-strong opacity-0 group-hover:opacity-100',
          (anySelected || focused) && 'opacity-100',
        )}
        title="Select"
      >
        {selected && (
          <svg width="11" height="11" viewBox="0 0 16 16">
            <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {dp.priority && (
        <PriorityPicker
          priority={issue.priority}
          onChange={(p) => setIssuePriority(issue.id, p)}
          trigger={
            <span className="flex h-5 w-5 items-center justify-center rounded hover:bg-bg-selected">
              <PriorityIcon priority={issue.priority} />
            </span>
          }
        />
      )}

      {dp.id && (
        <span className="w-14 shrink-0 font-mono text-[12px] text-faint">
          {issue.identifier}
        </span>
      )}

      {dp.status && showStatus && state && (
        <StatusPicker
          stateId={issue.stateId}
          onChange={(id) => setIssueStatus(issue.id, id)}
          trigger={
            <span className="flex h-5 w-5 items-center justify-center rounded hover:bg-bg-selected">
              <StatusIcon type={state.type} color={state.color} />
            </span>
          }
        />
      )}

      <span className="flex-1 truncate text-[13px] text-fg">{issue.title}</span>

      <div className="flex items-center gap-1.5 shrink-0">
        {children.length > 0 && (
          <span
            className="flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-[11px] text-muted"
            title={`${childDone}/${children.length} sub-issues done`}
          >
            <ProgressDonut percent={childPercent} />
            {childDone}/{children.length}
          </span>
        )}
        {dp.dueDate && issue.dueDate && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-[11px]',
              isOverdue(issue.dueDate)
                ? 'text-[var(--priority-urgent)]'
                : isDueSoon(issue.dueDate)
                  ? 'text-[var(--status-started)]'
                  : 'text-faint',
            )}
          >
            <CalendarClock size={11} />
            {formatDate(issue.dueDate)}
          </span>
        )}
        {dp.project && project && (
          <span className="flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-[11px] text-muted">
            <span className="text-[10px] leading-none">{project.icon}</span>
            {project.name}
          </span>
        )}
        {dp.milestone && milestone && (
          <span className="flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-[11px] text-muted">
            <Diamond size={9} />
            {milestone.name}
          </span>
        )}
        {dp.labels && issueLabels.length > 0 && (
          <div className="hidden items-center gap-1 sm:flex">
            {issueLabels.slice(0, 3).map((l) => (
              <span
                key={l!.id}
                className="flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-[11px] text-muted"
              >
                <LabelDot color={l!.color} />
                {l!.name}
              </span>
            ))}
          </div>
        )}
        {dp.links && linkCount > 0 && (
          <span
            className="flex items-center gap-0.5 text-[11px] text-faint"
            title={`${linkCount} link${linkCount > 1 ? 's' : ''}`}
          >
            <Link2 size={11} />
            {linkCount}
          </span>
        )}
        {dp.created && (
          <span className="w-10 text-right text-[11px] text-faint">
            {formatDate(issue.createdAt)}
          </span>
        )}
        {dp.updated && (
          <span className="w-10 text-right text-[11px] text-faint">
            {formatDate(issue.updatedAt)}
          </span>
        )}
        {dp.assignee && (
          <AssigneePicker
            assigneeId={issue.assigneeId}
            onChange={(id) => setIssueAssignee(issue.id, id)}
            align="end"
            trigger={
              <span className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-bg-selected">
                <Avatar user={assignee} size={20} />
              </span>
            }
          />
        )}
      </div>
    </div>
  )
}
