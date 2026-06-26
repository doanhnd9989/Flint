import type {
  DateField,
  DateFilter,
  FilterState,
  GroupBy,
  Issue,
  OrderBy,
  OrderDir,
  Priority,
} from './types'
import type { WorkspaceData } from './seed'
import { PRIORITY_LABELS, PRIORITY_SORT, STATUS_TYPE_ORDER } from './constants'
import { displayName } from './utils'

export interface IssueGroup {
  key: string
  label: string
  color?: string
  icon?: string
  count: number
  issues: Issue[]
  /** For status groups: the workflow state id, so "add issue" can pre-fill it. */
  stateId?: string
  /** When sub-grouping is active, the nested groups of this group's issues. */
  subGroups?: IssueGroup[]
}

/** The issue timestamp a date filter compares against (undefined when unset). */
function issueDate(i: Issue, field: DateField): string | undefined {
  switch (field) {
    case 'due':
      return i.dueDate
    case 'created':
      return i.createdAt
    case 'updated':
      return i.updatedAt
    case 'completed':
      return i.completedAt
  }
}

/** An absolute custom date is stored as a plain `YYYY-MM-DD` string. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Resolve a date-filter value to an absolute cutoff Date. The value is either a
 * relative period token (e.g. "1w") or a `YYYY-MM-DD` custom day, in which case
 * the cutoff is that day at local midnight.
 */
export function resolveDateCutoff(value: string): Date {
  if (ISO_DATE.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const d = new Date()
  switch (value) {
    case '1d':
      d.setDate(d.getDate() - 1)
      break
    case '3d':
      d.setDate(d.getDate() - 3)
      break
    case '1w':
      d.setDate(d.getDate() - 7)
      break
    case '1m':
      d.setMonth(d.getMonth() - 1)
      break
    case '3m':
      d.setMonth(d.getMonth() - 3)
      break
    case '6m':
      d.setMonth(d.getMonth() - 6)
      break
    case '1y':
      d.setFullYear(d.getFullYear() - 1)
      break
  }
  return d
}

const MONTH_PERIOD = /^(\d{4})-(\d{2})$/
const QUARTER_PERIOD = /^(\d{4})-Q([1-4])$/
const HALF_PERIOD = /^(\d{4})-H([12])$/
const YEAR_PERIOD = /^(\d{4})$/

/**
 * The absolute `[start, end)` range an absolute date-filter value spans (a day,
 * month, quarter, half-year or year). Returns null for relative tokens (1w …).
 */
export function periodRange(value: string): { start: Date; end: Date } | null {
  if (ISO_DATE.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) }
  }
  let m = value.match(MONTH_PERIOD)
  if (m) {
    const y = Number(m[1]), mo = Number(m[2])
    return { start: new Date(y, mo - 1, 1), end: new Date(y, mo, 1) }
  }
  m = value.match(QUARTER_PERIOD)
  if (m) {
    const y = Number(m[1]), q = Number(m[2])
    return { start: new Date(y, (q - 1) * 3, 1), end: new Date(y, q * 3, 1) }
  }
  m = value.match(HALF_PERIOD)
  if (m) {
    const y = Number(m[1]), h = Number(m[2])
    return { start: new Date(y, (h - 1) * 6, 1), end: new Date(y, h * 6, 1) }
  }
  m = value.match(YEAR_PERIOD)
  if (m) {
    const y = Number(m[1])
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) }
  }
  return null
}

/** Does an issue satisfy a single date filter? */
function matchesDate(i: Issue, f: DateFilter): boolean {
  const raw = issueDate(i, f.field)
  if (!raw) return false
  const when = new Date(raw).getTime()
  // Absolute calendar period (day/month/quarter/half/year) → range comparison.
  const range = periodRange(f.value)
  if (range) {
    const start = range.start.getTime()
    const end = range.end.getTime()
    if (f.op === 'in') return when >= start && when < end
    return f.op === 'before' ? when < start : when >= end
  }
  // Relative period token (1w …): cutoff comparison ('in' is not offered).
  const cutoff = resolveDateCutoff(f.value).getTime()
  return f.op === 'before' ? when <= cutoff : when >= cutoff
}

