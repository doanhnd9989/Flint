import { useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ChevronLeft, MoreHorizontal } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { projectProgress } from '@/lib/selectors'
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from '@/lib/constants'
import { Avatar } from '@/components/Avatar'
import { ProjectStatusIcon } from '@/components/ProjectStatusIcon'
import { ProgressDonut } from '@/components/ProgressDonut'
import { HealthBadge } from '@/components/ProjectUpdates'
import { Popover } from '@/components/ui/Popover'
import { formatDate, cn } from '@/lib/utils'
import type { Project, ProjectHealth, ProjectStatus, User } from '@/lib/types'

interface Props {
  projects: Project[]
  onOpen: (id: string) => void
}

/**
 * A project card's visual content (no DnD wiring) — shared by the column's
 * draggable cards and the drag overlay so the dragged card looks identical.
 */
function ProjectCard({
  project: p,
  prog,
  lead,
  health,
  dragging,
}: {
  project: Project
  prog: { total: number; percent: number }
  lead?: User
  health?: ProjectHealth
  dragging?: boolean
}) {
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-2 rounded-md border border-border bg-bg p-2.5 text-left hover:bg-bg-hover',
        dragging && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-1.5">
        <ProjectStatusIcon status={p.status} />
        <span className="text-[14px]">{p.icon}</span>
        <span className="truncate text-[13px] font-medium text-fg">{p.name}</span>
      </div>
      <div className="flex items-center gap-3 text-[12px] text-muted">
        {prog.total > 0 && (
          <span className="flex items-center gap-1.5">
            <ProgressDonut percent={prog.percent} />
            {prog.percent}%
          </span>
        )}
        {health && <HealthBadge health={health} />}
        {p.targetDate && (
          <span className="tabular-nums">{formatDate(p.targetDate)}</span>
        )}
        <span className="ml-auto">
          <Avatar user={lead} size={18} />
        </span>
      </div>
    </div>
  )
}

/**
 * A draggable project card. A plain click opens the project; a drag (suppressed
 * by dnd-kit so it won't fire the click) moves the card between status columns.
 */
function DraggableProjectCard({
  project,
  prog,
  lead,
  health,
  onOpen,
}: {
  project: Project
  prog: { total: number; percent: number }
  lead?: User
  health?: ProjectHealth
  onOpen: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
    data: { project },
  })
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(project.id)}
      className="block w-full text-left"
    >
      <ProjectCard
        project={project}
        prog={prog}
        lead={lead}
        health={health}
        dragging={isDragging}
      />
    </button>
  )
}

/**
 * A status column's card body — a droppable target keyed by ProjectStatus, so
 * dropping a card here re-statuses the project. Highlights while a card hovers.
 */
function DroppableColumn({
  status,
  children,
}: {
  status: ProjectStatus
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-1 flex-col gap-2 overflow-y-auto rounded-md px-2 pb-2 transition-colors',
        isOver && 'bg-accent-subtle',
      )}
    >
      {children}
    </div>
  )
}

/**
 * Linear's Projects "Board" layout — a horizontal kanban with one fixed-width
 * column per ProjectStatus (in PROJECT_STATUS_ORDER). Each project from the
 * (already filtered/sorted) `projects` prop is placed in its status column as a
 * card showing the same content as the list row: status icon, emoji + name,
 * progress donut + percent, health, target date, and lead avatar. Cards drag
 * between columns (dnd-kit) to re-status the project, matching Linear.
 */
