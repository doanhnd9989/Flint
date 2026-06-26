import { useEffect, useState } from 'react'
import { ChevronDown, Plus, IterationCw, Diamond } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { IssueGroup } from '@/lib/selectors'
import type { CreatePrefill, GroupBy, Issue, Priority } from '@/lib/types'
import { useStore } from '@/lib/store'
import { IssueRow } from './IssueRow'
import { VirtualIssueList } from './VirtualIssueList'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { cn } from '@/lib/utils'
import { EmptyState, IssuesIllustration } from './EmptyState'

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

function GroupGlyph({ group, groupBy }: { group: IssueGroup; groupBy: GroupBy }) {
  const states = useStore((s) => s.states)
  const users = useStore((s) => s.users)
  if (groupBy === 'status') {
    const st = states.find((s) => s.id === group.stateId)
    return st ? <StatusIcon type={st.type} color={st.color} /> : null
  }
  if (groupBy === 'priority') {
    return <PriorityIcon priority={Number(group.key) as 0 | 1 | 2 | 3 | 4} />
  }
  if (groupBy === 'assignee') {
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

function SortableIssueRow({ issue, showStatus }: { issue: Issue; showStatus: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: issue.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <IssueRow issue={issue} showStatus={showStatus} />
    </div>
  )
}

export function GroupedIssueList({
  groups,
  groupBy,
  subGroupBy = 'none',
  childrenByParent,
  onReorder,
  empty,
}: {
  groups: IssueGroup[]
  groupBy: GroupBy
  /** When set, each group carries `subGroups`; render them nested. */
  subGroupBy?: GroupBy
  /** Nested-sub-issues mode: parent id → its visible sub-issues, rendered
   *  indented beneath the parent with a disclosure chevron. */
  childrenByParent?: Record<string, Issue[]>
  /** Enables drag-to-reorder within a group. Receives the new sortOrder. */
  onReorder?: (issueId: string, sortOrder: number) => void
  /** Customizes the empty state shown when no group has any issue. */
  empty?: { title?: string; description?: string }
}) {
  const setCreateOpen = useStore((s) => s.setCreateOpen)
  const openCreateWith = useStore((s) => s.openCreateWith)
  const selectedIssueIds = useStore((s) => s.selectedIssueIds)
  const setSelectedIssues = useStore((s) => s.setSelectedIssues)
  const setNavIssueIds = useStore((s) => s.setNavIssueIds)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const anySelected = selectedIssueIds.length > 0
  const subGrouped = subGroupBy !== 'none'
  const nested = !!childrenByParent

  // Sub-issues default to expanded; collapse on demand.
  const isExpanded = (id: string) => expanded[id] ?? true
  const toggleExpand = (id: string) =>
    setExpanded((e) => ({ ...e, [id]: !(e[id] ?? true) }))

  // Walk the (nested) visible order for prev/next navigation — descending into
  // a parent's sub-issues only while it's expanded.
  const visibleOrder = (issues: Issue[]): string[] =>
    issues.flatMap((i) => {
      const kids = childrenByParent?.[i.id] ?? []
      return [
        i.identifier,
        ...(kids.length && isExpanded(i.id) ? visibleOrder(kids) : []),
      ]
    })

  // Publish this list's visible order so the issue detail/peek can offer
  // prev/next navigation through it. The store no-ops on an unchanged order.
  const flatOrder = groups.flatMap((g) =>
    g.subGroups
      ? g.subGroups.flatMap((sg) => visibleOrder(sg.issues))
      : visibleOrder(g.issues),
  )
  useEffect(() => {
    setNavIssueIds(flatOrder)
  }, [flatOrder.join('\n'), setNavIssueIds])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id || !onReorder) return
    const group = groups.find((g) => g.issues.some((i) => i.id === active.id))
    if (!group || !group.issues.some((i) => i.id === over.id)) return // same-group only
    const ids = group.issues.map((i) => i.id)
    const reordered = arrayMove(
      group.issues,
      ids.indexOf(active.id as string),
      ids.indexOf(over.id as string),
    )
    const pos = reordered.findIndex((i) => i.id === active.id)
    const prev = reordered[pos - 1]
    const next = reordered[pos + 1]
    let sortOrder: number
    if (prev && next) sortOrder = (prev.sortOrder + next.sortOrder) / 2
    else if (prev) sortOrder = prev.sortOrder + 100
    else if (next) sortOrder = next.sortOrder - 100
    else return
    onReorder(active.id as string, sortOrder)
  }

  if (groups.every((g) => g.count === 0)) {
    return (
      <EmptyState
        illustration={<IssuesIllustration />}
        title={empty?.title ?? 'No issues'}
        description={
          empty?.description ??
          'Create a new issue to start tracking work for your team.'
        }
        action={{ label: 'Create new issue', onClick: () => setCreateOpen(true) }}
      />
    )
  }

  // Above a size threshold, switch to a windowed renderer (drag-reorder and
  // collapse are dropped — the right trade-off for very large lists). Skipped
  // when sub-grouping is active — the nested layout renders in full.
  const totalRows = groups.reduce((n, g) => n + 1 + g.issues.length, 0)
  if (!subGrouped && !nested && totalRows > 50) {
    return <VirtualIssueList groups={groups} groupBy={groupBy} />
  }

  // Nested-sub-issues render: a parent row + its expanded sub-issues, recursively.
  const renderNested = (
    issues: Issue[],
    depth: number,
    showStatus: boolean,
  ): React.ReactNode =>
    issues.map((issue) => {
      const kids = childrenByParent?.[issue.id] ?? []
      const open = isExpanded(issue.id)
      return (
        <div key={issue.id}>
          <IssueRow
            issue={issue}
            showStatus={depth > 0 ? true : showStatus}
            depth={depth}
            expand={{
              hasChildren: kids.length > 0,
              expanded: open,
              onToggle: () => toggleExpand(issue.id),
            }}
          />
          {open && kids.length > 0 && renderNested(kids, depth + 1, true)}
        </div>
      )
    })

  const renderIssues = (issues: Issue[], showStatus: boolean) =>
    nested ? (
      renderNested(issues, 0, showStatus)
    ) : onReorder && !subGrouped ? (
      <SortableContext
        items={issues.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        {issues.map((issue) => (
          <SortableIssueRow key={issue.id} issue={issue} showStatus={showStatus} />
        ))}
      </SortableContext>
    ) : (
      issues.map((issue) => (
        <IssueRow key={issue.id} issue={issue} showStatus={showStatus} />
      ))
    )

  // Collapse/expand-all toggle — Linear lets you fold every group at once.
  // "All collapsed" only counts the top-level groups currently on screen.
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed[g.key])
  const toggleAll = () =>
    setCollapsed((c) => {
      const next = { ...c }
      groups.forEach((g) => {
        next[g.key] = !allCollapsed
      })
      return next
    })

  const body = (
    <div className="flex-1 overflow-y-auto">
      {!subGrouped && groups.length > 1 && (
        <div className="flex items-center px-4 py-1.5">
          <button
            type="button"
            onClick={toggleAll}
            title={allCollapsed ? 'Expand all groups' : 'Collapse all groups'}
            className="flex items-center gap-1.5 text-[12px] text-faint hover:text-fg"
          >
            <ChevronDown
              size={13}
              className={cn('transition-transform', allCollapsed && '-rotate-90')}
            />
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        </div>
      )}
      {groups.map((group) => {
        const isCollapsed = collapsed[group.key]
        const groupIds = group.issues.map((i) => i.id)
        const allSelected =
          group.count > 0 && groupIds.every((id) => selectedIssueIds.includes(id))
        const toggleGroup = () => {
          const set = new Set(selectedIssueIds)
          if (allSelected) groupIds.forEach((id) => set.delete(id))
          else groupIds.forEach((id) => set.add(id))
          setSelectedIssues([...set])
        }
        return (
          <div key={group.key}>
            <div className="group sticky top-0 z-10 flex items-center gap-2 bg-bg-secondary/95 px-4 py-1.5 backdrop-blur border-b border-border">
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
                    <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  setCollapsed((c) => ({ ...c, [group.key]: !c[group.key] }))
                }
                className="flex items-center gap-2"
              >
                <ChevronDown
                  size={13}
                  className={cn(
                    'text-faint transition-transform',
                    isCollapsed && '-rotate-90',
                  )}
                />
                <GroupGlyph group={group} groupBy={groupBy} />
                <span className="text-[13px] font-medium text-fg">
                  {group.label}
                </span>
                <span className="text-[12px] text-faint">{group.count}</span>
              </button>
              <div className="flex-1" />
              <button
                type="button"
                title="Add issue"
                onClick={() => openCreateWith(prefillFor(groupBy, group))}
                className="flex h-5 w-5 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
              >
                <Plus size={14} />
              </button>
            </div>
            {!isCollapsed &&
              (group.subGroups ? (
                group.subGroups.map((sg) => {
                  const subKey = `${group.key}::${sg.key}`
                  const subCollapsed = collapsed[subKey]
                  return (
                    <div key={subKey}>
                      <div className="group flex items-center gap-2 px-4 py-1.5 pl-7">
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsed((c) => ({ ...c, [subKey]: !c[subKey] }))
                          }
                          className="flex items-center gap-2"
                        >
                          <ChevronDown
                            size={13}
                            className={cn(
                              'text-faint transition-transform',
                              subCollapsed && '-rotate-90',
                            )}
                          />
                          <GroupGlyph group={sg} groupBy={subGroupBy} />
                          <span className="text-[13px] font-medium text-fg">
                            {sg.label}
                          </span>
                          <span className="text-[12px] text-faint">{sg.count}</span>
                        </button>
                        <div className="ml-2 flex-1 border-t border-border" />
                        <button
                          type="button"
                          title="Add issue"
                          onClick={() =>
                            openCreateWith({
                              ...prefillFor(groupBy, group),
                              ...prefillFor(subGroupBy, sg),
                            })
                          }
                          className="flex h-5 w-5 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      {!subCollapsed && renderIssues(sg.issues, groupBy !== 'status')}
                    </div>
                  )
                })
              ) : (
                renderIssues(group.issues, groupBy !== 'status')
              ))}
          </div>
        )
      })}
    </div>
  )

  if (!onReorder) return body

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {body}
    </DndContext>
  )
}
