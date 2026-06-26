import { useEffect, useState } from 'react'
import { ChevronDown, Plus, IterationCw, Diamond } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { useStore, useStoreShallow } from '@/lib/store'
import type { GroupBy, Issue, Priority } from '@/lib/types'
import type { IssueGroup } from '@/lib/selectors'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { cn } from '@/lib/utils'

function Card({ issue, dragging }: { issue: Issue; dragging?: boolean }) {
  const setPeek = useStore((s) => s.setPeek)
  const { users, labels } = useStoreShallow((s) => ({ users: s.users, labels: s.labels }))
  const assignee = users.find((u) => u.id === issue.assigneeId)
  const issueLabels = issue.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter(Boolean)
  return (
    <div
      // A plain click peeks the issue in the right-side panel; a drag is
      // suppressed by dnd-kit so it won't fire this click handler.
      onClick={() => setPeek(issue.id)}
      className={cn(
        'rounded-lg border border-border bg-bg p-2.5 shadow-sm cursor-pointer hover:border-border-strong',
        dragging && 'opacity-50',
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[11px] text-faint">{issue.identifier}</span>
        <PriorityIcon priority={issue.priority} />
      </div>
      <div className="text-[13px] text-fg leading-snug">{issue.title}</div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {issueLabels.slice(0, 2).map((l) => (
            <LabelDot key={l!.id} color={l!.color} />
          ))}
        </div>
        <Avatar user={assignee} size={18} />
      </div>
    </div>
  )
}

function DraggableCard({ issue }: { issue: Issue }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
    data: { issue },
  })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}>
      <Card issue={issue} dragging={isDragging} />
    </div>
  )
}

/** A droppable card stack. `dropId` lets swimlane cells be uniquely droppable. */
function CardStack({ issues, dropId }: { issues: Issue[]; dropId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 space-y-2 rounded-lg p-1 transition-colors min-h-24',
        isOver && 'bg-accent-subtle',
      )}
    >
      {issues.map((issue) => (
        <DraggableCard key={issue.id} issue={issue} />
      ))}
    </div>
  )
}

function Column({ group, groupBy }: { group: IssueGroup; groupBy: GroupBy }) {
  const openCreateWith = useStore((s) => s.openCreateWith)
  return (
    <div className="group flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <RowGlyph group={group} by={groupBy} />
        <span className="text-[13px] font-medium text-fg">{group.label}</span>
        <span className="text-[12px] text-faint">{group.count}</span>
        <div className="flex-1" />
        <button
          type="button"
          title="Add issue"
          onClick={() => openCreateWith(group.stateId ? { stateId: group.stateId } : {})}
          className="flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 transition-opacity hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
        >
          <Plus size={14} />
        </button>
      </div>
      <CardStack issues={group.issues} dropId={group.stateId ?? group.key} />
    </div>
  )
}

/** Header glyph for a swimlane (row) — mirrors the list's group glyphs. */
function RowGlyph({ group, by }: { group: IssueGroup; by: GroupBy }) {
  const states = useStore((s) => s.states)
  const users = useStore((s) => s.users)
  if (by === 'status') {
    const st = states.find((s) => s.id === group.stateId)
    return st ? <StatusIcon type={st.type} color={st.color} /> : null
  }
  if (by === 'priority')
    return <PriorityIcon priority={Number(group.key) as 0 | 1 | 2 | 3 | 4} />
  if (by === 'assignee') {
    const u = users.find((x) => x.id === group.key)
    return <Avatar user={u} size={16} />
  }
  if (by === 'project') return <span className="text-[13px]">{group.icon ?? '○'}</span>
  if (by === 'label') return group.color ? <LabelDot color={group.color} /> : null
  if (by === 'cycle') return <IterationCw size={14} className="text-muted" />
  if (by === 'milestone') return <Diamond size={13} className="text-muted" />
  return null
}

