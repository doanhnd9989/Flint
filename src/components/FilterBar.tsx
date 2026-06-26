import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Filter,
  X,
  Plus,
  IterationCw,
  Diamond,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Type,
} from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { Popover } from './ui/Popover'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { PRIORITY_LABELS, PRIORITY_ORDER, STATUS_TYPE_ORDER } from '@/lib/constants'
import type { DateField, DateFilter, FilterState, Priority } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type Dim =
  | 'statusIds'
  | 'assigneeIds'
  | 'creatorIds'
  | 'priorities'
  | 'labelIds'
  | 'projectIds'
  | 'cycleIds'
  | 'milestoneIds'
  | 'subscriberIds'

const DIMS: { id: Dim; label: string }[] = [
  { id: 'statusIds', label: 'Status' },
  { id: 'assigneeIds', label: 'Assignee' },
  { id: 'creatorIds', label: 'Creator' },
  { id: 'priorities', label: 'Priority' },
  { id: 'labelIds', label: 'Label' },
  { id: 'projectIds', label: 'Project' },
  { id: 'cycleIds', label: 'Cycle' },
  { id: 'milestoneIds', label: 'Milestone' },
  { id: 'subscriberIds', label: 'Subscribers' },
]

/** Linear's Dates submenu — we back the four fields we track timestamps for. */
const DATE_FIELDS: { id: DateField; label: string }[] = [
  { id: 'due', label: 'Due date' },
  { id: 'created', label: 'Created date' },
  { id: 'updated', label: 'Updated date' },
  { id: 'completed', label: 'Completed date' },
]

/** Linear's relative quick-pick periods, in order. */
const DATE_PERIODS: { value: string; label: string }[] = [
  { value: '1d', label: '1 day ago' },
  { value: '3d', label: '3 days ago' },
  { value: '1w', label: '1 week ago' },
  { value: '1m', label: '1 month ago' },
  { value: '3m', label: '3 months ago' },
  { value: '6m', label: '6 months ago' },
  { value: '1y', label: '1 year ago' },
]

function dateFieldLabel(field: DateField): string {
  return DATE_FIELDS.find((f) => f.id === field)?.label ?? field
}

/** A custom absolute day is stored as a plain `YYYY-MM-DD` string. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** Any absolute calendar period: day · month · quarter · half-year · year. */
const ABSOLUTE_DATE = /^(\d{4}-\d{2}-\d{2}|\d{4}-\d{2}|\d{4}-Q[1-4]|\d{4}-H[12]|\d{4})$/

function isAbsoluteDate(value: string): boolean {
  return ABSOLUTE_DATE.test(value)
}

function datePeriodLabel(value: string): string {
  if (ISO_DATE.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString(
      'en-US',
      dt.getFullYear() === new Date().getFullYear()
        ? { month: 'short', day: 'numeric' }
        : { month: 'short', day: 'numeric', year: 'numeric' },
    )
  }
  const month = value.match(/^(\d{4})-(\d{2})$/)
  if (month) {
    const [, y, m] = month.map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  const q = value.match(/^(\d{4})-Q([1-4])$/)
  if (q) return `Q${q[2]} ${q[1]}`
  const h = value.match(/^(\d{4})-H([12])$/)
  if (h) return `H${h[2]} ${h[1]}`
  if (/^\d{4}$/.test(value)) return value
  return DATE_PERIODS.find((p) => p.value === value)?.label ?? value
}

export function emptyFilters(): FilterState {
  return {
    statusIds: [],
    assigneeIds: [],
    priorities: [],
    labelIds: [],
    projectIds: [],
    creatorIds: [],
    subscriberIds: [],
    cycleIds: [],
    milestoneIds: [],
    dates: [],
  }
}

export function hasActiveFilters(f: FilterState): boolean {
  return (
    DIMS.some((d) => ((f[d.id] as unknown[]) ?? []).length > 0) ||
    (f.dates ?? []).length > 0 ||
    !!f.text?.trim()
  )
}

interface ValueOption {
  id: string
  label: string
  icon: ReactNode
}

function useDimOptions(): Record<Dim, ValueOption[]> {
  const states = useStore((s) => s.states)
  const users = useStore((s) => s.users)
  const fmt = useDisplayName()
  const labels = useStore((s) => s.labels)
  const projects = useStore((s) => s.projects)
  const cycles = useStore((s) => s.cycles)
  const milestones = useStore((s) => s.milestones)

  return {
    statusIds: [...states]
      .sort((a, b) => STATUS_TYPE_ORDER[a.type] - STATUS_TYPE_ORDER[b.type] || a.position - b.position)
      .map((st) => ({ id: st.id, label: st.name, icon: <StatusIcon type={st.type} color={st.color} /> })),
    assigneeIds: users.map((u) => ({ id: u.id, label: fmt(u.name), icon: <Avatar user={u} size={16} /> })),
    creatorIds: users.map((u) => ({ id: u.id, label: fmt(u.name), icon: <Avatar user={u} size={16} /> })),
    subscriberIds: users.map((u) => ({ id: u.id, label: fmt(u.name), icon: <Avatar user={u} size={16} /> })),
    priorities: PRIORITY_ORDER.map((p) => ({
      id: String(p),
      label: PRIORITY_LABELS[p],
      icon: <PriorityIcon priority={p} />,
    })),
    labelIds: labels.filter((l) => !l.isGroup).map((l) => ({ id: l.id, label: l.name, icon: <LabelDot color={l.color} /> })),
    projectIds: projects.map((p) => ({ id: p.id, label: p.name, icon: <span>{p.icon}</span> })),
    cycleIds: [...cycles]
      .sort((a, b) => b.number - a.number)
      .map((c) => ({
        id: c.id,
        label: c.name ?? `Cycle ${c.number}`,
        icon: <IterationCw size={14} className="text-faint" />,
      })),
    milestoneIds: [...milestones]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        id: m.id,
        label: m.name,
        icon: <Diamond size={12} className="text-faint" />,
      })),
  }
}

