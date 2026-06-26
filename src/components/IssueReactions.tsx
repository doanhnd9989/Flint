import { SmilePlus } from 'lucide-react'
import type { Issue } from '@/lib/types'
import { useStoreShallow, useDisplayName } from '@/lib/store'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'

/** Same emoji set the comment reaction picker uses (CommentActions). */
const EMOJIS = ['👍', '❤️', '🎉', '🚀', '👀', '😄', '🙏', '🔥', '💯', '😅', '🤔', '👏']

/**
 * Emoji reactions on an issue itself, mirroring `CommentReactions`: a row of
 * reaction pills (emoji + count, accent ring when you reacted, reactor names on
 * hover) plus an "add reaction" affordance that opens an emoji-picker popover.
 */
export function IssueReactions({ issue }: { issue: Issue }) {
  const { users, currentUserId, toggleIssueReaction } = useStoreShallow((s) => ({
    users: s.users,
    currentUserId: s.currentUserId,
    toggleIssueReaction: s.toggleIssueReaction,
  }))
  const fmt = useDisplayName()

  const reactions = issue.reactions ?? {}
  const entries = Object.entries(reactions).filter(([, ids]) => ids.length > 0)

  const namesOf = (ids: string[]) =>
    ids.map((id) => fmt(users.find((u) => u.id === id)?.name) || '?').join(', ')

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {entries.map(([emoji, ids]) => {
        const mine = ids.includes(currentUserId)
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggleIssueReaction(issue.id, emoji)}
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
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-faint hover:bg-bg-hover hover:text-fg"
            title="Add reaction"
          >
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
                  toggleIssueReaction(issue.id, e)
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
