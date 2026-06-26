import { SmilePlus } from 'lucide-react'
import { useStoreShallow, useDisplayName } from '@/lib/store'
import { Popover } from '@/components/ui/Popover'
import { EmojiPicker } from '@/components/EmojiPicker'
import { cn } from '@/lib/utils'

/**
 * The reaction pills shown under a comment (emoji + count, highlighted when you
 * reacted, reactor names on hover) followed by a trailing ghost "+" button that
 * opens the searchable emoji picker. Mirrors Linear, where the add-reaction
 * affordance sits at the end of the pill row once a comment has reactions.
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
  // No pills yet → the hover toolbar's picker (CommentActions) is the entry
  // point; we only render the inline row once there's at least one reaction.
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

      <Popover
        width={264}
        trigger={
          <span
            className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-border text-faint hover:bg-bg-hover hover:text-fg"
            title="Add reaction"
          >
            <SmilePlus size={13} />
          </span>
        }
      >
        {(close) => (
          <EmojiPicker
            onPick={(emoji) => {
              toggleReaction(commentId, emoji)
              close()
            }}
          />
        )}
      </Popover>
    </div>
  )
}
