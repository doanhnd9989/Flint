import { useStoreShallow, useDisplayName } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * The reaction pills shown under a comment (emoji + count, highlighted when you
 * reacted, reactor names on hover). The add-reaction picker lives in the
 * comment's hover toolbar (`CommentActions`), matching Linear.
 */
export function CommentReactions({ commentId }: { commentId: string }) {
  const { comments, users, currentUserId, toggleReaction } = useStoreShallow((s) => ({
    comments: s.comments,
    users: s.users,
    currentUserId: s.currentUserId,
    toggleReaction: s.toggleReaction,
  }))
  const fmt = useDisplayName()
  const comment = comments.find((c) => c.id === commentId)
  if (!comment) return null
  const reactions = comment.reactions ?? {}
  const entries = Object.entries(reactions).filter(([, ids]) => ids.length > 0)
  if (entries.length === 0) return null

  const namesOf = (ids: string[]) =>
    ids.map((id) => fmt(users.find((u) => u.id === id)?.name) || '?').join(', ')

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {entries.map(([emoji, ids]) => {
        const mine = ids.includes(currentUserId)
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggleReaction(commentId, emoji)}
            title={namesOf(ids)}
            className={cn(
              'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[12px] transition-colors',
              mine
                ? 'border-accent bg-accent-subtle text-accent'
                : 'border-border bg-bg text-muted hover:bg-bg-hover',
            )}
          >
            <span>{emoji}</span>
            <span className="tabular-nums">{ids.length}</span>
          </button>
        )
      })}
    </div>
  )
}