export function ProjectsBoard({ projects, onOpen }: Props) {
  const { issues, users } = useStoreShallow((s) => ({
    issues: s.issues,
    users: s.users,
    projectUpdates: s.projectUpdates,
  }))
  const data = useStore()
  const updateProject = useStore((s) => s.updateProject)
  // The project currently being dragged — mirrored into the DragOverlay.
  const [active, setActive] = useState<Project | null>(null)
  // Per-column collapse state — collapsed status columns shrink to a thin
  // vertical strip (header + count), matching Linear's board column actions.
  const [collapsed, setCollapsed] = useState<Set<ProjectStatus>>(new Set())

  function toggleCollapse(status: ProjectStatus) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function onStart(e: DragStartEvent) {
    setActive((e.active.data.current?.project as Project) ?? null)
  }
  function onEnd(e: DragEndEvent) {
    setActive(null)
    const project = e.active.data.current?.project as Project | undefined
    // Dropping over a column id (a ProjectStatus) re-statuses the project.
    const overStatus = e.over?.id as ProjectStatus | undefined
    if (!project || !overStatus) return
    if (project.status !== overStatus) updateProject(project.id, { status: overStatus })
  }

  /** Latest health update per project (most recent wins). */
  const healthById = useMemo(() => {
    const map: Record<string, ProjectHealth> = {}
    for (const u of [...data.projectUpdates].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )) {
      map[u.projectId] = u.health
    }
    return map
  }, [data.projectUpdates])

  /**
   * Bucket the passed-in projects by status (every status renders a column),
   * and roll up each column's completion across its projects' issues — the
   * union of all scoped issues, with percent = done / total (the same weighted
   * rollup Linear shows as a column subtotal).
   */
  const columns = useMemo(() => {
    const byStatus: Record<ProjectStatus, Project[]> = {
      backlog: [],
      planned: [],
      started: [],
      paused: [],
      completed: [],
      canceled: [],
    }
    for (const p of projects) byStatus[p.status]?.push(p)
    return PROJECT_STATUS_ORDER.map((s) => {
      const items = byStatus[s]
      let total = 0
      let done = 0
      for (const p of items) {
        const prog = projectProgress(p.id, issues, data)
        total += prog.total
        done += prog.done
      }
      const percent = total ? Math.round((done / total) * 100) : 0
      return { status: s, items, total, percent }
    })
  }, [projects, issues, data])

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd}>
      <div className="flex h-full gap-3 overflow-x-auto p-3">
        {columns.map(({ status, items, total, percent }) => {
          const isCollapsed = collapsed.has(status)
          // Collapsed: a thin vertical strip showing the status icon, a rotated
          // label, and the count — click anywhere to expand back, just like
          // Linear's collapsed board columns.
          if (isCollapsed) {
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleCollapse(status)}
                title={`Expand ${PROJECT_STATUS[status].label}`}
                className="flex h-full w-10 shrink-0 flex-col items-center gap-2 rounded-md bg-bg-secondary pt-2.5 hover:bg-bg-hover"
              >
                <ProjectStatusIcon status={status} />
                <span className="text-faint text-[11px] tabular-nums">
                  {items.length}
                </span>
                {/* Vertical label — reads bottom-to-top like Linear's strip. */}
                <span
                  className="mt-1 text-[12px] font-medium text-muted whitespace-nowrap"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  {PROJECT_STATUS[status].label}
                </span>
              </button>
            )
          }
          return (
            <div
              key={status}
              className="flex h-full w-[280px] shrink-0 flex-col rounded-md bg-bg-secondary"
            >
              <div className="flex items-center gap-1.5 px-3 pt-2.5 text-[12px] font-medium text-fg">
                <ProjectStatusIcon status={status} />
                <span>{PROJECT_STATUS[status].label}</span>
                <span className="text-faint">{items.length}</span>
                {/* Column overflow menu — Linear's per-column actions. */}
                <span className="ml-auto">
                  <Popover
                    align="end"
                    width={196}
                    trigger={
                      <span className="flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-bg-hover hover:text-fg">
                        <MoreHorizontal size={14} />
                      </span>
                    }
                  >
                    {(close) => (
                      <button
                        type="button"
                        onClick={() => {
                          toggleCollapse(status)
                          close()
                        }}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
                      >
                        <ChevronLeft size={14} className="text-muted" />
                        Collapse column
                      </button>
                    )}
                  </Popover>
                </span>
              </div>
              {/* Rolled-up column subtotal — donut + completion % across the
                  column's projects, plus the total scoped issue count. */}
              {items.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 pb-2 pt-1 text-[11px] text-muted">
                  {total > 0 ? (
                    <>
                      <ProgressDonut percent={percent} />
                      <span className="tabular-nums">{percent}%</span>
                      <span className="text-faint">·</span>
                      <span className="tabular-nums">
                        {total} {total === 1 ? 'issue' : 'issues'}
                      </span>
                    </>
                  ) : (
                    <span>No issues</span>
                  )}
                </div>
              )}
              <DroppableColumn status={status}>
                {items.map((p) => {
                  const prog = projectProgress(p.id, issues, data)
                  const lead = users.find((u) => u.id === p.leadId)
                  const health = healthById[p.id]
                  return (
                    <DraggableProjectCard
                      key={p.id}
                      project={p}
                      prog={prog}
                      lead={lead}
                      health={health}
                      onOpen={onOpen}
                    />
                  )
                })}
              </DroppableColumn>
            </div>
          )
        })}
      </div>
      <DragOverlay>
        {active && (
          <ProjectCard
            project={active}
            prog={projectProgress(active.id, issues, data)}
            lead={users.find((u) => u.id === active.leadId)}
            health={healthById[active.id]}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
