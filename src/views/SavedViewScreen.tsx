import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { filterIssues, groupIssues, sortIssues } from '@/lib/selectors'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { IssueBoard } from '@/components/IssueBoard'
import { DisplayMenu } from '@/components/DisplayMenu'
import { FilterBar } from '@/components/FilterBar'
import { ViewHeader } from '@/components/ViewHeader'
import { StarButton } from '@/components/StarButton'

export function SavedViewScreen() {
  const { id } = useParams()
  const data = useStore()
  const updateView = useStore((s) => s.updateView)
  const view = data.savedViews.find((v) => v.id === id)

  const groups = useMemo(() => {
    if (!view) return []
    const filtered = filterIssues(data.issues, view.filters)
    const sorted = sortIssues(filtered, view.orderBy, data)
    return groupIssues(sorted, view.layout === 'board' ? 'status' : view.groupBy, data)
  }, [data, view])

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
            />
          </div>
        }
      />
      <FilterBar
        filters={view.filters}
        onChange={(filters) => updateView(view.id, { filters })}
      />
      {view.layout === 'board' ? (
        <IssueBoard groups={groups} />
      ) : (
        <GroupedIssueList groups={groups} groupBy={view.groupBy} />
      )}
    </div>
  )
}
