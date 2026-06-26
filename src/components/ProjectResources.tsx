import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { ProjectResource } from '@/lib/types'
import { LinkFavicon, linkHost } from './LinkFavicon'

/** Generate a short, unique id for a new resource link. */
function resourceId(): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${performance.now()}`
  return `pr_${rand.replace(/-/g, '').slice(0, 12)}`
}

/** Ensure a link is navigable: add a protocol if the user omitted one. */
function withProtocol(url: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`
}

/**
 * Linear's project "Resources" section on the Overview — a list of external
 * links (Figma, docs, specs…) with inline add/remove. Mirrors the issue-level
 * Resources affordance (`IssueLinks`) but persists on `Project.resources` via
 * the shallow-merging `updateProject` action.
 */
export function ProjectResources({ projectId }: { projectId: string }) {
  const projects = useStore((s) => s.projects)
  const updateProject = useStore((s) => s.updateProject)

  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')

  const project = projects.find((p) => p.id === projectId)
  if (!project) return null

  const resources = project.resources ?? []

  function setResources(next: ProjectResource[]) {
    updateProject(projectId, { resources: next })
  }

  function openForm() {
    setAdding(true)
    setUrl('')
    setTitle('')
  }

  function closeForm() {
    setAdding(false)
    setUrl('')
    setTitle('')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    const trimmedTitle = title.trim()
    const next: ProjectResource = {
      id: resourceId(),
      url: withProtocol(trimmedUrl),
      ...(trimmedTitle ? { title: trimmedTitle } : {}),
    }
    setResources([...resources, next])
    closeForm()
  }

  function remove(id: string) {
    setResources(resources.filter((r) => r.id !== id))
  }

  return (
    <div className="mt-8">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[13px] font-medium text-fg">Resources</span>
        <button
          type="button"
          onClick={openForm}
          title="Add resource"
          className="flex h-5 w-5 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
        >
          <Plus size={14} />
        </button>
      </div>

      {resources.length > 0 && (
        <div className="mb-1 divide-y divide-border rounded-md border border-border">
          {resources.map((r) => (
            <div
              key={r.id}
              className="group flex items-center gap-2.5 px-3 py-2 hover:bg-bg-hover"
            >
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2.5"
              >
                <LinkFavicon url={r.url} size={16} />
                <span className="truncate text-[13px] font-medium text-fg">
                  {r.title || linkHost(r.url)}
                </span>
                <span className="shrink-0 truncate text-[11px] text-faint">
                  {linkHost(r.url)}
                </span>
              </a>
              <button
                type="button"
                onClick={() => remove(r.id)}
                title="Remove resource"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-selected hover:text-fg group-hover:opacity-100"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <form
          onSubmit={submit}
          className="mt-1 space-y-2 rounded-md border border-border bg-bg-secondary p-2.5"
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste or type a URL…"
            className="w-full rounded-md bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full rounded-md bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!url.trim()}
              className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Add
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-md px-2.5 py-1 text-[12px] font-medium text-muted hover:bg-bg-hover hover:text-fg"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        resources.length === 0 && (
          <button
            type="button"
            onClick={openForm}
            className="block w-full text-left text-[13px] text-faint hover:text-muted"
          >
            Add links to designs, docs, and specs.
          </button>
        )
      )}
    </div>
  )
}
