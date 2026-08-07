import {
  ChevronDown,
  Plus,
  IterationCw,
  Diamond,
  MoreHorizontal,
  CheckCircle2,
  Circle,
  ChevronsDownUp,
} from 'lucide-react'
import type { IssueGroup } from '@/lib/selectors'
import type { CreatePrefill, GroupBy, Issue, Priority } from '@/lib/types'
import { useStore } from '@/lib/store'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { GroupCompletionBadge } from './GroupCompletionBadge'
import { Popover } from './ui/Popover'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'

/** Seed values for the create modal from a group's property — Linear's
 *  group-header `+` pre-fills the new issue with that group's value. */
export function prefillFor(groupBy: GroupBy, group: IssueGroup): CreatePrefill {
  switch (groupBy) {
    case 'status':
      return group.stateId ? { stateId: group.stateId } : {}
    case 'priority':
      return { priority: Number(group.key) as Priority }
    case 'assignee':
      return group.key === 'none' ? {} : { assigneeId: group.key }
    case 'project':
      return group.key === 'none' ? {} : { projectId: group.key }
    case 'label':
      return group.key === 'none' ? {} : { labelIds: [group.key] }
    default:
      return {}
  }
}

export function GroupGlyph({ group, groupBy }: { group: IssueGroup; groupBy: GroupBy }) {
  const states = useStore((s) => s.states)
  const users = useStore((s) => s.users)
  if (groupBy === 'status') {
    const st = states.find((s) => s.id === group.stateId)
    return st ? <StatusIcon type={st.type} color={st.color} /> : null
  }
  if (groupBy === 'priority') {
    return <PriorityIcon priority={Number(group.key) as 0 | 1 | 2 | 3 | 4} />
  }
  if (groupBy === 'assignee' || groupBy === 'creator') {
    const u = users.find((x) => x.id === group.key)
    return <Avatar user={u} size={16} />
  }
  if (groupBy === 'project') {
    return <span className="text-[13px]">{group.icon ?? '○'}</span>
  }
  if (groupBy === 'label') {
    return group.color ? <LabelDot color={group.color} /> : null
  }
  if (groupBy === 'cycle') {
    return <IterationCw size={14} className="text-muted" />
  }
  if (groupBy === 'milestone') {
    return <Diamond size={13} className="text-muted" />
  }
  return null
}

/** Sum of estimate points across a group's issues (0/undefined estimates skip). */
function estimateSum(issues: Issue[]) {
  return issues.reduce((n, i) => n + (i.estimate ?? 0), 0)
}

/** Summed-estimate badge beside a group header's count — mirrors the board's
 *  column badge so a list group surfaces its total scope. Hidden when zero. */
function EstimateBadge({ issues }: { issues: Issue[] }) {
  const sum = estimateSum(issues)
  if (sum <= 0) return null
  return (
    <span
      title={`${sum} estimate points`}
      className="rounded bg-secondary px-1 font-mono text-[11px] text-faint"
    >
      {sum}
    </span>
  )
}

/**
 * The group header of a list view — select-all box, collapse chevron, glyph,
 * label + count, then the `⋯` group menu and the `+` that creates an issue
 * pre-filled with the group's value.
 *
 * Shared by the plain and the windowed list: Linear keeps every one of these
 * controls no matter how long the list is, so the virtualized path must render
 * the same header rather than a bare label.
 */
