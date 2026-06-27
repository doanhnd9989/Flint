import { Pin, PinOff } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * Linear's "Pin to sidebar" control for an issue — pins/unpins the current
 * issue so it surfaces in the sidebar's "Pinned" section. Rendered as a
 * Properties-panel row trigger, mirroring {@link IssueSnooze}: a single
 * full-width button with a lucide icon + label. Single-value selectors keep us
 * clear of Zustand v5's object-literal render loops.
 */
export function IssuePinButton({ issueId }: { issueId: string }) {
  const pinned = useStore((s) => s.pinnedIssueIds.includes(issueId))
  const toggle = useStore((s) => s.toggleIssuePinned)

  return (
    <button
      type="button"
      onClick={() => toggle(issueId)}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] hover:bg-bg-hover',
        pinned ? 'text-accent' : 'text-faint hover:text-fg',
      )}
    >
      {pinned ? (
        <Pin size={14} className="text-accent fill-current" />
      ) : (
        <PinOff size={14} className="text-faint" />
      )}
      <span>{pinned ? 'Pinned' : 'Pin'}</span>
    </button>
  )
}
