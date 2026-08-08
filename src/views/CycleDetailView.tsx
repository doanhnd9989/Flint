import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronDown, PanelRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cycleState, filterIssues, groupIssues, sortIssues } from '@/lib/selectors'
import type { GroupBy, OrderBy, OrderDir, ViewLayout } from '@/lib/types'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { IssueBoard } from '@/components/IssueBoard'
import { DisplayMenu } from '@/components/DisplayMenu'
import { FilterTrigger, emptyFilters } from '@/components/FilterBar'
import { Popover } from '@/components/ui/Popover'
import { CycleContextMenu } from '@/components/CycleContextMenu'
import { CycleSidePanel } from '@/components/CycleSidePanel'
import { StarButton } from '@/components/StarButton'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, CycleIllustration } from '@/components/EmptyState'
import { MoreHorizontal } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

/**
 * A single cycle. Linear's shape: the issue list *is* the page, the numbers
 * live in a right-hand panel, and the cycle you're looking at is switched from
 * the breadcrumb (`Cycle 14 ▾`) or with ⌥J / ⌥K — there is no cycle rail.
 */
export function CycleDetailView() {
  const { teamKey, cycleRef } = useParams()
  const navigate = useNavigate()
  const data = useStore()
  const team = data.teams.find((t) => t.key === teamKey) ?? data.teams[0]
  const nowMs = Date.now()

  const cycles = useMemo(
    () =>
      data.cycles
        .filter((c) => c.teamId === team.id)
        .sort((a, b) => a.number - b.number),
    [data.cycles, team.id],
  )

  const [searchParams] = useSearchParams()

  const activeId = useMemo(() => {
    const active = cycles.find(
      (c) => cycleState(c.startsAt, c.endsAt, nowMs).status === 'active',
    )
    return active?.id ?? cycles[cycles.length - 1]?.id
  }, [cycles, nowMs])

  const upcomingId = useMemo(
    () =>
      cycles.find(
        (c) => cycleState(c.startsAt, c.endsAt, nowMs).status === 'upcoming',
      )?.id,
    [cycles, nowMs],
  )

  // Linear addresses a cycle as /team/:key/cycle/:ref, where ref is `active`,
  // `upcoming`, or the cycle number. `current` is our own older spelling, kept
  // as an alias so existing links still resolve; the legacy `?c=` query is
  // honoured too so older links and saved tabs keep landing on the right cycle.
  const requested = cycleRef ?? searchParams.get('c')
  const current =
    (requested === 'upcoming'
      ? cycles.find((c) => c.id === (upcomingId ?? activeId))
      : requested === 'active' || requested === 'current'
        ? cycles.find((c) => c.id === activeId)
        : requested
          ? cycles.find((c) => String(c.number) === requested)
          : undefined) ?? cycles.find((c) => c.id === activeId)

  const [panelOpen, setPanelOpen] = useState(true)
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
  const [cycleMenu, setCycleMenu] = useState<{ x: number; y: number } | null>(null)

  // The cycles either side of this one, for the breadcrumb switcher and ⌥J/⌥K.
  const idx = current ? cycles.findIndex((c) => c.id === current.id) : -1
  const prevCycle = idx > 0 ? cycles[idx - 1] : undefined
  const nextCycle = idx >= 0 && idx < cycles.length - 1 ? cycles[idx + 1] : undefined

  const goTo = (number: number) =>
    navigate(`/team/${team.key}/cycle/${number}`)

  // ⌥J previous cycle, ⌥K next — Linear's pairing, and the same shortcuts its
  // breadcrumb menu advertises. `code` rather than `key`: Alt rewrites `key`
  // to a dead character on macOS.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA)$/.test(el.tagName))) return
      if (e.code === 'KeyJ' && prevCycle) {
        e.preventDefault()
        goTo(prevCycle.number)
      } else if (e.code === 'KeyK' && nextCycle) {
        e.preventDefault()
        goTo(nextCycle.number)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const { groups, issueCount } = useMemo(() => {
    if (!current) return { groups: [], issueCount: 0 }
    let scoped = data.issues.filter(
      (i) => i.cycleId === current.id && !i.archivedAt,
    )
    if (!showSubIssues) scoped = scoped.filter((i) => !i.parentId)
    const statesByType = new Map(data.states.map((s) => [s.id, s.type]))
    if (data.hideCompleted)
      scoped = scoped.filter((i) => {
        const t = statesByType.get(i.stateId)
        return t !== 'completed' && t !== 'canceled'
      })
    const filtered = filterIssues(scoped, filters)
    const sorted = sortIssues(
      filtered,
      orderBy,
      data,
      orderCompletedByRecency,
      orderDir,
    )
    const dn = data.preferences.displayNames
    const top = groupIssues(sorted, groupBy, data, showEmptyGroups, dn)
    const groups =
      subGroupBy !== 'none'
        ? top.map((g) => ({
            ...g,
            subGroups: groupIssues(g.issues, subGroupBy, data, showEmptyGroups, dn),
          }))
        : top
    return { groups, issueCount: filtered.length }
  }, [
    data,
    current,
    groupBy,
    subGroupBy,
    orderBy,
    orderDir,
    orderCompletedByRecency,
    filters,
    showSubIssues,
    showEmptyGroups,
  ])

  if (cycles.length === 0 || !current) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title="Cycles" teamName={team.name} teamIcon={team.icon} />
        <EmptyState
          illustration={<CycleIllustration />}
          title="No cycles for this team yet"
          description="Cycles are time-boxed sprints. Enable them to plan work in regular intervals."
        />
      </div>
    )
  }

  const title = current.name ?? `Cycle ${current.number}`

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Cycles"
        titleHref={`/team/${team.key}/cycles`}
        teamName={team.name}
        teamIcon={team.icon}
        trail={
          <div className="flex items-center gap-1">
            <Popover
              align="start"
              width={260}
              trigger={
                <span className="flex items-center gap-1 rounded px-1 py-0.5 font-medium text-fg hover:bg-bg-hover">
                  {title}
                  <ChevronDown size={12} className="text-faint" />
                </span>
              }
            >
              {(close) => (
                <div className="py-1">
                  <CycleJump
                    heading={
                      nextCycle
                        ? `Next cycle (${phaseWord(nextCycle, nowMs)})`
                        : undefined
                    }
                    cycle={nextCycle}
                    hint="⌥K"
                    onPick={(n) => {
                      goTo(n)
                      close()
                    }}
                  />
                  <CycleJump
                    heading={
                      prevCycle
                        ? `Previous cycle (${phaseWord(prevCycle, nowMs)})`
                        : undefined
                    }
                    cycle={prevCycle}
                    hint="⌥J"
                    onPick={(n) => {
                      goTo(n)
                      close()
                    }}
                  />
                  {!nextCycle && !prevCycle && (
                    <div className="px-3 py-2 text-[12px] text-faint">
                      No other cycles
                    </div>
                  )}
                </div>
              )}
            </Popover>
            <StarButton type="cycle" id={current.id} size={14} />
            <button
              type="button"
              aria-label="Cycle options"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                setCycleMenu({ x: r.left, y: r.bottom + 4 })
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-bg-hover hover:text-fg"
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        }
      />

      {/* Toolbar: the issue count on the left, filter / display / panel on the
          right — the row Linear puts directly under the breadcrumb. */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-4">
        <span className="text-[13px] text-muted">
          {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <FilterTrigger
            filters={filters}
            onChange={setFilters}
            scope={data.issues.filter(
              (i) => i.cycleId === current.id && !i.archivedAt,
            )}
          />
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
          <button
            type="button"
            aria-label={panelOpen ? 'Close cycle details' : 'Open cycle details'}
            onClick={() => setPanelOpen((v) => !v)}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded hover:bg-bg-hover',
              panelOpen ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            <PanelRight size={15} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {layout === 'board' ? (
            <IssueBoard groups={groups} groupBy={groupBy} />
          ) : (
            <GroupedIssueList groups={groups} groupBy={groupBy} />
          )}
        </div>
        {panelOpen && (
          <CycleSidePanel
            cycleId={current.id}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </div>

      {cycleMenu && (
        <CycleContextMenu
          cycleId={current.id}
          x={cycleMenu.x}
          y={cycleMenu.y}
          nowMs={nowMs}
          onClose={() => setCycleMenu(null)}
        />
      )}
    </div>
  )
}

/** "upcoming" / "current" / "completed" — the word Linear puts in the heading. */
function phaseWord(
  cycle: { startsAt: string; endsAt: string },
  nowMs: number,
): string {
  const s = cycleState(cycle.startsAt, cycle.endsAt, nowMs).status
  return s === 'active' ? 'current' : s === 'upcoming' ? 'upcoming' : 'completed'
}

/** One half of the breadcrumb switcher: a heading and the cycle it jumps to. */
function CycleJump({
  heading,
  cycle,
  hint,
  onPick,
}: {
  heading?: string
  cycle?: { number: number; name?: string; startsAt: string; endsAt: string }
  hint: string
  onPick: (n: number) => void
}) {
  if (!cycle || !heading) return null
  return (
    <>
      <div className="px-3 pb-1 pt-1.5 text-[11px] text-faint">{heading}</div>
      <button
        type="button"
        onClick={() => onPick(cycle.number)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-bg-hover"
      >
        <span className="text-[13px] text-fg">
          {cycle.name ?? `Cycle ${cycle.number}`}
        </span>
        <span className="text-[12px] text-faint">
          {formatDate(cycle.startsAt)} - {formatDate(cycle.endsAt)}
        </span>
        <span className="ml-auto text-[11px] text-faint">{hint}</span>
      </button>
    </>
  )
}
