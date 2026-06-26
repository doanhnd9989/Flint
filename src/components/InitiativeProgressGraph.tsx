import { useStore } from '@/lib/store'
import { initiativeProgress, projectProgress } from '@/lib/selectors'

/**
 * Per-project progress breakdown for an initiative: each rolled-up project is a
 * horizontal bar (tinted with the project's own color) plus a summary roll-up of
 * done/total issues across the whole initiative. Mirrors Linear's initiative
 * progress visualization.
 */
export function InitiativeProgressGraph({ initiativeId }: { initiativeId: string }) {
  const projects = useStore((s) => s.projects)
  const issues = useStore((s) => s.issues)
  const data = useStore()

  const inProjects = projects.filter((p) => p.initiativeId === initiativeId)

  if (inProjects.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-[13px] text-faint">
        No projects in this initiative yet
      </div>
    )
  }

  // Per-project progress, sorted by completion then name.
  const rows = inProjects
    .map((p) => ({ project: p, prog: projectProgress(p.id, issues, data) }))
    .sort(
      (a, b) =>
        b.prog.percent - a.prog.percent ||
        a.project.name.localeCompare(b.project.name),
    )

  const overall = initiativeProgress(initiativeId, projects, issues, data)

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-fg">Progress by project</h3>
        <span className="text-[12px] text-muted">
          {overall.done}/{overall.total} issues
          <span className="ml-1.5 font-medium text-fg">{overall.percent}%</span>
        </span>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        {rows.map(({ project, prog }) => (
          <div key={project.id} className="flex items-center gap-3 text-[12px]">
            <div className="flex w-44 min-w-0 shrink-0 items-center gap-2">
              <span className="text-base leading-none">{project.icon}</span>
              <span className="truncate font-medium text-fg">{project.name}</span>
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${prog.percent}%`,
                  backgroundColor: project.color,
                }}
              />
            </div>
            <span className="w-14 shrink-0 text-right tabular-nums text-faint">
              {prog.done}/{prog.total}
            </span>
            <span className="w-9 shrink-0 text-right tabular-nums font-medium text-fg">
              {prog.percent}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
