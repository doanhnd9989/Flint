import { SmilePlus } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import { Popover } from './ui/Popover'
import { cn } from '@/lib/utils'

const EMOJIS = ['👍', '❤️', '🎉', '🚀', '👀', '😄', '🙏', '🔥', '💯', '😅', '🤔', '👏']

export function CommentReactions({ commentId }: { commentId: string }) {
  const { comments, users, currentUserId, toggleReaction } = useStoreShallow((s) => ({
    comments: s.comments,
    users: s.users,
    currentUserId: s.currentUserId,
    toggleReaction: s.toggleReaction,
  }))
  const comment = comments.find((c) => c.id === commentId)
  if (!comment) return null
  const reactions = comment.reactions ?? {}
  const entries = Object.entries(reactions).filter(([, ids]) => ids.length > 0)

  const namesOf = (ids: string[]) =>
    ids.map((id) => users.find((u) => u.id === id)?.name ?? '?').join(', ')

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
        width={196}
        trigger={
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-faint hover:bg-bg-hover hover:text-fg">
            <SmilePlus size={13} />
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
                  toggleReaction(commentId, e)
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
    </div>
  )
}
