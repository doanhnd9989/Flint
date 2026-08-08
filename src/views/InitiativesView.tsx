import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ListFilter, MoreHorizontal, Plus, X } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { EmptyState, InitiativeIllustration } from '@/components/EmptyState'
import { Popover } from '@/components/ui/Popover'
import { InitiativeContextMenu } from '@/components/InitiativeContextMenu'
import {
  DEFAULT_INITIATIVE_PROPERTIES,
  InitiativesDisplayMenu,
  type InitiativeGroupBy,
  type InitiativeLayout,
  type InitiativeOrderBy,
  type InitiativeProperty,
} from '@/components/InitiativesDisplayMenu'
import { HEALTH } from '@/components/ProjectUpdates'
import { initiativeProgress } from '@/lib/selectors'
import { INITIATIVE_STATUS, INITIATIVE_STATUS_ORDER } from '@/lib/constants'
import type { Initiative, InitiativeStatus, ProjectHealth } from '@/lib/types'
import { formatDate, cn } from '@/lib/utils'

/**
 * Linear's three initiative tabs, each on its own URL:
 * `/initiatives/active`, `/initiatives/planned`, `/initiatives`. The third is
 * "All initiatives" — not "Completed", which is what this screen used to say
 * while also hiding every non-completed initiative behind it.
 */
type Tab = 'active' | 'planned' | 'all'

const TABS: { id: Tab; label: string; path: string; match?: InitiativeStatus[] }[] = [
  { id: 'active', label: 'Active', path: '/initiatives/active', match: ['active'] },
  {
    id: 'planned',
    label: 'Planned',
    path: '/initiatives/planned',
    match: ['planned', 'backlog'],
  },
  { id: 'all', label: 'All initiatives', path: '/initiatives' },
]

// Health facet — the three real ProjectHealth values plus a synthetic
// "none" bucket for initiatives that have never posted an update.
type HealthFilter = ProjectHealth | 'none'

const HEALTH_FILTERS: { id: HealthFilter; label: string; color?: string }[] = [
  { id: 'on-track', label: HEALTH['on-track'].label, color: HEALTH['on-track'].color },
  { id: 'at-risk', label: HEALTH['at-risk'].label, color: HEALTH['at-risk'].color },
  { id: 'off-track', label: HEALTH['off-track'].label, color: HEALTH['off-track'].color },
  { id: 'none', label: 'No update' },
]

/** Small colored ring matching the initiative's lifecycle status. */
function StatusRing({ status }: { status: InitiativeStatus }) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border-2"
      style={{ borderColor: INITIATIVE_STATUS[status].color }}
    />
  )
}

/** A removable chip for one active facet value, shown under the tab row. */
function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-md border border-border bg-bg-secondary px-1.5 py-0.5 text-[12px] text-fg">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-sm text-faint hover:text-fg"
      >
        <X size={12} />
      </button>
    </span>
  )
}

