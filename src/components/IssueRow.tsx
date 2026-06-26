import { useEffect, useRef } from 'react'
import { CalendarClock, ChevronRight, CircleSlash, Clock, Diamond, IterationCw, Link2, MessageSquare, Gauge } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { estimateLabel, teamEstimationType } from '@/lib/constants'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { StatusPicker, PriorityPicker, AssigneePicker } from './pickers'
import { ProgressDonut } from './ProgressDonut'
import { IssueRowActions } from './IssueRowActions'
import { cn, formatDate, isDueSoon, isOverdue, timeAgo } from '@/lib/utils'

// The last row whose checkbox was toggled (an issue identifier) — anchors
// shift-click range selection, exactly like Linear's list.
let lastSelectedIdentifier: string | null = null

/**
 * Tiny block indicator for a list row — mirrors the board card, marking issues
 * that participate in a 'blocks' relation. A red-tinted slash means the issue
 * is blocked by others (it's the target of a blocks relation); a muted slash
 * means it blocks others. Renders nothing when there are no such relations.
 */
function BlockIndicator({ issue }: { issue: Issue }) {
  const relations = useStore((s) => s.relations)
  // 'blocks': fromIssue blocks toIssue → this issue is blocked when it's the
  // toIssue, and blocks others when it's the fromIssue.
  const blockedBy = relations.filter(
    (r) => r.type === 'blocks' && r.toIssueId === issue.id,
  ).length
  const blocking = relations.filter(
    (r) => r.type === 'blocks' && r.fromIssueId === issue.id,
  ).length
  if (blockedBy === 0 && blocking === 0) return null
  // Blocked-by takes visual priority (red); otherwise it's a muted "blocking".
  const title =
    blockedBy > 0
      ? `Blocked by ${blockedBy} issue${blockedBy > 1 ? 's' : ''}`
      : `Blocking ${blocking} issue${blocking > 1 ? 's' : ''}`
  return (
    <span title={title} className="flex items-center text-faint">
      <CircleSlash size={13} color={blockedBy > 0 ? '#eb5757' : undefined} />
    </span>
  )
}

export function IssueRow({
  issue,
  showStatus = true,
  depth = 0,
  expand,
}: {
  issue: Issue
  showStatus?: boolean
  /** Indent level when rendered as a nested sub-issue. */
  depth?: number
  /** When set (nested-sub-issues mode), renders a disclosure-chevron gutter. */
  expand?: { hasChildren: boolean; expanded: boolean; onToggle: () => void }
}) {
  const {
    states, users, labels, issues, projects, milestones, cycles, teams, issueLinks, comments, activities, displayProperties, selectedIssueIds, focusedIssueId, navIssueIds,
    setIssueStatus, setIssuePriority, setIssueAssignee, setPeek, toggleSelectIssue, setSelectedIssues, setFocusedIssue, openContextMenu,
  } = useStoreShallow((s) => ({
    states: s.states,
    users: s.users,
    labels: s.labels,
    issues: s.issues,
    projects: s.projects,
    milestones: s.milestones,
    cycles: s.cycles,
    teams: s.teams,
    issueLinks: s.issueLinks,
    comments: s.comments,
    activities: s.activities,
    displayProperties: s.displayProperties,
    selectedIssueIds: s.selectedIssueIds,
    focusedIssueId: s.focusedIssueId,
    navIssueIds: s.navIssueIds,
    setIssueStatus: s.setIssueStatus,
    setIssuePriority: s.setIssuePriority,
    setIssueAssignee: s.setIssueAssignee,
    setPeek: s.setPeek,
    toggleSelectIssue: s.toggleSelectIssue,
    setSelectedIssues: s.setSelectedIssues,
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
  const cycle = cycles.find((c) => c.id === issue.cycleId)
  const issueLabels = issue.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter(Boolean)
  const linkCount = issueLinks.filter((l) => l.issueId === issue.id).length
  const commentCount = comments.filter((c) => c.issueId === issue.id).length
  const team = teams.find((t) => t.id === issue.teamId)
  const estimationUsed = teamEstimationType(team) !== 'notUsed'
  const estimateText =
    issue.estimate != null
      ? teamEstimationType(team) === 'tshirt'
        ? estimateLabel(issue.estimate, team)
        : String(issue.estimate)
      : null
  const children = issues.filter((i) => i.parentId === issue.id)
  const childDone = children.filter((i) => {
    const st = states.find((s) => s.id === i.stateId)
    return st?.type === 'completed'
  }).length
  const childPercent = children.length
    ? Math.round((childDone / children.length) * 100)
    : 0

  // How long the issue has sat in its current state — anchored on the most
  // recent 'status' activity that moved it *into* the present stateId, falling
  // back to creation when no such transition has been logged.
  const enteredStatusAt =
    activities
      .filter((a) => a.issueId === issue.id && a.kind === 'status' && a.to === issue.stateId)
      .reduce<string | null>((latest, a) => (!latest || a.createdAt > latest ? a.createdAt : latest), null) ??
    issue.createdAt

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
      style={depth ? { paddingLeft: 16 + depth * 22 } : undefined}
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
          // Shift-click selects the inclusive range from the last toggled row
          // to this one (Linear's range select), using the list's visible order.
          if (e.shiftKey && lastSelectedIdentifier && navIssueIds.length) {
            const a = navIssueIds.indexOf(lastSelectedIdentifier)
            const b = navIssueIds.indexOf(issue.identifier)
            if (a !== -1 && b !== -1) {
              const [lo, hi] = a < b ? [a, b] : [b, a]
              const rangeIds = navIssueIds
                .slice(lo, hi + 1)
                .map((ident) => issues.find((i) => i.identifier === ident)?.id)
                .filter((id): id is string => Boolean(id))
              setSelectedIssues(Array.from(new Set([...selectedIssueIds, ...rangeIds])))
              return
            }
          }
          toggleSelectIssue(issue.id)
          lastSelectedIdentifier = issue.identifier
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

      {expand &&
        (expand.hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              expand.onToggle()
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-faint hover:bg-bg-selected"
            title={expand.expanded ? 'Collapse sub-issues' : 'Expand sub-issues'}
          >
            <ChevronRight
              size={12}
              className={cn('transition-transform', expand.expanded && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        ))}

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
        <BlockIndicator issue={issue} />
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
        {dp.cycle && cycle && (
          <span className="flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-[11px] text-muted">
            <IterationCw size={10} />
            {cycle.name ?? `Cycle ${cycle.number}`}
          </span>
        )}
        {dp.estimate && estimationUsed && estimateText && (
          <span
            className="flex items-center gap-0.5 rounded-full border border-border px-1.5 py-px text-[11px] text-muted"
            title={estimateLabel(issue.estimate, team)}
          >
            <Gauge size={11} />
            {estimateText}
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
        {commentCount > 0 && (
          <span
            className="flex items-center gap-0.5 text-[11px] text-faint"
            title={`${commentCount} comment${commentCount > 1 ? 's' : ''}`}
          >
            <MessageSquare size={11} />
            {commentCount}
          </span>
        )}
        {dp.timeInStatus && (
          <span
            className="flex items-center gap-0.5 text-[11px] text-faint"
            title={`In current status since ${formatDate(enteredStatusAt)}`}
          >
            <Clock size={11} />
            {timeAgo(enteredStatusAt)}
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
        <IssueRowActions issue={issue} />
      </div>
    </div>
  )
}
