import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon, Clock, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { filterIssues } from '@/lib/selectors'
import { IssueRow } from '@/components/IssueRow'
import { FilterBar, emptyFilters, hasActiveFilters } from '@/components/FilterBar'
import { projectProgress } from '@/lib/selectors'
import { EmptyState, SearchIllustration } from '@/components/EmptyState'
import { timeAgo, cn } from '@/lib/utils'

/** Entity-type filter for the search results (Linear's segmented tabs). */
type SearchTab = 'all' | 'issues' | 'projects' | 'documents'

export function SearchView() {
  const navigate = useNavigate()
  const data = useStore()
  const addRecentSearch = useStore((s) => s.addRecentSearch)
  const clearRecentSearches = useStore((s) => s.clearRecentSearches)

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

  const active = q.length > 0 || hasActiveFilters(filters)

  // Which groups render given the selected tab.
  const showIssues = tab === 'all' || tab === 'issues'
  const showProjects = tab === 'all' || tab === 'projects'
  const showDocuments = tab === 'all' || tab === 'documents'

  const tabs: { id: SearchTab; label: string; count: number }[] = [
    {
      id: 'all',
      label: 'All',
      count:
        issueResults.length + projectResults.length + documentResults.length,
    },
    { id: 'issues', label: 'Issues', count: issueResults.length },
    { id: 'projects', label: 'Projects', count: projectResults.length },
    { id: 'documents', label: 'Documents', count: documentResults.length },
  ]

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <SearchIcon size={16} className="text-faint" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) addRecentSearch(query)
          }}
          placeholder="Search issues, projects and documents…"
          className="flex-1 bg-transparent text-[15px] text-fg outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-faint hover:text-fg">
            <X size={16} />
          </button>
        )}
      </header>

      <FilterBar filters={filters} onChange={setFilters} />

      <div className="flex-1 overflow-y-auto">
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
            </div>
            {issueResults.length === 0 &&
            projectResults.length === 0 &&
            documentResults.length === 0 ? (
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
                    {projectResults.map((p) => {
                      const prog = projectProgress(p.id, data.issues, data)
                      return (
                        <button
                          key={p.id}
                          onClick={() => navigate(`/project/${p.id}`)}
                          className="flex w-full items-center gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-bg-hover"
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
                    {documentResults.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => navigate(`/document/${d.id}`)}
                        className="flex w-full items-center gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-bg-hover"
                      >
                        <span className="text-[15px] leading-none">{d.icon}</span>
                        <span className="text-[13px] text-fg">
                          {d.title || 'Untitled'}
                        </span>
                        <span className="text-[11px] text-faint">
                          Updated {timeAgo(d.updatedAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {showIssues && issueResults.length > 0 && (
                  <div>
                    <div className="bg-bg-secondary/95 px-4 py-1.5 text-[12px] font-medium text-faint border-b border-border">
                      Issues · {issueResults.length}
                    </div>
                    {issueResults.map((i) => (
                      <IssueRow key={i.id} issue={i} />
                    ))}
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
