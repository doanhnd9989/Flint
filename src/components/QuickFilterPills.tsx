import { useMemo } from 'react'
import {
  User,
  PenLine,
  UserX,
  CircleDot,
  AlertTriangle,
  CalendarClock,
  History,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import type { DateFilter, FilterState, Priority } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * Linear's quick-filter pill bar — a compact row of one-click presets that sit
 * just below the FilterBar. Each pill is sugar over the SAME `FilterState` the
 * chip filters edit (no parallel filter system): toggling a pill writes the
 * corresponding dimension(s) through the host's `onChange`, and a pill reads as
 * "active" when the filter state exactly matches what it would set. Clicking an
 * active pill clears just that preset's contribution.
 */

/** Urgent · High — the two priorities Linear's "Urgent & High" preset covers. */
const URGENT_HIGH: Priority[] = [1, 2]

/** "Due soon" = due before 1 week from now (Linear's near-term due pill). */
const DUE_SOON: DateFilter = { field: 'due', op: 'before', value: '1w' }
/** "Recently updated" = updated within the last week. */
const RECENTLY_UPDATED: DateFilter = { field: 'updated', op: 'after', value: '1w' }

/** Sorted, de-duped string list — lets us compare value sets order-independently. */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

/** Does `filters` already carry an equivalent date filter (field + op + value)? */
function hasDate(filters: FilterState, df: DateFilter): boolean {
  return (filters.dates ?? []).some(
    (d) => d.field === df.field && d.op === df.op && d.value === df.value,
  )
}

/** Append a date filter unless an equivalent one is already present. */
function withDate(filters: FilterState, df: DateFilter): FilterState {
  if (hasDate(filters, df)) return filters
  return { ...filters, dates: [...(filters.dates ?? []), df] }
}

/** Drop any date filter equivalent to `df`. */
function withoutDate(filters: FilterState, df: DateFilter): FilterState {
  return {
    ...filters,
    dates: (filters.dates ?? []).filter(
      (d) => !(d.field === df.field && d.op === df.op && d.value === df.value),
    ),
  }
}

/** Set or clear the per-dimension "is not" operator for a dimension. */
function setNegate(
  filters: FilterState,
  dim: keyof NonNullable<FilterState['negate']>,
  neg: boolean,
): FilterState {
  const next = { ...(filters.negate ?? {}) }
  if (neg) next[dim] = true
  else delete next[dim]
  return { ...filters, negate: next }
}

interface Pill {
  id: string
  label: string
  icon: ReactNode
  /** Whether the current filter state already matches this preset. */
  active: (f: FilterState) => boolean
  /** Toggle the preset on/off against the current filter state. */
  toggle: (f: FilterState) => FilterState
}

export function QuickFilterPills({
  filters,
  onChange,
}: {
  filters: FilterState
  onChange: (f: FilterState) => void
}) {
  // Resolved from the store — never returns an object literal, so plain
  // single-value selectors are safe (no useStoreShallow needed).
  const me = useStore((s) => s.currentUserId)
  const states = useStore((s) => s.states)
  const users = useStore((s) => s.users)

  const startedIds = useMemo(
    () => states.filter((s) => s.type === 'started').map((s) => s.id),
    [states],
  )
  const allUserIds = useMemo(() => users.map((u) => u.id), [users])

  const pills = useMemo<Pill[]>(
    () => [
      {
        id: 'assignedToMe',
        label: 'Assigned to me',
        icon: <User size={13} />,
        active: (f) => !f.negate?.assigneeIds && sameSet(f.assigneeIds, [me]),
        toggle: (f) => {
          const on = !f.negate?.assigneeIds && sameSet(f.assigneeIds, [me])
          return setNegate({ ...f, assigneeIds: on ? [] : [me] }, 'assigneeIds', false)
        },
      },
      {
        id: 'createdByMe',
        label: 'Created by me',
        icon: <PenLine size={13} />,
        active: (f) => !f.negate?.creatorIds && sameSet(f.creatorIds ?? [], [me]),
        toggle: (f) => {
          const on = !f.negate?.creatorIds && sameSet(f.creatorIds ?? [], [me])
          return setNegate({ ...f, creatorIds: on ? [] : [me] }, 'creatorIds', false)
        },
      },
      {
        // "No assignee" has no first-class FilterState flag, so we express it
        // the way the chip UI would: exclude every member ("assignee is not
        // anyone"), which leaves only the unassigned issues.
        id: 'noAssignee',
        label: 'No assignee',
        icon: <UserX size={13} />,
        active: (f) => !!f.negate?.assigneeIds && sameSet(f.assigneeIds, allUserIds),
        toggle: (f) => {
          const on = !!f.negate?.assigneeIds && sameSet(f.assigneeIds, allUserIds)
          return setNegate(
            { ...f, assigneeIds: on ? [] : allUserIds },
            'assigneeIds',
            !on,
          )
        },
      },
      {
        id: 'active',
        label: 'Active',
        icon: <CircleDot size={13} />,
        active: (f) => !f.negate?.statusIds && sameSet(f.statusIds, startedIds),
        toggle: (f) => {
          const on = !f.negate?.statusIds && sameSet(f.statusIds, startedIds)
          return setNegate({ ...f, statusIds: on ? [] : startedIds }, 'statusIds', false)
        },
      },
      {
        id: 'urgentHigh',
        label: 'Urgent & High',
        icon: <AlertTriangle size={13} />,
        active: (f) =>
          !f.negate?.priorities &&
          sameSet(
            f.priorities.map(String),
            URGENT_HIGH.map(String),
          ),
        toggle: (f) => {
          const on =
            !f.negate?.priorities &&
            sameSet(f.priorities.map(String), URGENT_HIGH.map(String))
          return setNegate(
            { ...f, priorities: on ? [] : URGENT_HIGH },
            'priorities',
            false,
          )
        },
      },
      {
        id: 'dueSoon',
        label: 'Due soon',
        icon: <CalendarClock size={13} />,
        active: (f) => hasDate(f, DUE_SOON),
        toggle: (f) =>
          hasDate(f, DUE_SOON) ? withoutDate(f, DUE_SOON) : withDate(f, DUE_SOON),
      },
      {
        id: 'recentlyUpdated',
        label: 'Recently updated',
        icon: <History size={13} />,
        active: (f) => hasDate(f, RECENTLY_UPDATED),
        toggle: (f) =>
          hasDate(f, RECENTLY_UPDATED)
            ? withoutDate(f, RECENTLY_UPDATED)
            : withDate(f, RECENTLY_UPDATED),
      },
    ],
    [me, startedIds, allUserIds],
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-1.5">
      {pills.map((p) => {
        const on = p.active(filters)
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.toggle(filters))}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors',
              on
                ? 'border-accent bg-accent-subtle font-medium text-accent'
                : 'border-border text-muted hover:bg-bg-hover hover:text-fg',
            )}
          >
            <span className={cn('flex items-center', on ? 'text-accent' : 'text-faint')}>
              {p.icon}
            </span>
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
