import { useMemo } from 'react'
import type { BurndownPoint } from '@/lib/selectors'

/**
 * Linear-style cycle burndown: an "ideal" dashed guideline (scope → 0 across
 * the cycle) against the actual remaining open scope, which steps down as
 * issues complete. The actual line stops at "today" for in-flight cycles.
 */
export function CycleBurndown({
  points,
  scope,
  nowMs,
}: {
  points: BurndownPoint[]
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

  const idealPath = useMemo(
    () => points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.ideal)}`).join(' '),
    [points],
  )

  const actual = points.filter((p) => p.remaining != null)
  const actualPath = useMemo(
    () =>
      actual
        .map((p, i) => `${i ? 'L' : 'M'}${x(points.indexOf(p))},${y(p.remaining!)}`)
        .join(' '),
    [points],
  )
  const areaPath = actual.length
    ? `${actualPath} L${x(points.indexOf(actual[actual.length - 1]))},${y(0)} L${x(
        points.indexOf(actual[0]),
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

  // "Today" marker — interpolated x for nowMs within the cycle window.
  const todayX = useMemo(() => {
    if (points.length < 2) return null
    const start = points[0].dayMs
    const end = points[points.length - 1].dayMs
    if (nowMs < start || nowMs > end) return null
    return padL + ((nowMs - start) / (end - start)) * plotW
  }, [points, nowMs])

  // Forecast / projection — only for in-flight cycles with scope. Derive the
  // current completion velocity (issues closed per day) from the actual line so
  // far, then project a straight trend from today's remaining-open value to
  // where it hits 0 (predicted finish), clamped to the cycle's right edge if it
  // won't land in time.
  const forecastPath = useMemo(() => {
    if (todayX == null || scope <= 0) return null
    if (actual.length < 1) return null
    const last = actual[actual.length - 1]
    const remaining = last.remaining!
    if (remaining <= 0) return null // already done — nothing to project
    const dayMs = 86_400_000
    const start = points[0].dayMs
    const end = points[points.length - 1].dayMs
    // Days elapsed from cycle start to today (≥ ~1 day to avoid div-by-zero).
    const elapsedDays = Math.max((nowMs - start) / dayMs, 1)
    const closed = scope - remaining
    const perDay = closed / elapsedDays
    const startX = todayX
    const startY = y(remaining)
    let endX: number
    let endY: number
    if (perDay > 0) {
      const daysToFinish = remaining / perDay
      const finishMs = nowMs + daysToFinish * dayMs
      if (finishMs <= end) {
        // Predicted to finish within the cycle — land on the x-axis.
        endX = padL + ((finishMs - start) / (end - start)) * plotW
        endY = y(0)
      } else {
        // Won't finish in time — extend to cycle end at the remaining-at-end.
        const remainAtEnd = remaining - perDay * ((end - nowMs) / dayMs)
        endX = padL + plotW
        endY = y(Math.max(remainAtEnd, 0))
      }
    } else {
      // No progress yet — flat projection to cycle end (never finishes).
      endX = padL + plotW
      endY = startY
    }
    return `M${startX},${startY} L${endX},${endY}`
  }, [points, scope, nowMs, todayX])

  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="block"
        role="img"
        aria-label="Cycle burndown chart"
      >
        {/* Horizontal gridlines + Y labels */}
        {ticks.map((v) => (
          <g key={v}>
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

        {/* Ideal guideline */}
        <path
          d={idealPath}
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />

        {/* Actual remaining: area fill + line */}
        {areaPath && <path d={areaPath} fill="var(--accent-subtle)" />}
        {actualPath && (
          <path
            d={actualPath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Forecast / projection — predicted-completion trend from today */}
        {forecastPath && (
          <path
            d={forecastPath}
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth={1.5}
            strokeDasharray="2 3"
            strokeLinecap="round"
            opacity={0.9}
          />
        )}

        {/* X axis date labels — start, mid, end */}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1].map((i) => (
          <text
            key={i}
            x={Math.min(Math.max(x(i), padL + 12), W - padR - 12)}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-tertiary)"
          >
            {points[i] ? fmt(points[i].dayMs) : ''}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 pl-7 text-[11px] text-faint">
        <LegendItem color="var(--accent)" label="Open" />
        <LegendItem color="var(--text-tertiary)" label="Ideal" dashed />
        {forecastPath && (
          <LegendItem color="var(--text-tertiary)" label="Forecast" dash="1.5 2" />
        )}
      </div>
    </div>
  )
}

function LegendItem({
  color,
  label,
  dashed,
  dash,
}: {
  color: string
  label: string
  dashed?: boolean
  /** Custom dash pattern; overrides `dashed`. */
  dash?: string
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
          strokeDasharray={dash ?? (dashed ? '3 2' : undefined)}
        />
      </svg>
      {label}
    </span>
  )
}
