import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { boardColumnGroupBy, groupIssues, sortIssues } from '@/lib/selectors'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { IssueBoard } from '@/components/IssueBoard'
import { DisplayMenu } from '@/components/DisplayMenu'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, IssuesIllustration } from '@/components/EmptyState'
import type { GroupBy, OrderBy, OrderDir, ViewLayout } from '@/lib/types'

/**
 * Label issues view — Linear's "click a label, see every issue carrying it".
 * Shows all non-triage issues whose `labelIds` includes this label (or, when
 * the label is a group, any of its child labels). Like every Linear issue list,
 * the view carries its own Display menu: list/board layout, grouping, ordering
 * (with direction) and an empty-groups toggle — defaulting to status × priority
 * the way the default Issues view does.
 */
export function LabelView() {
  const { id } = useParams()
  const data = useStore()

  // Per-view display config — local to this surface, just like Linear's
  // unsaved Display options on a label page.
  const [layout, setLayout] = useState<ViewLayout>('list')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [orderBy, setOrderBy] = useState<OrderBy>('priority')
  const [orderDir, setOrderDir] = useState<OrderDir>('asc')
  const [showEmptyGroups, setShowEmptyGroups] = useState(false)

  // Inline rename state for the header — Linear lets you click a label's name on
  // its page and edit it in place. `editing` holds the draft; null means idle.
  const [editing, setEditing] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const label = data.labels.find((l) => l.id === id)

  // Focus + select the input whenever rename opens.
  useEffect(() => {
    if (editing !== null) inputRef.current?.select()
  }, [editing])

  // Commit the draft: trim, then save via the store. Empty names revert.
  const commitRename = () => {
    if (!label || editing === null) return
    const next = editing.trim()
    if (next && next !== label.name) data.updateLabel(label.id, { name: next })
    setEditing(null)
  }

  // The set of label ids that "count" for this view: the label itself, plus all
  // child labels when it is a group.
  const labelIds = useMemo(() => {
    if (!label) return new Set<string>()
    const ids = new Set<string>([label.id])
    if (label.isGroup) {
      for (const l of data.labels) if (l.groupId === label.id) ids.add(l.id)
    }
    return ids
  }, [label, data.labels])

  // All non-triage, non-archived issues carrying this label (or, for a group,
  // any of its children). Shared by the grouping below and the stats header.
  const scoped = useMemo(
    () =>
      label
        ? data.issues.filter(
            (i) => !i.triage && !i.archivedAt && i.labelIds.some((l) => labelIds.has(l)),
          )
        : [],
    [label, data.issues, labelIds],
  )

  // Stats header — Linear shows completion progress for a label's work. We split
  // the scoped issues into completed (done/canceled) vs. open and derive a
  // percentage for the little progress bar.
  const stats = useMemo(() => {
    const byState = new Map(data.states.map((s) => [s.id, s.type]))
    let completed = 0
    for (const i of scoped) {
      const type = byState.get(i.stateId)
      if (type === 'completed' || type === 'canceled') completed += 1
    }
    const total = scoped.length
    return { total, completed, open: total - completed, pct: total ? completed / total : 0 }
  }, [scoped, data.states])

  const groups = useMemo(() => {
    if (!label) return []
    const sorted = sortIssues(scoped, orderBy, data, false, orderDir)
    // The board groups by columns; label/cycle/milestone fall back to status.
    const effectiveGroupBy = layout === 'board' ? boardColumnGroupBy(groupBy) : groupBy
    return groupIssues(
      sorted,
      effectiveGroupBy,
      data,
      showEmptyGroups,
      data.preferences.displayNames,
    )
  }, [label, scoped, data, groupBy, orderBy, orderDir, layout, showEmptyGroups])

  if (!label) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title="Label" />
        <EmptyState
          illustration={<IssuesIllustration />}
          title="Label not found"
          description="This label may have been deleted or renamed."
        />
      </div>
    )
  }

  const count = groups.reduce((n, g) => n + g.count, 0)
  const boardGroupBy = boardColumnGroupBy(groupBy)

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={label.name}
        right={
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-faint">
              {count} {count === 1 ? 'issue' : 'issues'}
            </span>
            <DisplayMenu
              layout={layout}
              groupBy={groupBy}
              orderBy={orderBy}
              orderDir={orderDir}
              onLayout={setLayout}
              onGroupBy={setGroupBy}
              onOrderBy={setOrderBy}
              onOrderDir={setOrderDir}
              showEmptyGroups={showEmptyGroups}
              onShowEmptyGroups={setShowEmptyGroups}
            />
          </div>
        }
      >
        <span className="flex items-center gap-2 text-[13px]">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: label.color }}
          />
          {editing !== null ? (
            <input
              ref={inputRef}
              value={editing}
              onChange={(e) => setEditing(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitRename()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setEditing(null)
                }
              }}
              className="w-44 rounded border border-border bg-bg px-1.5 py-0.5 text-[13px] font-medium text-fg outline-none focus:border-accent"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(label.name)}
              title="Rename label"
              className="-mx-1 rounded px-1 py-0.5 font-medium text-fg hover:bg-bg-hover"
            >
              {label.name}
            </button>
          )}
        </span>
      </ViewHeader>

      {/* Label stats banner — total / open / completed plus a completion bar,
          mirroring the progress summary Linear shows for a label's work. */}
      {stats.total > 0 && (
        <div className="flex items-center gap-5 border-b border-border bg-bg px-6 py-2.5">
          <Stat label="Total" value={stats.total} />
          <Stat label="Open" value={stats.open} />
          <Stat label="Completed" value={stats.completed} />
          <div className="flex flex-1 items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${stats.pct * 100}%`, background: label.color }}
              />
            </div>
            <span className="w-9 text-right text-[12px] tabular-nums text-muted">
              {Math.round(stats.pct * 100)}%
            </span>
          </div>
        </div>
      )}

      {layout === 'board' ? (
        <IssueBoard groups={groups} groupBy={boardGroupBy} />
      ) : (
        <GroupedIssueList
          groups={groups}
          groupBy={groupBy}
          onReorder={
            orderBy === 'manual'
              ? (issueId, sortOrder) => data.setIssueSortOrder(issueId, sortOrder)
              : undefined
          }
          empty={{
            title: 'No issues with this label',
            description: 'Issues tagged with this label will show up here.',
          }}
        />
      )}
    </div>
  )
}

/** A single labelled count in the stats banner. */
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5 text-[12px]">
      <span className="font-medium tabular-nums text-fg">{value}</span>
      <span className="text-faint">{label}</span>
    </span>
  )
}
