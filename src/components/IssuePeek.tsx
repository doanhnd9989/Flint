import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { IssueDetailBody } from './IssueDetailBody'
import { IssueNav } from './IssueNav'
import { IssueOptionsMenu } from './IssueOptionsMenu'
import { branchName, issueUrl } from '@/lib/utils'
import { copyToClipboard, copyToast } from '@/lib/toast'
import { X, Maximize2, Trash2, Link2, GitBranch } from 'lucide-react'

// Drag-to-resize bounds for the panel (Linear lets you widen/narrow the peek).
const MIN_W = 520
const MAX_W = 1100
const DEFAULT_W = 760
const WIDTH_KEY = 'flint:peek-width'

function readStoredWidth(): number {
  const raw = Number(localStorage.getItem(WIDTH_KEY))
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_W
  return Math.min(MAX_W, Math.max(MIN_W, raw))
}

/** Linear-style "peek": opens an issue in a right-side panel over the list. */
export function IssuePeek() {
  const navigate = useNavigate()
  const store = useStore()
  const peekId = store.peekIssueId
  const issue = store.issues.find((i) => i.id === peekId)

  // Linear's peek/split panel can be dragged wider or narrower from its left
  // edge; the chosen width sticks across opens (persisted to localStorage).
  const [width, setWidth] = useState(readStoredWidth)
  const [dragging, setDragging] = useState(false)

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      // Panel is anchored to the right edge, so width grows as the cursor moves left.
      const next = Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX))
      setWidth(next)
    }
    const onUp = () => {
      setDragging(false)
      setWidth((w) => {
        localStorage.setItem(WIDTH_KEY, String(w))
        return w
      })
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  useEffect(() => {
    if (!peekId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement
        // let inputs handle their own Escape first
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        store.setPeek(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [peekId, store])

  if (!peekId || !issue) return null

  const close = () => store.setPeek(null)
  const openFull = () => {
    close()
    navigate(`/issue/${issue.identifier}`)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex justify-end bg-bg-overlay animate-fade"
      onMouseDown={close}
    >
      <div
        className="relative flex h-full max-w-[92vw] flex-col border-l border-border bg-bg shadow-lg animate-pop"
        style={{ width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Left-edge resize grip — drag to size, double-click to reset. */}
        <div
          title="Drag to resize"
          onMouseDown={startResize}
          onDoubleClick={() => {
            setWidth(DEFAULT_W)
            localStorage.setItem(WIDTH_KEY, String(DEFAULT_W))
          }}
          className="absolute left-0 top-0 z-10 h-full w-1 -translate-x-1/2 cursor-col-resize"
        >
          <span
            className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 ${
              dragging ? 'bg-accent' : 'bg-transparent hover:bg-accent'
            }`}
          />
        </div>
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3 text-[13px]">
          <span className="text-faint">
            {store.teams.find((t) => t.id === issue.teamId)?.name}
          </span>
          <span className="text-faint">›</span>
          <span className="font-mono text-faint">{issue.identifier}</span>
          <IssueOptionsMenu
            issue={issue}
            onOpenIssue={(id) => {
              const next = store.issues.find((i) => i.identifier === id)
              if (next) store.setPeek(next.id)
            }}
            onDeleted={close}
          />
          <div className="flex-1" />
          <IssueNav
            identifier={issue.identifier}
            onGo={(id) => {
              const next = store.issues.find((i) => i.identifier === id)
              if (next) store.setPeek(next.id)
            }}
          />
          <button
            title="Copy git branch name"
            onClick={() =>
              copyToClipboard(
                branchName(issue.identifier, issue.title, store.users.find((u) => u.isMe)),
                copyToast.branch(),
              )
            }
            className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover"
          >
            <GitBranch size={15} />
          </button>
          <button
            title="Copy issue URL"
            onClick={() => copyToClipboard(issueUrl(issue.identifier), copyToast.url())}
            className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover"
          >
            <Link2 size={15} />
          </button>
          <button
            title="Delete issue"
            onClick={() => {
              store.deleteIssue(issue.id)
              close()
            }}
            className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
          >
            <Trash2 size={15} />
          </button>
          <button
            title="Open full page"
            onClick={openFull}
            className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover"
          >
            <Maximize2 size={15} />
          </button>
          <button
            title="Close (Esc)"
            onClick={close}
            className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover"
          >
            <X size={16} />
          </button>
        </header>

        <IssueDetailBody
          issue={issue}
          compact
          onOpenIssue={(id) => {
            const next = store.issues.find((i) => i.identifier === id)
            if (next) store.setPeek(next.id)
          }}
        />
      </div>
    </div>,
    document.body,
  )
}
