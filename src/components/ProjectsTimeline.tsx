import { useMemo } from 'react'
import {
  addMonths,
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  startOfMonth,
} from 'date-fns'
import type { Project } from '@/lib/types'
import { useStore } from '@/lib/store'
import { projectProgress } from '@/lib/selectors'
import { ProjectStatusIcon } from './ProjectStatusIcon'
import { DatePicker } from './DatePicker'

const MONTH_W = 120
const NAME_W = 240
const ROW_H = 40
const BAR_H = 24
const MIN_BAR_W = 56

/**
 * Projects "Timeline" layout — the Gantt-style option in the Projects Display
 * popover. Mirrors RoadmapView's month-axis + bar positioning math: a left
 * column of project rows and a right month-grid where each project renders as a
 * horizontal bar from startDate → targetDate, tinted by the project color with a
 * progress fill, plus a vertical "today" marker. Projects with no dates render a
 * muted "No dates" row (no bar). The `projects` prop is assumed pre-sorted.
 */
export function ProjectsTimeline({
  projects,
  onOpen,
}: {
  projects: Project[]
  onOpen: (id: string) => void
}) {
  // Progress needs the workflow states; reading the slice directly keeps these
  // single-value selectors (no object literal → no useStoreShallow needed).
  // `projectProgress` only touches `data.states`, so a `{ states }` shim is all
  // it needs — typed as Pick to stay honest without dragging in WorkspaceData.
  const issues = useStore((s) => s.issues)
  const states = useStore((s) => s.states)
  const updateProject = useStore((s) => s.updateProject)
  const progressData = useMemo(
    () => ({ states }) as Parameters<typeof projectProgress>[2],
    [states],
  )

  // Memoize the axis/range so we don't recompute (or churn identities) on every
  // render — only when the project set or their dates change.
  const { months, rangeStart, totalDays, totalWidth } = useMemo(() => {
    const now = new Date()
    const dated = projects.filter((p) => p.startDate || p.targetDate)
    const starts = dated.map((p) =>
      new Date(p.startDate ?? p.targetDate ?? p.createdAt).getTime(),
    )
    const targets = dated.map((p) =>
      new Date(
        p.targetDate ??
          addMonths(new Date(p.startDate ?? p.createdAt), 1),
      ).getTime(),
    )
    const minStart = starts.length
      ? Math.min(...starts, now.getTime())
      : now.getTime()
    const maxTarget = targets.length
      ? Math.max(...targets, addMonths(now, 4).getTime())
      : addMonths(now, 4).getTime()
    const rangeStart = startOfMonth(new Date(minStart))
    const rangeEnd = endOfMonth(new Date(maxTarget))
    const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd })
    const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart))
    const totalWidth = months.length * MONTH_W
    return { months, rangeStart, totalDays, totalWidth }
  }, [projects])

  const pxPerDay = totalWidth / totalDays
  const dayOffset = (d: Date) =>
    differenceInCalendarDays(d, rangeStart) * pxPerDay
  const todayLeft = dayOffset(new Date())

  return (
    <div className="h-full overflow-auto">
      <div style={{ width: NAME_W + totalWidth }}>
        {/* Month header */}
        <div className="sticky top-0 z-10 flex border-b border-border bg-bg-secondary/95 backdrop-blur">
          <div
            className="shrink-0 border-r border-border px-3 py-2 text-[12px] font-medium text-faint"
            style={{ width: NAME_W }}
          >
            Project
          </div>
          <div className="relative flex">
            {months.map((m) => (
              <div
                key={m.toISOString()}
                className="shrink-0 border-r border-border/60 px-2 py-2 text-[11px] text-faint"
                style={{ width: MONTH_W }}
              >
                {format(m, 'MMM yyyy')}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="relative">
          {/* Today marker */}
          {todayLeft >= 0 && todayLeft <= totalWidth && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-0 w-px bg-[var(--priority-urgent)]/60"
              style={{ left: NAME_W + todayLeft }}
            />
          )}
          {projects.map((p) => {
            const hasDates = Boolean(p.startDate || p.targetDate)
            const prog = projectProgress(p.id, issues, progressData)
            const start = new Date(p.startDate ?? p.targetDate ?? p.createdAt)
            const target = new Date(
              p.targetDate ?? addMonths(start, 1),
            )
            const left = Math.max(0, dayOffset(start))
            const width = Math.max(MIN_BAR_W, dayOffset(target) - dayOffset(start))
            return (
              <div
                key={p.id}
                className="flex items-center border-b border-border/40 hover:bg-bg-hover"
                style={{ height: ROW_H }}
              >
                <button
                  onClick={() => onOpen(p.id)}
                  className="flex h-full shrink-0 items-center gap-2 border-r border-border px-3 text-left"
                  style={{ width: NAME_W }}
                >
                  <ProjectStatusIcon status={p.status} />
                  <span className="text-[13px] leading-none">{p.icon}</span>
                  <span className="truncate text-[13px] text-fg">{p.name}</span>
                </button>
                <div
                  className="relative h-full flex-1"
                  style={{ minWidth: totalWidth }}
                >
                  {hasDates ? (
                    <button
                      onClick={() => onOpen(p.id)}
                      className="absolute top-1/2 -translate-y-1/2 overflow-hidden rounded-md border text-left"
                      style={{
                        left,
                        width,
                        height: BAR_H,
                        borderColor: p.color,
                        background: `${p.color}22`,
                      }}
                      title={`${p.name} · ${prog.percent}%`}
                    >
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{
                          width: `${prog.percent}%`,
                          background: `${p.color}55`,
                        }}
                      />
                      <span
                        className="relative truncate px-2 text-[11px]"
                        style={{ color: p.color }}
                      >
                        {p.name} · {prog.percent}%
                      </span>
                    </button>
                  ) : (
                    // Undated project: a DatePicker-backed "Set dates" button.
                    // Picking a start date seeds a default 30-day target so the
                    // bar lands on the timeline immediately (mirrors Linear's
                    // schedule affordance for unscheduled projects).
                    <DatePicker
                      value={p.startDate}
                      onChange={(iso) =>
                        updateProject(p.id, {
                          startDate: iso,
                          targetDate: iso
                            ? addMonths(new Date(iso), 1).toISOString()
                            : undefined,
                        })
                      }
                      align="start"
                      trigger={
                        <span className="absolute top-1/2 left-2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[11px] text-faint hover:bg-bg-hover hover:text-muted">
                          Set dates
                        </span>
                      }
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
