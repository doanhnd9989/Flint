import { AlertTriangle, Plus, X } from 'lucide-react'
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

  // Self-contained dependency-graph helpers (no store changes). Edges point from
  // a project to the projects it is blocked by (`dependsOn`).
  const byId = new Map(projects.map((p) => [p.id, p]))
  // Does walking `dependsOn` from `from` ever reach `target`?
  const reaches = (from: string, target: string): boolean => {
    const seen = new Set<string>()
    const stack = [from]
    while (stack.length) {
      const cur = stack.pop()!
      if (cur === target) return true
      if (seen.has(cur)) continue
      seen.add(cur)
      stack.push(...(byId.get(cur)?.dependsOn ?? []))
    }
    return false
  }

  // Candidates to add as a blocker: not self, not already a blocker, and any
  // project whose addition would introduce a cycle — i.e. a *transitive*
  // descendant that can already reach this one through the dependency graph
  // (matches the store cycle-guard, but walking the whole graph, not just
  // direct links). Adding `p` makes this project depend on `p`; if `p` already
  // reaches this project, the edge would close a loop.
  const candidates: SelectOption[] = projects
    .filter(
      (p) =>
        p.id !== projectId &&
        !(project.dependsOn ?? []).includes(p.id) &&
        !reaches(p.id, projectId),
    )
    .map((p) => ({
      id: p.id,
      label: p.name,
      icon: <ProjectStatusIcon status={p.status} size={14} />,
    }))

  // Detect whether the *existing* edges already form a cycle anywhere in the
  // connected dependency graph (e.g. from data imported outside the guard). A
  // node is part of a cycle when it can reach itself by following `dependsOn`.
  const hasCycle = (() => {
    const nodes = new Set<string>([projectId])
    const queue = [projectId]
    while (queue.length) {
      const cur = queue.pop()!
      for (const next of byId.get(cur)?.dependsOn ?? []) {
        if (!nodes.has(next)) {
          nodes.add(next)
          queue.push(next)
        }
      }
      // also follow inverse edges so the whole connected component is checked
      for (const p of projects) {
        if ((p.dependsOn ?? []).includes(cur) && !nodes.has(p.id)) {
          nodes.add(p.id)
          queue.push(p.id)
        }
      }
    }
    for (const id of nodes) if (reaches(id, id)) return true
    return false
  })()

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
        {hasCycle && (
          <span
            title="Circular dependency detected"
            className="flex items-center text-[var(--priority-urgent)]"
          >
            <AlertTriangle size={14} />
          </span>
        )}
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