function valuesOf(f: FilterState, dim: Dim): string[] {
  if (dim === 'priorities') return f.priorities.map(String)
  return (f[dim] as string[] | undefined) ?? []
}

function setValues(f: FilterState, dim: Dim, ids: string[]): FilterState {
  if (dim === 'priorities')
    return { ...f, priorities: ids.map((x) => Number(x) as Priority) }
  return { ...f, [dim]: ids }
}

function isNegated(f: FilterState, dim: Dim): boolean {
  return !!f.negate?.[dim]
}

function setNegate(f: FilterState, dim: Dim, neg: boolean): FilterState {
  const next = { ...(f.negate ?? {}) }
  if (neg) next[dim] = true
  else delete next[dim]
  return { ...f, negate: next }
}

/** Removing a dimension's chip drops both its values and its operator. */
function clearDim(f: FilterState, dim: Dim): FilterState {
  const cleared = setNegate(setValues(f, dim, []), dim, false)
  // The Label dimension also carries an "includes all of" operator.
  return dim === 'labelIds' ? setLabelMatchAll(cleared, false) : cleared
}

/** Linear's operator wording: positive flips to "is any of" with 2+ values. */
function operatorLabel(negated: boolean, count: number): string {
  if (negated) return 'is not'
  return count > 1 ? 'is any of' : 'is'
}

/** Whether the Label dimension requires an issue to carry ALL selected labels. */
function isLabelMatchAll(f: FilterState): boolean {
  return !!f.labelMatchAll
}

function setLabelMatchAll(f: FilterState, all: boolean): FilterState {
  return { ...f, labelMatchAll: all }
}

/**
 * Linear's Label operator wording. The "includes all of" toggle is only
 * meaningful when not negated; with a single value all three read the same.
 */
function labelOperatorLabel(negated: boolean, matchAll: boolean, count: number): string {
  if (negated) return 'is not'
  if (matchAll && count > 1) return 'includes all of'
  return count > 1 ? 'includes any of' : 'includes'
}

