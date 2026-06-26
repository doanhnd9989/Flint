import { useEffect, useMemo, useRef, useState } from 'react'
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

  // Keyboard navigation — Linear lets you walk any list with j/k (or arrows) and
  // open the focused row with Enter/o. `focusId` tracks the highlighted issue;
  // it's clamped to the visible (filtered) set so a filter change never strands
  // the cursor on a now-hidden row.
  const [focusId, setFocusId] = useState<string | null>(null)
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Keep the focus valid as the filtered list shifts: default to the first row,
  // and drop a focus that no longer exists in the visible set.
  useEffect(() => {
    if (!filtered.length) {
      if (focusId !== null) setFocusId(null)
      return
    }
    if (!focusId || !filtered.some((i) => i.id === focusId)) {
      setFocusId(filtered[0].id)
    }
  }, [filtered, focusId])

  // Capture-phase key handler so it pre-empts the global shortcut handler (which
  // also binds j/k/arrows). Ignores typing in the search box / any open overlay.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onKeyRef.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      return
    if (document.querySelector('[data-overlay]')) return
    if (!filtered.length) return
    const idx = filtered.findIndex((i) => i.id === focusId)
    const own = () => {
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    if (e.key === 'ArrowDown' || e.key === 'j') {
      own()
      setFocusId((filtered[Math.min(idx + 1, filtered.length - 1)] ?? filtered[0]).id)
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'k') {
      own()
      setFocusId((idx <= 0 ? filtered[0] : filtered[idx - 1]).id)
      return
    }
    if (e.key === 'Enter' || e.key === 'o') {
      const cur = filtered[idx]
      if (!cur) return
      own()
      navigate(`/issue/${cur.identifier}`)
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
                ref={(el) => {
                  rowRefs.current[issue.id] = el
                }}
                type="button"
                onClick={() => navigate(`/issue/${issue.identifier}`)}
                onMouseEnter={() => setFocusId(issue.id)}
                className={`flex w-full items-center gap-2.5 border-b border-border/40 px-4 py-1.5 text-left transition-colors hover:bg-bg-hover ${
                  focusId === issue.id ? 'bg-bg-hover' : ''
                }`}
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
