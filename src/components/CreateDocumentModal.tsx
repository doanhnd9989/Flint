import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { SelectMenu } from './ui/SelectMenu'
import type { SelectOption } from './ui/SelectMenu'

const chip =
  'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover'

// A small palette of document-flavored emoji to pick the doc icon from.
const ICONS = ['📄', '📝', '📒', '📕', '📗', '📘', '📙', '📚', '🗂️', '🧠', '💡', '🔖']

export function CreateDocumentModal() {
  const navigate = useNavigate()
  const store = useStore()
  const open = store.createDocumentOpen

  const [icon, setIcon] = useState('📄')
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (open) {
      setIcon('📄')
      setTitle('')
      setProjectId(undefined)
    }
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) store.setCreateDocumentOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, store])

  if (!open) return null

  const project = store.projects.find((p) => p.id === projectId)

  const iconOptions: SelectOption[] = ICONS.map((e) => ({
    id: e,
    label: e,
    icon: <span className="text-base">{e}</span>,
    selected: e === icon,
  }))
  const projectOptions: SelectOption[] = [
    {
      id: '__none',
      label: 'No project',
      icon: <span className="text-base">📄</span>,
      selected: !projectId,
    },
    ...store.projects.map((p) => ({
      id: p.id,
      label: p.name,
      icon: <span className="text-base">{p.icon ?? '📁'}</span>,
      selected: p.id === projectId,
    })),
  ]

  function submit() {
    if (!title.trim()) return
    const doc = store.createDocument({ title: title.trim(), icon, projectId })
    store.setCreateDocumentOpen(false)
    navigate(`/document/${doc.id}`)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-24 animate-fade"
      onMouseDown={() => store.setCreateDocumentOpen(false)}
    >
      <div
        className="w-[560px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[12px] text-muted">
          <span className="rounded-md bg-bg-tertiary px-1.5 py-0.5">{store.workspaceName}</span>
          <span>New document</span>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-start gap-2">
            <SelectMenu
              width={160}
              options={iconOptions}
              onSelect={setIcon}
              placeholder="Icon…"
              trigger={
                <span className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-bg-hover">
                  {icon}
                </span>
              }
            />
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="mt-0.5 flex-1 bg-transparent text-[16px] font-medium text-fg outline-none"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <SelectMenu
              options={projectOptions}
              onSelect={(pid) => setProjectId(pid === '__none' ? undefined : pid)}
              placeholder="Set project…"
              trigger={
                <span className={chip}>
                  <span className="text-base leading-none">{project?.icon ?? '📄'}</span>
                  {project?.name ?? 'No project'}
                </span>
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={() => store.setCreateDocumentOpen(false)}
            className="rounded-md px-3 py-1.5 text-[13px] text-muted hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!title.trim()}
            onClick={submit}
            className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Create document
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
