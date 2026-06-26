import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, RefreshCw, Lock } from 'lucide-react'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { cn } from '@/lib/utils'
import type { Issue, Team, User, WorkflowState } from '@/lib/types'

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
      if (i.triage) continue
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

  // Alphabetical by name, like Linear's Teams settings list.
  const sorted = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  )

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

          {/* List */}
          <div className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
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
                  className="group flex w-full items-center gap-3 bg-bg px-3 py-3 text-left transition-colors hover:bg-bg-hover"
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
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
