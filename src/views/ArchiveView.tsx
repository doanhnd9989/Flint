import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, ChevronDown, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { StatusIcon } from '@/components/StatusIcon'
import { EmptyState, IssuesIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { timeAgo } from '@/lib/utils'
import type { Issue, Project, Team, User, WorkflowState } from '@/lib/types'

/**
 * Archive — workspace view listing every archived issue (those with a truthy
 * `archivedAt`). Rows are grouped by team (or, optionally, by project) and
 * ordered newest-archived first. Hovering a row reveals Restore (unarchive) and
 * Delete (permanent) actions; clicking the row body opens the issue.
 */
export function ArchiveView() {
  const navigate = useNavigate()
  const issues = useStore((s) => s.issues)
  const teams = useStore((s) => s.teams)
  const projects = useStore((s) => s.projects)
  const users = useStore((s) => s.users)
  const states = useStore((s) => s.states)
  const unarchiveIssue = useStore((s) => s.unarchiveIssue)
  const deleteIssue = useStore((s) => s.deleteIssue)

  // Local-only header filters: a free-text query (identifier/title substring),
  // a team picker and a project picker. They compose with AND.
  const [query, setQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')

  // Group results by team (default, matching Linear) or by project.
  type GroupBy = 'team' | 'project'
  const [groupBy, setGroupBy] = useState<GroupBy>('team')

  // Sort order for the archived pool. "recent" (newest-archived first) is the
  // default, matching Linear; "oldest" reverses it, "identifier" sorts by the
  // human key (e.g. ENG-1, ENG-2) in natural ascending order.
  type SortKey = 'recent' | 'oldest' | 'identifier'
  const [sort, setSort] = useState<SortKey>('recent')

  // Bulk-selection: ids of archived issues the user has ticked. A sticky action
  // bar appears whenever ≥1 is selected, offering Restore / Delete on the whole
  // set. Selection is local-only and never persisted.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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

  // Apply the header filters (query substring + team + project) with AND
  // semantics. The "none" project sentinel matches issues with no project.
  const archived = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allArchived.filter((i) => {
      if (teamFilter !== 'all' && i.teamId !== teamFilter) return false
      if (projectFilter !== 'all') {
        if (projectFilter === 'none' ? !!i.projectId : i.projectId !== projectFilter)
          return false
      }
      if (
        q &&
        !i.identifier.toLowerCase().includes(q) &&
        !i.title.toLowerCase().includes(q)
      )
        return false
      return true
    })
  }, [allArchived, query, teamFilter, projectFilter])

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

  // Project filter options: "All projects" + every project that actually has an
  // archived issue (so the picker never lists empty buckets), plus a "No
  // project" entry when some archived issue lacks a project.
  const archivedProjectIds = useMemo(() => {
    const ids = new Set<string>()
    let hasNone = false
    for (const i of allArchived) {
      if (i.projectId) ids.add(i.projectId)
      else hasNone = true
    }
    return { ids, hasNone }
  }, [allArchived])

  const projectOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [
      { id: 'all', label: 'All projects', selected: projectFilter === 'all' },
      ...projects
        .filter((p) => archivedProjectIds.ids.has(p.id))
        .map((p) => ({
          id: p.id,
          label: p.name,
          selected: projectFilter === p.id,
        })),
    ]
    if (archivedProjectIds.hasNone)
      opts.push({
        id: 'none',
        label: 'No project',
        selected: projectFilter === 'none',
      })
    return opts
  }, [projects, archivedProjectIds, projectFilter])

  // Label for the project-filter trigger chip.
  const projectFilterLabel =
    projectFilter === 'all'
      ? 'All projects'
      : projectFilter === 'none'
        ? 'No project'
        : (projects.find((p) => p.id === projectFilter)?.name ?? 'All projects')

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

  // Group the (already sorted) archived issues, preserving order. A group's key
  // is its team id or project id depending on `groupBy`; each carries a display
  // `label`, an optional `icon` (team emoji), and a stable `key` for React.
  const groups = useMemo(() => {
    type Group = { key: string; label: string; icon?: string; items: Issue[] }
    if (groupBy === 'project') {
      const projectById = new Map<string, Project>()
      for (const p of projects) projectById.set(p.id, p)
      const byProject = new Map<string, Group>()
      let none: Group | undefined
      for (const i of archived) {
        if (!i.projectId) {
          if (!none) none = { key: 'none', label: 'No project', items: [] }
          none.items.push(i)
          continue
        }
        let g = byProject.get(i.projectId)
        if (!g) {
          g = {
            key: i.projectId,
            label: projectById.get(i.projectId)?.name ?? 'Unknown project',
            items: [],
          }
          byProject.set(i.projectId, g)
        }
        g.items.push(i)
      }
      // "No project" bucket always sorts last.
      return none ? [...byProject.values(), none] : [...byProject.values()]
    }
    const teamById = new Map<string, Team>()
    for (const t of teams) teamById.set(t.id, t)
    const byTeam = new Map<string, Group>()
    for (const i of archived) {
      let g = byTeam.get(i.teamId)
      if (!g) {
        const team = teamById.get(i.teamId)
        g = {
          key: i.teamId,
          label: team?.name ?? 'Unknown team',
          icon: team?.icon,
          items: [],
        }
        byTeam.set(i.teamId, g)
      }
      g.items.push(i)
    }
    return [...byTeam.values()]
  }, [archived, teams, projects, groupBy])

  // Ids currently visible under the active filters — the universe the header
  // checkbox toggles and the bound for "all selected".
  const visibleIds = useMemo(() => archived.map((i) => i.id), [archived])

  // Drop any selected id that's no longer present (e.g. it was restored,
  // deleted, or filtered out) so the action bar stays in sync with the list.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const visible = new Set(visibleIds)
      const next = new Set<string>()
      for (const id of prev) if (visible.has(id)) next.add(id)
      return next.size === prev.size ? prev : next
    })
  }, [visibleIds])

  // Escape clears any active selection.
  useEffect(() => {
    if (selectedIds.size === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIds(new Set())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds.size])

  const selectedCount = selectedIds.size
  const allSelected = visibleIds.length > 0 && selectedCount === visibleIds.length

  // Toggle a single row's membership in the selection.
  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Header checkbox: select every visible row, or clear if already all selected.
  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(visibleIds))
  }

  // Restore each selected issue (unarchive), then clear the selection.
  function restoreSelected() {
    for (const id of selectedIds) unarchiveIssue(id)
    setSelectedIds(new Set())
  }

  // Permanently delete each selected issue, then clear the selection.
  function deleteSelected() {
    for (const id of selectedIds) deleteIssue(id)
    setSelectedIds(new Set())
  }

  // Keyboard navigation — Linear lets you walk any list with j/k (or arrows) and
  // act on the focused row. `archived` is already the flat, grouped order, so we
  // navigate it directly; `focusId` tracks the highlighted issue, clamped to the
  // visible set so a filter/restore never strands the cursor on a hidden row.
  const [focusId, setFocusId] = useState<string | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Keep the focus valid as the filtered list shifts: default to the first row,
  // and drop a focus that no longer exists in the visible set.
  useEffect(() => {
    if (!archived.length) {
      if (focusId !== null) setFocusId(null)
      return
    }
    if (!focusId || !archived.some((i) => i.id === focusId)) {
      setFocusId(archived[0].id)
    }
  }, [archived, focusId])

  // Capture-phase key handler so it pre-empts the global shortcut handler (which
  // also binds j/k/arrows). Ignores typing in the search box / any open overlay.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onKeyRef.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      return
    if (document.querySelector('[data-overlay]')) return
    if (!archived.length) return
    const idx = archived.findIndex((i) => i.id === focusId)
    const own = () => {
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    if (e.key === 'ArrowDown' || e.key === 'j') {
      own()
      setFocusId((archived[Math.min(idx + 1, archived.length - 1)] ?? archived[0]).id)
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'k') {
      own()
      setFocusId((idx <= 0 ? archived[0] : archived[idx - 1]).id)
      return
    }
    if (e.key === 'Enter' || e.key === 'o') {
      const cur = archived[idx]
      if (!cur) return
      own()
      navigate(`/issue/${cur.identifier}`)
      return
    }
    // 'e' restores (unarchives) the focused row, matching the hover action.
    if (e.key === 'e') {
      const cur = archived[idx]
      if (!cur) return
      own()
      unarchiveIssue(cur.id)
    }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyRef.current(e)
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  // Scroll the focused row into view as the cursor walks past the viewport edge.
  useEffect(() => {
    if (focusId) rowRefs.current[focusId]?.scrollIntoView({ block: 'nearest' })
  }, [focusId])

  return (
    <div className="relative flex h-full flex-col">
      <ViewHeader title="Archive">
        {/* Header "select all" — toggles every visible row. Only meaningful
            once something is in the filtered list. */}
        {archived.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            aria-label={allSelected ? 'Deselect all' : 'Select all'}
            title={allSelected ? 'Deselect all' : 'Select all'}
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
              allSelected
                ? 'border-accent bg-accent text-white'
                : selectedCount > 0
                  ? 'border-accent text-accent'
                  : 'border-border-strong hover:border-accent',
            )}
          >
            {allSelected ? (
              <svg width="11" height="11" viewBox="0 0 16 16">
                <path
                  d="M3.5 8.5l3 3 6-6.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : selectedCount > 0 ? (
              <span className="h-0.5 w-2 rounded-full bg-accent" />
            ) : null}
          </button>
        )}
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
            <SelectMenu
              width={200}
              align="end"
              options={projectOptions}
              onSelect={setProjectFilter}
              placeholder="Filter by project…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <span className="max-w-[120px] truncate">{projectFilterLabel}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
            {/* Group-by segment — swaps the section headers between team and
                project, mirroring Linear's grouping control. */}
            <div className="flex items-center rounded-md border border-border bg-bg-tertiary p-0.5 text-[12px]">
              {(['team', 'project'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupBy(g)}
                  aria-pressed={groupBy === g}
                  className={cn(
                    'rounded px-2 py-0.5 capitalize transition-colors',
                    groupBy === g
                      ? 'bg-bg-selected text-fg'
                      : 'text-muted hover:text-fg',
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
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
            description="No archived issues match your search, team or project filter."
          />
        ) : (
          <div className="mx-auto max-w-3xl px-6 py-6">
            {groups.map((g) => (
              <div key={g.key} className="mb-6 last:mb-0">
                {/* Group section header (team or project) */}
                <div className="mb-1 flex items-center gap-1.5 px-1 text-[12px] font-medium text-muted">
                  {g.icon && <span>{g.icon}</span>}
                  <span>{g.label}</span>
                  <span className="tabular-nums text-faint">{g.items.length}</span>
                </div>

                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {g.items.map((i) => {
                    const assignee = i.assigneeId
                      ? userById.get(i.assigneeId)
                      : undefined
                    const state = stateById.get(i.stateId)
                    const checked = selectedIds.has(i.id)
                    const focused = focusId === i.id
                    return (
                      <div
                        key={i.id}
                        ref={(el) => {
                          rowRefs.current[i.id] = el
                        }}
                        onClick={() => navigate(`/issue/${i.identifier}`)}
                        onMouseEnter={() => setFocusId(i.id)}
                        className={cn(
                          'group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors',
                          checked
                            ? 'bg-accent-subtle'
                            : focused
                              ? 'bg-bg-hover'
                              : 'bg-bg hover:bg-bg-hover',
                        )}
                      >
                        {/* Per-row select checkbox — visible on hover, when the
                            row is checked, or when any selection is active. */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleOne(i.id)
                          }}
                          aria-label={`Select ${i.identifier}`}
                          title="Select"
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-opacity',
                            checked
                              ? 'border-accent bg-accent text-white opacity-100'
                              : 'border-border-strong opacity-0 group-hover:opacity-100',
                            selectedCount > 0 && 'opacity-100',
                          )}
                        >
                          {checked && (
                            <svg width="11" height="11" viewBox="0 0 16 16">
                              <path
                                d="M3.5 8.5l3 3 6-6.5"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>

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

      {/* Sticky bulk-action bar — appears whenever ≥1 archived issue is
          selected, mirroring Linear's floating multi-select toolbar. */}
      {selectedCount > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-6">
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-bg-tertiary px-2 py-1.5 shadow-lg">
            <span className="px-2 text-[12px] tabular-nums text-muted">
              {selectedCount} selected
            </span>
            <span className="mx-0.5 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={restoreSelected}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] text-muted hover:bg-bg-selected hover:text-fg"
            >
              <RotateCcw size={14} />
              <span>Restore</span>
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] text-muted hover:bg-bg-selected hover:text-red-500"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
            <span className="mx-0.5 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              aria-label="Clear selection"
              title="Clear selection"
              className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-selected hover:text-fg"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
