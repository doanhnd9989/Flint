import {
  SlidersHorizontal,
  LayoutList,
  Columns3,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
} from 'lucide-react'
import { Popover } from './ui/Popover'
import { useStoreShallow } from '@/lib/store'
import { DISPLAY_PROPERTIES, DEFAULT_DISPLAY_PROPERTIES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type {
  DisplayProperty,
  GroupBy,
  OrderBy,
  OrderDir,
  ViewLayout,
} from '@/lib/types'

interface Props {
  layout: ViewLayout
  groupBy: GroupBy
  orderBy: OrderBy
  onLayout: (l: ViewLayout) => void
  onGroupBy: (g: GroupBy) => void
  onOrderBy: (o: OrderBy) => void
  /** Ordering direction — optional; the arrow only renders when given. */
  orderDir?: OrderDir
  onOrderDir?: (d: OrderDir) => void
  /** Sub-grouping — optional; the row only renders when a handler is given. */
  subGroupBy?: GroupBy
  onSubGroupBy?: (g: GroupBy) => void
  /** "Order completed by recency" — optional; only renders when given. */
  orderCompletedByRecency?: boolean
  onOrderCompletedByRecency?: (v: boolean) => void
  /** List options — optional; the section only renders when handlers are given. */
  showSubIssues?: boolean
  onShowSubIssues?: (v: boolean) => void
  nestedSubIssues?: boolean
  onNestedSubIssues?: (v: boolean) => void
  showEmptyGroups?: boolean
  onShowEmptyGroups?: (v: boolean) => void
}

// Linear's Grouping dropdown order: No grouping, Status, Assignee, (Agent),
// Project, Priority, Label. We omit "Agent" (not modeled).
const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'none', label: 'No grouping' },
  { id: 'status', label: 'Status' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'project', label: 'Project' },
  { id: 'priority', label: 'Priority' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'milestone', label: 'Milestone' },
  { id: 'label', label: 'Label' },
]

// Linear's Sub-grouping dropdown — "No grouping" first, then the same keys as
// Grouping (we omit "Agent", which we don't model).
const SUBGROUPS: { id: GroupBy; label: string }[] = [
  { id: 'none', label: 'No grouping' },
  { id: 'status', label: 'Status' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'project', label: 'Project' },
  { id: 'priority', label: 'Priority' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'milestone', label: 'Milestone' },
  { id: 'label', label: 'Label' },
]

