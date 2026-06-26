import type {
  CustomerTier,
  DisplayProperty,
  EstimationType,
  InitiativeStatus,
  NotificationChannel,
  NotificationEvent,
  NotificationSettings,
  Priority,
  ProjectStatus,
  ReleaseStatus,
  StatusType,
} from './types'

/** Customer tier metadata — drives the tier chip label + accent. */
export const CUSTOMER_TIERS: Record<CustomerTier, { label: string; color: string }> = {
  free: { label: 'Free', color: 'var(--status-backlog)' },
  startup: { label: 'Startup', color: 'var(--status-unstarted)' },
  business: { label: 'Business', color: 'var(--status-started)' },
  enterprise: { label: 'Enterprise', color: 'var(--accent)' },
}
export const CUSTOMER_TIER_ORDER: CustomerTier[] = ['enterprise', 'business', 'startup', 'free']

/** Release lifecycle metadata. */
export const RELEASE_STATUS: Record<ReleaseStatus, { label: string; color: string }> = {
  planned: { label: 'Planned', color: 'var(--status-backlog)' },
  'in-progress': { label: 'In Progress', color: 'var(--status-started)' },
  released: { label: 'Released', color: 'var(--status-completed)' },
  canceled: { label: 'Canceled', color: 'var(--status-canceled)' },
}
export const RELEASE_STATUS_ORDER: ReleaseStatus[] = ['in-progress', 'planned', 'released', 'canceled']

/** Project lifecycle metadata — Linear's Backlog / Planned / In Progress / Paused / Completed / Canceled. */
export const PROJECT_STATUS: Record<
  ProjectStatus,
  { label: string; color: string }
> = {
  backlog: { label: 'Backlog', color: 'var(--status-backlog)' },
  planned: { label: 'Planned', color: 'var(--status-unstarted)' },
  started: { label: 'In Progress', color: 'var(--status-started)' },
  paused: { label: 'Paused', color: 'var(--status-backlog)' },
  completed: { label: 'Completed', color: 'var(--status-completed)' },
  canceled: { label: 'Canceled', color: 'var(--status-canceled)' },
}

/** Order Linear lists project status groups in. */
export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  'backlog',
  'planned',
  'started',
  'paused',
  'completed',
  'canceled',
]

/** Initiative lifecycle metadata — Linear's Backlog / Planned / Active / Completed. */
export const INITIATIVE_STATUS: Record<
  InitiativeStatus,
  { label: string; color: string }
> = {
  backlog: { label: 'Backlog', color: 'var(--status-backlog)' },
  planned: { label: 'Planned', color: 'var(--status-unstarted)' },
  active: { label: 'Active', color: 'var(--status-started)' },
  completed: { label: 'Completed', color: 'var(--status-completed)' },
}

export const INITIATIVE_STATUS_ORDER: InitiativeStatus[] = [
  'backlog',
  'planned',
  'active',
  'completed',
]

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
}

/** Visual order used in pickers and sorting (urgent first, none last). */
export const PRIORITY_ORDER: Priority[] = [1, 2, 3, 4, 0]

/** Sort weight — lower sorts first. Urgent highest, none lowest. */
export const PRIORITY_SORT: Record<Priority, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  0: 4,
}

export const STATUS_TYPE_ORDER: Record<StatusType, number> = {
  backlog: 0,
  unstarted: 1,
  started: 2,
  completed: 3,
  canceled: 4,
}

export const LABEL_COLORS = [
  '#95a2b3',
  '#eb5757',
  '#f2994a',
  '#f2c94c',
  '#4cb782',
  '#5e9aa8',
  '#4ea7fc',
  '#5e6ad2',
  '#9b51e0',
  '#eb5da8',
  '#a17c5b',
] as const

export const ESTIMATE_SCALE = [0, 1, 2, 3, 5, 8] as const

// ── Team estimation (Linear's team "Estimates" setting) ──────────────────────
/** The non-zero point values each estimation type offers, in order. */
const ESTIMATION_VALUES: Record<Exclude<EstimationType, 'notUsed'>, number[]> = {
  linear: [1, 2, 3, 4, 5],
  exponential: [1, 2, 4, 8, 16],
  fibonacci: [1, 2, 3, 5, 8],
  tshirt: [1, 2, 3, 4, 5],
}

/** T-shirt sizes map each value 1..5 to a size label. */
const TSHIRT_LABELS: Record<number, string> = {
  1: 'XS',
  2: 'S',
  3: 'M',
  4: 'L',
  5: 'XL',
}

/** Dropdown labels + example scale shown on the team Estimates setting. */
export const ESTIMATION_TYPES: { id: EstimationType; label: string; example: string }[] = [
  { id: 'notUsed', label: 'Not used', example: '' },
  { id: 'linear', label: 'Linear', example: '0, 1, 2, 3, 4, 5' },
  { id: 'exponential', label: 'Exponential', example: '0, 1, 2, 4, 8, 16' },
  { id: 'fibonacci', label: 'Fibonacci', example: '0, 1, 2, 3, 5, 8' },
  { id: 'tshirt', label: 'T-shirt sizes', example: 'XS, S, M, L, XL' },
]

