import { SlidersHorizontal, LayoutList, Columns3 } from 'lucide-react'
import { Popover } from './ui/Popover'
import { useStoreShallow } from '@/lib/store'
import { DISPLAY_PROPERTIES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { GroupBy, OrderBy, ViewLayout } from '@/lib/types'

interface Props {
  layout: ViewLayout
  groupBy: GroupBy
  orderBy: OrderBy
  onLayout: (l: ViewLayout) => void
  onGroupBy: (g: GroupBy) => void
  onOrderBy: (o: OrderBy) => void
  /** List options — optional; the section only renders when handlers are given. */
  showSubIssues?: boolean
  onShowSubIssues?: (v: boolean) => void
  showEmptyGroups?: boolean
  onShowEmptyGroups?: (v: boolean) => void
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

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <span className="text-[12px] text-fg">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-4 w-7 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-bg-tertiary',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </button>
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
  showSubIssues,
  onShowSubIssues,
  showEmptyGroups,
  onShowEmptyGroups,
}: Props) {
  const { displayProperties, toggleDisplayProperty } = useStoreShallow((s) => ({
    displayProperties: s.displayProperties,
    toggleDisplayProperty: s.toggleDisplayProperty,
  }))
  return (
    <Popover
      width={272}
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

          {onShowSubIssues && (
            <ToggleRow
              label="Show sub-issues"
              checked={showSubIssues ?? true}
              onChange={onShowSubIssues}
            />
          )}

          {onShowEmptyGroups && (
            <>
              <div className="my-1.5 border-t border-border" />
              <div className="px-2 pt-0.5 pb-0.5 text-[12px] text-muted">
                List options
              </div>
              <ToggleRow
                label="Show empty groups"
                checked={showEmptyGroups ?? false}
                onChange={onShowEmptyGroups}
              />
            </>
          )}

          <div className="my-1.5 border-t border-border" />
          <div className="px-2 pt-0.5 pb-1 text-[12px] text-muted">
            Display properties
          </div>
          <div className="flex flex-wrap gap-1.5 px-2 pb-1.5">
            {DISPLAY_PROPERTIES.map((p) => {
              const on = displayProperties[p.id]
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleDisplayProperty(p.id)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[12px] transition-colors',
                    on
                      ? 'bg-bg-selected text-fg'
                      : 'border border-border text-muted hover:bg-bg-hover',
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </Popover>
  )
}
