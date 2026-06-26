import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, IssuesIllustration } from '@/components/EmptyState'
import { Avatar } from '@/components/Avatar'
import { StatusIcon } from '@/components/StatusIcon'
import { PriorityIcon } from '@/components/PriorityIcon'
import { cycleProgress, cycleState, projectProgress } from '@/lib/selectors'
import type { Issue, UserRole, WorkflowState } from '@/lib/types'

/** Capitalised role chip (Admin / Member / Guest) — mirrors MembersDirectory. */
function RoleChip({ role }: { role: UserRole }) {
  return (
    <span className="rounded border border-border px-1.5 py-px text-[10px] font-medium capitalize text-faint">
      {role}
    </span>
  )
}

/** A dashboard card shell — mirrors InsightsView's Card. */
function Card({
  title,
  subtitle,
  onClick,
  children,
}: {
  title: string
  subtitle?: string
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <section
      onClick={onClick}
      className={
        'rounded-xl border border-border bg-bg p-5' +
        (onClick ? ' cursor-pointer hover:border-border-strong' : '')
      }
    >
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-fg">{title}</h2>
        {subtitle && <span className="text-[12px] text-muted">{subtitle}</span>}
      </div>
      {children}
    </section>
  )
}

/** A summary stat tile — mirrors InsightsView's Stat. */
function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-4 py-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-tight text-fg tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  )
}

