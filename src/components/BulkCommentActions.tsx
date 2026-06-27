import { CheckCheck } from 'lucide-react'
import { useStore } from '@/lib/store'

/**
 * "Resolve all comment threads" — Linear's footer action that resolves every
 * still-open thread on an issue at once. Counts unresolved thread roots (a root
 * has no parentId) and, when any exist, shows a subtle right-aligned button.
 */
export function BulkCommentActions({ issueId }: { issueId: string }) {
  const comments = useStore((s) => s.comments)
  const bulkResolveComments = useStore((s) => s.bulkResolveComments)

  // Unresolved thread roots for this issue (roots have no parentId).
  const count = comments.filter(
    (c) => c.issueId === issueId && !c.parentId && !c.resolvedAt,
  ).length

  if (count === 0) return null

  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => bulkResolveComments(issueId)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-bg-hover hover:text-fg"
      >
        <CheckCheck size={13} />
        Resolve all ({count})
      </button>
    </div>
  )
}