/** A team's effective estimation type — defaults to fibonacci when unset. */
export function teamEstimationType(team?: { estimationType?: EstimationType }): EstimationType {
  return team?.estimationType ?? 'fibonacci'
}

/** The selectable point values for a team (optionally prefixed with 0). */
export function estimatePoints(team?: {
  estimationType?: EstimationType
  estimationAllowZero?: boolean
}): number[] {
  const type = teamEstimationType(team)
  if (type === 'notUsed') return []
  const values = ESTIMATION_VALUES[type]
  return team?.estimationAllowZero ? [0, ...values] : values
}

/** Renders an estimate value using the team's scale (t-shirt → size labels). */
export function estimateLabel(
  value: number | undefined,
  team?: { estimationType?: EstimationType },
): string {
  if (!value) return 'No estimate'
  const type = teamEstimationType(team)
  if (type === 'tshirt') return TSHIRT_LABELS[value] ?? `${value}`
  return `${value} point${value > 1 ? 's' : ''}`
}

/**
 * Issue-row display properties, in Linear's exact order/labels. Toggled from the
 * Display options popover; defaults mirror Linear (Milestone / Links / Time in
 * status / Updated start hidden).
 */
export const DISPLAY_PROPERTIES: { id: DisplayProperty; label: string }[] = [
  { id: 'id', label: 'ID' },
  { id: 'status', label: 'Status' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'priority', label: 'Priority' },
  { id: 'project', label: 'Project' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'dueDate', label: 'Due date' },
  { id: 'milestone', label: 'Milestone' },
  { id: 'labels', label: 'Labels' },
  { id: 'links', label: 'Links' },
  { id: 'timeInStatus', label: 'Time in status' },
  { id: 'created', label: 'Created' },
  { id: 'updated', label: 'Updated' },
]

export const DEFAULT_DISPLAY_PROPERTIES: Record<DisplayProperty, boolean> = {
  id: true,
  status: true,
  assignee: true,
  priority: true,
  project: true,
  cycle: false,
  dueDate: true,
  milestone: false,
  labels: true,
  links: false,
  timeInStatus: false,
  created: true,
  updated: false,
}

// ── Settings → Notifications ────────────────────────────────────────────────
// The per-event toggle rows on a channel's detail page, split into Linear's two
// groups (General / Feature), each row's exact label + helper text.
export const NOTIFICATION_CHANNELS: {
  id: NotificationChannel
  label: string
}[] = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'email', label: 'Email' },
  { id: 'slack', label: 'Slack' },
]

export const NOTIFICATION_EVENT_GROUPS: {
  header: string
  events: { id: NotificationEvent; label: string; hint: string }[]
}[] = [
  {
    header: 'General notifications',
    events: [
      { id: 'assignments', label: 'Assignments', hint: 'Assignments, unassignments, and membership changes' },
      { id: 'statusChanges', label: 'Status changes', hint: 'Changes to the status, priority, and blocking relationships of issues' },
      { id: 'comments', label: 'Comments and replies', hint: 'Comments, replies, and thread resolutions' },
      { id: 'mentions', label: 'Mentions', hint: 'Mentions in comments or content' },
      { id: 'reactions', label: 'Reactions', hint: 'Emoji reactions to your content' },
      { id: 'subscriptions', label: 'Subscriptions', hint: "Issues, projects, initiatives, teams, and views you're subscribed to" },
      { id: 'documentChanges', label: 'Document changes', hint: 'Changes to document content, location, and subscriptions' },
      { id: 'updates', label: 'Updates', hint: 'New project & initiative updates and reminders to post an update' },
      { id: 'remindersDeadlines', label: 'Reminders and deadlines', hint: 'Reminders, due dates, and SLA updates' },
      { id: 'appsIntegrations', label: 'Apps and integrations', hint: 'Requests related to OAuth apps and integrations' },
      { id: 'billing', label: 'Billing', hint: 'Usage credit balance alerts' },
    ],
  },
  {
    header: 'Feature notifications',
    events: [
      { id: 'triage', label: 'Triage', hint: 'Issues added to triage' },
    ],
  },
]

const ALL_EVENTS_ON: Record<NotificationEvent, boolean> = {
  assignments: true,
  statusChanges: true,
  comments: true,
  mentions: true,
  reactions: true,
  subscriptions: true,
  documentChanges: true,
  updates: true,
  remindersDeadlines: true,
  appsIntegrations: true,
  billing: true,
  triage: true,
}

// Defaults match the real workspace: Desktop/Slack off, Mobile/Email on.
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  channels: {
    desktop: { enabled: false, events: { ...ALL_EVENTS_ON } },
    mobile: { enabled: true, events: { ...ALL_EVENTS_ON } },
    email: { enabled: true, events: { ...ALL_EVENTS_ON } },
    slack: { enabled: false, events: { ...ALL_EVENTS_ON } },
  },
  emailDigest: true,
  emailDelayLowPriority: true,
  emailUrgentImmediate: true,
  showUpdatesInSidebar: true,
  changelogNewsletter: false,
  marketingOnboarding: true,
  inviteAccepted: true,
  privacyLegal: true,
  dpa: true,
}

export const STORAGE_KEY = 'linear-clone-store-v1'
