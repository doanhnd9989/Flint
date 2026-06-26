import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Minus, Plus, Search, Trash2, X } from 'lucide-react'
import { useStore, useStoreShallow, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { EmptyState, StackIllustration } from '@/components/EmptyState'
import { CUSTOMER_TIERS, CUSTOMER_TIER_ORDER, LABEL_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { CustomerTier } from '@/lib/types'

type SortKey = 'arr' | 'name' | 'requests'
type TierFilter = CustomerTier | 'all'

/** Account-health buckets, derived from linked-request activity recency. */
type Health = 'healthy' | 'at-risk' | 'churned'
type HealthFilter = Health | 'all'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'arr', label: 'ARR' },
  { key: 'name', label: 'Name' },
  { key: 'requests', label: 'Requests' },
]

/** Health badge meta — label + token-driven colours, ordered worst-last. */
const HEALTH_META: Record<Health, { label: string; color: string }> = {
  healthy: { label: 'Healthy', color: 'var(--c-green)' },
  'at-risk': { label: 'At risk', color: 'var(--c-yellow)' },
  churned: { label: 'Churned', color: 'var(--c-red)' },
}

/** Health filter pills, "All" first then healthy → at-risk → churned. */
const HEALTH_FILTERS: { key: HealthFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'healthy', label: 'Healthy' },
  { key: 'at-risk', label: 'At risk' },
  { key: 'churned', label: 'Churned' },
]

const DAY = 86_400_000

/**
 * Derive an account-health bucket from the customer's most recent linked-issue
 * activity. Fresh activity (≤30d) reads as Healthy, stale (≤90d) as At risk,
 * and anything older — or a customer with no linked requests at all — as
 * Churned. Mirrors how Linear surfaces account engagement at a glance.
 */
function deriveHealth(lastActivity: number | undefined, now: number): Health {
  if (lastActivity === undefined) return 'churned'
  const age = now - lastActivity
  if (age <= 30 * DAY) return 'healthy'
  if (age <= 90 * DAY) return 'at-risk'
  return 'churned'
}

/** Tier filter pills, "All" first then the standard tier order. */
const TIER_FILTERS: { key: TierFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  ...CUSTOMER_TIER_ORDER.map((t) => ({ key: t, label: CUSTOMER_TIERS[t].label })),
]

