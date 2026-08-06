import { useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Lock,
  Globe,
  Check,
  Settings,
  Ticket,
  Layers3,
  IterationCw,
  FolderKanban,
  Layers as LayersIcon,
  Plus,
  X,
} from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { TeamJoinButton } from '@/components/TeamJoinButton'
import { TeamVelocityChart } from '@/components/TeamVelocityChart'
import { EmptyState, IssuesIllustration, StackIllustration } from '@/components/EmptyState'
import { Avatar } from '@/components/Avatar'
import { StatusIcon } from '@/components/StatusIcon'
import { PriorityIcon } from '@/components/PriorityIcon'
import { EmojiPicker } from '@/components/EmojiPicker'
import { Popover } from '@/components/ui/Popover'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { cycleProgress, cycleState, projectProgress } from '@/lib/selectors'
import { PRIORITY_ORDER, PRIORITY_LABELS, LABEL_COLORS, TIMEZONES } from '@/lib/constants'
import { cn, timeAgo } from '@/lib/utils'
import type { Issue, Priority, Team, UserRole, WorkflowState } from '@/lib/types'

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

/** A labelled row in the details panel: a faint caption above a value. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">{label}</div>
      {children}
    </div>
  )
}

/**
 * Team details properties panel — Linear's at-a-glance team sidebar on the
 * overview page. Surfaces the team's identity (icon / name / key) and core
 * settings (privacy, timezone, members) with inline editing wired through the
 * existing `updateTeam` action. Icon, color and name are editable here; the
 * team key stays read-only (Linear treats it as immutable identity).
 */
function TeamDetailsPanel({ team }: { team: Team }) {
  const navigate = useNavigate()
  const data = useStore()
  const display = useDisplayName()

  // Inline name editing — buffer the draft so we only commit on blur/Enter.
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(team.name)
  const nameRef = useRef<HTMLInputElement>(null)

  const members = useMemo(
    () =>
      team.memberIds
        .map((id) => data.users.find((u) => u.id === id))
        .filter((u): u is NonNullable<typeof u> => !!u),
    [team.memberIds, data.users],
  )

  function commitName() {
    const next = draftName.trim()
    if (next && next !== team.name) data.updateTeam(team.id, { name: next })
    else setDraftName(team.name)
    setEditingName(false)
  }

  const tzLabel = team.timezone
    ? (TIMEZONES.find((t) => t.value === team.timezone)?.label ?? team.timezone)
    : 'Local time'

  // Up to 6 stacked member avatars, with a "+N" overflow chip.
  const shown = members.slice(0, 6)
  const overflow = members.length - shown.length

  return (
    <aside className="rounded-xl border border-border bg-bg p-5">
      <h2 className="mb-4 text-[13px] font-semibold text-fg">Team details</h2>

      {/* Identity — editable icon (emoji + color) and name, read-only key */}
      <div className="flex items-center gap-3">
        <Popover
          width={240}
          trigger={
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[20px] leading-none hover:bg-bg-hover"
              style={{ backgroundColor: team.color + '22' }}
              title="Change icon"
            >
              {team.icon}
            </span>
          }
        >
          {(close) => (
            <div>
              {/* Color swatches drive the icon backdrop, matching Linear */}
              <div className="mb-1 grid grid-cols-6 gap-1 px-1 pt-1">
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => data.updateTeam(team.id, { color: c })}
                    className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-bg-hover"
                    title="Set color"
                  >
                    <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c }}>
                      {team.color === c && (
                        <Check size={12} className="m-0.5 text-white" strokeWidth={3} />
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <EmojiPicker
                onPick={(emoji) => {
                  data.updateTeam(team.id, { icon: emoji })
                  close()
                }}
              />
            </div>
          )}
        </Popover>

        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              ref={nameRef}
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                else if (e.key === 'Escape') {
                  setDraftName(team.name)
                  setEditingName(false)
                }
              }}
              className="w-full rounded-md border border-accent bg-bg px-1.5 py-0.5 text-[15px] font-semibold text-fg outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftName(team.name)
                setEditingName(true)
              }}
              className="-mx-1.5 block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[15px] font-semibold text-fg hover:bg-bg-hover"
              title="Rename team"
            >
              {team.name}
            </button>
          )}
          <div className="mt-0.5 px-1.5 text-[12px] tabular-nums text-faint">{team.key}</div>
        </div>
      </div>

      {/* Properties */}
      <div className="mt-5 space-y-4">
        <DetailRow label="Privacy">
          <SelectMenu
            width={220}
            align="start"
            options={[
              { id: 'public', label: 'Public', selected: !team.private },
              { id: 'private', label: 'Private', selected: !!team.private },
            ]}
            onSelect={(id) => data.updateTeam(team.id, { private: id === 'private' })}
            trigger={
              <span className="-mx-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-fg hover:bg-bg-hover">
                {team.private ? <Lock size={13} className="text-muted" /> : <Globe size={13} className="text-muted" />}
                {team.private ? 'Private' : 'Public'}
              </span>
            }
          />
        </DetailRow>

        <DetailRow label="Timezone">
          <SelectMenu
            width={240}
            align="start"
            options={TIMEZONES.map((tz) => ({
              id: tz.value,
              label: tz.label,
              selected: team.timezone === tz.value,
            }))}
            onSelect={(id) => data.updateTeam(team.id, { timezone: id })}
            trigger={
              <span className="-mx-1.5 block truncate rounded-md px-1.5 py-1 text-left text-[13px] text-fg hover:bg-bg-hover">
                {tzLabel}
              </span>
            }
          />
        </DetailRow>

        <DetailRow label={`Members · ${members.length}`}>
          {members.length === 0 ? (
            <div className="text-[13px] text-muted">No members</div>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/members')}
              className="flex items-center gap-2 rounded-md hover:opacity-90"
              title="View all members"
            >
              <div className="flex items-center">
                {shown.map((u, i) => (
                  <span
                    key={u.id}
                    className="rounded-full ring-2 ring-bg"
                    style={{ marginLeft: i === 0 ? 0 : -6, zIndex: shown.length - i }}
                    title={display(u.name)}
                  >
                    <Avatar user={u} size={24} />
                  </span>
                ))}
                {overflow > 0 && (
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-tertiary text-[10px] font-medium text-muted ring-2 ring-bg"
                    style={{ marginLeft: -6 }}
                    title={`${overflow} more`}
                  >
                    +{overflow}
                  </span>
                )}
              </div>
            </button>
          )}
        </DetailRow>
      </div>

      {/* "Go to" — Linear's quick links into the team's surfaces. */}
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
          Go to
        </h3>
        <div className="space-y-px">
          {[
            { icon: <Settings size={14} />, label: 'Team settings', to: '/settings' },
            { icon: <Ticket size={14} />, label: 'Triage', to: `/team/${team.key}/triage` },
            { icon: <Layers3 size={14} />, label: 'Issues', to: `/team/${team.key}/active` },
            { icon: <IterationCw size={14} />, label: 'Cycles', to: `/team/${team.key}/cycles` },
            { icon: <FolderKanban size={14} />, label: 'Projects', to: `/team/${team.key}/projects` },
            { icon: <LayersIcon size={14} />, label: 'Views', to: '/views' },
          ].map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={() => navigate(row.to)}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] text-muted hover:bg-bg-hover hover:text-fg"
            >
              <span className="text-faint">{row.icon}</span>
              {row.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}

