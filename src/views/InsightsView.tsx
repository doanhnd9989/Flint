import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/constants'
import { displayName } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Issue, WorkflowState } from '@/lib/types'

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
  const displayPref = data.preferences.displayNames

  const issues = useMemo<Issue[]>(
    () =>
      data.issues.filter(
        (i) => !i.archivedAt && (teamFilter === 'all' || i.teamId === teamFilter),
      ),
    [data.issues, teamFilter],
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
  }, [issues, stateById])

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

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Insights"
        right={
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
        }
      />
      <div className="flex-1 overflow-y-auto bg-bg-secondary">
        <div className="mx-auto max-w-5xl px-8 py-8">
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