// Linear's Ordering dropdown order: Manual, Title, Status, Priority, Assignee,
// (Agent), Estimate, Updated, Created, Due date, Link count, (Time in status).
// We omit "Agent" and "Time in status" (no data to back them).
const ORDERS: { id: OrderBy; label: string }[] = [
  { id: 'manual', label: 'Manual' },
  { id: 'title', label: 'Title' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'estimate', label: 'Estimate' },
  { id: 'updated', label: 'Updated' },
  { id: 'created', label: 'Created' },
  { id: 'dueDate', label: 'Due date' },
  { id: 'linkCount', label: 'Link count' },
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
  orderDir,
  onOrderDir,
  subGroupBy,
  onSubGroupBy,
  orderCompletedByRecency,
  onOrderCompletedByRecency,
  showSubIssues,
  onShowSubIssues,
  nestedSubIssues,
  onNestedSubIssues,
  showEmptyGroups,
  onShowEmptyGroups,
}: Props) {
  const { displayProperties, toggleDisplayProperty, hideCompleted, toggleHideCompleted } =
    useStoreShallow((s) => ({
      displayProperties: s.displayProperties,
      toggleDisplayProperty: s.toggleDisplayProperty,
      hideCompleted: s.hideCompleted,
      toggleHideCompleted: s.toggleHideCompleted,
    }))

  // Linear's "Reset to default" — restores the view's display config to the
  // app defaults. Display properties have no bulk-reset store action, so we
  // toggle just the ones that currently differ from DEFAULT_DISPLAY_PROPERTIES.
  // Layout/grouping/ordering reset through the parent callbacks. The button is
  // disabled (greyed, like Linear) when everything already matches the default.
  const propsDirty = DISPLAY_PROPERTIES.some(
    (p) => displayProperties[p.id] !== DEFAULT_DISPLAY_PROPERTIES[p.id],
  )
  const configDirty =
    layout !== 'list' ||
    groupBy !== 'status' ||
    orderBy !== 'manual' ||
    (orderDir ?? 'asc') !== 'asc' ||
    (subGroupBy ?? 'none') !== 'none' ||
    orderCompletedByRecency === true
  const isDirty = propsDirty || configDirty

  function resetToDefault() {
    onLayout('list')
    onGroupBy('status')
    onOrderBy('manual')
    onOrderDir?.('asc')
    onSubGroupBy?.('none')
    onOrderCompletedByRecency?.(false)
    for (const p of DISPLAY_PROPERTIES) {
      if (displayProperties[p.id] !== DEFAULT_DISPLAY_PROPERTIES[p.id]) {
        toggleDisplayProperty(p.id as DisplayProperty)
      }
    }
  }

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
          <Row label={layout === 'board' ? 'Columns' : 'Grouping'}>
            <Seg value={groupBy} options={GROUPS} onChange={onGroupBy} />
          </Row>
          {onSubGroupBy && (
            <Row label={layout === 'board' ? 'Rows' : 'Sub-grouping'}>
              <Seg
                value={subGroupBy ?? 'none'}
                options={SUBGROUPS}
                onChange={onSubGroupBy}
              />
            </Row>
          )}
          <Row label="Ordering">
            {onOrderDir && (
              <button
                type="button"
                title={
                  (orderDir ?? 'asc') === 'asc'
                    ? 'Ascending — click for descending'
                    : 'Descending — click for ascending'
                }
                onClick={() =>
                  onOrderDir((orderDir ?? 'asc') === 'asc' ? 'desc' : 'asc')
                }
                className={cn(
                  'flex items-center justify-center rounded-md p-1 text-muted hover:bg-bg-hover',
                  (orderDir ?? 'asc') === 'desc' && 'bg-bg-selected text-fg',
                )}
              >
                {(orderDir ?? 'asc') === 'asc' ? (
                  <ArrowUpNarrowWide size={14} />
                ) : (
                  <ArrowDownWideNarrow size={14} />
                )}
              </button>
            )}
            <Seg value={orderBy} options={ORDERS} onChange={onOrderBy} />
          </Row>
          {onOrderCompletedByRecency && (
            <ToggleRow
              label="Order completed by recency"
              checked={orderCompletedByRecency ?? false}
              onChange={onOrderCompletedByRecency}
            />
          )}

          <ToggleRow
            label="Show completed issues"
            checked={!hideCompleted}
            onChange={() => toggleHideCompleted()}
          />

          {onShowSubIssues && (
            <ToggleRow
              label="Show sub-issues"
              checked={showSubIssues ?? true}
              onChange={onShowSubIssues}
            />
          )}

          {((onNestedSubIssues && layout === 'list') || onShowEmptyGroups) && (
            <>
              <div className="my-1.5 border-t border-border" />
              <div className="px-2 pt-0.5 pb-0.5 text-[12px] text-muted">
                {layout === 'board' ? 'Board options' : 'List options'}
              </div>
              {onNestedSubIssues && layout === 'list' && (
                <ToggleRow
                  label="Nested sub-issues"
                  checked={nestedSubIssues ?? false}
                  onChange={onNestedSubIssues}
                />
              )}
              {onShowEmptyGroups && (
                <ToggleRow
                  label={layout === 'board' ? 'Show empty columns' : 'Show empty groups'}
                  checked={showEmptyGroups ?? false}
                  onChange={onShowEmptyGroups}
                />
              )}
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

          <div className="my-1.5 border-t border-border" />
          <button
            type="button"
            disabled={!isDirty}
            onClick={resetToDefault}
            className={cn(
              'w-full rounded-md px-2 py-1.5 text-left text-[12px] transition-colors',
              isDirty
                ? 'text-fg hover:bg-bg-hover'
                : 'cursor-default text-faint',
            )}
          >
            Reset to default
          </button>
        </div>
      )}
    </Popover>
  )
}
