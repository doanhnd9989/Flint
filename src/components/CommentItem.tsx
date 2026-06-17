import { useState } from 'react'
import type { Comment } from '@/lib/types'
import { useStore } from '@/lib/store'
import { Avatar } from './Avatar'
import { Markdown } from '@/lib/markdown'
import { MentionInput } from './MentionInput'
import { CommentReactions } from './CommentReactions'
import { CommentActions } from './CommentActions'
import { timeAgo } from '@/lib/utils'

/** A single comment: header, body (Markdown), reactions, hover toolbar, inline edit. */
export function CommentItem({ comment }: { comment: Comment }) {
  const store = useStore()
  const user = store.users.find((u) => u.id === comment.userId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)

  function save() {
    const body = draft.trim()
    if (body) store.editComment(comment.id, body)
    setEditing(false)
  }

  return (
    <div className="group flex gap-2">
      <Avatar user={user} size={22} />
      <div className="relative flex-1 rounded-lg border border-border bg-bg-secondary px-3 py-2">
        <div className="mb-0.5 flex items-center gap-2 text-[12px]">
          <span className="font-medium text-fg">{user?.name}</span>
          <span className="text-faint">{timeAgo(comment.createdAt)}</span>
          {comment.editedAt && <span className="text-faint">(edited)</span>}
        </div>

        {editing ? (
          <div>
            <MentionInput
              value={draft}
              onChange={setDraft}
              minHeight={56}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  save()
                } else if (e.key === 'Escape') {
                  setEditing(false)
                  setDraft(comment.body)
                }
              }}
              className="w-full resize-none rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-border-strong"
            />
            <div className="mt-1.5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setDraft(comment.body)
                }}
                className="rounded-md px-2.5 py-1 text-[12px] text-muted hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={save}
                className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-[13px] text-fg">
              <Markdown source={comment.body} />
            </div>
            <CommentReactions commentId={comment.id} />
            <div className="absolute right-1.5 top-1.5 rounded-md border border-border bg-bg-elevated opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
              <CommentActions commentId={comment.id} onEdit={() => setEditing(true)} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
