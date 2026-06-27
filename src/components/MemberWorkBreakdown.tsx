import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, BarChart3 } from 'lucide-react'
import { useStore } from '@/lib/store'
import { StatusIcon } from '@/components/StatusIcon'
import { PriorityIcon } from '@/components/PriorityIcon'
import { PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/constants'
import type { WorkflowState } from '@/lib/types'

interface Props {
  userId: string
  onClose: () => void
}

// A single labelled row with a count and a proportional bar (Linear's insight
// breakdowns render exactly this: glyph · label · bar · count).
function BreakdownRow({
  icon,
  label,
  count,
  max,
}: {
  icon: React.ReactNode
  label: string
  count: number
  max: number
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="w-24 shrink-0 truncate text-[12px] text-fg">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-[12px] tabular-nums text-muted">{count}</span>
    </div>
  )
}

/**
 * Member assigned-work breakdown modal — shows the member's open & total
 * assigned issues split two ways: by workflow STATUS and by PRIORITY, each as a
 * count + proportional bar. Mirrors MoveIssueModal's portal/overlay/Esc pattern.
 * Read-only; all figures derive from issues where assigneeId === the member id
 * (archived excluded).
 */
export function MemberWorkBreakdown({ userId, onClose }: Props) {
  const issues = useStore((s) => s.issues)
  const states = useStore((s) => s.states)

  // Esc closes, matching the rest of the modal family.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── this member's assigned, non-archived issues ─────────────────────────────
  const assigned = useMemo(
    () => issues.filter((i) => !i.archivedAt && i.assigneeId === userId),
    [issues, userId],
  )

  // ── by status: one row per workflow state that has work, in board order ──────
  const byStatus = useMemo(() => {
    const ordered = [...states].sort((a, b) => a.position - b.position)
    return ordered
      .map((state: WorkflowState) => ({
        state,
        count: assigned.filter((i) => i.stateId === state.id).length,
      }))
      .filter((g) => g.count > 0)
  }, [assigned, states])

  // ── by priority: Urgent → High → Med → Low → None, only buckets with work ───
  const byPriority = useMemo(
    () =>
      PRIORITY_ORDER.map((priority) => ({
        priority,
        count: assigned.filter((i) => i.priority === priority).length,
      })).filter((g) => g.count > 0),
    [assigned],
  )

  const statusMax = Math.max(1, ...byStatus.map((g) => g.count))
  const priorityMax = Math.max(1, ...byPriority.map((g) => g.count))

  return createPortal(
    <div
      data-overlay
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-32 animate-fade"
      onMouseDown={onClose}
    >
      <div
        className="w-[440px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated p-5 shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-fg">
          <BarChart3 size={15} className="text-faint" />
          Assigned work breakdown
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-faint hover:bg-bg-hover hover:text-muted"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {assigned.length === 0 ? (
          <div className="px-1 py-8 text-center text-[12px] text-faint">
            No issues assigned to this member.
          </div>
        ) : (
          <div className="space-y-5">
            {/* By status */}
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
                  By status
                </span>
                <span className="text-[11px] tabular-nums text-faint">{assigned.length} total</span>
              </div>
              <div className="space-y-2">
                {byStatus.map((g) => (
                  <BreakdownRow
                    key={g.state.id}
                    icon={<StatusIcon type={g.state.type} color={g.state.color} />}
                    label={g.state.name}
                    count={g.count}
                    max={statusMax}
                  />
                ))}
              </div>
            </div>

            {/* By priority */}
            <div className="border-t border-border pt-4">
              <div className="mb-2.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
                  By priority
                </span>
              </div>
              <div className="space-y-2">
                {byPriority.map((g) => (
                  <BreakdownRow
                    key={g.priority}
                    icon={<PriorityIcon priority={g.priority} />}
                    label={PRIORITY_LABELS[g.priority]}
                    count={g.count}
                    max={priorityMax}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
