import { useEffect, useState } from 'react'
import { CalendarClock, ChevronDown, ChevronsRightLeft, Plus, IterationCw, Diamond, CircleSlash, Gauge } from 'lucide-react'
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
import type { CreatePrefill, GroupBy, Issue, Priority } from '@/lib/types'
import type { IssueGroup } from '@/lib/selectors'
import { estimateLabel, teamEstimationType } from '@/lib/constants'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { SubscriberBadge } from './SubscriberBadge'
import { CreatorDisplay } from './CreatorDisplay'
import { GroupCompletionBadge } from './GroupCompletionBadge'
import { cn, formatDate, isDueSoon, isOverdue } from '@/lib/utils'

/**
 * A board column whose card count exceeds this soft cap (for *started*-type
 * columns only) gets a gentle amber "high WIP" affordance — Flint has no
 * explicit WIP-limit model, so this mirrors Linear's spirit of nudging you when
 * an in-progress column is getting crowded without enforcing a hard limit.
 */
const WIP_SOFT_CAP = 8

/**
 * Translate a board group (a column or a swimlane row) into the matching
 * create-issue prefill fields, so "add issue" lands the new issue exactly where
 * it was created. Maps the groupBy property onto `CreatePrefill`; `'none'`
 * buckets (no project/assignee/etc.) and groupings without a create-prefill slot
 * (cycle/milestone) contribute nothing.
 */
function prefillForGroup(group: IssueGroup, by: GroupBy): CreatePrefill {
  switch (by) {
    case 'status':
      return group.stateId ? { stateId: group.stateId } : {}
    case 'priority':
      return { priority: Number(group.key) as Priority }
    case 'assignee':
      return group.key === 'none' ? {} : { assigneeId: group.key }
    case 'project':
      return group.key === 'none' ? {} : { projectId: group.key }
    case 'label':
      return group.key === 'none' ? {} : { labelIds: [group.key] }
    // cycle / milestone have no CreatePrefill slot — fall through to empty.
    default:
      return {}
  }
}


/** Sum of estimate points across a group's issues (0/undefined estimates skip). */
function estimateSum(issues: Issue[]) {
  return issues.reduce((n, i) => n + (i.estimate ?? 0), 0)
}

/**
 * A small estimate-points badge shown beside a column's issue count — mirrors
 * Linear's board header, which surfaces the summed estimate for the column so
 * you can read its total scope at a glance. Hidden when the sum is zero.
 */
function EstimateBadge({ issues }: { issues: Issue[] }) {
  const sum = estimateSum(issues)
  if (sum <= 0) return null
  return (
    <span
      title={`${sum} estimate points`}
      className="rounded bg-secondary px-1 font-mono text-[11px] text-faint"
    >
      {sum}
    </span>
  )
}

/**
 * A column's card-count chip. For *started*-type status columns it doubles as a
 * soft WIP-limit nudge: once the count climbs past `WIP_SOFT_CAP` the chip turns
 * amber and a tooltip flags the high work-in-progress, mirroring Linear's gentle
 * "you're juggling a lot" affordance without enforcing a hard limit.
 */
function CountChip({ group, groupBy }: { group: IssueGroup; groupBy: GroupBy }) {
  const states = useStore((s) => s.states)
  const isStarted =
    groupBy === 'status' && states.find((s) => s.id === group.stateId)?.type === 'started'
  const overWip = isStarted && group.count > WIP_SOFT_CAP
  return (
    <span className="flex items-center gap-1.5">
      <span
        title={overWip ? 'High work in progress' : undefined}
        className={cn(
          'text-[12px]',
          overWip
            ? 'rounded bg-accent-subtle px-1 font-medium text-accent'
            : 'text-faint',
        )}
      >
        {group.count}
      </span>
      <GroupCompletionBadge issues={group.issues} states={states} />
    </span>
  )
}

/**
 * Tiny block indicator for a board card's footer — mirrors Linear, which marks
 * cards that participate in a 'blocks' relation. A red-tinted slash means the
 * issue is blocked by others (it's the target of a blocks relation); a muted
 * slash means it blocks others. The title summarizes the counts.
 */
function BlockIndicator({ issue }: { issue: Issue }) {
  const relations = useStore((s) => s.relations)
  // 'blocks': fromIssue blocks toIssue → this issue is blocked when it's the
  // toIssue, and blocks others when it's the fromIssue.
  const blockedBy = relations.filter(
    (r) => r.type === 'blocks' && r.toIssueId === issue.id,
  ).length
  const blocking = relations.filter(
    (r) => r.type === 'blocks' && r.fromIssueId === issue.id,
  ).length
  if (blockedBy === 0 && blocking === 0) return null
  // Blocked-by takes visual priority (red); otherwise it's a muted "blocks".
  const title =
    blockedBy > 0
      ? `Blocked by ${blockedBy}${blocking > 0 ? ` · Blocks ${blocking}` : ''}`
      : `Blocks ${blocking}`
  return (
    <span title={title} className="flex items-center">
      <CircleSlash size={13} color={blockedBy > 0 ? '#eb5757' : undefined} />
    </span>
  )
}