/** Compact "$120K" / "$1.2M" formatter for ARR figures. */
function formatArr(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `$${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`
  }
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${value}`
}

export function CustomersView() {
  const navigate = useNavigate()
  const fmt = useDisplayName()
  const { customers, issues, users } = useStoreShallow((s) => ({
    customers: s.customers,
    issues: s.issues,
    users: s.users,
  }))
  const createCustomer = useStore((s) => s.createCustomer)
  const deleteCustomer = useStore((s) => s.deleteCustomer)

  const [sort, setSort] = useState<SortKey>('arr')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  /** Ids of rows ticked for bulk actions; cleared when the filter set shifts. */
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  /**
   * Per-customer rollups from linked requests: count + most-recent activity
   * timestamp (the latest `updatedAt` across that customer's open issues).
   */
  const { requestCounts, lastActivity } = useMemo(() => {
    const counts: Record<string, number> = {}
    const activity: Record<string, number> = {}
    for (const i of issues) {
      if (!i.customerIds || i.archivedAt) continue
      const ts = Date.parse(i.updatedAt ?? i.createdAt)
      for (const cid of i.customerIds) {
        counts[cid] = (counts[cid] ?? 0) + 1
        if (!Number.isNaN(ts) && ts > (activity[cid] ?? 0)) activity[cid] = ts
      }
    }
    return { requestCounts: counts, lastActivity: activity }
  }, [issues])

  /** Health bucket per customer id, computed once relative to "now". */
  const health = useMemo(() => {
    const now = Date.now()
    const map: Record<string, Health> = {}
    for (const c of customers) map[c.id] = deriveHealth(lastActivity[c.id], now)
    return map
  }, [customers, lastActivity])

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    const arr = customers.filter(
      (c) =>
        (tierFilter === 'all' || c.tier === tierFilter) &&
        (healthFilter === 'all' || health[c.id] === healthFilter) &&
        (!q ||
          c.name.toLowerCase().includes(q) ||
          (c.domain?.toLowerCase().includes(q) ?? false)),
    )
    arr.sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'requests':
          return (requestCounts[b.id] ?? 0) - (requestCounts[a.id] ?? 0)
        default:
          return (b.arr ?? 0) - (a.arr ?? 0)
      }
    })
    return arr
  }, [customers, tierFilter, healthFilter, health, sort, query, requestCounts])

  /** Summary reflects the *filtered* set (count + total ARR + requests). */
  const totals = useMemo(() => {
    let arr = 0
    let requests = 0
    for (const c of sorted) {
      arr += c.arr ?? 0
      requests += requestCounts[c.id] ?? 0
    }
    return { count: sorted.length, arr, requests }
  }, [sorted, requestCounts])

  /**
   * Selection counted against the *visible* rows only — a row hidden by the
   * active filter never participates in select-all or the bulk count.
   */
  const selectedVisible = useMemo(
    () => sorted.filter((c) => selected.has(c.id)),
    [sorted, selected],
  )
  const allSelected = sorted.length > 0 && selectedVisible.length === sorted.length
  const someSelected = selectedVisible.length > 0 && !allSelected

  /** Toggle a single row in/out of the selection set. */
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Header checkbox: select every visible row, or clear when already full. */
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sorted.map((c) => c.id)))
  }

  /** Bulk-delete the visible selection, then drop the now-stale ids. */
  function deleteSelected() {
    for (const c of selectedVisible) deleteCustomer(c.id)
    setSelected(new Set())
  }

  /** Drop ids that have filtered out of view so the toolbar stays accurate. */
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const visible = new Set(sorted.map((c) => c.id))
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (visible.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [sorted])

  /** Esc anywhere clears an active selection (mirrors Linear's list views). */
  useEffect(() => {
    if (selectedVisible.length === 0) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      setSelected(new Set())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedVisible.length])

  /** "/" focuses the filter, mirroring Linear's quick-search affordance. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Customers"
        right={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[13px] font-medium text-white hover:bg-accent-hover"
          >
            <Plus size={14} />
            New customer
          </button>
        }
      />

      {customers.length === 0 ? (
        <EmptyState
          illustration={<StackIllustration />}
          title="Customers"
          description="Track the companies that use your product. Link issues to customers to capture feature requests and see which accounts care about what you build."
          action={{ label: 'New customer', onClick: () => setCreating(true) }}
        />
      ) : (
        <>
          {/* Summary strip */}
          <div className="flex items-center gap-6 border-b border-border px-4 py-2.5 text-[12px]">
            <span className="flex items-baseline gap-1.5">
              <span className="font-medium text-fg tabular-nums">{totals.count}</span>
              <span className="text-muted">customers</span>
            </span>
            <span className="text-faint">·</span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-medium text-fg tabular-nums">
                {formatArr(totals.arr)}
              </span>
              <span className="text-muted">ARR</span>
            </span>
            <span className="text-faint">·</span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-medium text-fg tabular-nums">
                {totals.requests}
              </span>
              <span className="text-muted">requests</span>
            </span>

            {/* Segmented sort */}
            <div className="ml-auto flex items-center rounded-md border border-border p-0.5">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  className={cn(
                    'rounded px-2 py-0.5 text-[12px] font-medium',
                    sort === s.key
                      ? 'bg-bg-selected text-fg'
                      : 'text-muted hover:text-fg',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tier filter pills + search */}
          <div className="flex items-center gap-1 border-b border-border px-4 py-2">
            {TIER_FILTERS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTierFilter(t.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors',
                  tierFilter === t.key
                    ? 'border-transparent bg-bg-selected text-fg'
                    : 'border-border text-muted hover:text-fg',
                )}
              >
                {t.key !== 'all' && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: CUSTOMER_TIERS[t.key].color }}
                  />
                )}
                {t.label}
              </button>
            ))}

            {/* Divider between tier and health pill groups */}
            <span className="mx-1 h-4 w-px shrink-0 bg-border" />

            {/* Health filter pills (Healthy / At risk / Churned) */}
            {HEALTH_FILTERS.map((h) => (
              <button
                key={h.key}
                type="button"
                onClick={() => setHealthFilter(h.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors',
                  healthFilter === h.key
                    ? 'border-transparent bg-bg-selected text-fg'
                    : 'border-border text-muted hover:text-fg',
                )}
              >
                {h.key !== 'all' && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: HEALTH_META[h.key].color }}
                  />
                )}
                {h.label}
              </button>
            ))}

            {/* Filter-by-name search ("/" to focus, Esc to clear) */}
            <div className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2 py-1 focus-within:border-accent">
              <Search size={13} className="shrink-0 text-faint" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    if (query) setQuery('')
                    else searchRef.current?.blur()
                  }
                }}
                placeholder="Filter by name…"
                className="w-40 bg-transparent text-[12px] text-fg outline-none placeholder:text-faint"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    searchRef.current?.focus()
                  }}
                  className="shrink-0 text-faint hover:text-fg"
                  aria-label="Clear filter"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="relative flex-1 overflow-y-auto">
            {/* Sticky bulk-action toolbar — only while a selection is active */}
            {selectedVisible.length > 0 && (
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur">
                <span className="text-[12px] font-medium text-fg tabular-nums">
                  {selectedVisible.length} selected
                </span>
                <span className="mx-0.5 h-4 w-px bg-border" />
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] font-medium text-muted hover:bg-bg-selected hover:text-red-500"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="ml-auto rounded-md px-2 py-1 text-[12px] font-medium text-muted hover:text-fg"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Select-all header — only meaningful when rows are present */}
            {sorted.length > 0 && (
              <div className="flex items-center gap-3 border-b border-border px-4 py-1.5">
                <button
                  type="button"
                  onClick={toggleAll}
                  aria-label={allSelected ? 'Deselect all' : 'Select all'}
                  className={cn(
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                    allSelected || someSelected
                      ? 'border-accent bg-accent text-white'
                      : 'border-border text-transparent hover:border-muted',
                  )}
                >
                  {allSelected ? (
                    <Check size={11} strokeWidth={3} />
                  ) : someSelected ? (
                    <Minus size={11} strokeWidth={3} />
                  ) : null}
                </button>
                <span className="text-[11px] font-medium tracking-wide text-faint uppercase">
                  {sorted.length} {sorted.length === 1 ? 'customer' : 'customers'}
                </span>
              </div>
            )}

            {sorted.length === 0 && (
              <div className="px-4 py-10 text-center text-[13px] text-muted">
                No customers match{' '}
                {query.trim() ? (
                  <>
                    “<span className="text-fg">{query.trim()}</span>”
                  </>
                ) : (
                  'this filter'
                )}
                .
              </div>
            )}
            {sorted.map((c) => {
              const owner = users.find((u) => u.id === c.ownerId)
              const tier = CUSTOMER_TIERS[c.tier]
              const reqs = requestCounts[c.id] ?? 0
              const hm = HEALTH_META[health[c.id]]
              const isSelected = selected.has(c.id)
              return (
                <div
                  key={c.id}
                  className={cn(
                    'group flex w-full items-center border-b border-border transition-colors',
                    isSelected ? 'bg-bg-selected' : 'hover:bg-bg-hover',
                  )}
                >
                  {/* Leading select checkbox — sibling of the nav button so we
                      never nest interactive elements; hidden until hover/select. */}
                  <button
                    type="button"
                    onClick={() => toggleOne(c.id)}
                    aria-label={isSelected ? 'Deselect customer' : 'Select customer'}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                      isSelected
                        ? 'border-accent bg-accent text-white'
                        : 'border-border text-transparent opacity-0 hover:border-muted group-hover:opacity-100',
                    )}
                    style={{ marginLeft: 16, marginRight: -4 }}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </button>

                  <button
                    onClick={() => navigate(`/customer/${c.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left"
                  >
                  {/* Square avatar tile */}
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold text-white select-none"
                    style={{ background: c.color }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </span>

                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-medium text-fg">
                      {c.name}
                    </span>
                    {c.domain && (
                      <span className="truncate text-[12px] text-muted">
                        {c.domain}
                      </span>
                    )}
                  </span>

                  {/* Tier chip */}
                  <span className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[12px] text-muted">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: tier.color }}
                    />
                    {tier.label}
                  </span>

                  {/* Health badge — coloured dot + tinted label */}
                  <span
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium"
                    style={{
                      color: hm.color,
                      background: `color-mix(in srgb, ${hm.color} 14%, transparent)`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: hm.color }}
                    />
                    {hm.label}
                  </span>

                  <div className="ml-auto flex items-center gap-4 text-[12px] text-muted">
                    <span className="w-20 text-right tabular-nums">
                      {reqs} {reqs === 1 ? 'request' : 'requests'}
                    </span>
                    <span className="w-14 text-right font-medium text-fg tabular-nums">
                      {c.arr ? formatArr(c.arr) : '—'}
                    </span>
                    <span title={owner ? fmt(owner.name) : undefined}>
                      <Avatar user={owner} size={20} />
                    </span>
                  </div>
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {creating && (
        <NewCustomerModal
          onClose={() => setCreating(false)}
          onCreate={(input) => {
            const created = createCustomer(input)
            setCreating(false)
            navigate(`/customer/${created.id}`)
          }}
        />
      )}
    </div>
  )
}

