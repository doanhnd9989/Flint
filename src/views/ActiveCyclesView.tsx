import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { cycleProgress, cycleState } from '@/lib/selectors'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, CycleIllustration } from '@/components/EmptyState'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Cycle, Issue, Team } from '@/lib/types'
import type { WorkspaceData } from '@/lib/seed'

// Workspace-level "Cycles" overview (Linear's cross-team cycles page): one card
// per cycle-enabled team showing its current ACTIVE cycle — date range, a
// stacked progress bar with scope/started/completed stats — plus a compact row
// for the team's next UPCOMING cycle. Clicking a card jumps to that team's
// per-team Cycles screen.

export function ActiveCyclesView() {
  const data = useStore()
  const navigate = useNavigate()
  const nowMs = Date.now()

  // Teams with cycles enabled, each paired with its active + next upcoming cycle.
  const rows = useMemo(() => {
    return data.teams
      .filter((t) => t.cyclesEnabled !== false)
      .map((team) => {
        const cycles = data.cycles
          .filter((c) => c.teamId === team.id)
          .sort((a, b) => a.number - b.number)
        const active = cycles.find(
          (c) => cycleState(c.startsAt, c.endsAt, nowMs).status === 'active',
        )
        const upcoming = cycles.find(
          (c) => cycleState(c.startsAt, c.endsAt, nowMs).status === 'upcoming',
        )
        return { team, cycles, active, upcoming }
      })
  }, [data.teams, data.cycles, nowMs])

  const hasAnyCycle = rows.some((r) => r.cycles.length > 0)

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Cycles" />

      {!hasAnyCycle ? (
        <EmptyState
          illustration={<CycleIllustration />}
          title="No cycles yet"
          description="Cycles are time-boxed sprints. Enable them on a team to plan work in regular intervals."
        />
      ) : (
        <div className="flex-1 overflow-y-auto bg-bg-secondary">
          <div className="mx-auto max-w-3xl space-y-3 px-6 py-6">
            {rows.map(({ team, active, upcoming }) => (
              <TeamCycleCard
                key={team.id}
                team={team}
                active={active}
                upcoming={upcoming}
                nowMs={nowMs}
                issues={data.issues}
                data={data}
                onOpen={() => navigate(`/team/${team.key}/cycles`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TeamCycleCard({
  team,
  active,
  upcoming,
  nowMs,
  issues,
  data,
  onOpen,
}: {
  team: Team
  active?: Cycle
  upcoming?: Cycle
  nowMs: number
  issues: Issue[]
  data: WorkspaceData
  onOpen: () => void
}) {
  const prog = active ? cycleProgress(active.id, issues, data) : null
  const cs = active ? cycleState(active.startsAt, active.endsAt, nowMs) : null
  const remaining = prog ? Math.max(0, prog.total - prog.done - prog.started) : 0

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg">
      {/* Active cycle — the clickable card body. */}
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full px-5 py-4 text-left transition-colors hover:bg-bg-hover"
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px]">{team.icon}</span>
          <span className="text-[13px] font-semibold text-fg">{team.name}</span>
          <span className="text-faint">›</span>
          {active ? (
            <span className="rounded-full bg-[var(--status-started)]/20 px-2 py-0.5 text-[11px] font-medium text-[var(--status-started)]">
              Active
            </span>
          ) : (
            <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-[11px] font-medium text-faint">
              No active cycle
            </span>
          )}
        </div>

        {active && prog && cs ? (
          <>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <div>
                <div className="text-[14px] font-medium text-fg">
                  Cycle {active.number}
                  {active.name && (
                    <span className="text-muted"> · {active.name}</span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-faint">
                  {formatDate(active.startsAt)} – {formatDate(active.endsAt)}
                  {cs.status === 'active' && ` · ${cs.daysLeft} days left`}
                </div>
              </div>
              <div className="flex items-center gap-4 text-[12px]">
                <Stat label="Scope" value={prog.total} />
                <Stat label="Started" value={prog.started} />
                <Stat label="Done" value={prog.done} />
                <Stat label="Progress" value={`${prog.percent}%`} />
              </div>
            </div>

            {/* Stacked progress bar (completed / started / remaining). */}
            <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full bg-accent"
                style={{
                  width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%`,
                }}
                title={`${prog.done} completed`}
              />
              <div
                className="h-full bg-[var(--status-started)]"
                style={{
                  width: `${prog.total ? (prog.started / prog.total) * 100 : 0}%`,
                }}
                title={`${prog.started} started`}
              />
              <div
                className="h-full"
                style={{
                  width: `${prog.total ? (remaining / prog.total) * 100 : 0}%`,
                }}
              />
            </div>

            <div className="mt-2 text-[11px] text-faint">
              {prog.total} {prog.total === 1 ? 'issue' : 'issues'} in this cycle
            </div>
          </>
        ) : (
          <div className="mt-2 text-[12px] text-muted">No active cycle</div>
        )}
      </button>

      {/* Upcoming cycle — a compact secondary row beneath the card body. */}
      {upcoming && (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            'flex w-full items-center gap-2 border-t border-border px-5 py-2.5 text-left',
            'text-[12px] text-muted transition-colors hover:bg-bg-hover',
          )}
        >
          <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-medium text-accent">
            Upcoming
          </span>
          <span className="text-fg">Cycle {upcoming.number}</span>
          {upcoming.name && <span className="text-muted">· {upcoming.name}</span>}
          <span className="text-faint">
            · {formatDate(upcoming.startsAt)} – {formatDate(upcoming.endsAt)}
          </span>
        </button>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <div className="text-[14px] font-semibold tabular-nums text-fg">{value}</div>
      <div className="text-[11px] text-faint">{label}</div>
    </div>
  )
}
