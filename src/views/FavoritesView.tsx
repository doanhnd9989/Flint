import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleDot, LayersIcon, Star } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, StackIllustration } from '@/components/EmptyState'
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

function FavoriteRow({ row }: { row: Row }) {
  const navigate = useNavigate()
  const toggleFavorite = useStore((s) => s.toggleFavorite)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(row.to)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(row.to)
        }
      }}
      className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-bg-hover"
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

/**
 * Favorites — every starred issue, project, and saved view, grouped by type.
 * Each favorite resolves to its underlying entity; dangling references (whose
 * entity was deleted) are skipped. Un-starring removes a row immediately.
 */
export function FavoritesView() {
  const { favorites, issues, projects, savedViews } = useStoreShallow((s) => ({
    favorites: s.favorites,
    issues: s.issues,
    projects: s.projects,
    savedViews: s.savedViews,
  }))

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

  const total = issueRows.length + projectRows.length + viewRows.length

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Favorites">
        {total > 0 && <span className="text-[12px] text-faint">{total}</span>}
      </ViewHeader>

      <div className="flex-1 overflow-y-auto">
        {total === 0 ? (
          <EmptyState
            illustration={<StackIllustration />}
            title="No favorites yet"
            description="Star an issue, project, or view to pin it here for quick access."
          />
        ) : (
          <div className="mx-auto max-w-2xl px-4 py-6">
            {issueRows.length > 0 && (
              <Section title="Issues">
                {issueRows.map((r) => (
                  <FavoriteRow key={r.key} row={r} />
                ))}
              </Section>
            )}
            {projectRows.length > 0 && (
              <Section title="Projects">
                {projectRows.map((r) => (
                  <FavoriteRow key={r.key} row={r} />
                ))}
              </Section>
            )}
            {viewRows.length > 0 && (
              <Section title="Views">
                {viewRows.map((r) => (
                  <FavoriteRow key={r.key} row={r} />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
