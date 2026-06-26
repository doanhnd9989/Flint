import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Bookmark, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { filterIssues, groupIssues, sortIssues, boardColumnGroupBy } from '@/lib/selectors'
import type { GroupBy, Issue, OrderBy, OrderDir, ViewLayout } from '@/lib/types'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { IssueBoard } from '@/components/IssueBoard'
import { DisplayMenu } from '@/components/DisplayMenu'
import { ViewHeader } from '@/components/ViewHeader'
import { FilterBar, emptyFilters } from '@/components/FilterBar'
import { cn } from '@/lib/utils'

type Tab = 'active' | 'backlog' | 'all'

// Linear's quick-filter presets — a compact row that composes on top of the
// chip filters. Each tests a single issue (against the current user / its
// state type); only one can be active at a time.
type Preset = 'assignedToMe' | 'createdByMe' | 'notStarted' | 'completed'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'assignedToMe', label: 'Assigned to me' },
  { id: 'createdByMe', label: 'Created by me' },
  { id: 'notStarted', label: 'Not started' },
  { id: 'completed', label: 'Completed' },
]

export function IssuesView() {
  const { teamKey } = useParams()
  const navigate = useNavigate()
  const data = useStore()
  const [tab, setTab] = useState<Tab>('active')
  const [layout, setLayout] = useState<ViewLayout>('list')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [subGroupBy, setSubGroupBy] = useState<GroupBy>('none')
  const [orderBy, setOrderBy] = useState<OrderBy>('priority')
  const [orderDir, setOrderDir] = useState<OrderDir>('asc')
  const [orderCompletedByRecency, setOrderCompletedByRecency] = useState(false)
  const [showSubIssues, setShowSubIssues] = useState(true)
  const [nestedSubIssues, setNestedSubIssues] = useState(false)
  const [showEmptyGroups, setShowEmptyGroups] = useState(false)
  const [filters, setFilters] = useState(emptyFilters())
  const [preset, setPreset] = useState<Preset | null>(null)

  const team = data.teams.find((t) => t.key === teamKey) ?? data.teams[0]
  const me = data.currentUserId

  // Nesting only makes sense in the list view with sub-issues shown.
  const nested = layout === 'list' && showSubIssues && nestedSubIssues

  const { groups, childrenByParent, rows } = useMemo(() => {
    const statesByType = new Map(data.states.map((s) => [s.id, s.type]))
    let scoped = data.issues.filter((i) => i.teamId === team.id && !i.triage)
    if (tab === 'active')
      scoped = scoped.filter((i) => {
        const t = statesByType.get(i.stateId)
        return t === 'unstarted' || t === 'started' || t === 'completed'
      })
    else if (tab === 'backlog')
      scoped = scoped.filter((i) => statesByType.get(i.stateId) === 'backlog')

    if (!showSubIssues) scoped = scoped.filter((i) => !i.parentId)

    let filtered = filterIssues(scoped, filters)
    // Quick-filter preset composes on top of the chip filters.
    if (preset === 'assignedToMe') filtered = filtered.filter((i) => i.assigneeId === me)
    else if (preset === 'createdByMe') filtered = filtered.filter((i) => i.creatorId === me)
    else if (preset === 'notStarted')
      filtered = filtered.filter((i) => {
        const t = statesByType.get(i.stateId)
        return t === 'backlog' || t === 'unstarted'
      })
    else if (preset === 'completed')
      filtered = filtered.filter((i) => statesByType.get(i.stateId) === 'completed')
    const sorted = sortIssues(
      filtered,
      orderBy,
      data,
      orderCompletedByRecency,
      orderDir,
    )

    // Nested mode: pull every sub-issue (whose parent is visible) out of its
    // own status group and render it under its parent. Issues whose parent is
    // not in the visible set stay at the top level.
    let childrenByParent: Record<string, Issue[]> | undefined
    let forGrouping = sorted
    if (nested) {
      const visible = new Set(sorted.map((i) => i.id))
      const map: Record<string, Issue[]> = {}
      for (const i of sorted) {
        if (i.parentId && visible.has(i.parentId)) (map[i.parentId] ??= []).push(i)
      }
      childrenByParent = map
      forGrouping = sorted.filter((i) => !i.parentId || !visible.has(i.parentId))
    }

    const dn = data.preferences.displayNames
    const top = groupIssues(
      forGrouping,
      // The board groups by any single-valued, settable property; label/cycle/
      // milestone groupings have no draggable columns — fall back to status.
      layout === 'board' ? boardColumnGroupBy(groupBy) : groupBy,
      data,
      showEmptyGroups,
      dn,
    )
    // Sub-grouping: each top group carries its issues sub-grouped. In the list
    // these render as nested sub-group headers; on the board they become the
    // per-column cells of each swimlane (row).
    const groups =
      subGroupBy !== 'none'
        ? top.map((g) => ({
            ...g,
            subGroups: groupIssues(g.issues, subGroupBy, data, showEmptyGroups, dn),
          }))
        : top
    // Board swimlanes: the ordered set of row groups (incl. empty ones, which
    // the board collapses into a "Hidden rows" bar).
    const rows =
      layout === 'board' && subGroupBy !== 'none'
        ? groupIssues(forGrouping, subGroupBy, data, true, dn)
        : undefined
    return { groups, childrenByParent, rows }
  }, [
    data,
    team.id,
    tab,
    groupBy,
    subGroupBy,
    orderBy,
    orderDir,
    orderCompletedByRecency,
    layout,
    filters,
    preset,
    me,
    showSubIssues,
    nested,
    showEmptyGroups,
  ])

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Issues"
        teamName={team.name}
        teamIcon={team.icon}
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const name = prompt('Save view as…')
                if (!name?.trim()) return
                const view = data.createView({
                  name: name.trim(),
                  icon: 'layers',
                  layout,
                  groupBy,
                  orderBy,
                  filters,
                })
                navigate(`/view/${view.id}`)
              }}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover"
            >
              <Bookmark size={13} /> Save view
            </button>
            <DisplayMenu
              layout={layout}
              groupBy={groupBy}
              orderBy={orderBy}
              onLayout={setLayout}
              onGroupBy={setGroupBy}
              onOrderBy={setOrderBy}
              orderDir={orderDir}
              onOrderDir={setOrderDir}
              subGroupBy={subGroupBy}
              onSubGroupBy={setSubGroupBy}
              orderCompletedByRecency={orderCompletedByRecency}
              onOrderCompletedByRecency={setOrderCompletedByRecency}
              showSubIssues={showSubIssues}
              onShowSubIssues={setShowSubIssues}
              nestedSubIssues={nestedSubIssues}
              onNestedSubIssues={setNestedSubIssues}
              showEmptyGroups={showEmptyGroups}
              onShowEmptyGroups={setShowEmptyGroups}
            />
          </div>
        }
      >
        <div className="flex items-center gap-1">
          {(['active', 'backlog', 'all'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] capitalize text-muted hover:bg-bg-hover',
                tab === t && 'bg-bg-selected text-fg font-medium',
              )}
            >
              {t === 'all' ? 'All issues' : t}
            </button>
          ))}
        </div>
      </ViewHeader>

      <FilterBar filters={filters} onChange={setFilters} />

      {/* Quick-filter presets — clicking the active pill clears it. */}
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-1.5">
        {PRESETS.map((p) => {
          const on = preset === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset((cur) => (cur === p.id ? null : p.id))}
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] transition-colors',
                on
                  ? 'border-border bg-secondary font-medium text-fg'
                  : 'border-transparent text-muted hover:bg-bg-hover hover:text-fg',
              )}
            >
              {p.label}
              {on && <X size={12} className="text-faint" />}
            </button>
          )
        })}
      </div>

      {layout === 'board' ? (
        <IssueBoard
          groups={groups}
          rows={rows}
          subGroupBy={subGroupBy}
          groupBy={boardColumnGroupBy(groupBy)}
        />
      ) : (
        <GroupedIssueList
          groups={groups}
          groupBy={groupBy}
          subGroupBy={subGroupBy}
          childrenByParent={nested ? childrenByParent : undefined}
          onReorder={(id, sortOrder) => {
            data.setIssueSortOrder(id, sortOrder)
            setOrderBy('manual')
          }}
        />
      )}
    </div>
  )
}
