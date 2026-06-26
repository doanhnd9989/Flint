import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Share2, Globe, Lock } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { issueUrl } from '@/lib/utils'
import { copyToClipboard, copyToast } from '@/lib/toast'

/**
 * Linear's "Share issue" dialog (issue ⋯ → Share… ). Surfaces the public URL
 * with a copy button, plus a "Public access" toggle that exposes an embed
 * snippet once the issue is shared with anyone holding the link.
 */
export function ShareIssueModal() {
  const { shareIssueId, publicIssueIds } = useStoreShallow((s) => ({
    shareIssueId: s.shareIssueId,
    publicIssueIds: s.publicIssueIds,
  }))
  const issues = useStore((s) => s.issues)
  const closeShareIssue = useStore((s) => s.closeShareIssue)
  const toggleIssuePublic = useStore((s) => s.toggleIssuePublic)

  const issue = issues.find((i) => i.id === shareIssueId)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && shareIssueId) closeShareIssue()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [shareIssueId, closeShareIssue])

  if (!shareIssueId || !issue) return null

  const url = issueUrl(issue.identifier)
  const isPublic = publicIssueIds.includes(issue.id)
  const embed = `<iframe src="${url}/embed" width="600" height="400" frameborder="0"></iframe>`

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-32 animate-fade"
      onMouseDown={() => closeShareIssue()}
    >
      <div
        className="w-[480px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated p-5 shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start gap-2">
          <Share2 size={15} className="mt-0.5 shrink-0 text-faint" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-fg">
              Share {issue.identifier}
            </div>
            <div className="truncate text-[12px] text-muted">{issue.title}</div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => closeShareIssue()}
            className="-mr-1 -mt-1 rounded-md px-1.5 text-[18px] leading-none text-faint hover:bg-bg-hover hover:text-fg"
          >
            ×
          </button>
        </div>

        {/* URL + copy */}
        <label className="text-[12px] text-muted">Link</label>
        <div className="mb-4 mt-1 flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-border-strong"
          />
          <button
            type="button"
            onClick={() => copyToClipboard(url, copyToast.url())}
            className="shrink-0 rounded-md border border-border bg-bg-secondary px-3 py-1.5 text-[13px] text-fg hover:bg-bg-hover"
          >
            Copy link
          </button>
        </div>

        {/* Public access toggle */}
        <div className="rounded-md border border-border bg-bg-secondary p-3">
          <div className="flex items-center gap-3">
            {isPublic ? (
              <Globe size={16} className="shrink-0 text-faint" />
            ) : (
              <Lock size={16} className="shrink-0 text-faint" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-fg">
                Public access
              </div>
              <div className="text-[12px] text-muted">
                {isPublic
                  ? 'Anyone with the link can view this issue.'
                  : 'Only workspace members can access.'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              onClick={() => toggleIssuePublic(issue.id)}
              className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                isPublic ? 'bg-accent' : 'bg-bg-tertiary'
              }`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                  isPublic ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Embed snippet — only when public */}
          {isPublic && (
            <div className="mt-3 border-t border-border pt-3">
              <label className="text-[12px] text-muted">Embed</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  readOnly
                  value={embed}
                  onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 font-mono text-[12px] text-fg outline-none focus:border-border-strong"
                />
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(embed, 'Embed snippet copied to clipboard')
                  }
                  className="shrink-0 rounded-md border border-border bg-bg-secondary px-3 py-1.5 text-[13px] text-fg hover:bg-bg-hover"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={() => closeShareIssue()}
            className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
