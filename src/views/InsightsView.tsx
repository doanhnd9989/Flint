import { useMemo, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/constants'
import { displayName } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Issue, WorkflowState } from '@/lib/types'

/** Time ranges for the Insights header — filter source issues by createdAt. */
const RANGES = [
  { id: 'all', label: 'All time', days: 0 },
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
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
function downloadCsv(filename: string, dimensionLabel: string, bars: Bar[]) {
  const rows = [
    [dimensionLabel, 'Count'],
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
  return (
    <div className="space-y-2.5">
      {bars.map((b) => (
        <div key={b.key} className="group flex items-center gap-3">
          <div className="flex w-28 shrink-0 items-center gap-1.5" title={b.label}>
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: b.color }}
            />
            <span className="truncate text-[12px] text-muted group-hover:text-fg">{b.label}</span>
          </div>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{ width: `${max > 0 ? (b.value / max) * 100 : 0}%`, backgroundColor: b.color }}
            />
          </div>
          <div className="w-7 shrink-0 text-right text-[12px] tabular-nums text-fg">{b.value}</div>
        </div>
      ))}
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
                segment then takes its share of that bar's own width. */}
            <div className="flex h-full" style={{ width: `${max > 0 ? (b.total / max) * 100 : 0}%` }}>
              {series.map((s) => {
                const v = b.segments[s.key] ?? 0
                if (v <= 0) return null
                return (
                  <div
                    key={s.key}
                    title={`${s.label}: ${v}`}
                    style={{ width: `${b.total > 0 ? (v / b.total) * 100 : 0}%`, backgroundColor: s.color }}
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

  // Cutoff timestamp for the active range; null means "all time".
  const cutoff = useMemo(
    () => (rangeMeta.days > 0 ? Date.now() - rangeMeta.days * 86_400_000 : null),
    [rangeMeta.days],
  )

  const issues = useMemo<Issue[]>(
    () =>
      data.issues.filter(
        (i) =>
          !i.archivedAt &&
          (teamFilter === 'all' || i.teamId === teamFilter) &&
          (cutoff === null || new Date(i.createdAt).getTime() >= cutoff),
      ),
    [data.issues, teamFilter, cutoff],
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
    return { total, completed, started, backlog, unstarted, rate, points }
  }, [issues, stateById, measure])

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
        return { key: id, label, color: 'var(--accent)' }
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
    downloadCsv(filename, grouped.label, groupedBars)
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

            {/* Group-by dimension — re-pivots the featured breakdown chart (and
                the CSV export) across any issue attribute. */}
            <SelectMenu
              align="end"
              width={180}
              options={DIMENSIONS.map((d) => ({ id: d.id, label: d.label, selected: d.id === groupBy }))}
              onSelect={(id) => setGroupBy(id as DimensionId)}
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
            <span className="font-medium text-fg">{rangeMeta.label.toLowerCase()}</span>
            {teamFilter !== 'all' && (
              <>
                {' · '}
                <span className="font-medium text-fg">{data.teams.find((t) => t.id === teamFilter)?.name}</span>
              </>
            )}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label={measure === 'points' ? 'Total points' : 'Total issues'} value={totals.total} />
            <Stat label="Completed" value={totals.completed} hint={`${totals.rate}% completion`} />
            <Stat label="In progress" value={totals.started} />
            <Stat label="Backlog" value={totals.backlog} />
            <Stat label="Scope points" value={totals.points} hint="Excludes canceled" />
          </div>

          {/* Featured breakdown — driven by the "Group by" selector + sort, and
              optionally segmented into a stacked bar by the "Split by" dimension. */}
          <div className="mt-6">
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
          </div>
        </div>
      </div>
    </div>
  )
}