export function filterIssues(
  issues: Issue[],
  filters: FilterState,
): Issue[] {
  const neg = filters.negate ?? {}
  const dateFilters = filters.dates ?? []
  return issues.filter((i) => {
    // Archived issues never appear in active lists — they live in /archive only.
    if (i.archivedAt) return false
    // Each entry: [is this dimension active?, does the issue match it?, dimension key].
    // A negated dimension excludes matching issues; otherwise it keeps only matches.
    const dims: [boolean, boolean, keyof typeof neg][] = [
      [
        filters.statusIds.length > 0,
        filters.statusIds.includes(i.stateId),
        'statusIds',
      ],
      [
        filters.assigneeIds.length > 0,
        !!(i.assigneeId && filters.assigneeIds.includes(i.assigneeId)),
        'assigneeIds',
      ],
      [
        filters.priorities.length > 0,
        filters.priorities.includes(i.priority),
        'priorities',
      ],
      [
        filters.labelIds.length > 0,
        i.labelIds.some((l) => filters.labelIds.includes(l)),
        'labelIds',
      ],
      [
        filters.projectIds.length > 0,
        !!(i.projectId && filters.projectIds.includes(i.projectId)),
        'projectIds',
      ],
      [
        !!filters.creatorIds?.length,
        !!filters.creatorIds?.includes(i.creatorId),
        'creatorIds',
      ],
      [
        !!filters.subscriberIds?.length,
        i.subscriberIds.some((s) => filters.subscriberIds!.includes(s)),
        'subscriberIds',
      ],
      [
        !!filters.cycleIds?.length,
        !!(i.cycleId && filters.cycleIds!.includes(i.cycleId)),
        'cycleIds',
      ],
      [
        !!filters.milestoneIds?.length,
        !!(i.milestoneId && filters.milestoneIds!.includes(i.milestoneId)),
        'milestoneIds',
      ],
    ]
    for (const [active, matches, key] of dims) {
      if (!active) continue
      const ok = neg[key] ? !matches : matches
      if (!ok) return false
    }
    // Date filters are ANDed (Linear's "Created after X" + "Created before Y").
    for (const df of dateFilters) {
      if (!matchesDate(i, df)) return false
    }
    return true
  })
}

/** Primary comparator for the chosen ordering. */
function orderComparator(
  orderBy: OrderBy,
  data: WorkspaceData,
): (a: Issue, b: Issue) => number {
  const manual = (a: Issue, b: Issue) => a.sortOrder - b.sortOrder
  switch (orderBy) {
    case 'priority':
      return (a, b) =>
        PRIORITY_SORT[a.priority] - PRIORITY_SORT[b.priority] || manual(a, b)
    case 'created':
      return (a, b) => b.createdAt.localeCompare(a.createdAt)
    case 'updated':
      return (a, b) => b.updatedAt.localeCompare(a.updatedAt)
    case 'title':
      return (a, b) => a.title.localeCompare(b.title) || manual(a, b)
    case 'status': {
      // Workflow order (Backlog → Done) then position within the type.
      const rank = new Map(
        data.states.map((s) => [
          s.id,
          STATUS_TYPE_ORDER[s.type] * 1000 + s.position,
        ]),
      )
      return (a, b) =>
        (rank.get(a.stateId) ?? 0) - (rank.get(b.stateId) ?? 0) || manual(a, b)
    }
    case 'assignee': {
      // Alphabetical by assignee name; unassigned sinks to the bottom.
      const name = new Map(data.users.map((u) => [u.id, u.name]))
      const key = (i: Issue) =>
        i.assigneeId ? (name.get(i.assigneeId) ?? '￿') : '￿'
      return (a, b) => key(a).localeCompare(key(b)) || manual(a, b)
    }
    case 'estimate':
      // Highest estimate first; issues without an estimate sink to the bottom.
      return (a, b) =>
        (b.estimate ?? -1) - (a.estimate ?? -1) || manual(a, b)
    case 'dueDate': {
      // Soonest due date first; issues without a due date sink to the bottom.
      const key = (i: Issue) => i.dueDate ?? '￿'
      return (a, b) => key(a).localeCompare(key(b)) || manual(a, b)
    }
    case 'linkCount': {
      // Most links first.
      const count = new Map<string, number>()
      for (const l of data.issueLinks)
        count.set(l.issueId, (count.get(l.issueId) ?? 0) + 1)
      return (a, b) =>
        (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0) || manual(a, b)
    }
    case 'manual':
    default:
      return manual
  }
}

