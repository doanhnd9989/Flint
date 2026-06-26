import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus,
  Trash2,
  X,
  Building2,
  Users as UsersIcon,
  Link2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Star,
} from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { Avatar } from '@/components/Avatar'
import { StatusIcon } from '@/components/StatusIcon'
import { PriorityIcon } from '@/components/PriorityIcon'
import { EmptyState, StackIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { CUSTOMER_TIERS, CUSTOMER_TIER_ORDER } from '@/lib/constants'
import { formatFullDate, timeAgo } from '@/lib/utils'
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

  // Click-to-edit the customer's account notes inline, the way Linear lets you
  // edit a description without a separate form. Autosaves on blur.
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')

  // Status filter for the Requests list — Linear defaults to hiding resolved
  // requests so the open work stays front-and-centre.
  const [reqFilter, setReqFilter] = useState<'open' | 'completed' | 'all'>('open')

  // Activity feed filter — Linear lets you narrow the timeline to a single
  // event kind. Defaults to All.
  const [actFilter, setActFilter] = useState<'all' | 'created' | 'requested' | 'completed' | 'canceled'>('all')

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

  // Request activity timeline — a chronological feed reconstructed from the
  // linked issues' lifecycle timestamps plus the customer's own creation.
  // Linear surfaces this so the team can see at a glance how a customer's
  // requests have moved over time. Newest events first.
  const activity = useMemo(() => {
    type Kind = 'created' | 'requested' | 'completed' | 'canceled'
    const events: { id: string; kind: Kind; at: string; issueId?: string }[] = [
      { id: `cust-${customer?.id ?? ''}`, kind: 'created', at: customer?.createdAt ?? '' },
    ]
    for (const issue of allRequests) {
      events.push({ id: `req-${issue.id}`, kind: 'requested', at: issue.createdAt, issueId: issue.id })
      if (issue.completedAt)
        events.push({ id: `done-${issue.id}`, kind: 'completed', at: issue.completedAt, issueId: issue.id })
      if (issue.canceledAt)
        events.push({ id: `cancel-${issue.id}`, kind: 'canceled', at: issue.canceledAt, issueId: issue.id })
    }
    return events
      .filter((e) => e.at)
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [allRequests, customer?.id, customer?.createdAt])

  // Per-kind counts for the activity filter pills, plus the visible subset.
  const actCounts = useMemo(() => {
    const c = { created: 0, requested: 0, completed: 0, canceled: 0 }
    for (const e of activity) c[e.kind]++
    return c
  }, [activity])

  const visibleActivity = useMemo(
    () => (actFilter === 'all' ? activity : activity.filter((e) => e.kind === actFilter)),
    [activity, actFilter],
  )

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
  const isFavorite = data.favorites.some((f) => f.type === 'customer' && f.id === customer.id)

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
        <button
          type="button"
          onClick={() => data.toggleFavorite('customer', customer.id)}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className={`ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-bg-hover ${
            isFavorite ? 'text-[var(--c-yellow)]' : 'text-faint hover:text-fg'
          }`}
        >
          <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
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

            {/* Notes / About — free-text account notes. Click to edit,
                autosaves on blur. */}
            <div className="mt-8">
              <div className="mb-1.5 text-[13px] font-medium text-fg">Notes</div>
              {editingNotes ? (
                <textarea
                  autoFocus
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onBlur={() => {
                    data.updateCustomer(customer.id, { notes: notesDraft.trim() })
                    setEditingNotes(false)
                  }}
                  onKeyDown={(e) => {
                    // ⌘↵ / Ctrl+↵ commits and closes the editor.
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      e.currentTarget.blur()
                    }
                  }}
                  placeholder="Add notes about this customer…"
                  className="min-h-[72px] w-full resize-none rounded-md bg-transparent text-[13px] text-muted outline-none placeholder:text-faint"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNotesDraft(customer.notes ?? '')
                    setEditingNotes(true)
                  }}
                  className="block w-full whitespace-pre-wrap text-left text-[13px] text-muted"
                >
                  {customer.notes || (
                    <span className="text-faint">Add notes about this customer…</span>
                  )}
                </button>
              )}
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

            {/* Activity — a reverse-chronological feed of request lifecycle
                events for this customer. */}
            <div className="mt-10">
              <div className="mb-3 text-[13px] font-medium text-fg">Activity</div>

              {/* Kind filter — narrow the timeline to a single event kind. */}
              {activity.length > 0 && (
                <div className="mb-3 flex items-center gap-0.5 text-[12px]">
                  {(
                    [
                      ['all', 'All', activity.length],
                      ['created', 'Created', actCounts.created],
                      ['requested', 'Requested', actCounts.requested],
                      ['completed', 'Completed', actCounts.completed],
                      ['canceled', 'Canceled', actCounts.canceled],
                    ] as const
                  ).map(([key, label, count]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActFilter(key)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 ${
                        actFilter === key
                          ? 'bg-bg-selected text-fg'
                          : 'text-muted hover:bg-bg-hover hover:text-fg'
                      }`}
                    >
                      {label}
                      <span className={actFilter === key ? 'text-muted' : 'text-faint'}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                {/* Vertical rail joining the event dots. */}
                {visibleActivity.length > 1 && (
                  <span className="absolute left-[9px] top-1 bottom-1 w-px bg-border" aria-hidden />
                )}
                {visibleActivity.length === 0 ? (
                  <div className="py-6 text-[13px] text-faint">No{actFilter === 'all' ? '' : ` ${actFilter}`} activity.</div>
                ) : (
                <ul className="space-y-3">
                  {visibleActivity.map((ev) => {
                    const issue = ev.issueId
                      ? allRequests.find((i) => i.id === ev.issueId)
                      : undefined
                    const meta =
                      ev.kind === 'created'
                        ? { icon: <Sparkles size={11} />, tint: 'text-accent', verb: 'Customer added' }
                        : ev.kind === 'requested'
                          ? { icon: <Link2 size={11} />, tint: 'text-muted', verb: 'Requested' }
                          : ev.kind === 'completed'
                            ? {
                                icon: <CheckCircle2 size={11} />,
                                tint: 'text-[var(--c-green)]',
                                verb: 'Completed',
                              }
                            : {
                                icon: <XCircle size={11} />,
                                tint: 'text-faint',
                                verb: 'Canceled',
                              }
                    return (
                      <li key={ev.id} className="relative flex items-start gap-2.5">
                        <span
                          className={`relative z-10 mt-px flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border border-border bg-bg ${meta.tint}`}
                        >
                          {meta.icon}
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5 text-[13px]">
                          <span className="text-muted">{meta.verb}</span>
                          {issue ? (
                            <>
                              {' '}
                              <button
                                type="button"
                                onClick={() => navigate(`/issue/${issue.identifier}`)}
                                className="font-medium text-fg hover:text-accent hover:underline"
                              >
                                {issue.title}
                              </button>{' '}
                              <span className="font-mono text-[12px] text-faint">
                                {issue.identifier}
                              </span>
                            </>
                          ) : (
                            <span className="text-fg"> {customer.name}</span>
                          )}
                          <span className="ml-1.5 text-faint">· {timeAgo(ev.at)}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                )}
              </div>
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
