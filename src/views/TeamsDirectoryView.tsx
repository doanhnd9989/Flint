import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  RefreshCw,
  Lock,
  Search,
  ArrowDownUp,
  LayoutGrid,
  List,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { cn } from '@/lib/utils'
import type { Issue, Team, User, WorkflowState } from '@/lib/types'

/** Sort modes for the teams directory, mirroring Linear's team list. */
type SortKey = 'name' | 'members' | 'issues' | 'active'

/** Layout modes — Linear lets you flip the team directory between list & grid. */
type Layout = 'list' | 'grid'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'name', label: 'Name A→Z' },
  { id: 'members', label: 'Members (most)' },
  { id: 'issues', label: 'Issues (most)' },
  { id: 'active', label: 'Active issues (most)' },
]

/** A small stat in the summary strip. */
function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[13px] font-semibold tabular-nums text-fg">{value}</span>
      <span className="text-[12px] text-muted">{label}</span>
    </div>
  )
}

/** A labelled count shown on the right side of a team row. */
function CountStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="hidden w-16 shrink-0 flex-col items-end sm:flex">
      <span className="text-[13px] font-semibold tabular-nums text-fg">{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  )
}

/** Per-team aggregate counts. */
interface TeamStats {
  total: number // non-triage issues in the team
  active: number // started + unstarted issues
  projects: number // projects that include this team
}

/** A team's most-active member: who, and how many of the team's issues they own. */
interface ActiveMember {
  user: User
  count: number
}

/**
 * Hover popover listing a team's most active members — the top assignees by
 * issue count within the team, with their assigned totals. Reveals on row hover
 * (and focus, for keyboard users), mirroring Linear's contributor peek.
 */
