import { ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * Linear's prev/next issue navigation in the issue header: a "n / total"
 * position counter followed by a ↓ (next) and ↑ (previous) button, split by a
 * thin divider. The list/board the user is browsing publishes its order into
 * `navIssueIds`; we look up the current issue's position there. Renders nothing
 * when the issue isn't part of a known list (e.g. opened straight from ⌘K).
 */
export function IssueNav({
  identifier,
  onGo,
}: {
  identifier: string
  /** Called with the destination issue identifier. */
  onGo: (identifier: string) => void
}) {
  const navIssueIds = useStore((s) => s.navIssueIds)
  const idx = navIssueIds.indexOf(identifier)
  if (idx === -1 || navIssueIds.length < 2) return null

  const prev = idx > 0 ? navIssueIds[idx - 1] : null
  const next = idx < navIssueIds.length - 1 ? navIssueIds[idx + 1] : null

  const btn =
    'flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <div className="flex items-center gap-1 text-[13px] text-muted">
      <span className="tabular-nums">
        {idx + 1} <span className="text-faint">/ {navIssueIds.length}</span>
      </span>
      <button
        type="button"
        title="Next issue"
        disabled={!next}
        onClick={() => next && onGo(next)}
        className={cn(btn)}
      >
        <ChevronDown size={16} />
      </button>
      <span className="h-4 w-px bg-border" />
      <button
        type="button"
        title="Previous issue"
        disabled={!prev}
        onClick={() => prev && onGo(prev)}
        className={cn(btn)}
      >
        <ChevronUp size={16} />
      </button>
    </div>
  )
}
