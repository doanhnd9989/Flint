import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CircleCheck,
  CirclePlay,
  CircleDot,
  MoreHorizontal,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { cycleProgress, cycleState } from '@/lib/selectors'
import type { Cycle } from '@/lib/types'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, CycleIllustration } from '@/components/EmptyState'
import { ProgressDonut } from '@/components/ProgressDonut'
import { CreateCycleButton } from '@/components/CreateCycleButton'
import { CycleContextMenu } from '@/components/CycleContextMenu'
import { CycleTimelineChart } from '@/components/CycleTimelineChart'
import { cn } from '@/lib/utils'

/**
 * Points a member is assumed to carry per week. Linear reads capacity from each
 * member's configured availability; we have no such field, so "% of capacity"
 * is scope measured against this flat per-member budget. Documented rather than
 * hidden — the number is a stand-in, the arithmetic is real.
 */
const POINTS_PER_MEMBER_WEEK = 8

/** Linear's four cycle states. `Planned` is any upcoming cycle past the next. */
type Phase = 'planned' | 'upcoming' | 'current' | 'completed'

const PHASE_LABEL: Record<Phase, string> = {
  planned: 'Planned',
  upcoming: 'Upcoming',
  current: 'Current',
  completed: 'Completed',
}

/**
 * A team's cycles as Linear shows them: one scrolling timeline, newest first,
 * with a date gutter down the left and the current cycle expanded inline into
 * its burn-up. Clicking a row opens that cycle at /team/:key/cycle/:number.
 */
