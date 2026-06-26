import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { groupIssues, sortIssues } from '@/lib/selectors'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, IssuesIllustration } from '@/components/EmptyState'

/**
 * Label issues view — Linear's "click a label, see every issue carrying it".
 * Shows all non-triage issues whose `labelIds` includes this label (or, when
 * the label is a group, any of its child labels), grouped by status and ordered
 * by priority like the default Issues view.
 */
export function LabelView() {
  const { id } = useParams()
  const data = useStore()

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
      (i) => !i.triage && i.labelIds.some((l) => labelIds.has(l)),
    )
    const sorted = sortIssues(scoped, 'priority', data)
    return groupIssues(sorted, 'status', data, false, data.preferences.displayNames)
  }, [label, labelIds, data])

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

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={label.name}
        right={
          <span className="text-[12px] text-faint">
            {count} {count === 1 ? 'issue' : 'issues'}
          </span>
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

      <GroupedIssueList
        groups={groups}
        groupBy="status"
        empty={{
          title: 'No issues with this label',
          description: 'Issues tagged with this label will show up here.',
        }}
      />
    </div>
  )
}
