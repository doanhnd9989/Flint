import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search as SearchIcon,
  Clock,
  X,
  MessageSquare,
  IterationCcw,
  Target,
  Building2,
  Bookmark,
  Users,
  Save,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { filterIssues } from '@/lib/selectors'
import { IssueRow } from '@/components/IssueRow'
import { LabelDot } from '@/components/LabelChip'
import { Avatar } from '@/components/Avatar'
import { FilterBar, emptyFilters, hasActiveFilters } from '@/components/FilterBar'
import { projectProgress } from '@/lib/selectors'
import { EmptyState, SearchIllustration } from '@/components/EmptyState'
import { timeAgo, cn } from '@/lib/utils'

/** Entity-type filter for the search results (Linear's segmented tabs). */
type SearchTab = 'all' | 'issues' | 'projects' | 'documents' | 'people'

export function SearchView() {
  const navigate = useNavigate()
  const data = useStore()
  const addRecentSearch = useStore((s) => s.addRecentSearch)
  const clearRecentSearches = useStore((s) => s.clearRecentSearches)
  const createView = useStore((s) => s.createView)

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(emptyFilters())
  const [tab, setTab] = useState<SearchTab>('all')
  const q = query.trim().toLowerCase()

  const issueResults = useMemo(() => {
    if (!q && !hasActiveFilters(filters)) return []
    let matched = data.issues.filter(
      (i) =>
        !i.triage &&
        (i.identifier.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)),
    )
    matched = filterIssues(matched, filters)
    return matched.slice(0, 50)
  }, [data, q, filters])

  // Issues whose *comments* match the query — Linear's full-text search also
  // covers discussion, surfacing the parent issue with a snippet of the
  // matching comment. We exclude issues already matched on title/description so
  // every result appears once, and apply the same filter chips.
  const commentResults = useMemo(() => {
    if (!q) return []
    const alreadyMatched = new Set(issueResults.map((i) => i.id))
    const seen = new Set<string>()
    const out: { issue: (typeof data.issues)[number]; snippet: string }[] = []
    for (const c of data.comments) {
      const idx = c.body.toLowerCase().indexOf(q)
      if (idx === -1) continue
      if (alreadyMatched.has(c.issueId) || seen.has(c.issueId)) continue
      const issue = data.issues.find((i) => i.id === c.issueId && !i.triage)
      if (!issue) continue
      if (filterIssues([issue], filters).length === 0) continue
      seen.add(c.issueId)
      // Build a short snippet centred on the match.
      const start = Math.max(0, idx - 30)
      const snippet =
        (start > 0 ? '…' : '') +
        c.body.slice(start, idx + q.length + 40).trim() +
        (idx + q.length + 40 < c.body.length ? '…' : '')
      out.push({ issue, snippet })
    }
    return out.slice(0, 25)
  }, [data, q, filters, issueResults])

  const projectResults = useMemo(() => {
    if (!q) return []
    return data.projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q),
    )
  }, [data, q])

  const documentResults = useMemo(() => {
    if (!q) return []
    return data.documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q),
    )
  }, [data, q])

  // Workspace members matched by name or email — Linear's search also surfaces
  // people, jumping to the member directory on select.
  const peopleResults = useMemo(() => {
    if (!q) return []
    return data.users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    )
  }, [data, q])

  // Cycles matched by their name or their "Cycle N" label — Linear's search
  // reaches every entity type, jumping to the team's cycles screen on select.
  const cycleResults = useMemo(() => {
    if (!q) return []
    return data.cycles.filter(
      (c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        `cycle ${c.number}`.includes(q),
    )
  }, [data, q])

  // Initiatives matched by name — a roadmap-level grouping of projects.
  const initiativeResults = useMemo(() => {
    if (!q) return []
    return data.initiatives.filter((i) => i.name.toLowerCase().includes(q))
  }, [data, q])

  // Customers matched by name or domain — Linear's CRM-lite records.
  const customerResults = useMemo(() => {
    if (!q) return []
    return data.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.domain ?? '').toLowerCase().includes(q),
    )
  }, [data, q])

  // Saved views matched by name — the user's pinned issue queries.
  const viewResults = useMemo(() => {
    if (!q) return []
    return data.savedViews.filter((v) => v.name.toLowerCase().includes(q))
  }, [data, q])

  // Labels matched by name (skipping group containers, which aren't routable).
  const labelResults = useMemo(() => {
    if (!q) return []
    return data.labels.filter(
      (l) => !l.isGroup && l.name.toLowerCase().includes(q),
    )
  }, [data, q])

  // Teams matched by name or key (e.g. "ENG").
  const teamResults = useMemo(() => {
    if (!q) return []
    return data.teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.key.toLowerCase().includes(q),
    )
  }, [data, q])

  const active = q.length > 0 || hasActiveFilters(filters)

  // Total matches across every entity type — shown as a muted count beside the
  // input (Linear surfaces a running result tally while you type).
  const totalResults =
    issueResults.length +
    commentResults.length +
    projectResults.length +
    documentResults.length +
    peopleResults.length +
    cycleResults.length +
    initiativeResults.length +
    customerResults.length +
    viewResults.length +
    labelResults.length +
    teamResults.length

  // Which groups render given the selected tab. The extra entity types only
  // surface in the "All" tab (Linear keeps the segmented tabs to the headline
  // types and folds the long tail into the unified results).
  const showIssues = tab === 'all' || tab === 'issues'
  const showProjects = tab === 'all' || tab === 'projects'
  const showDocuments = tab === 'all' || tab === 'documents'
  const showPeople = tab === 'all' || tab === 'people'
  const showExtras = tab === 'all'

  // Cycle → owning team key, for routing to the team's cycles screen (there is
  // no per-cycle route — Linear opens the team cycles list).
  const teamKeyById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const t of data.teams) m[t.id] = t.key
    return m
  }, [data.teams])
  const cycleHref = (teamId: string) => {
    const key = teamKeyById[teamId]
    return key ? `/team/${key}/cycles` : '/cycles'
  }

  // Flat list of every visible result in render order, each carrying the route
  // it opens. Mirrors the JSX grouping below so keyboard navigation lands on the
  // exact rows the user sees (Projects → Documents → Issues → comment matches →
  // People).
  const flatResults = useMemo(() => {
    const out: { key: string; href: string }[] = []
    if (showProjects)
      for (const p of projectResults) out.push({ key: p.id, href: `/project/${p.id}` })
    if (showDocuments)
      for (const d of documentResults) out.push({ key: d.id, href: `/document/${d.id}` })
    if (showIssues) {
      for (const i of issueResults)
        out.push({ key: i.id, href: `/issue/${i.identifier}` })
      for (const { issue } of commentResults)
        out.push({ key: issue.id, href: `/issue/${issue.identifier}` })
    }
    if (showPeople)
      for (const u of peopleResults) out.push({ key: u.id, href: '/members' })
    if (showExtras) {
      for (const c of cycleResults)
        out.push({ key: c.id, href: cycleHref(c.teamId) })
      for (const i of initiativeResults)
        out.push({ key: i.id, href: `/initiative/${i.id}` })
      for (const c of customerResults)
        out.push({ key: c.id, href: `/customer/${c.id}` })
      for (const v of viewResults)
        out.push({ key: v.id, href: `/view/${v.id}` })
      for (const l of labelResults)
        out.push({ key: l.id, href: `/label/${l.id}` })
      for (const t of teamResults)
        out.push({ key: t.id, href: `/team/${t.key}/overview` })
    }
    return out
  }, [
    showProjects,
    showDocuments,
    showIssues,
    showPeople,
    showExtras,
    projectResults,
    documentResults,
    issueResults,
    commentResults,
    peopleResults,
    cycleResults,
    initiativeResults,
    customerResults,
    viewResults,
    labelResults,
    teamResults,
    teamKeyById,
  ])

  // Highlighted result for keyboard navigation (j/k/↑/↓ to move, ↵ to open).
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset the cursor whenever the result set changes so it never points past
  // the end of the (possibly shorter) new list.
  useEffect(() => {
    setActiveIndex(0)
  }, [flatResults])

  // Keep the highlighted row scrolled into view as the cursor moves.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-result-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Window-level j/k/↑/↓/↵/o navigation so the cursor is drivable even when focus
  // isn't in the search box (Linear lets you move through results from anywhere on
  // the page). The input's own onKeyDown handles the focused-field case; this
  // listener covers the rest while mirroring the app's global-key guards.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!flatResults.length) return
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || !!t?.isContentEditable
      // Don't steal keys from any open menu / popover / modal (matches the
      // `[data-overlay]` guard in useShortcuts) or from the "Save as view" popover.
      if (document.querySelector('[data-overlay]')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // When focus is in the search box (or any other field), only the arrow keys
      // and ↵ drive the list — the input's onKeyDown owns those, so we bail here to
      // avoid double-handling, and never react to literal j/k/o while typing.
      if (typing) return

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1))
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' || e.key === 'o') {
        const hit = flatResults[activeIndex]
        if (hit) {
          e.preventDefault()
          if (query.trim()) addRecentSearch(query)
          navigate(hit.href)
        }
      } else if (e.key === 'Escape') {
        setActiveIndex(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flatResults, activeIndex, query, navigate, addRecentSearch])

  // Per-group offsets into `flatResults` so each rendered row knows its global
  // index for highlighting (groups render in the same order they were flattened).
  const projOffset = 0
  const docOffset = projOffset + (showProjects ? projectResults.length : 0)
  const issueOffset = docOffset + (showDocuments ? documentResults.length : 0)
  const commentOffset = issueOffset + (showIssues ? issueResults.length : 0)
  const peopleOffset =
    commentOffset + (showIssues ? commentResults.length : 0)
  const cycleOffset = peopleOffset + (showPeople ? peopleResults.length : 0)
  const initiativeOffset =
    cycleOffset + (showExtras ? cycleResults.length : 0)
  const customerOffset =
    initiativeOffset + (showExtras ? initiativeResults.length : 0)
  const viewOffset =
    customerOffset + (showExtras ? customerResults.length : 0)
  const labelOffset = viewOffset + (showExtras ? viewResults.length : 0)
  const teamOffset = labelOffset + (showExtras ? labelResults.length : 0)

  const tabs: { id: SearchTab; label: string; count: number }[] = [
    {
      id: 'all',
      label: 'All',
      count:
        issueResults.length +
        commentResults.length +
        projectResults.length +
        documentResults.length,
    },
    {
      id: 'issues',
      label: 'Issues',
      count: issueResults.length + commentResults.length,
    },
    { id: 'projects', label: 'Projects', count: projectResults.length },
    { id: 'documents', label: 'Documents', count: documentResults.length },
    { id: 'people', label: 'People', count: peopleResults.length },
  ]

  // Me-scope pills toggle the current user into the assignee / creator filters —
  // Linear's "Assigned to me" / "Created by me" quick scopes. Active state is
  // derived straight from the filter arrays so the pills and the FilterBar chips
  // stay in sync.
  const me = data.currentUserId
  const assignedToMe = filters.assigneeIds.includes(me)
  const createdByMe = (filters.creatorIds ?? []).includes(me)
  const toggleAssignedToMe = () =>
    setFilters((f) => ({
      ...f,
      assigneeIds: f.assigneeIds.includes(me)
        ? f.assigneeIds.filter((id) => id !== me)
        : [...f.assigneeIds, me],
    }))
  const toggleCreatedByMe = () =>
    setFilters((f) => {
      const creatorIds = f.creatorIds ?? []
      return {
        ...f,
        creatorIds: creatorIds.includes(me)
          ? creatorIds.filter((id) => id !== me)
          : [...creatorIds, me],
      }
    })

  // "Save as view" — persist the current query + filter chips as a SavedView and
  // jump to it. Linear lets you snapshot any active search/filter into a named
  // view from the header. The free-text query is folded into `filters.text` so
  // the saved view reproduces the same result set on its own list screen.
  const [savingView, setSavingView] = useState(false)
  const [viewName, setViewName] = useState('')
  const saveInputRef = useRef<HTMLInputElement>(null)

  const openSaveView = () => {
    // Seed the name with the current query for a sensible default.
    setViewName(query.trim())
    setSavingView(true)
  }

  // Focus the name input as soon as the popover opens.
  useEffect(() => {
    if (savingView) saveInputRef.current?.select()
  }, [savingView])

  const commitSaveView = () => {
    const name = viewName.trim()
    if (!name) return
    const text = query.trim()
    const viewFilters: typeof filters = {
      ...filters,
      ...(text ? { text } : {}),
    }
    const view = createView({
      name,
      icon: '🔍',
      layout: 'list',
      groupBy: 'status',
      orderBy: 'manual',
      filters: viewFilters,
    })
    setSavingView(false)
    setViewName('')
    navigate(`/view/${view.id}`)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="relative flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <SearchIcon size={16} className="text-faint" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Arrow keys move the result cursor; ↵ opens the highlighted result
            // (and records the search term). This keeps focus in the input so the
            // user can keep refining the query while navigating — like Linear.
            if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
              if (flatResults.length) {
                e.preventDefault()
                setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1))
              }
            } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
              if (flatResults.length) {
                e.preventDefault()
                setActiveIndex((i) => Math.max(i - 1, 0))
              }
            } else if (e.key === 'Enter') {
              if (query.trim()) addRecentSearch(query)
              const hit = flatResults[activeIndex]
              if (hit) {
                e.preventDefault()
                navigate(hit.href)
              }
            } else if (e.key === 'Escape' && query) {
              // Escape clears the query (back to recent searches) rather than
              // blurring or navigating away — matches Linear's search input.
              e.preventDefault()
              e.stopPropagation()
              setQuery('')
            }
          }}
          placeholder="Search issues, projects and documents…"
          className="flex-1 bg-transparent text-[15px] text-fg outline-none"
        />
        {active && (
          <div className="relative shrink-0">
            <button
              onClick={() => (savingView ? setSavingView(false) : openSaveView())}
              className={cn(
                'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] font-medium text-muted hover:bg-bg-hover hover:text-fg',
                savingView && 'bg-bg-hover text-fg',
              )}
              title="Save the current search and filters as a view"
            >
              <Save size={13} />
              Save as view
            </button>
            {savingView && (
              <>
                {/* Click-away backdrop closes the popover. */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setSavingView(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-border bg-bg-elevated p-2 shadow-lg">
                  <div className="mb-1.5 px-0.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                    Save as view
                  </div>
                  <input
                    ref={saveInputRef}
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitSaveView()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        e.stopPropagation()
                        setSavingView(false)
                      }
                    }}
                    placeholder="View name…"
                    className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
                  />
                  <div className="mt-2 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setSavingView(false)}
                      className="rounded-md px-2 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={commitSaveView}
                      disabled={!viewName.trim()}
                      className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {active && (
          <span className="shrink-0 text-[12px] tabular-nums text-faint">
            {totalResults === 0
              ? 'No results'
              : `${totalResults} result${totalResults === 1 ? '' : 's'}`}
          </span>
        )}
        {query && (
          <button onClick={() => setQuery('')} className="text-faint hover:text-fg">
            <X size={16} />
          </button>
        )}
      </header>

      <FilterBar filters={filters} onChange={setFilters} />

      <div ref={listRef} className="flex-1 overflow-y-auto">
        {!active ? (
          <div className="p-4">
            {data.recentSearches.length === 0 ? (
              <div className="mt-10 text-center text-[13px] text-faint">
                Search across every issue and project.
              </div>
            ) : (
              <div className="mx-auto max-w-2xl">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
                    Recent
                  </span>
                  <button
                    onClick={clearRecentSearches}
                    className="text-[12px] text-faint hover:text-fg"
                  >
                    Clear
                  </button>
                </div>
                {data.recentSearches.map((r) => (
                  <button
                    key={r}
                    onClick={() => setQuery(r)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
                  >
                    <Clock size={14} className="text-faint" />
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Entity-type tabs — narrow which result groups render. */}
            <div className="flex items-center gap-1 border-b border-border px-4 py-1.5">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium',
                    tab === t.id
                      ? 'bg-bg-selected text-fg'
                      : 'text-faint hover:bg-bg-hover hover:text-fg',
                  )}
                >
                  {t.label}
                  <span className="text-[11px] text-faint">{t.count}</span>
                </button>
              ))}
              {/* Me-scope pills — merge the current user into the filters. */}
              <span className="mx-1 h-4 w-px shrink-0 bg-border" />
              <button
                onClick={toggleAssignedToMe}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[12px] font-medium',
                  assignedToMe
                    ? 'bg-bg-selected text-fg'
                    : 'text-faint hover:bg-bg-hover hover:text-fg',
                )}
              >
                Assigned to me
              </button>
              <button
                onClick={toggleCreatedByMe}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[12px] font-medium',
                  createdByMe
                    ? 'bg-bg-selected text-fg'
                    : 'text-faint hover:bg-bg-hover hover:text-fg',
                )}
              >
                Created by me
              </button>
            </div>
            {issueResults.length === 0 &&
            commentResults.length === 0 &&
            projectResults.length === 0 &&
            documentResults.length === 0 &&
            peopleResults.length === 0 &&
            cycleResults.length === 0 &&
            initiativeResults.length === 0 &&
            customerResults.length === 0 &&
            viewResults.length === 0 &&
            labelResults.length === 0 &&
            teamResults.length === 0 ? (
              <EmptyState
                className="mt-10"
                illustration={<SearchIllustration />}
                title={`No results for “${query}”`}
                description="Try a different search term, or check your spelling."
              />
            ) : (
              <>
                {showProjects && projectResults.length > 0 && (
                  <div>
                    <div className="bg-bg-secondary/95 px-4 py-1.5 text-[12px] font-medium text-faint border-b border-border">
                      Projects · {projectResults.length}
                    </div>
                    {projectResults.map((p, idx) => {
                      const prog = projectProgress(p.id, data.issues, data)
                      const isActive = projOffset + idx === activeIndex
                      return (
                        <button
                          key={p.id}
                          data-result-active={isActive}
                          onMouseMove={() => setActiveIndex(projOffset + idx)}
                          onClick={() => navigate(`/project/${p.id}`)}
                          className={cn(
                            'flex w-full items-center gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-bg-hover',
                            isActive && 'bg-bg-hover',
                          )}
                        >
                          <span>{p.icon}</span>
                          <span className="text-[13px] text-fg">{p.name}</span>
                          <span className="text-[11px] text-faint">
                            {prog.done}/{prog.total} · {prog.percent}%
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {showDocuments && documentResults.length > 0 && (
                  <div>
                    <div className="bg-bg-secondary/95 px-4 py-1.5 text-[12px] font-medium text-faint border-b border-border">
                      Documents · {documentResults.length}
                    </div>
                    {documentResults.map((d, idx) => {
                      const isActive = docOffset + idx === activeIndex
                      return (
                      <button
                        key={d.id}
                        data-result-active={isActive}
                        onMouseMove={() => setActiveIndex(docOffset + idx)}
                        onClick={() => navigate(`/document/${d.id}`)}
                        className={cn(
                          'flex w-full items-center gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-bg-hover',
                          isActive && 'bg-bg-hover',
                        )}
                      >
                        <span className="text-[15px] leading-none">{d.icon}</span>
                        <span className="text-[13px] text-fg">
                          {d.title || 'Untitled'}
                        </span>
                        <span className="text-[11px] text-faint">
                          Updated {timeAgo(d.updatedAt)}
                        </span>
                      </button>
                      )
                    })}
                  </div>
                )}
                {showIssues &&
                  (issueResults.length > 0 || commentResults.length > 0) && (
                    <div>
                      <div className="bg-bg-secondary/95 px-4 py-1.5 text-[12px] font-medium text-faint border-b border-border">
                        Issues · {issueResults.length + commentResults.length}
                      </div>
                      {issueResults.map((i, idx) => {
                        const isActive = issueOffset + idx === activeIndex
                        return (
                          <div
                            key={i.id}
                            data-result-active={isActive}
                            onMouseMove={() => setActiveIndex(issueOffset + idx)}
                            className={cn(isActive && 'bg-bg-hover')}
                          >
                            <IssueRow issue={i} />
                          </div>
                        )
                      })}
                      {/* Issues matched only by a comment — show the parent issue
                          with a snippet of the matching discussion. */}
                      {commentResults.map(({ issue, snippet }, idx) => {
                        const isActive = commentOffset + idx === activeIndex
                        return (
                        <button
                          key={issue.id}
                          data-result-active={isActive}
                          onMouseMove={() => setActiveIndex(commentOffset + idx)}
                          onClick={() => navigate(`/issue/${issue.identifier}`)}
                          className={cn(
                            'flex w-full items-start gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-bg-hover',
                            isActive && 'bg-bg-hover',
                          )}
                        >
                          <MessageSquare
                            size={14}
                            className="mt-0.5 shrink-0 text-faint"
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="shrink-0 font-mono text-[11px] text-faint">
                                {issue.identifier}
                              </span>
                              <span className="truncate text-[13px] text-fg">
                                {issue.title}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-muted">
                              {snippet}
                            </span>
                          </span>
                        </button>
                        )
                      })}
                    </div>
                  )}
                {showPeople && peopleResults.length > 0 && (
                  <div>
                    <div className="bg-bg-secondary/95 px-4 py-1.5 text-[12px] font-medium text-faint border-b border-border">
                      People · {peopleResults.length}
                    </div>
                    {peopleResults.map((u, idx) => {
                      const isActive = peopleOffset + idx === activeIndex
                      return (
                        <button
                          key={u.id}
                          data-result-active={isActive}
                          onMouseMove={() => setActiveIndex(peopleOffset + idx)}
                          onClick={() => navigate('/members')}
                          className={cn(
                            'flex w-full items-center gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-bg-hover',
                            isActive && 'bg-bg-hover',
                          )}
                        >
                          <Avatar user={u} size={18} />
                          <span className="text-[13px] text-fg">{u.name}</span>
                          <span className="text-[11px] text-faint">{u.email}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {showExtras && cycleResults.length > 0 && (
                  <div>
                    <div className="bg-bg-secondary/95 px-4 py-1.5 text-[12px] font-medium text-faint border-b border-border">
                      Cycles · {cycleResults.length}
                    </div>
                    {cycleResults.map((c, idx) => {
                      const isActive = cycleOffset + idx === activeIndex
                      return (
                        <button
                          key={c.id}
                          data-result-active={isActive}
                          onMouseMove={() => setActiveIndex(cycleOffset + idx)}
                          onClick={() => navigate(cycleHref(c.teamId))}
                          className={cn(
                            'flex w-full items-center gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-bg-hover',
                            isActive && 'bg-bg-hover',
                          )}
                        >
                          <IterationCcw size={14} className="text-faint" />
                          <span className="text-[13px] text-fg">
                            Cycle {c.number}
                          </span>
                          {c.name && (
                            <span className="text-[11px] text-faint">
                              {c.name}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
                {showExtras && initiativeResults.length > 0 && (
                  <div>
                    <div className="bg-bg-secondary/95 px-4 py-1.5 text-[12px] font-medium text-faint border-b border-border">
                      Initiatives · {initiativeResults.length}
                    </div>
                    {initiativeResults.map((i, idx) => {
                      const isActive = initiativeOffset + idx === activeIndex
                      return (
                        <button
                          key={i.id}
                          data-result-active={isActive}
                          onMouseMove={() =>
                            setActiveIndex(initiativeOffset + idx)
                          }
                          onClick={() => navigate(`/initiative/${i.id}`)}
                          className={cn(
                            'flex w-full items-center gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-bg-hover',
                            isActive && 'bg-bg-hover',
                          )}
                        >
                          {i.icon ? (
                            <span className="text-[15px] leading-none">
                              {i.icon}
                            </span>
                          ) : (
                            <Target size={14} className="text-faint" />
                          )}
                          <span className="text-[13px] text-fg">{i.name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {showExtras && customerResults.length > 0 && (
                  <div>
                    <div className="bg-bg-secondary/95 px-4 py-1.5 text-[12px] font-medium text-faint border-b border-border">
                      Customers · {customerResults.length}
                    </div>
                    {customerResults.map((c, idx) => {
                      const isActive = customerOffset + idx === activeIndex
                      return (
                        <button
                          key={c.id}
                          data-result-active={isActive}
                          onMouseMove={() =>
                            setActiveIndex(customerOffset + idx)
                          }
                          onClick={() => navigate(`/customer/${c.id}`)}
                          className={cn(
                            'flex w-full items-center gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-bg-hover',
                            isActive && 'bg-bg-hover',
                          )}
                        >
                          <Building2 size={14} className="text-faint" />
                          <span className="text-[13px] text-fg">{c.name}</span>
                          {c.domain && (
                            <span className="text-[11px] text-faint">
                              {c.domain}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
                {showExtras && viewResults.length > 0 && (
                  <div>
                    <div className="bg-bg-secondary/95 px-4 py-1.5 text-[12px] font-medium text-faint border-b border-border">
                      Views · {viewResults.length}
                    </div>
                    {viewResults.map((v, idx) => {
                      const isActive = viewOffset + idx === activeIndex
                      return (
                        <button
                          key={v.id}
                          data-result-active={isActive}
                          onMouseMove={() => setActiveIndex(viewOffset + idx)}
                          onClick={() => navigate(`/view/${v.id}`)}
                          className={cn(
                            'flex w-full items-center gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-bg-hover',
                            isActive && 'bg-bg-hover',
                          )}
                        >
                          {v.icon ? (
                            <span className="text-[15px] leading-none">
                              {v.icon}
                            </span>
                          ) : (
                            <Bookmark size={14} className="text-faint" />
                          )}
                          <span className="text-[13px] text-fg">{v.name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {showExtras && labelResults.length > 0 && (
                  <div>
                    <div className="bg-bg-secondary/95 px-4 py-1.5 text-[12px] font-medium text-faint border-b border-border">
                      Labels · {labelResults.length}
                    </div>
                    {labelResults.map((l, idx) => {
                      const isActive = labelOffset + idx === activeIndex
                      return (
                        <button
                          key={l.id}
                          data-result-active={isActive}
                          onMouseMove={() => setActiveIndex(labelOffset + idx)}
                          onClick={() => navigate(`/label/${l.id}`)}
                          className={cn(
                            'flex w-full items-center gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-bg-hover',
                            isActive && 'bg-bg-hover',
                          )}
                        >
                          <LabelDot color={l.color} size={10} />
                          <span className="text-[13px] text-fg">{l.name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {showExtras && teamResults.length > 0 && (
                  <div>
                    <div className="bg-bg-secondary/95 px-4 py-1.5 text-[12px] font-medium text-faint border-b border-border">
                      Teams · {teamResults.length}
                    </div>
                    {teamResults.map((t, idx) => {
                      const isActive = teamOffset + idx === activeIndex
                      return (
                        <button
                          key={t.id}
                          data-result-active={isActive}
                          onMouseMove={() => setActiveIndex(teamOffset + idx)}
                          onClick={() => navigate(`/team/${t.key}/overview`)}
                          className={cn(
                            'flex w-full items-center gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-bg-hover',
                            isActive && 'bg-bg-hover',
                          )}
                        >
                          {t.icon ? (
                            <span className="text-[15px] leading-none">
                              {t.icon}
                            </span>
                          ) : (
                            <Users size={14} className="text-faint" />
                          )}
                          <span className="text-[13px] text-fg">{t.name}</span>
                          <span className="font-mono text-[11px] text-faint">
                            {t.key}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