export function CyclesView() {
  const { teamKey } = useParams()
  const navigate = useNavigate()
  const data = useStore()
  const team = data.teams.find((t) => t.key === teamKey) ?? data.teams[0]
  const nowMs = Date.now()

  // Which cycle row has its context menu open, and where it was summoned.
  const [rowMenu, setRowMenu] = useState<{
    id: string
    x: number
    y: number
  } | null>(null)

  const rows = useMemo(() => {
    const mine = data.cycles
      .filter((c) => c.teamId === team.id)
      // Furthest-future first, the way Linear stacks them.
      .sort((a, b) => b.number - a.number)

    // The soonest not-yet-started cycle is "Upcoming"; the rest are "Planned".
    const nextUp = [...mine]
      .reverse()
      .find((c) => cycleState(c.startsAt, c.endsAt, nowMs).status === 'upcoming')

    const memberCount = Math.max(1, data.users.length)

    return mine.map((cycle) => {
      const { status } = cycleState(cycle.startsAt, cycle.endsAt, nowMs)
      const phase: Phase =
        status === 'active'
          ? 'current'
          : status === 'past'
            ? 'completed'
            : cycle.id === nextUp?.id
              ? 'upcoming'
              : 'planned'

      const prog = cycleProgress(cycle.id, data.issues, data)
      const weeks = Math.max(
        1,
        Math.round(
          (new Date(cycle.endsAt).getTime() - new Date(cycle.startsAt).getTime()) /
            (7 * 86_400_000),
        ),
      )
      const capacity = memberCount * weeks * POINTS_PER_MEMBER_WEEK
      const points = data.issues
        .filter((i) => i.cycleId === cycle.id && !i.archivedAt)
        .reduce((sum, i) => sum + (i.estimate ?? 0), 0)

      return {
        cycle,
        phase,
        prog,
        capacityPct: capacity ? Math.round((points / capacity) * 100) : 0,
      }
    })
  }, [data, team.id, nowMs])

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader
          title="Cycles"
          teamName={team.name}
          teamIcon={team.icon}
          right={<CreateCycleButton teamId={team.id} />}
        />
        <EmptyState
          illustration={<CycleIllustration />}
          title="No cycles for this team yet"
          description="Cycles are time-boxed sprints. Enable them to plan work in regular intervals."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Cycles"
        teamName={team.name}
        teamIcon={team.icon}
        right={<CreateCycleButton teamId={team.id} />}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map(({ cycle, phase, prog, capacityPct }, i) => (
          <div key={cycle.id} className="group relative">
            <div className="flex">
              <DateGutter
                cycle={cycle}
                phase={phase}
                first={i === 0}
                last={i === rows.length - 1}
              />

              <button
                type="button"
                onClick={() =>
                  navigate(`/team/${team.key}/cycle/${cycle.number}`)
                }
                onContextMenu={(e) => {
                  e.preventDefault()
                  setRowMenu({ id: cycle.id, x: e.clientX, y: e.clientY })
                }}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-2.5 pl-1 pr-10 text-left hover:bg-bg-hover"
              >
                <PhaseIcon phase={phase} percent={prog.percent} />
                <span className="shrink-0 text-[13px] font-medium text-fg">
                  Cycle {cycle.number}
                </span>
                {(cycle.name || cycle.goal) && (
                  <span className="truncate text-[13px] text-muted">
                    {cycle.name ?? cycle.goal}
                  </span>
                )}

                <div className="ml-auto flex shrink-0 items-center gap-4 text-[12px]">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5',
                      phase === 'current'
                        ? 'bg-accent-subtle text-accent'
                        : 'bg-bg-tertiary text-muted',
                    )}
                  >
                    {PHASE_LABEL[phase]}
                  </span>

                  {phase === 'completed' ? (
                    <Metric
                      percent={prog.percent}
                      value={`${prog.percent}%`}
                      suffix="success"
                    />
                  ) : (
                    <Metric
                      percent={Math.min(100, capacityPct)}
                      value={`${capacityPct}%`}
                      suffix="of capacity"
                      warn={capacityPct > 100}
                    />
                  )}

                  {phase === 'completed' && (
                    <span className="w-24 text-right tabular-nums text-muted">
                      <span className="text-fg">{prog.done}</span> completed
                    </span>
                  )}
                  <span className="w-16 text-right tabular-nums text-muted">
                    <span className="text-fg">{prog.total}</span> scope
                  </span>
                </div>
              </button>

              {/* Linear reveals a ⋯ in the row's trailing gutter on hover; it
                  opens the same menu as right-click. */}
              <button
                type="button"
                aria-label="Open menu"
                onClick={(e) => {
                  e.stopPropagation()
                  const r = e.currentTarget.getBoundingClientRect()
                  setRowMenu({ id: cycle.id, x: r.right - 258, y: r.bottom + 4 })
                }}
                className={cn(
                  'absolute right-3 top-2 flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-tertiary hover:text-fg',
                  rowMenu?.id === cycle.id
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100',
                )}
              >
                <MoreHorizontal size={15} />
              </button>
            </div>

            {/* Linear expands the in-flight cycle into its chart, in place. */}
            {phase === 'current' && (
              <div className="flex">
                <div className="w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <CycleTimelineChart
                    cycle={cycle}
                    issues={data.issues}
                    data={data}
                    nowMs={nowMs}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {rowMenu && (
        <CycleContextMenu
          cycleId={rowMenu.id}
          x={rowMenu.x}
          y={rowMenu.y}
          nowMs={nowMs}
          onClose={() => setRowMenu(null)}
        />
      )}
    </div>
  )
}

/**
 * The date rail: month over day, right-aligned against a vertical line with a
 * node per cycle. The node fills in once the cycle has started, so the line
 * reads as solid history above the current cycle and hollow plan below it.
 */
function DateGutter({
  cycle,
  phase,
  first,
  last,
}: {
  cycle: Cycle
  phase: Phase
  first: boolean
  last: boolean
}) {
  const d = new Date(cycle.startsAt)
  const started = phase === 'current' || phase === 'completed'
  return (
    <div className="relative flex w-16 shrink-0 justify-end pr-3 pt-2.5">
      <div className="text-right text-[11px] leading-[1.15] text-faint">
        <div>{d.toLocaleDateString('en-US', { month: 'short' })}</div>
        <div>{d.getDate()}</div>
      </div>
      {/* the rail itself, clipped at the ends of the list */}
      <span
        className="absolute right-0 w-px bg-border-strong"
        style={{ top: first ? '18px' : 0, bottom: last ? 'auto' : 0, height: last ? '18px' : undefined }}
      />
      <span
        className={cn(
          'absolute right-[-3px] top-[14px] h-[7px] w-[7px] rounded-full border',
          started ? 'border-accent bg-accent' : 'border-border-strong bg-bg',
        )}
      />
    </div>
  )
}

function PhaseIcon({ phase, percent }: { phase: Phase; percent: number }) {
  if (phase === 'current')
    return <ProgressDonut percent={percent} size={14} />
  if (phase === 'completed')
    return <CircleCheck size={14} className="shrink-0 text-faint" />
  if (phase === 'upcoming')
    return <CircleDot size={14} className="shrink-0 text-faint" />
  return <CirclePlay size={14} className="shrink-0 text-faint" />
}

function Metric({
  percent,
  value,
  suffix,
  warn,
}: {
  percent: number
  value: string
  suffix: string
  warn?: boolean
}) {
  return (
    <span className="flex w-32 items-center gap-1.5">
      <ProgressDonut
        percent={percent}
        size={13}
        color={warn ? 'var(--priority-urgent)' : 'var(--accent)'}
      />
      <span className="tabular-nums text-fg">{value}</span>
      <span className="text-muted">{suffix}</span>
    </span>
  )
}
