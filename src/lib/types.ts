// Core domain model — mirrors Linear's entities.

export type StatusType =
  | 'backlog'
  | 'unstarted'
  | 'started'
  | 'completed'
  | 'canceled'

export interface WorkflowState {
  id: string
  name: string
  type: StatusType
  color: string
  position: number
}

/** Linear priority scale. 0 = none, 1 = urgent … 4 = low. */
export type Priority = 0 | 1 | 2 | 3 | 4

export interface User {
  id: string
  name: string
  email: string
  avatarColor: string
  isMe?: boolean
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Team {
  id: string
  name: string
  key: string // e.g. "CLA" -> CLA-123
  icon: string
  color: string
  private?: boolean
}

export type ProjectStatus =
  | 'backlog'
  | 'planned'
  | 'started'
  | 'paused'
  | 'completed'
  | 'canceled'

export interface Project {
  id: string
  name: string
  description?: string
  icon: string
  color: string
  status: ProjectStatus
  leadId?: string
  memberIds: string[]
  teamIds: string[]
  startDate?: string
  targetDate?: string
  createdAt: string
  sortOrder: number
}

export interface Milestone {
  id: string
  projectId: string
  name: string
  targetDate?: string
  sortOrder: number
}

export interface Cycle {
  id: string
  teamId: string
  number: number
  name?: string
  startsAt: string
  endsAt: string
}

export interface Comment {
  id: string
  issueId: string
  userId: string
  body: string
  createdAt: string
  parentId?: string
  /** emoji → userIds who reacted with it */
  reactions?: Record<string, string[]>
}

export type ActivityKind =
  | 'created'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'label'
  | 'project'
  | 'title'
  | 'estimate'
  | 'dueDate'

export interface Activity {
  id: string
  issueId: string
  userId: string
  kind: ActivityKind
  from?: string
  to?: string
  createdAt: string
}

export interface Issue {
  id: string
  number: number
  identifier: string // e.g. "CLA-12"
  title: string
  description: string
  teamId: string
  stateId: string
  priority: Priority
  assigneeId?: string
  creatorId: string
  labelIds: string[]
  projectId?: string
  milestoneId?: string
  cycleId?: string
  parentId?: string
  estimate?: number
  dueDate?: string
  subscriberIds: string[]
  sortOrder: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  canceledAt?: string
}

/**
 * Directed relation between two issues, stored canonically once.
 * - 'blocks':    fromIssue blocks toIssue (toIssue is blocked by fromIssue)
 * - 'related':   symmetric association
 * - 'duplicate': fromIssue is a duplicate of toIssue
 */
export type RelationType = 'blocks' | 'related' | 'duplicate'

export interface Relation {
  id: string
  type: RelationType
  fromIssueId: string
  toIssueId: string
}

export interface IssueTemplate {
  id: string
  name: string
  teamId?: string
  title: string
  description: string
  priority: Priority
  labelIds: string[]
  stateId?: string
  assigneeId?: string
}

export type ViewLayout = 'list' | 'board'
export type GroupBy =
  | 'status'
  | 'assignee'
  | 'priority'
  | 'project'
  | 'label'
  | 'none'
export type OrderBy = 'priority' | 'created' | 'updated' | 'manual' | 'title'

export interface FilterState {
  statusIds: string[]
  assigneeIds: string[]
  priorities: Priority[]
  labelIds: string[]
  projectIds: string[]
}

export interface SavedView {
  id: string
  name: string
  icon: string
  layout: ViewLayout
  groupBy: GroupBy
  orderBy: OrderBy
  filters: FilterState
}

export interface Notification {
  id: string
  issueId: string
  type: 'assigned' | 'mention' | 'comment' | 'status' | 'subscribed'
  actorId: string
  body: string
  createdAt: string
  read: boolean
}

export type ThemeMode = 'light' | 'dark' | 'system'
