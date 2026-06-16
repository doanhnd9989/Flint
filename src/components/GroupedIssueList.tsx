import { useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import type { IssueGroup } from '@/lib/selectors'
import type { GroupBy } from '@/lib/types'
import { useStore } from '@/lib/store'
import { IssueRow } from './IssueRow'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { cn } from '@/lib/utils'

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
  return null
}

export function GroupedIssueList({
  groups,
  groupBy,
}: {
  groups: IssueGroup[]
  groupBy: GroupBy
}) {
  const setCreateOpen = useStore((s) => s.setCreateOpen)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (groups.every((g) => g.count === 0)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-faint">
        <div className="text-[15px]">No issues</div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-accent px-3 py-1.5 text-[13px] text-white hover:bg-accent-hover"
        >
          Create issue
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {groups.map((group) => {
        const isCollapsed = collapsed[group.key]
        return (
          <div key={group.key}>
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-bg-secondary/95 px-4 py-1.5 backdrop-blur border-b border-border">
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
                onClick={() => setCreateOpen(true)}
                className="flex h-5 w-5 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
              >
                <Plus size={14} />
              </button>
            </div>
            {!isCollapsed &&
              group.issues.map((issue) => (
                <IssueRow key={issue.id} issue={issue} showStatus={groupBy !== 'status'} />
              ))}
          </div>
        )
      })}
    </div>
  )
}
