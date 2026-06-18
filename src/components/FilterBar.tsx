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
} from 'lucide-react'
import { useStore } from '@/lib/store'
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
    (f.dates ?? []).length > 0
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
  const labels = useStore((s) => s.labels)
  const projects = useStore((s) => s.projects)
  const cycles = useStore((s) => s.cycles)
  const milestones = useStore((s) => s.milestones)

  return {
    statusIds: [...states]
      .sort((a, b) => STATUS_TYPE_ORDER[a.type] - STATUS_TYPE_ORDER[b.type] || a.position - b.position)
      .map((st) => ({ id: st.id, label: st.name, icon: <StatusIcon type={st.type} color={st.color} /> })),
    assigneeIds: users.map((u) => ({ id: u.id, label: u.name, icon: <Avatar user={u} size={16} /> })),
    creatorIds: users.map((u) => ({ id: u.id, label: u.name, icon: <Avatar user={u} size={16} /> })),
    subscriberIds: users.map((u) => ({ id: u.id, label: u.name, icon: <Avatar user={u} size={16} /> })),
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
  return setNegate(setValues(f, dim, []), dim, false)
}

/** Linear's operator wording: positive flips to "is any of" with 2+ values. */
function operatorLabel(negated: boolean, count: number): string {
  if (negated) return 'is not'
  return count > 1 ? 'is any of' : 'is'
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

function ValueList({
  options,
  selected,
  onToggle,
}: {
  options: ValueOption[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="max-h-64 overflow-y-auto">
      {options.map((o) => (
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
  // DateField = that field's relative-period list.
  const [nav, setNav] = useState<Dim | 'dates' | DateField | null>(null)
  const dimOptions = useDimOptions()

  function toggle(d: Dim, id: string) {
    const cur = valuesOf(filters, d)
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    const f = setValues(filters, d, next)
    onChange(next.length ? f : setNegate(f, d, false))
  }

  // Root menu.
  if (nav === null) {
    return (
      <div>
        {DIMS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setNav(d.id)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
          >
            {d.label}
            {valuesOf(filters, d.id).length > 0 && (
              <span className="text-[11px] text-faint">{valuesOf(filters, d.id).length}</span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setNav('dates')}
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
        >
          <span className="flex items-center gap-2">
            <CalendarDays size={14} className="text-faint" /> Dates
          </span>
        </button>
      </div>
    )
  }

  // Date-field list.
  if (nav === 'dates') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setNav(null)}
          className="mb-1 flex items-center gap-1 px-2 py-1 text-[11px] text-faint hover:text-fg"
        >
          ‹ Dates
        </button>
        {DATE_FIELDS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setNav(f.id)}
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
          onClick={() => setNav('dates')}
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

  // A regular dimension is selected → value list.
  const dim = nav
  return (
    <div>
      <button
        type="button"
        onClick={() => setNav(null)}
        className="mb-1 flex items-center gap-1 px-2 py-1 text-[11px] text-faint hover:text-fg"
      >
        ‹ {DIMS.find((d) => d.id === dim)!.label}
      </button>
      <ValueList
        options={dimOptions[dim]}
        selected={valuesOf(filters, dim)}
        onToggle={(id) => toggle(dim, id)}
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

  return (
    <div className="flex items-center overflow-hidden rounded-md border border-border text-[12px]">
      <span className="px-2 py-1 text-faint">{DIMS.find((d) => d.id === dim)!.label}</span>
      <Popover
        align="start"
        width={160}
        trigger={
          <span className="border-l border-border bg-bg px-2 py-1 text-muted hover:bg-bg-hover">
            {operatorLabel(negated, selected.length)}
          </span>
        }
      >
        {(close) => (
          <OperatorMenu
            negated={negated}
            count={selected.length}
            onSelect={(n) => {
              onChange(setNegate(filters, dim, n))
              close()
            }}
          />
        )}
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
  op: 'before' | 'after'
  value?: string
  index?: number
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
 * Linear's "Custom date or timeframe…" modal, Day granularity: a before/after
 * toggle over a typed-date input and a two-month calendar. Apply stores the
 * picked day as a `YYYY-MM-DD` date-filter value.
 */
function CustomDateModal({
  req,
  onApply,
  onClose,
}: {
  req: CustomReq
  onApply: (op: 'before' | 'after', iso: string) => void
  onClose: () => void
}) {
  const [op, setOp] = useState<'before' | 'after'>(req.op)
  const init = req.value && ISO_DATE.test(req.value) ? req.value : undefined
  const [selected, setSelected] = useState<string | undefined>(init)
  const [text, setText] = useState('')
  // First of the two visible months — anchored on the selection or today.
  const [anchor, setAnchor] = useState(() => {
    const base = init ? new Date(init) : new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Parse a typed `DD/MM/YYYY` (or `YYYY-MM-DD`) date and jump the calendar.
  function onText(v: string) {
    setText(v)
    const dmy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    const ymd = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    let y = 0,
      m = 0,
      d = 0
    if (dmy) [, d, m, y] = dmy.map(Number) as [number, number, number, number]
    else if (ymd) [, y, m, d] = ymd.map(Number) as [number, number, number, number]
    else return
    const dt = new Date(y, m - 1, d)
    if (dt.getMonth() !== m - 1) return // invalid (e.g. 31/02)
    setSelected(toIso(y, m - 1, d))
    setAnchor(new Date(y, m - 1, 1))
  }

  const next = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)

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
            {(['before', 'after'] as const).map((o) => (
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
          placeholder="Try: 20/05/2027"
          className="mb-4 w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
        />

        <div className="flex items-start gap-6">
          <button
            type="button"
            onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
            className="mt-0.5 rounded p-1 text-faint hover:bg-bg-hover hover:text-fg"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <MonthGrid
            year={anchor.getFullYear()}
            month={anchor.getMonth()}
            selected={selected}
            onPick={setSelected}
          />
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
            {(['before', 'after'] as const).map((op) => (
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
              {ISO_DATE.test(df.value) && CheckMark}
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

export function FilterBar({
  filters,
  onChange,
}: {
  filters: FilterState
  onChange: (f: FilterState) => void
}) {
  const active = hasActiveFilters(filters)
  const [custom, setCustom] = useState<CustomReq | null>(null)

  function applyCustom(op: 'before' | 'after', iso: string) {
    if (!custom) return
    if (custom.index !== undefined) {
      const dates = [...(filters.dates ?? [])]
      dates[custom.index] = { ...dates[custom.index], op, value: iso }
      onChange({ ...filters, dates })
    } else {
      onChange({ ...filters, dates: [...(filters.dates ?? []), { field: custom.field, op, value: iso }] })
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
