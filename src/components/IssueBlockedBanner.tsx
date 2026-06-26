import { useStore } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { StatusIcon } from './StatusIcon'
import { cn } from '@/lib/utils'
import { Ban, CheckCircle2 } from 'lucide-react'

/**
 * Linear's "blocked" warning banner. When an issue has blockers (relations
 * where `type==='blocks'` and `toIssueId===issue.id`), we surface them above
 * the title so the assignee can't miss them. Incomplete blockers show an amber
 * warning listing each one; once they all complete the banner softens to a
 * "no longer blocked" reassurance. Renders nothing when there are no blockers.
 */
export function IssueBlockedBanner({
  issue,
  onOpenIssue,
}: {
  issue: Issue
  onOpenIssue: (identifier: string) => void
}) {
  const store = useStore()

  // Blockers: the `from` side of a `blocks` relation pointing at this issue.
  const blockers = store.relations
    .filter((r) => r.type === 'blocks' && r.toIssueId === issue.id)
    .map((r) => store.issues.find((i) => i.id === r.fromIssueId))
    .filter((i): i is Issue => !!i && !i.archivedAt)

  if (blockers.length === 0) return null

  // A blocker is "complete" once it reaches a completed/canceled state.
  const isClosed = (i: Issue) => {
    const st = store.states.find((s) => s.id === i.stateId)
    return st?.type === 'completed' || st?.type === 'canceled'
  }
  const open = blockers.filter((i) => !isClosed(i))

  // All blockers resolved → softer "no longer blocked" reassurance.
  if (open.length === 0) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-bg-secondary px-3 py-2 text-[13px] text-muted">
        <CheckCircle2 size={14} className="shrink-0 text-[var(--status-completed)]" />
        No longer blocked — all blocking issues are resolved.
      </div>
    )
  }

  return (
    <div
      className="mb-3 rounded-md border px-3 py-2.5"
      style={{
        borderColor: 'color-mix(in srgb, var(--status-started) 45%, var(--border))',
        backgroundColor: 'color-mix(in srgb, var(--status-started) 8%, transparent)',
      }}
    >
      <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
        <Ban size={14} className="shrink-0" style={{ color: 'var(--status-started)' }} />
        Blocked by {open.length} {open.length === 1 ? 'issue' : 'issues'}
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5">
        {open.map((b) => {
          const st = store.states.find((s) => s.id === b.stateId)!
          return (
            <button
              key={b.id}
              onClick={() => onOpenIssue(b.identifier)}
              className={cn(
                'group flex items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-bg-hover',
              )}
            >
              <StatusIcon type={st.type} color={st.color} />
              <span className="font-mono text-[11px] text-faint">{b.identifier}</span>
              <span className="truncate text-[13px] text-muted group-hover:text-fg">
                {b.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
