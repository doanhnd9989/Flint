import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ListFilter, Check, X } from 'lucide-react'
import { useStore, useStoreShallow, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { projectProgress } from '@/lib/selectors'
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from '@/lib/constants'
import { Avatar } from '@/components/Avatar'
import { ProjectStatusIcon } from '@/components/ProjectStatusIcon'
import { ProgressDonut } from '@/components/ProgressDonut'
import { HealthBadge } from '@/components/ProjectUpdates'
import { EmptyState, StackIllustration } from '@/components/EmptyState'
import { Popover } from '@/components/ui/Popover'
import {
  ProjectsDisplayMenu,
  DEFAULT_PROJECT_PROPERTIES,
  type ProjectLayout,
  type ProjectGroupBy,
  type ProjectOrderBy,
  type ProjectProperty,
} from '@/components/ProjectsDisplayMenu'
import { ProjectsBoard } from '@/components/ProjectsBoard'
import { ProjectsTimeline } from '@/components/ProjectsTimeline'
import { formatDate, cn } from '@/lib/utils'
import type { Project, ProjectHealth } from '@/lib/types'

const HEALTH_LABEL: Record<ProjectHealth, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  'off-track': 'Off track',
}

const HEALTH_FILTER_ORDER: ProjectHealth[] = ['on-track', 'at-risk', 'off-track']