function Card({ issue, dragging }: { issue: Issue; dragging?: boolean }) {
  const setPeek = useStore((s) => s.setPeek)
  // The board card honors the same Display-properties toggles as list rows, so
  // showing/hiding a property is consistent across views.
  const { users, labels, states, projects, milestones, cycles, teams, displayProperties } =
    useStoreShallow((s) => ({
      users: s.users,
      labels: s.labels,
      states: s.states,
      projects: s.projects,
      milestones: s.milestones,
      cycles: s.cycles,
      teams: s.teams,
      displayProperties: s.displayProperties,
    }))
  const dp = displayProperties
  const assignee = users.find((u) => u.id === issue.assigneeId)
  const state = states.find((s) => s.id === issue.stateId)
  const project = projects.find((p) => p.id === issue.projectId)
  const milestone = milestones.find((m) => m.id === issue.milestoneId)
  const cycle = cycles.find((c) => c.id === issue.cycleId)
  const issueLabels = issue.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter(Boolean)
  const team = teams.find((t) => t.id === issue.teamId)
  const estimationUsed = teamEstimationType(team) !== 'notUsed'
  const estimateText =
    issue.estimate != null
      ? teamEstimationType(team) === 'tshirt'
        ? estimateLabel(issue.estimate, team)
        : String(issue.estimate)
      : null

  // The footer holds the secondary property chips; suppress it entirely when no
  // chip is enabled so the card stays compact.
  const hasMeta =
    (dp.labels && issueLabels.length > 0) ||
    (dp.dueDate && !!issue.dueDate) ||
    (dp.project && !!project) ||
    (dp.cycle && !!cycle) ||
    (dp.milestone && !!milestone) ||
    (dp.estimate && estimationUsed && !!estimateText) ||
    dp.assignee ||
    dp.creator ||
    issue.subscriberIds.length > 1
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
      {(dp.id || dp.priority) && (
        <div className="mb-1 flex items-center justify-between">
          {dp.id ? (
            <span className="font-mono text-[11px] text-faint">{issue.identifier}</span>
          ) : (
            <span />
          )}
          {dp.priority && <PriorityIcon priority={issue.priority} />}
        </div>
      )}
      <div className="flex items-start gap-1.5">
        {dp.status && state && (
          <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center">
            <StatusIcon type={state.type} color={state.color} />
          </span>
        )}
        <div className="text-[13px] text-fg leading-snug">{issue.title}</div>
      </div>
      {hasMeta && (
        <div className="mt-2 flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1 text-faint">
            {dp.labels &&
              issueLabels.slice(0, 2).map((l) => <LabelDot key={l!.id} color={l!.color} />)}
            <BlockIndicator issue={issue} />
            {dp.dueDate && issue.dueDate && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-[11px]',
                  isOverdue(issue.dueDate)
                    ? 'text-[var(--priority-urgent)]'
                    : isDueSoon(issue.dueDate)
                      ? 'text-[var(--status-started)]'
                      : 'text-faint',
                )}
              >
                <CalendarClock size={11} />
                {formatDate(issue.dueDate)}
              </span>
            )}
            {dp.estimate && estimationUsed && estimateText && (
              <span
                className="flex items-center gap-0.5 text-[11px] text-muted"
                title={estimateLabel(issue.estimate, team)}
              >
                <Gauge size={11} />
                {estimateText}
              </span>
            )}
            {dp.project && project && (
              <span className="flex items-center gap-0.5 text-[11px] text-muted">
                <span className="text-[10px] leading-none">{project.icon}</span>
                <span className="max-w-24 truncate">{project.name}</span>
              </span>
            )}
            {dp.cycle && cycle && (
              <span className="flex items-center gap-0.5 text-[11px] text-muted">
                <IterationCw size={10} />
                {cycle.name ?? `Cycle ${cycle.number}`}
              </span>
            )}
            {dp.milestone && milestone && (
              <span className="flex items-center gap-0.5 text-[11px] text-muted">
                <Diamond size={9} />
                <span className="max-w-24 truncate">{milestone.name}</span>
              </span>
            )}
            <SubscriberBadge issueId={issue.id} />
          </div>
          <div className="flex items-center gap-1">
            <CreatorDisplay issueId={issue.id} />
            {dp.assignee && <Avatar user={assignee} size={18} />}
          </div>
        </div>
      )}
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

