import { useNavigate } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { useStoreShallow, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState } from '@/components/EmptyState'
import { timeAgo } from '@/lib/utils'

/**
 * Documents list — Linear's Documents feature. Workspace-level rich-text docs,
 * each a row of icon + title + a muted "Updated {ago} by {name}" line. A "New
 * document" button (and the empty-state action) creates a fresh doc and opens
 * its editor.
 */
export function DocumentsView() {
  const navigate = useNavigate()
  const fmt = useDisplayName()
  const { documents, users, projects, createDocument } = useStoreShallow((s) => ({
    documents: s.documents,
    users: s.users,
    projects: s.projects,
    createDocument: s.createDocument,
  }))

  const sorted = [...documents].sort((a, b) => a.sortOrder - b.sortOrder)

  function create() {
    const doc = createDocument()
    navigate(`/document/${doc.id}`)
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Documents"
        right={
          <button
            type="button"
            onClick={create}
            className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[13px] font-medium text-white hover:bg-accent-hover"
          >
            <Plus size={14} /> New document
          </button>
        }
      />
      {sorted.length === 0 ? (
        <EmptyState
          illustration={<FileText size={34} strokeWidth={1.5} />}
          title="No documents yet"
          description="Documents are a place to write specs, notes, and plans — and link them to your projects."
          action={{ label: 'Create a document', onClick: create }}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-6">
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {sorted.map((doc) => {
                const author = users.find((u) => u.id === doc.creatorId)
                const project = projects.find((p) => p.id === doc.projectId)
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => navigate(`/document/${doc.id}`)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover"
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
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
