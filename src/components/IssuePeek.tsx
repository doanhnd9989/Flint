import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { IssueDetailBody } from './IssueDetailBody'
import { IssueNav } from './IssueNav'
import { IssueOptionsMenu } from './IssueOptionsMenu'
import { branchName, issueUrl } from '@/lib/utils'
import { copyToClipboard, copyToast } from '@/lib/toast'
import { X, Maximize2, Trash2, Link2, GitBranch, Expand, Shrink } from 'lucide-react'

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
  // Linear's peek can be expanded to near full-width (and restored) without
  // leaving the list — distinct from "open full page", which navigates away.
  const [maximized, setMaximized] = useState(false)

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

  // A fresh peek always starts at its normal (resizable) width.
  useEffect(() => {
    setMaximized(false)
  }, [peekId])

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

  // j / ↓ → next issue, k / ↑ → previous — re-peek the neighbour without
  // closing the panel (Linear steps through the list in place). Reuses the same
  // ordered `navIssueIds` the IssueNav buttons above drive off of, clamping at
  // the ends (no wrap).
  useEffect(() => {
    if (!peekId) return
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      const isNext = key === 'j' || e.key === 'ArrowDown'
      const isPrev = key === 'k' || e.key === 'ArrowUp'
      if (!isNext && !isPrev) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // Bail while typing or when a menu/modal owns the keyboard (mirrors the
      // guard in useShortcuts).
      const active = document.activeElement as HTMLElement | null
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable)
      )
        return
      if (document.querySelector('[data-overlay]')) return

      const s = useStore.getState()
      const cur = s.issues.find((i) => i.id === s.peekIssueId)
      if (!cur) return
      const idx = s.navIssueIds.indexOf(cur.identifier)
      if (idx === -1) return
      const nextIdx = isNext ? idx + 1 : idx - 1
      if (nextIdx < 0 || nextIdx >= s.navIssueIds.length) return // clamp
      const target = s.issues.find((i) => i.identifier === s.navIssueIds[nextIdx])
      if (!target) return
      e.preventDefault()
      s.setPeek(target.id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [peekId])

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
        className={`relative flex h-full flex-col border-l border-border bg-bg shadow-lg animate-pop ${
          maximized ? 'w-[96vw] max-w-[1600px]' : 'max-w-[92vw]'
        }`}
        style={maximized ? undefined : { width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Left-edge resize grip — drag to size, double-click to reset.
            Hidden while maximized, where the width is fixed near full-screen. */}
        {!maximized && (
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
        )}
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
            title={maximized ? 'Restore panel width' : 'Expand panel'}
            onClick={() => setMaximized((m) => !m)}
            className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover"
          >
            {maximized ? <Shrink size={15} /> : <Expand size={15} />}
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

        {/* Keyboard legend — like Linear's peek, a quiet footer surfacing the
            key affordances. Purely presentational; the shortcuts live elsewhere. */}
        <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-border px-3 text-[11px] text-faint">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-secondary px-1 py-px font-mono text-[10px] leading-none">
              Esc
            </kbd>
            <span>Close</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-secondary px-1 py-px font-mono text-[10px] leading-none">
              ↵
            </kbd>
            <span>Open</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-secondary px-1 py-px font-mono text-[10px] leading-none">
              ↑
            </kbd>
            <kbd className="rounded border border-border bg-secondary px-1 py-px font-mono text-[10px] leading-none">
              ↓
            </kbd>
            <span>Navigate</span>
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
