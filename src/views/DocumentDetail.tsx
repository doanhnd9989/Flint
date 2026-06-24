import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, FolderKanban, Trash2 } from 'lucide-react'
import { useStore, useStoreShallow, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { ProjectPicker } from '@/components/pickers'
import { Popover } from '@/components/ui/Popover'
import { timeAgo } from '@/lib/utils'

// A small set of emoji to pick a document icon from (Linear opens a full emoji
// picker; we ship a representative grid).
const DOC_EMOJI = ['📄', '📝', '📋', '📐', '🎨', '🚀', '🧭', '💡', '📊', '🔖', '🗂️', '⚙️']

export function DocumentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fmt = useDisplayName()
  const doc = useStore((s) => s.documents.find((d) => d.id === id))
  const { users, projects, updateDocument, deleteDocument } = useStoreShallow((s) => ({
    users: s.users,
    projects: s.projects,
    updateDocument: s.updateDocument,
    deleteDocument: s.deleteDocument,
  }))

  if (!doc) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title="Document" />
        <div className="flex flex-1 items-center justify-center text-[13px] text-faint">
          This document no longer exists.
        </div>
      </div>
    )
  }

  const author = users.find((u) => u.id === doc.creatorId)
  const project = projects.find((p) => p.id === doc.projectId)

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={doc.title || 'Untitled'}
        right={
          <button
            type="button"
            title="Delete document"
            onClick={() => {
              if (confirm('Delete this document? You cannot undo this action.')) {
                deleteDocument(doc.id)
                navigate('/documents')
              }
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
          >
            <Trash2 size={15} />
          </button>
        }
      >
        <button
          type="button"
          onClick={() => navigate('/documents')}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg"
        >
          <ChevronLeft size={15} /> Documents
        </button>
      </ViewHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-10 py-10">
          {/* Icon + title */}
          <div className="flex items-start gap-3">
            <Popover
              align="start"
              width={220}
              trigger={
                <span className="cursor-pointer rounded-md px-1 text-[40px] leading-none hover:bg-bg-hover">
                  {doc.icon}
                </span>
              }
            >
              {(close) => (
                <div className="grid grid-cols-6 gap-1 p-1">
                  {DOC_EMOJI.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        updateDocument(doc.id, { icon: e })
                        close()
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[20px] hover:bg-bg-hover"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </Popover>
            <div className="min-w-0 flex-1">
              <input
                value={doc.title}
                onChange={(e) => updateDocument(doc.id, { title: e.target.value })}
                placeholder="Untitled"
                className="w-full bg-transparent text-[28px] font-semibold tracking-tight text-fg outline-none placeholder:text-faint"
              />
              <div className="mt-1 flex items-center gap-3 text-[12px] text-faint">
                <span>
                  {author ? fmt(author.name) : 'Someone'} · updated {timeAgo(doc.updatedAt)}
                </span>
                <ProjectPicker
                  projectId={doc.projectId}
                  onChange={(pid) => updateDocument(doc.id, { projectId: pid })}
                  trigger={
                    <span className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-muted hover:bg-bg-hover">
                      <FolderKanban size={13} className="text-faint" />
                      {project ? project.name : 'No project'}
                    </span>
                  }
                />
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="mt-6">
            <MarkdownEditor
              value={doc.content}
              onChange={(next) => updateDocument(doc.id, { content: next })}
              placeholder="Write something, or press / for commands…"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
