import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cycleProgress, cycleState } from '@/lib/selectors'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, CycleIllustration } from '@/components/EmptyState'
import { Avatar } from '@/components/Avatar'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Cycle, Issue, Team, User } from '@/lib/types'
import type { WorkspaceData } from '@/lib/seed'

// Workspace-level "Cycles" overview (Linear's cross-team cycles page): one card
// per cycle-enabled team showing its current ACTIVE cycle — date range, a
// stacked progress bar with scope/started/completed stats — plus a compact row
// for the team's next UPCOMING cycle. Clicking a card jumps to that team's
// per-team Cycles screen. A header team-filter narrows to a single team and a
// scope toggle flips between "Active & upcoming" and "Past" (finished cycles,
// most recent first, with their final progress).

type Scope = 'active' | 'past'

export function ActiveCyclesView() {
  const data = useStore()
  const navigate = useNavigate()
  const nowMs = Date.now()

  // Local-only header controls: a team filter and an active/past scope toggle.
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [scope, setScope] = useState<Scope>('active')

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

  // Past cycles across all teams, paired with their team, most recent first.
  const pastRows = useMemo(() => {
    const teamById = new Map<string, Team>()
    for (const t of data.teams) teamById.set(t.id, t)
    return data.cycles
      .filter(
        (c) =>
          cycleState(c.startsAt, c.endsAt, nowMs).status === 'past' &&
          teamById.get(c.teamId)?.cyclesEnabled !== false,
      )
      .map((c) => ({ cycle: c, team: teamById.get(c.teamId) }))
      .filter((r): r is { cycle: Cycle; team: Team } => !!r.team)
      .sort((a, b) =>
        (b.cycle.endsAt ?? '').localeCompare(a.cycle.endsAt ?? ''),
      )
  }, [data.teams, data.cycles, nowMs])

  // Teams that actually have at least one cycle — the only ones worth offering
  // in the team filter.
  const teamsWithCycles = useMemo(
    () => rows.filter((r) => r.cycles.length > 0).map((r) => r.team),
    [rows],
  )

  const hasAnyCycle = teamsWithCycles.length > 0

  // Apply the team filter to whichever scope is active.
  const visibleRows =
    teamFilter === 'all'
      ? rows.filter((r) => r.cycles.length > 0)
      : rows.filter((r) => r.team.id === teamFilter && r.cycles.length > 0)
  const visiblePast =
    teamFilter === 'all'
      ? pastRows
      : pastRows.filter((r) => r.team.id === teamFilter)

  // Team filter options: "All teams" + every team that has cycles.
  const teamOptions = useMemo<SelectOption[]>(
    () => [
      { id: 'all', label: 'All teams', selected: teamFilter === 'all' },
      ...teamsWithCycles.map((t) => ({
        id: t.id,
        label: t.name,
        icon: t.icon ? <span>{t.icon}</span> : undefined,
        selected: teamFilter === t.id,
      })),
    ],
    [teamsWithCycles, teamFilter],
  )

  // Label for the team-filter trigger chip.
  const teamFilterLabel =
    teamFilter === 'all'
      ? 'All teams'
      : (teamsWithCycles.find((t) => t.id === teamFilter)?.name ?? 'All teams')

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Cycles">
        {/* Header controls — scope toggle + team picker, both local-only.
            Hidden when there are no cycles to show at all. */}
        {hasAnyCycle && (
          <div className="ml-auto flex items-center gap-2">
            {/* Scope segmented toggle: Active & upcoming · Past. */}
            <div className="flex items-center rounded-md border border-border bg-bg-tertiary p-0.5 text-[12px]">
              <button
                type="button"
                onClick={() => setScope('active')}
                className={cn(
                  'rounded px-2 py-0.5 transition-colors',
                  scope === 'active'
                    ? 'bg-bg-selected text-fg'
                    : 'text-muted hover:text-fg',
                )}
              >
                Active &amp; upcoming
              </button>
              <button
                type="button"
                onClick={() => setScope('past')}
                className={cn(
                  'rounded px-2 py-0.5 transition-colors',
                  scope === 'past'
                    ? 'bg-bg-selected text-fg'
                    : 'text-muted hover:text-fg',
                )}
              >
                Past
              </button>
            </div>
            <SelectMenu
              width={200}
              align="end"
              options={teamOptions}
              onSelect={setTeamFilter}
              placeholder="Filter by team…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <span className="max-w-[120px] truncate">{teamFilterLabel}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
          </div>
        )}
      </ViewHeader>

      {!hasAnyCycle ? (
        <EmptyState
          illustration={<CycleIllustration />}
          title="No cycles yet"
          description="Cycles are time-boxed sprints. Enable them on a team to plan work in regular intervals."
        />
      ) : (
        <div className="flex-1 overflow-y-auto bg-bg-secondary">
          <div className="mx-auto max-w-3xl space-y-3 px-6 py-6">
            {scope === 'active' ? (
              visibleRows.length === 0 ? (
                <EmptyState
                  illustration={<CycleIllustration />}
                  title="No cycles"
                  description="No cycles match the selected team."
                />
              ) : (
                visibleRows.map(({ team, cycles, active, upcoming }) => (
                  <TeamCycleCard
                    key={team.id}
                    team={team}
                    cycles={cycles}
                    active={active}
                    upcoming={upcoming}
                    nowMs={nowMs}
                    issues={data.issues}
                    data={data}
                    onOpen={() => navigate(`/team/${team.key}/cycles`)}
                  />
                ))
              )
            ) : visiblePast.length === 0 ? (
              <EmptyState
                illustration={<CycleIllustration />}
                title="No past cycles"
                description="Cycles that have ended will show up here with their final progress."
              />
            ) : (
              visiblePast.map(({ cycle, team }) => (
                <PastCycleCard
                  key={cycle.id}
                  team={team}
                  cycle={cycle}
                  issues={data.issues}
                  data={data}
                  onOpen={() => navigate(`/team/${team.key}/cycles`)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// One member's slice of a cycle's scope: how many issues they own and how many
// of those are completed. `user` is undefined for the "Unassigned" bucket.
interface AssigneeSlice {
  user?: User
  total: number
  done: number
}

// "Scope by assignee" breakdown for a cycle — the per-member rows Linear shows
// when you expand a cycle. Buckets issues by assignee (with an Unassigned
// bucket), counts completed via the workspace's completed states, and sorts by
// scope descending so the biggest owners surface first.
function assigneeBreakdown(
  cycleId: string,
  issues: Issue[],
  data: WorkspaceData,
): AssigneeSlice[] {
  const completed = new Set(
    data.states.filter((s) => s.type === 'completed').map((s) => s.id),
  )
  const userById = new Map(data.users.map((u) => [u.id, u]))
  const buckets = new Map<string, AssigneeSlice>()
  for (const i of issues) {
    if (i.cycleId !== cycleId || i.archivedAt) continue
    const key = i.assigneeId ?? '__none__'
    let slice = buckets.get(key)
    if (!slice) {
      slice = { user: i.assigneeId ? userById.get(i.assigneeId) : undefined, total: 0, done: 0 }
      buckets.set(key, slice)
    }
    slice.total++
    if (completed.has(i.stateId)) slice.done++
  }
  return [...buckets.values()].sort(
    (a, b) => b.total - a.total || b.done - a.done,
  )
}

function TeamCycleCard({
  team,
  cycles,
  active,
  upcoming,
  nowMs,
  issues,
  data,
  onOpen,
}: {
  team: Team
  cycles: Cycle[]
  active?: Cycle
  upcoming?: Cycle
  nowMs: number
  issues: Issue[]
  data: WorkspaceData
  onOpen: () => void
}) {
  // Expandable "Scope by assignee" disclosure (collapsed by default).
  const [showBreakdown, setShowBreakdown] = useState(false)
  const prog = active ? cycleProgress(active.id, issues, data) : null
  const cs = active ? cycleState(active.startsAt, active.endsAt, nowMs) : null
  const remaining = prog ? Math.max(0, prog.total - prog.done - prog.started) : 0
  const slices = useMemo(
    () => (active ? assigneeBreakdown(active.id, issues, data) : []),
    [active, issues, data],
  )

  // Cycle velocity — Linear's rolling average of completed scope across this
  // team's recent finished cycles. Uses up to the last 6 past cycles so the
  // figure reflects current pace rather than ancient history. We also keep the
  // per-cycle completed-scope series (oldest → newest) to drive a sparkline.
  const velocity = useMemo(() => {
    const recent = cycles
      .filter(
        (c) => cycleState(c.startsAt, c.endsAt, nowMs).status === 'past',
      )
      .sort((a, b) => (b.endsAt ?? '').localeCompare(a.endsAt ?? ''))
      .slice(0, 6)
    if (recent.length === 0) return null
    // Series in chronological order so the most recent cycle is the last bar.
    const series = [...recent]
      .reverse()
      .map((c) => cycleProgress(c.id, issues, data).done)
    const totalDone = series.reduce((sum, n) => sum + n, 0)
    return {
      avg: Math.round((totalDone / series.length) * 10) / 10,
      count: series.length,
      series,
    }
  }, [cycles, issues, data, nowMs])

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

            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-faint">
              <span>
                {prog.total} {prog.total === 1 ? 'issue' : 'issues'} in this cycle
              </span>
              {velocity && (
                <span
                  className="flex items-center gap-1.5 tabular-nums"
                  title={`Average completed scope over the last ${velocity.count} ${velocity.count === 1 ? 'cycle' : 'cycles'}`}
                >
                  <VelocitySparkline series={velocity.series} />
                  Velocity{' '}
                  <span className="font-medium text-muted">
                    {velocity.avg}
                  </span>{' '}
                  issues/cycle
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="mt-2 text-[12px] text-muted">No active cycle</div>
        )}
      </button>

      {/* Scope-by-assignee disclosure — Linear's per-member cycle breakdown.
          Lives outside the card-body button (no nested interactives). */}
      {active && prog && prog.total > 0 && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="flex w-full items-center gap-1 px-5 py-2 text-left text-[11px] font-medium text-muted transition-colors hover:bg-bg-hover hover:text-fg"
            aria-expanded={showBreakdown}
          >
            {showBreakdown ? (
              <ChevronDown size={13} className="shrink-0 text-faint" />
            ) : (
              <ChevronRight size={13} className="shrink-0 text-faint" />
            )}
            Scope by assignee
            <span className="text-faint">· {slices.length}</span>
          </button>

          {showBreakdown && (
            <div className="space-y-2 px-5 pb-3 pt-0.5">
              {slices.map((s, idx) => {
                const pct = s.total ? Math.round((s.done / s.total) * 100) : 0
                return (
                  <div
                    key={s.user?.id ?? `none-${idx}`}
                    className="flex items-center gap-2.5"
                  >
                    <Avatar user={s.user} size={18} />
                    <span className="w-28 shrink-0 truncate text-[12px] text-fg">
                      {s.user?.name ?? 'Unassigned'}
                    </span>
                    <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${pct}%` }}
                        title={`${s.done} of ${s.total} completed`}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-faint">
                      {s.done}/{s.total} · {pct}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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

// A finished cycle (Past scope): same progress-card layout as the active card
// but tagged "Completed" and showing the cycle's final scope/started/done.
function PastCycleCard({
  team,
  cycle,
  issues,
  data,
  onOpen,
}: {
  team: Team
  cycle: Cycle
  issues: Issue[]
  data: WorkspaceData
  onOpen: () => void
}) {
  const prog = cycleProgress(cycle.id, issues, data)
  const remaining = Math.max(0, prog.total - prog.done - prog.started)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg">
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full px-5 py-4 text-left transition-colors hover:bg-bg-hover"
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px]">{team.icon}</span>
          <span className="text-[13px] font-semibold text-fg">{team.name}</span>
          <span className="text-faint">›</span>
          <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-[11px] font-medium text-faint">
            Completed
          </span>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-3">
          <div>
            <div className="text-[14px] font-medium text-fg">
              Cycle {cycle.number}
              {cycle.name && <span className="text-muted"> · {cycle.name}</span>}
            </div>
            <div className="mt-0.5 text-[12px] text-faint">
              {formatDate(cycle.startsAt)} – {formatDate(cycle.endsAt)}
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
      </button>
    </div>
  )
}

// Tiny inline bar sparkline of completed scope across recent finished cycles
// (oldest → newest). Heights are proportional to the largest bar; the final,
// most-recent cycle is highlighted with the accent token, the rest are muted.
// ~60×16px, no axes — purely a glanceable trend next to the velocity figure.
function VelocitySparkline({ series }: { series: number[] }) {
  const w = 60
  const h = 16
  const max = Math.max(1, ...series)
  const gap = 2
  const barW = (w - gap * (series.length - 1)) / series.length
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0"
      aria-hidden="true"
    >
      {series.map((v, i) => {
        // Floor a 2px minimum so even zero-completed cycles read as a tick.
        const barH = Math.max(2, (v / max) * h)
        const isLast = i === series.length - 1
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={h - barH}
            width={barW}
            height={barH}
            rx={1}
            className={isLast ? 'fill-accent' : 'fill-faint/40'}
          />
        )
      })}
    </svg>
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
