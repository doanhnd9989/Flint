import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, LayoutGrid, List, Plus, Search } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { EmptyState, InitiativeIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { HEALTH } from '@/components/ProjectUpdates'
import { initiativeProgress } from '@/lib/selectors'
import { INITIATIVE_STATUS } from '@/lib/constants'
import type { InitiativeStatus, ProjectHealth } from '@/lib/types'
import { formatDate, cn } from '@/lib/utils'

type Tab = 'active' | 'planned' | 'completed'

const TABS: { id: Tab; label: string; match: InitiativeStatus[] }[] = [
  { id: 'active', label: 'Active', match: ['active'] },
  { id: 'planned', label: 'Planned', match: ['planned', 'backlog'] },
  { id: 'completed', label: 'Completed', match: ['completed'] },
]

type Layout = 'list' | 'board'

type Sort = 'name' | 'progress' | 'target' | 'projects'

const SORTS: { id: Sort; label: string }[] = [
  { id: 'name', label: 'Name A→Z' },
  { id: 'progress', label: 'Progress' },
  { id: 'target', label: 'Target date' },
  { id: 'projects', label: 'Projects' },
]

// Health facet — the three real ProjectHealth values plus a synthetic
// "none" bucket for initiatives that have never posted an update.
type HealthFilter = 'all' | ProjectHealth | 'none'

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

export function InitiativesView() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [layout, setLayout] = useState<Layout>('list')
  const [sort, setSort] = useState<Sort>('name')
  const [ownerId, setOwnerId] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [health, setHealth] = useState<HealthFilter>('all')
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
  // absent from the map and treated as the synthetic "No update" facet.
  const latestHealth = useMemo(() => {
    const map = new Map<string, ProjectHealth>()
    const newest = new Map<string, string>()
    for (const u of initiativeUpdates) {
      const prev = newest.get(u.initiativeId)
      if (!prev || u.createdAt.localeCompare(prev) > 0) {
        newest.set(u.initiativeId, u.createdAt)
        map.set(u.initiativeId, u.health)
      }
    }
    return map
  }, [initiativeUpdates])

  // Pre-compute aggregate progress per shown initiative so sort can reuse it.
  const q = query.trim().toLowerCase()
  const shown = useMemo(() => {
    const rows = initiatives
      .filter((i) => !i.archivedAt)
      .filter((i) => activeTab.match.includes(i.status))
      .filter((i) => ownerId === 'all' || i.ownerId === ownerId)
      .filter((i) => {
        if (health === 'all') return true
        const h = latestHealth.get(i.id)
        return health === 'none' ? !h : h === health
      })
      .filter((i) => !q || i.name.toLowerCase().includes(q))
      .map((i) => ({ initiative: i, prog: initiativeProgress(i.id, projects, issues, data) }))
    rows.sort((a, b) => {
      switch (sort) {
        case 'progress':
          return b.prog.percent - a.prog.percent
        case 'target':
          // soonest first; initiatives without a target sink to the bottom
          if (!a.initiative.targetDate) return b.initiative.targetDate ? 1 : 0
          if (!b.initiative.targetDate) return -1
          return a.initiative.targetDate.localeCompare(b.initiative.targetDate)
        case 'projects':
          return b.prog.projectCount - a.prog.projectCount
        default:
          return a.initiative.name.localeCompare(b.initiative.name)
      }
    })
    return rows
  }, [initiatives, activeTab, ownerId, health, latestHealth, q, sort, projects, issues, data])

  const sortLabel = SORTS.find((s) => s.id === sort)!.label
  const healthLabel =
    health === 'all'
      ? 'All health'
      : (HEALTH_FILTERS.find((h) => h.id === health)?.label ?? 'All health')
  const ownerLabel =
    ownerId === 'all'
      ? 'All owners'
      : (owners.find((u) => u.id === ownerId)?.name ?? 'All owners')

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Initiatives"
        right={
          <button
            type="button"
            title="New initiative"
            onClick={() => setCreateInitiativeOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg"
          >
            <Plus size={16} />
          </button>
        }
      />

      {/* Lifecycle tabs */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors',
              tab === t.id
                ? 'bg-bg-tertiary text-fg'
                : 'text-muted hover:text-fg',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Layout toggle + sort + owner filter toolbar */}
      <div className="flex items-center justify-end gap-2 border-b border-border px-4 py-1.5">
        {/* List / board layout switch */}
        <div className="mr-auto flex items-center gap-0.5 rounded-md bg-bg-tertiary p-0.5">
          <button
            type="button"
            title="List"
            onClick={() => setLayout('list')}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded',
              layout === 'list'
                ? 'bg-bg text-fg shadow-sm'
                : 'text-muted hover:text-fg',
            )}
          >
            <List size={14} />
          </button>
          <button
            type="button"
            title="Board"
            onClick={() => setLayout('board')}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded',
              layout === 'board'
                ? 'bg-bg text-fg shadow-sm'
                : 'text-muted hover:text-fg',
            )}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
        {/* Name search — narrows the list as you type */}
        <div className="flex h-7 items-center gap-1.5 rounded-md px-2 text-muted focus-within:text-fg">
          <Search size={13} className="shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search initiatives…"
            className="w-40 bg-transparent text-[13px] text-fg placeholder:text-faint focus:outline-none"
          />
        </div>
        {/* Health facet — filters by each initiative's latest update health */}
        <SelectMenu
          align="end"
          width={180}
          options={HEALTH_FILTERS.map((h) => ({
            id: h.id,
            label: h.label,
            icon: (
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: h.color ?? 'var(--text-faint)' }}
              />
            ),
            selected: health === h.id,
          }))}
          header={
            <button
              type="button"
              onClick={() => setHealth('all')}
              className={cn(
                'flex w-full items-center gap-2 border-b border-border px-2.5 py-1.5 text-left text-[13px] text-fg',
                health === 'all' && 'bg-bg-hover',
              )}
            >
              All health
            </button>
          }
          onSelect={(id) => setHealth(id as HealthFilter)}
          trigger={
            <span className="flex h-7 items-center gap-1 rounded-md px-2 text-[13px] text-muted hover:bg-bg-hover hover:text-fg">
              {healthLabel}
              <ChevronDown size={13} />
            </span>
          }
        />
        <SelectMenu
          align="end"
          width={200}
          options={owners.map((u) => ({
            id: u.id,
            label: u.name,
            icon: <Avatar user={u} size={16} />,
            selected: ownerId === u.id,
          }))}
          header={
            <button
              type="button"
              onClick={() => setOwnerId('all')}
              className={cn(
                'flex w-full items-center gap-2 border-b border-border px-2.5 py-1.5 text-left text-[13px] text-fg',
                ownerId === 'all' && 'bg-bg-hover',
              )}
            >
              All owners
            </button>
          }
          onSelect={(id) => setOwnerId(id)}
          trigger={
            <span className="flex h-7 items-center gap-1 rounded-md px-2 text-[13px] text-muted hover:bg-bg-hover hover:text-fg">
              {ownerLabel}
              <ChevronDown size={13} />
            </span>
          }
        />
        <SelectMenu
          align="end"
          width={180}
          options={SORTS.map((s) => ({
            id: s.id,
            label: s.label,
            selected: sort === s.id,
          }))}
          onSelect={(id) => setSort(id as Sort)}
          trigger={
            <span className="flex h-7 items-center gap-1 rounded-md px-2 text-[13px] text-muted hover:bg-bg-hover hover:text-fg">
              {sortLabel}
              <ChevronDown size={13} />
            </span>
          }
        />
      </div>

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
              description="No initiatives match the current search, health or owner filters."
            />
          )
        ) : layout === 'board' ? (
          /* Board: responsive grid of initiative cards */
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map(({ initiative: i, prog }) => {
              const owner = users.find((u) => u.id === i.ownerId)
              return (
                <button
                  key={i.id}
                  onClick={() => navigate(`/initiative/${i.id}`)}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-bg-secondary p-4 text-left transition-colors hover:bg-bg-hover"
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
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <StatusRing status={i.status} />
                        <span className="text-[12px] text-faint">
                          {INITIATIVE_STATUS[i.status].label}
                        </span>
                      </div>
                    </div>
                  </div>
                  {i.description && (
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
                  {/* footer: project count + target date + owner */}
                  <div className="flex items-center gap-2 text-[12px] text-muted">
                    <span>
                      {prog.projectCount} project
                      {prog.projectCount === 1 ? '' : 's'}
                    </span>
                    {i.targetDate && (
                      <span className="text-faint">· {formatDate(i.targetDate)}</span>
                    )}
                    <span className="ml-auto">
                      <Avatar user={owner} size={20} />
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div>
            {shown.map(({ initiative: i, prog }) => {
              const owner = users.find((u) => u.id === i.ownerId)
              return (
                <button
                  key={i.id}
                  onClick={() => navigate(`/initiative/${i.id}`)}
                  className="flex w-full items-center gap-3 border-b border-border px-5 py-3 text-left hover:bg-bg-hover"
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
                      <StatusRing status={i.status} />
                      <span className="text-[12px] text-faint">
                        {INITIATIVE_STATUS[i.status].label}
                      </span>
                    </div>
                    {i.description && (
                      <p className="mt-0.5 truncate text-[12px] text-muted">
                        {i.description}
                      </p>
                    )}
                  </div>
                  <span className="hidden text-[12px] text-muted sm:block">
                    {prog.projectCount} project{prog.projectCount === 1 ? '' : 's'}
                  </span>
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
                  {i.targetDate && (
                    <span className="hidden w-20 shrink-0 text-right text-[12px] text-muted md:block">
                      {formatDate(i.targetDate)}
                    </span>
                  )}
                  <Avatar user={owner} size={20} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
