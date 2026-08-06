// The GraphQL schema, shaped after Linear's public API
// (https://linear.app/developers/graphql). The type, field, argument and
// payload names below are deliberately Linear's — only the data behind them is
// ours — so a client written against Linear's docs works here unchanged.
//
// Conventions carried over from Linear:
//   • every list is a Relay-style connection: { nodes, edges { node cursor }, pageInfo }
//   • connections take first/last/after/before/orderBy/includeArchived/filter
//   • the default page size is 50
//   • mutations return a payload with { lastSyncId, success, <resource> }
//   • filters use comparator objects (eq/neq/in/nin/lt/gt/contains/…) and
//     combine with implicit AND, or explicitly via `and` / `or`
export const typeDefs = /* GraphQL */ `
  scalar DateTime
  scalar TimelessDate
  scalar JSON
  scalar JSONObject

  """
  Sort order for a connection. Linear defaults to createdAt.
  """
  enum PaginationOrderBy {
    createdAt
    updatedAt
  }

  interface Node {
    id: ID!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # ── comparators ─────────────────────────────────────────────────────────────
  input IDComparator {
    eq: ID
    neq: ID
    in: [ID!]
    nin: [ID!]
    null: Boolean
  }

  input StringComparator {
    eq: String
    neq: String
    in: [String!]
    nin: [String!]
    eqIgnoreCase: String
    neqIgnoreCase: String
    startsWith: String
    notStartsWith: String
    endsWith: String
    notEndsWith: String
    contains: String
    notContains: String
    containsIgnoreCase: String
    notContainsIgnoreCase: String
    null: Boolean
  }

  input NumberComparator {
    eq: Float
    neq: Float
    in: [Float!]
    nin: [Float!]
    lt: Float
    lte: Float
    gt: Float
    gte: Float
    null: Boolean
  }

  input DateComparator {
    eq: DateTime
    neq: DateTime
    in: [DateTime!]
    nin: [DateTime!]
    lt: DateTime
    lte: DateTime
    gt: DateTime
    gte: DateTime
    null: Boolean
  }

  input BooleanComparator {
    eq: Boolean
    neq: Boolean
  }

  # ── filters ─────────────────────────────────────────────────────────────────
  input UserFilter {
    id: IDComparator
    name: StringComparator
    email: StringComparator
    displayName: StringComparator
  }

  input TeamFilter {
    id: IDComparator
    name: StringComparator
    key: StringComparator
  }

  input WorkflowStateFilter {
    id: IDComparator
    name: StringComparator
    type: StringComparator
  }

  input ProjectFilter {
    id: IDComparator
    name: StringComparator
    state: StringComparator
  }

  input CycleFilter {
    id: IDComparator
    name: StringComparator
    number: NumberComparator
  }

  input IssueLabelFilter {
    id: IDComparator
    name: StringComparator
  }

  """
  Many-to-many relation filter. Without \`every\`, a filter matches when *some*
  related record matches; \`every\` requires all of them to match.
  """
  input IssueLabelCollectionFilter {
    id: IDComparator
    name: StringComparator
    every: IssueLabelFilter
    some: IssueLabelFilter
  }

  input IssueFilter {
    id: IDComparator
    number: NumberComparator
    title: StringComparator
    description: StringComparator
    priority: NumberComparator
    estimate: NumberComparator
    dueDate: DateComparator
    createdAt: DateComparator
    updatedAt: DateComparator
    completedAt: DateComparator
    canceledAt: DateComparator
    assignee: UserFilter
    creator: UserFilter
    team: TeamFilter
    state: WorkflowStateFilter
    project: ProjectFilter
    cycle: CycleFilter
    parent: IssueFilter
    labels: IssueLabelCollectionFilter
    and: [IssueFilter!]
    or: [IssueFilter!]
  }

  input CommentFilter {
    id: IDComparator
    body: StringComparator
    createdAt: DateComparator
    user: UserFilter
    and: [CommentFilter!]
    or: [CommentFilter!]
  }

  # ── core types ──────────────────────────────────────────────────────────────
  type Organization implements Node {
    id: ID!
    name: String!
    urlKey: String!
    createdAt: DateTime!
    teams(
      first: Int
      last: Int
      after: String
      before: String
      orderBy: PaginationOrderBy
      includeArchived: Boolean
      filter: TeamFilter
    ): TeamConnection!
    users(
      first: Int
      last: Int
      after: String
      before: String
      orderBy: PaginationOrderBy
      includeArchived: Boolean
      filter: UserFilter
    ): UserConnection!
  }

  type User implements Node {
    id: ID!
    name: String!
    displayName: String!
    email: String!
    avatarUrl: String
    active: Boolean!
    admin: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    url: String!
    "Issues assigned to the user."
    assignedIssues(
      first: Int
      last: Int
      after: String
      before: String
      orderBy: PaginationOrderBy
      includeArchived: Boolean
      filter: IssueFilter
    ): IssueConnection!
    "Issues created by the user."
    createdIssues(
      first: Int
      last: Int
      after: String
      before: String
      orderBy: PaginationOrderBy
      includeArchived: Boolean
      filter: IssueFilter
    ): IssueConnection!
    teams(first: Int, after: String, orderBy: PaginationOrderBy): TeamConnection!
  }

  type Team implements Node {
    id: ID!
    name: String!
    key: String!
    description: String
    private: Boolean!
    icon: String
    color: String
    timezone: String
    createdAt: DateTime!
    updatedAt: DateTime!
    archivedAt: DateTime
    cyclesEnabled: Boolean!
    issues(
      first: Int
      last: Int
      after: String
      before: String
      orderBy: PaginationOrderBy
      includeArchived: Boolean
      filter: IssueFilter
    ): IssueConnection!
    states(first: Int, after: String, orderBy: PaginationOrderBy): WorkflowStateConnection!
    labels(first: Int, after: String, orderBy: PaginationOrderBy): IssueLabelConnection!
    cycles(first: Int, after: String, orderBy: PaginationOrderBy): CycleConnection!
    projects(first: Int, after: String, orderBy: PaginationOrderBy): ProjectConnection!
    members(first: Int, after: String, orderBy: PaginationOrderBy): UserConnection!
    activeCycle: Cycle
  }

  type WorkflowState implements Node {
    id: ID!
    name: String!
    "One of backlog, unstarted, started, completed, canceled."
    type: String!
    color: String!
    position: Float!
    description: String
    createdAt: DateTime!
    updatedAt: DateTime!
    team: Team
    issues(
      first: Int
      after: String
      orderBy: PaginationOrderBy
      filter: IssueFilter
    ): IssueConnection!
  }

  type IssueLabel implements Node {
    id: ID!
    name: String!
    color: String!
    description: String
    isGroup: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    parent: IssueLabel
    children(first: Int, after: String): IssueLabelConnection!
    issues(first: Int, after: String, filter: IssueFilter): IssueConnection!
  }

  type Cycle implements Node {
    id: ID!
    number: Int!
    name: String
    description: String
    startsAt: DateTime!
    endsAt: DateTime!
    completedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    progress: Float!
    team: Team
    issues(first: Int, after: String, orderBy: PaginationOrderBy, filter: IssueFilter): IssueConnection!
  }

  type ProjectMilestone implements Node {
    id: ID!
    name: String!
    description: String
    targetDate: TimelessDate
    sortOrder: Float!
    createdAt: DateTime!
    updatedAt: DateTime!
    project: Project
  }

  type Project implements Node {
    id: ID!
    name: String!
    description: String!
    slugId: String!
    icon: String
    color: String!
    "One of backlog, planned, started, paused, completed, canceled."
    state: String!
    priority: Int!
    progress: Float!
    startDate: TimelessDate
    targetDate: TimelessDate
    createdAt: DateTime!
    updatedAt: DateTime!
    archivedAt: DateTime
    completedAt: DateTime
    canceledAt: DateTime
    url: String!
    lead: User
    members(first: Int, after: String): UserConnection!
    teams(first: Int, after: String): TeamConnection!
    issues(first: Int, after: String, orderBy: PaginationOrderBy, filter: IssueFilter): IssueConnection!
    projectMilestones(first: Int, after: String): ProjectMilestoneConnection!
  }

  type Comment implements Node {
    id: ID!
    body: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    editedAt: DateTime
    resolvedAt: DateTime
    url: String!
    user: User
    issue: Issue
    parent: Comment
    children(first: Int, after: String): CommentConnection!
    resolvingUser: User
  }

  """
  A relation between two issues. \`type\` is one of blocks, related, duplicate.
  """
  type IssueRelation implements Node {
    id: ID!
    type: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    issue: Issue!
    relatedIssue: Issue!
  }

  type Attachment implements Node {
    id: ID!
    title: String!
    subtitle: String
    url: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    issue: Issue
    creator: User
  }

  type Issue implements Node {
    id: ID!
    "Human-readable identifier, e.g. FLI-42."
    identifier: String!
    number: Float!
    title: String!
    description: String
    priority: Float!
    "Human-readable priority: No priority, Urgent, High, Medium, Low."
    priorityLabel: String!
    estimate: Float
    sortOrder: Float!
    boardOrder: Float!
    branchName: String!
    url: String!
    dueDate: TimelessDate
    createdAt: DateTime!
    updatedAt: DateTime!
    archivedAt: DateTime
    startedAt: DateTime
    completedAt: DateTime
    canceledAt: DateTime
    triagedAt: DateTime
    snoozedUntilAt: DateTime
    customerTicketCount: Int!
    state: WorkflowState
    team: Team
    assignee: User
    creator: User
    project: Project
    projectMilestone: ProjectMilestone
    cycle: Cycle
    parent: Issue
    snoozedBy: User
    children(first: Int, after: String, orderBy: PaginationOrderBy, filter: IssueFilter): IssueConnection!
    labels(first: Int, after: String, filter: IssueLabelFilter): IssueLabelConnection!
    comments(first: Int, after: String, orderBy: PaginationOrderBy, filter: CommentFilter): CommentConnection!
    subscribers(first: Int, after: String): UserConnection!
    relations(first: Int, after: String): IssueRelationConnection!
    inverseRelations(first: Int, after: String): IssueRelationConnection!
    attachments(first: Int, after: String): AttachmentConnection!
    history(first: Int, after: String): IssueHistoryConnection!
  }

  type IssueHistory implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    issue: Issue!
    actor: User
    fromState: WorkflowState
    toState: WorkflowState
    fromAssignee: User
    toAssignee: User
    fromPriority: Float
    toPriority: Float
    fromTitle: String
    toTitle: String
  }

  # ── connections ─────────────────────────────────────────────────────────────
  type UserEdge { node: User! cursor: String! }
  type UserConnection { nodes: [User!]! edges: [UserEdge!]! pageInfo: PageInfo! totalCount: Int }

  type TeamEdge { node: Team! cursor: String! }
  type TeamConnection { nodes: [Team!]! edges: [TeamEdge!]! pageInfo: PageInfo! totalCount: Int }

  type WorkflowStateEdge { node: WorkflowState! cursor: String! }
  type WorkflowStateConnection { nodes: [WorkflowState!]! edges: [WorkflowStateEdge!]! pageInfo: PageInfo! totalCount: Int }

  type IssueLabelEdge { node: IssueLabel! cursor: String! }
  type IssueLabelConnection { nodes: [IssueLabel!]! edges: [IssueLabelEdge!]! pageInfo: PageInfo! totalCount: Int }

  type CycleEdge { node: Cycle! cursor: String! }
  type CycleConnection { nodes: [Cycle!]! edges: [CycleEdge!]! pageInfo: PageInfo! totalCount: Int }

  type ProjectEdge { node: Project! cursor: String! }
  type ProjectConnection { nodes: [Project!]! edges: [ProjectEdge!]! pageInfo: PageInfo! totalCount: Int }

  type ProjectMilestoneEdge { node: ProjectMilestone! cursor: String! }
  type ProjectMilestoneConnection { nodes: [ProjectMilestone!]! edges: [ProjectMilestoneEdge!]! pageInfo: PageInfo! totalCount: Int }

  type IssueEdge { node: Issue! cursor: String! }
  type IssueConnection { nodes: [Issue!]! edges: [IssueEdge!]! pageInfo: PageInfo! totalCount: Int }

  type CommentEdge { node: Comment! cursor: String! }
  type CommentConnection { nodes: [Comment!]! edges: [CommentEdge!]! pageInfo: PageInfo! totalCount: Int }

  type IssueRelationEdge { node: IssueRelation! cursor: String! }
  type IssueRelationConnection { nodes: [IssueRelation!]! edges: [IssueRelationEdge!]! pageInfo: PageInfo! totalCount: Int }

  type AttachmentEdge { node: Attachment! cursor: String! }
  type AttachmentConnection { nodes: [Attachment!]! edges: [AttachmentEdge!]! pageInfo: PageInfo! totalCount: Int }

  type IssueHistoryEdge { node: IssueHistory! cursor: String! }
  type IssueHistoryConnection { nodes: [IssueHistory!]! edges: [IssueHistoryEdge!]! pageInfo: PageInfo! totalCount: Int }

  # ── mutation inputs ─────────────────────────────────────────────────────────
  input IssueCreateInput {
    id: String
    title: String!
    description: String
    teamId: String!
    stateId: String
    assigneeId: String
    parentId: String
    projectId: String
    projectMilestoneId: String
    cycleId: String
    priority: Int
    estimate: Int
    dueDate: TimelessDate
    labelIds: [String!]
    subscriberIds: [String!]
    sortOrder: Float
  }

  input IssueUpdateInput {
    title: String
    description: String
    teamId: String
    stateId: String
    assigneeId: String
    parentId: String
    projectId: String
    projectMilestoneId: String
    cycleId: String
    priority: Int
    estimate: Int
    dueDate: TimelessDate
    labelIds: [String!]
    subscriberIds: [String!]
    sortOrder: Float
  }

  input CommentCreateInput {
    id: String
    issueId: String!
    body: String!
    parentId: String
  }

  input CommentUpdateInput {
    body: String!
  }

  input ProjectCreateInput {
    id: String
    name: String!
    description: String
    teamIds: [String!]!
    leadId: String
    memberIds: [String!]
    state: String
    priority: Int
    icon: String
    color: String
    startDate: TimelessDate
    targetDate: TimelessDate
  }

  input ProjectUpdateInput {
    name: String
    description: String
    teamIds: [String!]
    leadId: String
    memberIds: [String!]
    state: String
    priority: Int
    icon: String
    color: String
    startDate: TimelessDate
    targetDate: TimelessDate
  }

  input CycleCreateInput {
    id: String
    teamId: String!
    name: String
    description: String
    startsAt: DateTime!
    endsAt: DateTime!
  }

  input CycleUpdateInput {
    name: String
    description: String
    startsAt: DateTime
    endsAt: DateTime
    completedAt: DateTime
  }

  input IssueLabelCreateInput {
    id: String
    name: String!
    color: String
    description: String
    parentId: String
  }

  input IssueLabelUpdateInput {
    name: String
    color: String
    description: String
    parentId: String
  }

  # ── mutation payloads ───────────────────────────────────────────────────────
  type IssuePayload { lastSyncId: Float! success: Boolean! issue: Issue }
  type CommentPayload { lastSyncId: Float! success: Boolean! comment: Comment }
  type ProjectPayload { lastSyncId: Float! success: Boolean! project: Project }
  type CyclePayload { lastSyncId: Float! success: Boolean! cycle: Cycle }
  type IssueLabelPayload { lastSyncId: Float! success: Boolean! issueLabel: IssueLabel }
  type IssueArchivePayload { lastSyncId: Float! success: Boolean! entity: Issue }
  type DeletePayload { lastSyncId: Float! success: Boolean! entityId: String! }

  # ── root ────────────────────────────────────────────────────────────────────
  type Query {
    "The currently authenticated user."
    viewer: User!
    organization: Organization!

    user(id: String!): User
    users(
      first: Int
      last: Int
      after: String
      before: String
      orderBy: PaginationOrderBy
      includeArchived: Boolean
      filter: UserFilter
    ): UserConnection!

    team(id: String!): Team
    teams(
      first: Int
      last: Int
      after: String
      before: String
      orderBy: PaginationOrderBy
      includeArchived: Boolean
      filter: TeamFilter
    ): TeamConnection!

    "Look an issue up by uuid or by its human identifier (FLI-42)."
    issue(id: String!): Issue
    issues(
      first: Int
      last: Int
      after: String
      before: String
      orderBy: PaginationOrderBy
      includeArchived: Boolean
      filter: IssueFilter
    ): IssueConnection!

    project(id: String!): Project
    projects(
      first: Int
      last: Int
      after: String
      before: String
      orderBy: PaginationOrderBy
      includeArchived: Boolean
      filter: ProjectFilter
    ): ProjectConnection!

    cycle(id: String!): Cycle
    cycles(
      first: Int
      last: Int
      after: String
      before: String
      orderBy: PaginationOrderBy
      includeArchived: Boolean
      filter: CycleFilter
    ): CycleConnection!

    workflowState(id: String!): WorkflowState
    workflowStates(
      first: Int
      after: String
      orderBy: PaginationOrderBy
      filter: WorkflowStateFilter
    ): WorkflowStateConnection!

    issueLabel(id: String!): IssueLabel
    issueLabels(
      first: Int
      after: String
      orderBy: PaginationOrderBy
      filter: IssueLabelFilter
    ): IssueLabelConnection!

    comment(id: String!): Comment
    comments(
      first: Int
      after: String
      orderBy: PaginationOrderBy
      filter: CommentFilter
    ): CommentConnection!

    "Full-text search across issue identifiers, titles and descriptions."
    searchIssues(term: String!, first: Int, after: String, includeArchived: Boolean): IssueConnection!
  }

  type Mutation {
    issueCreate(input: IssueCreateInput!): IssuePayload!
    issueUpdate(id: String!, input: IssueUpdateInput!): IssuePayload!
    issueDelete(id: String!): DeletePayload!
    issueArchive(id: String!): IssueArchivePayload!
    issueUnarchive(id: String!): IssueArchivePayload!

    commentCreate(input: CommentCreateInput!): CommentPayload!
    commentUpdate(id: String!, input: CommentUpdateInput!): CommentPayload!
    commentDelete(id: String!): DeletePayload!

    projectCreate(input: ProjectCreateInput!): ProjectPayload!
    projectUpdate(id: String!, input: ProjectUpdateInput!): ProjectPayload!
    projectDelete(id: String!): DeletePayload!

    cycleCreate(input: CycleCreateInput!): CyclePayload!
    cycleUpdate(id: String!, input: CycleUpdateInput!): CyclePayload!

    issueLabelCreate(input: IssueLabelCreateInput!): IssueLabelPayload!
    issueLabelUpdate(id: String!, input: IssueLabelUpdateInput!): IssueLabelPayload!
    issueLabelDelete(id: String!): DeletePayload!
  }
`
