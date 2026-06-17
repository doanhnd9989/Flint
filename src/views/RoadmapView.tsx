import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addMonths,
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  startOfMonth,
} from 'date-fns'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { projectProgress } from '@/lib/selectors'

const MONTH_W = 120
const NAME_W = 200

export function RoadmapView() {
  const navigate = useNavigate()
  const data = useStore()

  const { months, rangeStart, totalDays, totalWidth, projects } = useMemo(() => {
    const projects = [...data.projects].sort((a, b) => a.sortOrder - b.sortOrder)
    const now = new Date()
    const starts = projects.map((p) => new Date(p.startDate ?? p.createdAt).getTime())
    const targets = projects.map((p) =>
      new Date(p.targetDate ?? addMonths(new Date(p.startDate ?? p.createdAt), 1)).getTime(),
    )
    const minStart = starts.length ? Math.min(...starts, now.getTime()) : now.getTime()
    const maxTarget = targets.length
      ? Math.max(...targets, addMonths(now, 4).getTime())
      : addMonths(now, 4).getTime()
    const rangeStart = startOfMonth(new Date(minStart))
    const rangeEnd = endOfMonth(new Date(maxTarget))
    const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd })
    const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart))
    const totalWidth = months.length * MONTH_W
    return { months, rangeStart, totalDays, totalWidth, projects }
  }, [data.projects])

  const pxPerDay = totalWidth / totalDays
  const dayOffset = (d: Date) => differenceInCalendarDays(d, rangeStart) * pxPerDay
  const todayLeft = dayOffset(new Date())

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Roadmap" />
      <div className="flex-1 overflow-auto">
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
            {/* Today line */}
            {todayLeft >= 0 && todayLeft <= totalWidth && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-0 w-px bg-[var(--priority-urgent)]/60"
                style={{ left: NAME_W + todayLeft }}
              />
            )}
            {projects.map((p) => {
              const start = new Date(p.startDate ?? p.createdAt)
              const target = new Date(
                p.targetDate ?? addMonths(start, 1),
              )
              const left = Math.max(0, dayOffset(start))
              const width = Math.max(56, dayOffset(target) - dayOffset(start))
              const prog = projectProgress(p.id, data.issues, data)
              return (
                <div key={p.id} className="flex items-center border-b border-border/40 hover:bg-bg-hover">
                  <button
                    onClick={() => navigate(`/project/${p.id}`)}
                    className="flex shrink-0 items-center gap-2 border-r border-border px-3 py-2 text-left"
                    style={{ width: NAME_W }}
                  >
                    <span>{p.icon}</span>
                    <span className="truncate text-[13px] text-fg">{p.name}</span>
                  </button>
                  <div className="relative h-10 flex-1" style={{ minWidth: totalWidth }}>
                    <button
                      onClick={() => navigate(`/project/${p.id}`)}
                      className="absolute top-1/2 -translate-y-1/2 overflow-hidden rounded-md border text-left"
                      style={{
                        left,
                        width,
                        height: 24,
                        borderColor: p.color,
                        background: `${p.color}22`,
                      }}
                      title={`${p.name} · ${prog.percent}%`}
                    >
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{ width: `${prog.percent}%`, background: `${p.color}55` }}
                      />
                      <span className="relative truncate px-2 text-[11px]" style={{ color: p.color }}>
                        {p.name} · {prog.percent}%
                      </span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