/**
 * Cap a board column at this many cards before showing a "Show N more" toggle —
 * mirrors Linear, which keeps very tall columns scannable by collapsing the
 * long tail behind a button. The full `issues` array is kept intact for drag
 * targeting; only the rendered slice is trimmed.
 */
const COLUMN_CAP = 25

/** A droppable card stack. `dropId` lets swimlane cells be uniquely droppable. */
function CardStack({ issues, dropId }: { issues: Issue[]; dropId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId })
  // Component-local expand state, keyed by this column/cell's drop id. Only the
  // rendered list is sliced — `issues` stays whole so drops still land here.
  const [expanded, setExpanded] = useState(false)
  const capped = issues.length > COLUMN_CAP
  const visible = capped && !expanded ? issues.slice(0, COLUMN_CAP) : issues
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 space-y-2 rounded-lg p-1 transition-colors min-h-24',
        isOver && 'bg-accent-subtle',
      )}
    >
      {visible.map((issue) => (
        <DraggableCard key={issue.id} issue={issue} />
      ))}
      {capped && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full rounded px-2 py-1 text-left text-[12px] text-muted transition-colors hover:bg-bg-hover hover:text-fg"
        >
          {expanded ? 'Show less' : `Show ${issues.length - COLUMN_CAP} more`}
        </button>
      )}
    </div>
  )
}

/**
 * A collapsed column: a narrow vertical rail showing the status glyph, the
 * group name (rotated to read bottom-to-top, like Linear) and the count. The
 * whole rail is the expand affordance. Still a droppable so cards can be
 * dragged onto a collapsed column.
 */
function CollapsedRail({
  group,
  groupBy,
  dropId,
  onExpand,
}: {
  group: IssueGroup
  groupBy: GroupBy
  dropId: string
  onExpand: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId })
  return (
    <button
      ref={setNodeRef}
      type="button"
      title={`Expand ${group.label}`}
      onClick={onExpand}
      className={cn(
        'flex w-10 shrink-0 flex-col items-center gap-2 rounded-lg border border-border bg-secondary py-2 transition-colors hover:border-border-strong',
        isOver && 'bg-accent-subtle',
      )}
    >
      <RowGlyph group={group} by={groupBy} />
      <CountChip group={group} groupBy={groupBy} />
      {/* Name reads bottom-to-top, matching Linear's collapsed board columns. */}
      <span
        className="rotate-180 text-[13px] font-medium text-fg"
        style={{ writingMode: 'vertical-rl' }}
      >
        {group.label}
      </span>
    </button>
  )
}

