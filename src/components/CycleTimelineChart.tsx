import { useMemo } from 'react'
import type { Cycle, Issue } from '@/lib/types'
import type { WorkspaceData } from '@/lib/seed'
import { cycleProgress } from '@/lib/selectors'

const DAY = 86_400_000
const W = 1000
const H = 150

const startOfDay = (ms: number) => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/**
 * The burn-up Linear draws inline under the current cycle: scope as a ceiling,
 * completed work climbing toward it, and a dotted ideal between them. Weekends
 * are hatched out the way they are in Linear's chart.
 *
 * Only `completedAt` is recorded per issue, so `completed` is a true historical
 * series while `scope` is flat at today's total — we don't keep a log of when an
 * issue joined the cycle, and inventing one would make the line lie.
 */
export function CycleTimelineChart({
  cycle,
  issues,
  data,
  nowMs,
}: {
  cycle: Cycle
  issues: Issue[]
  data: WorkspaceData
  nowMs: number
}) {
  const model = useMemo(() => {
    const scoped = issues.filter((i) => i.cycleId === cycle.id && !i.archivedAt)
    const scope = scoped.length
    const completions = scoped
      .map((i) => (i.completedAt ? new Date(i.completedAt).getTime() : null))
      .filter((t): t is number => t != null)

    const start = startOfDay(new Date(cycle.startsAt).getTime())
    const end = startOfDay(new Date(cycle.endsAt).getTime())
    const days = Math.max(1, Math.round((end - start) / DAY))
    const today = startOfDay(nowMs)

    const x = (d: number) => (d / days) * W
    // A zero-scope cycle would divide by zero; keep the baseline flat instead.
    const y = (v: number) => H - (scope ? (v / scope) * H : 0)

    const done: { x: number; y: number }[] = []
    for (let d = 0; d <= days; d++) {
      const dayEnd = start + (d + 1) * DAY
      if (start + d * DAY > today) break
      done.push({ x: x(d), y: y(completions.filter((t) => t < dayEnd).length) })
    }

    // Saturday/Sunday bands, as day-index ranges.
    const weekends: { from: number; to: number }[] = []
    for (let d = 0; d <= days; d++) {
      const wd = new Date(start + d * DAY).getDay()
      if (wd === 6) weekends.push({ from: x(d), to: x(Math.min(d + 2, days)) })
    }

    return {
      scope,
      days,
      todayX: x(Math.min(days, Math.max(0, Math.round((today - start) / DAY)))),
      donePath: done.length
        ? `M ${done.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`
        : '',
      doneArea: done.length
        ? `M ${done[0].x.toFixed(1)} ${H} L ${done
            .map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(' L ')} L ${done[done.length - 1].x.toFixed(1)} ${H} Z`
        : '',
      weekends,
      labels: [start, start + Math.round(days / 2) * DAY, end],
    }
  }, [cycle, issues, nowMs])

  const prog = cycleProgress(cycle.id, issues, data)
  const pct = (n: number) => (prog.total ? Math.round((n / prog.total) * 100) : 0)

  return (
    <div className="flex gap-6 pb-4 pl-8 pr-4 pt-1">
      <div className="min-w-0 flex-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[130px] w-full"
      >
        <defs>
          <pattern
            id="cycle-weekend"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--border)" strokeWidth="1.5" />
          </pattern>
        </defs>

        {model.weekends.map((w, i) => (
          <rect
            key={i}
            x={w.from}
            y={0}
            width={w.to - w.from}
            height={H}
            fill="url(#cycle-weekend)"
            opacity={0.55}
          />
        ))}

        {/* scope ceiling — flat, because scope history isn't recorded */}
        <line x1={0} y1={1} x2={W} y2={1} stroke="var(--text-tertiary)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

        {/* ideal: zero on day one, full scope on the last day */}
        <line
          x1={0}
          y1={H}
          x2={W}
          y2={1}
          stroke="var(--text-tertiary)"
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />

        {model.doneArea && <path d={model.doneArea} fill="var(--accent-subtle)" />}
        {model.donePath && (
          <path
            d={model.donePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        )}

        <line
          x1={model.todayX}
          y1={0}
          x2={model.todayX}
          y2={H}
          stroke="var(--border-strong)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* start / middle / end, under the plot the way Linear labels it */}
      <div className="flex justify-between pt-1.5 text-[11px] text-faint">
        {model.labels.map((ms) => (
          <span key={ms}>{shortDate(ms)}</span>
        ))}
      </div>
      </div>

      {/* the stat rail Linear parks to the right of the chart */}
      <div className="w-[190px] shrink-0 space-y-1.5">
        <Stat color="var(--text-tertiary)" square label="Scope" value={prog.total} />
        <Stat
          color="var(--status-started)"
          label="Started"
          value={prog.started}
          delta={`${pct(prog.started)}%`}
        />
        <Stat
          color="var(--accent)"
          label="Completed"
          value={prog.done}
          delta={`${pct(prog.done)}%`}
        />
      </div>
    </div>
  )
}

function Stat({
  color,
  label,
  value,
  delta,
  square,
}: {
  color: string
  label: string
  value: number
  delta?: string
  square?: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span
        className={square ? 'h-[7px] w-[7px] shrink-0' : 'h-[7px] w-[7px] shrink-0 rounded-full'}
        style={{ background: color }}
      />
      <span className="text-muted">{label}</span>
      <span className="ml-auto tabular-nums text-fg">{value}</span>
      {delta && <span className="w-9 text-right tabular-nums text-faint">{delta}</span>}
    </div>
  )
}
