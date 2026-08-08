import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cycleState } from '@/lib/selectors'
import { PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/constants'
import type { Issue, Priority } from '@/lib/types'
import { Avatar } from './Avatar'
import { StarButton } from './StarButton'
import { ProgressDonut } from './ProgressDonut'
import { CycleContextMenu } from './CycleContextMenu'
import { CycleGoals } from './CycleGoals'
import { CycleCarryOver } from './CycleCarryOver'
import { CycleDeltaMetrics } from './CycleDeltaMetrics'
import { CycleRetrospective } from './CycleRetrospective'
import { CycleScopeChart } from './CycleScopeChart'
import { CyclePauseButton } from './CyclePauseButton'
import { EstimateDistribution } from './EstimateDistribution'
import { cn, formatDate } from '@/lib/utils'

/**
 * The cycle detail right panel — Linear's shape exactly: phase + date chips,
 * the cycle title with its ⭐ and ⋯, the goal, a collapsible Progress section
 * (legend + chart) and a breakdown tab strip.
 *
 * Linear keeps the issue list as the page's main pane and puts every number in
 * here; ours used to stack the analytics above the list, so the first screenful
 * held no issues at all.
 */

const TABS = ['assignees', 'labels', 'priority', 'projects', 'teams'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = {
  assignees: 'Assignees',
  labels: 'Labels',
  priority: 'Priority',
  projects: 'Projects',
  teams: 'Teams',
}

/** One breakdown row: a bucket of the cycle's issues and how much is done. */
interface Bucket {
  key: string
  label: string
  /** A colour dot (labels, priority); assignees render an avatar instead. */
  color?: string
  userId?: string
  total: number
  done: number
}

export function CycleSidePanel({
  cycleId,
  onClose,
}: {
  cycleId: string
  onClose: () => void
}) {
  const data = useStore()
  const cycle = data.cycles.find((c) => c.id === cycleId)
  const nowMs = Date.now()

  const [tab, setTab] = useState<Tab>('assignees')
  const [progressOpen, setProgressOpen] = useState(true)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const scoped = useMemo(
    () => data.issues.filter((i) => i.cycleId === cycleId && !i.archivedAt),
    [data.issues, cycleId],
  )

  // completed / started state ids, resolved once for every tally below.
  const { doneIds, startedIds } = useMemo(() => {
    const doneIds = new Set(
      data.states.filter((s) => s.type === 'completed').map((s) => s.id),
    )
    const startedIds = new Set(
      data.states.filter((s) => s.type === 'started').map((s) => s.id),
    )
    return { doneIds, startedIds }
  }, [data.states])

  const totals = useMemo(() => {
    const total = scoped.length
    const done = scoped.filter((i) => doneIds.has(i.stateId)).length
    const started = scoped.filter((i) => startedIds.has(i.stateId)).length
    // Linear's "+N%" beside Scope is how much the cycle grew after it began.
    // We don't record when an issue was *added to the cycle*, so the issue's
    // own createdAt stands in for it — an approximation, and the delta is only
    // shown when there was a baseline to grow from.
    const startMs = cycle ? new Date(cycle.startsAt).getTime() : 0
    const baseline = scoped.filter(
      (i) => new Date(i.createdAt).getTime() < startMs,
    ).length
    const growth =
      baseline > 0 ? Math.round(((total - baseline) / baseline) * 100) : null
    return { total, done, started, growth }
  }, [scoped, doneIds, startedIds, cycle])

  const buckets = useMemo<Bucket[]>(() => {
    const tally = (
      key: (i: Issue) => string[],
      meta: (k: string) => Omit<Bucket, 'total' | 'done' | 'key'>,
    ) => {
      const map = new Map<string, { total: number; done: number }>()
      for (const i of scoped) {
        for (const k of key(i)) {
          const row = map.get(k) ?? { total: 0, done: 0 }
          row.total += 1
          if (doneIds.has(i.stateId)) row.done += 1
          map.set(k, row)
        }
      }
      return [...map.entries()].map(([k, v]) => ({ key: k, ...meta(k), ...v }))
    }

    if (tab === 'assignees')
      return tally(
        (i) => [i.assigneeId ?? '__none__'],
        (k) => ({
          label:
            k === '__none__'
              ? 'No assignee'
              : (data.users.find((u) => u.id === k)?.name ?? 'Unknown'),
          userId: k === '__none__' ? undefined : k,
        }),
      ).sort((a, b) => b.total - a.total)

    if (tab === 'labels')
      return tally(
        (i) => i.labelIds,
        (k) => {
          const l = data.labels.find((x) => x.id === k)
          return { label: l?.name ?? 'Unknown', color: l?.color }
        },
      ).sort((a, b) => b.total - a.total)

    if (tab === 'projects')
      return tally(
        (i) => [i.projectId ?? '__none__'],
        (k) => ({
          label:
            k === '__none__'
              ? 'No project'
              : (data.projects.find((p) => p.id === k)?.name ?? 'Unknown'),
        }),
      ).sort((a, b) => b.total - a.total)

    if (tab === 'teams')
      return tally(
        (i) => [i.teamId],
        (k) => ({ label: data.teams.find((t) => t.id === k)?.name ?? 'Unknown' }),
      ).sort((a, b) => b.total - a.total)

    // Priority keeps Linear's fixed order — No priority first, then Urgent
    // down to Low — rather than sorting by volume, and drops empty buckets.
    const rows = tally(
      (i) => [String(i.priority)],
      (k) => ({ label: PRIORITY_LABELS[Number(k) as Priority] }),
    )
    const order = [0, ...PRIORITY_ORDER.filter((p) => p !== 0)]
    return rows.sort(
      (a, b) => order.indexOf(Number(a.key)) - order.indexOf(Number(b.key)),
    )
  }, [tab, scoped, doneIds, data.users, data.labels, data.projects, data.teams])

  if (!cycle) return null
  const cs = cycleState(cycle.startsAt, cycle.endsAt, nowMs)
  const phase =
    cs.status === 'active'
      ? 'Current'
      : cs.status === 'upcoming'
        ? 'Upcoming'
        : 'Completed'

  const pct = (n: number) => (totals.total ? Math.round((n / totals.total) * 100) : 0)

  return (
    <aside className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-border">
      <div className="flex flex-col gap-3 p-4">
        {/* Phase + date-range chips */}
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[12px] text-fg">
            {phase}
          </span>
          <span className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[12px] text-muted">
            {formatDate(cycle.startsAt)}
            <span className="text-faint">→</span>
            {formatDate(cycle.endsAt)}
          </span>
        </div>

        {/* Title row */}
        <div className="flex items-center gap-2">
          <ProgressDonut percent={pct(totals.done)} size={15} />
          <h2 className="truncate text-[15px] font-semibold text-fg">
            {cycle.name ?? `Cycle ${cycle.number}`}
          </h2>
          <div className="ml-auto flex items-center gap-0.5">
            <StarButton type="cycle" id={cycle.id} size={14} />
            <button
              type="button"
              aria-label="Open menu"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                setMenu({ x: r.right - 220, y: r.bottom + 4 })
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-bg-hover hover:text-fg"
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>

        {/* Linear shows the cycle description here; ours is the cycle goal. */}
        <CycleGoals cycleId={cycle.id} />
      </div>

      {/* Progress — collapsible, exactly as Linear's section is */}
      <div className="px-4 pb-4">
        <button
          type="button"
          aria-label={
            progressOpen ? 'Collapse progress section' : 'Expand progress section'
          }
          onClick={() => setProgressOpen((v) => !v)}
          className="flex items-center gap-1 text-[13px] font-medium text-fg"
        >
          Progress
          {progressOpen ? (
            <ChevronDown size={13} className="text-faint" />
          ) : (
            <ChevronRight size={13} className="text-faint" />
          )}
        </button>

        {progressOpen && (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {/* Linear prints the scope delta as `+87%` and the other two as
                  `•63%`; a cycle that hasn't grown shows no delta at all. */}
              <Legend
                swatch="var(--border-strong)"
                label="Scope"
                value={totals.total}
                delta={totals.growth ? `+${totals.growth}%` : undefined}
                deltaWarn
              />
              <Legend
                swatch="var(--status-started)"
                label="Started"
                value={totals.started}
                delta={`•${pct(totals.started)}%`}
              />
              <Legend
                swatch="var(--accent)"
                label="Completed"
                value={totals.done}
                delta={`•${pct(totals.done)}%`}
              />
            </div>
            <ScopeChart
              cycle={cycle}
              issues={scoped}
              doneIds={doneIds}
              nowMs={nowMs}
            />
          </>
        )}
      </div>

      {/* Breakdown tabs */}
      <div className="flex flex-wrap gap-1 px-4">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[12px]',
              tab === t
                ? 'border-border-strong bg-secondary font-medium text-fg'
                : 'border-transparent text-muted hover:bg-bg-hover hover:text-fg',
            )}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="flex flex-col px-2 py-2">
        {buckets.length === 0 ? (
          <div className="px-2 py-3 text-[12px] text-faint">No issues yet</div>
        ) : (
          buckets.map((b) => {
            const p = b.total ? Math.round((b.done / b.total) * 100) : 0
            return (
              <div
                key={b.key}
                className="flex items-center gap-2 rounded px-2 py-1.5"
              >
                {b.userId !== undefined || b.label === 'No assignee' ? (
                  <Avatar
                    user={data.users.find((u) => u.id === b.userId)}
                    size={16}
                  />
                ) : b.color ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: b.color }}
                  />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-bg-tertiary" />
                )}
                <span className="truncate text-[13px] text-fg">{b.label}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[12px] text-faint">
                  <ProgressDonut percent={p} size={12} />
                  {p}% of <span className="tabular-nums text-fg">{b.total}</span>
                </span>
              </div>
            )
          })
        )}
      </div>

      {/*
        Analytics Linear has no counterpart for. They used to be stacked above
        the issue list, which is why the page opened on charts instead of work;
        they keep working, just below the breakdown where Linear's panel ends.
      */}
      <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <CyclePauseButton cycleId={cycle.id} />
          <CycleCarryOver cycleId={cycle.id} />
        </div>
        <CycleDeltaMetrics cycleId={cycle.id} />
        <CycleScopeChart issues={scoped} />
        <EstimateDistribution issues={scoped} />
        {cs.status === 'past' && <CycleRetrospective cycleId={cycle.id} />}
      </div>

      {menu && (
        <CycleContextMenu
          cycleId={cycle.id}
          x={menu.x}
          y={menu.y}
          nowMs={nowMs}
          onClose={() => setMenu(null)}
        />
      )}
      {/* Keeps the toggle reachable from inside the panel too. */}
      <button type="button" onClick={onClose} className="sr-only">
        Close cycle details
      </button>
    </aside>
  )
}

