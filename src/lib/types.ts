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

export type UserRole = 'admin' | 'member' | 'guest'

export interface User {
  id: string
  name: string
  email: string
  avatarColor: string
  role: UserRole
  isMe?: boolean
  pending?: boolean
}

export interface Label {
  id: string
  name: string
  color: string
  isGroup?: boolean // a label group: a container for child labels
  groupId?: string // when set, this label belongs to the group with this id
}

export interface Team {
  id: string
  name: string
  key: string // e.g. "CLA" -> CLA-123
  icon: string
  color: string
  private?: boolean
  memberIds: string[]
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
  initiativeId?: string // the strategic initiative this project rolls up into
  startDate?: string
  targetDate?: string
  createdAt: string
  sortOrder: number
}

/**
 * Initiatives — larger, strategic product efforts comprised of all the projects
 * that align with their goals. Linear's three lifecycle buckets: Planned →
 * Active → Completed.
 */
export type InitiativeStatus = 'backlog' | 'planned' | 'active' | 'completed'

export interface Initiative {
  id: string
  name: string
  description?: string
  icon: string // emoji
  color: string
  status: InitiativeStatus
  ownerId?: string
  targetDate?: string
  createdAt: string
  sortOrder: number
}

export type ProjectHealth = 'on-track' | 'at-risk' | 'off-track'

export interface ProjectUpdate {
  id: string
  projectId: string
  userId: string
  health: ProjectHealth
  body: string
  createdAt: string
}

export interface InitiativeUpdate {
  id: string
  initiativeId: string
  userId: string
  health: ProjectHealth
  body: string
  createdAt: string
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
  | 'milestone'
  | 'title'
  | 'estimate'
  | 'dueDate'

export interface Activity {
  id: string
  issueId: string
  userId: string
  kind: ActivityKind
  /** Previous value (id/number/string depending on kind); empty when unset. */
  from?: string
  /** New value (id/number/string depending on kind); empty when unset. */
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
  /** Awaiting triage (incoming, not yet accepted into the workflow). */
  triage?: boolean
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

export type NotificationType =
  | 'assigned'
  | 'mention'
  | 'comment'
  | 'status'
  | 'subscribed'

export interface Notification {
  id: string
  issueId: string
  type: NotificationType
  actorId: string
  body: string
  createdAt: string
  read: boolean
  /** ISO time until which the notification is snoozed (hidden from the inbox). */
  snoozedUntil?: string
}

export type NotificationPrefs = Record<NotificationType, boolean>

export type FavoriteType = 'issue' | 'project' | 'view'

export interface Favorite {
  type: FavoriteType
  id: string
}

export type ThemeMode = 'light' | 'dark' | 'system'
