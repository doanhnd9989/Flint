import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { groupIssues, sortIssues } from '@/lib/selectors'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { ViewHeader } from '@/components/ViewHeader'

export function MyIssues() {
  const data = useStore()
  const groups = useMemo(() => {
    const mine = data.issues.filter((i) => i.assigneeId === data.currentUserId)
    return groupIssues(sortIssues(mine, 'priority', data), 'status', data)
  }, [data])

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="My Issues" />
      <GroupedIssueList groups={groups} groupBy="status" />
    </div>
  )
}