/** The team home's sub-navigation — Linear's Overview · Documents · Members. */
const TEAM_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents' },
  { id: 'members', label: 'Members' },
] as const

type TeamTab = (typeof TEAM_TABS)[number]['id']

function TeamTabs({ team, active }: { team: Team; active: TeamTab }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-1 border-b border-border px-4 py-1.5">
      {TEAM_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() =>
            navigate(t.id === 'overview' ? `/team/${team.key}/overview` : `/team/${team.key}/${t.id}`)
          }
          className={cn(
            'rounded-md px-2 py-1 text-[13px] transition-colors',
            t.id === active
              ? 'bg-bg-selected font-medium text-fg'
              : 'text-muted hover:bg-bg-hover hover:text-fg',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Team → Documents. Linear scopes documents to a team; ours are workspace-level,
 * so a doc counts as this team's when it is tagged with the team or belongs to
 * one of the team's projects.
 */
export function TeamDocumentsView() {
  const { teamKey } = useParams()
  const navigate = useNavigate()
  const data = useStore()
  const team = data.teams.find((t) => t.key === teamKey)

  const docs = useMemo(() => {
    if (!team) return []
    const teamProjectIds = new Set(
      data.projects.filter((p) => p.teamIds.includes(team.id)).map((p) => p.id),
    )
    return data.documents
      .filter((d) => d.teamId === team.id || (d.projectId && teamProjectIds.has(d.projectId)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [team, data.documents, data.projects])

  if (!team) return null

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Documents" teamName={team.name} teamIcon={team.icon} />
      <TeamTabs team={team} active="documents" />
      <div className="flex-1 overflow-y-auto">
        {docs.length === 0 ? (
          <EmptyState
            illustration={<StackIllustration />}
            title="No documents yet"
            description="Documents attached to this team or its projects show up here."
            action={{
              label: 'New document',
              onClick: () => {
                const doc = data.createDocument({ teamId: team.id })
                navigate(`/document/${doc.id}`)
              },
            }}
          />
        ) : (
          docs.map((d) => {
            const project = data.projects.find((p) => p.id === d.projectId)
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => navigate(`/document/${d.id}`)}
                className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left hover:bg-bg-hover"
              >
                <span className="text-[15px]">{d.icon}</span>
                <span className="flex-1 truncate text-[13px] text-fg">{d.title}</span>
                {project && (
                  <span className="shrink-0 text-[12px] text-muted">
                    {project.icon} {project.name}
                  </span>
                )}
                <span className="shrink-0 text-[12px] text-faint">{timeAgo(d.updatedAt)}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

/** Team → Members. Linear's Name / Email / Role table with "+ Add a member". */
export function TeamMembersView() {
  const { teamKey } = useParams()
  const navigate = useNavigate()
  const data = useStore()
  const display = useDisplayName()
  const team = data.teams.find((t) => t.key === teamKey)

  const members = useMemo(() => {
    if (!team) return []
    return data.users
      .filter((u) => team.memberIds.includes(u.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [team, data.users])

  if (!team) return null

  const candidates = data.users.filter((u) => !team.memberIds.includes(u.id))

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Members"
        teamName={team.name}
        teamIcon={team.icon}
        right={
          <SelectMenu
            align="end"
            width={260}
            placeholder="Search people…"
            options={candidates.map((u) => ({
              id: u.id,
              label: display(u.name),
              icon: <Avatar user={u} size={18} />,
              keywords: u.email,
            }))}
            onSelect={(id) => data.toggleTeamMember(team.id, id)}
            trigger={
              <span className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg">
                <Plus size={14} /> Add a member
              </span>
            }
          />
        }
      />
      <TeamTabs team={team} active="members" />
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-faint">
          <span className="flex-1">Name</span>
          <span className="w-64">Email</span>
          <span className="w-28">Role</span>
        </div>
        {members.map((u) => (
          <div
            key={u.id}
            className="group flex items-center gap-3 border-b border-border px-4 py-2 hover:bg-bg-hover"
          >
            <button
              type="button"
              onClick={() => navigate(`/member/${u.id}`)}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <Avatar user={u} size={24} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] text-fg">{display(u.name)}</span>
                <span className="block truncate text-[12px] text-faint">
                  {u.username ?? u.email.split('@')[0]}
                </span>
              </span>
            </button>
            <span className="w-64 truncate text-[12px] text-muted">{u.email}</span>
            <span className="w-28">
              <RoleChip role={u.role} />
            </span>
            <button
              type="button"
              title="Remove from team"
              onClick={() => data.toggleTeamMember(team.id, u.id)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-tertiary hover:text-fg group-hover:opacity-100"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
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

  // Priority breakdown bars (Urgent → No priority order; mirrors Linear's
  // priority distribution on team home). Counts only non-empty buckets.
  const byPriority = useMemo(() => {
    const counts = new Map<Priority, number>()
    for (const i of issues) counts.set(i.priority, (counts.get(i.priority) ?? 0) + 1)
    const bars = PRIORITY_ORDER.map((p) => ({
      key: p,
      label: PRIORITY_LABELS[p],
      value: counts.get(p) ?? 0,
    })).filter((b) => b.value > 0)
    const max = bars.reduce((m, b) => Math.max(m, b.value), 0)
    return { bars, max }
  }, [issues])

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
      <ViewHeader title="Overview" teamName={team.name} teamIcon={team.icon}>
        <div className="ml-auto">
          <TeamJoinButton teamId={team.id} />
        </div>
      </ViewHeader>
      <TeamTabs team={team} active="overview" />

      <div className="flex-1 overflow-y-auto bg-bg-secondary">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-8 py-8 lg:flex-row">
          {/* Team details sidebar — at-a-glance identity + settings */}
          <div className="order-first lg:order-last lg:w-72 lg:shrink-0">
            <TeamDetailsPanel team={team} />
          </div>

          <div className="min-w-0 flex-1">
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

            {/* Priority breakdown */}
            <Card title="Priority breakdown" subtitle="By priority">
              {byPriority.bars.length === 0 ? (
                <div className="px-1 py-6 text-center text-[12px] text-faint">No issues</div>
              ) : (
                <div className="space-y-2.5">
                  {byPriority.bars.map((b) => (
                    <div key={b.key} className="group flex items-center gap-3">
                      <div className="flex w-24 shrink-0 items-center gap-1.5" title={b.label}>
                        <PriorityIcon priority={b.key} size={14} />
                        <span className="truncate text-[12px] text-muted group-hover:text-fg">
                          {b.label}
                        </span>
                      </div>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all"
                          style={{
                            width: `${byPriority.max > 0 ? (b.value / byPriority.max) * 100 : 0}%`,
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

          {/* Velocity — completed issues per cycle (chart carries its own heading) */}
          <div className="mt-4 rounded-xl border border-border bg-bg p-5">
            <TeamVelocityChart teamId={team.id} />
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
    </div>
  )
}
