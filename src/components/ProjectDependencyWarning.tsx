import { AlertTriangle } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Project } from '@/lib/types'

/**
 * Inline "blocked dependency" chip for a project card. A project is *blocked*
 * when any project in its `dependsOn[]` hasn't yet reached a completed/canceled
 * status — those blockers must ship first. Mirrors {@link SubIssueBlockedIndicator}'s
 * derivation + amber affordance (`--status-started`): a small AlertTriangle +
 * "Blocked by N projects", with a tooltip listing the open blockers by name.
 * Renders nothing when nothing is blocking, matching Linear's quiet-by-default UI.
 */
export function ProjectDependencyWarning({ project }: { project: Project }) {
  const projects = useStore((s) => s.projects)

  // Open blockers: the projects this one depends on that are still in flight
  // (not completed/canceled). A completed/canceled blocker no longer blocks.
  const open = (project.dependsOn ?? [])
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => !!p)
    .filter((p) => p.status !== 'completed' && p.status !== 'canceled')

  if (open.length === 0) return null

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium"
      style={{ color: 'var(--status-started)' }}
      title={`Blocked by:\n${open.map((p) => p.name).join('\n')}`}
    >
      <AlertTriangle size={12} />
      Blocked by {open.length} {open.length === 1 ? 'project' : 'projects'}
    </span>
  )
}