export function ProjectsView() {
  const navigate = useNavigate()
  const { projects, issues, users } = useStoreShallow((s) => ({
    projects: s.projects,
    issues: s.issues,
    users: s.users,
    projectUpdates: s.projectUpdates,
  }))
  const data = useStore()
  const fmt = useDisplayName()

  const [layout, setLayout] = useState<ProjectLayout>('list')
  const [groupBy, setGroupBy] = useState<ProjectGroupBy>('none')
  const [orderBy, setOrderBy] = useState<ProjectOrderBy>('manual')
  const [props, setProps] = useState<Record<ProjectProperty, boolean>>(
    DEFAULT_PROJECT_PROPERTIES,
  )
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Active filters — Linear's project filter bar (Status / Health / Lead).
  // A project must match within every active facet (AND across facets, OR within).
  const [fStatus, setFStatus] = useState<Set<string>>(new Set())
  const [fHealth, setFHealth] = useState<Set<string>>(new Set())
  const [fLead, setFLead] = useState<Set<string>>(new Set())

  /** Latest health update per project (most recent wins). */
  const healthById = useMemo(() => {
    const map: Record<string, ProjectHealth> = {}
    for (const u of [...data.projectUpdates].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )) {
      map[u.projectId] = u.health
    }
    return map
  }, [data.projectUpdates])

  const filtered = useMemo(() => {
    if (!fStatus.size && !fHealth.size && !fLead.size) return projects
    return projects.filter((p) => {
      if (fStatus.size && !fStatus.has(p.status)) return false
      if (fHealth.size && !fHealth.has(healthById[p.id] ?? '__none')) return false
      if (fLead.size && !fLead.has(p.leadId ?? '__none')) return false
      return true
    })
  }, [projects, fStatus, fHealth, fLead, healthById])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      switch (orderBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'targetDate':
          return (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999')
        case 'created':
          return b.createdAt.localeCompare(a.createdAt)
        default:
          return a.sortOrder - b.sortOrder
      }
    })
    return arr
  }, [filtered, orderBy])

  const groups = useMemo(() => {
    if (groupBy === 'none')
      return [{ key: '__all', label: '', items: sorted, icon: null }]

    if (groupBy === 'status') {
      return PROJECT_STATUS_ORDER.map((s) => ({
        key: s,
        label: PROJECT_STATUS[s].label,
        icon: <ProjectStatusIcon status={s} />,
        items: sorted.filter((p) => p.status === s),
      })).filter((g) => g.items.length > 0)
    }

    if (groupBy === 'health') {
      const order: (ProjectHealth | 'none')[] = [
        'on-track',
        'at-risk',
        'off-track',
        'none',
      ]
      return order
        .map((h) => ({
          key: h,
          label: h === 'none' ? 'No update' : HEALTH_LABEL[h],
          icon: null,
          items: sorted.filter((p) => (healthById[p.id] ?? 'none') === h),
        }))
        .filter((g) => g.items.length > 0)
    }

    // group by lead
    const leads = new Map<string, Project[]>()
    for (const p of sorted) {
      const k = p.leadId ?? '__none'
      if (!leads.has(k)) leads.set(k, [])
      leads.get(k)!.push(p)
    }
    return [...leads.entries()].map(([k, items]) => ({
      key: k,
      label: fmt(users.find((u) => u.id === k)?.name) || 'No lead',
      icon:
        k === '__none' ? null : (
          <Avatar user={users.find((u) => u.id === k)} size={16} />
        ),
      items,
    }))
  }, [groupBy, sorted, healthById, users, fmt])

  function toggleProperty(p: ProjectProperty) {
    setProps((prev) => ({ ...prev, [p]: !prev[p] }))
  }

  function toggle(set: (fn: (s: Set<string>) => Set<string>) => void, v: string) {
    set((prev) => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })
  }

  // Leads that actually lead a project — the only useful options for the facet.
  const leadOptions = useMemo(() => {
    const ids = new Set(projects.map((p) => p.leadId ?? '__none'))
    return [...ids].map((id) => ({
      id,
      label: id === '__none' ? 'No lead' : fmt(users.find((u) => u.id === id)?.name) || 'Unknown',
    }))
  }, [projects, users, fmt])

  const filterCount = fStatus.size + fHealth.size + fLead.size

  function clearFilters() {
    setFStatus(new Set())
    setFHealth(new Set())
    setFLead(new Set())
  }

  /** A removable chip for one active facet value, shown in the filter bar. */
  function FilterPill({
    label,
    onRemove,
  }: {
    label: string
    onRemove: () => void
  }) {
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

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Projects"
        right={
          <div className="flex items-center gap-1.5">
            <Popover
              width={232}
              align="end"
              trigger={
                <span className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover">
                  <ListFilter size={13} />
                  Filter
                  {filterCount > 0 && (
                    <span className="rounded bg-bg-selected px-1 text-[11px] text-fg">
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
                    options={PROJECT_STATUS_ORDER.map((s) => ({
                      id: s,
                      label: PROJECT_STATUS[s].label,
                      icon: <ProjectStatusIcon status={s} />,
                    }))}
                    selected={fStatus}
                    onToggle={(v) => toggle(setFStatus, v)}
                  />
                  <div className="border-t border-border" />
                  <FilterSection
                    title="Health"
                    options={[
                      ...HEALTH_FILTER_ORDER.map((h) => ({
                        id: h,
                        label: HEALTH_LABEL[h],
                      })),
                      { id: '__none', label: 'No update' },
                    ]}
                    selected={fHealth}
                    onToggle={(v) => toggle(setFHealth, v)}
                  />
                  <div className="border-t border-border" />
                  <FilterSection
                    title="Lead"
                    options={leadOptions}
                    selected={fLead}
                    onToggle={(v) => toggle(setFLead, v)}
                  />
                </div>
              )}
            </Popover>
            <ProjectsDisplayMenu
              layout={layout}
              groupBy={groupBy}
              orderBy={orderBy}
              properties={props}
              onLayout={setLayout}
              onGroupBy={setGroupBy}
              onOrderBy={setOrderBy}
              onToggleProperty={toggleProperty}
            />
          </div>
        }
      />
      {filterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-1.5">
          {[...fStatus].map((s) => (
            <FilterPill
              key={`s-${s}`}
              label={PROJECT_STATUS[s as keyof typeof PROJECT_STATUS]?.label ?? s}
              onRemove={() => toggle(setFStatus, s)}
            />
          ))}
          {[...fHealth].map((h) => (
            <FilterPill
              key={`h-${h}`}
              label={
                h === '__none'
                  ? 'No update'
                  : HEALTH_LABEL[h as ProjectHealth] ?? h
              }
              onRemove={() => toggle(setFHealth, h)}
            />
          ))}
          {[...fLead].map((l) => (
            <FilterPill
              key={`l-${l}`}
              label={
                leadOptions.find((o) => o.id === l)?.label ?? 'Lead'
              }
              onRemove={() => toggle(setFLead, l)}
            />
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="ml-1 text-[12px] text-muted hover:text-fg"
          >
            Clear
          </button>
          <span className="ml-auto text-[12px] text-faint">
            {sorted.length} {sorted.length === 1 ? 'project' : 'projects'}
          </span>
        </div>
      )}
      <div className={cn('flex-1', layout === 'board' || layout === 'timeline' ? 'overflow-hidden' : 'overflow-y-auto')}>
        {projects.length === 0 ? (
          <EmptyState
            illustration={<StackIllustration />}
            title="Projects"
            description="Projects are larger units of work with a clear outcome, such as a new feature you want to ship. They can be shared across multiple teams and are comprised of issues and optional documents."
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            illustration={<StackIllustration />}
            title="No matching projects"
            description="No projects match the current filters. Try removing or adjusting them."
            action={{ label: 'Clear filters', onClick: clearFilters }}
          />
        ) : layout === 'board' ? (
          <ProjectsBoard projects={sorted} onOpen={(id) => navigate(`/project/${id}`)} />
        ) : layout === 'timeline' ? (
          <ProjectsTimeline projects={sorted} onOpen={(id) => navigate(`/project/${id}`)} />
        ) : (
          groups.map((g) => (
            <div key={g.key}>
              {g.label && (
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))
                  }
                  className="sticky top-0 z-10 flex w-full items-center gap-1.5 bg-bg-secondary px-4 py-1.5 text-[12px] font-medium text-fg"
                >
                  <ChevronRight
                    size={13}
                    className={cn(
                      'text-faint transition-transform',
                      !collapsed[g.key] && 'rotate-90',
                    )}
                  />
                  {g.icon}
                  <span>{g.label}</span>
                  <span className="text-faint">{g.items.length}</span>
                </button>
              )}
              {!collapsed[g.key] &&
                g.items.map((p) => {
                  const prog = projectProgress(p.id, issues, data)
                  const lead = users.find((u) => u.id === p.leadId)
                  const members = p.memberIds
                    .map((mid) => users.find((u) => u.id === mid))
                    .filter(Boolean)
                  const health = healthById[p.id]
                  return (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/project/${p.id}`)}
                      className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-left hover:bg-bg-hover"
                    >
                      {props.status && <ProjectStatusIcon status={p.status} />}
                      <span className="text-[14px]">{p.icon}</span>
                      <span className="truncate text-[13px] font-medium text-fg">
                        {p.name}
                      </span>
                      <div className="ml-auto flex items-center gap-3 text-[12px] text-muted">
                        {props.issues && prog.total > 0 && (
                          <span className="flex items-center gap-1.5">
                            <ProgressDonut percent={prog.percent} />
                            {prog.percent}%
                          </span>
                        )}
                        {props.health && health && (
                          <HealthBadge health={health} />
                        )}
                        {props.targetDate && p.targetDate && (
                          <span className="tabular-nums">
                            {formatDate(p.targetDate)}
                          </span>
                        )}
                        {props.members && members.length > 0 && (
                          <span className="flex -space-x-1">
                            {members.slice(0, 3).map((m) => (
                              <span key={m!.id} className="ring-2 ring-bg rounded-full">
                                <Avatar user={m!} size={18} />
                              </span>
                            ))}
                          </span>
                        )}
                        {props.lead && (
                          <Avatar user={lead} size={18} />
                        )}
                      </div>
                    </button>
                  )
                })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
