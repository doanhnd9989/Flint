import { useState } from 'react'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import type { Comment } from '@/lib/types'
import { useStore, useDisplayName } from '@/lib/store'
import { timeAgo } from '@/lib/utils'
import { Avatar } from './Avatar'
import { MentionInput } from './MentionInput'
import { CommentItem } from './CommentItem'

/** A one-line plain-text preview of a comment body (strips light Markdown). */
function snippet(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~\-]/g, '')
    .replace(/@\[([^\]]+)\]\([^)]*\)/g, '@$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A comment thread: the root comment, its replies on an indented left rail, and
 * a collapsed "Leave a reply…" composer at the bottom (Linear keeps threads one
 * level deep — every reply attaches to the thread root). Resolved threads
 * collapse into a single green-check summary bar that expands on click.
 */
export function CommentThread({ root, replies }: { root: Comment; replies: Comment[] }) {
  const store = useStore()
  const fmt = useDisplayName()
  const me = store.users.find((u) => u.isMe)
  const [replying, setReplying] = useState(false)
  const [draft, setDraft] = useState('')
  const [expanded, setExpanded] = useState(false)

  const resolved = !!root.resolvedAt
  // Resolved threads start collapsed; clicking the bar expands them.
  const collapsed = resolved && !expanded

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

  if (collapsed) {
    const author = store.users.find((u) => u.id === root.userId)
    const resolver = store.users.find((u) => u.id === root.resolvedBy)
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-left hover:bg-bg-hover"
      >
        <CheckCircle2 size={16} style={{ color: 'var(--c-green)' }} className="shrink-0" />
        <Avatar user={author} size={18} />
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
          <span className="font-medium text-fg">{fmt(author?.name)}</span> {snippet(root.body)}
        </span>
        {replies.length > 0 && (
          <span className="shrink-0 text-[12px] text-faint">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </span>
        )}
        <span className="shrink-0 text-[12px] text-faint">
          {fmt(resolver?.name) || 'Someone'} resolved
        </span>
        <ChevronRight size={14} className="shrink-0 text-faint" />
      </button>
    )
  }

  return (
    <div>
      {resolved && (
        <div className="mb-1.5 flex items-center gap-1.5 pl-[30px] text-[12px] text-muted">
          <CheckCircle2 size={13} style={{ color: 'var(--c-green)' }} />
          <span>
            Resolved by {fmt(store.users.find((u) => u.id === root.resolvedBy)?.name) || 'someone'} ·{' '}
            {timeAgo(root.resolvedAt!)}
          </span>
          <button
            type="button"
            onClick={() => store.toggleResolveThread(root.id)}
            className="ml-1 rounded px-1 text-accent hover:bg-bg-hover"
          >
            Unresolve
          </button>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded px-1 hover:bg-bg-hover"
          >
            Collapse
          </button>
        </div>
      )}
      <CommentItem comment={root} rootId={root.id} />
      {/* Rail aligns with the centre of the 22px root avatar (ml ≈ 11px). */}
      <div className="ml-[11px] mt-2 space-y-2 border-l border-border pl-4">
        {replies.map((r) => (
          <CommentItem key={r.id} comment={r} rootId={root.id} />
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
