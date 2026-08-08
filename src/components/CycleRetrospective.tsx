import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/constants'
import type { Priority } from '@/lib/types'
import { Avatar } from '@/components/Avatar'

/**
 * Linear-style end-of-cycle retrospective / summary card — a read-only recap
 * of a COMPLETED (past) cycle. Everything is derived from store data: the
 * non-archived issues whose cycleId matches, their state types, completedAt,
 * assignee and priority.
 *
 * Surfaces: total scope, completed count + %, carried-over (not-completed)
 * count, a completion donut, the top contributors (by completed issues), and
 * a per-priority breakdown. Mounted only for past cycles by CyclesView.
 */
export function CycleRetrospective({ cycleId }: { cycleId: string }) {
  const issues = useStore((s) => s.issues)
  const states = useStore((s) => s.states)
  const users = useStore((s) => s.users)

  const stats = useMemo(() => {
    const completedStateIds = new Set(
      states.filter((s) => s.type === 'completed').map((s) => s.id),
    )
    const canceledStateIds = new Set(
      states.filter((s) => s.type === 'canceled').map((s) => s.id),
    )

    const scoped = issues.filter((i) => i.cycleId === cycleId && !i.archivedAt)

    let completed = 0
    let canceled = 0
    // Completed issues grouped by assignee → top-contributors ranking.
    const byUser = new Map<string, number>()
    // Scope grouped by priority → per-priority breakdown.
    const byPriority = new Map<Priority, number>()

    for (const i of scoped) {
      byPriority.set(i.priority, (byPriority.get(i.priority) ?? 0) + 1)
      if (completedStateIds.has(i.stateId)) {
        completed++
        const key = i.assigneeId ?? '__none__'
        byUser.set(key, (byUser.get(key) ?? 0) + 1)
      } else if (canceledStateIds.has(i.stateId)) {
        canceled++
      }
    }

    const total = scoped.length
    // "Carried" = the work that left the cycle unfinished (not completed and not
    // cancelled) — Linear rolls this into the next cycle.
    const carried = Math.max(0, total - completed - canceled)
    const percent = total ? Math.round((completed / total) * 100) : 0

    const contributors = Array.from(byUser.entries())
      .map(([key, count]) => ({
        user: key === '__none__' ? undefined : users.find((u) => u.id === key),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const priorities = PRIORITY_ORDER.map((p) => ({
      priority: p,
      count: byPriority.get(p) ?? 0,
    })).filter((row) => row.count > 0)

    return { total, completed, canceled, carried, percent, contributors, priorities }
  }, [issues, states, users, cycleId])

  // Nothing to recap for an empty cycle.
  if (stats.total === 0) return null

  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
          Cycle retrospective
        </span>
        <span className="text-[11px] tabular-nums text-faint">
          {stats.completed}/{stats.total} completed
        </span>
      </div>

      {/* Stacked, two-up: this lives in the cycle side panel, so the old
          `sm:grid-cols-4` — a *viewport* breakpoint — squeezed each tile to a
          few pixels wide while the window itself was still wide. */}
      <div className="flex flex-col gap-5">
        {/* Completion donut */}
        <CompletionDonut percent={stats.percent} />

        {/* Headline stat tiles */}
        <div className="grid flex-1 grid-cols-2 gap-2">
          <Tile label="Scope" value={stats.total} />
          <Tile label="Completed" value={stats.completed} />
          <Tile label="Carried over" value={stats.carried} />
          <Tile label="Canceled" value={stats.canceled} />
        </div>
      </div>

      {/* Top contributors */}
      {stats.contributors.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
            Top contributors
          </div>
          <div className="flex flex-col gap-1.5">
            {stats.contributors.map((c, n) => (
              <div
                key={c.user?.id ?? `none-${n}`}
                className="flex items-center gap-2"
              >
                <Avatar user={c.user} size={18} />
                <span className="truncate text-[12px] text-fg">
                  {c.user?.name ?? 'No assignee'}
                </span>
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-faint">
                  {c.count} completed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown by priority */}
      {stats.priorities.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
            By priority
          </div>
          <div className="flex flex-col gap-1.5">
            {stats.priorities.map((row) => (
              <div key={row.priority} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-[12px] text-fg">
                  {PRIORITY_LABELS[row.priority]}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${(row.count / stats.total) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-faint">
                  {row.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** A single headline stat tile. */
function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-bg-secondary px-3 py-2">
      <span className="text-[16px] font-semibold tabular-nums text-fg">{value}</span>
      <span className="text-[11px] text-faint">{label}</span>
    </div>
  )
}

/** Linear-style completion donut — a single accent arc over a track ring. */
function CompletionDonut({ percent }: { percent: number }) {
  const size = 84
  const stroke = 9
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (percent / 100) * circ

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-tertiary)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[18px] font-semibold tabular-nums text-fg">
          {percent}%
        </span>
        <span className="text-[10px] text-faint">done</span>
      </div>
    </div>
  )
}
