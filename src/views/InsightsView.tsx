import { useMemo, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { DatePicker } from '@/components/DatePicker'
import { UtilizationChart } from '@/components/UtilizationChart'
import { LABEL_COLORS, PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/constants'
import { displayName, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Issue, WorkflowState } from '@/lib/types'

/**
 * Time ranges for the Insights header — filter source issues by createdAt. The
 * trailing 'custom' entry switches the header to an explicit start/end date pair
 * (matching Linear's "Custom range…" option) instead of a rolling day window.
 */
const RANGES = [
  { id: 'all', label: 'All time', days: 0 },
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: 'custom', label: 'Custom range…', days: -1 },
] as const
type RangeId = (typeof RANGES)[number]['id']

/**
 * Breakdown dimensions for the featured "Group by" chart (and the CSV export,
 * which mirrors whatever dimension is selected). Matches Linear's Insights
 * "Group by", which re-pivots the headline chart across any issue attribute.
 */
const DIMENSIONS = [
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'project', label: 'Project' },
  { id: 'label', label: 'Label' },
] as const
type DimensionId = (typeof DIMENSIONS)[number]['id']

/**
 * Insights "Split by" secondary dimension — Linear lets the headline breakdown
 * be sub-divided so each primary bar becomes a STACKED bar segmented by a second
 * attribute (e.g. count by project, split by status). "None" keeps the plain
 * single-color bars. The split dimension is restricted to the low-cardinality
 * attributes (status / priority / assignee) that read well as stacked segments.
 */
const SPLITS = [
  { id: 'none', label: 'None' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'assignee', label: 'Assignee' },
] as const
type SplitId = (typeof SPLITS)[number]['id']

/**
 * Deterministic per-assignee colour for the stacked "Split by: Assignee" bar —
 * assignees have no intrinsic colour, so we hash the id onto the shared label
 * palette so each person reads as a distinct, stable segment. Unassigned uses a
 * neutral grey (palette slot 0).
 */
function assigneeColor(id: string): string {
  if (id === '__none') return LABEL_COLORS[0]
  let h = 0
  for (let n = 0; n < id.length; n++) h = (h * 31 + id.charCodeAt(n)) >>> 0
  // Skip slot 0 (reserved for Unassigned/grey) so people get a saturated hue.
  return LABEL_COLORS[1 + (h % (LABEL_COLORS.length - 1))]
}

/**
 * Sort order for the featured breakdown — Linear lets you flip a breakdown
 * between largest- and smallest-first to surface either the heavy hitters or
 * the long tail.
 */
const SORTS = [
  { id: 'desc', label: 'Largest' },
  { id: 'asc', label: 'Smallest' },
] as const
type SortId = (typeof SORTS)[number]['id']

/**
 * Insights "Measure by" toggle — count issues vs. sum their estimate points.
 * Linear lets every breakdown be re-weighted by story points instead of a raw
 * issue count, surfacing where effort (not just ticket volume) concentrates.
 */
const MEASURES = [
  { id: 'count', label: 'Count' },
  { id: 'points', label: 'Points' },
] as const
type MeasureId = (typeof MEASURES)[number]['id']

/** Weight one issue under the active measure: 1 per issue, or its estimate. */
function weight(i: Issue, measure: MeasureId): number {
  return measure === 'points' ? i.estimate ?? 0 : 1
}

/** Sum the active-measure weight across a set of issues. */
function weighSum(list: Issue[], measure: MeasureId): number {
  return list.reduce((s, i) => s + weight(i, measure), 0)
}

