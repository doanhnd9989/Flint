import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { formatDate } from '@/lib/utils'

const DAY_MS = 86_400_000

const startOfDay = (ms: number) => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const parseIsoDate = (iso: string) => {
  // YYYY-MM-DD as a local midnight, so the axis aligns with calendar days.
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

interface GraphPoint {
  /** Day boundary (ms) this point represents. */
  dayMs: number
  /** Cumulative completed count at end of this day; null for future days. */
  completed: number | null
}

/**
 * Linear's project Graph — a burn-up of scope vs. completed issues across the
 * project's lifespan. A flat Scope line (total issue count) and a Completed
 * line that steps UP as issues finish (cumulative `completedAt`), area-filled.
 * The completed line stops at "today" for in-flight projects.
 */
export function ProjectProgressGraph({ projectId }: { projectId: string }) {
  const issues = useStore((s) => s.issues)
  const projects = useStore((s) => s.projects)
  const states = useStore((s) => s.states)

  const { points, scope, hasData } = useMemo(() => {
    const project = projects.find((p) => p.id === projectId)
    const scoped = issues.filter(
      (i) => i.projectId === projectId && !i.archivedAt,
    )
    const scope = scoped.length
    if (!project || scope === 0) {
      return { points: [] as GraphPoint[], scope, hasData: false }
    }

    const completedTypes = new Set(
      states.filter((s) => s.type === 'completed').map((s) => s.id),
    )
    // Completion timestamps for issues that are done (completedAt, or fall back
    // to updatedAt when in a completed state without an explicit timestamp).
    const completions = scoped
      .filter((i) => i.completedAt || completedTypes.has(i.stateId))
      .map((i) => new Date(i.completedAt ?? i.updatedAt).getTime())
      .sort((a, b) => a - b)

    const nowDay = startOfDay(Date.now())

    // Start: project startDate, else earliest issue createdAt.
    const earliestCreated = scoped.reduce(
      (min, i) => Math.min(min, new Date(i.createdAt).getTime()),
      Infinity,
    )
    const startDay = startOfDay(
      project.startDate ? parseIsoDate(project.startDate) : earliestCreated,
    )

    // End: project targetDate, else max(today, last completion).
    const lastCompletion = completions.length
      ? completions[completions.length - 1]
      : nowDay
    const endDay = startOfDay(
      project.targetDate
        ? parseIsoDate(project.targetDate)
        : Math.max(nowDay, lastCompletion),
    )

    const days = Math.max(1, Math.round((endDay - startDay) / DAY_MS))
    const points: GraphPoint[] = []
    for (let d = 0; d <= days; d++) {
      const dayStart = startDay + d * DAY_MS
      const dayEnd = dayStart + DAY_MS
      let completed: number | null = null
      // Only chart actual completion up to today (in-flight projects stop here).
      if (dayStart <= nowDay) {
        completed = completions.filter((t) => t < dayEnd).length
      }
      points.push({ dayMs: dayStart, completed })
    }
    return { points, scope, hasData: true }
  }, [projectId, issues, projects, states])

  return (
    <section className="rounded-lg border border-border bg-bg-secondary p-4">
      <h3 className="mb-3 text-[13px] font-medium text-fg">Progress</h3>
      {hasData ? (
        <Chart points={points} scope={scope} nowMs={Date.now()} />
      ) : (
        <div className="flex h-[180px] items-center justify-center text-[13px] text-faint">
          No data to chart yet
        </div>
      )}
    </section>
  )
}

function Chart({
  points,
  scope,
  nowMs,
}: {
  points: GraphPoint[]
  scope: number
  nowMs: number
}) {
  // Drawing geometry in viewBox units (scales to the container width).
  const W = 720
  const H = 220
  const padL = 28
  const padR = 16
  const padT = 12
  const padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const maxY = Math.max(scope, 1)

  const x = (i: number) =>
    padL + (points.length <= 1 ? 0 : (i / (points.length - 1)) * plotW)
  const y = (v: number) => padT + (1 - v / maxY) * plotH

  // Flat Scope line across the full window.
  const scopePath = `M${x(0)},${y(scope)} L${x(points.length - 1)},${y(scope)}`

  // Completed steps up over time; only days with an actual value are drawn.
  const done = points.filter((p) => p.completed != null)
  const completedPath = useMemo(
    () =>
      done
        .map(
          (p, i) =>
            `${i ? 'L' : 'M'}${x(points.indexOf(p))},${y(p.completed!)}`,
        )
        .join(' '),
    [points],
  )
  const areaPath = done.length
    ? `${completedPath} L${x(points.indexOf(done[done.length - 1]))},${y(0)} L${x(
        points.indexOf(done[0]),
      )},${y(0)} Z`
    : ''

  // Y gridlines / ticks — a few evenly spaced values up to scope.
  const ticks = useMemo(() => {
    const step = Math.max(1, Math.ceil(maxY / 4))
    const out: number[] = []
    for (let v = 0; v <= maxY; v += step) out.push(v)
    if (out[out.length - 1] !== maxY) out.push(maxY)
    return out
  }, [maxY])

  // "Today" marker — interpolated x for nowMs within the project window.
  const todayX = useMemo(() => {
    if (points.length < 2) return null
    const start = points[0].dayMs
    const end = points[points.length - 1].dayMs
    if (nowMs < start || nowMs > end) return null
    return padL + ((nowMs - start) / (end - start)) * plotW
  }, [points, nowMs])

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="block"
        role="img"
        aria-label="Project progress chart"
      >
        {/* Horizontal gridlines + Y labels */}
        {ticks.map((v, ti) => (
          <g key={ti}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--text-tertiary)"
            >
              {v}
            </text>
          </g>
        ))}

        {/* Today marker */}
        {todayX != null && (
          <line
            x1={todayX}
            x2={todayX}
            y1={padT}
            y2={padT + plotH}
            stroke="var(--border-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* Completed: area fill + step-up line */}
        {areaPath && <path d={areaPath} fill="var(--accent-subtle)" />}
        {completedPath && (
          <path
            d={completedPath}
            fill="none"
            stroke="var(--status-completed)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Scope guideline */}
        <path
          d={scopePath}
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />

        {/* X axis date labels — start, mid, end */}
        {(['start', 'mid', 'end'] as const).map((pos, pi) => {
          const i = [0, Math.floor((points.length - 1) / 2), points.length - 1][pi]
          return (
          <text
            key={pos}
            x={Math.min(Math.max(x(i), padL + 12), W - padR - 12)}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-tertiary)"
          >
            {points[i] ? formatDate(new Date(points[i].dayMs).toISOString()) : ''}
          </text>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 pl-7 text-[11px] text-faint">
        <LegendItem color="var(--text-tertiary)" label="Scope" dashed />
        <LegendItem color="var(--status-completed)" label="Completed" />
      </div>
    </div>
  )
}

function LegendItem({
  color,
  label,
  dashed,
}: {
  color: string
  label: string
  dashed?: boolean
}) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width={16} height={6} className="shrink-0">
        <line
          x1={0}
          y1={3}
          x2={16}
          y2={3}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={dashed ? '3 2' : undefined}
        />
      </svg>
      {label}
    </span>
  )
}
