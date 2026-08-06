import { Trash2 } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, DraftsIllustration } from '@/components/EmptyState'
import { StatusIcon } from '@/components/StatusIcon'
import { PriorityIcon } from '@/components/PriorityIcon'
import { LabelDot } from '@/components/LabelChip'
import { Avatar } from '@/components/Avatar'
import { timeAgo } from '@/lib/utils'

/**
 * Linear's Drafts screen: every unsent New-issue draft, newest first. Clicking a
 * row re-opens the create modal seeded with it; creating the issue (or clearing
 * the form) removes the draft.
 */
export function DraftsView() {
  const { drafts, teams, states, users, labels, projects } = useStoreShallow((s) => ({
    drafts: s.drafts,
    teams: s.teams,
    states: s.states,
    users: s.users,
    labels: s.labels,
    projects: s.projects,
  }))
  const openCreateWith = useStore((s) => s.openCreateWith)
  const deleteDraft = useStore((s) => s.deleteDraft)

  const sorted = [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Drafts" />

      {sorted.length === 0 ? (
        <EmptyState illustration={<DraftsIllustration />} title="No active drafts" />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {sorted.map((d) => {
            const team = teams.find((t) => t.id === d.teamId)
            const state = states.find((s) => s.id === d.statusId)
            const assignee = users.find((u) => u.id === d.assigneeId)
            const project = projects.find((p) => p.id === d.projectId)
            const draftLabels = labels.filter((l) => d.labelIds.includes(l.id))
            return (
              <div
                key={d.id}
                className="group flex items-center gap-2 border-b border-border px-4 py-2 hover:bg-bg-hover"
              >
                <button
                  type="button"
                  onClick={() =>
                    openCreateWith({
                      draftId: d.id,
                      title: d.title,
                      description: d.description,
                      teamId: d.teamId,
                      stateId: d.statusId,
                      priority: d.priority,
                      assigneeId: d.assigneeId,
                      labelIds: d.labelIds,
                      projectId: d.projectId,
                    })
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {d.priority !== undefined && <PriorityIcon priority={d.priority} />}
                  {state && <StatusIcon type={state.type} color={state.color} />}
                  {team && <span className="text-[12px] text-faint">{team.key}</span>}
                  <span className="truncate text-[13px] text-fg">
                    {d.title.trim() || <span className="text-faint">Untitled</span>}
                  </span>
                  {project && (
                    <span className="shrink-0 text-[12px] text-muted">
                      {project.icon} {project.name}
                    </span>
                  )}
                  <span className="flex shrink-0 items-center gap-1">
                    {draftLabels.map((l) => (
                      <LabelDot key={l.id} color={l.color} />
                    ))}
                  </span>
                </button>
                <span className="shrink-0 text-[12px] text-faint">
                  {timeAgo(d.updatedAt)}
                </span>
                {assignee && <Avatar user={assignee} size={20} />}
                <button
                  type="button"
                  title="Discard draft"
                  onClick={() => deleteDraft(d.id)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-tertiary hover:text-fg group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