/** A single swimlane: a full-width header band + one card stack per column. */
function Swimlane({
  row,
  columns,
  subGroupBy,
}: {
  row: IssueGroup
  columns: IssueGroup[]
  subGroupBy: GroupBy
}) {
  const [collapsed, setCollapsed] = useState(false)
  // cell issues = the column's sub-group whose key matches this row.
  const cellFor = (col: IssueGroup) =>
    col.subGroups?.find((sg) => sg.key === row.key)?.issues ?? []
  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-hover"
      >
        <ChevronDown
          size={13}
          className={cn('text-faint transition-transform', collapsed && '-rotate-90')}
        />
        <RowGlyph group={row} by={subGroupBy} />
        <span className="text-[13px] font-medium text-fg">{row.label}</span>
        <span className="text-[12px] text-faint">{row.count}</span>
      </button>
      {!collapsed && (
        <div className="flex gap-4 pb-2">
          {columns.map((col) => (
            <div key={col.key} className="flex w-72 shrink-0 flex-col">
              <CardStack
                issues={cellFor(col)}
                dropId={`${row.key}::${col.stateId ?? col.key}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function IssueBoard({
  groups,
  rows,
  subGroupBy = 'none',
  groupBy = 'status',
}: {
  groups: IssueGroup[]
  /** When set, the board renders horizontal swimlanes grouped by these rows. */
  rows?: IssueGroup[]
  subGroupBy?: GroupBy
  /** What the columns are grouped by — drives drag-to-set behavior. */
  groupBy?: GroupBy
}) {
  const moveIssue = useStore((s) => s.moveIssue)
  const setIssueAssignee = useStore((s) => s.setIssueAssignee)
  const setIssuePriority = useStore((s) => s.setIssuePriority)
  const setIssueProject = useStore((s) => s.setIssueProject)
  const setNavIssueIds = useStore((s) => s.setNavIssueIds)
  const [active, setActive] = useState<Issue | null>(null)
  const [showHidden, setShowHidden] = useState(false)

  const swimlanes = rows && subGroupBy !== 'none'
  // Empty swimlanes collapse into a "Hidden rows N" bar at the bottom.
  const visibleRows = swimlanes ? rows!.filter((r) => r.count > 0) : []
  const hiddenRows = swimlanes ? rows!.filter((r) => r.count === 0) : []

  // Publish the visible order for the issue detail's prev/next navigation.
  const flatOrder = swimlanes
    ? visibleRows.flatMap((r) =>
        groups.flatMap((g) =>
          (g.subGroups?.find((sg) => sg.key === r.key)?.issues ?? []).map(
            (i) => i.identifier,
          ),
        ),
      )
    : groups.flatMap((g) => g.issues.map((i) => i.identifier))
  useEffect(() => {
    setNavIssueIds(flatOrder)
  }, [flatOrder.join('\n'), setNavIssueIds])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function onStart(e: DragStartEvent) {
    setActive((e.active.data.current?.issue as Issue) ?? null)
  }
  function onEnd(e: DragEndEvent) {
    setActive(null)
    const issue = e.active.data.current?.issue as Issue | undefined
    const overId = e.over?.id as string | undefined
    if (!issue || !overId) return
    // Swimlane cells carry composite "rowKey::colKey" drop ids; for status the
    // colKey is the state id, for other groupings it's the group key.
    const colKey = overId.includes('::') ? overId.split('::')[1] : overId
    // Dropping a card into a column sets the grouped property on the issue.
    switch (groupBy) {
      case 'status': {
        if (issue.stateId !== colKey) moveIssue(issue.id, colKey, issue.sortOrder)
        break
      }
      case 'assignee': {
        const next = colKey === 'none' ? undefined : colKey
        if (issue.assigneeId !== next) setIssueAssignee(issue.id, next)
        break
      }
      case 'priority': {
        const next = Number(colKey) as Priority
        if (issue.priority !== next) setIssuePriority(issue.id, next)
        break
      }
      case 'project': {
        const next = colKey === 'none' ? undefined : colKey
        if (issue.projectId !== next) setIssueProject(issue.id, next)
        break
      }
      default:
        // e.g. 'label' / 'none' — not a settable column property; ignore.
        return
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd}>
      {swimlanes ? (
        <div className="h-full overflow-auto p-4">
          {/* Column headers, rendered once across the top. */}
          <div className="flex gap-4">
            {groups.map((g) => (
              <ColumnHeader key={g.key} group={g} groupBy={groupBy} />
            ))}
          </div>
          <div className="mt-1 space-y-1">
            {visibleRows.map((row) => (
              <Swimlane
                key={row.key}
                row={row}
                columns={groups}
                subGroupBy={subGroupBy}
              />
            ))}
            {hiddenRows.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowHidden((s) => !s)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted hover:bg-bg-hover"
                >
                  <ChevronDown
                    size={13}
                    className={cn(
                      'text-faint transition-transform',
                      !showHidden && '-rotate-90',
                    )}
                  />
                  Hidden rows
                  <span className="text-faint">{hiddenRows.length}</span>
                </button>
                {showHidden &&
                  hiddenRows.map((row) => (
                    <Swimlane
                      key={row.key}
                      row={row}
                      columns={groups}
                      subGroupBy={subGroupBy}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full gap-4 overflow-x-auto p-4">
          {groups.map((g) => (
            <Column key={g.key} group={g} groupBy={groupBy} />
          ))}
        </div>
      )}
      <DragOverlay>{active && <Card issue={active} />}</DragOverlay>
    </DndContext>
  )
}

/** A board column header (group glyph + name + total count) for swimlane mode. */
function ColumnHeader({ group, groupBy }: { group: IssueGroup; groupBy: GroupBy }) {
  const openCreateWith = useStore((s) => s.openCreateWith)
  return (
    <div className="group flex w-72 shrink-0 items-center gap-2 px-1">
      <RowGlyph group={group} by={groupBy} />
      <span className="text-[13px] font-medium text-fg">{group.label}</span>
      <span className="text-[12px] text-faint">{group.count}</span>
      <div className="flex-1" />
      <button
        type="button"
        title="Add issue"
        onClick={() => openCreateWith(group.stateId ? { stateId: group.stateId } : {})}
        className="flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 transition-opacity hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
