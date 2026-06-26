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

/** Exportable breakdown dimensions, mirroring the cards below. */
const DIMENSIONS = [
  { id: 'status', label: 'By status' },
  { id: 'priority', label: 'By priority' },
  { id: 'assignee', label: 'By assignee' },
  { id: 'project', label: 'By project' },
  { id: 'label', label: 'By label' },
] as const
type DimensionId = (typeof DIMENSIONS)[number]['id']

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
  const [exportDim, setExportDim] = useState<DimensionId>('status')
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
      // Count completion over the same range-filtered cohort as the denominator
      // (`issues`), so the completion rate stays consistent (numerator ⊆ denominator).
      if (t === 'completed') completed++
      else if (t === 'started') started++
      else if (t === 'backlog') backlog++
      else if (t === 'unstarted') unstarted++
    }
    const total = issues.length
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
    const scope = issues.filter((i) => stateById.get(i.stateId)?.type !== 'canceled')
    const points = scope.reduce((s, i) => s + (i.estimate ?? 0), 0)
    return { total, completed, started, backlog, unstarted, rate, points }
  }, [issues, stateById, cutoff])

  // ── breakdown by workflow status ───────────────────────────────────────────
  const byStatus = useMemo<Bar[]>(() => {
    const order = [...data.states].sort((a, b) => a.position - b.position)
    return order
      .map((s) => ({
        key: s.id,
        label: s.name,
        value: issues.filter((i) => i.stateId === s.id).length,
        color: s.color,
      }))
      .filter((b) => b.value > 0)
  }, [issues, data.states])

  // ── breakdown by assignee ──────────────────────────────────────────────────
  const byAssignee = useMemo<Bar[]>(() => {
    const counts = new Map<string, number>()
    for (const i of issues) counts.set(i.assigneeId ?? '__none', (counts.get(i.assigneeId ?? '__none') ?? 0) + 1)
    const bars: Bar[] = [...counts.entries()].map(([id, value]) => ({
      key: id,
      label: id === '__none' ? 'Unassigned' : displayName(data.users.find((u) => u.id === id)?.name ?? 'Unknown', displayPref),
      value,
      color: 'var(--accent)',
    }))
    bars.sort((a, b) => b.value - a.value)
    return topN(bars, 6)
  }, [issues, data.users, displayPref])

  // ── breakdown by priority ──────────────────────────────────────────────────
  const byPriority = useMemo<Bar[]>(
    () =>
      PRIORITY_ORDER.map((p) => ({
        key: String(p),
        label: PRIORITY_LABELS[p],
        value: issues.filter((i) => i.priority === p).length,
        color: PRIORITY_COLOR[p],
      })).filter((b) => b.value > 0),
    [issues],
  )

  // ── breakdown by project ───────────────────────────────────────────────────
  const byProject = useMemo<Bar[]>(() => {
    const counts = new Map<string, number>()
    for (const i of issues) counts.set(i.projectId ?? '__none', (counts.get(i.projectId ?? '__none') ?? 0) + 1)
    const bars: Bar[] = [...counts.entries()].map(([id, value]) => ({
      key: id,
      label: id === '__none' ? 'No project' : data.projects.find((p) => p.id === id)?.name ?? 'Unknown',
      value,
      color: 'var(--status-review)',
    }))
    bars.sort((a, b) => b.value - a.value)
    return topN(bars, 6)
  }, [issues, data.projects])

  // ── breakdown by label ─────────────────────────────────────────────────────
  const byLabel = useMemo<Bar[]>(() => {
    const counts = new Map<string, number>()
    for (const i of issues) for (const l of i.labelIds) counts.set(l, (counts.get(l) ?? 0) + 1)
    const bars: Bar[] = [...counts.entries()].map(([id, value]) => {
      const label = data.labels.find((l) => l.id === id)
      return { key: id, label: label?.name ?? 'Unknown', value, color: label?.color ?? 'var(--accent)' }
    })
    bars.sort((a, b) => b.value - a.value)
    return topN(bars, 6)
  }, [issues, data.labels])

  const maxOf = (bars: Bar[]) => bars.reduce((m, b) => Math.max(m, b.value), 0)

  // Map each export dimension to its computed breakdown + human label.
  const breakdowns: Record<DimensionId, { label: string; bars: Bar[] }> = {
    status: { label: 'Status', bars: byStatus },
    priority: { label: 'Priority', bars: byPriority },
    assignee: { label: 'Assignee', bars: byAssignee },
    project: { label: 'Project', bars: byProject },
    label: { label: 'Label', bars: byLabel },
  }

  function exportCsv() {
    const dim = breakdowns[exportDim]
    const teamPart = teamFilter === 'all' ? 'all-teams' : (data.teams.find((t) => t.id === teamFilter)?.key ?? 'team')
    const filename = `insights-${exportDim}-${teamPart}-${range}.csv`
    downloadCsv(filename, dim.label, dim.bars)
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

            {/* Export the selected breakdown dimension as CSV. */}
            <div className="flex items-center rounded-md border border-border bg-bg">
              <button
                type="button"
                onClick={exportCsv}
                title={`Export ${breakdowns[exportDim].label} breakdown as CSV`}
                className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-fg hover:bg-bg-hover rounded-l-md"
              >
                <Download size={13} className="text-muted" />
                Export
              </button>
              <SelectMenu
                align="end"
                width={160}
                options={DIMENSIONS.map((d) => ({ id: d.id, label: d.label, selected: d.id === exportDim }))}
                onSelect={(id) => setExportDim(id as DimensionId)}
                trigger={
                  <span className="inline-flex items-center border-l border-border px-1 py-1 text-muted hover:bg-bg-hover rounded-r-md">
                    <ChevronDown size={13} />
                  </span>
                }
              />
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
            Showing <span className="font-medium text-fg">{totals.total}</span> issues
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
            <Stat label="Total issues" value={totals.total} />
            <Stat label="Completed" value={totals.completed} hint={`${totals.rate}% completion`} />
            <Stat label="In progress" value={totals.started} />
            <Stat label="Backlog" value={totals.backlog} />
            <Stat label="Total points" value={totals.points} hint="Excludes canceled" />
          </div>

          {/* Breakdown charts */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="By status" subtitle="Issues in each workflow state">
              <BarChart bars={byStatus} max={maxOf(byStatus)} />
            </Card>
            <Card title="By priority" subtitle="Distribution across priority levels">
              <BarChart bars={byPriority} max={maxOf(byPriority)} />
            </Card>
            <Card title="By assignee" subtitle="Top assignees by open + closed work">
              <BarChart bars={byAssignee} max={maxOf(byAssignee)} />
            </Card>
            <Card title="By project" subtitle="Where the work lives">
              <BarChart bars={byProject} max={maxOf(byProject)} />
            </Card>
            <Card title="By label" subtitle="Most-used labels">
              <BarChart bars={byLabel} max={maxOf(byLabel)} />
            </Card>
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
                  {totals.completed} of {totals.total} issues completed
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
