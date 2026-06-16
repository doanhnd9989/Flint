import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { groupIssues, sortIssues, projectProgress } from '@/lib/selectors'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { Avatar } from '@/components/Avatar'
import { formatFullDate } from '@/lib/utils'

export function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useStore()
  const project = data.projects.find((p) => p.id === id)

  const groups = useMemo(() => {
    if (!project) return []
    const scoped = data.issues.filter((i) => i.projectId === project.id)
    return groupIssues(sortIssues(scoped, 'priority', data), 'status', data)
  }, [data, project])

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-faint">
        Project not found
      </div>
    )
  }

  const lead = data.users.find((u) => u.id === project.leadId)
  const prog = projectProgress(project.id, data.issues, data)

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-[13px]">
        <button onClick={() => navigate('/projects')} className="text-muted hover:text-fg">
          Projects
        </button>
        <span className="text-faint">›</span>
        <span className="font-medium text-fg">
          {project.icon} {project.name}
        </span>
      </header>

      <div className="border-b border-border px-6 py-5">
        <div className="flex items-start gap-4">
          <span className="text-3xl">{project.icon}</span>
          <div className="flex-1">
            <h1 className="text-[18px] font-semibold text-fg">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-[13px] text-muted">{project.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-muted">
              <span className="flex items-center gap-1.5">
                <Avatar user={lead} size={18} /> {lead?.name}
              </span>
              {project.targetDate && (
                <span>Target {formatFullDate(project.targetDate)}</span>
              )}
              <span>
                {prog.done}/{prog.total} issues · {prog.percent}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-64 overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${prog.percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <GroupedIssueList groups={groups} groupBy="status" />
    </div>
  )
}
