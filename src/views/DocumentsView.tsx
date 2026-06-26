import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownUp, ChevronDown, FileText, FolderOpen, LayoutGrid, List, Maximize2, Plus, Search, Star, Trash2 } from 'lucide-react'
import { useStoreShallow, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { StarButton } from '@/components/StarButton'
import { EmptyState } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { timeAgo } from '@/lib/utils'

/** Local-only sort modes for the documents list. */
type SortMode = 'updated' | 'created' | 'title'

const SORT_LABELS: Record<SortMode, string> = {
  updated: 'Last updated',
  created: 'Created',
  title: 'Title A→Z',
}

/** Local-only layout modes — Linear's Documents view offers list + grid. */
type Layout = 'list' | 'grid'

/** First chunk of body text for a card preview, stripped of blank lines. */
function snippet(content: string): string {
  const text = content.replace(/\s+/g, ' ').trim()
  return text.length > 160 ? `${text.slice(0, 160)}…` : text
}

/**
 * Documents list — Linear's Documents feature. Workspace-level rich-text docs,
 * each a row of icon + title + a muted "Updated {ago} by {name}" line. A "New
 * document" button (and the empty-state action) creates a fresh doc and opens
 * its editor. The header carries three local-only controls — a search box
 * (matches title + body text), a sort dropdown (Last updated · Created · Title
 * A→Z) and a project filter (All projects + each project + "No project") —
 * that all compose with AND.
 */
export function DocumentsView() {
  const navigate = useNavigate()
  const fmt = useDisplayName()
  const { documents, users, projects, favorites, createDocument, deleteDocument } = useStoreShallow((s) => ({
    documents: s.documents,
    users: s.users,
    projects: s.projects,
    favorites: s.favorites,
    createDocument: s.createDocument,
    deleteDocument: s.deleteDocument,
  }))

  // Local-only header controls: search + sort mode + project filter (AND).
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('updated')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [layout, setLayout] = useState<Layout>('list')

  // Apply the search query + project filter, then order by the sort mode.
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = documents.filter((d) => {
      // Project filter.
      if (projectFilter === 'none' && d.projectId) return false
      if (projectFilter !== 'all' && projectFilter !== 'none' && d.projectId !== projectFilter)
        return false
      // Search — matches title or body text (case-insensitive substring).
      if (q) {
        const hay = `${d.title || 'Untitled'} ${d.content}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    return [...filtered].sort((a, b) => {
      if (sort === 'title')
        return (a.title || 'Untitled').localeCompare(b.title || 'Untitled')
      if (sort === 'created') return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
      return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    })
  }, [documents, query, projectFilter, sort])

  // Set of favorited document ids (type 'document') — drives the pinned
  // "Favorites" section and each row/card's filled star.
  const favoriteIds = useMemo(
    () => new Set(favorites.filter((f) => f.type === 'document').map((f) => f.id)),
    [favorites],
  )

  // Split the filtered+sorted docs into a pinned favorites group + the rest,
  // each preserving the active sort order.
  const favoriteDocs = useMemo(
    () => sorted.filter((d) => favoriteIds.has(d.id)),
    [sorted, favoriteIds],
  )
  const otherDocs = useMemo(
    () => sorted.filter((d) => !favoriteIds.has(d.id)),
    [sorted, favoriteIds],
  )

  // Sort dropdown options.
  const sortOptions = useMemo<SelectOption[]>(
    () =>
      (Object.keys(SORT_LABELS) as SortMode[]).map((m) => ({
        id: m,
        label: SORT_LABELS[m],
        selected: sort === m,
      })),
    [sort],
  )

  // Project filter options: "All projects" + each project + "No project".
  const projectOptions = useMemo<SelectOption[]>(
    () => [
      { id: 'all', label: 'All projects', selected: projectFilter === 'all' },
      ...projects.map((p) => ({
        id: p.id,
        label: p.name,
        icon: <span>{p.icon}</span>,
        selected: projectFilter === p.id,
      })),
      {
        id: 'none',
        label: 'No project',
        icon: <FolderOpen size={14} className="text-faint" />,
        selected: projectFilter === 'none',
      },
    ],
    [projects, projectFilter],
  )

  // Label for the project-filter trigger chip.
  const projectFilterLabel =
    projectFilter === 'all'
      ? 'All projects'
      : projectFilter === 'none'
        ? 'No project'
        : (projects.find((p) => p.id === projectFilter)?.name ?? 'All projects')

  function create() {
    const doc = createDocument()
    navigate(`/document/${doc.id}`)
  }

  /** A bordered, divided list of document rows — each with a star toggle. */
  function listGroup(docs: typeof documents) {
    return (
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {docs.map((doc) => {
          const author = users.find((u) => u.id === doc.creatorId)
          const project = projects.find((p) => p.id === doc.projectId)
          return (
            <div
              key={doc.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/document/${doc.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/document/${doc.id}`)
                }
              }}
              className="group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover focus:outline-none focus-visible:border-accent"
            >
              <span className="text-[18px] leading-none">{doc.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-fg">
                  {doc.title || 'Untitled'}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-faint">
                  Updated {timeAgo(doc.updatedAt)}
                  {author ? ` by ${fmt(author.name)}` : ''}
                </span>
              </span>
              {project && (
                <span className="flex shrink-0 items-center gap-1 rounded-md bg-bg-tertiary px-1.5 py-0.5 text-[12px] text-muted">
                  <span>{project.icon}</span>
                  <span className="max-w-[140px] truncate">{project.name}</span>
                </span>
              )}
              {/* Star toggle — shows on hover unless already favorited. */}
              <span
                className={`shrink-0 transition-opacity ${
                  favoriteIds.has(doc.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <StarButton type="document" id={doc.id} size={14} />
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  /** A responsive grid of document cards — each with a star toggle. */
  function gridGroup(docs: typeof documents) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((doc) => {
          const author = users.find((u) => u.id === doc.creatorId)
          const project = projects.find((p) => p.id === doc.projectId)
          const preview = snippet(doc.content)
          const open = () => navigate(`/document/${doc.id}`)
          return (
            <div
              key={doc.id}
              role="button"
              tabIndex={0}
              onClick={open}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  open()
                }
              }}
              className="group relative flex h-40 cursor-pointer flex-col rounded-lg border border-border bg-bg p-4 text-left hover:bg-bg-hover focus:outline-none focus-visible:border-accent"
            >
              {/* Hover-revealed actions — star + open + delete, top-right. Each
                 stops propagation so it doesn't also open the card. A favorited
                 doc keeps its star visible even when not hovered. */}
              <div
                className={`absolute right-2 top-2 flex items-center gap-0.5 rounded-md border border-border bg-bg p-0.5 shadow-sm transition-opacity ${
                  favoriteIds.has(doc.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <StarButton type="document" id={doc.id} size={13} />
                <button
                  type="button"
                  title="Open document"
                  onClick={(e) => {
                    e.stopPropagation()
                    open()
                  }}
                  className="flex items-center rounded p-1 text-faint hover:bg-bg-hover hover:text-fg"
                >
                  <Maximize2 size={13} />
                </button>
                <button
                  type="button"
                  title="Delete document"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteDocument(doc.id)
                  }}
                  className="flex items-center rounded p-1 text-faint hover:bg-bg-hover hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[18px] leading-none">{doc.icon}</span>
                <span className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium text-fg">
                  {doc.title || 'Untitled'}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 flex-1 text-[12px] leading-relaxed text-muted">
                {preview || 'Empty document'}
              </p>
              <div className="mt-2 flex items-center gap-2 text-[12px] text-faint">
                <span className="truncate">
                  Updated {timeAgo(doc.updatedAt)}
                  {author ? ` by ${fmt(author.name)}` : ''}
                </span>
                {project && (
                  <span className="ml-auto flex shrink-0 items-center gap-1 rounded bg-bg-tertiary px-1.5 py-0.5 text-muted">
                    <span>{project.icon}</span>
                    <span className="max-w-[80px] truncate">{project.name}</span>
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Documents"
        right={
          <div className="flex items-center gap-2">
            {/* Search box — matches title + body text, composes via AND. */}
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg-tertiary px-2 py-1 focus-within:border-accent">
              <Search size={13} className="shrink-0 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents…"
                className="w-40 bg-transparent text-[12px] text-fg outline-none placeholder:text-faint"
              />
            </div>
            {/* Project filter — local-only, composes with sort via AND. */}
            <SelectMenu
              width={220}
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
            {/* Sort dropdown — Last updated (default) · Created · Title A→Z. */}
            <SelectMenu
              width={180}
              align="end"
              options={sortOptions}
              onSelect={(id) => setSort(id as SortMode)}
              placeholder="Sort by…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <ArrowDownUp size={13} className="shrink-0 text-faint" />
                  <span className="whitespace-nowrap">{SORT_LABELS[sort]}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
            {/* Layout toggle — list (default) vs grid of cards, like Linear. */}
            <div className="flex items-center rounded-md border border-border bg-bg-tertiary p-0.5">
              <button
                type="button"
                onClick={() => setLayout('list')}
                title="List"
                aria-pressed={layout === 'list'}
                className={`flex items-center rounded p-1 ${
                  layout === 'list' ? 'bg-bg text-fg' : 'text-faint hover:text-fg'
                }`}
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => setLayout('grid')}
                title="Grid"
                aria-pressed={layout === 'grid'}
                className={`flex items-center rounded p-1 ${
                  layout === 'grid' ? 'bg-bg text-fg' : 'text-faint hover:text-fg'
                }`}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={create}
              className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[13px] font-medium text-white hover:bg-accent-hover"
            >
              <Plus size={14} /> New document
            </button>
          </div>
        }
      />
      {documents.length === 0 ? (
        <EmptyState
          illustration={<FileText size={34} strokeWidth={1.5} />}
          title="No documents yet"
          description="Documents are a place to write specs, notes, and plans — and link them to your projects."
          action={{ label: 'Create a document', onClick: create }}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          illustration={<FileText size={34} strokeWidth={1.5} />}
          title="No matching documents"
          description="No documents match your search and the selected project filter."
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className={`mx-auto px-6 py-6 ${layout === 'grid' ? 'max-w-5xl' : 'max-w-3xl'}`}>
            {/* Favorited docs are pinned above the main list in their own
                section, matching how Projects/Views surface favorites. */}
            {favoriteDocs.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                  <Star size={12} className="fill-current text-[var(--status-started)]" />
                  Favorites
                </h2>
                {layout === 'list' ? listGroup(favoriteDocs) : gridGroup(favoriteDocs)}
              </div>
            )}
            {otherDocs.length > 0 &&
              (layout === 'list' ? listGroup(otherDocs) : gridGroup(otherDocs))}
          </div>
        </div>
      )}
    </div>
  )
}
