import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Cycle, Issue, WorkflowState } from '@/lib/types'

/**
 * Linear-style previous-cycle comparison — this cycle's Completed / Scope /
 * Completion% vs the same team's preceding cycle (number − 1), each with an
 * up/down delta (green = improvement, orange = regression, dash = no change).
 * Renders nothing when there's no previous cycle to compare against.
 */
export function CycleDeltaMetrics({ cycleId }: { cycleId: string }) {
  const cycles = useStore((s) => s.cycles)
  const issues = useStore((s) => s.issues)
  const states = useStore((s) => s.states)

  const current = cycles.find((c) => c.id === cycleId)
  if (!current) return null

  // Previous cycle = same team, one number lower. No previous → nothing to show.
  const previous =
    cycles.find(
      (c) => c.teamId === current.teamId && c.number === current.number - 1,
    ) ?? null
  if (!previous) return null

  const cur = cycleStats(current, issues, states)
  const prev = cycleStats(previous, issues, states)

  const metrics = [
    { key: 'completed', label: 'Completed', value: cur.completed, delta: cur.completed - prev.completed },
    { key: 'scope', label: 'Scope', value: cur.scope, delta: cur.scope - prev.scope },
    {
      key: 'completion',
      label: 'Completion',
      value: `${cur.percent}%`,
      delta: cur.percent - prev.percent,
      suffix: '%',
    },
  ]

  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {metrics.map((m) => (
        <div
          key={m.key}
          className="flex flex-col gap-1 rounded-lg border border-border bg-bg px-3 py-2"
        >
          <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
            {m.label}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tabular-nums text-fg">
              {m.value}
            </span>
            <Delta value={m.delta} suffix={m.suffix} />
          </div>
          <span className="text-[11px] text-faint">vs Cycle {previous.number}</span>
        </div>
      ))}
    </div>
  )
}

/** A signed delta chip: up = green improvement, down = orange regression, 0 = neutral dash. */
function Delta({ value, suffix }: { value: number; suffix?: string }) {
  if (value === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[11px] tabular-nums text-faint">
        <Minus size={12} />0
      </span>
    )
  }
  const up = value > 0
  const color = up ? 'var(--c-green)' : 'var(--c-orange)'
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span
      className="flex items-center gap-0.5 text-[11px] font-medium tabular-nums"
      style={{ color }}
    >
      <Icon size={12} />
      {up ? '+' : ''}
      {value}
      {suffix}
    </span>
  )
}

/** Scope (non-archived issues in the cycle) + completed count + completion %. */
function cycleStats(cycle: Cycle, issues: Issue[], states: WorkflowState[]) {
  const completedStateIds = new Set(
    states.filter((s) => s.type === 'completed').map((s) => s.id),
  )
  let scope = 0
  let completed = 0
  for (const i of issues) {
    if (i.cycleId !== cycle.id || i.archivedAt) continue
    scope++
    if (completedStateIds.has(i.stateId)) completed++
  }
  return {
    scope,
    completed,
    percent: scope ? Math.round((completed / scope) * 100) : 0,
  }
}