const CheckMark = (
  <svg width="14" height="14" viewBox="0 0 16 16" className="text-accent">
    <path
      d="M3.5 8.5l3 3 6-6.5"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

function OperatorMenu({
  negated,
  count,
  onSelect,
}: {
  negated: boolean
  count: number
  onSelect: (negated: boolean) => void
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(false)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
      >
        {count > 1 ? 'is any of' : 'is'}
        {!negated && CheckMark}
      </button>
      <button
        type="button"
        onClick={() => onSelect(true)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
      >
        is not
        {negated && CheckMark}
      </button>
    </div>
  )
}

/**
 * Label dimension operator menu: Linear offers "includes any of" / "includes
 * all of" (the AND operator) / "is not". `matchAll` and `negated` are mutually
 * exclusive selections.
 */
function LabelOperatorMenu({
  negated,
  matchAll,
  count,
  onSelect,
}: {
  negated: boolean
  matchAll: boolean
  count: number
  onSelect: (op: { negated: boolean; matchAll: boolean }) => void
}) {
  const isAny = !negated && !matchAll
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect({ negated: false, matchAll: false })}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
      >
        {count > 1 ? 'includes any of' : 'includes'}
        {isAny && CheckMark}
      </button>
      <button
        type="button"
        onClick={() => onSelect({ negated: false, matchAll: true })}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
      >
        includes all of
        {!negated && matchAll && CheckMark}
      </button>
      <button
        type="button"
        onClick={() => onSelect({ negated: true, matchAll: false })}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
      >
        is not
        {negated && CheckMark}
      </button>
    </div>
  )
}

function ValueList({
  options,
  selected,
  onToggle,
  query,
}: {
  options: ValueOption[]
  selected: string[]
  onToggle: (id: string) => void
  query?: string
}) {
  const q = (query ?? '').trim().toLowerCase()
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  if (shown.length === 0)
    return <div className="px-2 py-3 text-center text-[12px] text-faint">No results</div>
  return (
    <div className="max-h-64 overflow-y-auto">
      {shown.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onToggle(o.id)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
        >
          <span className="flex h-4 w-4 items-center justify-center">{o.icon}</span>
          <span className="flex-1 truncate">{o.label}</span>
          {selected.includes(o.id) && (
            <svg width="14" height="14" viewBox="0 0 16 16" className="text-accent">
              <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ))}
    </div>
  )
}

/** Append a date filter (default operator "after", matching Linear). */
function addDateFilter(f: FilterState, field: DateField, value: string): FilterState {
  const next: DateFilter = { field, op: 'after', value }
  return { ...f, dates: [...(f.dates ?? []), next] }
}

