import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { projectProgress } from '@/lib/selectors'
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from '@/lib/constants'
import { Avatar } from '@/components/Avatar'
import { ProjectStatusIcon } from '@/components/ProjectStatusIcon'
import { ProgressDonut } from '@/components/ProgressDonut'
import { HealthBadge } from '@/components/ProjectUpdates'
import { EmptyState, StackIllustration } from '@/components/EmptyState'
import {
  ProjectsDisplayMenu,
  DEFAULT_PROJECT_PROPERTIES,
  type ProjectGroupBy,
  type ProjectOrderBy,
  type ProjectProperty,
} from '@/components/ProjectsDisplayMenu'
import { formatDate, cn } from '@/lib/utils'
import type { Project, ProjectHealth } from '@/lib/types'

const HEALTH_LABEL: Record<ProjectHealth, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  'off-track': 'Off track',
}

export function ProjectsView() {
  const navigate = useNavigate()
  const { projects, issues, users } = useStoreShallow((s) => ({
    projects: s.projects,
    issues: s.issues,
    users: s.users,
    projectUpdates: s.projectUpdates,
  }))
  const data = useStore()

  const [groupBy, setGroupBy] = useState<ProjectGroupBy>('none')
  const [orderBy, setOrderBy] = useState<ProjectOrderBy>('manual')
  const [props, setProps] = useState<Record<ProjectProperty, boolean>>(
    DEFAULT_PROJECT_PROPERTIES,
  )
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

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

  const sorted = useMemo(() => {
    const arr = [...projects]
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
  }, [projects, orderBy])

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
      label: users.find((u) => u.id === k)?.name ?? 'No lead',
      icon:
        k === '__none' ? null : (
          <Avatar user={users.find((u) => u.id === k)} size={16} />
        ),
      items,
    }))
  }, [groupBy, sorted, healthById, users])

  function toggleProperty(p: ProjectProperty) {
    setProps((prev) => ({ ...prev, [p]: !prev[p] }))
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Projects"
        right={
          <ProjectsDisplayMenu
            groupBy={groupBy}
            orderBy={orderBy}
            properties={props}
            onGroupBy={setGroupBy}
            onOrderBy={setOrderBy}
            onToggleProperty={toggleProperty}
          />
        }
      />
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <EmptyState
            illustration={<StackIllustration />}
            title="Projects"
            description="Projects are larger units of work with a clear outcome, such as a new feature you want to ship. They can be shared across multiple teams and are comprised of issues and optional documents."
          />
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
