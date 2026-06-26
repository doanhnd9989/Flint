import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowDownUp, Check, ChevronDown, X } from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, CheckIllustration } from '@/components/EmptyState'
import { StatusIcon } from '@/components/StatusIcon'
import { PriorityIcon } from '@/components/PriorityIcon'
import { Avatar } from '@/components/Avatar'
import { LabelDot } from '@/components/LabelChip'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import {
  StatusPicker,
  PriorityPicker,
  AssigneePicker,
  LabelPicker,
} from '@/components/pickers'
import { PRIORITY_LABELS, PRIORITY_ORDER, PRIORITY_SORT } from '@/lib/constants'
import type { Priority } from '@/lib/types'

const chip =
  'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover'

/** Ordering options for the Triage queue (local-only). */
type SortKey = 'newest' | 'oldest' | 'priority'
const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  priority: 'Priority high→low',
}

export function TriageView() {
  const { teamKey } = useParams()
  const store = useStore()
  const fmt = useDisplayName()
  const team = store.teams.find((t) => t.key === teamKey) ?? store.teams[0]

  // Local-only header controls: a priority filter ('all' or a Priority value)
  // and a sort order. They compose — filter narrows, then sort orders.
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('newest')

  // The full triage queue for this team (also the count shown in the header).
  const allQueue = useMemo(
    () =>
      store.issues.filter(
        (i) => i.teamId === team.id && i.triage && !i.archivedAt,
      ),
    [store.issues, team.id],
  )

  // Apply the priority filter, then the chosen sort order.
  const queue = useMemo(() => {
    const filtered =
      priorityFilter === 'all'
        ? allQueue
        : allQueue.filter((i) => i.priority === Number(priorityFilter))
    const sorted = [...filtered]
    if (sort === 'priority') {
      sorted.sort((a, b) => PRIORITY_SORT[a.priority] - PRIORITY_SORT[b.priority])
    } else if (sort === 'oldest') {
      sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    } else {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return sorted
  }, [allQueue, priorityFilter, sort])

  // Priority filter options: "All priorities" + every priority in visual order.
  const priorityOptions = useMemo<SelectOption[]>(
    () => [
      { id: 'all', label: 'All priorities', selected: priorityFilter === 'all' },
      ...PRIORITY_ORDER.map((p) => ({
        id: String(p),
        label: PRIORITY_LABELS[p],
        icon: <PriorityIcon priority={p} />,
        selected: priorityFilter === String(p),
      })),
    ],
    [priorityFilter],
  )

  // Sort options, in menu order.
  const sortOptions = useMemo<SelectOption[]>(
    () =>
      (['newest', 'oldest', 'priority'] as SortKey[]).map((k) => ({
        id: k,
        label: SORT_LABELS[k],
        selected: sort === k,
      })),
    [sort],
  )

  // Label for the priority-filter trigger chip.
  const priorityFilterLabel =
    priorityFilter === 'all'
      ? 'All priorities'
      : PRIORITY_LABELS[Number(priorityFilter) as Priority]

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Triage" teamName={team.name} teamIcon={team.icon}>
        <span className="text-[12px] tabular-nums text-faint">
          {allQueue.length}
        </span>
        {/* Header controls — priority filter + sort, both local-only. Hidden
            when there's nothing in the queue at all. */}
        {allQueue.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <SelectMenu
              width={200}
              align="end"
              options={priorityOptions}
              onSelect={setPriorityFilter}
              placeholder="Filter by priority…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <span className="max-w-[120px] truncate">{priorityFilterLabel}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
            <SelectMenu
              width={200}
              align="end"
              options={sortOptions}
              onSelect={(id) => setSort(id as SortKey)}
              placeholder="Sort by…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <ArrowDownUp size={13} className="shrink-0 text-faint" />
                  <span className="max-w-[120px] truncate">{SORT_LABELS[sort]}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
          </div>
        )}
      </ViewHeader>
      <div className="flex-1 overflow-y-auto p-4">
        {allQueue.length === 0 ? (
          <EmptyState
            illustration={<CheckIllustration />}
            title="Triage is clear"
            description="New issues that need triage will show up here. Nothing to review right now."
          />
        ) : queue.length === 0 ? (
          <EmptyState
            illustration={<CheckIllustration />}
            title="No matching issues"
            description="No issues in this triage queue match the selected priority."
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            {queue.map((issue) => {
              const state = store.states.find((s) => s.id === issue.stateId)!
              const assignee = store.users.find((u) => u.id === issue.assigneeId)
              const labels = issue.labelIds
                .map((id) => store.labels.find((l) => l.id === id))
                .filter(Boolean)
              return (
                <div
                  key={issue.id}
                  className="rounded-xl border border-border bg-bg-secondary p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => store.setPeek(issue.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-faint">{issue.identifier}</span>
                        <span className="text-[14px] font-medium text-fg">{issue.title}</span>
                      </div>
                      {issue.description && (
                        <p className="mt-1 line-clamp-2 text-[12px] text-muted">
                          {issue.description}
                        </p>
                      )}
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => store.acceptTriage(issue.id)}
                        className="flex items-center gap-1 rounded-md bg-[var(--status-review)] px-2.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
                      >
                        <Check size={13} /> Accept
                      </button>
                      <button
                        onClick={() => store.declineTriage(issue.id)}
                        className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
                      >
                        <X size={13} /> Decline
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <StatusPicker
                      stateId={issue.stateId}
                      onChange={(id) => store.setIssueStatus(issue.id, id)}
                      trigger={
                        <span className={chip}>
                          <StatusIcon type={state.type} color={state.color} />
                          {state.name}
                        </span>
                      }
                    />
                    <PriorityPicker
                      priority={issue.priority}
                      onChange={(p) => store.setIssuePriority(issue.id, p)}
                      trigger={
                        <span className={chip}>
                          <PriorityIcon priority={issue.priority} />
                          {PRIORITY_LABELS[issue.priority]}
                        </span>
                      }
                    />
                    <AssigneePicker
                      assigneeId={issue.assigneeId}
                      onChange={(id) => store.setIssueAssignee(issue.id, id)}
                      trigger={
                        <span className={chip}>
                          <Avatar user={assignee} size={16} />
                          {assignee ? fmt(assignee.name) : 'Assignee'}
                        </span>
                      }
                    />
                    <LabelPicker
                      labelIds={issue.labelIds}
                      onToggle={(id) => store.toggleIssueLabel(issue.id, id)}
                      trigger={
                        <span className={chip}>
                          {labels.length ? (
                            <>
                              {labels.slice(0, 3).map((l) => (
                                <LabelDot key={l!.id} color={l!.color} />
                              ))}
                              {labels.length} label{labels.length > 1 ? 's' : ''}
                            </>
                          ) : (
                            'Label'
                          )}
                        </span>
                      }
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
