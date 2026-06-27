import { SmilePlus } from 'lucide-react'
import { useStoreShallow, useDisplayName } from '@/lib/store'
import { Popover } from '@/components/ui/Popover'
import { EmojiPicker } from '@/components/EmojiPicker'
import { cn } from '@/lib/utils'

/**
 * Emoji reaction pills shown under a project update (emoji + count, highlighted
 * when you reacted, reactor names on hover), followed by a trailing ghost "+"
 * button that opens the searchable emoji picker. Mirrors CommentReactions, but
 * the add-reaction affordance always renders so an update with no reactions yet
 * still has an entry point.
 */
export function ProjectUpdateReactions({ updateId }: { updateId: string }) {
  const { projectUpdates, users, currentUserId, toggleProjectUpdateReaction } = useStoreShallow(
    (s) => ({
      projectUpdates: s.projectUpdates,
      users: s.users,
      currentUserId: s.currentUserId,
      toggleProjectUpdateReaction: s.toggleProjectUpdateReaction,
    }),
  )
  const fmt = useDisplayName()
  const update = projectUpdates.find((u) => u.id === updateId)
  if (!update) return null
  const reactions = update.reactions ?? {}
  const entries = Object.entries(reactions).filter(([, ids]) => ids.length > 0)

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
            onClick={() => toggleProjectUpdateReaction(updateId, emoji)}
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
              toggleProjectUpdateReaction(updateId, emoji)
              close()
            }}
          />
        )}
      </Popover>
    </div>
  )
}
