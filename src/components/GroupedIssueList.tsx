import { useEffect, useState } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'
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
import type { GroupBy, Issue } from '@/lib/types'
import { useStore } from '@/lib/store'
import { IssueRow } from './IssueRow'
import { VirtualIssueList } from './VirtualIssueList'
import { GroupGlyph, IssueGroupHeader, prefillFor } from './IssueGroupHeader'
import { cn } from '@/lib/utils'
import { EmptyState, IssuesIllustration, SearchIllustration } from './EmptyState'

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
  hasActiveFilters,
  onClearFilters,
  totalCount,
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
  /** When true and there are no rows, show a "no results" state instead of the
   *  default create-prompt empty state — Linear's filtered-out screen. */
  hasActiveFilters?: boolean
  /** Wires a "Clear filters" accent action onto the filtered-empty state. */
  onClearFilters?: () => void
  /** Unfiltered issue count for this view. When provided alongside active
   *  filters, the summary bar reports how many rows were filtered out. */
  totalCount?: number
}) {
  const setCreateOpen = useStore((s) => s.setCreateOpen)
  const openCreateWith = useStore((s) => s.openCreateWith)
  const setNavIssueIds = useStore((s) => s.setNavIssueIds)
  const setNavGroups = useStore((s) => s.setNavGroups)
  // Collapse lives in the store rather than local state so `T` / `⌥T` can fold
  // a group from the keyboard without this component being on the call path.
  const collapsed = useStore((s) => s.collapsedGroups)
  const toggleGroupCollapsed = useStore((s) => s.toggleGroupCollapsed)
  const setGroupsCollapsed = useStore((s) => s.setGroupsCollapsed)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
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
  const flatOrderKey = flatOrder.join('\n')
  useEffect(() => {
    setNavIssueIds(flatOrderKey ? flatOrderKey.split('\n') : [])
  }, [flatOrderKey, setNavIssueIds])

  // …and the same order broken down by group, so `⌘⌥A` / `T` can resolve which
  // group the focused row sits in. Sub-groups are published as their own keys —
  // `T` on a sub-grouped row folds the sub-group it is actually inside.
  const groupOrder = groups.flatMap((g) =>
    g.subGroups
      ? g.subGroups.map((sg) => ({
          key: `${g.key}::${sg.key}`,
          identifiers: visibleOrder(sg.issues),
        }))
      : [{ key: g.key, identifiers: visibleOrder(g.issues) }],
  )
  const groupOrderKey = groupOrder.map((g) => `${g.key}:${g.identifiers.join(',')}`).join('\n')
  useEffect(() => {
    setNavGroups(groupOrder)
  }, [groupOrderKey, setNavGroups])

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
    // Filters are active but matched nothing — Linear shows a "no results"
    // screen with a clear-filters affordance instead of the create prompt.
    if (hasActiveFilters) {
      return (
        <EmptyState
          illustration={<SearchIllustration />}
          title="No results"
          description="No issues match the current filters."
          action={
            onClearFilters
              ? { label: 'Clear filters', onClick: onClearFilters }
              : undefined
          }
        />
      )
    }
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

  // Matched-row count across all groups. With active filters, Linear surfaces a
  // quiet summary line — "N issues" plus how many were filtered out (only when
  // a reliable unfiltered total is supplied). Computed before the windowed
  // early-return so the bar shows for large filtered lists too.
  const matchedCount = groups.reduce((n, g) => n + g.count, 0)
  const filteredOut =
    totalCount != null && totalCount > matchedCount ? totalCount - matchedCount : 0
  // Linear puts this under the list, centred, and phrases it as what's hidden
  // rather than what matched — the matched count is already the list itself.
  const showSummary = !!hasActiveFilters && matchedCount > 0 && filteredOut > 0
  const summaryBar = showSummary ? (
    <div className="flex items-center justify-center gap-2 py-4 text-[12px] text-faint">
      <span>
        <span className="text-muted">{filteredOut}</span>{' '}
        {filteredOut === 1 ? 'issue' : 'issues'} hidden by filters
      </span>
      {onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-muted hover:bg-bg-hover hover:text-fg"
        >
          Clear filters
          <X size={12} />
        </button>
      )}
    </div>
  ) : null

  // Above a size threshold, switch to a windowed renderer (drag-reorder is
  // dropped — the right trade-off for very large lists; the group header and
  // its collapse survive). Skipped when sub-grouping is active — the nested
  // layout renders in full.
  const totalRows = groups.reduce((n, g) => n + 1 + g.issues.length, 0)
  if (!subGrouped && !nested && totalRows > 50) {
    const windowed = (
      <VirtualIssueList
        groups={groups}
        groupBy={groupBy}
        collapsed={collapsed}
        onToggleCollapsed={toggleGroupCollapsed}
        onCollapse={(key) => setGroupsCollapsed([key], true)}
      />
    )
    if (!summaryBar) return windowed
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        {windowed}
        {summaryBar}
      </div>
    )
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
    setGroupsCollapsed(
      groups.map((g) => g.key),
      !allCollapsed,
    )

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
        return (
          <div key={group.key}>
            <IssueGroupHeader
              group={group}
              groupBy={groupBy}
              collapsed={!!isCollapsed}
              onToggleCollapsed={() => toggleGroupCollapsed(group.key)}
              onCollapse={() => setGroupsCollapsed([group.key], true)}
            />
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
                          onClick={() => toggleGroupCollapsed(subKey)}
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
      {summaryBar}
    </div>
  )

  if (!onReorder) return body

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {body}
    </DndContext>
  )
}
