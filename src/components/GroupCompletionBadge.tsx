import type { Issue, WorkflowState } from '@/lib/types'
import { ProgressDonut } from './ProgressDonut'

/** Percent of a group's issues that are done (completed or canceled) — Linear
 *  shows this as a tiny donut + `X%` chip on list/board group headers, mirroring
 *  the count/estimate badges beside the group label. Pure/presentational: it
 *  takes the group's issues and the workflow states to read each issue's type. */
export function GroupCompletionBadge({
  issues,
  states,
}: {
  issues: Issue[]
  states: WorkflowState[]
}) {
  if (issues.length === 0) return null
  // "Done" mirrors Linear's progress: completed or canceled both leave the queue.
  const done = issues.filter((i) => {
    const t = states.find((s) => s.id === i.stateId)?.type
    return t === 'completed' || t === 'canceled'
  }).length
  const pct = Math.round((done / issues.length) * 100)
  return (
    <span
      title={`${done}/${issues.length} done`}
      className="inline-flex items-center gap-1"
    >
      <ProgressDonut percent={pct} size={12} />
      <span className="text-[11px] text-faint">{pct}%</span>
    </span>
  )
}
