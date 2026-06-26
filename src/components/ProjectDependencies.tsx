import { Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { SelectMenu } from './ui/SelectMenu'
import type { SelectOption } from './ui/SelectMenu'
import { ProjectStatusIcon } from './ProjectStatusIcon'

/**
 * Linear's project **Dependencies** section on the Overview — the projects this
 * one is *blocked by* (stored on `Project.dependsOn`) and, derived from the same
 * data, the projects it is *blocking*. Add via a project picker, remove inline.
 */
export function ProjectDependencies({ projectId }: { projectId: string }) {
  const projects = useStore((s) => s.projects)
  const addDep = useStore((s) => s.addProjectDependency)
  const removeDep = useStore((s) => s.removeProjectDependency)
  const navigate = useNavigate()

  const project = projects.find((p) => p.id === projectId)
  if (!project) return null

  const blockedBy = (project.dependsOn ?? [])
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  // Inverse: projects that list this one in their dependsOn are "blocking"-ed by it.
  const blocking = projects.filter((p) => (p.dependsOn ?? []).includes(projectId))

  // Candidates to add as a blocker: not self, not already a blocker, and not a
  // project this one already blocks (the store cycle-guard would reject those).
  const blockingIds = new Set(blocking.map((p) => p.id))
  const candidates: SelectOption[] = projects
    .filter(
      (p) =>
        p.id !== projectId &&
        !(project.dependsOn ?? []).includes(p.id) &&
        !blockingIds.has(p.id),
    )
    .map((p) => ({
      id: p.id,
      label: p.name,
      icon: <ProjectStatusIcon status={p.status} size={14} />,
    }))

  function Row({
    pid,
    onRemove,
    removeTitle,
  }: {
    pid: string
    onRemove: () => void
    removeTitle: string
  }) {
    const p = projects.find((x) => x.id === pid)
    if (!p) return null
    return (
      <div className="group flex items-center gap-2.5 px-3 py-2 hover:bg-bg-hover">
        <button
          type="button"
          onClick={() => navigate(`/project/${p.id}`)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <ProjectStatusIcon status={p.status} size={16} />
          <span className="truncate text-[13px] font-medium text-fg">{p.name}</span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          title={removeTitle}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-selected hover:text-fg group-hover:opacity-100"
        >
          <X size={15} />
        </button>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[13px] font-medium text-fg">Dependencies</span>
        <SelectMenu
          options={candidates}
          onSelect={(id) => addDep(projectId, id)}
          placeholder="Add a blocking project…"
          align="end"
          trigger={
            <span
              title="Add dependency"
              className="flex h-5 w-5 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
            >
              <Plus size={14} />
            </span>
          }
        />
      </div>

      {blockedBy.length === 0 && blocking.length === 0 ? (
        <p className="text-[13px] text-faint">
          Add projects that must ship before this one can.
        </p>
      ) : (
        <div className="space-y-3">
          {blockedBy.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                Blocked by
              </div>
              <div className="divide-y divide-border rounded-md border border-border">
                {blockedBy.map((p) => (
                  <Row
                    key={p.id}
                    pid={p.id}
                    onRemove={() => removeDep(projectId, p.id)}
                    removeTitle="Remove dependency"
                  />
                ))}
              </div>
            </div>
          )}
          {blocking.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                Blocking
              </div>
              <div className="divide-y divide-border rounded-md border border-border">
                {blocking.map((p) => (
                  <Row
                    key={p.id}
                    pid={p.id}
                    onRemove={() => removeDep(p.id, projectId)}
                    removeTitle="Remove dependency"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