/** One section inside the filter popover — a list of checkbox-style options. */
function FilterSection<T extends { id: string; label: string; icon?: React.ReactNode }>({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string
  options: T[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="py-1">
      <div className="px-2 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-faint">
        {title}
      </div>
      {options.map((o) => {
        const on = selected.has(o.id)
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] text-fg hover:bg-bg-hover"
          >
            <span
              className={cn(
                'flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border',
                on ? 'border-accent bg-accent text-white' : 'border-border',
              )}
            >
              {on && <Check size={10} />}
            </span>
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function InitiativesView() {
  const navigate = useNavigate()
  const { tab: tabParam } = useParams<{ tab?: string }>()
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : 'all'

  const [layout, setLayout] = useState<InitiativeLayout>('list')
  const [groupBy, setGroupBy] = useState<InitiativeGroupBy>('none')
  const [orderBy, setOrderBy] = useState<InitiativeOrderBy>('name')
  const [props, setProps] = useState<Record<InitiativeProperty, boolean>>(
    DEFAULT_INITIATIVE_PROPERTIES,
  )
  const [fStatus, setFStatus] = useState<Set<string>>(new Set())
  const [fHealth, setFHealth] = useState<Set<string>>(new Set())
  const [fOwner, setFOwner] = useState<Set<string>>(new Set())
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; y: number } | null>(
    null,
  )

  const { initiatives, projects, issues, users, initiativeUpdates } =
    useStoreShallow((s) => ({
      initiatives: s.initiatives,
      projects: s.projects,
      issues: s.issues,
      users: s.users,
      initiativeUpdates: s.initiativeUpdates,
    }))
  const data = useStore()
  const setCreateInitiativeOpen = useStore((s) => s.setCreateInitiativeOpen)

  const activeTab = TABS.find((t) => t.id === tab)!

  // Owners that actually own at least one initiative — drives the filter list.
  const owners = useMemo(() => {
    const ids = new Set(initiatives.map((i) => i.ownerId).filter(Boolean))
    return users.filter((u) => ids.has(u.id))
  }, [initiatives, users])

  // Latest health per initiative, taken from the most recent update — mirrors
  // the badge logic in InitiativeDetail. Initiatives without any update are
  // absent from the map and treated as the synthetic "No update" facet. The
  // timestamp doubles as the "Health updated" sort key.
  const { latestHealth, healthAt } = useMemo(() => {
    const map = new Map<string, ProjectHealth>()
    const newest = new Map<string, string>()
    for (const u of initiativeUpdates) {
      const prev = newest.get(u.initiativeId)
      if (!prev || u.createdAt.localeCompare(prev) > 0) {
        newest.set(u.initiativeId, u.createdAt)
        map.set(u.initiativeId, u.health)
      }
    }
    return { latestHealth: map, healthAt: newest }
  }, [initiativeUpdates])

  // Pre-compute aggregate progress per shown initiative so sort can reuse it.
  const shown = useMemo(() => {
    const rows = initiatives
      .filter((i) => !i.archivedAt)
      .filter((i) => !activeTab.match || activeTab.match.includes(i.status))
      .filter((i) => fStatus.size === 0 || fStatus.has(i.status))
      .filter((i) => fOwner.size === 0 || (i.ownerId ? fOwner.has(i.ownerId) : false))
      .filter((i) => {
        if (fHealth.size === 0) return true
        const h = latestHealth.get(i.id)
        return fHealth.has(h ?? 'none')
      })
      .map((i) => ({
        initiative: i,
        prog: initiativeProgress(i.id, projects, issues, data),
      }))
    rows.sort((a, b) => {
      switch (orderBy) {
        case 'manual':
          return a.initiative.sortOrder - b.initiative.sortOrder
        case 'status':
          return (
            INITIATIVE_STATUS_ORDER.indexOf(a.initiative.status) -
            INITIATIVE_STATUS_ORDER.indexOf(b.initiative.status)
          )
        case 'healthUpdated': {
          // newest update first; never-updated initiatives sink to the bottom
          const ax = healthAt.get(a.initiative.id)
          const bx = healthAt.get(b.initiative.id)
          if (!ax) return bx ? 1 : 0
          if (!bx) return -1
          return bx.localeCompare(ax)
        }
        case 'targetDate':
          // soonest first; initiatives without a target sink to the bottom
          if (!a.initiative.targetDate) return b.initiative.targetDate ? 1 : 0
          if (!b.initiative.targetDate) return -1
          return a.initiative.targetDate.localeCompare(b.initiative.targetDate)
        default:
          return a.initiative.name.localeCompare(b.initiative.name)
      }
    })
    return rows
  }, [
    initiatives,
    activeTab,
    fStatus,
    fOwner,
    fHealth,
    latestHealth,
    healthAt,
    orderBy,
    projects,
    issues,
    data,
  ])

  /** Grouped rendering — one section per group, in the grouping's own order. */
  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: '', rows: shown }]
    if (groupBy === 'status') {
      return INITIATIVE_STATUS_ORDER.map((s) => ({
        key: s,
        label: INITIATIVE_STATUS[s].label,
        rows: shown.filter((r) => r.initiative.status === s),
      })).filter((g) => g.rows.length > 0)
    }
    if (groupBy === 'health') {
      return HEALTH_FILTERS.map((h) => ({
        key: h.id,
        label: h.label,
        rows: shown.filter(
          (r) => (latestHealth.get(r.initiative.id) ?? 'none') === h.id,
        ),
      })).filter((g) => g.rows.length > 0)
    }
    return [
      ...owners.map((u) => ({
        key: u.id,
        label: u.name,
        rows: shown.filter((r) => r.initiative.ownerId === u.id),
      })),
      {
        key: '__none',
        label: 'No owner',
        rows: shown.filter((r) => !r.initiative.ownerId),
      },
    ].filter((g) => g.rows.length > 0)
  }, [groupBy, shown, latestHealth, owners])

  const filterCount = fStatus.size + fHealth.size + fOwner.size

  const toggle = (
    set: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) =>
    set((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleProperty = (p: InitiativeProperty) =>
    setProps((prev) => ({ ...prev, [p]: !prev[p] }))

  const resetDisplay = () => {
    setLayout('list')
    setGroupBy('none')
    setOrderBy('name')
    setProps(DEFAULT_INITIATIVE_PROPERTIES)
  }

  /** Projects linked to an initiative that are not finished yet. */
  const activeProjectCount = (initiativeId: string) =>
    projects.filter(
      (p) =>
        p.initiativeId === initiativeId &&
        p.status !== 'completed' &&
        p.status !== 'canceled',
    ).length

  const openRowMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    setRowMenu({ id, x: e.clientX, y: e.clientY })
  }

  /** Health dot shown on a row when the Health property is on. */
  const healthDot = (i: Initiative) => {
    const h = latestHealth.get(i.id)
    return (
      <span
        title={h ? HEALTH[h].label : 'No update'}
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: h ? HEALTH[h].color : 'var(--text-faint)' }}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Initiatives"
        right={
          <button
            type="button"
            title="New initiative"
            aria-label="New initiative"
            onClick={() => setCreateInitiativeOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg"
          >
            <Plus size={16} />
          </button>
        }
      />

      {/* Lifecycle tabs, with Linear's Add filter / Display options on the same
          row at the far right rather than a toolbar row of their own. */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => navigate(t.path)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors',
              tab === t.id ? 'bg-bg-tertiary text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {t.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <Popover
            width={232}
            align="end"
            label="Add filter"
            trigger={
              <span className="relative flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg">
                <ListFilter size={15} />
                {filterCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 rounded bg-accent px-1 text-[10px] text-white">
                    {filterCount}
                  </span>
                )}
              </span>
            }
          >
            {() => (
              <div className="max-h-[60vh] overflow-y-auto">
                <FilterSection
                  title="Status"
                  options={INITIATIVE_STATUS_ORDER.map((s) => ({
                    id: s,
                    label: INITIATIVE_STATUS[s].label,
                    icon: <StatusRing status={s} />,
                  }))}
                  selected={fStatus}
                  onToggle={(v) => toggle(setFStatus, v)}
                />
                <div className="border-t border-border" />
                <FilterSection
                  title="Health"
                  options={HEALTH_FILTERS.map((h) => ({
                    id: h.id,
                    label: h.label,
                    icon: (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: h.color ?? 'var(--text-faint)' }}
                      />
                    ),
                  }))}
                  selected={fHealth}
                  onToggle={(v) => toggle(setFHealth, v)}
                />
                {owners.length > 0 && <div className="border-t border-border" />}
                <FilterSection
                  title="Owner"
                  options={owners.map((u) => ({
                    id: u.id,
                    label: u.name,
                    icon: <Avatar user={u} size={16} />,
                  }))}
                  selected={fOwner}
                  onToggle={(v) => toggle(setFOwner, v)}
                />
              </div>
            )}
          </Popover>

          <InitiativesDisplayMenu
            layout={layout}
            groupBy={groupBy}
            orderBy={orderBy}
            properties={props}
            onLayout={setLayout}
            onGroupBy={setGroupBy}
            onOrderBy={setOrderBy}
            onToggleProperty={toggleProperty}
            onReset={resetDisplay}
          />
        </div>
      </div>

      {filterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-1.5">
          {[...fStatus].map((s) => (
            <FilterPill
              key={`s-${s}`}
              label={INITIATIVE_STATUS[s as InitiativeStatus]?.label ?? s}
              onRemove={() => toggle(setFStatus, s)}
            />
          ))}
          {[...fHealth].map((h) => (
            <FilterPill
              key={`h-${h}`}
              label={HEALTH_FILTERS.find((x) => x.id === h)?.label ?? h}
              onRemove={() => toggle(setFHealth, h)}
            />
          ))}
          {[...fOwner].map((o) => (
            <FilterPill
              key={`o-${o}`}
              label={owners.find((u) => u.id === o)?.name ?? 'Owner'}
              onRemove={() => toggle(setFOwner, o)}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              setFStatus(new Set())
              setFHealth(new Set())
              setFOwner(new Set())
            }}
            className="rounded-md px-1.5 py-0.5 text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          initiatives.length === 0 ? (
            <EmptyState
              illustration={<InitiativeIllustration />}
              title="Initiatives"
              description="Initiatives are larger, strategic product efforts that set the direction of your company. They are comprised of all projects that align with the goals of the initiative and allow you to monitor their progress at scale."
              action={{
                label: 'Create new initiative',
                onClick: () => setCreateInitiativeOpen(true),
              }}
            />
          ) : (
            <EmptyState
              illustration={<InitiativeIllustration />}
              title="No matching initiatives"
              description="No initiatives match the current filters."
            />
          )
        ) : (
          groups.map((g) => (
            <div key={g.key}>
              {g.label && (
                <div className="flex items-center gap-2 border-b border-border bg-bg-secondary px-5 py-1.5 text-[12px] font-medium text-muted">
                  {g.label}
                  <span className="text-faint">{g.rows.length}</span>
                </div>
              )}
              {layout === 'board' ? (
                /* Board: responsive grid of initiative cards */
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.rows.map(({ initiative: i, prog }) => {
                    const owner = users.find((u) => u.id === i.ownerId)
                    return (
                      <div
                        key={i.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/initiative/${i.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(`/initiative/${i.id}`)
                        }}
                        onContextMenu={(e) => openRowMenu(e, i.id)}
                        className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-bg-secondary p-4 text-left transition-colors hover:bg-bg-hover"
                      >
                        {/* icon + name + status */}
                        <div className="flex items-start gap-2.5">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[16px]"
                            style={{ background: `${i.color}20` }}
                          >
                            {i.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-medium text-fg">
                              {i.name}
                            </div>
                            {props.status && (
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <StatusRing status={i.status} />
                                <span className="text-[12px] text-faint">
                                  {INITIATIVE_STATUS[i.status].label}
                                </span>
                              </div>
                            )}
                          </div>
                          {props.health && healthDot(i)}
                        </div>
                        {props.description && i.description && (
                          <p className="line-clamp-2 text-[12px] text-muted">
                            {i.description}
                          </p>
                        )}
                        {/* progress bar + percent */}
                        <div className="mt-auto flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${prog.percent}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-[11px] text-faint">
                            {prog.percent}%
                          </span>
                        </div>
                        {/* footer: project counts + target date + owner */}
                        <div className="flex items-center gap-2 text-[12px] text-muted">
                          {props.projects && (
                            <span>
                              {prog.projectCount} project
                              {prog.projectCount === 1 ? '' : 's'}
                            </span>
                          )}
                          {props.activeProjects && (
                            <span className="text-faint">
                              · {activeProjectCount(i.id)} active
                            </span>
                          )}
                          {props.targetDate && i.targetDate && (
                            <span className="text-faint">
                              · {formatDate(i.targetDate)}
                            </span>
                          )}
                          {props.created && (
                            <span className="text-faint">
                              · {formatDate(i.createdAt)}
                            </span>
                          )}
                          {props.owner && (
                            <span className="ml-auto">
                              <Avatar user={owner} size={20} />
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div>
                  {g.rows.map(({ initiative: i, prog }) => {
                    const owner = users.find((u) => u.id === i.ownerId)
                    return (
                      <div
                        key={i.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/initiative/${i.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(`/initiative/${i.id}`)
                        }}
                        onContextMenu={(e) => openRowMenu(e, i.id)}
                        className="group flex w-full cursor-pointer items-center gap-3 border-b border-border px-5 py-3 text-left hover:bg-bg-hover"
                      >
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[15px]"
                          style={{ background: `${i.color}20` }}
                        >
                          {i.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[14px] font-medium text-fg">
                              {i.name}
                            </span>
                            {props.status && (
                              <>
                                <StatusRing status={i.status} />
                                <span className="text-[12px] text-faint">
                                  {INITIATIVE_STATUS[i.status].label}
                                </span>
                              </>
                            )}
                            {props.health && healthDot(i)}
                          </div>
                          {props.description && i.description && (
                            <p className="mt-0.5 truncate text-[12px] text-muted">
                              {i.description}
                            </p>
                          )}
                        </div>
                        {props.projects && (
                          <span className="hidden text-[12px] text-muted sm:block">
                            {prog.projectCount} project
                            {prog.projectCount === 1 ? '' : 's'}
                          </span>
                        )}
                        {props.activeProjects && (
                          <span className="hidden text-[12px] text-faint sm:block">
                            {activeProjectCount(i.id)} active
                          </span>
                        )}
                        {/* progress bar + percent */}
                        <div className="flex w-32 shrink-0 items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${prog.percent}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-[11px] text-faint">
                            {prog.percent}%
                          </span>
                        </div>
                        {props.created && (
                          <span className="hidden w-20 shrink-0 text-right text-[12px] text-faint md:block">
                            {formatDate(i.createdAt)}
                          </span>
                        )}
                        {props.targetDate && i.targetDate && (
                          <span className="hidden w-20 shrink-0 text-right text-[12px] text-muted md:block">
                            {formatDate(i.targetDate)}
                          </span>
                        )}
                        {props.owner && <Avatar user={owner} size={20} />}
                        <button
                          type="button"
                          aria-label="Initiative options"
                          onClick={(e) => openRowMenu(e, i.id)}
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-tertiary hover:text-fg',
                            rowMenu?.id === i.id
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100',
                          )}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {rowMenu && (
        <InitiativeContextMenu
          initiativeId={rowMenu.id}
          x={rowMenu.x}
          y={rowMenu.y}
          manualOrdering={orderBy === 'manual'}
          onClose={() => setRowMenu(null)}
        />
      )}
    </div>
  )
}
