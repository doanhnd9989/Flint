import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
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
import { cn } from '@/lib/utils'

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
            {/* Today line */}
            {todayLeft >= 0 && todayLeft <= totalWidth && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-0 w-px bg-[var(--priority-urgent)]/60"
                style={{ left: NAME_W + todayLeft }}
              />
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
                      const start = new Date(p.startDate ?? p.createdAt)
                      const target = new Date(p.targetDate ?? addMonths(start, 1))
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
