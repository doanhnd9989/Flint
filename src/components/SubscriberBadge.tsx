import { Users } from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'

/**
 * A compact subscriber-count chip for an issue's meta row / board-card footer —
 * mirrors Linear, which surfaces a small people glyph + count once an issue has
 * *more than one* subscriber (a lone self-subscribe is noise, so it stays
 * hidden). The `title` lists up to six subscriber display names, honouring the
 * "Display names" preference, with a "+N more" overflow.
 */
export function SubscriberBadge({ issueId }: { issueId: string }) {
  // Single-value selectors only — never return an object literal from useStore
  // without useStoreShallow (avoids Zustand v5 render loops).
  const issue = useStore((s) => s.issues.find((i) => i.id === issueId))
  const users = useStore((s) => s.users)
  const fmt = useDisplayName()

  // Dedupe, then resolve to existing users so the count and the tooltip names
  // always agree (a subscriber whose account was deleted is dropped from both).
  const ids = Array.from(new Set(issue?.subscriberIds ?? []))
  const names = ids
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter((n): n is string => Boolean(n))
    .map((n) => fmt(n))
  // Linear only shows the badge when there are multiple subscribers.
  if (names.length <= 1) return null

  const shown = names.slice(0, 6)
  const overflow = names.length - shown.length
  const title =
    shown.join(', ') + (overflow > 0 ? `, +${overflow} more` : '')

  return (
    <span
      className="flex items-center gap-0.5 text-[11px] text-faint"
      title={title}
    >
      <Users size={12} />
      {names.length}
    </span>
  )
}