function MostActiveMembers({ members }: { members: ActiveMember[] }) {
  if (members.length === 0) return null
  return (
    <div
      className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-56 rounded-lg border border-border bg-bg p-2 text-left shadow-lg group-hover:block group-focus-visible:block"
      role="tooltip"
    >
      <div className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
        Most active
      </div>
      <div className="flex flex-col gap-0.5">
        {members.map(({ user, count }) => (
          <div key={user.id} className="flex items-center gap-2 rounded px-1 py-1">
            <Avatar user={user} size={20} />
            <span className="min-w-0 flex-1 truncate text-[12px] text-fg">
              {user.name}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted">
              {count} issue{count === 1 ? '' : 's'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Teams directory — Linear's workspace Teams list. Browse every team with its
 * key, members, and issue/project counts; click through to the team overview.
 * Team mutations (create / settings) live in Settings → Teams.
 */
export function TeamsDirectoryView() {
  const navigate = useNavigate()
  const teams = useStore((s) => s.teams)
  const issues = useStore((s) => s.issues)
  const users = useStore((s) => s.users)
  const states = useStore((s) => s.states)
  const projects = useStore((s) => s.projects)

  // Local-only filter + sort + layout state for the directory header.
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [layout, setLayout] = useState<Layout>('list')

  // stateId → status type, for classifying issues.
  const stateType = useMemo(() => {
    const m = new Map<string, WorkflowState['type']>()
    for (const s of states) m.set(s.id, s.type)
    return m
  }, [states])

  // teamId → aggregate counts.
  const statsByTeam = useMemo(() => {
    const m = new Map<string, TeamStats>()
    for (const t of teams) m.set(t.id, { total: 0, active: 0, projects: 0 })
    for (const i of issues as Issue[]) {
      if (i.triage || i.archivedAt) continue
      const s = m.get(i.teamId)
      if (!s) continue
      s.total++
      const type = stateType.get(i.stateId)
      if (type === 'started' || type === 'unstarted') s.active++
    }
    for (const p of projects) {
      for (const tid of p.teamIds) {
        const s = m.get(tid)
        if (s) s.projects++
      }
    }
    return m
  }, [teams, issues, projects, stateType])

  // userId → user, for resolving member avatars.
  const userById = useMemo(() => {
    const m = new Map<string, User>()
    for (const u of users) m.set(u.id, u)
    return m
  }, [users])

  // teamId → top 3 assignees by issue count within that team (most active).
  const topMembersByTeam = useMemo(() => {
    // teamId → (assigneeId → count)
    const counts = new Map<string, Map<string, number>>()
    for (const i of issues as Issue[]) {
      if (i.triage || i.archivedAt || !i.assigneeId) continue
      let inner = counts.get(i.teamId)
      if (!inner) {
        inner = new Map<string, number>()
        counts.set(i.teamId, inner)
      }
      inner.set(i.assigneeId, (inner.get(i.assigneeId) ?? 0) + 1)
    }
    const m = new Map<string, ActiveMember[]>()
    for (const t of teams) {
      const inner = counts.get(t.id)
      if (!inner) {
        m.set(t.id, [])
        continue
      }
      const ranked = [...inner.entries()]
        .map(([id, count]) => ({ user: userById.get(id), count }))
        .filter((x): x is ActiveMember => !!x.user)
        .sort((a, b) => b.count - a.count || a.user.name.localeCompare(b.user.name))
        .slice(0, 3)
      m.set(t.id, ranked)
    }
    return m
  }, [issues, teams, userById])

  // Summary strip: total teams + grand total of issues + members across teams.
  const summary = useMemo(() => {
    const memberIds = new Set<string>()
    let totalIssues = 0
    for (const t of teams) {
      for (const id of t.memberIds ?? []) memberIds.add(id)
      totalIssues += statsByTeam.get(t.id)?.total ?? 0
    }
    return { teams: teams.length, members: memberIds.size, issues: totalIssues }
  }, [teams, statsByTeam])

  // Filter by name/key substring, then sort by the chosen key. Ties fall back
  // to alphabetical so the list stays stable.
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? teams.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.key.toLowerCase().includes(q),
        )
      : teams
    const memberCount = (t: Team) => (t.memberIds ?? []).length
    return [...filtered].sort((a, b) => {
      const sa = statsByTeam.get(a.id)
      const sb = statsByTeam.get(b.id)
      switch (sortKey) {
        case 'members':
          return memberCount(b) - memberCount(a) || a.name.localeCompare(b.name)
        case 'issues':
          return (sb?.total ?? 0) - (sa?.total ?? 0) || a.name.localeCompare(b.name)
        case 'active':
          return (sb?.active ?? 0) - (sa?.active ?? 0) || a.name.localeCompare(b.name)
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [teams, query, sortKey, statsByTeam])

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Teams"
        right={
          <span className="text-[12px] text-muted">
            {summary.teams} team{summary.teams === 1 ? '' : 's'}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          {/* Summary strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-border pb-4">
            <SummaryStat value={summary.teams} label="teams" />
            <SummaryStat value={summary.members} label="members" />
            <SummaryStat value={summary.issues} label="issues" />
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="ml-auto text-[12px] text-muted hover:text-fg"
            >
              Manage in Settings → Teams
            </button>
          </div>

          {/* Filter + sort controls */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 rounded-md bg-bg-secondary px-2 py-1.5">
              <Search size={13} className="text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter teams…"
                className="w-44 bg-transparent text-[13px] text-fg placeholder:text-faint outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <SelectMenu
                align="end"
                width={200}
                options={SORT_OPTIONS.map((o) => ({
                  id: o.id,
                  label: o.label,
                  selected: o.id === sortKey,
                }))}
                onSelect={(id) => setSortKey(id as SortKey)}
                trigger={
                  <span className="flex items-center gap-1.5 rounded-md bg-bg-secondary px-2 py-1.5 text-[13px] text-muted hover:text-fg">
                    <ArrowDownUp size={13} className="text-faint" />
                    {SORT_OPTIONS.find((o) => o.id === sortKey)?.label}
                  </span>
                }
              />
              {/* List / grid layout toggle */}
              <div className="flex items-center rounded-md bg-bg-secondary p-0.5">
                <button
                  type="button"
                  onClick={() => setLayout('list')}
                  title="List layout"
                  aria-pressed={layout === 'list'}
                  className={cn(
                    'flex size-6 items-center justify-center rounded transition-colors',
                    layout === 'list'
                      ? 'bg-bg text-fg shadow-sm'
                      : 'text-faint hover:text-fg',
                  )}
                >
                  <List size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setLayout('grid')}
                  title="Grid layout"
                  aria-pressed={layout === 'grid'}
                  className={cn(
                    'flex size-6 items-center justify-center rounded transition-colors',
                    layout === 'grid'
                      ? 'bg-bg text-fg shadow-sm'
                      : 'text-faint hover:text-fg',
                  )}
                >
                  <LayoutGrid size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Empty state (shared by both layouts) */}
          {sorted.length === 0 && (
            <div className="mt-3 overflow-hidden rounded-lg border border-border bg-bg px-3 py-8 text-center text-[13px] text-faint">
              No teams match “{query}”.
            </div>
          )}

          {/* List layout */}
          {sorted.length > 0 && layout === 'list' && (
            <div className="mt-3 divide-y divide-border rounded-lg border border-border [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg">
              {sorted.map((team: Team) => {
                const stats = statsByTeam.get(team.id) ?? {
                  total: 0,
                  active: 0,
                  projects: 0,
                }
                const memberIds = team.memberIds ?? []
                const members = memberIds
                  .map((id) => userById.get(id))
                  .filter((u): u is User => !!u)
                const cyclesOn = team.cyclesEnabled ?? true

                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => navigate(`/team/${team.key}/overview`)}
                    className="group relative flex w-full items-center gap-3 bg-bg px-3 py-3 text-left transition-colors hover:bg-bg-hover"
                  >
                    {/* Icon */}
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-bg-secondary text-[15px]">
                      {team.icon}
                    </span>

                    {/* Name + key + indicators */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-fg">
                          {team.name}
                        </span>
                        <span className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted">
                          {team.key}
                        </span>
                        {team.private && (
                          <Lock size={11} className="shrink-0 text-faint" />
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        <span>
                          {memberIds.length} member{memberIds.length === 1 ? '' : 's'}
                        </span>
                        <span className="text-faint">·</span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            cyclesOn ? 'text-muted' : 'text-faint',
                          )}
                        >
                          <RefreshCw size={10} />
                          Cycles {cyclesOn ? 'on' : 'off'}
                        </span>
                      </div>
                    </div>

                    {/* Stacked member avatars */}
                    {members.length > 0 && (
                      <div className="hidden items-center md:flex">
                        <div className="flex -space-x-1.5">
                          {members.slice(0, 5).map((u) => (
                            <span
                              key={u.id}
                              className="rounded-full ring-2 ring-bg"
                              title={u.name}
                            >
                              <Avatar user={u} size={22} />
                            </span>
                          ))}
                        </div>
                        {members.length > 5 && (
                          <span className="ml-1.5 text-[11px] text-faint">
                            +{members.length - 5}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Counts */}
                    <CountStat value={stats.total} label="issues" />
                    <CountStat value={stats.active} label="active" />
                    <CountStat value={stats.projects} label="projects" />

                    <ChevronRight
                      size={15}
                      className="shrink-0 text-faint transition-colors group-hover:text-muted"
                    />

                    {/* Most-active-members peek (reveals on row hover/focus) */}
                    <MostActiveMembers
                      members={topMembersByTeam.get(team.id) ?? []}
                    />
                  </button>
                )
              })}
            </div>
          )}

          {/* Grid layout */}
          {sorted.length > 0 && layout === 'grid' && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {sorted.map((team: Team) => {
                const stats = statsByTeam.get(team.id) ?? {
                  total: 0,
                  active: 0,
                  projects: 0,
                }
                const memberIds = team.memberIds ?? []
                const members = memberIds
                  .map((id) => userById.get(id))
                  .filter((u): u is User => !!u)
                const cyclesOn = team.cyclesEnabled ?? true

                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => navigate(`/team/${team.key}/overview`)}
                    className="group flex flex-col rounded-lg border border-border bg-bg p-4 text-left transition-colors hover:bg-bg-hover"
                  >
                    {/* Header: icon + name + key */}
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bg-secondary text-[16px]">
                        {team.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-fg">
                            {team.name}
                          </span>
                          {team.private && (
                            <Lock size={11} className="shrink-0 text-faint" />
                          )}
                        </div>
                        <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-muted">
                          {team.key}
                        </span>
                      </div>
                      <ChevronRight
                        size={15}
                        className="shrink-0 text-faint transition-colors group-hover:text-muted"
                      />
                    </div>

                    {/* Counts row */}
                    <div className="mt-3 flex items-center gap-4 border-t border-border pt-3">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold tabular-nums text-fg">
                          {stats.total}
                        </span>
                        <span className="text-[11px] text-muted">issues</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold tabular-nums text-fg">
                          {stats.active}
                        </span>
                        <span className="text-[11px] text-muted">active</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold tabular-nums text-fg">
                          {stats.projects}
                        </span>
                        <span className="text-[11px] text-muted">projects</span>
                      </div>
                    </div>

                    {/* Footer: avatars + cycles indicator */}
                    <div className="mt-3 flex items-center justify-between">
                      {members.length > 0 ? (
                        <div className="flex items-center">
                          <div className="flex -space-x-1.5">
                            {members.slice(0, 5).map((u) => (
                              <span
                                key={u.id}
                                className="rounded-full ring-2 ring-bg"
                                title={u.name}
                              >
                                <Avatar user={u} size={20} />
                              </span>
                            ))}
                          </div>
                          {members.length > 5 && (
                            <span className="ml-1.5 text-[11px] text-faint">
                              +{members.length - 5}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-faint">No members</span>
                      )}
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[11px]',
                          cyclesOn ? 'text-muted' : 'text-faint',
                        )}
                      >
                        <RefreshCw size={10} />
                        Cycles {cyclesOn ? 'on' : 'off'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
