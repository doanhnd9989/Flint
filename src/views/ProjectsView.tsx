import { useNavigate } from 'react-router-dom'
import { useStore, useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { projectProgress } from '@/lib/selectors'
import { Avatar } from '@/components/Avatar'
import { formatDate } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  planned: 'Planned',
  started: 'In Progress',
  paused: 'Paused',
  completed: 'Completed',
  canceled: 'Canceled',
}

export function ProjectsView() {
  const navigate = useNavigate()
  const { projects, issues, users } = useStoreShallow((s) => ({
    projects: s.projects,
    issues: s.issues,
    users: s.users,
    states: s.states,
  }))
  const data = useStore()

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Projects" />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const prog = projectProgress(p.id, issues, data)
            const lead = users.find((u) => u.id === p.leadId)
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/project/${p.id}`)}
                className="flex flex-col rounded-xl border border-border bg-bg-secondary p-4 text-left hover:border-border-strong"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.icon}</span>
                  <span className="text-[14px] font-semibold text-fg">{p.name}</span>
                </div>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-[12px] text-muted">
                    {p.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
                  <span className="rounded-full bg-bg-tertiary px-2 py-0.5">
                    {STATUS_LABEL[p.status]}
                  </span>
                  {p.targetDate && <span>· {formatDate(p.targetDate)}</span>}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-faint">
                    <span>
                      {prog.done}/{prog.total} done
                    </span>
                    <span>{prog.percent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${prog.percent}%` }}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1">
                  <Avatar user={lead} size={20} />
                  <span className="text-[12px] text-muted">{lead?.name}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