/** Team home dashboard — Linear's per-team Overview page. */
export function TeamOverviewView() {
  const { teamKey } = useParams()
  const navigate = useNavigate()
  const data = useStore()
  const display = useDisplayName()

  const team = data.teams.find((t) => t.key === teamKey)

  // Issues belonging to this team, excluding triage (matches Linear's "Issues").
  const issues = useMemo<Issue[]>(
    () =>
      team
        ? data.issues.filter((i) => i.teamId === team.id && !i.triage && !i.archivedAt)
        : [],
    [data.issues, team],
  )

  const stateById = useMemo(() => {
    const m = new Map<string, WorkflowState>()
    data.states.forEach((s) => m.set(s.id, s))
    return m
  }, [data.states])

  // Stat row: total / completed / started / backlog.
  const totals = useMemo(() => {
    let completed = 0
    let started = 0
    let backlog = 0
    for (const i of issues) {
      const t = stateById.get(i.stateId)?.type
      if (t === 'completed') completed++
      else if (t === 'started') started++
      else if (t === 'backlog') backlog++
    }
    const total = issues.length
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, started, backlog, rate }
  }, [issues, stateById])

  // Status breakdown bars (workflow position order; own color).
  const byStatus = useMemo(() => {
    const order = [...data.states].sort((a, b) => a.position - b.position)
    const bars = order
      .map((s) => ({
        key: s.id,
        label: s.name,
        value: issues.filter((i) => i.stateId === s.id).length,
        color: s.color,
      }))
      .filter((b) => b.value > 0)
    const max = bars.reduce((m, b) => Math.max(m, b.value), 0)
    return { bars, max }
  }, [issues, data.states])

  // Active cycle for this team.
  const activeCycle = useMemo(() => {
    if (!team) return undefined
    const now = Date.now()
    return data.cycles.find(
      (c) => c.teamId === team.id && cycleState(c.startsAt, c.endsAt, now).status === 'active',
    )
  }, [data.cycles, team])

  const cycleProg = useMemo(
    () => (activeCycle ? cycleProgress(activeCycle.id, data.issues, data) : null),
    [activeCycle, data],
  )

  // Members of the team.
  const members = useMemo(
    () => (team ? team.memberIds.map((id) => data.users.find((u) => u.id === id)).filter((u): u is NonNullable<typeof u> => !!u) : []),
    [team, data.users],
  )

  // Workload breakdown — active (non-done) issues per member, like Linear's
  // team overview. Counts issues whose state isn't completed/canceled, sorted
  // by load descending, with an Unassigned bucket appended.
  const workload = useMemo(() => {
    const counts = new Map<string, number>()
    let unassigned = 0
    for (const i of issues) {
      const t = stateById.get(i.stateId)?.type
      if (t === 'completed' || t === 'canceled') continue
      if (i.assigneeId) counts.set(i.assigneeId, (counts.get(i.assigneeId) ?? 0) + 1)
      else unassigned++
    }
    const rows = members
      .map((u) => ({ user: u, count: counts.get(u.id) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.user.name.localeCompare(b.user.name))
    const max = rows.reduce((m, r) => Math.max(m, r.count), unassigned)
    const totalActive = rows.reduce((s, r) => s + r.count, 0) + unassigned
    return { rows, unassigned, max, totalActive, counts }
  }, [issues, members, stateById])

  // Member activity — issues each member completed in the last 7 days, used to
  // rank the roster by recent throughput (Linear surfaces a similar "activity"
  // signal on team home). Derived only, no mutations.
  const activity = useMemo(() => {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000
    const counts = new Map<string, number>()
    for (const i of issues) {
      if (!i.assigneeId || !i.completedAt) continue
      if (new Date(i.completedAt).getTime() < since) continue
      counts.set(i.assigneeId, (counts.get(i.assigneeId) ?? 0) + 1)
    }
    const max = members.reduce((m, u) => Math.max(m, counts.get(u.id) ?? 0), 0)
    return { counts, max }
  }, [issues, members])

  // Member roster — sorted by last-7-days activity (desc), then alphabetical,
  // each with their live active-issue count and recent completion count.
  const roster = useMemo(() => {
    return [...members]
      .map((u) => ({
        user: u,
        active: workload.counts.get(u.id) ?? 0,
        done7d: activity.counts.get(u.id) ?? 0,
      }))
      .sort((a, b) => b.done7d - a.done7d || a.user.name.localeCompare(b.user.name))
  }, [members, workload.counts, activity.counts])

  // Projects that include this team.
  const projects = useMemo(
    () => (team ? data.projects.filter((p) => p.teamIds.includes(team.id)) : []),
    [team, data.projects],
  )

  // 5 most recently updated team issues.
  const recent = useMemo(
    () => [...issues].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    [issues],
  )

  if (!team) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title="Overview" />
        <EmptyState
          illustration={<IssuesIllustration />}
          title="Team not found"
          description="This team may have been renamed or removed."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Overview" teamName={team.name} teamIcon={team.icon} />

      <div className="flex-1 overflow-y-auto bg-bg-secondary">
        <div className="mx-auto max-w-5xl px-8 py-8">
          {/* Stat row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total issues" value={totals.total} hint={`${totals.rate}% completed`} />
            <Stat label="Completed" value={totals.completed} />
            <Stat label="In progress" value={totals.started} />
            <Stat label="Backlog" value={totals.backlog} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Active cycle */}
            <Card
              title="Active cycle"
              onClick={() => navigate(`/team/${team.key}/cycles`)}
            >
              {activeCycle && cycleProg ? (
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-medium text-fg">
                      {activeCycle.name ?? `Cycle ${activeCycle.number}`}
                    </span>
                    <span className="text-[12px] tabular-nums text-muted">
                      {cycleProg.done}/{cycleProg.total} · {cycleProg.percent}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${cycleProg.percent}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="py-2 text-[12px] text-muted">No active cycle</div>
              )}
            </Card>

            {/* Status breakdown */}
            <Card title="Status breakdown" subtitle="By workflow state">
              {byStatus.bars.length === 0 ? (
                <div className="px-1 py-6 text-center text-[12px] text-faint">No issues</div>
              ) : (
                <div className="space-y-2.5">
                  {byStatus.bars.map((b) => (
                    <div key={b.key} className="group flex items-center gap-3">
                      <div className="flex w-24 shrink-0 items-center gap-1.5" title={b.label}>
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: b.color }}
                        />
                        <span className="truncate text-[12px] text-muted group-hover:text-fg">
                          {b.label}
                        </span>
                      </div>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all"
                          style={{
                            width: `${byStatus.max > 0 ? (b.value / byStatus.max) * 100 : 0}%`,
                            backgroundColor: b.color,
                          }}
                        />
                      </div>
                      <div className="w-7 shrink-0 text-right text-[12px] tabular-nums text-fg">
                        {b.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Workload — active issues per member */}
            <Card
              title="Workload"
              subtitle={workload.totalActive > 0 ? `${workload.totalActive} active` : undefined}
            >
              {members.length === 0 ? (
                <div className="py-2 text-[12px] text-muted">No members</div>
              ) : (
                <div className="-mx-2 space-y-0.5">
                  {workload.rows.map(({ user, count }) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => navigate(`/team/${team.key}/active`)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-bg-hover"
                    >
                      <Avatar user={user} size={20} />
                      <span className="flex-1 truncate text-[12px] text-fg">{display(user.name)}</span>
                      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-bg-tertiary">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${workload.max > 0 ? (count / workload.max) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-faint">
                        {count}
                      </span>
                    </button>
                  ))}
                  {workload.unassigned > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate(`/team/${team.key}/active`)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-bg-hover"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-faint">
                        ?
                      </span>
                      <span className="flex-1 truncate text-[12px] text-muted">Unassigned</span>
                      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-bg-tertiary">
                        <div
                          className="h-full rounded-full bg-border-strong"
                          style={{
                            width: `${workload.max > 0 ? (workload.unassigned / workload.max) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-faint">
                        {workload.unassigned}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </Card>

            {/* Projects */}
            <Card title="Projects" subtitle={`${projects.length}`}>
              {projects.length === 0 ? (
                <div className="py-2 text-[12px] text-muted">No projects</div>
              ) : (
                <div className="-mx-2 space-y-0.5">
                  {projects.map((p) => {
                    const prog = projectProgress(p.id, data.issues, data)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => navigate(`/project/${p.id}`)}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-bg-hover"
                      >
                        <span className="text-[14px] leading-none" style={{ color: p.color }}>
                          {p.icon}
                        </span>
                        <span className="flex-1 truncate text-[13px] text-fg">{p.name}</span>
                        <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-bg-tertiary">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${prog.percent}%` }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-faint">
                          {prog.percent}%
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Members — roster ranked by last-7-days completion activity */}
            <Card
              title="Members"
              subtitle="Activity · 7d"
              onClick={() => navigate('/members')}
            >
              {members.length === 0 ? (
                <div className="py-2 text-[12px] text-muted">No members</div>
              ) : (
                <div className="-mx-2 space-y-0.5">
                  {roster.map(({ user, active, done7d }) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
                      title={`${active} active · ${done7d} completed in last 7 days`}
                    >
                      <Avatar user={user} size={20} />
                      <span className="flex-1 truncate text-[13px] text-fg">
                        {display(user.name)}
                      </span>
                      <RoleChip role={user.role} />
                      {/* Last-7-days activity: 5-cell mini bar + count */}
                      <div className="flex shrink-0 items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, idx) => {
                          // Fill cells proportional to this member's share of the
                          // busiest member's recent throughput.
                          const filled =
                            activity.max > 0 &&
                            idx < Math.round((done7d / activity.max) * 5)
                          return (
                            <span
                              key={idx}
                              className={
                                'h-3 w-1 rounded-sm ' +
                                (filled ? 'bg-accent' : 'bg-bg-tertiary')
                              }
                            />
                          )
                        })}
                      </div>
                      <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-faint">
                        {done7d}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Recent issues — full width */}
          <div className="mt-4">
            <Card title="Recent issues" subtitle="Recently updated">
              {recent.length === 0 ? (
                <div className="py-2 text-[12px] text-muted">No issues</div>
              ) : (
                <div className="-mx-2 space-y-0.5">
                  {recent.map((i) => {
                    const st = stateById.get(i.stateId)
                    return (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => navigate(`/issue/${i.identifier}`)}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-bg-hover"
                      >
                        <PriorityIcon priority={i.priority} size={14} />
                        {st && <StatusIcon type={st.type} color={st.color} size={14} />}
                        <span className="shrink-0 text-[12px] tabular-nums text-faint">
                          {i.identifier}
                        </span>
                        <span className="flex-1 truncate text-[13px] text-fg">{i.title}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