export function sortIssues(
  issues: Issue[],
  orderBy: OrderBy,
  data: WorkspaceData,
  /**
   * Linear's "Order completed by recency" display toggle: completed/canceled
   * issues are sorted by when they were closed (most recent first), overriding
   * the chosen ordering for those issues. Within a status-grouped view this
   * means the Done and Canceled groups read newest-first.
   */
  orderCompletedByRecency = false,
  /**
   * Linear's ordering direction toggle (the arrow left of the Ordering
   * dropdown). 'desc' reverses the chosen ordering. The completed-by-recency
   * override stays newest-first regardless.
   */
  orderDir: OrderDir = 'asc',
): Issue[] {
  const copy = [...issues]
  const base = orderComparator(orderBy, data)
  const primary: (a: Issue, b: Issue) => number =
    orderDir === 'desc' ? (a, b) => -base(a, b) : base
  if (orderCompletedByRecency) {
    const closedTypes = new Set(
      data.states
        .filter((s) => s.type === 'completed' || s.type === 'canceled')
        .map((s) => s.id),
    )
    const closedAt = (i: Issue) => i.completedAt ?? i.canceledAt ?? i.updatedAt
    copy.sort((a, b) => {
      const ac = closedTypes.has(a.stateId)
      const bc = closedTypes.has(b.stateId)
      if (ac && bc) return closedAt(b).localeCompare(closedAt(a))
      return primary(a, b)
    })
  } else {
    copy.sort(primary)
  }
  return copy
}

export function groupIssues(
  issues: Issue[],
  groupBy: GroupBy,
  data: WorkspaceData,
  showEmptyGroups = false,
  displayNamesMode: 'full' | 'first' = 'full',
): IssueGroup[] {
  if (groupBy === 'none') {
    return [
      {
        key: 'all',
        label: 'All issues',
        count: issues.length,
        issues,
      },
    ]
  }

  if (groupBy === 'status') {
    return [...data.states]
      .sort(
        (a, b) =>
          STATUS_TYPE_ORDER[a.type] - STATUS_TYPE_ORDER[b.type] ||
          a.position - b.position,
      )
      .map((st) => {
        const groupIssues = issues.filter((i) => i.stateId === st.id)
        return {
          key: st.id,
          label: st.name,
          color: st.color,
          icon: st.type,
          count: groupIssues.length,
          issues: groupIssues,
          stateId: st.id,
        }
      })
      .filter((g) => showEmptyGroups || g.count > 0)
  }

  if (groupBy === 'assignee') {
    const groups: IssueGroup[] = data.users.map((u) => ({
      key: u.id,
      label: displayName(u.name, displayNamesMode),
      color: u.avatarColor,
      count: 0,
      issues: issues.filter((i) => i.assigneeId === u.id),
    }))
    groups.push({
      key: 'none',
      label: 'No assignee',
      count: 0,
      issues: issues.filter((i) => !i.assigneeId),
    })
    return groups.map((g) => ({ ...g, count: g.issues.length })).filter((g) => showEmptyGroups || g.count > 0)
  }

  if (groupBy === 'priority') {
    const order: Priority[] = [1, 2, 3, 4, 0]
    return order
      .map((p) => {
        const gi = issues.filter((i) => i.priority === p)
        return {
          key: String(p),
          label: PRIORITY_LABELS[p],
          count: gi.length,
          issues: gi,
        }
      })
      .filter((g) => showEmptyGroups || g.count > 0)
  }

  if (groupBy === 'project') {
    const groups: IssueGroup[] = data.projects.map((p) => ({
      key: p.id,
      label: p.name,
      icon: p.icon,
      color: p.color,
      count: 0,
      issues: issues.filter((i) => i.projectId === p.id),
    }))
    groups.push({
      key: 'none',
      label: 'No project',
      count: 0,
      issues: issues.filter((i) => !i.projectId),
    })
    return groups.map((g) => ({ ...g, count: g.issues.length })).filter((g) => showEmptyGroups || g.count > 0)
  }

  if (groupBy === 'cycle') {
    const groups: IssueGroup[] = [...data.cycles]
      .sort((a, b) => b.number - a.number)
      .map((c) => ({
        key: c.id,
        label: c.name ?? `Cycle ${c.number}`,
        count: 0,
        issues: issues.filter((i) => i.cycleId === c.id),
      }))
    groups.push({
      key: 'none',
      label: 'No cycle',
      count: 0,
      issues: issues.filter((i) => !i.cycleId),
    })
    return groups.map((g) => ({ ...g, count: g.issues.length })).filter((g) => showEmptyGroups || g.count > 0)
  }

  if (groupBy === 'milestone') {
    const groups: IssueGroup[] = [...data.milestones]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        key: m.id,
        label: m.name,
        count: 0,
        issues: issues.filter((i) => i.milestoneId === m.id),
      }))
    groups.push({
      key: 'none',
      label: 'No milestone',
      count: 0,
      issues: issues.filter((i) => !i.milestoneId),
    })
    return groups.map((g) => ({ ...g, count: g.issues.length })).filter((g) => showEmptyGroups || g.count > 0)
  }

  // label
  const groups: IssueGroup[] = data.labels.filter((l) => !l.isGroup).map((l) => ({
    key: l.id,
    label: l.name,
    color: l.color,
    count: 0,
    issues: issues.filter((i) => i.labelIds.includes(l.id)),
  }))
  groups.push({
    key: 'none',
    label: 'No label',
    count: 0,
    issues: issues.filter((i) => i.labelIds.length === 0),
  })
  return groups.map((g) => ({ ...g, count: g.issues.length })).filter((g) => showEmptyGroups || g.count > 0)
}

