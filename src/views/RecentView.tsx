import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Search } from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { StatusIcon } from '@/components/StatusIcon'
import { EmptyState, IssuesIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import type { Issue } from '@/lib/types'

/**
 * Recently viewed — the issues you've opened most recently, newest first.
 * Reads the persisted `recentIssueIds` (capped at 30) and resolves each id to a
 * live issue, skipping any whose issue no longer exists. Rows are a lightweight
 * self-rendered version of `IssueRow` (no list-context plumbing) so this view
 * stays decoupled from the issues board/list state.
 */
export function RecentView() {
  const navigate = useNavigate()
  const fmtName = useDisplayName()
  const recentIssueIds = useStore((s) => s.recentIssueIds)
  const issues = useStore((s) => s.issues)
  const states = useStore((s) => s.states)
  const users = useStore((s) => s.users)
  const teams = useStore((s) => s.teams)

  // Header filters — both local-only, composed with AND, applied on top of the
  // recency order so newest-first is always preserved.
  const [query, setQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState('all')

  // Resolve ids → issues in recency order, dropping ids that no longer resolve.
  const recent = useMemo(() => {
    const byId = new Map(issues.map((i) => [i.id, i]))
    return recentIssueIds
      .map((id) => byId.get(id))
      .filter((i): i is Issue => Boolean(i) && !i!.archivedAt)
  }, [recentIssueIds, issues])

  // Apply the team + search filters while keeping the newest-first order intact.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return recent.filter((i) => {
      if (teamFilter !== 'all' && i.teamId !== teamFilter) return false
      if (
        q &&
        !i.identifier.toLowerCase().includes(q) &&
        !i.title.toLowerCase().includes(q)
      )
        return false
      return true
    })
  }, [recent, query, teamFilter])

  // Team filter options: "All teams" + every team in the workspace.
  const teamOptions = useMemo<SelectOption[]>(
    () => [
      { id: 'all', label: 'All teams', selected: teamFilter === 'all' },
      ...teams.map((t) => ({
        id: t.id,
        label: t.name,
        icon: t.icon ? <span>{t.icon}</span> : undefined,
        selected: teamFilter === t.id,
      })),
    ],
    [teams, teamFilter],
  )

  // Label for the team-filter trigger chip.
  const teamFilterLabel =
    teamFilter === 'all'
      ? 'All teams'
      : (teams.find((t) => t.id === teamFilter)?.name ?? 'All teams')

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Recently viewed">
        {recent.length > 0 && (
          <span className="text-[12px] tabular-nums text-faint">{recent.length}</span>
        )}
        {/* Header filters — search box + team picker, both local-only and
            composed with AND. Hidden when the history is truly empty. */}
        {recent.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg-tertiary px-2 py-1 focus-within:border-accent">
              <Search size={13} className="shrink-0 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recently viewed…"
                className="w-44 bg-transparent text-[12px] text-fg outline-none placeholder:text-faint"
              />
            </div>
            <SelectMenu
              width={200}
              align="end"
              options={teamOptions}
              onSelect={setTeamFilter}
              placeholder="Filter by team…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <span className="max-w-[120px] truncate">{teamFilterLabel}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
          </div>
        )}
      </ViewHeader>

      {recent.length === 0 ? (
        <EmptyState
          illustration={<IssuesIllustration />}
          title="No recently viewed issues"
          description="Issues you open will appear here for quick access."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration={<IssuesIllustration />}
          title="No matching issues"
          description="No recently viewed issues match your search or team filter."
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filtered.map((issue) => {
            const state = states.find((s) => s.id === issue.stateId)
            const assignee = users.find((u) => u.id === issue.assigneeId)
            return (
              <button
                key={issue.id}
                type="button"
                onClick={() => navigate(`/issue/${issue.identifier}`)}
                className="flex w-full items-center gap-2.5 border-b border-border/40 px-4 py-1.5 text-left transition-colors hover:bg-bg-hover"
              >
                {state && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <StatusIcon type={state.type} color={state.color} />
                  </span>
                )}
                <span className="w-14 shrink-0 font-mono text-[12px] text-faint">
                  {issue.identifier}
                </span>
                <span className="flex-1 truncate text-[13px] text-fg">{issue.title}</span>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center"
                  title={assignee ? fmtName(assignee.name) : 'Unassigned'}
                >
                  <Avatar user={assignee} size={20} />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
