import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { boardColumnGroupBy, groupIssues, sortIssues } from '@/lib/selectors'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { IssueBoard } from '@/components/IssueBoard'
import { DisplayMenu } from '@/components/DisplayMenu'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, IssuesIllustration } from '@/components/EmptyState'
import type { GroupBy, OrderBy, OrderDir, ViewLayout } from '@/lib/types'

/**
 * Label issues view — Linear's "click a label, see every issue carrying it".
 * Shows all non-triage issues whose `labelIds` includes this label (or, when
 * the label is a group, any of its child labels). Like every Linear issue list,
 * the view carries its own Display menu: list/board layout, grouping, ordering
 * (with direction) and an empty-groups toggle — defaulting to status × priority
 * the way the default Issues view does.
 */
export function LabelView() {
  const { id } = useParams()
  const data = useStore()

  // Per-view display config — local to this surface, just like Linear's
  // unsaved Display options on a label page.
  const [layout, setLayout] = useState<ViewLayout>('list')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [orderBy, setOrderBy] = useState<OrderBy>('priority')
  const [orderDir, setOrderDir] = useState<OrderDir>('asc')
  const [showEmptyGroups, setShowEmptyGroups] = useState(false)

  const label = data.labels.find((l) => l.id === id)

  // The set of label ids that "count" for this view: the label itself, plus all
  // child labels when it is a group.
  const labelIds = useMemo(() => {
    if (!label) return new Set<string>()
    const ids = new Set<string>([label.id])
    if (label.isGroup) {
      for (const l of data.labels) if (l.groupId === label.id) ids.add(l.id)
    }
    return ids
  }, [label, data.labels])

  const groups = useMemo(() => {
    if (!label) return []
    const scoped = data.issues.filter(
      (i) => !i.triage && !i.archivedAt && i.labelIds.some((l) => labelIds.has(l)),
    )
    const sorted = sortIssues(scoped, orderBy, data, false, orderDir)
    // The board groups by columns; label/cycle/milestone fall back to status.
    const effectiveGroupBy = layout === 'board' ? boardColumnGroupBy(groupBy) : groupBy
    return groupIssues(
      sorted,
      effectiveGroupBy,
      data,
      showEmptyGroups,
      data.preferences.displayNames,
    )
  }, [label, labelIds, data, groupBy, orderBy, orderDir, layout, showEmptyGroups])

  if (!label) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title="Label" />
        <EmptyState
          illustration={<IssuesIllustration />}
          title="Label not found"
          description="This label may have been deleted or renamed."
        />
      </div>
    )
  }

  const count = groups.reduce((n, g) => n + g.count, 0)
  const boardGroupBy = boardColumnGroupBy(groupBy)

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={label.name}
        right={
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-faint">
              {count} {count === 1 ? 'issue' : 'issues'}
            </span>
            <DisplayMenu
              layout={layout}
              groupBy={groupBy}
              orderBy={orderBy}
              orderDir={orderDir}
              onLayout={setLayout}
              onGroupBy={setGroupBy}
              onOrderBy={setOrderBy}
              onOrderDir={setOrderDir}
              showEmptyGroups={showEmptyGroups}
              onShowEmptyGroups={setShowEmptyGroups}
            />
          </div>
        }
      >
        <span className="flex items-center gap-2 text-[13px]">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: label.color }}
          />
          <span className="font-medium text-fg">{label.name}</span>
        </span>
      </ViewHeader>

      {layout === 'board' ? (
        <IssueBoard groups={groups} groupBy={boardGroupBy} />
      ) : (
        <GroupedIssueList
          groups={groups}
          groupBy={groupBy}
          onReorder={
            orderBy === 'manual'
              ? (issueId, sortOrder) => data.setIssueSortOrder(issueId, sortOrder)
              : undefined
          }
          empty={{
            title: 'No issues with this label',
            description: 'Issues tagged with this label will show up here.',
          }}
        />
      )}
    </div>
  )
}