/**
 * The board renders one column per "settable" property (status/assignee/
 * priority/project). Label, cycle and milestone groupings have no draggable
 * column semantics, so the board falls back to status columns for them.
 */
export function boardColumnGroupBy(groupBy: GroupBy): GroupBy {
  return groupBy === 'label' || groupBy === 'cycle' || groupBy === 'milestone'
    ? 'status'
    : groupBy
}

export function projectProgress(
  projectId: string,
  issues: Issue[],
  data: WorkspaceData,
): { total: number; done: number; percent: number } {
  const scoped = issues.filter((i) => i.projectId === projectId && !i.archivedAt)
  const completedStateIds = new Set(
    data.states.filter((s) => s.type === 'completed').map((s) => s.id),
  )
  const done = scoped.filter((i) => completedStateIds.has(i.stateId)).length
  return {
    total: scoped.length,
    done,
    percent: scoped.length ? Math.round((done / scoped.length) * 100) : 0,
  }
}

/**
 * Roll up an initiative's progress across all of its projects: the union of
 * those projects' issues, with done = issues in a completed workflow state.
 */
export function initiativeProgress(
  initiativeId: string,
  projects: { id: string; initiativeId?: string }[],
  issues: Issue[],
  data: WorkspaceData,
): { total: number; done: number; percent: number; projectCount: number } {
  const projectIds = new Set(
    projects.filter((p) => p.initiativeId === initiativeId).map((p) => p.id),
  )
  const scoped = issues.filter(
    (i) => i.projectId && projectIds.has(i.projectId) && !i.archivedAt,
  )
  const completed = new Set(
    data.states.filter((s) => s.type === 'completed').map((s) => s.id),
  )
  const done = scoped.filter((i) => completed.has(i.stateId)).length
  return {
    total: scoped.length,
    done,
    percent: scoped.length ? Math.round((done / scoped.length) * 100) : 0,
    projectCount: projectIds.size,
  }
}

