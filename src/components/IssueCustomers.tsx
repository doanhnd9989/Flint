import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStoreShallow } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { CUSTOMER_TIERS, CUSTOMER_TIER_ORDER } from '@/lib/constants'
import { SelectMenu } from './ui/SelectMenu'
import type { SelectOption } from './ui/SelectMenu'

/**
 * Linear's "Customers" section — the customer requests linked to an issue.
 * Mirrors {@link IssueLinks}'s collapsible grammar: a chevron + title + count
 * header with a circular "+" add button, and hover-to-unlink rows. The "+"
 * opens a searchable picker of customers not yet linked. Hidden entirely when
 * the workspace has no customers at all.
 */
export function IssueCustomers({ issue }: { issue: Issue }) {
  const { customers, toggleIssueCustomer } = useStoreShallow((s) => ({
    customers: s.customers,
    toggleIssueCustomer: s.toggleIssueCustomer,
  }))
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  // No customers in the workspace at all — nothing to add, so hide.
  if (customers.length === 0) return null

  const linked = customers.filter((c) => issue.customerIds?.includes(c.id))
  const unlinked = customers.filter((c) => !issue.customerIds?.includes(c.id))

  // Order the picker by tier (enterprise first), then name.
  const tierRank = (t: string) => {
    const i = CUSTOMER_TIER_ORDER.indexOf(t as never)
    return i === -1 ? CUSTOMER_TIER_ORDER.length : i
  }
  const options: SelectOption[] = [...unlinked]
    .sort(
      (a, b) =>
        tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name),
    )
    .map((c) => ({
      id: c.id,
      label: c.name,
      keywords: `${c.name} ${c.domain ?? ''} ${CUSTOMER_TIERS[c.tier].label}`,
      hint: CUSTOMER_TIERS[c.tier].label,
      icon: (
        <span
          className="flex h-4 w-4 items-center justify-center rounded-[3px] text-[9px] font-semibold text-white"
          style={{ background: c.color }}
        >
          {c.name.charAt(0).toUpperCase()}
        </span>
      ),
    }))

  return (
    <div className="mt-6">
      <div className="mb-1 flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1 rounded px-0.5 text-[12px] font-medium text-faint hover:text-fg"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          Customers
          {linked.length > 0 && (
            <span className="text-faint">{linked.length}</span>
          )}
        </button>
        <SelectMenu
          options={options}
          onSelect={(id) => toggleIssueCustomer(issue.id, id)}
          placeholder="Link a customer…"
          align="end"
          width={260}
          trigger={
            <span
              title="Add customer"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-faint hover:bg-bg-hover hover:text-fg"
            >
              <Plus size={14} />
            </span>
          }
        />
      </div>

      {!collapsed && linked.length > 0 && (
        <div className="divide-y divide-border rounded-md border border-border">
          {linked.map((customer) => {
            const tier = CUSTOMER_TIERS[customer.tier]
            return (
              <div
                key={customer.id}
                onClick={() => navigate(`/customer/${customer.id}`)}
                className="group flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-bg-hover"
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[10px] font-semibold text-white"
                  style={{ background: customer.color }}
                >
                  {customer.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-[13px] font-medium text-fg">
                  {customer.name}
                </span>
                {customer.domain && (
                  <span className="truncate text-[12px] text-faint">
                    {customer.domain}
                  </span>
                )}
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: tier.color }}
                  />
                  {tier.label}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleIssueCustomer(issue.id, customer.id)
                  }}
                  title="Unlink customer"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-selected hover:text-fg group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
