import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleDot, LayersIcon, List, Rows3, Search, Star } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { cn } from '@/lib/utils'
import {
  EmptyState,
  SearchIllustration,
  StackIllustration,
} from '@/components/EmptyState'
import type { FavoriteType } from '@/lib/types'

/**
 * A single favorite row: leading icon, label, a navigate target, and a filled
 * star button (shown on hover or always) that un-stars the item.
 */
type Row = {
  key: string
  type: FavoriteType
  id: string
  to: string
  icon: ReactNode
  label: string
  /** Optional mono identifier prefix (issues). */
  identifier?: string
}

function FavoriteRow({
  row,
  focused,
  onFocus,
  rowRef,
}: {
  row: Row
  /** True when this row is the keyboard-navigation cursor target. */
  focused: boolean
  /** Sync the cursor to this row on hover, mirroring RecentView. */
  onFocus: () => void
  /** Captures the DOM node so the handler can scroll it into view. */
  rowRef: (el: HTMLDivElement | null) => void
}) {
  const navigate = useNavigate()
  const toggleFavorite = useStore((s) => s.toggleFavorite)

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      onClick={() => navigate(row.to)}
      onMouseEnter={onFocus}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(row.to)
        }
      }}
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-bg-hover',
        focused && 'bg-bg-hover',
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-faint">
        {row.icon}
      </span>
      {row.identifier && (
        <span className="shrink-0 font-mono text-[12px] text-faint">
          {row.identifier}
        </span>
      )}
      <span className="flex-1 truncate text-fg">{row.label}</span>
      <button
        type="button"
        title="Remove from favorites"
        onClick={(e) => {
          e.stopPropagation()
          toggleFavorite(row.type, row.id)
        }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-accent opacity-100 hover:bg-bg-hover"
      >
        <Star size={15} fill="currentColor" />
      </button>
    </div>
  )
}

/** Uppercase muted section header, mirroring the sidebar's Section style. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-faint">
        {title}
      </div>
      <div className="mt-0.5 space-y-px">{children}</div>
    </div>
  )
}

/** The type-filter segments — "all" plus each favorite kind. */
type FilterType = 'all' | FavoriteType

/** Display layout — grouped type sections vs. one flat alphabetical list. */
type LayoutMode = 'grouped' | 'list'

/**
 * Favorites — every starred issue, project, and saved view, grouped by type.
 * Each favorite resolves to its underlying entity; dangling references (whose
 * entity was deleted) are skipped. Un-starring removes a row immediately.
 *
 * A header offers a type-filter pill row (All · Issues · Projects · Views, with
 * live counts) and a search box that filters by title/name substring. Both are
 * local-only state and compose with AND.
 */
