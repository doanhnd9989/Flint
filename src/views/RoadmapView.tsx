import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  startOfMonth,
} from 'date-fns'
import { useStore } from '@/lib/store'
import type { Project, ProjectHealth } from '@/lib/types'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, InitiativeIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { HEALTH } from '@/components/ProjectUpdates'
import { Avatar } from '@/components/Avatar'
import { projectProgress } from '@/lib/selectors'
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from '@/lib/constants'
import { cn, formatDate } from '@/lib/utils'

const NAME_W = 200
/** Per-month column width by zoom level — Linear's Compact / Default / Wide. */
const ZOOM: Record<'compact' | 'default' | 'wide', number> = {
  compact: 72,
  default: 120,
  wide: 200,
}

/** How the timeline rows are bucketed into swimlanes — Linear's "Group by". */
type GroupBy = 'none' | 'initiative' | 'status' | 'lead'
const GROUP_LABEL: Record<GroupBy, string> = {
  none: 'No grouping',
  initiative: 'Initiative',
  status: 'Status',
  lead: 'Lead',
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

  // Live preview of an in-progress edge drag — the project whose start/target is
  // being dragged and the day-offsets to render it at, so the bar tracks the
  // pointer before we commit to the store on pointer-up. Null when idle.
  const [drag, setDrag] = useState<{ id: string; start: Date; target: Date } | null>(null)
  // Mutable ref carrying the in-flight gesture (origin pointer X, the anchored
  // dates, which edge, and whether the pointer has moved past the click slop).
  // A ref so pointermove handlers read fresh values without re-subscribing.
  const dragRef = useRef<{
    id: string
    edge: 'start' | 'end'
    originX: number
    start: Date
    target: Date
    moved: boolean
  } | null>(null)

  // Group-by swimlanes + which group keys are collapsed (local-only, like Linear).
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Milestones grouped by project, kept in sortOrder — rendered as small tick
  // markers on each project bar at their targetDate (skipping undated ones).
  const milestonesByProject = useMemo(() => {
    const map: Record<string, typeof data.milestones> = {}
    for (const m of [...data.milestones].sort((a, b) => a.sortOrder - b.sortOrder)) {
      ;(map[m.projectId] ??= []).push(m)
    }
    return map
  }, [data.milestones])

  // Latest health update per project (most recent wins) — shown as a bar dot and
  // used nowhere else; mirrors how ProjectsView derives current health.
  const healthById = useMemo(() => {
    const map: Record<string, ProjectHealth> = {}
    for (const u of [...data.projectUpdates].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )) {
      map[u.projectId] = u.health
    }
    return map
  }, [data.projectUpdates])

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

  // Group-by options — None / Initiative / Status / Lead, mirroring Linear.
  const groupOptions = useMemo<SelectOption[]>(
    () =>
      (['none', 'initiative', 'status', 'lead'] as const).map((g) => ({
        id: g,
        label: GROUP_LABEL[g],
        selected: groupBy === g,
      })),
    [groupBy],
  )

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

  // Begin dragging one end of a project bar. We capture the pointer, snapshot the
  // bar's current start/target, then translate each pointermove's pixel delta back
  // into whole days (the same `pxPerDay` scale used to position the bar) and clamp
  // so the dragged edge can never cross the opposite one. Commit on pointer-up via
  // the existing updateProject action; a small slop threshold distinguishes a
  // genuine drag from a click so the bar's click-to-open still fires.
  const startEdgeDrag = (e: ReactPointerEvent, p: Project, edge: 'start' | 'end') => {
    e.preventDefault()
    e.stopPropagation()
    const start = new Date(p.startDate ?? p.createdAt)
    const target = new Date(p.targetDate ?? addMonths(start, 1))
    dragRef.current = { id: p.id, edge, originX: e.clientX, start, target, moved: false }
    setDrag({ id: p.id, start, target })
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)

    const onMove = (ev: globalThis.PointerEvent) => {
      const g = dragRef.current
      if (!g) return
      const dxDays = Math.round((ev.clientX - g.originX) / pxPerDay)
      if (Math.abs(ev.clientX - g.originX) > 3) g.moved = true
      if (g.edge === 'start') {
        // Never let the start pass the day before the target.
        const maxDays = differenceInCalendarDays(g.target, g.start) - 1
        const next = addDays(g.start, Math.min(dxDays, maxDays))
        setDrag({ id: g.id, start: next, target: g.target })
      } else {
        // Never let the target pass the day after the start.
        const minDays = differenceInCalendarDays(g.start, g.target) + 1
        const next = addDays(g.target, Math.max(dxDays, minDays))
        setDrag({ id: g.id, start: g.start, target: next })
      }
    }
    const onUp = () => {
      const g = dragRef.current
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        // pointer may already be released — safe to ignore
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      dragRef.current = null
      // Read the final preview off state via the functional setter, then commit.
      setDrag((d) => {
        if (g?.moved && d && d.id === g.id) {
          if (g.edge === 'start') {
            data.updateProject(g.id, { startDate: d.start.toISOString() })
          } else {
            data.updateProject(g.id, { targetDate: d.target.toISOString() })
          }
        }
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Quarter segments spanning the time axis — Linear labels each fiscal quarter
  // (Q1 2026 …) above the months and draws a divider at every quarter boundary.
  // We derive them from `months`: a new quarter starts whenever the month index
  // is a multiple of 3 (Jan/Apr/Jul/Oct), and `left`/`width` come from the first
  // day of the quarter's first month through the start of the next quarter.
  const quarters = useMemo(() => {
    const out: { key: string; label: string; left: number; width: number }[] = []
    for (let i = 0; i < months.length; i++) {
      const m = months[i]
      if (m.getMonth() % 3 !== 0 && i !== 0) continue
      // Find the month that begins the next quarter (or the range end).
      let j = i + 1
      while (j < months.length && months[j].getMonth() % 3 !== 0) j++
      const left = dayOffset(startOfMonth(m))
      const endDate = j < months.length ? startOfMonth(months[j]) : endOfMonth(months[months.length - 1])
      const width = dayOffset(endDate) - left
      out.push({
        key: m.toISOString(),
        label: `Q${Math.floor(m.getMonth() / 3) + 1} ${format(m, 'yyyy')}`,
        left,
        width,
      })
    }
    return out
  }, [months, pxPerDay])

  // Bucket the (already sorted) projects into ordered swimlanes for the chosen
  // facet. `none` returns a single unlabeled group so rendering stays uniform.
  type Group = { key: string; label: string; icon?: ReactNode; projects: Project[] }
  const groups = useMemo<Group[]>(() => {
    if (groupBy === 'none') return [{ key: 'all', label: '', projects }]

    if (groupBy === 'status') {
      return PROJECT_STATUS_ORDER.map<Group>((s) => ({
        key: s,
        label: PROJECT_STATUS[s].label,
        icon: (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: PROJECT_STATUS[s].color }}
          />
        ),
        projects: projects.filter((p) => p.status === s),
      })).filter((g) => g.projects.length)
    }

    if (groupBy === 'lead') {
      const out = data.users
        .map<Group>((u) => ({
          key: u.id,
          label: u.name,
          icon: <Avatar user={u} size={16} />,
          projects: projects.filter((p) => p.leadId === u.id),
        }))
        .filter((g) => g.projects.length)
      const noLead = projects.filter((p) => !p.leadId)
      if (noLead.length) out.push({ key: '__none', label: 'No lead', projects: noLead })
      return out
    }

    // initiative
    const out = data.initiatives
      .map<Group>((i) => ({
        key: i.id,
        label: i.name,
        icon: <span>{i.icon}</span>,
        projects: projects.filter((p) => p.initiativeId === i.id),
      }))
      .filter((g) => g.projects.length)
    const noInit = projects.filter((p) => !p.initiativeId)
    if (noInit.length) out.push({ key: '__none', label: 'No initiative', projects: noInit })
    return out
  }, [groupBy, projects, data.users, data.initiatives])

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
            {/* Group-by picker — None / Initiative / Status / Lead swimlanes. */}
            <SelectMenu
              width={180}
              align="end"
              options={groupOptions}
              onSelect={(id) => {
                setGroupBy(id as GroupBy)
                setCollapsed(new Set())
              }}
              placeholder="Group by…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <span className="text-faint">Group:</span>
                  <span className="max-w-[100px] truncate">{GROUP_LABEL[groupBy]}</span>
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
          {/* Header — a quarter band above a month band, both sticky to the top. */}
          <div className="sticky top-0 z-10 border-b border-border bg-bg-secondary/95 backdrop-blur">
            {/* Quarter band: Q1 2026 … labels spanning each quarter's months. */}
            <div className="flex border-b border-border/60">
              <div
                className="shrink-0 border-r border-border"
                style={{ width: NAME_W }}
              />
              <div className="relative h-6" style={{ width: totalWidth }}>
                {quarters.map((q) => (
                  <div
                    key={q.key}
                    className="absolute top-0 bottom-0 flex items-center border-l border-border px-2 text-[11px] font-medium text-muted first:border-l-0"
                    style={{ left: q.left, width: q.width }}
                  >
                    <span className="truncate">{q.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Month band. */}
            <div className="flex">
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
          </div>

          {/* Rows — flat when ungrouped, otherwise collapsible swimlanes. */}
          <div className="relative">
            {/* Quarter divider lines — vertical rules at each quarter boundary,
                behind the bars so they read as background gridlines. */}
            {quarters.map((q) =>
              q.left <= 0 ? null : (
                <div
                  key={q.key}
                  className="pointer-events-none absolute top-0 bottom-0 z-0 w-px bg-border"
                  style={{ left: NAME_W + q.left }}
                />
              ),
            )}
            {/* Today line + a "Today" pill anchored to its top, mirroring
                Linear's timeline marker. The pill is centred on the rule and
                sits flush at the top of the rows band. */}
            {todayLeft >= 0 && todayLeft <= totalWidth && (
              <>
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-0 w-px bg-[var(--priority-urgent)]/60"
                  style={{ left: NAME_W + todayLeft }}
                />
                <span
                  className="pointer-events-none absolute top-1 z-[2] -translate-x-1/2 rounded-full bg-[var(--priority-urgent)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-white"
                  style={{ left: NAME_W + todayLeft }}
                >
                  Today
                </span>
              </>
            )}
            {groups.map((group) => {
              const isCollapsed = collapsed.has(group.key)
              return (
                <div key={group.key}>
                  {/* Group header — only when an actual facet is selected. */}
                  {groupBy !== 'none' && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className="sticky left-0 z-[1] flex w-full items-center gap-1.5 border-b border-border bg-bg-secondary/95 px-2 py-1.5 text-left backdrop-blur hover:bg-bg-hover"
                      style={{ width: NAME_W }}
                    >
                      <ChevronRight
                        size={13}
                        className={cn(
                          'shrink-0 text-faint transition-transform',
                          !isCollapsed && 'rotate-90',
                        )}
                      />
                      {group.icon}
                      <span className="truncate text-[12px] font-medium text-fg">
                        {group.label}
                      </span>
                      <span className="ml-auto pr-1 text-[11px] tabular-nums text-faint">
                        {group.projects.length}
                      </span>
                    </button>
                  )}
                  {!isCollapsed &&
                    group.projects.map((p) => {
                      // While this bar's edge is being dragged, render from the
                      // live preview dates so it tracks the pointer; otherwise use
                      // the project's persisted dates.
                      const preview = drag?.id === p.id ? drag : null
                      const start = preview?.start ?? new Date(p.startDate ?? p.createdAt)
                      const target =
                        preview?.target ?? new Date(p.targetDate ?? addMonths(start, 1))
                      const left = Math.max(0, dayOffset(start))
                      const width = Math.max(56, dayOffset(target) - dayOffset(start))
                      const prog = projectProgress(p.id, data.issues, data)
                      const health = healthById[p.id]
                      const projectMilestones = milestonesByProject[p.id] ?? []
                      // Only dated milestones can be placed on the time axis.
                      const datedMilestones = projectMilestones.filter((m) => m.targetDate)
                      return (
                        <div
                          key={p.id}
                          className="flex items-center border-b border-border/40 hover:bg-bg-hover"
                        >
                          <button
                            onClick={() => navigate(`/project/${p.id}`)}
                            className="flex shrink-0 items-center gap-2 border-r border-border px-3 py-2 text-left"
                            style={{ width: NAME_W }}
                          >
                            <span>{p.icon}</span>
                            <span className="truncate text-[13px] text-fg">{p.name}</span>
                            {projectMilestones.length > 0 && (
                              <span className="shrink-0 text-[10px] tabular-nums text-faint">
                                {projectMilestones.length} milestone
                                {projectMilestones.length === 1 ? '' : 's'}
                              </span>
                            )}
                            {health && (
                              <span
                                className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ background: HEALTH[health].color }}
                                title={HEALTH[health].label}
                              />
                            )}
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
                              title={`${p.name} · ${prog.percent}%${health ? ` · ${HEALTH[health].label}` : ''}`}
                            >
                              <div
                                className="absolute inset-y-0 left-0"
                                style={{ width: `${prog.percent}%`, background: `${p.color}55` }}
                              />
                              <span
                                className="relative truncate px-2 text-[11px]"
                                style={{ color: p.color }}
                              >
                                {p.name} · {prog.percent}%
                              </span>
                            </button>
                            {/* Edge drag handles — thin grips at the bar's start and
                                target ends. Dragging the left reschedules startDate,
                                the right retargets targetDate, snapped to the day axis.
                                They sit above the bar so click-to-open still works on
                                the bar body. */}
                            <span
                              onPointerDown={(e) => startEdgeDrag(e, p, 'start')}
                              className="group/handle absolute top-1/2 z-[2] flex h-6 w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center touch-none"
                              style={{ left }}
                              title="Drag to change start date"
                            >
                              <span
                                className="h-4 w-1 rounded-full opacity-0 transition-opacity group-hover/handle:opacity-100"
                                style={{ background: p.color }}
                              />
                            </span>
                            <span
                              onPointerDown={(e) => startEdgeDrag(e, p, 'end')}
                              className="group/handle absolute top-1/2 z-[2] flex h-6 w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center touch-none"
                              style={{ left: left + width }}
                              title="Drag to change target date"
                            >
                              <span
                                className="h-4 w-1 rounded-full opacity-0 transition-opacity group-hover/handle:opacity-100"
                                style={{ background: p.color }}
                              />
                            </span>
                            {/* Start / target date captions flanking the bar —
                                placed just outside each end so they never overlap
                                the in-bar name label. Hidden when they'd fall off
                                the left edge of the track. */}
                            {left > 44 && (
                              <span
                                className="pointer-events-none absolute top-1/2 -translate-x-full -translate-y-1/2 pr-1.5 text-[10px] tabular-nums text-faint"
                                style={{ left }}
                              >
                                {formatDate(start.toISOString())}
                              </span>
                            )}
                            <span
                              className="pointer-events-none absolute top-1/2 -translate-y-1/2 pl-1.5 text-[10px] tabular-nums text-faint"
                              style={{ left: left + width }}
                            >
                              {formatDate(target.toISOString())}
                            </span>
                            {/* Milestone markers — a thin diamond on the bar axis at
                                each dated milestone's targetDate, with a name tooltip. */}
                            {datedMilestones.map((m) => {
                              const ml = dayOffset(new Date(m.targetDate as string))
                              if (ml < 0 || ml > totalWidth) return null
                              return (
                                <span
                                  key={m.id}
                                  className="pointer-events-auto absolute top-1/2 z-[1] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] border bg-bg"
                                  style={{ left: ml, borderColor: p.color }}
                                  title={`${m.name} · ${format(new Date(m.targetDate as string), 'MMM d, yyyy')}`}
                                />
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
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
