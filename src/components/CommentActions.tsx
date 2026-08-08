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
  Bell,
  BellOff,
  SquarePlus,
  ListPlus,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { Popover } from './ui/Popover'
import { EmojiPicker } from './EmojiPicker'
import { copyToClipboard } from '@/lib/toast'
import { useReplyDraft, quoteOf } from '@/lib/replyDraft'
import { cn, issueUrl } from '@/lib/utils'

/**
 * Linear's per-comment hover toolbar: an "Add reaction" picker and a
 * "Comment options" ⋯ menu. The menu follows Linear's order — Subscribe to
 * thread, Resolve thread, Copy link to comment, Copy content as Markdown,
 * New issue from comment…, New sub-issue from comment…, Delete — with Edit,
 * Quote reply and Pin comment as our own additions. Delete opens a
 * "Delete this comment?" confirmation. Shown on comment hover.
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
  // Absent on threads saved before subscribers existed — evaluate lazily.
  const subscribed = !!root?.subscriberIds?.includes(store.currentUserId)

  function copyLink() {
    if (!issue) return
    // Linear deep-links to the comment with a #comment-<id> fragment.
    copyToClipboard(
      `${issueUrl(issue.identifier)}#comment-${comment!.id}`,
      'Comment URL copied to clipboard',
    )
  }

  /**
   * Linear seeds the new-issue dialog from the comment: its first line becomes
   * the title, anything after it the description. `parent` makes it a sub-issue
   * of the issue the comment lives on.
   */
  function createFromComment(parent: boolean) {
    if (!issue) return
    const [first = '', ...rest] = comment!.body.split('\n')
    store.openCreateWith({
      teamId: issue.teamId,
      title: first.trim().slice(0, 120),
      description: rest.join('\n').trim(),
      parentId: parent ? issue.id : undefined,
    })
  }

  return (
    <>
      <div className="flex items-center gap-0.5">
        <Popover
          width={272}
          align="end"
          trigger={
            <span
              title="Add reaction"
              className="flex h-6 w-6 items-center justify-center rounded-md text-faint hover:bg-bg-hover hover:text-fg"
            >
              <SmilePlus size={14} />
            </span>
          }
        >
          {(close) => (
            <EmojiPicker
              onPick={(e) => {
                store.toggleReaction(commentId, e)
                close()
              }}
            />
          )}
        </Popover>

        <Popover
          width={248}
          align="end"
          trigger={
            <span
              title="Comment options"
              className="flex h-6 w-6 items-center justify-center rounded-md text-faint hover:bg-bg-hover hover:text-fg"
            >
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
                icon={subscribed ? <BellOff size={14} /> : <Bell size={14} />}
                label={subscribed ? 'Unsubscribe from thread' : 'Subscribe to thread'}
                onClick={() => {
                  close()
                  if (root) store.toggleThreadSubscription(root.id)
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
              {/* Pin acts on whole threads (Linear); only offered on the root. */}
              {(rootId == null || rootId === commentId) && (
                <MenuItem
                  icon={comment.pinnedAt ? <PinOff size={14} /> : <Pin size={14} />}
                  label={comment.pinnedAt ? 'Unpin comment' : 'Pin comment'}
                  onClick={() => {
                    close()
                    store.togglePinComment(commentId)
                  }}
                />
              )}
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
                icon={<SquarePlus size={14} />}
                label="New issue from comment…"
                onClick={() => {
                  close()
                  createFromComment(false)
                }}
              />
              <MenuItem
                icon={<ListPlus size={14} />}
                label="New sub-issue from comment…"
                onClick={() => {
                  close()
                  createFromComment(true)
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
