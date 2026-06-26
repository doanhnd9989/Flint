import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Layers, Search, Trash2 } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, StackIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'

// How the saved-views list is ordered. "name" is alphabetical (the default);
// "recent" mirrors creation recency — new views are appended to the store, so
// newest-created sorts first.
type SortKey = 'name' | 'recent'

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name A→Z',
  recent: 'Recently created',
}

export function ViewsView() {
  const navigate = useNavigate()
  const { savedViews, deleteView } = useStoreShallow((s) => ({
    savedViews: s.savedViews,
    deleteView: s.deleteView,
  }))

  // Local-only header controls: a free-text query (name substring) and a sort
  // order. The query filters; the sort reorders the (filtered) result.
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('name')

  // Apply the name filter, then sort. We copy before sorting so we never mutate
  // the store array. "recent" reverses insertion order (newest appended last).
  const views = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? savedViews.filter((v) => v.name.toLowerCase().includes(q))
      : savedViews
    if (sort === 'recent') return [...filtered].reverse()
    return [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )
  }, [savedViews, query, sort])

  // Sort options for the dropdown trigger.
  const sortOptions = useMemo<SelectOption[]>(
    () =>
      (Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({
        id: key,
        label: SORT_LABELS[key],
        selected: sort === key,
      })),
    [sort],
  )

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Views">
        <span className="text-[12px] tabular-nums text-faint">
          {savedViews.length}
        </span>
        {/* Header controls — search box + sort picker, both local-only. Hidden
            when there are no saved views at all. */}
        {savedViews.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg-tertiary px-2 py-1 focus-within:border-accent">
              <Search size={13} className="shrink-0 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search views…"
                className="w-40 bg-transparent text-[12px] text-fg outline-none placeholder:text-faint"
              />
            </div>
            <SelectMenu
              width={200}
              align="end"
              options={sortOptions}
              onSelect={(id) => setSort(id as SortKey)}
              placeholder="Sort by…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <span className="max-w-[120px] truncate">
                    {SORT_LABELS[sort]}
                  </span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
          </div>
        )}
      </ViewHeader>
      <div className="flex-1 overflow-y-auto p-4">
        {savedViews.length === 0 ? (
          <EmptyState
            illustration={<StackIllustration />}
            title="No saved views yet"
            description="Save a custom set of filters and grouping from the Issues view to reuse it here."
          />
        ) : views.length === 0 ? (
          <EmptyState
            illustration={<StackIllustration />}
            title="No matching views"
            description="No saved views match your search."
          />
        ) : (
          <div className="space-y-1">
            {views.map((v) => (
              <div
                key={v.id}
                className="group flex items-center gap-3 rounded-lg border border-border bg-bg-secondary px-3 py-2.5 hover:border-border-strong"
              >
                <button
                  onClick={() => navigate(`/view/${v.id}`)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <Layers size={16} className="text-faint" />
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-fg">{v.name}</div>
                    <div className="text-[11px] text-faint capitalize">
                      {v.layout} · grouped by {v.groupBy} · sorted by {v.orderBy}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete view "${v.name}"?`)) deleteView(v.id)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded text-faint opacity-0 hover:text-[var(--priority-urgent)] group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
