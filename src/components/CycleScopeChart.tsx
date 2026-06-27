import { useStore } from '@/lib/store'
import type { Issue } from '@/lib/types'

/** Linear-style "Scope" segmented bar — a cycle's issue mix by workflow-state type. */
export function CycleScopeChart({ issues }: { issues: Issue[] }) {
  const states = useStore((s) => s.states)
  if (issues.length === 0) return null

  // Bucket each issue by the type of its state.
  let completed = 0
  let started = 0
  let remaining = 0 // unstarted + backlog
  let canceled = 0
  for (const issue of issues) {
    const type = states.find((x) => x.id === issue.stateId)?.type
    if (type === 'completed') completed++
    else if (type === 'started') started++
    else if (type === 'canceled') canceled++
    else remaining++ // unstarted | backlog | unknown
  }

  const total = issues.length
  const segments = [
    { key: 'completed', label: 'Completed', count: completed, color: 'var(--status-review)' },
    { key: 'started', label: 'In Progress', count: started, color: 'var(--status-started)' },
    { key: 'remaining', label: 'Scope', count: remaining, color: 'var(--border)' },
    { key: 'canceled', label: 'Canceled', count: canceled, color: 'var(--priority-urgent)' },
  ]

  return (
    <div className="flex flex-col gap-1.5">
      {/* header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-faint">Scope</span>
        <span className="text-[11px] tabular-nums text-faint">
          {completed}/{total}
        </span>
      </div>
      {/* segmented bar */}
      <div className="flex h-2 overflow-hidden rounded-full">
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.key}
              style={{ flexGrow: s.count, background: s.color }}
            />
          ))}
      </div>
      {/* legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
              <span className="tabular-nums text-faint">{s.count}</span>
            </span>
          ))}
      </div>
    </div>
  )
}
