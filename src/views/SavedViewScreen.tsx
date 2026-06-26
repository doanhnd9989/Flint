import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { filterIssues, groupIssues, sortIssues, boardColumnGroupBy } from '@/lib/selectors'
import type { GroupBy, Issue, OrderDir } from '@/lib/types'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { IssueBoard } from '@/components/IssueBoard'
import { DisplayMenu } from '@/components/DisplayMenu'
import { FilterBar, hasActiveFilters } from '@/components/FilterBar'
import { ViewHeader } from '@/components/ViewHeader'
import { StarButton } from '@/components/StarButton'

export function SavedViewScreen() {
  const { id } = useParams()
  const data = useStore()
  const updateView = useStore((s) => s.updateView)
  const view = data.savedViews.find((v) => v.id === id)

  // The saved view persists layout/groupBy/orderBy/filters (mutated through
  // updateView). The remaining display options aren't persisted on the view —
  // like the team IssuesView, they live as local state for the session.
  const [subGroupBy, setSubGroupBy] = useState<GroupBy>('none')
  const [orderDir, setOrderDir] = useState<OrderDir>('asc')
  const [orderCompletedByRecency, setOrderCompletedByRecency] = useState(false)
  const [showSubIssues, setShowSubIssues] = useState(true)
  const [nestedSubIssues, setNestedSubIssues] = useState(false)
  const [showEmptyGroups, setShowEmptyGroups] = useState(false)

  // Nesting only makes sense in the list view with sub-issues shown.
  const nested =
    view?.layout === 'list' && showSubIssues && nestedSubIssues

  const { groups, childrenByParent, rows } = useMemo(() => {
    if (!view) return { groups: [], childrenByParent: undefined, rows: undefined }

    let scoped = data.issues
    if (!showSubIssues) scoped = scoped.filter((i) => !i.parentId)

    const filtered = filterIssues(scoped, view.filters)
    const sorted = sortIssues(
      filtered,
      view.orderBy,
      data,
      orderCompletedByRecency,
      orderDir,
    )

    // Nested mode: pull every sub-issue (whose parent is visible) out of its
    // own group and render it under its parent. Issues whose parent is not in
    // the visible set stay at the top level.
    let childrenByParent: Record<string, Issue[]> | undefined
    let forGrouping = sorted
    if (nested) {
      const visible = new Set(sorted.map((i) => i.id))
      const map: Record<string, Issue[]> = {}
      for (const i of sorted) {
        if (i.parentId && visible.has(i.parentId)) (map[i.parentId] ??= []).push(i)
      }
      childrenByParent = map
      forGrouping = sorted.filter((i) => !i.parentId || !visible.has(i.parentId))
    }

    const dn = data.preferences.displayNames
    const top = groupIssues(
      forGrouping,
      // The board groups by any single-valued, settable property; label/cycle/
      // milestone groupings have no draggable columns — fall back to status.
      view.layout === 'board' ? boardColumnGroupBy(view.groupBy) : view.groupBy,
      data,
      showEmptyGroups,
      dn,
    )
    // Sub-grouping: each top group carries its issues sub-grouped. In the list
    // these render as nested sub-group headers; on the board they become the
    // per-column cells of each swimlane (row).
    const groups =
      subGroupBy !== 'none'
        ? top.map((g) => ({
            ...g,
            subGroups: groupIssues(g.issues, subGroupBy, data, showEmptyGroups, dn),
          }))
        : top
    // Board swimlanes: the ordered set of row groups (incl. empty ones, which
    // the board collapses into a "Hidden rows" bar).
    const rows =
      view.layout === 'board' && subGroupBy !== 'none'
        ? groupIssues(forGrouping, subGroupBy, data, true, dn)
        : undefined
    return { groups, childrenByParent, rows }
  }, [
    data,
    view,
    subGroupBy,
    orderDir,
    orderCompletedByRecency,
    showSubIssues,
    nested,
    showEmptyGroups,
  ])

  if (!view) {
    return (
      <div className="flex h-full items-center justify-center text-faint">
        View not found
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={view.name}
        right={
          <div className="flex items-center gap-1">
            <StarButton type="view" id={view.id} />
            <DisplayMenu
              layout={view.layout}
              groupBy={view.groupBy}
              orderBy={view.orderBy}
              onLayout={(layout) => updateView(view.id, { layout })}
              onGroupBy={(groupBy) => updateView(view.id, { groupBy })}
              onOrderBy={(orderBy) => updateView(view.id, { orderBy })}
              orderDir={orderDir}
              onOrderDir={setOrderDir}
              subGroupBy={subGroupBy}
              onSubGroupBy={setSubGroupBy}
              orderCompletedByRecency={orderCompletedByRecency}
              onOrderCompletedByRecency={setOrderCompletedByRecency}
              showSubIssues={showSubIssues}
              onShowSubIssues={setShowSubIssues}
              nestedSubIssues={nestedSubIssues}
              onNestedSubIssues={setNestedSubIssues}
              showEmptyGroups={showEmptyGroups}
              onShowEmptyGroups={setShowEmptyGroups}
            />
          </div>
        }
      />
      <FilterBar
        filters={view.filters}
        onChange={(filters) => updateView(view.id, { filters })}
      />
      {view.layout === 'board' ? (
        <IssueBoard
          groups={groups}
          rows={rows}
          subGroupBy={subGroupBy}
          groupBy={boardColumnGroupBy(view.groupBy)}
        />
      ) : (
        <GroupedIssueList
          groups={groups}
          groupBy={view.groupBy}
          subGroupBy={subGroupBy}
          childrenByParent={nested ? childrenByParent : undefined}
          hasActiveFilters={hasActiveFilters(view.filters)}
          onReorder={(id, sortOrder) => {
            data.setIssueSortOrder(id, sortOrder)
            updateView(view.id, { orderBy: 'manual' })
          }}
        />
      )}
    </div>
  )
}
