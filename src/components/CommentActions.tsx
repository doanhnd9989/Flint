import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  SmilePlus,
  MoreHorizontal,
  Pencil,
  Link2,
  Copy,
  Trash2,
  CheckCircle2,
  Circle,
  Pin,
  PinOff,
  Quote,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { Popover } from './ui/Popover'
import { copyToClipboard } from '@/lib/toast'
import { useReplyDraft, quoteOf } from '@/lib/replyDraft'
import { cn, issueUrl } from '@/lib/utils'

const EMOJIS = ['👍', '❤️', '🎉', '🚀', '👀', '😄', '🙏', '🔥', '💯', '😅', '🤔', '👏']

/**
 * Linear's per-comment hover toolbar: a quick add-reaction picker and a ⋯
 * overflow menu (Edit / Copy link / Copy content as Markdown / Delete). Delete
 * opens a "Delete this comment?" confirmation. Shown on comment hover.
 */
export function CommentActions({
  commentId,
  rootId,
  onEdit,
}: {
  commentId: string
  /** Thread root — "Resolve thread" always acts on it. Defaults to this comment. */
  rootId?: string
  onEdit: () => void
}) {
  const store = useStore()
  const comment = store.comments.find((c) => c.id === commentId)
  const root = store.comments.find((c) => c.id === (rootId ?? commentId))
  const [confirm, setConfirm] = useState(false)
  if (!comment) return null

  const issue = store.issues.find((i) => i.id === comment.issueId)
  const resolved = !!root?.resolvedAt

  function copyLink() {
    if (!issue) return
    // Linear deep-links to the comment with a #comment-<id> fragment.
    copyToClipboard(
      `${issueUrl(issue.identifier)}#comment-${comment!.id}`,
      'Comment URL copied to clipboard',
    )
  }

  return (
    <>
      <div className="flex items-center gap-0.5">
        <Popover
          width={196}
          align="end"
          trigger={
            <span className="flex h-6 w-6 items-center justify-center rounded-md text-faint hover:bg-bg-hover hover:text-fg">
              <SmilePlus size={14} />
            </span>
          }
        >
          {(close) => (
            <div className="grid grid-cols-6 gap-0.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    store.toggleReaction(commentId, e)
                    close()
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[16px] hover:bg-bg-hover"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </Popover>

        <Popover
          width={232}
          align="end"
          trigger={
            <span className="flex h-6 w-6 items-center justify-center rounded-md text-faint hover:bg-bg-hover hover:text-fg">
              <MoreHorizontal size={14} />
            </span>
          }
        >
          {(close) => (
            <div className="text-[13px] text-fg">
              <MenuItem
                icon={<Pencil size={14} />}
                label="Edit"
                onClick={() => {
                  close()
                  onEdit()
                }}
              />
              <MenuItem
                icon={resolved ? <Circle size={14} /> : <CheckCircle2 size={14} />}
                label={resolved ? 'Unresolve thread' : 'Resolve thread'}
                onClick={() => {
                  close()
                  if (root) store.toggleResolveThread(root.id)
                }}
              />
              <MenuItem
                icon={<Quote size={14} />}
                label="Quote reply"
                onClick={() => {
                  close()
                  useReplyDraft
                    .getState()
                    .set(rootId ?? commentId, quoteOf(comment.body))
                }}
              />
              <MenuItem
                icon={comment.pinnedAt ? <PinOff size={14} /> : <Pin size={14} />}
                label={comment.pinnedAt ? 'Unpin comment' : 'Pin comment'}
                onClick={() => {
                  close()
                  store.togglePinComment(commentId)
                }}
              />
              <div className="my-1 border-t border-border" />
              <MenuItem
                icon={<Link2 size={14} />}
                label="Copy link to comment"
                onClick={() => {
                  close()
                  copyLink()
                }}
              />
              <MenuItem
                icon={<Copy size={14} />}
                label="Copy content as Markdown"
                onClick={() => {
                  close()
                  copyToClipboard(comment.body, 'Copied to clipboard')
                }}
              />
              <div className="my-1 border-t border-border" />
              <MenuItem
                icon={<Trash2 size={14} />}
                label="Delete"
                destructive
                onClick={() => {
                  close()
                  setConfirm(true)
                }}
              />
            </div>
          )}
        </Popover>
      </div>

      {confirm &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-[28vh] animate-fade"
            onMouseDown={() => setConfirm(false)}
          >
            <div
              className="w-[400px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated p-5 shadow-lg animate-pop"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="text-[15px] font-semibold text-fg">
                Delete this comment?
              </div>
              <div className="mt-1 text-[13px] text-muted">
                You cannot undo this action.
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  className="rounded-md px-3 py-1.5 text-[13px] text-muted hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    store.deleteComment(commentId)
                    setConfirm(false)
                  }}
                  className="rounded-md px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
                  style={{ background: 'var(--c-red)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-bg-hover',
        !destructive && 'text-fg',
      )}
      style={destructive ? { color: 'var(--c-red)' } : undefined}
    >
      <span style={destructive ? { color: 'var(--c-red)' } : undefined} className={destructive ? undefined : 'text-faint'}>
        {icon}
      </span>
      {label}
    </button>
  )
}
