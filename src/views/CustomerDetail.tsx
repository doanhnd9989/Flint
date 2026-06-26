import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, X, Building2, Users as UsersIcon } from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { Avatar } from '@/components/Avatar'
import { StatusIcon } from '@/components/StatusIcon'
import { PriorityIcon } from '@/components/PriorityIcon'
import { EmptyState, StackIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { CUSTOMER_TIERS, CUSTOMER_TIER_ORDER } from '@/lib/constants'
import { formatFullDate } from '@/lib/utils'
import type { CustomerTier } from '@/lib/types'

const triggerCls =
  'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[13px] text-fg hover:bg-bg-hover'

/** A label/value row in the right-hand Properties panel. */
function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="w-16 shrink-0 text-[12px] text-faint">{label}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** A small square logo tile for a customer (first letter on its color). */
function CustomerTile({ name, color, size }: { name: string; color: string; size: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md font-semibold text-white select-none"
      style={{ width: size, height: size, background: color, fontSize: size * 0.45 }}
      aria-hidden
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

export function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useStore()
  const fmt = useDisplayName()
  const [confirming, setConfirming] = useState(false)

  // Status filter for the Requests list — Linear defaults to hiding resolved
  // requests so the open work stays front-and-centre.
  const [reqFilter, setReqFilter] = useState<'open' | 'completed' | 'all'>('open')

  const customer = data.customers.find((c) => c.id === id)

  // All issues linked to this customer (the "requests"), before status filtering.
  const allRequests = useMemo(
    () =>
      data.issues
        .filter((i) => i.customerIds?.includes(id ?? '') && !i.archivedAt)
        .sort((a, b) => a.priority - b.priority || b.createdAt.localeCompare(a.createdAt)),
    [data.issues, id],
  )

  // A request is "resolved" when its workflow state is completed or canceled.
  const isResolved = useMemo(() => {
    const resolvedIds = new Set(
      data.states.filter((s) => s.type === 'completed' || s.type === 'canceled').map((s) => s.id),
    )
    return (stateId: string) => resolvedIds.has(stateId)
  }, [data.states])

  const openCount = useMemo(
    () => allRequests.filter((i) => !isResolved(i.stateId)).length,
    [allRequests, isResolved],
  )
  const completedCount = allRequests.length - openCount

  // The visible requests after applying the status filter.
  const requests = useMemo(() => {
    if (reqFilter === 'all') return allRequests
    if (reqFilter === 'open') return allRequests.filter((i) => !isResolved(i.stateId))
    return allRequests.filter((i) => isResolved(i.stateId))
  }, [allRequests, reqFilter, isResolved])

  // Candidate issues for "Add request": non-triage and not already linked.
  const addOptions: SelectOption[] = useMemo(() => {
    return data.issues
      .filter((i) => !i.triage && !i.archivedAt && !i.customerIds?.includes(id ?? ''))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => {
        const st = data.states.find((s) => s.id === i.stateId)
        return {
          id: i.id,
          label: i.title,
          hint: i.identifier,
          keywords: i.identifier,
          icon: st ? <StatusIcon type={st.type} color={st.color} size={14} /> : undefined,
        }
      })
  }, [data.issues, data.states, id])

  if (!customer) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-[13px]">
          <button onClick={() => navigate('/customers')} className="text-muted hover:text-fg">
            Customers
          </button>
        </header>
        <EmptyState
          illustration={<StackIllustration />}
          title="Customer not found"
          description="This customer may have been deleted."
          action={{ label: 'Back to customers', onClick: () => navigate('/customers') }}
        />
      </div>
    )
  }

  const owner = data.users.find((u) => u.id === customer.ownerId)
  const tierMeta = CUSTOMER_TIERS[customer.tier]

  const tierOptions: SelectOption[] = CUSTOMER_TIER_ORDER.map((t) => ({
    id: t,
    label: CUSTOMER_TIERS[t].label,
    icon: (
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: CUSTOMER_TIERS[t].color }}
      />
    ),
    selected: t === customer.tier,
  }))

  const ownerOptions: SelectOption[] = [
    {
      id: '__none',
      label: 'No owner',
      icon: <Avatar size={18} />,
      selected: !customer.ownerId,
    },
    ...data.users.map((u) => ({
      id: u.id,
      label: fmt(u.name),
      icon: <Avatar user={u} size={18} />,
      selected: u.id === customer.ownerId,
    })),
  ]

  function deleteCustomer() {
    data.deleteCustomer(customer!.id)
    navigate('/customers')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb header */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-[13px]">
        <button onClick={() => navigate('/customers')} className="text-muted hover:text-fg">
          Customers
        </button>
        <span className="text-faint">›</span>
        <CustomerTile name={customer.name} color={customer.color} size={16} />
        <span className="truncate font-medium text-fg">{customer.name}</span>
      </header>

      {/* Body — two columns */}
      <div className="flex min-h-0 flex-1">
        {/* Main column */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-10 py-10">
            {/* Customer header */}
            <div className="flex items-center gap-4">
              <CustomerTile name={customer.name} color={customer.color} size={56} />
              <div className="min-w-0 flex-1">
                <input
                  value={customer.name}
                  onChange={(e) => data.updateCustomer(customer.id, { name: e.target.value })}
                  placeholder="Customer name"
                  className="w-full bg-transparent text-[22px] font-semibold text-fg outline-none placeholder:text-faint"
                />
                {customer.domain ? (
                  <a
                    href={`https://${customer.domain.replace(/^https?:\/\//, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-muted hover:text-accent hover:underline"
                  >
                    {customer.domain}
                  </a>
                ) : (
                  <span className="text-[13px] text-faint">No domain</span>
                )}
              </div>
            </div>

            {/* Requests */}
            <div className="mt-10">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[13px] font-medium text-fg">
                  Requests
                  {allRequests.length > 0 && (
                    <span className="ml-1.5 text-faint">{allRequests.length}</span>
                  )}
                </span>
                <SelectMenu
                  options={addOptions}
                  onSelect={(issueId) => data.toggleIssueCustomer(issueId, customer.id)}
                  placeholder="Link an issue…"
                  width={300}
                  align="end"
                  trigger={
                    <span className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg">
                      <Plus size={14} /> Add request
                    </span>
                  }
                />
              </div>

              {/* Status filter — Open / Completed / All, with live counts. */}
              {allRequests.length > 0 && (
                <div className="mb-2 flex items-center gap-0.5 text-[12px]">
                  {(
                    [
                      ['open', 'Open', openCount],
                      ['completed', 'Completed', completedCount],
                      ['all', 'All', allRequests.length],
                    ] as const
                  ).map(([key, label, count]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setReqFilter(key)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 ${
                        reqFilter === key
                          ? 'bg-bg-selected text-fg'
                          : 'text-muted hover:bg-bg-hover hover:text-fg'
                      }`}
                    >
                      {label}
                      <span className={reqFilter === key ? 'text-muted' : 'text-faint'}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {requests.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-10">
                  <EmptyState
                    illustration={<StackIllustration />}
                    title={
                      allRequests.length === 0
                        ? 'No requests yet'
                        : reqFilter === 'open'
                          ? 'No open requests'
                          : 'No completed requests'
                    }
                    description={
                      allRequests.length === 0
                        ? "Link issues to this customer to track what they've asked for."
                        : reqFilter === 'open'
                          ? "Every linked request has been resolved — nice. Switch to All to see them."
                          : 'No linked requests have been completed or canceled yet.'
                    }
                  />
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  {requests.map((issue) => {
                    const st = data.states.find((s) => s.id === issue.stateId)
                    return (
                      <div
                        key={issue.id}
                        className="group flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-b-0 hover:bg-bg-hover"
                      >
                        <PriorityIcon priority={issue.priority} size={16} />
                        {st && <StatusIcon type={st.type} color={st.color} size={15} />}
                        <span className="shrink-0 font-mono text-[12px] text-faint">
                          {issue.identifier}
                        </span>
                        <button
                          type="button"
                          onClick={() => navigate(`/issue/${issue.identifier}`)}
                          className="min-w-0 flex-1 truncate text-left text-[13px] text-fg"
                        >
                          {issue.title}
                        </button>
                        <button
                          type="button"
                          title="Unlink request"
                          onClick={() => data.toggleIssueCustomer(issue.id, customer.id)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-selected hover:text-fg group-hover:opacity-100"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Properties sidebar */}
        <aside className="w-[268px] shrink-0 overflow-y-auto border-l border-border px-4 py-4">
          <div className="mb-1.5 text-[12px] font-medium text-muted">Properties</div>

          <PropRow label="Tier">
            <SelectMenu
              options={tierOptions}
              onSelect={(t) => data.updateCustomer(customer.id, { tier: t as CustomerTier })}
              placeholder="Set tier…"
              trigger={
                <span className={triggerCls}>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: tierMeta.color }}
                  />
                  {tierMeta.label}
                </span>
              }
            />
          </PropRow>

          <PropRow label="Owner">
            <SelectMenu
              options={ownerOptions}
              onSelect={(uid) =>
                data.updateCustomer(customer.id, {
                  ownerId: uid === '__none' ? undefined : uid,
                })
              }
              placeholder="Set owner…"
              trigger={
                <span className={triggerCls}>
                  {owner ? (
                    <>
                      <Avatar user={owner} size={18} /> {fmt(owner.name)}
                    </>
                  ) : (
                    <>
                      <UsersIcon size={14} className="text-faint" />
                      <span className="text-faint">No owner</span>
                    </>
                  )}
                </span>
              }
            />
          </PropRow>

          <PropRow label="ARR">
            <div className="flex items-center gap-1 px-1.5 py-1 text-[13px] text-fg">
              <span className="text-faint">$</span>
              <input
                type="number"
                min={0}
                value={customer.arr ?? ''}
                onChange={(e) =>
                  data.updateCustomer(customer.id, {
                    arr: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                placeholder="0"
                className="w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
              />
            </div>
          </PropRow>

          <PropRow label="Requests">
            <div className="flex items-center gap-1.5 px-1.5 py-1 text-[13px] text-fg">
              <Building2 size={14} className="text-faint" />
              {allRequests.length}
              {allRequests.length > 0 && (
                <span className="text-faint">· {openCount} open</span>
              )}
            </div>
          </PropRow>

          <PropRow label="Created">
            <div className="px-1.5 py-1 text-[13px] text-muted">
              {formatFullDate(customer.createdAt)}
            </div>
          </PropRow>

          {/* Delete */}
          <div className="mt-4 border-t border-border pt-3">
            {confirming ? (
              <div className="space-y-2">
                <p className="text-[12px] text-muted">Delete this customer?</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={deleteCustomer}
                    className="flex-1 rounded-md bg-[var(--priority-urgent)] px-2 py-1 text-[12px] font-medium text-white hover:opacity-90"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="flex-1 rounded-md border border-border px-2 py-1 text-[12px] text-fg hover:bg-bg-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[13px] text-[var(--priority-urgent)] hover:bg-bg-hover"
              >
                <Trash2 size={14} /> Delete customer
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
