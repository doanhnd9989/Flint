import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { useStore, useStoreShallow, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { EmptyState, StackIllustration } from '@/components/EmptyState'
import { CUSTOMER_TIERS, CUSTOMER_TIER_ORDER, LABEL_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { CustomerTier } from '@/lib/types'

type SortKey = 'arr' | 'name' | 'requests'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'arr', label: 'ARR' },
  { key: 'name', label: 'Name' },
  { key: 'requests', label: 'Requests' },
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

  const [sort, setSort] = useState<SortKey>('arr')
  const [creating, setCreating] = useState(false)

  /** Linked-issue ("request") count per customer id. */
  const requestCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const i of issues) {
      if (!i.customerIds) continue
      for (const cid of i.customerIds) map[cid] = (map[cid] ?? 0) + 1
    }
    return map
  }, [issues])

  const sorted = useMemo(() => {
    const arr = [...customers]
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
  }, [customers, sort, requestCounts])

  const totals = useMemo(() => {
    let arr = 0
    let requests = 0
    for (const c of customers) arr += c.arr ?? 0
    for (const c of customers) requests += requestCounts[c.id] ?? 0
    return { count: customers.length, arr, requests }
  }, [customers, requestCounts])

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

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {sorted.map((c) => {
              const owner = users.find((u) => u.id === c.ownerId)
              const tier = CUSTOMER_TIERS[c.tier]
              const reqs = requestCounts[c.id] ?? 0
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/customer/${c.id}`)}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left hover:bg-bg-hover"
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
              )
            })}
          </div>
        </>
      )}

      {creating && (
        <NewCustomerModal
          onClose={() => setCreating(false)}
          onCreate={(input) => {
            createCustomer(input)
            setCreating(false)
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
