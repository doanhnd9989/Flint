import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import type { Issue } from '@/lib/types'
import type { IssueGroup } from '@/lib/selectors'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { cn } from '@/lib/utils'

function Card({ issue, dragging }: { issue: Issue; dragging?: boolean }) {
  const navigate = useNavigate()
  const { users, labels } = useStoreShallow((s) => ({ users: s.users, labels: s.labels }))
  const assignee = users.find((u) => u.id === issue.assigneeId)
  const issueLabels = issue.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter(Boolean)
  return (
    <div
      onClick={() => navigate(`/issue/${issue.identifier}`)}
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

function Column({ group }: { group: IssueGroup }) {
  const { setNodeRef, isOver } = useDroppable({ id: group.stateId ?? group.key })
  const states = useStore((s) => s.states)
  const state = states.find((s) => s.id === group.stateId)
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        {state && <StatusIcon type={state.type} color={state.color} />}
        <span className="text-[13px] font-medium text-fg">{group.label}</span>
        <span className="text-[12px] text-faint">{group.count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 rounded-lg p-1 transition-colors min-h-24',
          isOver && 'bg-accent-subtle',
        )}
      >
        {group.issues.map((issue) => (
          <DraggableCard key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  )
}

export function IssueBoard({ groups }: { groups: IssueGroup[] }) {
  const moveIssue = useStore((s) => s.moveIssue)
  const [active, setActive] = useState<Issue | null>(null)
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
    if (issue && overId && issue.stateId !== overId) {
      moveIssue(issue.id, overId, issue.sortOrder)
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd}>
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {groups.map((g) => (
          <Column key={g.key} group={g} />
        ))}
      </div>
      <DragOverlay>{active && <Card issue={active} />}</DragOverlay>
    </DndContext>
  )
}
