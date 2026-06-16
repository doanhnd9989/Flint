import type {
  Activity,
  Comment,
  Cycle,
  Issue,
  Label,
  Milestone,
  Notification,
  Project,
  Relation,
  SavedView,
  Team,
  User,
  WorkflowState,
} from './types'
import { nowIso } from './utils'

export interface WorkspaceData {
  workspaceName: string
  users: User[]
  currentUserId: string
  teams: Team[]
  states: WorkflowState[]
  labels: Label[]
  projects: Project[]
  milestones: Milestone[]
  cycles: Cycle[]
  issues: Issue[]
  relations: Relation[]
  comments: Comment[]
  activities: Activity[]
  notifications: Notification[]
  savedViews: SavedView[]
}

export function buildSeed(): WorkspaceData {
  const users: User[] = [
    { id: 'u_me', name: 'You', email: 'you@workspace.dev', avatarColor: '#5e6ad2', isMe: true },
    { id: 'u_avery', name: 'Avery Chen', email: 'avery@workspace.dev', avatarColor: '#4cb782' },
    { id: 'u_jordan', name: 'Jordan Lee', email: 'jordan@workspace.dev', avatarColor: '#f2994a' },
    { id: 'u_sam', name: 'Sam Rivera', email: 'sam@workspace.dev', avatarColor: '#eb5da8' },
    { id: 'u_kai', name: 'Kai Nakamura', email: 'kai@workspace.dev', avatarColor: '#4ea7fc' },
  ]

  const teams: Team[] = [
    { id: 't_cla', name: 'Claude Test App', key: 'CLA', icon: '🧩', color: '#5e6ad2' },
    { id: 't_eng', name: 'Engineering', key: 'ENG', icon: '⚙️', color: '#4ea7fc' },
  ]

  const states: WorkflowState[] = [
    { id: 's_backlog', name: 'Backlog', type: 'backlog', color: '#bec2c8', position: 0 },
    { id: 's_todo', name: 'Todo', type: 'unstarted', color: '#8a8f98', position: 1 },
    { id: 's_progress', name: 'In Progress', type: 'started', color: '#f2c94c', position: 2 },
    { id: 's_review', name: 'In Review', type: 'started', color: '#4cb782', position: 3 },
    { id: 's_done', name: 'Done', type: 'completed', color: '#5e6ad2', position: 4 },
    { id: 's_canceled', name: 'Canceled', type: 'canceled', color: '#95a2b3', position: 5 },
  ]

  const labels: Label[] = [
    { id: 'l_bug', name: 'Bug', color: '#eb5757' },
    { id: 'l_feature', name: 'Feature', color: '#5e6ad2' },
    { id: 'l_improvement', name: 'Improvement', color: '#4cb782' },
    { id: 'l_design', name: 'Design', color: '#eb5da8' },
    { id: 'l_docs', name: 'Documentation', color: '#4ea7fc' },
    { id: 'l_urgent', name: 'Needs triage', color: '#f2994a' },
  ]

  const projects: Project[] = [
    {
      id: 'p_mvp',
      name: 'MVP Launch',
      description: 'Ship the first public version of the product.',
      icon: '🚀',
      color: '#5e6ad2',
      status: 'started',
      leadId: 'u_me',
      memberIds: ['u_me', 'u_avery', 'u_jordan'],
      teamIds: ['t_cla'],
      startDate: nowIso(),
      targetDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      createdAt: nowIso(),
      sortOrder: 1,
    },
    {
      id: 'p_mobile',
      name: 'Mobile App',
      description: 'Native iOS and Android clients.',
      icon: '📱',
      color: '#4cb782',
      status: 'planned',
      leadId: 'u_kai',
      memberIds: ['u_kai', 'u_sam'],
      teamIds: ['t_cla'],
      targetDate: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      createdAt: nowIso(),
      sortOrder: 2,
    },
  ]

  const milestones: Milestone[] = [
    { id: 'm_alpha', projectId: 'p_mvp', name: 'Alpha', sortOrder: 1 },
    { id: 'm_beta', projectId: 'p_mvp', name: 'Beta', sortOrder: 2 },
  ]

  const cycles: Cycle[] = [
    {
      id: 'cy_1',
      teamId: 't_cla',
      number: 1,
      startsAt: nowIso(),
      endsAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    },
    {
      id: 'cy_2',
      teamId: 't_cla',
      number: 2,
      startsAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      endsAt: new Date(Date.now() + 28 * 86_400_000).toISOString(),
    },
  ]

  type Seed = Omit<
    Issue,
    'id' | 'number' | 'identifier' | 'createdAt' | 'updatedAt' | 'subscriberIds' | 'sortOrder' | 'creatorId'
  >

  const drafts: Seed[] = [
    {
      title: 'Get familiar with the workspace',
      description:
        '## Welcome 👋\n\nA few things to try:\n\n- [x] Open the **command menu** with `⌘K`\n- [ ] Create an issue with `C`\n- [ ] Switch to the *board* view\n\n> Tip: right-click any issue for quick actions.\n\nSee the [docs](https://linear.app) for more.',
      teamId: 't_cla', stateId: 's_todo', priority: 2, assigneeId: 'u_me',
      labelIds: ['l_docs'], projectId: 'p_mvp', milestoneId: 'm_alpha',
    },
    {
      title: 'Set up your teams',
      description: 'Organize people into teams. Each team gets its own issues, cycles and workflow.',
      teamId: 't_cla', stateId: 's_todo', priority: 3, assigneeId: 'u_avery',
      labelIds: ['l_feature'], projectId: 'p_mvp',
    },
    {
      title: 'Connect your tools',
      description: 'Integrate GitHub, Slack and Figma to keep everything in sync.',
      teamId: 't_cla', stateId: 's_backlog', priority: 4, assigneeId: 'u_jordan',
      labelIds: ['l_improvement'],
    },
    {
      title: 'Import your data',
      description: 'Bring issues over from your previous tracker.',
      teamId: 't_cla', stateId: 's_backlog', priority: 0,
      labelIds: ['l_feature'],
    },
    {
      title: 'Keyboard navigation feels sluggish on long lists',
      description: 'Arrow-key movement drops frames once a list passes ~500 rows. Virtualize the list.',
      teamId: 't_cla', stateId: 's_progress', priority: 1, assigneeId: 'u_me',
      labelIds: ['l_bug'], projectId: 'p_mvp', cycleId: 'cy_1', estimate: 3,
    },
    {
      title: 'Design the command palette',
      description: 'A ⌘K menu that can run any action and jump to any view.',
      teamId: 't_cla', stateId: 's_review', priority: 2, assigneeId: 'u_sam',
      labelIds: ['l_design', 'l_feature'], projectId: 'p_mvp', cycleId: 'cy_1', estimate: 5,
    },
    {
      title: 'Board view for issues',
      description: 'Kanban columns grouped by status, with drag and drop.',
      teamId: 't_cla', stateId: 's_progress', priority: 2, assigneeId: 'u_avery',
      labelIds: ['l_feature'], projectId: 'p_mvp', cycleId: 'cy_1', estimate: 8,
    },
    {
      title: 'Dark mode polish',
      description: 'Tune contrast on the sidebar and selected rows in dark theme.',
      teamId: 't_cla', stateId: 's_done', priority: 4, assigneeId: 'u_kai',
      labelIds: ['l_design', 'l_improvement'], projectId: 'p_mvp',
    },
    {
      title: 'Filter issues by label and assignee',
      description: 'Composable filter bar with quick presets.',
      teamId: 't_cla', stateId: 's_todo', priority: 3, assigneeId: 'u_jordan',
      labelIds: ['l_feature'], projectId: 'p_mvp', cycleId: 'cy_1', estimate: 5,
    },
    {
      title: 'Sub-issues and parent relationships',
      description: 'Break large issues into a checklist of sub-issues with rolled-up progress.',
      teamId: 't_cla', stateId: 's_backlog', priority: 2,
      labelIds: ['l_feature'], projectId: 'p_mvp', estimate: 8,
    },
    {
      title: 'Notifications inbox',
      description: 'Surface assignments, mentions and status changes in a unified inbox.',
      teamId: 't_cla', stateId: 's_todo', priority: 3, assigneeId: 'u_sam',
      labelIds: ['l_feature'], cycleId: 'cy_1',
    },
    {
      title: 'Cancelled: legacy CSV exporter',
      description: 'Superseded by the new integrations pipeline.',
      teamId: 't_cla', stateId: 's_canceled', priority: 0,
      labelIds: [],
    },
  ]

  const baseTime = Date.now() - drafts.length * 3_600_000
  const issues: Issue[] = drafts.map((d, i) => {
    const created = new Date(baseTime + i * 3_600_000).toISOString()
    const state = states.find((s) => s.id === d.stateId)!
    return {
      ...d,
      id: `i_${i + 1}`,
      number: i + 1,
      identifier: `CLA-${i + 1}`,
      creatorId: 'u_me',
      subscriberIds: d.assigneeId ? ['u_me', d.assigneeId] : ['u_me'],
      sortOrder: (i + 1) * 100,
      createdAt: created,
      updatedAt: created,
      completedAt: state.type === 'completed' ? created : undefined,
      canceledAt: state.type === 'canceled' ? created : undefined,
    }
  })

  const relations: Relation[] = [
    // CLA-5 (keyboard perf) blocks CLA-7 (board view)
    { id: 'r_1', type: 'blocks', fromIssueId: 'i_5', toIssueId: 'i_7' },
    // CLA-6 (command palette) related to CLA-9 (filters)
    { id: 'r_2', type: 'related', fromIssueId: 'i_6', toIssueId: 'i_9' },
  ]

  const comments: Comment[] = [
    {
      id: 'c_1', issueId: 'i_5', userId: 'u_avery',
      body: 'I can reproduce this with 800 rows. Virtualization should fix it.',
      createdAt: nowIso(),
    },
    {
      id: 'c_2', issueId: 'i_5', userId: 'u_me',
      body: 'Agreed — going to use a windowed list.',
      createdAt: nowIso(),
    },
  ]

  const activities: Activity[] = issues.map((iss) => ({
    id: `a_${iss.id}`,
    issueId: iss.id,
    userId: 'u_me',
    kind: 'created' as const,
    createdAt: iss.createdAt,
  }))

  const notifications: Notification[] = [
    {
      id: 'n_1', issueId: 'i_5', type: 'comment', actorId: 'u_avery',
      body: 'commented on', createdAt: nowIso(), read: false,
    },
  ]

  const savedViews: SavedView[] = [
    {
      id: 'v_active', name: 'Active', icon: 'circle-dot', layout: 'list',
      groupBy: 'status', orderBy: 'priority',
      filters: { statusIds: [], assigneeIds: [], priorities: [], labelIds: [], projectIds: [] },
    },
  ]

  return {
    workspaceName: 'Claude Test App',
    users,
    currentUserId: 'u_me',
    teams,
    states,
    labels,
    projects,
    milestones,
    cycles,
    issues,
    relations,
    comments,
    activities,
    notifications,
    savedViews,
  }
}
