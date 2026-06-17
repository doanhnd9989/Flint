import type {
  FilterState,
  GroupBy,
  Issue,
  OrderBy,
  Priority,
} from './types'
import type { WorkspaceData } from './seed'
import { PRIORITY_LABELS, PRIORITY_SORT, STATUS_TYPE_ORDER } from './constants'

export interface IssueGroup {
  key: string
  label: string
  color?: string
  icon?: string
  count: number
  issues: Issue[]
  /** For status groups: the workflow state id, so "add issue" can pre-fill it. */
  stateId?: string
}

export function filterIssues(
  issues: Issue[],
  filters: FilterState,
): Issue[] {
  return issues.filter((i) => {
    if (filters.statusIds.length && !filters.statusIds.includes(i.stateId))
      return false
    if (
      filters.assigneeIds.length &&
      !(i.assigneeId && filters.assigneeIds.includes(i.assigneeId))
    )
      return false
    if (filters.priorities.length && !filters.priorities.includes(i.priority))
      return false
    if (
      filters.labelIds.length &&
      !i.labelIds.some((l) => filters.labelIds.includes(l))
    )
      return false
    if (
      filters.projectIds.length &&
      !(i.projectId && filters.projectIds.includes(i.projectId))
    )
      return false
    return true
  })
}

export function sortIssues(
  issues: Issue[],
  orderBy: OrderBy,
  data: WorkspaceData,
): Issue[] {
  const copy = [...issues]
  switch (orderBy) {
    case 'priority':
      copy.sort(
        (a, b) =>
          PRIORITY_SORT[a.priority] - PRIORITY_SORT[b.priority] ||
          a.sortOrder - b.sortOrder,
      )
      break
    case 'created':
      copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      break
    case 'updated':
      copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      break
    case 'title':
      copy.sort((a, b) => a.title.localeCompare(b.title))
      break
    case 'manual':
    default:
      copy.sort((a, b) => a.sortOrder - b.sortOrder)
  }
  void data
  return copy
}

export function groupIssues(
  issues: Issue[],
  groupBy: GroupBy,
  data: WorkspaceData,
  showEmptyGroups = false,
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
      label: u.name,
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

export function projectProgress(
  projectId: string,
  issues: Issue[],
  data: WorkspaceData,
): { total: number; done: number; percent: number } {
  const scoped = issues.filter((i) => i.projectId === projectId)
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
  const scoped = issues.filter((i) => i.projectId && projectIds.has(i.projectId))
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
  const scoped = issues.filter((i) => i.milestoneId === milestoneId)
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
  const scoped = issues.filter((i) => i.cycleId === cycleId)
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
  const scoped = issues.filter((i) => i.cycleId === cycle.id)
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
  const subs = issues.filter((i) => i.parentId === parentId)
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