function AddFilterPanel({
  filters,
  onChange,
  onPicked,
  onCustom,
}: {
  filters: FilterState
  onChange: (f: FilterState) => void
  onPicked: () => void
  onCustom: (req: CustomReq) => void
}) {
  // null = root · Dim = that dimension's value list · 'dates' = date-field list ·
  // DateField = that field's relative-period list · 'text' = content text input.
  const [nav, setNav] = useState<Dim | 'dates' | DateField | 'text' | null>(null)
  // Type-to-filter query, shared by the root dimension menu and each value list
  // (Linear's filter popover always opens focused on this input). Cleared on
  // every navigation so each level starts fresh.
  const [query, setQuery] = useState('')
  const dimOptions = useDimOptions()

  function go(to: Dim | 'dates' | DateField | 'text' | null) {
    setQuery('')
    setNav(to)
  }

  function toggle(d: Dim, id: string) {
    const cur = valuesOf(filters, d)
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    const f = setValues(filters, d, next)
    onChange(next.length ? f : setNegate(f, d, false))
  }

  // Root menu — type-to-filter across every dimension (incl. Dates).
  if (nav === null) {
    const q = query.trim().toLowerCase()
    const dims = q ? DIMS.filter((d) => d.label.toLowerCase().includes(q)) : DIMS
    const showDates = !q || 'dates'.includes(q)
    const showText = !q || 'content'.includes(q) || 'text'.includes(q)
    return (
      <div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter…"
          className="mb-1 w-full rounded-md bg-bg px-2 py-1.5 text-[13px] text-fg outline-none placeholder:text-faint"
        />
        <div className="-mx-1 mb-1 border-t border-border" />
        {dims.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => go(d.id)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
          >
            {d.label}
            {valuesOf(filters, d.id).length > 0 && (
              <span className="text-[11px] text-faint">{valuesOf(filters, d.id).length}</span>
            )}
          </button>
        ))}
        {showText && (
          <button
            type="button"
            onClick={() => go('text')}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
          >
            <span className="flex items-center gap-2">
              <Type size={14} className="text-faint" /> Content
            </span>
          </button>
        )}
        {showDates && (
          <button
            type="button"
            onClick={() => go('dates')}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
          >
            <span className="flex items-center gap-2">
              <CalendarDays size={14} className="text-faint" /> Dates
            </span>
          </button>
        )}
        {dims.length === 0 && !showDates && !showText && (
          <div className="px-2 py-3 text-center text-[12px] text-faint">No results</div>
        )}
      </div>
    )
  }

  // Content text filter — a free-text input matched against title + description.
  if (nav === 'text') {
    return (
      <div>
        <button
          type="button"
          onClick={() => go(null)}
          className="mb-1 flex items-center gap-1 px-2 py-1 text-[11px] text-faint hover:text-fg"
        >
          ‹ Content
        </button>
        <input
          autoFocus
          value={filters.text ?? ''}
          onChange={(e) => onChange({ ...filters, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onPicked()
          }}
          placeholder="Title or description contains…"
          className="w-full rounded-md bg-bg px-2 py-1.5 text-[13px] text-fg outline-none placeholder:text-faint"
        />
      </div>
    )
  }

  // Date-field list.
  if (nav === 'dates') {
    return (
      <div>
        <button
          type="button"
          onClick={() => go(null)}
          className="mb-1 flex items-center gap-1 px-2 py-1 text-[11px] text-faint hover:text-fg"
        >
          ‹ Dates
        </button>
        {DATE_FIELDS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => go(f.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
          >
            <CalendarDays size={14} className="text-faint" /> {f.label}
          </button>
        ))}
      </div>
    )
  }

  // A date field is selected → show its relative-period list.
  if (nav === 'due' || nav === 'created' || nav === 'updated' || nav === 'completed') {
    const field = nav
    return (
      <div>
        <button
          type="button"
          onClick={() => go('dates')}
          className="mb-1 flex items-center gap-1 px-2 py-1 text-[11px] text-faint hover:text-fg"
        >
          ‹ {dateFieldLabel(field)}
        </button>
        {DATE_PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              onChange(addDateFilter(filters, field, p.value))
              onPicked()
            }}
            className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
          >
            {p.label}
          </button>
        ))}
        <div className="my-1 border-t border-border" />
        <button
          type="button"
          onClick={() => {
            onCustom({ field, op: 'after' })
            onPicked()
          }}
          className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
        >
          Custom date or timeframe…
        </button>
      </div>
    )
  }

  // A regular dimension is selected → searchable value list.
  const dim = nav
  return (
    <div>
      <button
        type="button"
        onClick={() => go(null)}
        className="mb-1 flex items-center gap-1 px-2 py-1 text-[11px] text-faint hover:text-fg"
      >
        ‹ {DIMS.find((d) => d.id === dim)!.label}
      </button>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Filter ${DIMS.find((d) => d.id === dim)!.label.toLowerCase()}…`}
        className="mb-1 w-full rounded-md bg-bg px-2 py-1.5 text-[13px] text-fg outline-none placeholder:text-faint"
      />
      <div className="-mx-1 mb-1 border-t border-border" />
      <ValueList
        options={dimOptions[dim]}
        selected={valuesOf(filters, dim)}
        onToggle={(id) => toggle(dim, id)}
        query={query}
      />
    </div>
  )
}

function Chip({
  dim,
  filters,
  onChange,
}: {
  dim: Dim
  filters: FilterState
  onChange: (f: FilterState) => void
}) {
  const dimOptions = useDimOptions()
  const selected = valuesOf(filters, dim)
  if (selected.length === 0) return null
  const opts = dimOptions[dim]
  const names = selected
    .map((id) => opts.find((o) => o.id === id)?.label)
    .filter(Boolean) as string[]
  const display = names.length <= 2 ? names.join(', ') : `${names.length} selected`

  const negated = isNegated(filters, dim)
  const isLabel = dim === 'labelIds'
  const matchAll = isLabel && isLabelMatchAll(filters)

  return (
    <div className="flex items-center overflow-hidden rounded-md border border-border text-[12px]">
      <span className="px-2 py-1 text-faint">{DIMS.find((d) => d.id === dim)!.label}</span>
      <Popover
        align="start"
        width={isLabel ? 180 : 160}
        trigger={
          <span className="border-l border-border bg-bg px-2 py-1 text-muted hover:bg-bg-hover">
            {isLabel
              ? labelOperatorLabel(negated, matchAll, selected.length)
              : operatorLabel(negated, selected.length)}
          </span>
        }
      >
        {(close) =>
          isLabel ? (
            <LabelOperatorMenu
              negated={negated}
              matchAll={matchAll}
              count={selected.length}
              onSelect={({ negated: n, matchAll: all }) => {
                onChange(setLabelMatchAll(setNegate(filters, dim, n), all))
                close()
              }}
            />
          ) : (
            <OperatorMenu
              negated={negated}
              count={selected.length}
              onSelect={(n) => {
                onChange(setNegate(filters, dim, n))
                close()
              }}
            />
          )
        }
      </Popover>
      <Popover
        align="start"
        width={220}
        trigger={
          <span className="border-l border-border bg-bg px-2 py-1 text-fg hover:bg-bg-hover">
            {display}
          </span>
        }
      >
        {() => (
          <ValueList
            options={opts}
            selected={selected}
            onToggle={(id) => {
              const cur = valuesOf(filters, dim)
              const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
              const f = setValues(filters, dim, next)
              onChange(next.length ? f : setNegate(f, dim, false))
            }}
          />
        )}
      </Popover>
      <button
        type="button"
        onClick={() => onChange(clearDim(filters, dim))}
        className="border-l border-border px-1.5 py-1 text-faint hover:bg-bg-hover hover:text-fg"
      >
        <X size={12} />
      </button>
    </div>
  )
}

// ── Custom-date picker (Linear's "Custom date or timeframe…" → Day view) ──────

/** A request to open the custom-date modal, optionally editing chip `index`. */
type CustomReq = {
  field: DateField
  op: 'before' | 'after' | 'in'
  value?: string
  index?: number
}

type Gran = 'day' | 'month' | 'quarter' | 'half' | 'year'

const GRANS: { id: Gran; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'half', label: 'Half-year' },
  { id: 'year', label: 'Year' },
]

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The granularity implied by a stored date-filter value. */
function granOf(value?: string): Gran {
  if (!value) return 'day'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'day'
  if (/^\d{4}-\d{2}$/.test(value)) return 'month'
  if (/^\d{4}-Q[1-4]$/.test(value)) return 'quarter'
  if (/^\d{4}-H[12]$/.test(value)) return 'half'
  if (/^\d{4}$/.test(value)) return 'year'
  return 'day'
}

/** The year embedded in an absolute period value (or the current year). */
function yearOf(value?: string): number {
  const m = value?.match(/^(\d{4})/)
  return m ? Number(m[1]) : new Date().getFullYear()
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

/** Day-of-month cells for a month, Monday-first, with `null` for leading blanks. */
function monthCells(year: number, month: number): (number | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7 // 0 = Monday
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  return cells
}

/** One month grid in the custom-date calendar. */
function MonthGrid({
  year,
  month,
  selected,
  onPick,
}: {
  year: number
  month: number
  selected?: string
  onPick: (iso: string) => void
}) {
  const todayIso = (() => {
    const n = new Date()
    return toIso(n.getFullYear(), n.getMonth(), n.getDate())
  })()
  return (
    <div className="w-[224px]">
      <div className="mb-2 px-1 text-[13px] font-medium text-fg">
        {new Date(year, month, 1).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={cn('text-[11px]', i >= 5 ? 'text-faint' : 'text-muted')}>
            {w}
          </div>
        ))}
        {monthCells(year, month).map((d, i) => {
          if (d === null) return <div key={i} />
          const iso = toIso(year, month, d)
          const weekend = i % 7 >= 5
          const isSel = iso === selected
          const isToday = iso === todayIso
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(iso)}
              className={cn(
                'mx-auto flex h-7 w-7 items-center justify-center rounded-md text-[13px] hover:bg-bg-hover',
                isSel ? 'bg-accent text-white hover:bg-accent' : weekend ? 'text-faint' : 'text-fg',
                isToday && !isSel && 'ring-1 ring-border',
              )}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Linear's "Custom date or timeframe…" modal: a before/after/in operator toggle,
 * Day/Month/Quarter/Half-year/Year granularity tabs, a typed-period input, and a
 * picker matched to the granularity (two-month calendar for Day, period grids
 * otherwise). Apply stores the picked period as the date-filter value
 * (`YYYY-MM-DD` · `YYYY-MM` · `YYYY-Q[1-4]` · `YYYY-H[12]` · `YYYY`).
 */
function CustomDateModal({
  req,
  onApply,
  onClose,
}: {
  req: CustomReq
  onApply: (op: 'before' | 'after' | 'in', value: string) => void
  onClose: () => void
}) {
  const initVal = req.value && isAbsoluteDate(req.value) ? req.value : undefined
  const [gran, setGran] = useState<Gran>(granOf(initVal))
  const [op, setOp] = useState<'before' | 'after' | 'in'>(req.op)
  const [selected, setSelected] = useState<string | undefined>(initVal)
  const [text, setText] = useState('')
  // First of the two visible months in the Day calendar — anchored on the selection.
  const [anchor, setAnchor] = useState(() => {
    const base = initVal && granOf(initVal) === 'day' ? new Date(initVal) : new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  // Year focused by the Month/Quarter/Half pickers.
  const [pYear, setPYear] = useState(() => yearOf(initVal))
  // First year of the 12-year window in the Year picker.
  const [yearBase, setYearBase] = useState(() => yearOf(initVal) - 5)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Switching granularity keeps an existing selection of the same kind, else clears
  // it; 'in' is only valid for non-day granularities.
  function pickGran(g: Gran) {
    setGran(g)
    if (g === 'day' && op === 'in') setOp('after')
    if (granOf(selected) !== g) setSelected(undefined)
  }

  // Parse a typed period and jump the matching picker. Supports `DD/MM/YYYY`,
  // `YYYY-MM-DD`, `Mon YYYY`, `Q[1-4] YYYY`, `H[12] YYYY` (year either side) and a
  // bare `YYYY`.
  function onText(v: string) {
    setText(v)
    const s = v.trim()
    let m
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)) || (m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
      const iso = s.includes('/')
        ? [Number(m[3]), Number(m[2]) - 1, Number(m[1])]
        : [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
      const dt = new Date(iso[0], iso[1], iso[2])
      if (dt.getMonth() !== iso[1]) return // invalid (e.g. 31/02)
      pickGran('day')
      setSelected(toIso(iso[0], iso[1], iso[2]))
      setAnchor(new Date(iso[0], iso[1], 1))
    } else if ((m = s.match(/^([A-Za-z]{3,})\s+(\d{4})$/))) {
      const mi = MONTHS_SHORT.findIndex((mo) => mo.toLowerCase() === m![1].slice(0, 3).toLowerCase())
      if (mi < 0) return
      const y = Number(m[2])
      setGran('month'); setPYear(y); setSelected(`${y}-${pad(mi + 1)}`)
    } else if ((m = s.match(/^Q([1-4])\s+(\d{4})$/i)) || (m = s.match(/^(\d{4})\s+Q([1-4])$/i))) {
      const q = s.toUpperCase().startsWith('Q') ? Number(m[1]) : Number(m[2])
      const y = s.toUpperCase().startsWith('Q') ? Number(m[2]) : Number(m[1])
      setGran('quarter'); setPYear(y); setSelected(`${y}-Q${q}`)
    } else if ((m = s.match(/^H([12])\s+(\d{4})$/i)) || (m = s.match(/^(\d{4})\s+H([12])$/i))) {
      const h = s.toUpperCase().startsWith('H') ? Number(m[1]) : Number(m[2])
      const y = s.toUpperCase().startsWith('H') ? Number(m[2]) : Number(m[1])
      setGran('half'); setPYear(y); setSelected(`${y}-H${h}`)
    } else if ((m = s.match(/^(\d{4})$/))) {
      const y = Number(m[1])
      setGran('year'); setYearBase(y - 5); setSelected(`${y}`)
    }
  }

  const next = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
  const cellCls = (active: boolean) =>
    cn(
      'rounded-md py-2 text-[13px] hover:bg-bg-hover',
      active ? 'bg-accent text-white hover:bg-accent' : 'text-fg',
    )
  const ops = gran === 'day' ? (['before', 'after'] as const) : (['before', 'after', 'in'] as const)

  return createPortal(
    <div
      data-overlay
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-32 animate-fade"
      onMouseDown={onClose}
    >
      <div
        className="w-[520px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated p-5 shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[15px] font-semibold text-fg">{dateFieldLabel(req.field)}</span>
          <div className="flex items-center rounded-md bg-secondary p-0.5 text-[12px]">
            {ops.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOp(o)}
                className={cn(
                  'rounded px-2 py-0.5',
                  op === o ? 'bg-bg text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <input
          autoFocus
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder="Try: May 2027, Q4 2027, 20/05/2027"
          className="mb-3 w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
        />

        <div className="mb-4 flex items-center gap-1 rounded-md bg-secondary p-0.5 text-[12px]">
          {GRANS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => pickGran(g.id)}
              className={cn(
                'flex-1 rounded px-2 py-1',
                gran === g.id ? 'bg-bg text-fg shadow-sm' : 'text-muted hover:text-fg',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        {gran === 'day' && (
          <div className="flex items-start justify-center gap-6">
            <button
              type="button"
              onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
              className="mt-0.5 rounded p-1 text-faint hover:bg-bg-hover hover:text-fg"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <MonthGrid year={anchor.getFullYear()} month={anchor.getMonth()} selected={selected} onPick={setSelected} />
            <MonthGrid year={next.getFullYear()} month={next.getMonth()} selected={selected} onPick={setSelected} />
            <button
              type="button"
              onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
              className="mt-0.5 rounded p-1 text-faint hover:bg-bg-hover hover:text-fg"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {(gran === 'month' || gran === 'quarter' || gran === 'half') && (
          <div>
            <div className="mb-3 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setPYear(pYear - 1)}
                className="rounded p-1 text-faint hover:bg-bg-hover hover:text-fg"
                aria-label="Previous year"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[13px] font-medium text-fg">{pYear}</span>
              <button
                type="button"
                onClick={() => setPYear(pYear + 1)}
                className="rounded p-1 text-faint hover:bg-bg-hover hover:text-fg"
                aria-label="Next year"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            {gran === 'month' && (
              <div className="grid grid-cols-4 gap-2">
                {MONTHS_SHORT.map((mo, i) => {
                  const v = `${pYear}-${pad(i + 1)}`
                  return (
                    <button key={mo} type="button" onClick={() => setSelected(v)} className={cellCls(v === selected)}>
                      {mo}
                    </button>
                  )
                })}
              </div>
            )}
            {gran === 'quarter' && (
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((q) => {
                  const v = `${pYear}-Q${q}`
                  return (
                    <button key={q} type="button" onClick={() => setSelected(v)} className={cellCls(v === selected)}>
                      Q{q}
                    </button>
                  )
                })}
              </div>
            )}
            {gran === 'half' && (
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map((h) => {
                  const v = `${pYear}-H${h}`
                  return (
                    <button key={h} type="button" onClick={() => setSelected(v)} className={cellCls(v === selected)}>
                      H{h} {h === 1 ? '· Jan–Jun' : '· Jul–Dec'}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {gran === 'year' && (
          <div>
            <div className="mb-3 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setYearBase(yearBase - 12)}
                className="rounded p-1 text-faint hover:bg-bg-hover hover:text-fg"
                aria-label="Previous years"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[13px] font-medium text-fg">
                {yearBase}–{yearBase + 11}
              </span>
              <button
                type="button"
                onClick={() => setYearBase(yearBase + 12)}
                className="rounded p-1 text-faint hover:bg-bg-hover hover:text-fg"
                aria-label="Next years"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }, (_, i) => yearBase + i).map((y) => {
                const v = `${y}`
                return (
                  <button key={y} type="button" onClick={() => setSelected(v)} className={cellCls(v === selected)}>
                    {y}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-[13px] text-fg hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onApply(op, selected)}
            className="rounded-md bg-accent px-3 py-1.5 text-[13px] text-white hover:opacity-90 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** One date filter, rendered like Linear: field · before/after · period · ×. */
function DateChip({
  index,
  filters,
  onChange,
  onCustom,
}: {
  index: number
  filters: FilterState
  onChange: (f: FilterState) => void
  onCustom: (req: CustomReq) => void
}) {
  const df = filters.dates?.[index]
  if (!df) return null

  function patch(next: Partial<DateFilter>) {
    const dates = [...(filters.dates ?? [])]
    dates[index] = { ...dates[index], ...next }
    onChange({ ...filters, dates })
  }

  function remove() {
    const dates = (filters.dates ?? []).filter((_, i) => i !== index)
    onChange({ ...filters, dates })
  }

  return (
    <div className="flex items-center overflow-hidden rounded-md border border-border text-[12px]">
      <span className="flex items-center gap-1 px-2 py-1 text-faint">
        <CalendarDays size={12} /> {dateFieldLabel(df.field)}
      </span>
      <Popover
        align="start"
        width={140}
        trigger={
          <span className="border-l border-border bg-bg px-2 py-1 text-muted hover:bg-bg-hover">
            {df.op}
          </span>
        }
      >
        {(close) => (
          <div>
            {(isAbsoluteDate(df.value)
              ? (['before', 'after', 'in'] as const)
              : (['before', 'after'] as const)
            ).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => {
                  patch({ op })
                  close()
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
              >
                {op}
                {df.op === op && CheckMark}
              </button>
            ))}
          </div>
        )}
      </Popover>
      <Popover
        align="start"
        width={180}
        trigger={
          <span className="border-l border-border bg-bg px-2 py-1 text-fg hover:bg-bg-hover">
            {datePeriodLabel(df.value)}
          </span>
        }
      >
        {(close) => (
          <div>
            {DATE_PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  patch({ value: p.value })
                  close()
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
              >
                {p.label}
                {df.value === p.value && CheckMark}
              </button>
            ))}
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              onClick={() => {
                onCustom({ field: df.field, op: df.op, value: df.value, index })
                close()
              }}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
            >
              Custom date or timeframe…
              {isAbsoluteDate(df.value) && CheckMark}
            </button>
          </div>
        )}
      </Popover>
      <button
        type="button"
        onClick={remove}
        className="border-l border-border px-1.5 py-1 text-faint hover:bg-bg-hover hover:text-fg"
      >
        <X size={12} />
      </button>
    </div>
  )
}

/** The free-text content filter chip: "Content · contains · <text> · ×". */
function TextChip({
  filters,
  onChange,
}: {
  filters: FilterState
  onChange: (f: FilterState) => void
}) {
  const text = filters.text ?? ''
  if (!text.trim()) return null
  return (
    <div className="flex items-center overflow-hidden rounded-md border border-border text-[12px]">
      <span className="flex items-center gap-1 px-2 py-1 text-faint">
        <Type size={12} /> Content
      </span>
      <span className="border-l border-border bg-bg px-2 py-1 text-muted">contains</span>
      <Popover
        align="start"
        width={220}
        trigger={
          <span className="max-w-[180px] truncate border-l border-border bg-bg px-2 py-1 text-fg hover:bg-bg-hover">
            {text}
          </span>
        }
      >
        {(close) => (
          <input
            autoFocus
            value={filters.text ?? ''}
            onChange={(e) => onChange({ ...filters, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') close()
            }}
            placeholder="Title or description contains…"
            className="w-full rounded-md bg-bg px-2 py-1.5 text-[13px] text-fg outline-none placeholder:text-faint"
          />
        )}
      </Popover>
      <button
        type="button"
        onClick={() => onChange({ ...filters, text: '' })}
        className="border-l border-border px-1.5 py-1 text-faint hover:bg-bg-hover hover:text-fg"
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: FilterState
  onChange: (f: FilterState) => void
}) {
  const active = hasActiveFilters(filters)
  const [custom, setCustom] = useState<CustomReq | null>(null)

  function applyCustom(op: 'before' | 'after' | 'in', value: string) {
    if (!custom) return
    if (custom.index !== undefined) {
      const dates = [...(filters.dates ?? [])]
      dates[custom.index] = { ...dates[custom.index], op, value }
      onChange({ ...filters, dates })
    } else {
      onChange({ ...filters, dates: [...(filters.dates ?? []), { field: custom.field, op, value }] })
    }
    setCustom(null)
  }

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
      <Popover
        align="start"
        width={200}
        trigger={
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover',
              active && 'text-fg',
            )}
          >
            {active ? <Plus size={13} /> : <Filter size={13} />}
            Filter
          </span>
        }
      >
        {(close) => (
          <AddFilterPanel
            filters={filters}
            onChange={onChange}
            onPicked={close}
            onCustom={setCustom}
          />
        )}
      </Popover>

      {DIMS.map((d) => (
        <Chip key={d.id} dim={d.id} filters={filters} onChange={onChange} />
      ))}

      <TextChip filters={filters} onChange={onChange} />

      {(filters.dates ?? []).map((_, i) => (
        <DateChip key={i} index={i} filters={filters} onChange={onChange} onCustom={setCustom} />
      ))}

      {active && (
        <button
          type="button"
          onClick={() => onChange(emptyFilters())}
          className="text-[12px] text-faint hover:text-fg"
        >
          Clear
        </button>
      )}

      {custom && (
        <CustomDateModal req={custom} onApply={applyCustom} onClose={() => setCustom(null)} />
      )}
    </div>
  )
}