// ── New customer modal ───────────────────────────────────────────────────────

function NewCustomerModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (input: {
    name: string
    domain?: string
    tier: CustomerTier
    color: string
  }) => void
}) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [tier, setTier] = useState<CustomerTier>('startup')
  const [color, setColor] = useState<string>(LABEL_COLORS[7])

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate({
      name: trimmed,
      domain: domain.trim() || undefined,
      tier,
      color,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[18vh]"
      onClick={onClose}
    >
      <div
        className="w-[440px] rounded-lg border border-border bg-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[13px] font-medium text-fg">New customer</span>
          <button
            type="button"
            onClick={onClose}
            className="text-faint hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Customer name"
            className="w-full rounded-md border border-border bg-bg-secondary px-2.5 py-1.5 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
          />
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="example.com"
            className="w-full rounded-md border border-border bg-bg-secondary px-2.5 py-1.5 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
          />

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted">Tier</span>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as CustomerTier)}
              className="flex-1 rounded-md border border-border bg-bg-secondary px-2 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
            >
              {CUSTOMER_TIER_ORDER.map((t) => (
                <option key={t} value={t}>
                  {CUSTOMER_TIERS[t].label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted">Color</span>
            <div className="flex flex-wrap gap-1.5">
              {LABEL_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  className={cn(
                    'h-5 w-5 rounded-full',
                    color === hex && 'ring-2 ring-accent ring-offset-1 ring-offset-bg',
                  )}
                  style={{ background: hex }}
                  aria-label={`Color ${hex}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-[13px] text-muted hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="rounded-md bg-accent px-3 py-1 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Create customer
          </button>
        </div>
      </div>
    </div>
  )
}
