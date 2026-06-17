import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon, Clock, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { filterIssues } from '@/lib/selectors'
import { IssueRow } from '@/components/IssueRow'
import { FilterBar, emptyFilters, hasActiveFilters } from '@/components/FilterBar'
import { projectProgress } from '@/lib/selectors'

export function SearchView() {
  const navigate = useNavigate()
  const data = useStore()
  const addRecentSearch = useStore((s) => s.addRecentSearch)
  const clearRecentSearches = useStore((s) => s.clearRecentSearches)

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(emptyFilters())
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

  const active = q.length > 0 || hasActiveFilters(filters)

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
          placeholder="Search issues and projects…"
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
            {issueResults.length === 0 && projectResults.length === 0 ? (
              <div className="mt-10 text-center text-[13px] text-faint">
                No results for “{query}”.
              </div>
            ) : (
              <>
                {projectResults.length > 0 && (
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
                {issueResults.length > 0 && (
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
