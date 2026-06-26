import { useMemo } from 'react'
import { useStore, useStoreShallow } from '@/lib/store'
import { projectProgress } from '@/lib/selectors'
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from '@/lib/constants'
import { Avatar } from '@/components/Avatar'
import { ProjectStatusIcon } from '@/components/ProjectStatusIcon'
import { ProgressDonut } from '@/components/ProgressDonut'
import { HealthBadge } from '@/components/ProjectUpdates'
import { formatDate } from '@/lib/utils'
import type { Project, ProjectHealth, ProjectStatus } from '@/lib/types'

interface Props {
  projects: Project[]
  onOpen: (id: string) => void
}

/**
 * Linear's Projects "Board" layout — a horizontal kanban with one fixed-width
 * column per ProjectStatus (in PROJECT_STATUS_ORDER). Each project from the
 * (already filtered/sorted) `projects` prop is placed in its status column as a
 * card showing the same content as the list row: status icon, emoji + name,
 * progress donut + percent, health, target date, and lead avatar.
 */
export function ProjectsBoard({ projects, onOpen }: Props) {
  const { issues, users } = useStoreShallow((s) => ({
    issues: s.issues,
    users: s.users,
    projectUpdates: s.projectUpdates,
  }))
  const data = useStore()

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

  /**
   * Bucket the passed-in projects by status (every status renders a column),
   * and roll up each column's completion across its projects' issues — the
   * union of all scoped issues, with percent = done / total (the same weighted
   * rollup Linear shows as a column subtotal).
   */
  const columns = useMemo(() => {
    const byStatus: Record<ProjectStatus, Project[]> = {
      backlog: [],
      planned: [],
      started: [],
      paused: [],
      completed: [],
      canceled: [],
    }
    for (const p of projects) byStatus[p.status]?.push(p)
    return PROJECT_STATUS_ORDER.map((s) => {
      const items = byStatus[s]
      let total = 0
      let done = 0
      for (const p of items) {
        const prog = projectProgress(p.id, issues, data)
        total += prog.total
        done += prog.done
      }
      const percent = total ? Math.round((done / total) * 100) : 0
      return { status: s, items, total, percent }
    })
  }, [projects, issues, data])

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-3">
      {columns.map(({ status, items, total, percent }) => (
        <div
          key={status}
          className="flex h-full w-[280px] shrink-0 flex-col rounded-md bg-bg-secondary"
        >
          <div className="flex items-center gap-1.5 px-3 pt-2.5 text-[12px] font-medium text-fg">
            <ProjectStatusIcon status={status} />
            <span>{PROJECT_STATUS[status].label}</span>
            <span className="text-faint">{items.length}</span>
          </div>
          {/* Rolled-up column subtotal — donut + completion % across the
              column's projects, plus the total scoped issue count. */}
          {items.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 pb-2 pt-1 text-[11px] text-muted">
              {total > 0 ? (
                <>
                  <ProgressDonut percent={percent} />
                  <span className="tabular-nums">{percent}%</span>
                  <span className="text-faint">·</span>
                  <span className="tabular-nums">
                    {total} {total === 1 ? 'issue' : 'issues'}
                  </span>
                </>
              ) : (
                <span>No issues</span>
              )}
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
            {items.map((p) => {
              const prog = projectProgress(p.id, issues, data)
              const lead = users.find((u) => u.id === p.leadId)
              const health = healthById[p.id]
              return (
                <button
                  key={p.id}
                  onClick={() => onOpen(p.id)}
                  className="flex w-full flex-col gap-2 rounded-md border border-border bg-bg p-2.5 text-left hover:bg-bg-hover"
                >
                  <div className="flex items-center gap-1.5">
                    <ProjectStatusIcon status={p.status} />
                    <span className="text-[14px]">{p.icon}</span>
                    <span className="truncate text-[13px] font-medium text-fg">
                      {p.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-muted">
                    {prog.total > 0 && (
                      <span className="flex items-center gap-1.5">
                        <ProgressDonut percent={prog.percent} />
                        {prog.percent}%
                      </span>
                    )}
                    {health && <HealthBadge health={health} />}
                    {p.targetDate && (
                      <span className="tabular-nums">
                        {formatDate(p.targetDate)}
                      </span>
                    )}
                    <span className="ml-auto">
                      <Avatar user={lead} size={18} />
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