export function FavoritesView() {
  const navigate = useNavigate()
  const { favorites, issues, projects, savedViews } = useStoreShallow((s) => ({
    favorites: s.favorites,
    issues: s.issues,
    projects: s.projects,
    savedViews: s.savedViews,
  }))

  // Local-only header controls: the active type segment and a free-text query
  // (title/name substring). They compose with AND.
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')
  const [query, setQuery] = useState('')
  // Display layout: grouped type sections (default) or a single flat list.
  const [layout, setLayout] = useState<LayoutMode>('grouped')

  // Resolve every favorite to a display Row, grouped by type. Dangling
  // references (entity deleted) are skipped. This is the unfiltered pool, used
  // both for the segment counts and as the basis for the filtered render.
  const { issueRows, projectRows, viewRows } = useMemo(() => {
    const issueRows: Row[] = []
    const projectRows: Row[] = []
    const viewRows: Row[] = []

    for (const f of favorites) {
      if (f.type === 'issue') {
        const i = issues.find((x) => x.id === f.id)
        if (!i) continue
        issueRows.push({
          key: `issue-${i.id}`,
          type: 'issue',
          id: i.id,
          to: `/issue/${i.identifier}`,
          icon: <CircleDot size={15} />,
          label: i.title,
          identifier: i.identifier,
        })
      } else if (f.type === 'project') {
        const p = projects.find((x) => x.id === f.id)
        if (!p) continue
        projectRows.push({
          key: `project-${p.id}`,
          type: 'project',
          id: p.id,
          to: `/project/${p.id}`,
          icon: <span className="text-[13px]">{p.icon}</span>,
          label: p.name,
        })
      } else {
        const v = savedViews.find((x) => x.id === f.id)
        if (!v) continue
        viewRows.push({
          key: `view-${v.id}`,
          type: 'view',
          id: v.id,
          to: `/view/${v.id}`,
          icon: <LayersIcon size={15} />,
          label: v.name,
        })
      }
    }

    return { issueRows, projectRows, viewRows }
  }, [favorites, issues, projects, savedViews])

  const total = issueRows.length + projectRows.length + viewRows.length

  // Apply the header filters (type segment + query substring) with AND. A
  // section is shown only when the active segment includes its type.
  const { shownIssues, shownProjects, shownViews } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (rows: Row[], type: FavoriteType) => {
      if (typeFilter !== 'all' && typeFilter !== type) return []
      if (!q) return rows
      return rows.filter((r) => r.label.toLowerCase().includes(q))
    }
    return {
      shownIssues: match(issueRows, 'issue'),
      shownProjects: match(projectRows, 'project'),
      shownViews: match(viewRows, 'view'),
    }
  }, [issueRows, projectRows, viewRows, typeFilter, query])

  const shownTotal =
    shownIssues.length + shownProjects.length + shownViews.length

  // Flat-list layout: merge the shown rows into one list, sorted A→Z by label
  // (case-insensitive) so the single column reads like Linear's list display.
  const flatRows = useMemo(() => {
    return [...shownIssues, ...shownProjects, ...shownViews].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    )
  }, [shownIssues, shownProjects, shownViews])

  // Keyboard navigation — Linear lets you walk any list with j/k (or arrows) and
  // open the focused row with Enter/o. `navRows` is the flat visible order that
  // matches the rendered DOM: in flat-list layout it's `flatRows`, and in grouped
  // layout it's the sections concatenated in render order (issues → projects →
  // views), so the cursor never disagrees with what's on screen.
  const navRows = useMemo(
    () =>
      layout === 'list'
        ? flatRows
        : [...shownIssues, ...shownProjects, ...shownViews],
    [layout, flatRows, shownIssues, shownProjects, shownViews],
  )

  // `focusKey` tracks the highlighted row (by `row.key`); it's clamped to the
  // visible set so a filter/layout change never strands the cursor on a hidden
  // row.
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Keep the focus valid as the visible list shifts: default to the first row,
  // and drop a focus that no longer exists in the visible set.
  useEffect(() => {
    if (!navRows.length) {
      if (focusKey !== null) setFocusKey(null)
      return
    }
    if (!focusKey || !navRows.some((r) => r.key === focusKey)) {
      setFocusKey(navRows[0].key)
    }
  }, [navRows, focusKey])

  // Capture-phase key handler so it pre-empts the global shortcut handler (which
  // also binds j/k/arrows). Ignores typing in the search box / any open overlay.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onKeyRef.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      return
    if (document.querySelector('[data-overlay]')) return
    if (!navRows.length) return
    const idx = navRows.findIndex((r) => r.key === focusKey)
    const own = () => {
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    if (e.key === 'ArrowDown' || e.key === 'j') {
      own()
      setFocusKey((navRows[Math.min(idx + 1, navRows.length - 1)] ?? navRows[0]).key)
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'k') {
      own()
      setFocusKey((idx <= 0 ? navRows[0] : navRows[idx - 1]).key)
      return
    }
    if (e.key === 'Enter' || e.key === 'o') {
      const cur = navRows[idx]
      if (!cur) return
      own()
      navigate(cur.to)
    }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyRef.current(e)
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  // Scroll the focused row into view as the cursor walks past the viewport edge.
  useEffect(() => {
    if (focusKey) rowRefs.current[focusKey]?.scrollIntoView({ block: 'nearest' })
  }, [focusKey])

  // The segmented pill row — label + live count per type.
  const segments: { id: FilterType; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: total },
    { id: 'issue', label: 'Issues', count: issueRows.length },
    { id: 'project', label: 'Projects', count: projectRows.length },
    { id: 'view', label: 'Views', count: viewRows.length },
  ]

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Favorites">
        {total > 0 && (
          <span className="text-[12px] tabular-nums text-faint">{total}</span>
        )}
        {/* Header controls — type segments + search box, both local-only and
            composed with AND. Hidden when there are no favorites at all. */}
        {total > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg-tertiary p-0.5">
              {segments.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setTypeFilter(seg.id)}
                  className={cn(
                    'flex items-center gap-1 rounded px-2 py-0.5 text-[12px] transition-colors',
                    typeFilter === seg.id
                      ? 'bg-bg-selected text-fg'
                      : 'text-muted hover:text-fg',
                  )}
                >
                  <span>{seg.label}</span>
                  <span className="tabular-nums text-faint">{seg.count}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg-tertiary px-2 py-1 focus-within:border-accent">
              <Search size={13} className="shrink-0 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search favorites…"
                className="w-40 bg-transparent text-[12px] text-fg outline-none placeholder:text-faint"
              />
            </div>
            {/* Display toggle — grouped type sections vs. one flat list. */}
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg-tertiary p-0.5">
              <button
                type="button"
                title="Group by type"
                onClick={() => setLayout('grouped')}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded transition-colors',
                  layout === 'grouped'
                    ? 'bg-bg-selected text-fg'
                    : 'text-muted hover:text-fg',
                )}
              >
                <Rows3 size={14} />
              </button>
              <button
                type="button"
                title="Flat list"
                onClick={() => setLayout('list')}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded transition-colors',
                  layout === 'list'
                    ? 'bg-bg-selected text-fg'
                    : 'text-muted hover:text-fg',
                )}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        )}
      </ViewHeader>

      <div className="flex-1 overflow-y-auto">
        {total === 0 ? (
          <EmptyState
            illustration={<StackIllustration />}
            title="No favorites yet"
            description="Star an issue, project, or view to pin it here for quick access."
          />
        ) : shownTotal === 0 ? (
          <EmptyState
            illustration={<SearchIllustration />}
            title="No matching favorites"
            description="No favorites match your search or type filter."
          />
        ) : (
          <div className="mx-auto max-w-2xl px-4 py-6">
            {layout === 'list' ? (
              <div className="space-y-px">
                {flatRows.map((r) => (
                  <FavoriteRow
                    key={r.key}
                    row={r}
                    focused={focusKey === r.key}
                    onFocus={() => setFocusKey(r.key)}
                    rowRef={(el) => {
                      rowRefs.current[r.key] = el
                    }}
                  />
                ))}
              </div>
            ) : (
              <>
                {shownIssues.length > 0 && (
                  <Section title="Issues">
                    {shownIssues.map((r) => (
                      <FavoriteRow
                        key={r.key}
                        row={r}
                        focused={focusKey === r.key}
                        onFocus={() => setFocusKey(r.key)}
                        rowRef={(el) => {
                          rowRefs.current[r.key] = el
                        }}
                      />
                    ))}
                  </Section>
                )}
                {shownProjects.length > 0 && (
                  <Section title="Projects">
                    {shownProjects.map((r) => (
                      <FavoriteRow
                        key={r.key}
                        row={r}
                        focused={focusKey === r.key}
                        onFocus={() => setFocusKey(r.key)}
                        rowRef={(el) => {
                          rowRefs.current[r.key] = el
                        }}
                      />
                    ))}
                  </Section>
                )}
                {shownViews.length > 0 && (
                  <Section title="Views">
                    {shownViews.map((r) => (
                      <FavoriteRow
                        key={r.key}
                        row={r}
                        focused={focusKey === r.key}
                        onFocus={() => setFocusKey(r.key)}
                        rowRef={(el) => {
                          rowRefs.current[r.key] = el
                        }}
                      />
                    ))}
                  </Section>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
