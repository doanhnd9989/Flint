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
  description?: string
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
  /** Set when the comment has been edited (Linear shows an "(edited)" hint). */
  editedAt?: string
  parentId?: string
  /** Set on a thread root when the thread is resolved — Linear collapses it. */
  resolvedAt?: string
  resolvedBy?: string
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
  | 'cycle'
  | 'title'
  | 'estimate'
  | 'dueDate'
  | 'link'
  | 'parent'

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

/**
 * Which relationship the "Mark as" picker (the ⋯ menu's flyout and the
 * `M`-chord / ⌘⇧P keyboard shortcuts) links the current issue to an existing
 * one with. Distinct from {@link RelationType} because parent/sub-issue is a
 * parent link, not a stored relation, and the directions differ per kind.
 */
export type RelationPickerKind =
  | 'parentOf'
  | 'subIssueOf'
  | 'related'
  | 'blockedBy'
  | 'blocking'
  | 'duplicateOf'

export interface Relation {
  id: string
  type: RelationType
  fromIssueId: string
  toIssueId: string
}

/**
 * An external resource attached to an issue — Linear's "Resources" section
 * (added via the issue's "Add link…" / ⌃L). Just a URL with an optional title.
 */
export interface IssueLink {
  id: string
  issueId: string
  url: string
  title?: string
  creatorId: string
  createdAt: string
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

/**
 * Seed values for the create-issue modal — Linear's group-header `+` opens the
 * modal pre-filled with that group's (and sub-group's) property.
 */
export interface CreatePrefill {
  teamId?: string
  stateId?: string
  priority?: Priority
  assigneeId?: string
  labelIds?: string[]
  projectId?: string
}

/** Properties that can be shown/hidden on issue rows (Linear's Display options). */
export type DisplayProperty =
  | 'id'
  | 'status'
  | 'assignee'
  | 'priority'
  | 'project'
  | 'dueDate'
  | 'milestone'
  | 'labels'
  | 'links'
  | 'timeInStatus'
  | 'created'
  | 'updated'

export interface FilterState {
  statusIds: string[]
  assigneeIds: string[]
  priorities: Priority[]
  labelIds: string[]
  projectIds: string[]
  // Optional so saved views persisted before these dimensions existed still load.
  creatorIds?: string[]
  subscriberIds?: string[]
  cycleIds?: string[]
  milestoneIds?: string[]
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
