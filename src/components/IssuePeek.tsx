import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { IssueDetailBody } from './IssueDetailBody'
import { branchName, issueUrl } from '@/lib/utils'
import { copyToClipboard, copyToast } from '@/lib/toast'
import { X, Maximize2, Trash2, Link2, GitBranch } from 'lucide-react'

/** Linear-style "peek": opens an issue in a right-side panel over the list. */
export function IssuePeek() {
  const navigate = useNavigate()
  const store = useStore()
  const peekId = store.peekIssueId
  const issue = store.issues.find((i) => i.id === peekId)

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
        className="flex h-full w-[760px] max-w-[92vw] flex-col border-l border-border bg-bg shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3 text-[13px]">
          <span className="text-faint">
            {store.teams.find((t) => t.id === issue.teamId)?.name}
          </span>
          <span className="text-faint">›</span>
          <span className="font-mono text-faint">{issue.identifier}</span>
          <div className="flex-1" />
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