export function IssueGroupHeader({
  group,
  groupBy,
  collapsed,
  onToggleCollapsed,
  onCollapse,
  height,
  sticky = true,
}: {
  group: IssueGroup
  groupBy: GroupBy
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Fold this group without toggling — the `⋯` menu's "Collapse group". */
  onCollapse: () => void
  /** Fixed row height, for the windowed list whose math needs exact rows. */
  height?: number
  sticky?: boolean
}) {
  const openCreateWith = useStore((s) => s.openCreateWith)
  const selectedIssueIds = useStore((s) => s.selectedIssueIds)
  const setSelectedIssues = useStore((s) => s.setSelectedIssues)
  const setIssueStatus = useStore((s) => s.setIssueStatus)
  const states = useStore((s) => s.states)
  const anySelected = selectedIssueIds.length > 0

  const groupIds = group.issues.map((i) => i.id)
  const allSelected =
    group.count > 0 && groupIds.every((id) => selectedIssueIds.includes(id))

  const toggleGroup = () => {
    const set = new Set(selectedIssueIds)
    if (allSelected) groupIds.forEach((id) => set.delete(id))
    else groupIds.forEach((id) => set.add(id))
    setSelectedIssues([...set])
  }
  const selectAll = () => {
    const set = new Set(selectedIssueIds)
    groupIds.forEach((id) => set.add(id))
    setSelectedIssues([...set])
  }
  const setGroupStatus = (stateId: string, label: string) => {
    groupIds.forEach((id) => setIssueStatus(id, stateId))
    toast(`Moved ${group.count} ${group.count === 1 ? 'issue' : 'issues'} to ${label}`)
  }
  const doneState = states.find((s) => s.type === 'completed')
  const startedState = states.find((s) => s.type === 'started')

  return (
    <div
      style={height ? { height } : undefined}
      className={cn(
        'group flex items-center gap-2 border-b border-border bg-bg-secondary/95 px-4 backdrop-blur',
        sticky && 'sticky top-0 z-10',
        !height && 'py-1.5',
      )}
    >
      <button
        type="button"
        onClick={toggleGroup}
        title="Select all in group"
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-opacity',
          allSelected
            ? 'border-accent bg-accent text-white opacity-100'
            : 'border-border-strong opacity-0 group-hover:opacity-100',
          anySelected && 'opacity-100',
        )}
      >
        {allSelected && (
          <svg width="11" height="11" viewBox="0 0 16 16">
            <path
              d="M3.5 8.5l3 3 6-6.5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <button type="button" onClick={onToggleCollapsed} className="flex items-center gap-2">
        <ChevronDown
          size={13}
          className={cn('text-faint transition-transform', collapsed && '-rotate-90')}
        />
        <GroupGlyph group={group} groupBy={groupBy} />
        <span className="text-[13px] font-medium text-fg">{group.label}</span>
        <span className="text-[12px] text-faint">{group.count}</span>
        <EstimateBadge issues={group.issues} />
        <GroupCompletionBadge issues={group.issues} states={states} />
      </button>
      <div className="flex-1" />
      <Popover
        align="end"
        width={208}
        trigger={
          <span
            title="Group options"
            className="flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
          >
            <MoreHorizontal size={14} />
          </span>
        }
      >
        {(close) => (
          <div className="text-[13px] text-fg">
            <button
              type="button"
              onClick={() => {
                selectAll()
                close()
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-bg-hover"
            >
              <Circle size={14} className="text-faint" />
              Select all
            </button>
            <button
              type="button"
              onClick={() => {
                onCollapse()
                close()
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-bg-hover"
            >
              <ChevronsDownUp size={14} className="text-faint" />
              Collapse group
            </button>
            {(doneState || startedState) && <div className="my-1 border-t border-border" />}
            {startedState && (
              <button
                type="button"
                onClick={() => {
                  setGroupStatus(startedState.id, startedState.name)
                  close()
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-bg-hover"
              >
                <StatusIcon type={startedState.type} color={startedState.color} />
                Mark as {startedState.name}
              </button>
            )}
            {doneState && (
              <button
                type="button"
                onClick={() => {
                  setGroupStatus(doneState.id, doneState.name)
                  close()
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-bg-hover"
              >
                <CheckCircle2 size={14} className="text-accent" />
                Mark as Done
              </button>
            )}
          </div>
        )}
      </Popover>
      <button
        type="button"
        title="Add issue"
        onClick={() => openCreateWith(prefillFor(groupBy, group))}
        className="flex h-5 w-5 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
