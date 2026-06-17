import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Flag } from 'lucide-react'
import { useStore } from '@/lib/store'
import { sortIssues, projectProgress, milestoneProgress } from '@/lib/selectors'
import { IssueRow } from '@/components/IssueRow'
import { Avatar } from '@/components/Avatar'
import { ProjectUpdates, HealthBadge } from '@/components/ProjectUpdates'
import { StarButton } from '@/components/StarButton'
import { formatFullDate, cn } from '@/lib/utils'
import type { Issue } from '@/lib/types'

function Section({
  title,
  issues,
  progress,
  onDelete,
}: {
  title: React.ReactNode
  issues: Issue[]
  progress?: { done: number; total: number; percent: number }
  onDelete?: () => void
}) {
  if (issues.length === 0 && !onDelete) return null
  return (
    <div>
      <div className="group sticky top-0 z-10 flex items-center gap-2 bg-bg-secondary/95 px-4 py-1.5 backdrop-blur border-b border-border">
        <Flag size={13} className="text-faint" />
        <span className="text-[13px] font-medium text-fg">{title}</span>
        {progress && (
          <>
            <span className="text-[12px] text-faint">
              {progress.done}/{progress.total}
            </span>
            <div className="h-1 w-20 overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </>
        )}
        <div className="flex-1" />
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 hover:text-[var(--priority-urgent)] group-hover:opacity-100"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {issues.length === 0 ? (
        <div className="px-4 py-2 text-[12px] text-faint">No issues</div>
      ) : (
        issues.map((i) => <IssueRow key={i.id} issue={i} />)
      )}
    </div>
  )
}

export function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useStore()
  const project = data.projects.find((p) => p.id === id)
  const [tab, setTab] = useState<'issues' | 'updates'>('issues')

  const latestUpdate = useMemo(
    () =>
      data.projectUpdates
        .filter((u) => u.projectId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [data.projectUpdates, id],
  )

  const milestones = useMemo(
    () =>
      data.milestones
        .filter((m) => m.projectId === id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [data.milestones, id],
  )

  const scoped = useMemo(() => {
    if (!project) return []
    return sortIssues(
      data.issues.filter((i) => i.projectId === project.id),
      'priority',
      data,
    )
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
  const noMilestone = scoped.filter((i) => !i.milestoneId)

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
        <div className="flex-1" />
        <StarButton type="project" id={project.id} />
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
              {latestUpdate && <HealthBadge health={latestUpdate.health} />}
              <button
                onClick={() => {
                  const name = prompt('New milestone name…')
                  if (name?.trim()) data.createMilestone(project.id, name.trim())
                }}
                className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-muted hover:bg-bg-hover"
              >
                <Plus size={12} /> Milestone
              </button>
            </div>
            <div className="mt-2 h-1.5 w-64 overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${prog.percent}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1">
          {(['issues', 'updates'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] capitalize text-muted hover:bg-bg-hover',
                tab === t && 'bg-bg-selected text-fg font-medium',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'updates' ? (
        <div className="flex-1 overflow-y-auto">
          <ProjectUpdates projectId={project.id} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {milestones.map((m) => (
            <Section
              key={m.id}
              title={m.name}
              issues={scoped.filter((i) => i.milestoneId === m.id)}
              progress={milestoneProgress(m.id, data.issues, data)}
              onDelete={() => {
                if (confirm(`Delete milestone "${m.name}"?`)) data.deleteMilestone(m.id)
              }}
            />
          ))}
          <Section title="No milestone" issues={noMilestone} />
        </div>
      )}
    </div>
  )
}
