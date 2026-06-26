import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Plus } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { EmptyState, InitiativeIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { initiativeProgress } from '@/lib/selectors'
import { INITIATIVE_STATUS } from '@/lib/constants'
import type { InitiativeStatus } from '@/lib/types'
import { formatDate, cn } from '@/lib/utils'

type Tab = 'active' | 'planned' | 'completed'

const TABS: { id: Tab; label: string; match: InitiativeStatus[] }[] = [
  { id: 'active', label: 'Active', match: ['active'] },
  { id: 'planned', label: 'Planned', match: ['planned', 'backlog'] },
  { id: 'completed', label: 'Completed', match: ['completed'] },
]

type Sort = 'name' | 'progress' | 'target' | 'projects'

const SORTS: { id: Sort; label: string }[] = [
  { id: 'name', label: 'Name A→Z' },
  { id: 'progress', label: 'Progress' },
  { id: 'target', label: 'Target date' },
  { id: 'projects', label: 'Projects' },
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
  const [sort, setSort] = useState<Sort>('name')
  const [ownerId, setOwnerId] = useState<string>('all')
  const { initiatives, projects, issues, users } = useStoreShallow((s) => ({
    initiatives: s.initiatives,
    projects: s.projects,
    issues: s.issues,
    users: s.users,
  }))
  const data = useStore()
  const setCreateInitiativeOpen = useStore((s) => s.setCreateInitiativeOpen)

  const activeTab = TABS.find((t) => t.id === tab)!

  // Owners that actually own at least one initiative — drives the filter list.
  const owners = useMemo(() => {
    const ids = new Set(initiatives.map((i) => i.ownerId).filter(Boolean))
    return users.filter((u) => ids.has(u.id))
  }, [initiatives, users])

  // Pre-compute aggregate progress per shown initiative so sort can reuse it.
  const shown = useMemo(() => {
    const rows = initiatives
      .filter((i) => activeTab.match.includes(i.status))
      .filter((i) => ownerId === 'all' || i.ownerId === ownerId)
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
  }, [initiatives, activeTab, ownerId, sort, projects, issues, data])

  const sortLabel = SORTS.find((s) => s.id === sort)!.label
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

      {/* Sort + owner filter toolbar */}
      <div className="flex items-center justify-end gap-2 border-b border-border px-4 py-1.5">
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
