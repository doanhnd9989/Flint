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
  const selectedIssueIds = useStore((s) => s.selectedIssueIds)
  const setSelectedIssues = useStore((s) => s.setSelectedIssues)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const anySelected = selectedIssueIds.length > 0

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
