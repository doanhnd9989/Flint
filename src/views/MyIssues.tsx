import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronRight,
  MessageSquare,
  GitBranch,
  Flag,
  Tag,
  PenLine,
  CircleDashed,
  Link2,
  Diamond,
  IterationCw,
  FolderClosed,
  UserRound,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { filterIssues, groupIssues, sortIssues, boardColumnGroupBy } from '@/lib/selectors'
import type {
  Activity,
  ActivityKind,
  GroupBy,
  Issue,
  OrderBy,
  OrderDir,
  ViewLayout,
} from '@/lib/types'
import { GroupedIssueList } from '@/components/GroupedIssueList'
import { IssueBoard } from '@/components/IssueBoard'
import { DisplayMenu } from '@/components/DisplayMenu'
import { FilterBar, emptyFilters } from '@/components/FilterBar'
import { ViewHeader } from '@/components/ViewHeader'
import { StatusIcon } from '@/components/StatusIcon'
import { PriorityIcon } from '@/components/PriorityIcon'
import { EmptyState, CheckIllustration } from '@/components/EmptyState'
import { cn } from '@/lib/utils'

const TABS = ['assigned', 'created', 'subscribed', 'activity'] as const
type Tab = (typeof TABS)[number]

function isTab(v: string | undefined): v is Tab {
  return (TABS as readonly string[]).includes(v ?? '')
}

/** Empty-state copy per tab, matching Linear's wording. */
const EMPTY: Record<Exclude<Tab, 'activity'>, { title: string; description: string }> = {
  assigned: {
    title: 'No issues assigned to you',
    description: 'Issues assigned to you will show up here.',
  },
  created: {
    title: 'No issues created by you',
    description: 'Issues you create will show up here.',
  },
  subscribed: {
    title: 'No subscribed issues',
    description: "Issues you're subscribed to will show up here.",
  },
}

export function MyIssues() {
  const navigate = useNavigate()
  const params = useParams<{ tab?: string }>()
  const tab: Tab = isTab(params.tab) ? params.tab : 'assigned'

  // Display + filter state, held here so it persists across the issue tabs
  // (Linear applies the same display options across Assigned/Created/Subscribed).
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

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="My Issues" />

      {/* Tabs (Linear-style pill sub-nav) + Display options on the right */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-4 py-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => navigate(`/my-issues/${t}`)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[13px] capitalize text-muted hover:bg-bg-hover',
              tab === t && 'bg-bg-selected font-medium text-fg',
            )}
          >
            {t}
          </button>
        ))}
        {tab !== 'activity' && (
          <div className="ml-auto">
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
        )}
      </div>

      {tab === 'activity' ? (
        <ActivityFeed />
      ) : (
        <IssueTab
          tab={tab}
          layout={layout}
          groupBy={groupBy}
          subGroupBy={subGroupBy}
          orderBy={orderBy}
          orderDir={orderDir}
          orderCompletedByRecency={orderCompletedByRecency}
          showSubIssues={showSubIssues}
          nestedSubIssues={nestedSubIssues}
          showEmptyGroups={showEmptyGroups}
          filters={filters}
          onFilters={setFilters}
          onManualReorder={() => setOrderBy('manual')}
        />
      )}
    </div>
  )
}

// ── Issue tabs (Assigned / Created / Subscribed) ───────────────

interface IssueTabProps {
  tab: Exclude<Tab, 'activity'>
  layout: ViewLayout
  groupBy: GroupBy
  subGroupBy: GroupBy
  orderBy: OrderBy
  orderDir: OrderDir
  orderCompletedByRecency: boolean
  showSubIssues: boolean
  nestedSubIssues: boolean
  showEmptyGroups: boolean
  filters: ReturnType<typeof emptyFilters>
  onFilters: (f: ReturnType<typeof emptyFilters>) => void
  onManualReorder: () => void
}

function IssueTab({
  tab,
  layout,
  groupBy,
  subGroupBy,
  orderBy,
  orderDir,
  orderCompletedByRecency,
  showSubIssues,
  nestedSubIssues,
  showEmptyGroups,
  filters,
  onFilters,
  onManualReorder,
}: IssueTabProps) {
  const data = useStore()

  // Nesting only makes sense in the list view with sub-issues shown.
  const nested = layout === 'list' && showSubIssues && nestedSubIssues

  const { groups, childrenByParent, rows } = useMemo(() => {
    const me = data.currentUserId
    let scoped = data.issues.filter((i) => {
      if (i.triage) return false
      if (tab === 'assigned') return i.assigneeId === me
      if (tab === 'created') return i.creatorId === me
      return i.subscriberIds.includes(me) // subscribed
    })

    if (!showSubIssues) scoped = scoped.filter((i) => !i.parentId)

    const filtered = filterIssues(scoped, filters)
    const sorted = sortIssues(
      filtered,
      orderBy,
      data,
      orderCompletedByRecency,
      orderDir,
    )

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
      layout === 'board' ? boardColumnGroupBy(groupBy) : groupBy,
      data,
      showEmptyGroups,
      dn,
    )
    const groups =
      subGroupBy !== 'none'
        ? top.map((g) => ({
            ...g,
            subGroups: groupIssues(g.issues, subGroupBy, data, showEmptyGroups, dn),
          }))
        : top
    const rows =
      layout === 'board' && subGroupBy !== 'none'
        ? groupIssues(forGrouping, subGroupBy, data, true, dn)
        : undefined
    return { groups, childrenByParent, rows }
  }, [
    data,
    tab,
    groupBy,
    subGroupBy,
    orderBy,
    orderDir,
    orderCompletedByRecency,
    layout,
    filters,
    showSubIssues,
    nested,
    showEmptyGroups,
  ])

  return (
    <>
      <FilterBar filters={filters} onChange={onFilters} />
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
          empty={EMPTY[tab]}
          onReorder={(id, sortOrder) => {
            data.setIssueSortOrder(id, sortOrder)
            onManualReorder()
          }}
        />
      )}
    </>
  )
}

