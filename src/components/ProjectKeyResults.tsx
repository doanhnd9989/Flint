import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { ProjectKeyResult } from '@/lib/types'

/** Clamp a key result's progress to 0–100% (guards target ≤ 0). */
function progressPct(kr: ProjectKeyResult): number {
  if (kr.target <= 0) return 0
  return Math.min(100, Math.round((kr.current / kr.target) * 100))
}

/**
 * Linear's project "Key results" section on the Overview — a list of measurable
 * success metrics, each tracking current → target with a thin progress bar.
 * Inline-edit the current value, ✕-delete on hover, and add new ones via a tiny
 * inline form. Persists on `Project.keyResults` through the dedicated store
 * actions (addKeyResult / updateKeyResult / deleteKeyResult).
 */
export function ProjectKeyResults({ projectId }: { projectId: string }) {
  const projects = useStore((s) => s.projects)
  const addKeyResult = useStore((s) => s.addKeyResult)
  const updateKeyResult = useStore((s) => s.updateKeyResult)
  const deleteKeyResult = useStore((s) => s.deleteKeyResult)

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [unit, setUnit] = useState('')

  const project = projects.find((p) => p.id === projectId)
  if (!project) return null

  const keyResults = project.keyResults ?? []

  function openForm() {
    setAdding(true)
    setName('')
    setTarget('')
    setUnit('')
  }

  function closeForm() {
    setAdding(false)
    setName('')
    setTarget('')
    setUnit('')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const targetNum = Number(target)
    // Require a name and a positive, finite target before adding.
    if (!trimmedName || !Number.isFinite(targetNum) || targetNum <= 0) return
    addKeyResult(projectId, trimmedName, targetNum, unit.trim() || undefined)
    closeForm()
  }

  // Commit an inline edit of `current`, ignoring non-numeric input.
  function setCurrent(krId: string, raw: string) {
    const num = Number(raw)
    if (!Number.isFinite(num)) return
    updateKeyResult(projectId, krId, { current: num })
  }

  return (
    <div className="mt-8">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[13px] font-medium text-fg">Key results</span>
        <button
          type="button"
          onClick={openForm}
          title="Add key result"
          className="flex h-5 w-5 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
        >
          <Plus size={14} />
        </button>
      </div>

      {keyResults.length > 0 && (
        <div className="mb-1 divide-y divide-border rounded-md border border-border">
          {keyResults.map((kr) => {
            const pct = progressPct(kr)
            return (
              <div
                key={kr.id}
                className="group flex items-center gap-3 px-3 py-2 hover:bg-bg-hover"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-fg">
                      {kr.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-1 text-[12px] text-muted tabular-nums">
                      {/* Inline-editable current value. */}
                      <input
                        type="number"
                        defaultValue={kr.current}
                        onBlur={(e) => setCurrent(kr.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                        }}
                        className="w-12 rounded bg-transparent text-right text-fg outline-none focus:bg-bg-secondary"
                      />
                      <span className="text-faint">/</span>
                      <span>{kr.target}</span>
                      {kr.unit && <span className="text-faint">{kr.unit}</span>}
                    </div>
                  </div>
                  {/* Thin progress bar. */}
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-secondary">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteKeyResult(projectId, kr.id)}
                  title="Delete key result"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-selected hover:text-fg group-hover:opacity-100"
                >
                  <X size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {adding ? (
        <form
          onSubmit={submit}
          className="mt-1 space-y-2 rounded-md border border-border bg-bg-secondary p-2.5"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Metric name (e.g. Active users)"
            className="w-full rounded-md bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Target"
              className="w-24 rounded-md bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Unit (optional)"
              className="w-28 rounded-md bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={
                !name.trim() ||
                !Number.isFinite(Number(target)) ||
                Number(target) <= 0
              }
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
        keyResults.length === 0 && (
          <button
            type="button"
            onClick={openForm}
            className="block w-full text-left text-[13px] text-faint hover:text-muted"
          >
            No key results yet.
          </button>
        )
      )}
    </div>
  )
}
