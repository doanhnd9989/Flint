import { SlidersHorizontal, LayoutList, Columns3 } from 'lucide-react'
import { Popover } from './ui/Popover'
import { cn } from '@/lib/utils'
import type { GroupBy, OrderBy, ViewLayout } from '@/lib/types'

interface Props {
  layout: ViewLayout
  groupBy: GroupBy
  orderBy: OrderBy
  onLayout: (l: ViewLayout) => void
  onGroupBy: (g: GroupBy) => void
  onOrderBy: (o: OrderBy) => void
}

const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'priority', label: 'Priority' },
  { id: 'project', label: 'Project' },
  { id: 'label', label: 'Label' },
  { id: 'none', label: 'No grouping' },
]

const ORDERS: { id: OrderBy; label: string }[] = [
  { id: 'priority', label: 'Priority' },
  { id: 'updated', label: 'Last updated' },
  { id: 'created', label: 'Created' },
  { id: 'title', label: 'Title' },
  { id: 'manual', label: 'Manual' },
]

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <span className="text-[12px] text-muted">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  )
}

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-fg outline-none"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function DisplayMenu({
  layout,
  groupBy,
  orderBy,
  onLayout,
  onGroupBy,
  onOrderBy,
}: Props) {
  return (
    <Popover
      width={260}
      align="end"
      trigger={
        <span className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover">
          <SlidersHorizontal size={13} />
          Display
        </span>
      }
    >
      {() => (
        <div>
          <Row label="Layout">
            <button
              type="button"
              onClick={() => onLayout('list')}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted hover:bg-bg-hover',
                layout === 'list' && 'bg-bg-selected text-fg',
              )}
            >
              <LayoutList size={13} /> List
            </button>
            <button
              type="button"
              onClick={() => onLayout('board')}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted hover:bg-bg-hover',
                layout === 'board' && 'bg-bg-selected text-fg',
              )}
            >
              <Columns3 size={13} /> Board
            </button>
          </Row>
          <Row label="Grouping">
            <Seg value={groupBy} options={GROUPS} onChange={onGroupBy} />
          </Row>
          <Row label="Ordering">
            <Seg value={orderBy} options={ORDERS} onChange={onOrderBy} />
          </Row>
        </div>
      )}
    </Popover>
  )
}
