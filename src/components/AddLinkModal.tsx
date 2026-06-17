import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link as LinkIcon } from 'lucide-react'
import { useStore } from '@/lib/store'

/**
 * Linear's "Add link to CLA-N" modal (issue ⋯ → Add link… / ⌃L). A URL field
 * + optional title, then Cancel / Add link. Doubles as the edit-link dialog.
 */
export function AddLinkModal() {
  const store = useStore()
  const target = store.linkModal
  const issue = store.issues.find((i) => i.id === target?.issueId)
  const editing = target?.editId
    ? store.issueLinks.find((l) => l.id === target.editId)
    : undefined

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')

  // Seed the fields when the modal opens (edit prefills, add starts blank).
  useEffect(() => {
    if (target) {
      setUrl(editing?.url ?? '')
      setTitle(editing?.title ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.issueId, target?.editId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && target) store.closeLinkModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [target, store])

  if (!target || !issue) return null

  function submit() {
    const trimmed = url.trim()
    if (!trimmed) return
    if (editing) {
      store.updateIssueLink(editing.id, { url: trimmed, title })
    } else {
      store.addIssueLink(issue!.id, trimmed, title)
    }
    store.closeLinkModal()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-32 animate-fade"
      onMouseDown={() => store.closeLinkModal()}
    >
      <div
        className="w-[460px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated p-5 shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
      >
        <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-fg">
          <LinkIcon size={15} className="text-faint" />
          {editing ? 'Edit link' : `Add link to ${issue.identifier}`}
        </div>

        <label className="text-[12px] text-muted">URL</label>
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="mt-1 mb-3 w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none placeholder:text-faint focus:border-border-strong"
        />

        <label className="text-[12px] text-muted">
          Title <span className="text-faint">(optional)</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-border-strong"
        />

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => store.closeLinkModal()}
            className="rounded-md px-3 py-1.5 text-[13px] text-muted hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!url.trim()}
            onClick={submit}
            className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {editing ? 'Save' : 'Add link'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
