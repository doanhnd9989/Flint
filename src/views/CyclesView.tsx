import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import {
  cycleProgress,
  cycleState,
  groupIssues,
  sortIssues,
} from '@/lib/selectors'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { ViewHeader } from '@/components/ViewHeader'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-[var(--status-started)]/20 text-[var(--status-started)]',
  upcoming: 'bg-accent-subtle text-accent',
  past: 'bg-bg-tertiary text-faint',
}

export function CyclesView() {
  const { teamKey } = useParams()
  const data = useStore()
  const team = data.teams.find((t) => t.key === teamKey) ?? data.teams[0]
  const nowMs = Date.now()

  const cycles = useMemo(
    () =>
      data.cycles
        .filter((c) => c.teamId === team.id)
        .sort((a, b) => a.number - b.number),
    [data.cycles, team.id],
  )

  const activeId = useMemo(() => {
    const active = cycles.find(
      (c) => cycleState(c.startsAt, c.endsAt, nowMs).status === 'active',
    )
    return active?.id ?? cycles[cycles.length - 1]?.id
  }, [cycles, nowMs])

  const [selectedId, setSelectedId] = useState<string | undefined>(activeId)
  const current = cycles.find((c) => c.id === (selectedId ?? activeId))

  const groups = useMemo(() => {
    if (!current) return []
    const scoped = data.issues.filter((i) => i.cycleId === current.id)
    return groupIssues(sortIssues(scoped, 'priority', data), 'status', data)
  }, [data, current])

  if (cycles.length === 0 || !current) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title="Cycles" teamName={team.name} teamIcon={team.icon} />
        <div className="flex flex-1 items-center justify-center text-faint">
          No cycles for this team yet.
        </div>
      </div>
    )
  }

  const idx = cycles.findIndex((c) => c.id === current.id)
  const prog = cycleProgress(current.id, data.issues, data)
  const cs = cycleState(current.startsAt, current.endsAt, nowMs)
  const remaining = Math.max(0, prog.total - prog.done - prog.started)

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Cycles" teamName={team.name} teamIcon={team.icon} />

      {/* Cycle selector + summary */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            disabled={idx <= 0}
            onClick={() => setSelectedId(cycles[idx - 1].id)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-semibold text-fg">
                Cycle {current.number}
              </h1>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                  STATUS_BADGE[cs.status],
                )}
              >
                {cs.status}
              </span>
            </div>
            <div className="text-[12px] text-faint">
              {formatDate(current.startsAt)} – {formatDate(current.endsAt)}
              {cs.status === 'active' && ` · ${cs.daysLeft} days left`}
            </div>
          </div>
          <button
            disabled={idx >= cycles.length - 1}
            onClick={() => setSelectedId(cycles[idx + 1].id)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>

          <div className="ml-auto flex items-center gap-5 text-[12px]">
            <Stat label="Scope" value={prog.total} />
            <Stat label="Started" value={prog.started} />
            <Stat label="Completed" value={prog.done} />
            <Stat label="Progress" value={`${prog.percent}%`} />
          </div>
        </div>

        {/* Stacked progress bar (completed / started / remaining) */}
        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
          <div
            className="h-full bg-accent"
            style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }}
            title={`${prog.done} completed`}
          />
          <div
            className="h-full bg-[var(--status-started)]"
            style={{ width: `${prog.total ? (prog.started / prog.total) * 100 : 0}%` }}
            title={`${prog.started} started`}
          />
          <div
            className="h-full"
            style={{ width: `${prog.total ? (remaining / prog.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <GroupedIssueList groups={groups} groupBy="status" />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <div className="text-[15px] font-semibold text-fg">{value}</div>
      <div className="text-[11px] text-faint">{label}</div>
    </div>
  )
}
