import { Archive, ArchiveRestore } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn, nowIso } from '@/lib/utils'
import { toast } from '@/lib/toast'

// Archive/unarchive a project (Linear). Archived projects drop out of the
// active projects list and can be restored. Uses the existing updateProject
// action — archive sets `archivedAt`, restore clears it.
export function ProjectArchiveButton({ projectId }: { projectId: string }) {
  const projects = useStore((s) => s.projects)
  const updateProject = useStore((s) => s.updateProject)

  const project = projects.find((p) => p.id === projectId)
  if (!project) return null

  const archived = Boolean(project.archivedAt)

  return (
    <button
      type="button"
      title={archived ? 'Restore project' : 'Archive project'}
      onClick={() => {
        if (archived) {
          updateProject(projectId, { archivedAt: undefined })
          toast('Project restored')
        } else {
          updateProject(projectId, { archivedAt: nowIso() })
          toast('Project archived')
        }
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px]',
        'text-muted hover:bg-bg-hover hover:text-fg',
      )}
    >
      {archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
      {archived ? 'Restore project' : 'Archive'}
    </button>
  )
}
