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
      .filter((g) => g.count > 0)
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
    return groups.map((g) => ({ ...g, count: g.issues.length })).filter((g) => g.count > 0)
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
      .filter((g) => g.count > 0)
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
    return groups.map((g) => ({ ...g, count: g.issues.length })).filter((g) => g.count > 0)
  }

  // label
  const groups: IssueGroup[] = data.labels.map((l) => ({
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
  return groups.map((g) => ({ ...g, count: g.issues.length })).filter((g) => g.count > 0)
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
