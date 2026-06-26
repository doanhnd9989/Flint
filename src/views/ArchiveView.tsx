import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, ChevronDown, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { StatusIcon } from '@/components/StatusIcon'
import { EmptyState, IssuesIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { timeAgo } from '@/lib/utils'
import type { Issue, Team, User, WorkflowState } from '@/lib/types'

/**
 * Archive — workspace view listing every archived issue (those with a truthy
 * `archivedAt`). Rows are grouped by team and ordered newest-archived first.
 * Hovering a row reveals Restore (unarchive) and Delete (permanent) actions;
 * clicking the row body opens the issue.
 */
export function ArchiveView() {
  const navigate = useNavigate()
  const issues = useStore((s) => s.issues)
  const teams = useStore((s) => s.teams)
  const users = useStore((s) => s.users)
  const states = useStore((s) => s.states)
  const unarchiveIssue = useStore((s) => s.unarchiveIssue)
  const deleteIssue = useStore((s) => s.deleteIssue)

  // Local-only header filters: a free-text query (identifier/title substring)
  // and a team picker. They compose with AND.
  const [query, setQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState<string>('all')

  // Sort order for the archived pool. "recent" (newest-archived first) is the
  // default, matching Linear; "oldest" reverses it, "identifier" sorts by the
  // human key (e.g. ENG-1, ENG-2) in natural ascending order.
  type SortKey = 'recent' | 'oldest' | 'identifier'
  const [sort, setSort] = useState<SortKey>('recent')

  // userId → user, for assignee avatars.
  const userById = useMemo(() => {
    const m = new Map<string, User>()
    for (const u of users) m.set(u.id, u)
    return m
  }, [users])

  // stateId → workflow state, for the row's status glyph.
  const stateById = useMemo(() => {
    const m = new Map<string, WorkflowState>()
    for (const s of states) m.set(s.id, s)
    return m
  }, [states])

  // Every archived issue in the chosen order (the unfiltered pool — also the
  // count shown in the header). Default is newest-archived first.
  const allArchived = useMemo(() => {
    const pool = issues.filter((i) => !!i.archivedAt)
    if (sort === 'identifier') {
      return pool.sort((a, b) =>
        a.identifier.localeCompare(b.identifier, undefined, { numeric: true }),
      )
    }
    const dir = sort === 'oldest' ? -1 : 1
    return pool.sort(
      (a, b) => dir * (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''),
    )
  }, [issues, sort])

  // Apply the header filters (query substring + team) with AND semantics.
  const archived = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allArchived.filter((i) => {
      if (teamFilter !== 'all' && i.teamId !== teamFilter) return false
      if (
        q &&
        !i.identifier.toLowerCase().includes(q) &&
        !i.title.toLowerCase().includes(q)
      )
        return false
      return true
    })
  }, [allArchived, query, teamFilter])

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

  // Sort picker options + the human label for its trigger chip.
  const sortLabels: Record<SortKey, string> = {
    recent: 'Recently archived',
    oldest: 'Oldest archived',
    identifier: 'Identifier',
  }
  const sortOptions = useMemo<SelectOption[]>(
    () =>
      (Object.keys(sortLabels) as SortKey[]).map((k) => ({
        id: k,
        label: sortLabels[k],
        selected: sort === k,
      })),
    // sortLabels is a stable literal; only `sort` actually varies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort],
  )

  // Group the (already sorted) archived issues by team, preserving order.
  const groups = useMemo(() => {
    const teamById = new Map<string, Team>()
    for (const t of teams) teamById.set(t.id, t)
    const byTeam = new Map<string, { team: Team | undefined; items: Issue[] }>()
    for (const i of archived) {
      let g = byTeam.get(i.teamId)
      if (!g) {
        g = { team: teamById.get(i.teamId), items: [] }
        byTeam.set(i.teamId, g)
      }
      g.items.push(i)
    }
    return [...byTeam.values()]
  }, [archived, teams])

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Archive">
        <span className="text-[12px] tabular-nums text-faint">
          {allArchived.length}
        </span>
        {/* Header filters — search box + team picker, both local-only and
            composed with AND. Hidden when there's nothing archived at all. */}
        {allArchived.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg-tertiary px-2 py-1 focus-within:border-accent">
              <Search size={13} className="shrink-0 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search archive…"
                className="w-40 bg-transparent text-[12px] text-fg outline-none placeholder:text-faint"
              />
            </div>
            <SelectMenu
              width={180}
              align="end"
              options={sortOptions}
              onSelect={(id) => setSort(id as SortKey)}
              placeholder="Sort by…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <ArrowUpDown size={13} className="shrink-0 text-faint" />
                  <span className="max-w-[120px] truncate">{sortLabels[sort]}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
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

      <div className="flex-1 overflow-y-auto">
        {allArchived.length === 0 ? (
          <EmptyState
            illustration={<IssuesIllustration />}
            title="No archived issues"
            description="Issues you archive will show up here."
          />
        ) : archived.length === 0 ? (
          <EmptyState
            illustration={<IssuesIllustration />}
            title="No matching issues"
            description="No archived issues match your search or team filter."
          />
        ) : (
          <div className="mx-auto max-w-3xl px-6 py-6">
            {groups.map((g) => (
              <div key={g.team?.id ?? 'unknown'} className="mb-6 last:mb-0">
                {/* Team section header */}
                <div className="mb-1 flex items-center gap-1.5 px-1 text-[12px] font-medium text-muted">
                  {g.team?.icon && <span>{g.team.icon}</span>}
                  <span>{g.team?.name ?? 'Unknown team'}</span>
                  <span className="tabular-nums text-faint">{g.items.length}</span>
                </div>

                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {g.items.map((i) => {
                    const assignee = i.assigneeId
                      ? userById.get(i.assigneeId)
                      : undefined
                    const state = stateById.get(i.stateId)
                    return (
                      <div
                        key={i.id}
                        onClick={() => navigate(`/issue/${i.identifier}`)}
                        className="group flex cursor-pointer items-center gap-3 bg-bg px-3 py-2.5 transition-colors hover:bg-bg-hover"
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                          {state && (
                            <StatusIcon type={state.type} color={state.color} />
                          )}
                        </span>

                        <span className="w-16 shrink-0 font-mono text-[12px] text-faint">
                          {i.identifier}
                        </span>

                        <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
                          {i.title}
                        </span>

                        {/* Default trailing meta — hidden on hover to make room for actions */}
                        <div className="flex items-center gap-2.5 text-[12px] text-muted group-hover:hidden">
                          {assignee && <Avatar user={assignee} size={20} />}
                          <span className="whitespace-nowrap text-faint">
                            archived {i.archivedAt ? timeAgo(i.archivedAt) : ''}
                          </span>
                        </div>

                        {/* Hover actions */}
                        <div className="hidden items-center gap-1 group-hover:flex">
                          <button
                            type="button"
                            title="Restore"
                            aria-label={`Restore ${i.identifier}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              unarchiveIssue(i.id)
                            }}
                            className="flex items-center gap-1 rounded px-2 py-1 text-[12px] text-muted hover:bg-bg-selected hover:text-fg"
                          >
                            <RotateCcw size={14} />
                            <span>Restore</span>
                          </button>
                          <button
                            type="button"
                            title="Delete permanently"
                            aria-label={`Delete ${i.identifier}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteIssue(i.id)
                            }}
                            className="flex items-center gap-1 rounded px-2 py-1 text-[12px] text-muted hover:bg-bg-selected hover:text-red-500"
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
