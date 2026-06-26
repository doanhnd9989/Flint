import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { useStore } from '@/lib/store'
import {
  cycleBurndown,
  cycleProgress,
  cycleState,
  groupIssues,
  sortIssues,
} from '@/lib/selectors'
import type { GroupBy } from '@/lib/types'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { CycleBurndown } from '@/components/CycleBurndown'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, CycleIllustration } from '@/components/EmptyState'
import { Avatar } from '@/components/Avatar'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-[var(--status-started)]/20 text-[var(--status-started)]',
  upcoming: 'bg-accent-subtle text-accent',
  past: 'bg-bg-tertiary text-faint',
}

// Group-by options for the cycle issue list — the subset of GroupBy keys that
// make sense within a single cycle (no per-cycle grouping). Mirrors Linear's
// cycle "Group by" menu. Default is Status.
const CYCLE_GROUP_BYS = ['status', 'assignee', 'priority', 'project', 'none'] as const
const GROUP_LABEL: Record<(typeof CYCLE_GROUP_BYS)[number], string> = {
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  project: 'Project',
  none: 'No grouping',
}

export function CyclesView() {
  const { teamKey } = useParams()
  const data = useStore()
  const team = data.teams.find((t) => t.key === teamKey) ?? data.teams[0]
  const nowMs = Date.now()

  const cycles = useMemo(
    () =>
      data.cycles
        .filter((c) => c.teamId === team.id)
        .sort((a, b) => a.number - b.number),
    [data.cycles, team.id],
  )

  const activeId = useMemo(() => {
    const active = cycles.find(
      (c) => cycleState(c.startsAt, c.endsAt, nowMs).status === 'active',
    )
    return active?.id ?? cycles[cycles.length - 1]?.id
  }, [cycles, nowMs])

  const [selectedId, setSelectedId] = useState<string | undefined>(activeId)
  const current = cycles.find((c) => c.id === (selectedId ?? activeId))

  // How the cycle issue list is grouped — Status / Assignee / Priority /
  // Project / No grouping. Defaults to Status, matching Linear.
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const groupOptions = useMemo(
    () =>
      CYCLE_GROUP_BYS.map((g) => ({
        id: g,
        label: GROUP_LABEL[g],
        selected: groupBy === g,
      })),
    [groupBy],
  )

  const groups = useMemo(() => {
    if (!current) return []
    const scoped = data.issues.filter((i) => i.cycleId === current.id && !i.archivedAt)
    return groupIssues(sortIssues(scoped, 'priority', data), groupBy, data)
  }, [data, current, groupBy])

  // Cycle directory: every cycle for this team partitioned into Active /
  // Upcoming / Completed sections, each carrying its own progress so the rail
  // mirrors Linear's left-hand cycle list. Active first, then upcoming
  // (soonest first), then past (most recent first).
  const directory = useMemo(() => {
    const rows = cycles.map((c) => ({
      cycle: c,
      status: cycleState(c.startsAt, c.endsAt, nowMs).status,
      prog: cycleProgress(c.id, data.issues, data),
    }))
    const pick = (s: 'active' | 'upcoming' | 'past') =>
      rows.filter((r) => r.status === s)
    return [
      { key: 'active' as const, label: 'Active', rows: pick('active') },
      {
        key: 'upcoming' as const,
        label: 'Upcoming',
        rows: pick('upcoming').sort(
          (a, b) => a.cycle.number - b.cycle.number,
        ),
      },
      {
        key: 'past' as const,
        label: 'Completed',
        rows: pick('past').sort((a, b) => b.cycle.number - a.cycle.number),
      },
    ].filter((sec) => sec.rows.length > 0)
  }, [cycles, data, nowMs])

  // Cycle health for the active cycle: "On track" vs "At risk". Risk fires
  // when the remaining (non-completed) scope can't plausibly land in the days
  // left — more open issues than days remaining — or any open issue is already
  // past its due date. Upcoming/past/empty cycles surface no chip (null).
  const health = useMemo<'on-track' | 'at-risk' | null>(() => {
    if (!current) return null
    const cs = cycleState(current.startsAt, current.endsAt, nowMs)
    if (cs.status !== 'active') return null
    const prog = cycleProgress(current.id, data.issues, data)
    if (prog.total === 0) return null
    const open = prog.total - prog.done
    if (open === 0) return 'on-track'
    const completed = new Set(
      data.states.filter((s) => s.type === 'completed').map((s) => s.id),
    )
    const overdue = data.issues.some(
      (i) =>
        i.cycleId === current.id &&
        !i.archivedAt &&
        !completed.has(i.stateId) &&
        i.dueDate != null &&
        new Date(i.dueDate).getTime() < nowMs,
    )
    return overdue || open > cs.daysLeft ? 'at-risk' : 'on-track'
  }, [data, current, nowMs])

  // Per-assignee workload within the cycle (scope / completed / in-progress),
  // sorted by scope so the heaviest-loaded members surface first — mirrors
  // Linear's cycle "workload by assignee" breakdown.
  const workload = useMemo(() => {
    if (!current) return []
    const completed = new Set(
      data.states.filter((s) => s.type === 'completed').map((s) => s.id),
    )
    const started = new Set(
      data.states.filter((s) => s.type === 'started').map((s) => s.id),
    )
    const scoped = data.issues.filter(
      (i) => i.cycleId === current.id && !i.archivedAt,
    )
    const byUser = new Map<
      string,
      { total: number; done: number; inProgress: number }
    >()
    for (const i of scoped) {
      const key = i.assigneeId ?? '__none__'
      const row = byUser.get(key) ?? { total: 0, done: 0, inProgress: 0 }
      row.total += 1
      if (completed.has(i.stateId)) row.done += 1
      else if (started.has(i.stateId)) row.inProgress += 1
      byUser.set(key, row)
    }
    return Array.from(byUser.entries())
      .map(([key, row]) => ({
        user: key === '__none__' ? undefined : data.users.find((u) => u.id === key),
        ...row,
      }))
      .sort((a, b) => b.total - a.total || b.done - a.done)
  }, [data, current])

  if (cycles.length === 0 || !current) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title="Cycles" teamName={team.name} teamIcon={team.icon} />
        <EmptyState
          illustration={<CycleIllustration />}
          title="No cycles for this team yet"
          description="Cycles are time-boxed sprints. Enable them to plan work in regular intervals."
        />
      </div>
    )
  }

  const idx = cycles.findIndex((c) => c.id === current.id)
  const prog = cycleProgress(current.id, data.issues, data)
  const cs = cycleState(current.startsAt, current.endsAt, nowMs)
  const remaining = Math.max(0, prog.total - prog.done - prog.started)
  const burndown = cycleBurndown(current, data.issues, nowMs)

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Cycles" teamName={team.name} teamIcon={team.icon} />

      <div className="flex min-h-0 flex-1">
        {/* Cycle directory rail — all cycles grouped by lifecycle */}
        <aside className="w-60 shrink-0 overflow-y-auto border-r border-border py-2">
          {directory.map((sec) => (
            <div key={sec.key} className="mb-2">
              <div className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                {sec.label}
              </div>
              {sec.rows.map(({ cycle, status, prog }) => {
                const remaining = Math.max(0, prog.total - prog.done - prog.started)
                const selected = cycle.id === current.id
                return (
                  <button
                    key={cycle.id}
                    onClick={() => setSelectedId(cycle.id)}
                    className={cn(
                      'flex w-full flex-col gap-1.5 px-3 py-2 text-left hover:bg-bg-hover',
                      selected && 'bg-secondary',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'truncate text-[13px]',
                          selected
                            ? 'font-medium text-fg'
                            : status === 'past'
                              ? 'text-faint'
                              : 'text-fg',
                        )}
                      >
                        Cycle {cycle.number}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] tabular-nums text-faint">
                        {prog.percent}%
                      </span>
                    </div>
                    <div className="flex h-1 w-full overflow-hidden rounded-full bg-bg-tertiary">
                      <div
                        className="h-full bg-accent"
                        style={{
                          width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%`,
                        }}
                      />
                      <div
                        className="h-full bg-[var(--status-started)]"
                        style={{
                          width: `${prog.total ? (prog.started / prog.total) * 100 : 0}%`,
                        }}
                      />
                      <div
                        className="h-full"
                        style={{
                          width: `${prog.total ? (remaining / prog.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-faint">
                      {formatDate(cycle.startsAt)} – {formatDate(cycle.endsAt)}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </aside>

        {/* Selected-cycle detail */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Cycle selector + summary */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            disabled={idx <= 0}
            onClick={() => setSelectedId(cycles[idx - 1].id)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-semibold text-fg">
                Cycle {current.number}
              </h1>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                  STATUS_BADGE[cs.status],
                )}
              >
                {cs.status}
              </span>
              {health && (
                <span
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    health === 'on-track'
                      ? 'bg-[var(--c-green)]/15 text-[var(--c-green)]'
                      : 'bg-[var(--c-orange)]/15 text-[var(--c-orange)]',
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        health === 'on-track'
                          ? 'var(--c-green)'
                          : 'var(--c-orange)',
                    }}
                  />
                  {health === 'on-track' ? 'On track' : 'At risk'}
                </span>
              )}
            </div>
            <div className="text-[12px] text-faint">
              {formatDate(current.startsAt)} – {formatDate(current.endsAt)}
              {cs.status === 'active' && ` · ${cs.daysLeft} days left`}
            </div>
          </div>
          <button
            disabled={idx >= cycles.length - 1}
            onClick={() => setSelectedId(cycles[idx + 1].id)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>

          <div className="ml-auto flex items-center gap-5 text-[12px]">
            <Stat label="Scope" value={prog.total} />
            <Stat label="Started" value={prog.started} />
            <Stat label="Completed" value={prog.done} />
            <Stat label="Progress" value={`${prog.percent}%`} />
          </div>
        </div>

        {/* Stacked progress bar (completed / started / remaining) */}
        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
          <div
            className="h-full bg-accent"
            style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }}
            title={`${prog.done} completed`}
          />
          <div
            className="h-full bg-[var(--status-started)]"
            style={{ width: `${prog.total ? (prog.started / prog.total) * 100 : 0}%` }}
            title={`${prog.started} started`}
          />
          <div
            className="h-full"
            style={{ width: `${prog.total ? (remaining / prog.total) * 100 : 0}%` }}
          />
        </div>

        {/* Burndown chart */}
        {burndown.scope > 0 && (
          <div className="mt-5">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
              Burndown
            </div>
            <CycleBurndown
              points={burndown.points}
              scope={burndown.scope}
              nowMs={nowMs}
            />
          </div>
        )}

        {/* Workload by assignee */}
        {workload.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
              Workload by assignee
            </div>
            <div className="flex flex-col gap-2">
              {workload.map((w, n) => (
                <div
                  key={w.user?.id ?? `none-${n}`}
                  className="flex items-center gap-3"
                >
                  <div className="flex w-40 shrink-0 items-center gap-2">
                    <Avatar user={w.user} size={18} />
                    <span className="truncate text-[12px] text-fg">
                      {w.user?.name ?? 'No assignee'}
                    </span>
                  </div>
                  <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${(w.done / w.total) * 100}%` }}
                      title={`${w.done} completed`}
                    />
                    <div
                      className="h-full bg-[var(--status-started)]"
                      style={{ width: `${(w.inProgress / w.total) * 100}%` }}
                      title={`${w.inProgress} in progress`}
                    />
                  </div>
                  <div className="w-20 shrink-0 text-right text-[11px] tabular-nums text-faint">
                    {w.done}/{w.total} done
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

          {/* Issue-list toolbar — group-by picker for the cycle's issues. */}
          <div className="flex items-center justify-end border-b border-border px-6 py-2">
            <SelectMenu
              width={180}
              align="end"
              options={groupOptions}
              onSelect={(id) => setGroupBy(id as GroupBy)}
              placeholder="Group by…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-secondary px-2 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg">
                  <span className="text-faint">Group:</span>
                  <span className="max-w-[100px] truncate">
                    {GROUP_LABEL[groupBy as (typeof CYCLE_GROUP_BYS)[number]]}
                  </span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
          </div>

          <GroupedIssueList groups={groups} groupBy={groupBy} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <div className="text-[15px] font-semibold text-fg">{value}</div>
      <div className="text-[11px] text-faint">{label}</div>
    </div>
  )
}
