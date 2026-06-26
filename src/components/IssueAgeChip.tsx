import { useStore } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { formatFullDate } from '@/lib/utils'
import { Clock, Timer } from 'lucide-react'

/** Whole-day-aware duration label between two epoch-ms instants ("3d", "5h", "12m"). */
function duration(fromMs: number, toMs: number): string {
  const diff = Math.max(0, toMs - fromMs)
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m || 1}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(mo / 12)}y`
}

/**
 * A compact faint metadata row under the description showing the issue's age
 * (created → now) and, once completed, its cycle time (first moved to a
 * `started` state → completed). The "started" instant is derived from the
 * issue's own status-change activity history; we fall back to `createdAt` when
 * no such transition was ever recorded.
 */
export function IssueAgeChip({ issue }: { issue: Issue }) {
  const store = useStore()
  const now = Date.now()
  const createdMs = new Date(issue.createdAt).getTime()

  // Derive the first transition into a `started` state from status activities.
  const startedStateIds = new Set(
    store.states.filter((s) => s.type === 'started').map((s) => s.id),
  )
  const startActivity = store.activities
    .filter(
      (a) =>
        a.issueId === issue.id &&
        a.kind === 'status' &&
        a.to != null &&
        startedStateIds.has(a.to),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]

  const age = duration(createdMs, now)

  let cycleTime: string | undefined
  if (issue.completedAt) {
    const completedMs = new Date(issue.completedAt).getTime()
    const startMs = startActivity
      ? new Date(startActivity.createdAt).getTime()
      : createdMs
    cycleTime = duration(startMs, completedMs)
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
      <span
        className="flex items-center gap-1"
        title={`Created ${formatFullDate(issue.createdAt)}`}
      >
        <Clock size={11} />
        {age} old
      </span>
      {cycleTime && (
        <span
          className="flex items-center gap-1"
          title={
            startActivity
              ? `Started ${formatFullDate(startActivity.createdAt)} · completed ${formatFullDate(issue.completedAt)}`
              : `Completed ${formatFullDate(issue.completedAt)}`
          }
        >
          <Timer size={11} />
          {cycleTime} cycle time
        </span>
      )}
    </div>
  )
}
