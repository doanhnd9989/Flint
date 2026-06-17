import { useEffect, useRef, useState } from 'react'
import type { IssueGroup } from '@/lib/selectors'
import type { GroupBy, Issue } from '@/lib/types'
import { IssueRow } from './IssueRow'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { useStore } from '@/lib/store'

const ITEM_H = 36
const OVERSCAN = 8

type Row =
  | { kind: 'header'; group: IssueGroup }
  | { kind: 'issue'; issue: Issue }

function HeaderGlyph({ group, groupBy }: { group: IssueGroup; groupBy: GroupBy }) {
  const states = useStore((s) => s.states)
  const users = useStore((s) => s.users)
  if (groupBy === 'status') {
    const st = states.find((s) => s.id === group.stateId)
    return st ? <StatusIcon type={st.type} color={st.color} /> : null
  }
  if (groupBy === 'priority')
    return <PriorityIcon priority={Number(group.key) as 0 | 1 | 2 | 3 | 4} />
  if (groupBy === 'assignee')
    return <Avatar user={users.find((x) => x.id === group.key)} size={16} />
  if (groupBy === 'project') return <span className="text-[13px]">{group.icon ?? '○'}</span>
  if (groupBy === 'label') return group.color ? <LabelDot color={group.color} /> : null
  return null
}

/**
 * Windowed renderer for large grouped issue lists — only the rows visible in the
 * viewport are mounted, so a list with thousands of issues stays smooth.
 * Fixed row height keeps the math exact; used in place of the dnd list above a
 * size threshold (so reorder/collapse drop out, which is the right trade-off
 * for very large lists).
 */
export function VirtualIssueList({
  groups,
  groupBy,
}: {
  groups: IssueGroup[]
  groupBy: GroupBy
}) {
  const rows: Row[] = []
  for (const group of groups) {
    rows.push({ kind: 'header', group })
    for (const issue of group.issues) rows.push({ kind: 'issue', issue })
  }

  const ref = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(800)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setHeight(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const total = rows.length
  const start = Math.max(0, Math.floor(scrollTop / ITEM_H) - OVERSCAN)
  const end = Math.min(total, Math.ceil((scrollTop + height) / ITEM_H) + OVERSCAN)
  const visible = rows.slice(start, end)

  return (
    <div
      ref={ref}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="flex-1 overflow-y-auto"
    >
      <div style={{ height: total * ITEM_H, position: 'relative' }}>
        <div style={{ transform: `translateY(${start * ITEM_H}px)` }}>
          {visible.map((row, i) =>
            row.kind === 'header' ? (
              <div
                key={`h-${row.group.key}-${start + i}`}
                className="flex items-center gap-2 border-b border-border bg-bg-secondary px-4"
                style={{ height: ITEM_H }}
              >
                <HeaderGlyph group={row.group} groupBy={groupBy} />
                <span className="text-[13px] font-medium text-fg">{row.group.label}</span>
                <span className="text-[12px] text-faint">{row.group.count}</span>
              </div>
            ) : (
              <div key={row.issue.id} style={{ height: ITEM_H }} className="overflow-hidden">
                <IssueRow issue={row.issue} showStatus={groupBy !== 'status'} />
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