/** done/total of issues assigned to a milestone. */
export function milestoneProgress(
  milestoneId: string,
  issues: Issue[],
  data: WorkspaceData,
): { total: number; done: number; percent: number } {
  const scoped = issues.filter((i) => i.milestoneId === milestoneId && !i.archivedAt)
  const completed = new Set(
    data.states.filter((s) => s.type === 'completed').map((s) => s.id),
  )
  const done = scoped.filter((i) => completed.has(i.stateId)).length
  return {
    total: scoped.length,
    done,
    percent: scoped.length ? Math.round((done / scoped.length) * 100) : 0,
  }
}

/** done/total of issues assigned to a cycle, plus started/scope counts. */
export function cycleProgress(
  cycleId: string,
  issues: Issue[],
  data: WorkspaceData,
): { total: number; done: number; started: number; percent: number } {
  const scoped = issues.filter((i) => i.cycleId === cycleId && !i.archivedAt)
  const completed = new Set(
    data.states.filter((s) => s.type === 'completed').map((s) => s.id),
  )
  const inProgress = new Set(
    data.states.filter((s) => s.type === 'started').map((s) => s.id),
  )
  const done = scoped.filter((i) => completed.has(i.stateId)).length
  const started = scoped.filter((i) => inProgress.has(i.stateId)).length
  return {
    total: scoped.length,
    done,
    started,
    percent: scoped.length ? Math.round((done / scoped.length) * 100) : 0,
  }
}

export interface BurndownPoint {
  /** Day boundary (ISO) this point represents. */
  dayMs: number
  /** Ideal remaining scope (straight line from scope → 0). */
  ideal: number
  /** Actual open scope at end of this day; null for days still in the future. */
  remaining: number | null
  /** Total scope (issues assigned to the cycle). */
  scope: number
}

/**
 * Per-day burndown series for a cycle: ideal guideline vs. actual remaining
 * open work, derived from each issue's `completedAt`. Future days have a null
 * `remaining` so the actual line stops at "today".
 */
export function cycleBurndown(
  cycle: { startsAt: string; endsAt: string; id: string },
  issues: Issue[],
  nowMs: number,
): { points: BurndownPoint[]; scope: number; days: number } {
  const dayMs = 86_400_000
  const startOfDay = (ms: number) => {
    const d = new Date(ms)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const scoped = issues.filter((i) => i.cycleId === cycle.id && !i.archivedAt)
  const scope = scoped.length
  const completions = scoped
    .map((i) => (i.completedAt ? new Date(i.completedAt).getTime() : null))
    .filter((t): t is number => t != null)
  const startDay = startOfDay(new Date(cycle.startsAt).getTime())
  const endDay = startOfDay(new Date(cycle.endsAt).getTime())
  const days = Math.max(1, Math.round((endDay - startDay) / dayMs))
  const points: BurndownPoint[] = []
  for (let d = 0; d <= days; d++) {
    const dayStart = startDay + d * dayMs
    const dayEnd = dayStart + dayMs
    const ideal = scope - (scope * d) / days
    let remaining: number | null = null
    if (dayStart <= nowMs) {
      const done = completions.filter((t) => t < dayEnd).length
      remaining = scope - done
    }
    points.push({ dayMs: dayStart, ideal, remaining, scope })
  }
  return { points, scope, days }
}

/** Lifecycle of a cycle relative to now, with days remaining. */
export function cycleState(
  startsAt: string,
  endsAt: string,
  nowMs: number,
): { status: 'upcoming' | 'active' | 'past'; daysLeft: number } {
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  const status =
    nowMs < start ? 'upcoming' : nowMs > end ? 'past' : 'active'
  const daysLeft = Math.max(0, Math.ceil((end - nowMs) / 86_400_000))
  return { status, daysLeft }
}

/** done/total of an issue's direct sub-issues. */
export function subIssueProgress(
  parentId: string,
  issues: Issue[],
  data: WorkspaceData,
): { total: number; done: number; percent: number } {
  const subs = issues.filter((i) => i.parentId === parentId && !i.archivedAt)
  const completedStateIds = new Set(
    data.states.filter((s) => s.type === 'completed').map((s) => s.id),
  )
  const done = subs.filter((i) => completedStateIds.has(i.stateId)).length
  return {
    total: subs.length,
    done,
    percent: subs.length ? Math.round((done / subs.length) * 100) : 0,
  }
}
