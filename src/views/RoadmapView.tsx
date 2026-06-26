import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
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
import { EmptyState, InitiativeIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { projectProgress } from '@/lib/selectors'
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from '@/lib/constants'
import { cn } from '@/lib/utils'

const NAME_W = 200
/** Per-month column width by zoom level — Linear's Compact / Default / Wide. */
const ZOOM: Record<'compact' | 'default' | 'wide', number> = {
  compact: 72,
  default: 120,
  wide: 200,
}

export function RoadmapView() {
  const navigate = useNavigate()
  const data = useStore()
  const [zoom, setZoom] = useState<'compact' | 'default' | 'wide'>('default')
  const MONTH_W = ZOOM[zoom]

  // Local-only header filters: a project-status picker and an initiative picker.
  // Both narrow which project bars render and compose with AND.
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [initiativeFilter, setInitiativeFilter] = useState<string>('all')

  // Projects passing both header filters — fed into the timeline geometry below.
  const filteredProjects = useMemo(() => {
    return data.projects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (initiativeFilter === 'none') {
        if (p.initiativeId) return false
      } else if (initiativeFilter !== 'all' && p.initiativeId !== initiativeFilter) {
        return false
      }
      return true
    })
  }, [data.projects, statusFilter, initiativeFilter])

  // Status-filter options: "All statuses" + each ProjectStatus (Linear order).
  const statusOptions = useMemo<SelectOption[]>(
    () => [
      { id: 'all', label: 'All statuses', selected: statusFilter === 'all' },
      ...PROJECT_STATUS_ORDER.map((s) => ({
        id: s,
        label: PROJECT_STATUS[s].label,
        icon: (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: PROJECT_STATUS[s].color }}
          />
        ),
        selected: statusFilter === s,
      })),
    ],
    [statusFilter],
  )
  const statusFilterLabel =
    statusFilter === 'all'
      ? 'All statuses'
      : (PROJECT_STATUS[statusFilter as keyof typeof PROJECT_STATUS]?.label ??
        'All statuses')

  // Initiative-filter options: "All initiatives" + each initiative + "No initiative".
  const initiativeOptions = useMemo<SelectOption[]>(
    () => [
      { id: 'all', label: 'All initiatives', selected: initiativeFilter === 'all' },
      ...data.initiatives.map((i) => ({
        id: i.id,
        label: i.name,
        icon: <span>{i.icon}</span>,
        selected: initiativeFilter === i.id,
      })),
      { id: 'none', label: 'No initiative', selected: initiativeFilter === 'none' },
    ],
    [data.initiatives, initiativeFilter],
  )
  const initiativeFilterLabel =
    initiativeFilter === 'all'
      ? 'All initiatives'
      : initiativeFilter === 'none'
        ? 'No initiative'
        : (data.initiatives.find((i) => i.id === initiativeFilter)?.name ??
          'All initiatives')

  const { months, rangeStart, totalDays, totalWidth, projects } = useMemo(() => {
    const projects = [...filteredProjects].sort((a, b) => a.sortOrder - b.sortOrder)
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
  }, [filteredProjects, MONTH_W])

  const pxPerDay = totalWidth / totalDays
  const dayOffset = (d: Date) => differenceInCalendarDays(d, rangeStart) * pxPerDay
  const todayLeft = dayOffset(new Date())

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Roadmap"
        right={
          <div className="flex items-center gap-2">
            {/* Status + initiative filters — both local-only, composed with AND. */}
            <SelectMenu
              width={200}
              align="end"
              options={statusOptions}
              onSelect={setStatusFilter}
              placeholder="Filter by status…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <span className="max-w-[120px] truncate">{statusFilterLabel}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
            <SelectMenu
              width={220}
              align="end"
              options={initiativeOptions}
              onSelect={setInitiativeFilter}
              placeholder="Filter by initiative…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <span className="max-w-[120px] truncate">{initiativeFilterLabel}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
            {/* Zoom segmented control — Compact / Default / Wide. */}
            <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
              {(['compact', 'default', 'wide'] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  className={cn(
                    'rounded px-2 py-0.5 text-[12px] capitalize',
                    zoom === z
                      ? 'bg-bg-selected text-fg'
                      : 'text-muted hover:bg-bg-hover hover:text-fg',
                  )}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>
        }
      />
      <div className="flex-1 overflow-auto">
        {projects.length === 0 ? (
          <EmptyState
            illustration={<InitiativeIllustration />}
            title="No matching projects"
            description="No projects match the selected status or initiative filters."
          />
        ) : (
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
        )}
      </div>
    </div>
  )
}
