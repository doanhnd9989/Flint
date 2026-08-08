import { SlidersHorizontal, LayoutList, LayoutGrid } from 'lucide-react'
import { Popover } from './ui/Popover'
import { cn } from '@/lib/utils'

export type InitiativeLayout = 'list' | 'board'
export type InitiativeGroupBy = 'none' | 'owner' | 'health' | 'status'
export type InitiativeOrderBy =
  | 'manual'
  | 'name'
  | 'status'
  | 'healthUpdated'
  | 'targetDate'
export type InitiativeProperty =
  | 'description'
  | 'owner'
  | 'status'
  | 'health'
  | 'projects'
  | 'activeProjects'
  | 'targetDate'
  | 'created'

/**
 * Linear's Display-properties chips, in its order. Its list also carries
 * Priority, Teams, Labels, Updated and Completed — an `Initiative` here has no
 * field behind any of them, so they are absent rather than dead. Logged in
 * BACKLOG.md.
 */
export const INITIATIVE_PROPERTIES: { id: InitiativeProperty; label: string }[] = [
  { id: 'description', label: 'Description' },
  { id: 'owner', label: 'Owner' },
  { id: 'status', label: 'Status' },
  { id: 'health', label: 'Health' },
  { id: 'projects', label: 'Projects' },
  { id: 'activeProjects', label: 'Active projects' },
  { id: 'targetDate', label: 'Target date' },
  { id: 'created', label: 'Created' },
]

/** Linear's defaults: everything on except Created. */
export const DEFAULT_INITIATIVE_PROPERTIES: Record<InitiativeProperty, boolean> = {
  description: true,
  owner: true,
  status: true,
  health: true,
  projects: true,
  activeProjects: true,
  targetDate: true,
  created: false,
}

const GROUPS: { id: InitiativeGroupBy; label: string }[] = [
  { id: 'none', label: 'No grouping' },
  { id: 'owner', label: 'Owner' },
  { id: 'health', label: 'Health' },
  { id: 'status', label: 'Status' },
]

const ORDERS: { id: InitiativeOrderBy; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'status', label: 'Status' },
  { id: 'manual', label: 'Manual' },
  { id: 'healthUpdated', label: 'Health updated' },
  { id: 'targetDate', label: 'Target date' },
]

const LAYOUTS = [
  { value: 'list' as const, label: 'List', icon: <LayoutList size={13} /> },
  { value: 'board' as const, label: 'Board', icon: <LayoutGrid size={13} /> },
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
  label,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <select
      aria-label={label}
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
  layout: InitiativeLayout
  groupBy: InitiativeGroupBy
  orderBy: InitiativeOrderBy
  properties: Record<InitiativeProperty, boolean>
  onLayout: (l: InitiativeLayout) => void
  onGroupBy: (g: InitiativeGroupBy) => void
  onOrderBy: (o: InitiativeOrderBy) => void
  onToggleProperty: (p: InitiativeProperty) => void
  onReset: () => void
}

/**
 * Display options for the Initiatives view — Linear's rows in Linear's order:
 * Grouping, Ordering, then the Display-properties chip grid.
 *
 * The Layout row is ours: Linear's initiatives view is list-only, but this app
 * already renders initiative cards, so the board stays reachable from the same
 * menu instead of a toolbar toggle Linear doesn't have. Noted in PROGRESS.md.
 */
export function InitiativesDisplayMenu({
  layout,
  groupBy,
  orderBy,
  properties,
  onLayout,
  onGroupBy,
  onOrderBy,
  onToggleProperty,
  onReset,
}: Props) {
  return (
    <Popover
      width={272}
      align="end"
      label="Display options"
      trigger={
        <span className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg">
          <SlidersHorizontal size={15} />
        </span>
      }
    >
      {() => (
        <div>
          <Row label="Layout">
            <div role="tablist" aria-label="Layout" className="flex gap-1">
              {LAYOUTS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  role="tab"
                  aria-selected={layout === l.value}
                  onClick={() => onLayout(l.value)}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-1 text-[12px]',
                    layout === l.value
                      ? 'bg-bg-selected text-fg'
                      : 'text-muted hover:bg-bg-hover',
                  )}
                >
                  {l.icon} {l.label}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Grouping">
            <Seg label="Grouping" value={groupBy} options={GROUPS} onChange={onGroupBy} />
          </Row>
          <Row label="Ordering">
            <Seg label="Ordering" value={orderBy} options={ORDERS} onChange={onOrderBy} />
          </Row>

          <div className="my-1.5 border-t border-border" />
          <div className="px-2 pt-0.5 pb-1 text-[12px] text-muted">
            Display properties
          </div>
          <div className="flex flex-wrap gap-1.5 px-2 pb-1.5">
            {INITIATIVE_PROPERTIES.map((p) => {
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

          {/* Linear closes the menu with a Reset / Set default footer. Only the
              half that has somewhere to write is built — view defaults are
              per-workspace in Linear and there is no such record here. */}
          <div className="mt-1 flex items-center justify-end border-t border-border px-2 py-1.5">
            <button
              type="button"
              onClick={onReset}
              className="rounded-md px-2 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </Popover>
  )
}
