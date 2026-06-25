import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A project label (organizes & filters projects — distinct from issue labels). */
type ProjectLabel = { id: string; name: string; color: string }

const genId = () => Math.random().toString(36).slice(2, 9)

/** Preset swatches offered in the create form. */
const SWATCHES = ['#eb5757', '#bb87fc', '#4ea7fc', '#4cb782', '#f2c94c', '#95a2b3']

/**
 * Project labels settings page — a faithful reproduction of Linear's
 * "Project labels" surface. The label list is kept in component-local
 * `useState` (session-local only; intentionally separate from the issue-label
 * list that lives in the Zustand store).
 */
export function ProjectLabelsSettings() {
  const [labels, setLabels] = useState<ProjectLabel[]>([
    { id: genId(), name: 'Marketing', color: '#eb5757' },
    { id: genId(), name: 'Design', color: '#bb87fc' },
    { id: genId(), name: 'Engineering', color: '#4ea7fc' },
    { id: genId(), name: 'Growth', color: '#4cb782' },
    { id: genId(), name: 'Research', color: '#f2c94c' },
    { id: genId(), name: 'Infrastructure', color: '#95a2b3' },
  ])
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(SWATCHES[0])

  const filtered = labels.filter((l) =>
    l.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const remove = (id: string) => setLabels((ls) => ls.filter((l) => l.id !== id))

  const create = () => {
    const name = newName.trim()
    if (!name) return
    setLabels((ls) => [{ id: genId(), name, color: newColor }, ...ls])
    setNewName('')
    setNewColor(SWATCHES[0])
    setCreating(false)
  }

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Labels</h1>
      <p className="mt-1 text-[13px] text-muted">
        Labels help you organize and filter projects.
      </p>

      <div className="mt-7 space-y-9">
        <div>
          {/* Header row: filter + new label */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 rounded-md bg-bg-secondary px-2 py-1.5">
              <Search size={13} className="text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter labels…"
                className="w-40 bg-transparent text-[13px] text-fg placeholder:text-faint outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
            >
              <Plus size={14} />
              New label
            </button>
          </div>

          {/* Inline create form */}
          {creating && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-bg-secondary px-4 py-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                placeholder="Label name…"
                className="flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
              />
              <div className="flex items-center gap-1.5">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={cn(
                      'h-4 w-4 rounded-full ring-offset-2 ring-offset-bg-secondary',
                      newColor === c && 'ring-2 ring-fg',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={create}
                className="rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-md bg-bg-tertiary px-2.5 py-1.5 text-[13px] text-fg hover:bg-bg-hover"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Label list */}
          <div className="mt-4 divide-y divide-border rounded-xl border border-border">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-muted">
                No labels match
              </div>
            ) : (
              filtered.map((label) => (
                <div
                  key={label.id}
                  className="group flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="text-[13px] font-medium text-fg">
                      {label.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      className="text-[12px] text-muted hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(label.id)}
                      className="text-[12px] text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