// ── Activity tab ───────────────────────────────────────────────

const VERB: Record<ActivityKind | 'comment', string> = {
  comment: 'commented',
  created: 'created the issue',
  status: 'changed status',
  priority: 'changed priority',
  assignee: 'changed assignee',
  label: 'updated labels',
  project: 'changed project',
  milestone: 'changed milestone',
  cycle: 'changed cycle',
  title: 'renamed the issue',
  estimate: 'changed estimate',
  dueDate: 'changed the due date',
  link: 'added a link',
  parent: 'changed the parent',
}

function KindIcon({ kind }: { kind: ActivityKind | 'comment' }) {
  const c = 'text-faint'
  const s = 13
  switch (kind) {
    case 'comment':
      return <MessageSquare size={s} className={c} />
    case 'status':
      return <CircleDashed size={s} className={c} />
    case 'priority':
      return <Flag size={s} className={c} />
    case 'assignee':
      return <UserRound size={s} className={c} />
    case 'label':
      return <Tag size={s} className={c} />
    case 'project':
      return <FolderClosed size={s} className={c} />
    case 'milestone':
      return <Diamond size={s} className={c} />
    case 'cycle':
      return <IterationCw size={s} className={c} />
    case 'title':
    case 'created':
      return <PenLine size={s} className={c} />
    case 'link':
      return <Link2 size={s} className={c} />
    case 'parent':
      return <GitBranch size={s} className={c} />
    default:
      return <PenLine size={s} className={c} />
  }
}

/** "Jun 17, 21:41:26" — matches Linear's per-row timestamp. */
function eventTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/** Day-bucket label like Linear ("Today" / "Yesterday" / "Jun 12"). */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const same = d.toDateString() === now.toDateString()
  if (same) return 'Today'
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

interface Event {
  id: string
  issueId: string
  kind: ActivityKind | 'comment'
  createdAt: string
}

function ActivityFeed() {
  const data = useStore()
  const setPeek = useStore((s) => s.setPeek)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // The current user's own actions across all issues (activities + comments).
  const events = useMemo<Event[]>(() => {
    const me = data.currentUserId
    const acts: Event[] = data.activities
      .filter((a: Activity) => a.userId === me)
      .map((a) => ({ id: a.id, issueId: a.issueId, kind: a.kind, createdAt: a.createdAt }))
    const comments: Event[] = data.comments
      .filter((c) => c.userId === me)
      .map((c) => ({ id: c.id, issueId: c.issueId, kind: 'comment' as const, createdAt: c.createdAt }))
    return [...acts, ...comments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [data])

  // Group consecutive events into day buckets (already newest-first).
  const days = useMemo(() => {
    const out: { label: string; events: Event[] }[] = []
    for (const e of events) {
      const label = dayLabel(e.createdAt)
      const last = out[out.length - 1]
      if (last && last.label === label) last.events.push(e)
      else out.push({ label, events: [e] })
    }
    return out
  }, [events])

  if (events.length === 0) {
    return (
      <EmptyState
        illustration={<CheckIllustration />}
        title="No activity yet"
        description="Your recent issue activity will show up here."
      />
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {days.map((day) => {
        const open = !collapsed[day.label]
        return (
          <div key={day.label}>
            <button
              type="button"
              onClick={() =>
                setCollapsed((c) => ({ ...c, [day.label]: !c[day.label] }))
              }
              className="flex w-full items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
            >
              <ChevronRight
                size={14}
                className={cn('text-faint transition-transform', open && 'rotate-90')}
              />
              <span>{day.label}</span>
              <span className="text-faint">{day.events.length}</span>
            </button>
            {open &&
              day.events.map((e) => {
                const issue = data.issues.find((i) => i.id === e.issueId)
                if (!issue || issue.archivedAt) return null
                const state = data.states.find((s) => s.id === issue.stateId)
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setPeek(issue.id)}
                    className="flex w-full items-center gap-2 px-4 py-1.5 pl-9 text-[13px] hover:bg-bg-hover"
                  >
                    <PriorityIcon priority={issue.priority} />
                    {state && (
                      <StatusIcon type={state.type} color={state.color} size={14} />
                    )}
                    <span className="shrink-0 font-mono text-[12px] text-muted">
                      {issue.identifier}
                    </span>
                    <span className="truncate text-fg">{issue.title}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-1.5 text-faint">
                      <KindIcon kind={e.kind} />
                      <span>
                        you {VERB[e.kind]} {eventTime(e.createdAt)}
                      </span>
                    </span>
                  </button>
                )
              })}
          </div>
        )
      })}
    </div>
  )
}
