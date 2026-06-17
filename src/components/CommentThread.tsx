import { useState } from 'react'
import type { Comment } from '@/lib/types'
import { useStore } from '@/lib/store'
import { Avatar } from './Avatar'
import { MentionInput } from './MentionInput'
import { CommentItem } from './CommentItem'

/**
 * A comment thread: the root comment, its replies on an indented left rail, and
 * a collapsed "Leave a reply…" composer at the bottom (Linear keeps threads one
 * level deep — every reply attaches to the thread root).
 */
export function CommentThread({ root, replies }: { root: Comment; replies: Comment[] }) {
  const store = useStore()
  const me = store.users.find((u) => u.isMe)
  const [replying, setReplying] = useState(false)
  const [draft, setDraft] = useState('')

  function submit() {
    const body = draft.trim()
    if (!body) return
    store.addComment(root.issueId, body, root.id)
    setDraft('')
    setReplying(false)
  }

  function cancel() {
    setReplying(false)
    setDraft('')
  }

  return (
    <div>
      <CommentItem comment={root} />
      {/* Rail aligns with the centre of the 22px root avatar (ml ≈ 11px). */}
      <div className="ml-[11px] mt-2 space-y-2 border-l border-border pl-4">
        {replies.map((r) => (
          <CommentItem key={r.id} comment={r} />
        ))}

        {replying ? (
          <div className="flex gap-2">
            <Avatar user={me} size={22} />
            <div className="flex-1">
              <MentionInput
                value={draft}
                onChange={setDraft}
                placeholder="Leave a reply… (@ to mention)"
                minHeight={56}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    submit()
                  } else if (e.key === 'Escape') {
                    cancel()
                  }
                }}
                className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-fg outline-none focus:border-border-strong"
              />
              <div className="mt-1.5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancel}
                  className="rounded-md px-2.5 py-1 text-[12px] text-muted hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!draft.trim()}
                  onClick={submit}
                  className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                >
                  Reply
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReplying(true)}
            className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-bg-hover"
          >
            <Avatar user={me} size={22} />
            <span className="text-[13px] text-faint">Leave a reply…</span>
          </button>
        )}
      </div>
    </div>
  )
}
