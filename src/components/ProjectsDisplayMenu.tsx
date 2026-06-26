import { SlidersHorizontal, LayoutList, LayoutGrid, GanttChartSquare } from 'lucide-react'
import { Popover } from './ui/Popover'
import { cn } from '@/lib/utils'

export type ProjectLayout = 'list' | 'board' | 'timeline'
export type ProjectGroupBy = 'none' | 'status' | 'health' | 'lead'
export type ProjectOrderBy = 'manual' | 'name' | 'targetDate' | 'created'
export type ProjectProperty =
  | 'status'
  | 'health'
  | 'lead'
  | 'members'
  | 'targetDate'
  | 'issues'

export const PROJECT_PROPERTIES: { id: ProjectProperty; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'health', label: 'Health' },
  { id: 'lead', label: 'Lead' },
  { id: 'members', label: 'Members' },
  { id: 'targetDate', label: 'Target date' },
  { id: 'issues', label: 'Issues' },
]

export const DEFAULT_PROJECT_PROPERTIES: Record<ProjectProperty, boolean> = {
  status: true,
  health: true,
  lead: true,
  members: false,
  targetDate: true,
  issues: true,
}

const GROUPS: { id: ProjectGroupBy; label: string }[] = [
  { id: 'none', label: 'No grouping' },
  { id: 'status', label: 'Status' },
  { id: 'health', label: 'Health' },
  { id: 'lead', label: 'Lead' },
]

const ORDERS: { id: ProjectOrderBy; label: string }[] = [
  { id: 'manual', label: 'Manual' },
  { id: 'name', label: 'Name' },
  { id: 'targetDate', label: 'Target date' },
  { id: 'created', label: 'Created' },
]

function Row({ label, children }: { label: string; children: React.ReactNode }) {
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

interface Props {
  layout: ProjectLayout
  groupBy: ProjectGroupBy
  orderBy: ProjectOrderBy
  properties: Record<ProjectProperty, boolean>
  onLayout: (l: ProjectLayout) => void
  onGroupBy: (g: ProjectGroupBy) => void
  onOrderBy: (o: ProjectOrderBy) => void
  onToggleProperty: (p: ProjectProperty) => void
}

const LAYOUTS = [
  { value: 'list' as const, label: 'List', icon: <LayoutList size={13} /> },
  { value: 'board' as const, label: 'Board', icon: <LayoutGrid size={13} /> },
  { value: 'timeline' as const, label: 'Timeline', icon: <GanttChartSquare size={13} /> },
]

/** Display options popover for the Projects view — mirrors Linear's. */
export function ProjectsDisplayMenu({
  layout,
  groupBy,
  orderBy,
  properties,
  onLayout,
  onGroupBy,
  onOrderBy,
  onToggleProperty,
}: Props) {
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
            <div className="flex gap-1">
              {LAYOUTS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => onLayout(l.value)}
                  className={
                    'flex items-center gap-1 rounded-md px-2 py-1 text-[12px] ' +
                    (layout === l.value
                      ? 'bg-bg-selected text-fg'
                      : 'text-muted hover:bg-bg-hover')
                  }
                >
                  {l.icon} {l.label}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Grouping">
            <Seg value={groupBy} options={GROUPS} onChange={onGroupBy} />
          </Row>
          <Row label="Ordering">
            <Seg value={orderBy} options={ORDERS} onChange={onOrderBy} />
          </Row>

          <div className="my-1.5 border-t border-border" />
          <div className="px-2 pt-0.5 pb-1 text-[12px] text-muted">
            Display properties
          </div>
          <div className="flex flex-wrap gap-1.5 px-2 pb-1.5">
            {PROJECT_PROPERTIES.map((p) => {
              const on = properties[p.id]
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onToggleProperty(p.id)}
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
