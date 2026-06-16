import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { filterIssues, groupIssues, sortIssues } from '@/lib/selectors'
import type { GroupBy, OrderBy, ViewLayout } from '@/lib/types'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { IssueBoard } from '@/components/IssueBoard'
import { DisplayMenu } from '@/components/DisplayMenu'
import { ViewHeader } from '@/components/ViewHeader'
import { cn } from '@/lib/utils'

type Tab = 'active' | 'backlog' | 'all'

export function IssuesView() {
  const { teamKey } = useParams()
  const data = useStore()
  const [tab, setTab] = useState<Tab>('active')
  const [layout, setLayout] = useState<ViewLayout>('list')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [orderBy, setOrderBy] = useState<OrderBy>('priority')

  const team = data.teams.find((t) => t.key === teamKey) ?? data.teams[0]

  const groups = useMemo(() => {
    const statesByType = new Map(data.states.map((s) => [s.id, s.type]))
    let scoped = data.issues.filter((i) => i.teamId === team.id)
    if (tab === 'active')
      scoped = scoped.filter((i) => {
        const t = statesByType.get(i.stateId)
        return t === 'unstarted' || t === 'started' || t === 'completed'
      })
    else if (tab === 'backlog')
      scoped = scoped.filter((i) => statesByType.get(i.stateId) === 'backlog')

    const filtered = filterIssues(scoped, {
      statusIds: [],
      assigneeIds: [],
      priorities: [],
      labelIds: [],
      projectIds: [],
    })
    const sorted = sortIssues(filtered, orderBy, data)
    return groupIssues(sorted, layout === 'board' ? 'status' : groupBy, data)
  }, [data, team.id, tab, groupBy, orderBy, layout])

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Issues"
        teamName={team.name}
        teamIcon={team.icon}
        right={
          <DisplayMenu
            layout={layout}
            groupBy={groupBy}
            orderBy={orderBy}
            onLayout={setLayout}
            onGroupBy={setGroupBy}
            onOrderBy={setOrderBy}
          />
        }
      >
        <div className="flex items-center gap-1">
          {(['active', 'backlog', 'all'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] capitalize text-muted hover:bg-bg-hover',
                tab === t && 'bg-bg-selected text-fg font-medium',
              )}
            >
              {t === 'all' ? 'All issues' : t}
            </button>
          ))}
        </div>
      </ViewHeader>

      {layout === 'board' ? (
        <IssueBoard groups={groups} />
      ) : (
        <GroupedIssueList groups={groups} groupBy={groupBy} />
      )}
    </div>
  )
}