function Column({
  group,
  groupBy,
  collapsed,
  onToggle,
}: {
  group: IssueGroup
  groupBy: GroupBy
  collapsed: boolean
  onToggle: () => void
}) {
  const openCreateWith = useStore((s) => s.openCreateWith)
  const dropId = group.stateId ?? group.key
  if (collapsed)
    return (
      <CollapsedRail
        group={group}
        groupBy={groupBy}
        dropId={dropId}
        onExpand={onToggle}
      />
    )
  return (
    <div className="group flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <RowGlyph group={group} by={groupBy} />
        <span className="text-[13px] font-medium text-fg">{group.label}</span>
        <CountChip group={group} groupBy={groupBy} />
        <EstimateBadge issues={group.issues} />
        <div className="flex-1" />
        <button
          type="button"
          title="Collapse column"
          onClick={onToggle}
          className="flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 transition-opacity hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
        >
          <ChevronsRightLeft size={13} />
        </button>
        <button
          type="button"
          title="Add issue"
          onClick={() => openCreateWith(prefillForGroup(group, groupBy))}
          className="flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 transition-opacity hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
        >
          <Plus size={14} />
        </button>
      </div>
      <CardStack issues={group.issues} dropId={dropId} />
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
  if (by === 'assignee' || by === 'creator') {
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
  groupBy,
  subGroupBy,
  collapsedCols,
}: {
  row: IssueGroup
  columns: IssueGroup[]
  /** What the columns are grouped by — drives the per-cell prefill. */
  groupBy: GroupBy
  subGroupBy: GroupBy
  /** Drop ids of board columns the user collapsed; their cells render as rails. */
  collapsedCols: Set<string>
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
          {columns.map((col) => {
            const colKey = col.stateId ?? col.key
            const dropId = `${row.key}::${colKey}`
            // A collapsed column shows a narrow droppable rail in each lane so
            // cards can still be dragged onto it.
            if (collapsedCols.has(colKey))
              return <SwimlaneRail key={col.key} dropId={dropId} />
            return (
              <SwimlaneCell
                key={col.key}
                issues={cellFor(col)}
                dropId={dropId}
                col={col}
                row={row}
                groupBy={groupBy}
                subGroupBy={subGroupBy}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * One swimlane cell: a column's card stack within a row, plus a hover '+' that
 * creates an issue pre-filled with *both* the column property and the row
 * property — exactly Linear's grid-cell add affordance. The button only shows on
 * hover so the grid stays clean.
 */
function SwimlaneCell({
  issues,
  dropId,
  col,
  row,
  groupBy,
  subGroupBy,
}: {
  issues: Issue[]
  dropId: string
  col: IssueGroup
  row: IssueGroup
  groupBy: GroupBy
  subGroupBy: GroupBy
}) {
  const openCreateWith = useStore((s) => s.openCreateWith)
  return (
    <div className="group/cell relative flex w-72 shrink-0 flex-col">
      <button
        type="button"
        title="Add issue"
        onClick={() =>
          openCreateWith({
            // Column property first, then the row property layered on top — both
            // get pre-filled so the new issue lands in this exact grid cell.
            ...prefillForGroup(col, groupBy),
            ...prefillForGroup(row, subGroupBy),
          })
        }
        className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 transition-opacity hover:bg-bg-hover hover:text-fg group-hover/cell:opacity-100"
      >
        <Plus size={14} />
      </button>
      <CardStack issues={issues} dropId={dropId} />
    </div>
  )
}

/** A collapsed column's cell within a swimlane: a narrow droppable strip. */
function SwimlaneRail({ dropId }: { dropId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-24 w-10 shrink-0 rounded-lg border border-border bg-secondary transition-colors',
        isOver && 'bg-accent-subtle',
      )}
    />
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
  // Column ids the user has collapsed into a narrow rail (component-local; not
  // persisted to the store). Keyed by the column's drop id (state id or key).
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set())
  const toggleCol = (key: string) =>
    setCollapsedCols((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

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
              <ColumnHeader
                key={g.key}
                group={g}
                groupBy={groupBy}
                collapsed={collapsedCols.has(g.stateId ?? g.key)}
                onToggle={() => toggleCol(g.stateId ?? g.key)}
              />
            ))}
          </div>
          <div className="mt-1 space-y-1">
            {visibleRows.map((row) => (
              <Swimlane
                key={row.key}
                row={row}
                columns={groups}
                groupBy={groupBy}
                subGroupBy={subGroupBy}
                collapsedCols={collapsedCols}
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
                      groupBy={groupBy}
                      subGroupBy={subGroupBy}
                      collapsedCols={collapsedCols}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full gap-4 overflow-x-auto p-4">
          {groups.map((g) => (
            <Column
              key={g.key}
              group={g}
              groupBy={groupBy}
              collapsed={collapsedCols.has(g.stateId ?? g.key)}
              onToggle={() => toggleCol(g.stateId ?? g.key)}
            />
          ))}
        </div>
      )}
      <DragOverlay>{active && <Card issue={active} />}</DragOverlay>
    </DndContext>
  )
}

/** A board column header (group glyph + name + total count) for swimlane mode. */
function ColumnHeader({
  group,
  groupBy,
  collapsed,
  onToggle,
}: {
  group: IssueGroup
  groupBy: GroupBy
  collapsed: boolean
  onToggle: () => void
}) {
  const openCreateWith = useStore((s) => s.openCreateWith)
  // Collapsed: a narrow rail header that expands on click; cells below collapse
  // to matching rails so the column reads as a single thin strip.
  if (collapsed)
    return (
      <button
        type="button"
        title={`Expand ${group.label}`}
        onClick={onToggle}
        className="flex w-10 shrink-0 flex-col items-center gap-1.5 rounded-md py-1 hover:bg-bg-hover"
      >
        <RowGlyph group={group} by={groupBy} />
        <CountChip group={group} groupBy={groupBy} />
      </button>
    )
  return (
    <div className="group flex w-72 shrink-0 items-center gap-2 px-1">
      <RowGlyph group={group} by={groupBy} />
      <span className="text-[13px] font-medium text-fg">{group.label}</span>
      <CountChip group={group} groupBy={groupBy} />
      <EstimateBadge issues={group.issues} />
      <div className="flex-1" />
      <button
        type="button"
        title="Collapse column"
        onClick={onToggle}
        className="flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 transition-opacity hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
      >
        <ChevronsRightLeft size={13} />
      </button>
      <button
        type="button"
        title="Add issue"
        onClick={() => openCreateWith(prefillForGroup(group, groupBy))}
        className="flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 transition-opacity hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
