import { useState } from 'react'
import { Filter, X, Plus } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Popover } from './ui/Popover'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { PRIORITY_LABELS, PRIORITY_ORDER, STATUS_TYPE_ORDER } from '@/lib/constants'
import type { FilterState, Priority } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type Dim =
  | 'statusIds'
  | 'assigneeIds'
  | 'creatorIds'
  | 'priorities'
  | 'labelIds'
  | 'projectIds'
  | 'subscriberIds'

const DIMS: { id: Dim; label: string }[] = [
  { id: 'statusIds', label: 'Status' },
  { id: 'assigneeIds', label: 'Assignee' },
  { id: 'creatorIds', label: 'Creator' },
  { id: 'priorities', label: 'Priority' },
  { id: 'labelIds', label: 'Label' },
  { id: 'projectIds', label: 'Project' },
  { id: 'subscriberIds', label: 'Subscribers' },
]

export function emptyFilters(): FilterState {
  return {
    statusIds: [],
    assigneeIds: [],
    priorities: [],
    labelIds: [],
    projectIds: [],
    creatorIds: [],
    subscriberIds: [],
  }
}

export function hasActiveFilters(f: FilterState): boolean {
  return DIMS.some((d) => ((f[d.id] as unknown[]) ?? []).length > 0)
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

function AddFilterPanel({
  filters,
  onChange,
}: {
  filters: FilterState
  onChange: (f: FilterState) => void
}) {
  const [dim, setDim] = useState<Dim | null>(null)
  const dimOptions = useDimOptions()

  function toggle(d: Dim, id: string) {
    const cur = valuesOf(filters, d)
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    onChange(setValues(filters, d, next))
  }

  if (!dim) {
    return (
      <div>
        {DIMS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDim(d.id)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
          >
            {d.label}
            {valuesOf(filters, d.id).length > 0 && (
              <span className="text-[11px] text-faint">{valuesOf(filters, d.id).length}</span>
            )}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setDim(null)}
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

  return (
    <div className="flex items-center overflow-hidden rounded-md border border-border text-[12px]">
      <span className="px-2 py-1 text-faint">{DIMS.find((d) => d.id === dim)!.label}</span>
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
              onChange(setValues(filters, dim, next))
            }}
          />
        )}
      </Popover>
      <button
        type="button"
        onClick={() => onChange(setValues(filters, dim, []))}
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
        {() => <AddFilterPanel filters={filters} onChange={onChange} />}
      </Popover>

      {DIMS.map((d) => (
        <Chip key={d.id} dim={d.id} filters={filters} onChange={onChange} />
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
    </div>
  )
}