/** RFC 4180 — quote a field and escape embedded quotes. */
function csvField(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Build a CSV Blob from a breakdown and trigger a browser download. */
function downloadCsv(
  filename: string,
  dimensionLabel: string,
  bars: Bar[],
  valueHeader = 'Count',
) {
  const rows = [
    [dimensionLabel, valueHeader],
    ...bars.map((b) => [b.label, b.value] as const),
  ]
  const csv = rows.map((r) => r.map(csvField).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Bar colors for the priority chart, keyed by Linear's priority scale. */
const PRIORITY_COLOR: Record<number, string> = {
  0: 'var(--status-unstarted)',
  1: 'var(--priority-urgent)',
  2: '#f2994a',
  3: '#f2c94c',
  4: '#95a2b3',
}

interface Bar {
  key: string
  label: string
  value: number
  color: string
}

/** A horizontal bar list — Linear's Insights breakdown card. */
function BarChart({ bars, max }: { bars: Bar[]; max: number }) {
  if (bars.length === 0) {
    return <div className="px-1 py-6 text-center text-[12px] text-faint">No data</div>
  }
  // Denominator for each bar's share of the breakdown — drives the hover tooltip
  // (and decides which bars are wide enough to carry an inline value label).
  const total = bars.reduce((s, b) => s + b.value, 0)
  return (
    <div className="space-y-2.5">
      {bars.map((b) => {
        const pct = max > 0 ? (b.value / max) * 100 : 0
        const share = total > 0 ? Math.round((b.value / total) * 100) : 0
        // Render the value INSIDE the bar once it's wide enough to hold the
        // glyph legibly; otherwise it falls through to the trailing label as
        // before. ~14% keeps a 2-digit number from clipping its own track.
        const inside = pct >= 14
        return (
          <div
            key={b.key}
            className="group flex items-center gap-3"
            title={`${b.label}: ${b.value} (${share}%)`}
          >
            <div className="flex w-28 shrink-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: b.color }}
              />
              <span className="truncate text-[12px] text-muted group-hover:text-fg">{b.label}</span>
            </div>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="absolute inset-y-0 left-0 flex items-center justify-end rounded-full pr-1.5 transition-all"
                style={{ width: `${pct}%`, backgroundColor: b.color }}
              >
                {inside && (
                  <span className="text-[9px] font-medium leading-none tabular-nums text-bg">{b.value}</span>
                )}
              </div>
            </div>
            <div
              className={cn(
                'w-7 shrink-0 text-right text-[12px] tabular-nums text-fg',
                inside && 'invisible',
              )}
            >
              {b.value}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** A single series in a stacked breakdown — one colored segment per primary bar. */
interface Series {
  key: string
  label: string
  color: string
}

/** A primary bar carrying its per-series segment values for stacked rendering. */
interface StackedBar {
  key: string
  label: string
  total: number
  /** Segment value keyed by series.key. */
  segments: Record<string, number>
}

/** A horizontal STACKED bar list — Linear's "Split by" breakdown card. */
function StackedBarChart({ bars, series, max }: { bars: StackedBar[]; series: Series[]; max: number }) {
  if (bars.length === 0) {
    return <div className="px-1 py-6 text-center text-[12px] text-faint">No data</div>
  }
  return (
    <div className="space-y-2.5">
      {bars.map((b) => (
        <div key={b.key} className="group flex items-center gap-3">
          <div className="flex w-28 shrink-0 items-center gap-1.5" title={b.label}>
            <span className="truncate text-[12px] text-muted group-hover:text-fg">{b.label}</span>
          </div>
          <div className="relative flex h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
            {/* Width is scaled to the largest total so bars stay comparable; each
                segment then takes its share of that bar's own width. A 1px gap
                between segments (track shows through) keeps adjacent same-ish
                hues legible, matching Linear's stacked bars. */}
            <div
              className="flex h-full gap-px transition-[width] duration-300"
              style={{ width: `${max > 0 ? (b.total / max) * 100 : 0}%` }}
            >
              {series.map((s) => {
                const v = b.segments[s.key] ?? 0
                if (v <= 0) return null
                return (
                  <div
                    key={s.key}
                    title={`${s.label}: ${v}`}
                    className="h-full transition-opacity hover:opacity-80"
                    style={{
                      width: `${b.total > 0 ? (v / b.total) * 100 : 0}%`,
                      minWidth: 3,
                      backgroundColor: s.color,
                    }}
                  />
                )
              })}
            </div>
          </div>
          <div className="w-7 shrink-0 text-right text-[12px] tabular-nums text-fg">{b.total}</div>
        </div>
      ))}
    </div>
  )
}

/** Compact swatch legend for the stacked breakdown's series. */
function Legend({ series }: { series: Series[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

/**
 * One bucket of the Created-vs-Completed time series: its bucket-start timestamp
 * (for the x-axis date labels) plus the count of issues created / completed that
 * landed in this bucket.
 */
interface TimePoint {
  t: number
  created: number
  completed: number
}

/**
 * Inline SVG line/area chart for the Created-vs-Completed series — Linear's
 * Insights "Created vs Completed" trend. Two overlaid lines (Created in muted
 * grey, Completed in accent) with a faint area fill under each, light
 * horizontal gridlines, Y ticks, start/mid/end date labels and a small legend.
 * No chart library — pure SVG on a fixed viewBox, scaled responsively. Handles
 * empty and single-point ranges (a lone point renders as a dot).
 */
function TimeSeriesChart({ points }: { points: TimePoint[] }) {
  if (points.length === 0) {
    return <div className="px-1 py-6 text-center text-[12px] text-faint">No data</div>
  }

  // Fixed drawing surface — the SVG scales to the card width via the viewBox.
  const W = 720
  const H = 200
  const padL = 28
  const padR = 12
  const padT = 12
  const padB = 22
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  // Y scale: round the max up to a "nice" tick step so the gridlines land on
  // whole numbers; never below 1 so a flat-zero series still draws a baseline.
  const peak = points.reduce((m, p) => Math.max(m, p.created, p.completed), 0)
  const niceMax = Math.max(1, peak)
  const tickCount = 4
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((niceMax * i) / tickCount))

  // X positions — a single point sits centered so it reads as a lone marker.
  const xAt = (idx: number) =>
    padL + (points.length === 1 ? plotW / 2 : (idx / (points.length - 1)) * plotW)
  const yAt = (v: number) => padT + plotH - (v / niceMax) * plotH

  // Build a polyline path + a closed area path (down to the baseline) for one series.
  const linePath = (sel: (p: TimePoint) => number) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(sel(p)).toFixed(1)}`).join(' ')
  const areaPath = (sel: (p: TimePoint) => number) => {
    const base = padT + plotH
    const top = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(sel(p)).toFixed(1)}`).join(' ')
    return `${top} L ${xAt(points.length - 1).toFixed(1)} ${base.toFixed(1)} L ${xAt(0).toFixed(1)} ${base.toFixed(1)} Z`
  }

  // Start / mid / end x-axis date labels (mid is dropped when too few points).
  const midIdx = Math.floor((points.length - 1) / 2)
  const xLabels =
    points.length === 1
      ? [{ idx: 0, anchor: 'middle' as const }]
      : [
          { idx: 0, anchor: 'start' as const },
          ...(points.length > 2 ? [{ idx: midIdx, anchor: 'middle' as const }] : []),
          { idx: points.length - 1, anchor: 'end' as const },
        ]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Created versus completed over time">
        {/* Horizontal gridlines + Y tick labels. */}
        {yTicks.map((v) => {
          const y = yAt(v)
          return (
            <g key={v}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeWidth={1}
                className="text-border"
              />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-faint text-[9px] tabular-nums">
                {v}
              </text>
            </g>
          )
        })}

        {/* Created series — muted grey area + line. */}
        <path d={areaPath((p) => p.created)} className="fill-muted opacity-[0.08]" />
        <path
          d={linePath((p) => p.created)}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-muted"
        />

        {/* Completed series — accent area + line, drawn on top. */}
        <path d={areaPath((p) => p.completed)} className="fill-accent opacity-[0.12]" />
        <path
          d={linePath((p) => p.completed)}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-accent"
        />

        {/* Single-point ranges have no line to draw — show each value as a dot. */}
        {points.length === 1 && (
          <>
            <circle cx={xAt(0)} cy={yAt(points[0].created)} r={3} className="fill-muted" />
            <circle cx={xAt(0)} cy={yAt(points[0].completed)} r={3} className="fill-accent" />
          </>
        )}

        {/* x-axis date labels. */}
        {xLabels.map(({ idx, anchor }) => (
          <text
            key={idx}
            x={xAt(idx)}
            y={H - 6}
            textAnchor={anchor}
            className="fill-faint text-[9px]"
          >
            {formatDate(new Date(points[idx].t).toISOString())}
          </text>
        ))}
      </svg>

      {/* Legend. */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-0.5 w-3 shrink-0 rounded-full bg-muted" />
          Created
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-0.5 w-3 shrink-0 rounded-full bg-accent" />
          Completed
        </span>
      </div>
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-bg p-5">
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold text-fg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-4 py-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-tight text-fg tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  )
}

/** Top-N + "Other" rollup so long-tail breakdowns stay readable. */
function topN(bars: Bar[], n: number): Bar[] {
  if (bars.length <= n) return bars
  const head = bars.slice(0, n)
  const rest = bars.slice(n)
  const other = rest.reduce((sum, b) => sum + b.value, 0)
  if (other > 0) head.push({ key: '__other', label: 'Other', value: other, color: 'var(--status-canceled)' })
  return head
}

export function InsightsView() {
  const data = useStore()
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [range, setRange] = useState<RangeId>('all')
  // Explicit start/end (ISO) for the 'custom' range — local only, drives the same
  // createdAt filtering the presets do via the shared [from, to] window below.
  const [customFrom, setCustomFrom] = useState<string | undefined>()
  const [customTo, setCustomTo] = useState<string | undefined>()
  const [measure, setMeasure] = useState<MeasureId>('count')
  // Featured "Group by" dimension — drives the headline breakdown chart and the
  // CSV export. `sort` flips that headline chart largest- vs. smallest-first.
  const [groupBy, setGroupBy] = useState<DimensionId>('status')
  const [sort, setSort] = useState<SortId>('desc')
  // Optional secondary "Split by" dimension — turns the featured bars into
  // stacked bars segmented by this attribute. 'none' keeps plain single bars.
  const [splitBy, setSplitBy] = useState<SplitId>('none')
  const displayPref = data.preferences.displayNames

  const rangeMeta = RANGES.find((r) => r.id === range) ?? RANGES[0]

  // Unified createdAt window for the active range as a `[from, to]` pair of
  // timestamps (null = open-ended on that side). Presets are rolling windows
  // ending now (`from = now − days`, `to = null`); 'custom' uses the explicit
  // start/end dates, inclusive of the whole end day. Both feed the same filtering.
  const { from, to } = useMemo<{ from: number | null; to: number | null }>(() => {
    if (range === 'custom') {
      return {
        from: customFrom ? new Date(customFrom).getTime() : null,
        // Inclusive end — extend to the final millisecond of the chosen day.
        to: customTo ? new Date(customTo).getTime() + 86_400_000 - 1 : null,
      }
    }
    return {
      from: rangeMeta.days > 0 ? Date.now() - rangeMeta.days * 86_400_000 : null,
      to: null,
    }
  }, [range, rangeMeta.days, customFrom, customTo])

  // Cutoff timestamp = the window's lower bound; null means open-ended (drives
  // the time-series window start the same way it did for the preset ranges).
  const cutoff = from

  // Human label for the active range — presets use their static label; a custom
  // range reads as its explicit date span (open-ended sides shown as "any").
  const rangeLabel =
    range === 'custom'
      ? `${customFrom ? formatDate(customFrom) : 'any'} – ${customTo ? formatDate(customTo) : 'any'}`
      : rangeMeta.label

  const issues = useMemo<Issue[]>(
    () =>
      data.issues.filter((i) => {
        if (i.archivedAt) return false
        if (teamFilter !== 'all' && i.teamId !== teamFilter) return false
        const t = new Date(i.createdAt).getTime()
        if (from !== null && t < from) return false
        if (to !== null && t > to) return false
        return true
      }),
    [data.issues, teamFilter, from, to],
  )

  const stateById = useMemo(() => {
    const m = new Map<string, WorkflowState>()
    data.states.forEach((s) => m.set(s.id, s))
    return m
  }, [data.states])

  // ── summary numbers ────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let completed = 0
    let started = 0
    let backlog = 0
    let unstarted = 0
    for (const i of issues) {
      const t = stateById.get(i.stateId)?.type
      // Weight by the active measure (1 per issue, or its estimate points) so the
      // summary tiles match the breakdown charts. Completion is summed over the
      // same range-filtered cohort as the denominator (`issues`), keeping the
      // completion rate consistent (numerator ⊆ denominator).
      const w = weight(i, measure)
      if (t === 'completed') completed += w
      else if (t === 'started') started += w
      else if (t === 'backlog') backlog += w
      else if (t === 'unstarted') unstarted += w
    }
    const total = weighSum(issues, measure)
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
    const scope = issues.filter((i) => stateById.get(i.stateId)?.type !== 'canceled')
    const points = scope.reduce((s, i) => s + (i.estimate ?? 0), 0)

    // Avg. cycle time (days) — Linear measures how long completed work takes from
    // when it was opened to when it landed. Issues carry no explicit "started"
    // timestamp, so we measure createdAt → completedAt, averaged over the
    // completed issues in the active cohort. A null result renders as '—' when
    // nothing has been completed yet.
    let cycleSum = 0
    let cycleCount = 0
    for (const i of issues) {
      if (stateById.get(i.stateId)?.type !== 'completed' || !i.completedAt) continue
      const start = new Date(i.createdAt).getTime()
      const end = new Date(i.completedAt).getTime()
      const ms = end - start
      if (!Number.isFinite(ms) || ms < 0) continue
      cycleSum += ms / 86_400_000
      cycleCount++
    }
    const avgCycle = cycleCount > 0 ? cycleSum / cycleCount : null

    return { total, completed, started, backlog, unstarted, rate, points, avgCycle }
  }, [issues, stateById, measure])

  // ── Created vs Completed time series ───────────────────────────────────────
  // Bucket the range/team-filtered cohort by createdAt and completedAt across
  // the active window. Window start is the range cutoff (or the earliest
  // createdAt for "all time"); window end is the custom range's end date when
  // set, else now. Day buckets for ≤31-day spans, weekly buckets beyond that, so
  // the line stays readable at every zoom.
  const timeSeries = useMemo<TimePoint[]>(() => {
    const now = to ?? Date.now()
    let start = cutoff
    if (start === null) {
      // "All time" — span from the earliest createdAt in the cohort.
      let earliest = now
      for (const i of issues) earliest = Math.min(earliest, new Date(i.createdAt).getTime())
      start = earliest
    }
    if (!Number.isFinite(start) || start > now) start = now

    const DAY = 86_400_000
    const spanDays = Math.max(1, Math.ceil((now - start) / DAY))
    const weekly = spanDays > 31
    const bucketMs = weekly ? 7 * DAY : DAY
    // Align the window start to bucket boundaries so labels read as whole days.
    const start0 = Math.floor(start / DAY) * DAY
    const bucketCount = Math.max(1, Math.ceil((now - start0) / bucketMs) + 1)

    const pts: TimePoint[] = Array.from({ length: bucketCount }, (_, k) => ({
      t: start0 + k * bucketMs,
      created: 0,
      completed: 0,
    }))
    const bucketOf = (ts: number) => {
      const idx = Math.floor((ts - start0) / bucketMs)
      return idx >= 0 && idx < bucketCount ? idx : -1
    }
    for (const i of issues) {
      const ci = bucketOf(new Date(i.createdAt).getTime())
      if (ci >= 0) pts[ci].created++
      if (i.completedAt) {
        const di = bucketOf(new Date(i.completedAt).getTime())
        if (di >= 0) pts[di].completed++
      }
    }
    return pts
  }, [issues, cutoff, to])

  // ── breakdown by workflow status ───────────────────────────────────────────
  const byStatus = useMemo<Bar[]>(() => {
    const order = [...data.states].sort((a, b) => a.position - b.position)
    return order
      .map((s) => ({
        key: s.id,
        label: s.name,
        value: weighSum(issues.filter((i) => i.stateId === s.id), measure),
        color: s.color,
      }))
      .filter((b) => b.value > 0)
  }, [issues, data.states, measure])

  // ── breakdown by assignee ──────────────────────────────────────────────────
  const byAssignee = useMemo<Bar[]>(() => {
    const counts = new Map<string, number>()
    for (const i of issues) counts.set(i.assigneeId ?? '__none', (counts.get(i.assigneeId ?? '__none') ?? 0) + weight(i, measure))
    const bars: Bar[] = [...counts.entries()].map(([id, value]) => ({
      key: id,
      label: id === '__none' ? 'Unassigned' : displayName(data.users.find((u) => u.id === id)?.name ?? 'Unknown', displayPref),
      value,
      color: 'var(--accent)',
    }))
    bars.sort((a, b) => b.value - a.value)
    return topN(bars, 6)
  }, [issues, data.users, displayPref, measure])

  // ── breakdown by priority ──────────────────────────────────────────────────
  const byPriority = useMemo<Bar[]>(
    () =>
      PRIORITY_ORDER.map((p) => ({
        key: String(p),
        label: PRIORITY_LABELS[p],
        value: weighSum(issues.filter((i) => i.priority === p), measure),
        color: PRIORITY_COLOR[p],
      })).filter((b) => b.value > 0),
    [issues, measure],
  )

  // ── breakdown by project ───────────────────────────────────────────────────
  const byProject = useMemo<Bar[]>(() => {
    const counts = new Map<string, number>()
    for (const i of issues) counts.set(i.projectId ?? '__none', (counts.get(i.projectId ?? '__none') ?? 0) + weight(i, measure))
    const bars: Bar[] = [...counts.entries()].map(([id, value]) => ({
      key: id,
      label: id === '__none' ? 'No project' : data.projects.find((p) => p.id === id)?.name ?? 'Unknown',
      value,
      color: 'var(--status-review)',
    }))
    bars.sort((a, b) => b.value - a.value)
    return topN(bars, 6)
  }, [issues, data.projects, measure])

  // ── breakdown by label ─────────────────────────────────────────────────────
  const byLabel = useMemo<Bar[]>(() => {
    const counts = new Map<string, number>()
    for (const i of issues) for (const l of i.labelIds) counts.set(l, (counts.get(l) ?? 0) + weight(i, measure))
    const bars: Bar[] = [...counts.entries()].map(([id, value]) => {
      const label = data.labels.find((l) => l.id === id)
      return { key: id, label: label?.name ?? 'Unknown', value, color: label?.color ?? 'var(--accent)' }
    })
    bars.sort((a, b) => b.value - a.value)
    return topN(bars, 6)
  }, [issues, data.labels, measure])

  const maxOf = (bars: Bar[]) => bars.reduce((m, b) => Math.max(m, b.value), 0)

  // Map each dimension to its computed breakdown + human label.
  const breakdowns: Record<DimensionId, { label: string; bars: Bar[] }> = {
    status: { label: 'Status', bars: byStatus },
    priority: { label: 'Priority', bars: byPriority },
    assignee: { label: 'Assignee', bars: byAssignee },
    project: { label: 'Project', bars: byProject },
    label: { label: 'Label', bars: byLabel },
  }

  // Featured breakdown for the active "Group by" dimension, re-sorted by the
  // chosen order. "Other" rollups (added by topN) always sink to the bottom so
  // the long-tail bucket never jumps to the top under smallest-first.
  const grouped = breakdowns[groupBy]
  const groupedBars = useMemo<Bar[]>(() => {
    const bars = [...grouped.bars]
    bars.sort((a, b) => {
      if (a.key === '__other') return 1
      if (b.key === '__other') return -1
      return sort === 'asc' ? a.value - b.value : b.value - a.value
    })
    return bars
  }, [grouped.bars, sort])

  // ── stacked "Split by" breakdown ───────────────────────────────────────────
  // Resolve the primary group key(s) an issue belongs to under the active
  // `groupBy`. Labels are multi-valued, so this returns a list; every other
  // dimension yields exactly one key (matching the headline chart's buckets).
  const primaryKeys = (i: Issue): string[] => {
    switch (groupBy) {
      case 'status': return [i.stateId]
      case 'priority': return [String(i.priority)]
      case 'assignee': return [i.assigneeId ?? '__none']
      case 'project': return [i.projectId ?? '__none']
      case 'label': return i.labelIds.length ? i.labelIds : ['__nolabel']
    }
  }

  // Resolve the split-series key + display label + color for an issue under the
  // active `splitBy`. Mirrors the colors used by the standalone breakdowns.
  const splitMeta = (i: Issue): Series => {
    switch (splitBy) {
      case 'status': {
        const s = stateById.get(i.stateId)
        return { key: i.stateId, label: s?.name ?? 'Unknown', color: s?.color ?? 'var(--accent)' }
      }
      case 'priority':
        return { key: String(i.priority), label: PRIORITY_LABELS[i.priority], color: PRIORITY_COLOR[i.priority] }
      case 'assignee': {
        const id = i.assigneeId ?? '__none'
        const label = id === '__none' ? 'Unassigned' : displayName(data.users.find((u) => u.id === id)?.name ?? 'Unknown', displayPref)
        return { key: id, label, color: assigneeColor(id) }
      }
      default:
        return { key: '__none', label: '', color: 'var(--accent)' }
    }
  }

  // Series present in the data, in a stable order (status by position, priority
  // by scale, assignee by descending weight) so the legend reads predictably.
  const splitSeries = useMemo<Series[]>(() => {
    if (splitBy === 'none') return []
    const seen = new Map<string, Series>()
    const weights = new Map<string, number>()
    for (const i of issues) {
      const m = splitMeta(i)
      if (!seen.has(m.key)) seen.set(m.key, m)
      weights.set(m.key, (weights.get(m.key) ?? 0) + weight(i, measure))
    }
    const list = [...seen.values()]
    if (splitBy === 'status') {
      const pos = new Map(data.states.map((s) => [s.id, s.position]))
      list.sort((a, b) => (pos.get(a.key) ?? 0) - (pos.get(b.key) ?? 0))
    } else if (splitBy === 'priority') {
      list.sort((a, b) => Number(a.key) - Number(b.key))
    } else {
      list.sort((a, b) => (weights.get(b.key) ?? 0) - (weights.get(a.key) ?? 0))
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, splitBy, measure, data.states, data.users, displayPref])

  // Stacked bars for the featured breakdown: each primary bucket from
  // `groupedBars` carries its per-series segment totals. Kept in the same order
  // (and "Other"-rollup membership) as the headline chart so the two views agree.
  const stackedBars = useMemo<StackedBar[]>(() => {
    if (splitBy === 'none') return []
    const validKeys = new Set(groupedBars.map((b) => b.key))
    const byKey = new Map<string, StackedBar>()
    for (const b of groupedBars) byKey.set(b.key, { key: b.key, label: b.label, total: 0, segments: {} })
    const other = byKey.get('__other')
    for (const i of issues) {
      const sk = splitMeta(i).key
      const w = weight(i, measure)
      if (w <= 0) continue
      for (const pk of primaryKeys(i)) {
        // Rows that fell into the topN "Other" rollup accumulate there instead.
        const bar = validKeys.has(pk) ? byKey.get(pk) : other
        if (!bar) continue
        bar.total += w
        bar.segments[sk] = (bar.segments[sk] ?? 0) + w
      }
    }
    return groupedBars.map((b) => byKey.get(b.key)!).filter(Boolean)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, groupedBars, splitBy, measure])

  function exportCsv() {
    const teamPart = teamFilter === 'all' ? 'all-teams' : (data.teams.find((t) => t.id === teamFilter)?.key ?? 'team')
    const filename = `insights-${groupBy}-${measure}-${teamPart}-${range}.csv`
    downloadCsv(filename, grouped.label, groupedBars, measure === 'points' ? 'Points' : 'Count')
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Insights"
        right={
          <div className="flex items-center gap-2">
            {/* Time-range filter — filters source issues by createdAt. */}
            <SelectMenu
              align="end"
              width={180}
              options={RANGES.map((r) => ({ id: r.id, label: r.label, selected: r.id === range }))}
              onSelect={(id) => setRange(id as RangeId)}
              trigger={
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-fg hover:bg-bg-hover">
                  {rangeMeta.label}
                  <ChevronDown size={13} className="text-muted" />
                </span>
              }
            />

            {/* Custom range — explicit start/end DatePickers shown only when the
                'custom' range is active; both filter the cohort by createdAt. */}
            {range === 'custom' && (
              <div className="flex items-center gap-1">
                <DatePicker
                  value={customFrom}
                  onChange={setCustomFrom}
                  align="end"
                  trigger={
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-fg hover:bg-bg-hover">
                      {customFrom ? formatDate(customFrom) : 'Start date'}
                      <ChevronDown size={13} className="text-muted" />
                    </span>
                  }
                />
                <span className="text-[12px] text-faint">–</span>
                <DatePicker
                  value={customTo}
                  onChange={setCustomTo}
                  align="end"
                  trigger={
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-fg hover:bg-bg-hover">
                      {customTo ? formatDate(customTo) : 'End date'}
                      <ChevronDown size={13} className="text-muted" />
                    </span>
                  }
                />
              </div>
            )}

            {/* Group-by dimension — re-pivots the featured breakdown chart (and
                the CSV export) across any issue attribute. */}
            <SelectMenu
              align="end"
              width={180}
              options={DIMENSIONS.map((d) => ({ id: d.id, label: d.label, selected: d.id === groupBy }))}
              onSelect={(id) => {
                setGroupBy(id as DimensionId)
                // A split can't break a dimension down by itself — clear a now-
                // conflicting split so the trigger label matches the rendered chart.
                if (id === splitBy) setSplitBy('none')
              }}
              trigger={
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-fg hover:bg-bg-hover">
                  Group by: <span className="text-muted">{grouped.label}</span>
                  <ChevronDown size={13} className="text-muted" />
                </span>
              }
            />

            {/* Split-by dimension — segments the featured bars into a stacked
                bar broken down by a secondary attribute. */}
            <SelectMenu
              align="end"
              width={180}
              options={SPLITS.filter((s) => s.id !== groupBy).map((s) => ({
                id: s.id,
                label: s.label,
                selected: s.id === splitBy,
              }))}
              onSelect={(id) => setSplitBy(id as SplitId)}
              trigger={
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-fg hover:bg-bg-hover">
                  Split by: <span className="text-muted">{SPLITS.find((s) => s.id === splitBy)?.label}</span>
                  <ChevronDown size={13} className="text-muted" />
                </span>
              }
            />

            {/* Sort the featured breakdown largest- vs. smallest-first. */}
            <div className="flex items-center gap-1 rounded-md bg-bg-secondary p-0.5">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSort(s.id)}
                  className={cn(
                    'rounded px-2 py-1 text-[12px]',
                    sort === s.id ? 'bg-bg-elevated font-medium text-fg shadow-sm' : 'text-muted hover:text-fg',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Export the active group-by breakdown as CSV. */}
            <button
              type="button"
              onClick={exportCsv}
              title={`Export ${grouped.label} breakdown as CSV`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-fg hover:bg-bg-hover"
            >
              <Download size={13} className="text-muted" />
              Export
            </button>

            {/* Measure-by toggle — re-weight every breakdown by issue count or
                estimate points, mirroring Linear's Insights "Measure by". */}
            <div className="flex items-center gap-1 rounded-md bg-bg-secondary p-0.5">
              {MEASURES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMeasure(m.id)}
                  className={cn(
                    'rounded px-2 py-1 text-[12px]',
                    measure === m.id ? 'bg-bg-elevated font-medium text-fg shadow-sm' : 'text-muted hover:text-fg',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Team filter */}
            <div className="flex items-center gap-1 rounded-md bg-bg-secondary p-0.5">
              <button
                type="button"
                onClick={() => setTeamFilter('all')}
                className={cn(
                  'rounded px-2 py-1 text-[12px]',
                  teamFilter === 'all' ? 'bg-bg-elevated font-medium text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                All teams
              </button>
              {data.teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTeamFilter(t.id)}
                  className={cn(
                    'rounded px-2 py-1 text-[12px]',
                    teamFilter === t.id ? 'bg-bg-elevated font-medium text-fg shadow-sm' : 'text-muted hover:text-fg',
                  )}
                >
                  {t.key}
                </button>
              ))}
            </div>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto bg-bg-secondary">
        <div className="mx-auto max-w-5xl px-8 py-8">
          {/* Active scope summary */}
          <div className="mb-4 text-[12px] text-muted">
            Showing <span className="font-medium text-fg">{issues.length}</span> issues
            {measure === 'points' && (
              <>
                {' · '}
                <span className="font-medium text-fg">{totals.total}</span> points
              </>
            )}
            {' · '}
            <span className="font-medium text-fg">{range === 'custom' ? rangeLabel : rangeMeta.label.toLowerCase()}</span>
            {teamFilter !== 'all' && (
              <>
                {' · '}
                <span className="font-medium text-fg">{data.teams.find((t) => t.id === teamFilter)?.name}</span>
              </>
            )}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label={measure === 'points' ? 'Total points' : 'Total issues'} value={totals.total} />
            <Stat label="Completed" value={totals.completed} hint={`${totals.rate}% completion`} />
            <Stat label="In progress" value={totals.started} />
            <Stat label="Backlog" value={totals.backlog} />
            <Stat label="Scope points" value={totals.points} hint="Excludes canceled" />
            {/* Avg. cycle time — createdAt → completedAt across completed issues. */}
            <Stat
              label="Avg. cycle time"
              value={totals.avgCycle === null ? '—' : `${totals.avgCycle.toFixed(1)}d`}
              hint={totals.avgCycle === null ? undefined : 'Created → completed'}
            />
          </div>

          {/* Created vs Completed trend — two overlaid lines over the active
              range/team cohort, bucketed by day (≤31d) or week. */}
          <div className="mt-6">
            <Card title="Created vs Completed" subtitle="Issues opened and closed over the selected range">
              <TimeSeriesChart points={timeSeries} />
            </Card>
          </div>

          {/* Featured breakdown — driven by the "Group by" selector + sort, and
              optionally segmented into a stacked bar by the "Split by" dimension. */}
          <div className="mt-4">
            {splitBy !== 'none' && splitBy !== groupBy ? (
              <Card
                title={`By ${grouped.label.toLowerCase()}`}
                subtitle={`${measure === 'points' ? 'Points' : 'Issues'} grouped by ${grouped.label.toLowerCase()}, split by ${SPLITS.find((s) => s.id === splitBy)?.label.toLowerCase()} · ${sort === 'asc' ? 'smallest' : 'largest'} first`}
              >
                <StackedBarChart bars={stackedBars} series={splitSeries} max={maxOf(groupedBars)} />
                <Legend series={splitSeries} />
              </Card>
            ) : (
              <Card
                title={`By ${grouped.label.toLowerCase()}`}
                subtitle={`${measure === 'points' ? 'Points' : 'Issues'} grouped by ${grouped.label.toLowerCase()} · ${sort === 'asc' ? 'smallest' : 'largest'} first`}
              >
                <BarChart bars={groupedBars} max={maxOf(groupedBars)} />
              </Card>
            )}
          </div>

          {/* Breakdown charts. The card matching the active "Group by" dimension
              is omitted here — the featured chart above already shows it (with the
              chosen sort), so we never render the same breakdown twice. */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {groupBy !== 'status' && (
              <Card title="By status" subtitle="Issues in each workflow state">
                <BarChart bars={byStatus} max={maxOf(byStatus)} />
              </Card>
            )}
            {groupBy !== 'priority' && (
              <Card title="By priority" subtitle="Distribution across priority levels">
                <BarChart bars={byPriority} max={maxOf(byPriority)} />
              </Card>
            )}
            {groupBy !== 'assignee' && (
              <Card title="By assignee" subtitle="Top assignees by open + closed work">
                <BarChart bars={byAssignee} max={maxOf(byAssignee)} />
              </Card>
            )}
            {groupBy !== 'project' && (
              <Card title="By project" subtitle="Where the work lives">
                <BarChart bars={byProject} max={maxOf(byProject)} />
              </Card>
            )}
            {groupBy !== 'label' && (
              <Card title="By label" subtitle="Most-used labels">
                <BarChart bars={byLabel} max={maxOf(byLabel)} />
              </Card>
            )}
            <Card title="Progress" subtitle="Share of work completed">
              <div className="flex flex-col items-center justify-center py-2">
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-bg-tertiary">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all"
                    style={{ width: `${totals.rate}%` }}
                  />
                </div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight text-fg tabular-nums">
                  {totals.rate}%
                </div>
                <div className="text-[12px] text-muted">
                  {totals.completed} of {totals.total} {measure === 'points' ? 'points' : 'issues'} completed
                </div>
              </div>
            </Card>
            <UtilizationChart />
          </div>
        </div>
      </div>
    </div>
  )
}