function Legend({
  swatch,
  label,
  value,
  delta,
  deltaWarn,
}: {
  swatch: string
  label: string
  value: number
  delta?: string
  deltaWarn?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: swatch }}
        />
        <span className="text-[12px] text-muted">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[13px] font-medium tabular-nums text-fg">{value}</span>
        {delta && (
          <span
            className={cn(
              'text-[11px] tabular-nums',
              deltaWarn ? 'text-[var(--c-orange)]' : 'text-faint',
            )}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * The panel's compact progress chart: cumulative scope against cumulative
 * completions, with the ideal line as a dashed guide.
 *
 * Linear also draws a *started* series. We have no `startedAt` on an issue, so
 * there is no honest per-day history to plot — the started count lives in the
 * legend only rather than being invented here.
 */
function ScopeChart({
  cycle,
  issues,
  doneIds,
  nowMs,
}: {
  cycle: { startsAt: string; endsAt: string }
  issues: Issue[]
  doneIds: Set<string>
  nowMs: number
}) {
  const W = 300
  const H = 110
  const padB = 16
  // Without a top inset a flat-at-max scope line lands on y=0 and half its
  // stroke is clipped away by the viewBox — it reads as "no chart at all".
  const padT = 6

  const series = useMemo(() => {
    const dayMs = 86_400_000
    const startOfDay = (ms: number) => {
      const d = new Date(ms)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }
    const start = startOfDay(new Date(cycle.startsAt).getTime())
    const end = startOfDay(new Date(cycle.endsAt).getTime())
    const days = Math.max(1, Math.round((end - start) / dayMs))
    const added = issues.map((i) => new Date(i.createdAt).getTime())
    const done = issues
      .filter((i) => doneIds.has(i.stateId) && i.completedAt)
      .map((i) => new Date(i.completedAt as string).getTime())
    const out: { scope: number; done: number; future: boolean }[] = []
    for (let d = 0; d <= days; d++) {
      const dayEnd = start + (d + 1) * dayMs
      out.push({
        scope: added.filter((t) => t < dayEnd).length,
        done: done.filter((t) => t < dayEnd).length,
        future: start + d * dayMs > nowMs,
      })
    }
    return { out, days, start, end }
  }, [cycle.startsAt, cycle.endsAt, issues, doneIds, nowMs])

  const max = Math.max(1, ...series.out.map((p) => p.scope))
  const x = (d: number) => (d / series.days) * W
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / max)
  const path = (pick: (p: (typeof series.out)[number]) => number, live: boolean) =>
    series.out
      .filter((p) => (live ? !p.future : true))
      .map((p, d) => `${d === 0 ? 'M' : 'L'}${x(d).toFixed(1)},${y(pick(p)).toFixed(1)}`)
      .join(' ')

  const mid = Math.round(series.days / 2)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-3 w-full"
      role="img"
      aria-label="Cycle progress chart"
    >
      {/* ideal: 0 → full scope across the cycle */}
      <line
        x1={0}
        y1={y(0)}
        x2={W}
        y2={y(max)}
        stroke="var(--accent)"
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path((p) => p.scope, false)}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path((p) => p.done, true)}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <text x={0} y={H - 3} fontSize={9} fill="var(--text-tertiary)">
        {formatDate(new Date(series.start).toISOString())}
      </text>
      <text
        x={W / 2}
        y={H - 3}
        textAnchor="middle"
        fontSize={9}
        fill="var(--text-tertiary)"
      >
        {formatDate(new Date(series.start + mid * 86_400_000).toISOString())}
      </text>
      <text x={W} y={H - 3} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">
        {formatDate(new Date(series.end).toISOString())}
      </text>
    </svg>
  )
}
