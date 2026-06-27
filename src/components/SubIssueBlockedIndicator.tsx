import { useStore } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { Ban } from 'lucide-react'

/**
 * Compact "blocked" glyph for a sub-issue row in the parent's Sub-issues list.
 * Mirrors {@link IssueBlockedBanner}'s derivation: an issue is blocked when a
 * `blocks` relation points *at* it (`toIssueId === issueId`) from an issue that
 * hasn't reached a completed/canceled state. Counts those open blockers and
 * surfaces a small amber Ban icon with a tooltip; renders nothing otherwise.
 */
export function SubIssueBlockedIndicator({ issueId }: { issueId: string }) {
  const relations = useStore((s) => s.relations)
  const issues = useStore((s) => s.issues)
  const states = useStore((s) => s.states)

  // Blockers: the `from` side of a `blocks` relation pointing at this issue,
  // still open (not completed/canceled), matching IssueBlockedBanner exactly.
  const open = relations
    .filter((r) => r.type === 'blocks' && r.toIssueId === issueId)
    .map((r) => issues.find((i) => i.id === r.fromIssueId))
    .filter((i): i is Issue => !!i && !i.archivedAt)
    .filter((i) => {
      const st = states.find((s) => s.id === i.stateId)
      return st?.type !== 'completed' && st?.type !== 'canceled'
    })

  if (open.length === 0) return null

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1"
      title={`Blocked by ${open.length} ${open.length === 1 ? 'issue' : 'issues'}`}
    >
      <Ban size={14} style={{ color: 'var(--status-started)' }} />
    </span>
  )
}
