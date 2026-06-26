import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { nanoid } from 'nanoid'
import { buildSeed } from './seed'
import type { WorkspaceData } from './seed'
import { nowIso, displayName } from './utils'
import {
  STORAGE_KEY,
  STATUS_TYPE_ORDER,
  DEFAULT_DISPLAY_PROPERTIES,
  DEFAULT_NOTIFICATION_SETTINGS,
} from './constants'
import { parsePriority, type ImportRow } from './importExport'
import type {
  Activity,
  ActivityKind,
  Attachment,
  Comment,
  CreatePrefill,
  Customer,
  Document,
  Release,
  Favorite,
  FavoriteType,
  Initiative,
  Issue,
  IssueLink,
  IssueTemplate,
  Label,
  Milestone,
  Notification,
  NotificationPrefs,
  NotificationType,
  NotificationSettings,
  NotificationChannel,
  NotificationEvent,
  Priority,
  Project,
  ProjectHealth,
  ProjectUpdate,
  InitiativeUpdate,
  DisplayProperty,
  Relation,
  RelationType,
  RelationPickerKind,
  SavedView,
  Preferences,
  Team,
  ThemeMode,
  User,
  UserRole,
  WorkflowState,
} from './types'

interface UIState {
  theme: ThemeMode
  /** Settings → Preferences (persisted). */
  preferences: Preferences
  sidebarCollapsed: boolean
  commandOpen: boolean
  /**
   * When the command menu is opened as a row property hotkey (s/p/a/l on the
   * focused issue), this seeds it with the issue + sub-page to drill straight
   * into. Both transient; cleared when the menu closes.
   */
  commandIssueId: string | null
  commandPage: string | null
  /**
   * Existing-issue relation picker — Linear's "Mark as" centered palette,
   * opened from the issue ⋯ menu and the `M`-chord / ⌘⇧P keyboard shortcuts.
   * Links `issueId` to a chosen existing issue per `kind`. Transient.
   */
  relationPicker: { issueId: string; kind: RelationPickerKind } | null
  createOpen: boolean
  /** Seed values for the create-issue modal (group-header `+`). Transient. */
  createPrefill: CreatePrefill | null
  /** "Create more" toggle in the create-issue modal — keeps it open after creating (persisted, like Linear). */
  createMore: boolean
  /** New-initiative modal (transient). */
  createInitiativeOpen: boolean
  /** Keyboard-shortcuts help overlay (transient). */
  helpOpen: boolean
  /** Issue currently shown in the right-side peek panel (transient). */
  peekIssueId: string | null
  /** Issues selected for bulk actions (transient). */
  selectedIssueIds: string[]
  /**
   * Ordered issue identifiers of the list the user is currently browsing,
   * used to power the issue detail's prev/next "n / total ↓ ↑" navigation.
   * Set by whichever list/board is on screen; transient.
   */
  navIssueIds: string[]
  /**
   * Keyboard-focused issue *identifier* in the list the user is browsing
   * (Linear's `j`/`k` row focus). Transient; lives over `navIssueIds`.
   */
  focusedIssueId: string | null
  /** Right-click context menu target + position (transient). */
  contextMenu: { issueId: string; x: number; y: number } | null
  /** Issue currently shown in the Share modal (transient). */
  shareIssueId: string | null
  /** Issue currently shown in the Move-to-team modal (transient). */
  moveIssueId: string | null
  /** Issues shared publicly (a read-only public link). Persisted. */
  publicIssueIds: string[]
  /**
   * Add/edit-link modal target (transient). `editId` is set when editing an
   * existing link, null when adding a new one.
   */
  linkModal: { issueId: string; editId: string | null } | null
  /** Recent search queries (persisted, newest first). */
  recentSearches: string[]
  /** Starred issues / projects / views (persisted). */
  favorites: Favorite[]
  /** Per-type notification preferences (persisted). */
  notificationPrefs: NotificationPrefs
  /** Settings → Notifications: channels + per-event matrix + product updates (persisted). */
  notificationSettings: NotificationSettings
  /** Dismissed "Try" onboarding step keys (persisted). */
  onboardingDismissed: string[]
  /** Which properties show on issue rows — Linear's Display options (persisted). */
  displayProperties: Record<DisplayProperty, boolean>
  /**
   * Generic on/off settings for the workspace/feature settings pages — keyed by
   * a namespaced string (e.g. `integrations.github`, `security.twoFactor`).
   * Persisted; pages read a key with a default and flip it via
   * {@link Store.setFeatureSetting}.
   */
  featureSettings: Record<string, boolean>
}

interface NewIssueInput {
  title: string
  description?: string
  teamId: string
  stateId?: string
  priority?: Priority
  assigneeId?: string
  labelIds?: string[]
  projectId?: string
  cycleId?: string
  parentId?: string
  estimate?: number
  dueDate?: string
}

export interface Store extends WorkspaceData, UIState {
  // ── issue mutations ──────────────────────────────────────────
  createIssue: (input: NewIssueInput) => Issue
  duplicateIssue: (id: string) => Issue | undefined
  updateIssue: (id: string, patch: Partial<Issue>) => void
  deleteIssue: (id: string) => void
  setIssueStatus: (id: string, stateId: string) => void
  setIssuePriority: (id: string, priority: Priority) => void
  setIssueAssignee: (id: string, assigneeId?: string) => void
  toggleIssueLabel: (id: string, labelId: string) => void
  toggleIssueSubscriber: (id: string, userId: string) => void
  setIssueProject: (id: string, projectId?: string) => void
  setIssueMilestone: (id: string, milestoneId?: string) => void
  setIssueCycle: (id: string, cycleId?: string) => void
  setIssueParent: (id: string, parentId?: string) => void
  setIssueEstimate: (id: string, estimate?: number) => void
  setIssueDueDate: (id: string, dueDate?: string) => void
  setIssueTitle: (id: string, title: string) => void
  setIssueDescription: (id: string, description: string) => void
  moveIssue: (id: string, stateId: string, sortOrder: number) => void
  setIssueSortOrder: (id: string, sortOrder: number) => void
  acceptTriage: (id: string, stateId?: string) => void
  declineTriage: (id: string) => void

  // ── relations ────────────────────────────────────────────────
  addRelation: (fromIssueId: string, toIssueId: string, type: RelationType) => void
  removeRelation: (id: string) => void

  // ── links (Resources) ────────────────────────────────────────
  addIssueLink: (issueId: string, url: string, title?: string) => void
  updateIssueLink: (id: string, patch: Partial<Pick<IssueLink, 'url' | 'title'>>) => void
  removeIssueLink: (id: string) => void

  // ── comments ─────────────────────────────────────────────────
  addComment: (issueId: string, body: string, parentId?: string) => void
  editComment: (id: string, body: string) => void
  deleteComment: (id: string) => void
  /** Resolve / unresolve a comment thread (toggles state on the thread root). */
  toggleResolveThread: (rootId: string) => void
  toggleReaction: (commentId: string, emoji: string) => void

  // ── labels / projects ────────────────────────────────────────
  createLabel: (name: string, color: string, groupId?: string) => Label
  createLabelGroup: (name: string) => Label
  updateLabel: (id: string, patch: Partial<Pick<Label, 'name' | 'color' | 'groupId'>>) => void
  deleteLabel: (id: string) => void
  createInitiative: (i: Omit<Initiative, 'id' | 'createdAt' | 'sortOrder'>) => Initiative
  updateInitiative: (id: string, patch: Partial<Initiative>) => void
  deleteInitiative: (id: string) => void
  setProjectInitiative: (projectId: string, initiativeId?: string) => void
  createProject: (p: Omit<Project, 'id' | 'createdAt' | 'sortOrder'>) => Project
  updateProject: (id: string, patch: Partial<Project>) => void
  createMilestone: (projectId: string, name: string) => Milestone
  updateMilestone: (id: string, patch: Partial<Milestone>) => void
  deleteMilestone: (id: string) => void
  createProjectUpdate: (projectId: string, health: ProjectHealth, body: string) => void
  deleteProjectUpdate: (id: string) => void
  createInitiativeUpdate: (initiativeId: string, health: ProjectHealth, body: string) => void
  deleteInitiativeUpdate: (id: string) => void
  createView: (v: Omit<SavedView, 'id'>) => SavedView
  updateView: (id: string, patch: Partial<SavedView>) => void
  deleteView: (id: string) => void
  createTemplate: (t: Omit<IssueTemplate, 'id'>) => IssueTemplate
  deleteTemplate: (id: string) => void
  toggleTeamMember: (teamId: string, userId: string) => void
  /** Update a team's estimation settings (team Estimates settings page). */
  setTeamEstimation: (teamId: string, patch: Partial<Pick<Team, 'estimationType' | 'estimationAllowZero'>>) => void
  /** Enable / disable cycles for a team (team Cycles settings page). */
  setTeamCyclesEnabled: (teamId: string, enabled: boolean) => void

  // ── customers (Linear's CRM-lite) ────────────────────────────
  createCustomer: (input: Omit<Customer, 'id' | 'createdAt'>) => Customer
  updateCustomer: (id: string, patch: Partial<Omit<Customer, 'id' | 'createdAt'>>) => void
  deleteCustomer: (id: string) => void
  /** Link / unlink an issue to a customer (a "customer request"). */
  toggleIssueCustomer: (issueId: string, customerId: string) => void

  // ── releases (Linear's Releases) ─────────────────────────────
  createRelease: (input: Omit<Release, 'id' | 'createdAt' | 'sortOrder'>) => Release
  updateRelease: (id: string, patch: Partial<Omit<Release, 'id' | 'createdAt'>>) => void
  deleteRelease: (id: string) => void

  // ── attachments ──────────────────────────────────────────────
  addAttachment: (issueId: string, input: Omit<Attachment, 'id' | 'issueId' | 'creatorId' | 'createdAt'>) => void
  removeAttachment: (id: string) => void

  // ── issue reactions ──────────────────────────────────────────
  toggleIssueReaction: (issueId: string, emoji: string) => void

  // ── documents (Linear's Documents feature) ───────────────────
  createDocument: (input?: Partial<Pick<Document, 'title' | 'icon' | 'content' | 'projectId'>>) => Document
  updateDocument: (id: string, patch: Partial<Pick<Document, 'title' | 'icon' | 'content' | 'projectId'>>) => void
  deleteDocument: (id: string) => void

  setUserRole: (id: string, role: UserRole) => void
  inviteMember: (email: string, role: UserRole) => void
  removeUser: (id: string) => void
  /** Edit a user's profile (name / email). Used by the Profile settings page. */
  updateUser: (id: string, patch: Partial<Pick<User, 'name' | 'email'>>) => void
  /** Rename the workspace (Administration → Workspace settings). */
  setWorkspaceName: (name: string) => void
  createState: (s: Omit<WorkflowState, 'id'>) => WorkflowState
  updateState: (id: string, patch: Partial<Pick<WorkflowState, 'name' | 'color' | 'type'>>) => void
  deleteState: (id: string) => void
  moveState: (id: string, dir: 'up' | 'down') => void

  // ── notifications ────────────────────────────────────────────
  markNotificationRead: (id: string) => void
  setNotificationRead: (id: string, read: boolean) => void
  markAllNotificationsRead: () => void
  snoozeNotification: (id: string, untilIso: string) => void
  unsnoozeNotification: (id: string) => void
  deleteNotification: (id: string) => void
  deleteAllNotifications: () => void
  deleteAllReadNotifications: () => void
  setNotificationPref: (type: NotificationType, on: boolean) => void
  /** Toggle a notification delivery channel's master enable. */
  setNotificationChannelEnabled: (channel: NotificationChannel, enabled: boolean) => void
  /** Toggle one per-event row inside a channel. */
  setNotificationEvent: (channel: NotificationChannel, event: NotificationEvent, on: boolean) => void
  /** Patch the top-level notification settings (email digest + "Updates from Linear"). */
  updateNotificationSettings: (
    patch: Partial<Omit<NotificationSettings, 'channels'>>,
  ) => void

  // ── ui ───────────────────────────────────────────────────────
  setTheme: (t: ThemeMode) => void
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  toggleSidebar: () => void
  setCommandOpen: (open: boolean) => void
  /**
   * Open the command menu as a row property hotkey: seeds the issue context +
   * the sub-page to drill into (status / priority / assignee / label / …).
   */
  openIssuePropertyMenu: (issueId: string, page: string) => void
  /** Open the "Mark as" existing-issue relation picker for `issueId`. */
  openRelationPicker: (issueId: string, kind: RelationPickerKind) => void
  /** Close the relation picker. */
  closeRelationPicker: () => void
  setCreateOpen: (open: boolean) => void
  /** Open the create-issue modal pre-filled with a group's property. */
  openCreateWith: (prefill: CreatePrefill | null) => void
  setCreateMore: (on: boolean) => void
  setCreateInitiativeOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setPeek: (id: string | null) => void
  setNavIssueIds: (ids: string[]) => void
  /** Set (or clear) the keyboard-focused issue by identifier. */
  setFocusedIssue: (identifier: string | null) => void
  /** Move keyboard focus by `dir` (+1 next / −1 prev) through `navIssueIds`. */
  moveFocus: (dir: 1 | -1) => void
  addRecentSearch: (q: string) => void
  clearRecentSearches: () => void
  toggleFavorite: (type: FavoriteType, id: string) => void
  dismissOnboardingStep: (key: string) => void
  toggleDisplayProperty: (prop: DisplayProperty) => void
  setFeatureSetting: (key: string, on: boolean) => void

  // ── bulk selection ───────────────────────────────────────────
  toggleSelectIssue: (id: string) => void
  setSelectedIssues: (ids: string[]) => void
  clearSelection: () => void
  bulkSetStatus: (ids: string[], stateId: string) => void
  bulkSetPriority: (ids: string[], priority: Priority) => void
  bulkSetAssignee: (ids: string[], assigneeId?: string) => void
  bulkAddLabel: (ids: string[], labelId: string) => void
  bulkDelete: (ids: string[]) => void

  // ── context menu ─────────────────────────────────────────────
  openContextMenu: (issueId: string, x: number, y: number) => void
  closeContextMenu: () => void

  // ── link modal ───────────────────────────────────────────────
  openLinkModal: (issueId: string, editId?: string) => void
  closeLinkModal: () => void

  // ── share / move modals ──────────────────────────────────────
  openShareIssue: (issueId: string) => void
  closeShareIssue: () => void
  /** Toggle whether an issue has a public read-only share link. */
  toggleIssuePublic: (issueId: string) => void
  openMoveIssue: (issueId: string) => void
  closeMoveIssue: () => void
  /** Move an issue to a different team (re-numbers its identifier). */
  moveIssueToTeam: (issueId: string, teamId: string) => void

  resetWorkspace: () => void

  // ── import ───────────────────────────────────────────────────
  /** Create a copy of name-based rows as new issues. Returns the count added. */
  importIssues: (rows: ImportRow[]) => number
}

function logActivity(
  state: Store,
  issueId: string,
  kind: ActivityKind,
  from?: string,
  to?: string,
): Activity {
  return {
    id: `a_${nanoid(8)}`,
    issueId,
    userId: state.currentUserId,
    kind,
    from,
    to,
    createdAt: nowIso(),
  }
}

const seed = buildSeed()

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...seed,

      // UI defaults
      theme: 'system',
      preferences: {
        homeView: 'active',
        displayNames: 'full',
        firstDayOfWeek: 'monday',
        convertEmoticons: true,
        sendCommentOn: 'enter',
        fontSize: 'default',
        pointerCursors: false,
        lightTheme: 'light',
        darkTheme: 'dark',
        openInDesktop: false,
        autoAssignSelf: false,
        assignSelfOnStart: false,
      },
      sidebarCollapsed: false,
      commandOpen: false,
      commandIssueId: null,
      commandPage: null,
      relationPicker: null,
      createOpen: false,
      createPrefill: null,
      createMore: false,
      createInitiativeOpen: false,
      helpOpen: false,
      peekIssueId: null,
      selectedIssueIds: [],
      navIssueIds: [],
      focusedIssueId: null,
      contextMenu: null,
      linkModal: null,
      shareIssueId: null,
      moveIssueId: null,
      publicIssueIds: [],
      recentSearches: [],
      favorites: [],
      notificationPrefs: {
        assigned: true,
        mention: true,
        comment: true,
        status: true,
        subscribed: true,
      },
      onboardingDismissed: [],
      featureSettings: {},
      displayProperties: { ...DEFAULT_DISPLAY_PROPERTIES },
      notificationSettings: structuredClone(DEFAULT_NOTIFICATION_SETTINGS),

      createIssue: (input) => {
        const s = get()
        const teamIssues = s.issues.filter((i) => i.teamId === input.teamId)
        const number =
          teamIssues.reduce((max, i) => Math.max(max, i.number), 0) + 1
        const team = s.teams.find((t) => t.id === input.teamId)!
        const maxSort = s.issues.reduce(
          (m, i) => Math.max(m, i.sortOrder),
          0,
        )
        const ts = nowIso()
        const issue: Issue = {
          id: `i_${nanoid(8)}`,
          number,
          identifier: `${team.key}-${number}`,
          title: input.title.trim() || 'Untitled',
          description: input.description ?? '',
          teamId: input.teamId,
          stateId: input.stateId ?? s.states.find((x) => x.type === 'unstarted')!.id,
          priority: input.priority ?? 0,
          assigneeId: input.assigneeId,
          creatorId: s.currentUserId,
          labelIds: input.labelIds ?? [],
          projectId: input.projectId,
          cycleId: input.cycleId,
          parentId: input.parentId,
          estimate: input.estimate,
          dueDate: input.dueDate,
          subscriberIds: [s.currentUserId],
          sortOrder: maxSort + 100,
          createdAt: ts,
          updatedAt: ts,
        }
        set({
          issues: [...s.issues, issue],
          activities: [...s.activities, logActivity(s, issue.id, 'created')],
        })
        return issue
      },

      duplicateIssue: (id) => {
        const s = get()
        const src = s.issues.find((i) => i.id === id)
        if (!src) return undefined
        const teamIssues = s.issues.filter((i) => i.teamId === src.teamId)
        const number =
          teamIssues.reduce((max, i) => Math.max(max, i.number), 0) + 1
        const team = s.teams.find((t) => t.id === src.teamId)!
        const maxSort = s.issues.reduce((m, i) => Math.max(m, i.sortOrder), 0)
        const ts = nowIso()
        // Copy the core properties; the duplicate starts its own thread
        // (no comments / relations / sub-issues), matching Linear's default.
        const dupe: Issue = {
          ...src,
          id: `i_${nanoid(8)}`,
          number,
          identifier: `${team.key}-${number}`,
          parentId: undefined,
          subscriberIds: [s.currentUserId],
          creatorId: s.currentUserId,
          sortOrder: maxSort + 100,
          createdAt: ts,
          updatedAt: ts,
          completedAt: undefined,
          canceledAt: undefined,
          triage: false,
        }
        set({
          issues: [...s.issues, dupe],
          activities: [...s.activities, logActivity(s, dupe.id, 'created')],
        })
        return dupe
      },

      updateIssue: (id, patch) =>
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === id ? { ...i, ...patch, updatedAt: nowIso() } : i,
          ),
        })),

      deleteIssue: (id) =>
        set((s) => ({
          issues: s.issues.filter((i) => i.id !== id && i.parentId !== id),
          comments: s.comments.filter((c) => c.issueId !== id),
          activities: s.activities.filter((a) => a.issueId !== id),
          issueLinks: s.issueLinks.filter((l) => l.issueId !== id),
          relations: s.relations.filter(
            (r) => r.fromIssueId !== id && r.toIssueId !== id,
          ),
        })),

      setIssueStatus: (id, stateId) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue) return s
          const newState = s.states.find((x) => x.id === stateId)
          const ts = nowIso()
          // Preference: when moving an unassigned issue to a started state,
          // assign it to the current user (Linear's "assign to yourself").
          const autoAssign =
            s.preferences.assignSelfOnStart &&
            newState?.type === 'started' &&
            !issue.assigneeId
          const extraActivities = autoAssign
            ? [logActivity(s, id, 'assignee', undefined, s.currentUserId)]
            : []
          return {
            issues: s.issues.map((i) =>
              i.id === id
                ? {
                    ...i,
                    stateId,
                    assigneeId: autoAssign ? s.currentUserId : i.assigneeId,
                    updatedAt: ts,
                    completedAt:
                      newState?.type === 'completed' ? ts : undefined,
                    canceledAt:
                      newState?.type === 'canceled' ? ts : undefined,
                  }
                : i,
            ),
            activities: [
              ...s.activities,
              logActivity(s, id, 'status', issue.stateId, stateId),
              ...extraActivities,
            ],
          }
        }),

      setIssuePriority: (id, priority) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue || issue.priority === priority) return s
          return {
            issues: s.issues.map((i) =>
              i.id === id ? { ...i, priority, updatedAt: nowIso() } : i,
            ),
            activities: [
              ...s.activities,
              logActivity(s, id, 'priority', String(issue.priority), String(priority)),
            ],
          }
        }),

      setIssueAssignee: (id, assigneeId) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue || issue.assigneeId === assigneeId) return s
          return {
            issues: s.issues.map((i) =>
              i.id === id ? { ...i, assigneeId, updatedAt: nowIso() } : i,
            ),
            activities: [
              ...s.activities,
              logActivity(s, id, 'assignee', issue.assigneeId, assigneeId),
            ],
          }
        }),

      toggleIssueLabel: (id, labelId) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue) return s
          const removing = issue.labelIds.includes(labelId)
          return {
            issues: s.issues.map((i) =>
              i.id === id
                ? {
                    ...i,
                    labelIds: removing
                      ? i.labelIds.filter((l) => l !== labelId)
                      : [...i.labelIds, labelId],
                    updatedAt: nowIso(),
                  }
                : i,
            ),
            activities: [
              ...s.activities,
              // Added → `to` holds the label; removed → `from` holds it.
              logActivity(
                s,
                id,
                'label',
                removing ? labelId : undefined,
                removing ? undefined : labelId,
              ),
            ],
          }
        }),

      toggleIssueSubscriber: (id, userId) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue) return s
          const subscribed = issue.subscriberIds.includes(userId)
          return {
            issues: s.issues.map((i) =>
              i.id === id
                ? {
                    ...i,
                    subscriberIds: subscribed
                      ? i.subscriberIds.filter((u) => u !== userId)
                      : [...i.subscriberIds, userId],
                    updatedAt: nowIso(),
                  }
                : i,
            ),
          }
        }),

      setIssueProject: (id, projectId) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue || issue.projectId === projectId) return s
          return {
            issues: s.issues.map((i) =>
              i.id === id
                ? { ...i, projectId, milestoneId: undefined, updatedAt: nowIso() }
                : i,
            ),
            activities: [
              ...s.activities,
              logActivity(s, id, 'project', issue.projectId, projectId),
            ],
          }
        }),

      setIssueMilestone: (id, milestoneId) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue || issue.milestoneId === milestoneId) return s
          return {
            issues: s.issues.map((i) =>
              i.id === id ? { ...i, milestoneId, updatedAt: nowIso() } : i,
            ),
            activities: [
              ...s.activities,
              logActivity(s, id, 'milestone', issue.milestoneId, milestoneId),
            ],
          }
        }),

      setIssueCycle: (id, cycleId) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue || issue.cycleId === cycleId) return s
          return {
            issues: s.issues.map((i) =>
              i.id === id ? { ...i, cycleId, updatedAt: nowIso() } : i,
            ),
            activities: [
              ...s.activities,
              logActivity(s, id, 'cycle', issue.cycleId, cycleId),
            ],
          }
        }),

      setIssueParent: (id, parentId) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue || issue.parentId === parentId || id === parentId) return s
          // Guard against cycles: the new parent must not be a descendant of
          // this issue (walking up from the parent must never reach `id`).
          let cursor = parentId
          while (cursor) {
            if (cursor === id) return s
            cursor = s.issues.find((i) => i.id === cursor)?.parentId
          }
          return {
            issues: s.issues.map((i) =>
              i.id === id ? { ...i, parentId, updatedAt: nowIso() } : i,
            ),
            activities: [
              ...s.activities,
              logActivity(s, id, 'parent', issue.parentId, parentId),
            ],
          }
        }),

      setIssueEstimate: (id, estimate) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue || issue.estimate === estimate) return s
          return {
            issues: s.issues.map((i) =>
              i.id === id ? { ...i, estimate, updatedAt: nowIso() } : i,
            ),
            activities: [
              ...s.activities,
              logActivity(
                s,
                id,
                'estimate',
                issue.estimate == null ? undefined : String(issue.estimate),
                estimate == null ? undefined : String(estimate),
              ),
            ],
          }
        }),

      setIssueDueDate: (id, dueDate) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue || issue.dueDate === dueDate) return s
          return {
            issues: s.issues.map((i) =>
              i.id === id ? { ...i, dueDate, updatedAt: nowIso() } : i,
            ),
            activities: [
              ...s.activities,
              logActivity(s, id, 'dueDate', issue.dueDate, dueDate),
            ],
          }
        }),

      setIssueTitle: (id, title) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue || issue.title === title) return s
          return {
            issues: s.issues.map((i) =>
              i.id === id ? { ...i, title, updatedAt: nowIso() } : i,
            ),
            activities: [
              ...s.activities,
              logActivity(s, id, 'title', issue.title, title),
            ],
          }
        }),

      setIssueDescription: (id, description) =>
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === id ? { ...i, description, updatedAt: nowIso() } : i,
          ),
        })),

      moveIssue: (id, stateId, sortOrder) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id)
          if (!issue) return s
          const newState = s.states.find((x) => x.id === stateId)
          const ts = nowIso()
          const changed = issue.stateId !== stateId
          return {
            issues: s.issues.map((i) =>
              i.id === id
                ? {
                    ...i,
                    stateId,
                    sortOrder,
                    updatedAt: ts,
                    completedAt:
                      newState?.type === 'completed' ? ts : i.completedAt,
                  }
                : i,
            ),
            activities: changed
              ? [
                  ...s.activities,
                  logActivity(s, id, 'status', issue.stateId, stateId),
                ]
              : s.activities,
          }
        }),

      setIssueSortOrder: (id, sortOrder) =>
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === id ? { ...i, sortOrder } : i,
          ),
        })),

      acceptTriage: (id, stateId) =>
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === id
              ? {
                  ...i,
                  triage: false,
                  stateId: stateId ?? i.stateId,
                  updatedAt: nowIso(),
                }
              : i,
          ),
        })),

      declineTriage: (id) =>
        set((s) => {
          const canceled = s.states.find((x) => x.type === 'canceled')
          const ts = nowIso()
          return {
            issues: s.issues.map((i) =>
              i.id === id
                ? {
                    ...i,
                    triage: false,
                    stateId: canceled?.id ?? i.stateId,
                    canceledAt: ts,
                    updatedAt: ts,
                  }
                : i,
            ),
          }
        }),

      addComment: (issueId, body, parentId) =>
        set((s) => ({
          comments: [
            ...s.comments,
            {
              id: `c_${nanoid(8)}`,
              issueId,
              userId: s.currentUserId,
              body,
              parentId,
              createdAt: nowIso(),
            } satisfies Comment,
          ],
        })),

      editComment: (id, body) =>
        set((s) => ({
          comments: s.comments.map((c) =>
            c.id === id ? { ...c, body, editedAt: nowIso() } : c,
          ),
        })),

      deleteComment: (id) =>
        set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),

      toggleResolveThread: (rootId) =>
        set((s) => ({
          comments: s.comments.map((c) =>
            c.id === rootId
              ? c.resolvedAt
                ? { ...c, resolvedAt: undefined, resolvedBy: undefined }
                : { ...c, resolvedAt: nowIso(), resolvedBy: s.currentUserId }
              : c,
          ),
        })),

      toggleReaction: (commentId, emoji) =>
        set((s) => ({
          comments: s.comments.map((c) => {
            if (c.id !== commentId) return c
            const reactions = { ...(c.reactions ?? {}) }
            const users = reactions[emoji] ?? []
            const me = s.currentUserId
            if (users.includes(me)) {
              const next = users.filter((u) => u !== me)
              if (next.length === 0) delete reactions[emoji]
              else reactions[emoji] = next
            } else {
              reactions[emoji] = [...users, me]
            }
            return { ...c, reactions }
          }),
        })),

      addRelation: (fromIssueId, toIssueId, type) =>
        set((s) => {
          if (fromIssueId === toIssueId) return s
          const exists = s.relations.some(
            (r) =>
              r.type === type &&
              ((r.fromIssueId === fromIssueId && r.toIssueId === toIssueId) ||
                (type === 'related' &&
                  r.fromIssueId === toIssueId &&
                  r.toIssueId === fromIssueId)),
          )
          if (exists) return s
          const relation: Relation = {
            id: `r_${nanoid(8)}`,
            type,
            fromIssueId,
            toIssueId,
          }
          return { relations: [...s.relations, relation] }
        }),

      removeRelation: (id) =>
        set((s) => ({ relations: s.relations.filter((r) => r.id !== id) })),

      addIssueLink: (issueId, url, title) =>
        set((s) => {
          const trimmed = url.trim()
          if (!trimmed) return s
          const t = title?.trim() || undefined
          const link: IssueLink = {
            id: `il_${nanoid(8)}`,
            issueId,
            url: trimmed,
            title: t,
            creatorId: s.currentUserId,
            createdAt: nowIso(),
          }
          return {
            issueLinks: [...s.issueLinks, link],
            // `from` carries the url (for the favicon), `to` the display text.
            activities: [
              ...s.activities,
              logActivity(s, issueId, 'link', trimmed, t ?? trimmed),
            ],
          }
        }),

      updateIssueLink: (id, patch) =>
        set((s) => ({
          issueLinks: s.issueLinks.map((l) =>
            l.id === id
              ? {
                  ...l,
                  ...patch,
                  title:
                    'title' in patch ? patch.title?.trim() || undefined : l.title,
                }
              : l,
          ),
        })),

      removeIssueLink: (id) =>
        set((s) => ({ issueLinks: s.issueLinks.filter((l) => l.id !== id) })),

      createLabel: (name, color, groupId) => {
        const label: Label = { id: `l_${nanoid(8)}`, name, color, groupId }
        set((s) => ({ labels: [...s.labels, label] }))
        return label
      },

      createLabelGroup: (name) => {
        const group: Label = { id: `lg_${nanoid(8)}`, name, color: '#95a2b3', isGroup: true }
        set((s) => ({ labels: [...s.labels, group] }))
        return group
      },

      updateLabel: (id, patch) =>
        set((s) => ({
          labels: s.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),

      // Deleting a label removes it from issues. Deleting a group ungroups its
      // children (they survive as standalone labels) — matches Linear leaving
      // the labels behind rather than cascading the delete.
      deleteLabel: (id) =>
        set((s) => ({
          labels: s.labels
            .filter((l) => l.id !== id)
            .map((l) => (l.groupId === id ? { ...l, groupId: undefined } : l)),
          issues: s.issues.map((i) =>
            i.labelIds.includes(id)
              ? { ...i, labelIds: i.labelIds.filter((l) => l !== id) }
              : i,
          ),
        })),

      createInitiative: (i) => {
        const initiative: Initiative = {
          ...i,
          id: `in_${nanoid(8)}`,
          createdAt: nowIso(),
          sortOrder:
            get().initiatives.reduce((m, x) => Math.max(m, x.sortOrder), 0) + 1,
        }
        set((s) => ({ initiatives: [...s.initiatives, initiative] }))
        return initiative
      },

      updateInitiative: (id, patch) =>
        set((s) => ({
          initiatives: s.initiatives.map((i) =>
            i.id === id ? { ...i, ...patch } : i,
          ),
        })),

      deleteInitiative: (id) =>
        set((s) => ({
          initiatives: s.initiatives.filter((i) => i.id !== id),
          // Unlink the projects that belonged to it; the projects survive.
          projects: s.projects.map((p) =>
            p.initiativeId === id ? { ...p, initiativeId: undefined } : p,
          ),
        })),

      setProjectInitiative: (projectId, initiativeId) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId ? { ...p, initiativeId } : p,
          ),
        })),

      createProject: (p) => {
        const project: Project = {
          ...p,
          id: `p_${nanoid(8)}`,
          createdAt: nowIso(),
          sortOrder:
            get().projects.reduce((m, x) => Math.max(m, x.sortOrder), 0) + 1,
        }
        set((s) => ({ projects: [...s.projects, project] }))
        return project
      },

      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        })),

      createMilestone: (projectId, name) => {
        const milestone: Milestone = {
          id: `m_${nanoid(8)}`,
          projectId,
          name,
          sortOrder:
            get().milestones
              .filter((m) => m.projectId === projectId)
              .reduce((mx, m) => Math.max(mx, m.sortOrder), 0) + 1,
        }
        set((s) => ({ milestones: [...s.milestones, milestone] }))
        return milestone
      },

      updateMilestone: (id, patch) =>
        set((s) => ({
          milestones: s.milestones.map((m) =>
            m.id === id ? { ...m, ...patch } : m,
          ),
        })),

      deleteMilestone: (id) =>
        set((s) => ({
          milestones: s.milestones.filter((m) => m.id !== id),
          issues: s.issues.map((i) =>
            i.milestoneId === id ? { ...i, milestoneId: undefined } : i,
          ),
        })),

      createProjectUpdate: (projectId, health, body) =>
        set((s) => ({
          projectUpdates: [
            ...s.projectUpdates,
            {
              id: `pu_${nanoid(8)}`,
              projectId,
              userId: s.currentUserId,
              health,
              body,
              createdAt: nowIso(),
            } satisfies ProjectUpdate,
          ],
        })),

      deleteProjectUpdate: (id) =>
        set((s) => ({
          projectUpdates: s.projectUpdates.filter((u) => u.id !== id),
        })),

      createInitiativeUpdate: (initiativeId, health, body) =>
        set((s) => ({
          initiativeUpdates: [
            ...s.initiativeUpdates,
            {
              id: `iu_${nanoid(8)}`,
              initiativeId,
              userId: s.currentUserId,
              health,
              body,
              createdAt: nowIso(),
            } satisfies InitiativeUpdate,
          ],
        })),

      deleteInitiativeUpdate: (id) =>
        set((s) => ({
          initiativeUpdates: s.initiativeUpdates.filter((u) => u.id !== id),
        })),

      createView: (v) => {
        const view: SavedView = { ...v, id: `v_${nanoid(8)}` }
        set((s) => ({ savedViews: [...s.savedViews, view] }))
        return view
      },

      updateView: (id, patch) =>
        set((s) => ({
          savedViews: s.savedViews.map((v) =>
            v.id === id ? { ...v, ...patch } : v,
          ),
        })),

      deleteView: (id) =>
        set((s) => ({ savedViews: s.savedViews.filter((v) => v.id !== id) })),

      createTemplate: (t) => {
        const tpl: IssueTemplate = { ...t, id: `tpl_${nanoid(8)}` }
        set((s) => ({ templates: [...s.templates, tpl] }))
        return tpl
      },

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      toggleTeamMember: (teamId, userId) =>
        set((s) => ({
          teams: s.teams.map((t) =>
            t.id === teamId
              ? {
                  ...t,
                  memberIds: (t.memberIds ?? []).includes(userId)
                    ? (t.memberIds ?? []).filter((u) => u !== userId)
                    : [...(t.memberIds ?? []), userId],
                }
              : t,
          ),
        })),

      setTeamEstimation: (teamId, patch) =>
        set((s) => ({
          teams: s.teams.map((t) => (t.id === teamId ? { ...t, ...patch } : t)),
        })),

      setTeamCyclesEnabled: (teamId, enabled) =>
        set((s) => ({
          teams: s.teams.map((t) =>
            t.id === teamId ? { ...t, cyclesEnabled: enabled } : t,
          ),
        })),

      createDocument: (input) => {
        const s = get()
        const ts = nowIso()
        const maxSort = s.documents.reduce((m, d) => Math.max(m, d.sortOrder), 0)
        const doc: Document = {
          id: `doc_${nanoid(8)}`,
          title: input?.title ?? '',
          icon: input?.icon ?? '📄',
          content: input?.content ?? '',
          creatorId: s.currentUserId,
          projectId: input?.projectId,
          createdAt: ts,
          updatedAt: ts,
          sortOrder: maxSort + 100,
        }
        set({ documents: [...s.documents, doc] })
        return doc
      },

      updateDocument: (id, patch) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id ? { ...d, ...patch, updatedAt: nowIso() } : d,
          ),
        })),

      deleteDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      // ── customers ─────────────────────────────────────────────
      createCustomer: (input) => {
        const customer: Customer = {
          ...input,
          id: `cust_${nanoid(8)}`,
          createdAt: nowIso(),
        }
        set((s) => ({ customers: [...s.customers, customer] }))
        return customer
      },
      updateCustomer: (id, patch) =>
        set((s) => ({
          customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      deleteCustomer: (id) =>
        set((s) => ({
          customers: s.customers.filter((c) => c.id !== id),
          // Unlink the customer from any issues' requests.
          issues: s.issues.map((i) =>
            i.customerIds?.includes(id)
              ? { ...i, customerIds: i.customerIds.filter((x) => x !== id) }
              : i,
          ),
        })),
      toggleIssueCustomer: (issueId, customerId) =>
        set((s) => ({
          issues: s.issues.map((i) => {
            if (i.id !== issueId) return i
            const cur = i.customerIds ?? []
            return {
              ...i,
              customerIds: cur.includes(customerId)
                ? cur.filter((x) => x !== customerId)
                : [...cur, customerId],
              updatedAt: nowIso(),
            }
          }),
        })),

      // ── releases ──────────────────────────────────────────────
      createRelease: (input) => {
        const s = get()
        const maxSort = s.releases.reduce((m, r) => Math.max(m, r.sortOrder), 0)
        const release: Release = {
          ...input,
          id: `rel_${nanoid(8)}`,
          createdAt: nowIso(),
          sortOrder: maxSort + 100,
        }
        set({ releases: [...s.releases, release] })
        return release
      },
      updateRelease: (id, patch) =>
        set((s) => ({
          releases: s.releases.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...patch,
                  // Stamp release time when moving into the released state.
                  releasedAt:
                    patch.status === 'released' && !r.releasedAt
                      ? nowIso()
                      : r.releasedAt,
                }
              : r,
          ),
        })),
      deleteRelease: (id) =>
        set((s) => ({ releases: s.releases.filter((r) => r.id !== id) })),

      // ── attachments ───────────────────────────────────────────
      addAttachment: (issueId, input) =>
        set((s) => ({
          attachments: [
            ...s.attachments,
            {
              ...input,
              id: `att_${nanoid(8)}`,
              issueId,
              creatorId: s.currentUserId,
              createdAt: nowIso(),
            },
          ],
        })),
      removeAttachment: (id) =>
        set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),

      // ── issue reactions ───────────────────────────────────────
      toggleIssueReaction: (issueId, emoji) =>
        set((s) => ({
          issues: s.issues.map((i) => {
            if (i.id !== issueId) return i
            const me = s.currentUserId
            const reactions = { ...(i.reactions ?? {}) }
            const cur = reactions[emoji] ?? []
            if (cur.includes(me)) {
              const next = cur.filter((u) => u !== me)
              if (next.length) reactions[emoji] = next
              else delete reactions[emoji]
            } else {
              reactions[emoji] = [...cur, me]
            }
            return { ...i, reactions }
          }),
        })),

      setUserRole: (id, role) =>
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, role } : u)),
        })),

      updateUser: (id, patch) =>
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        })),

      setWorkspaceName: (name) => set({ workspaceName: name.trim() || 'Workspace' }),

      inviteMember: (email, role) =>
        set((s) => {
          const name = email
            .split('@')[0]
            .split(/[._-]/)
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(' ')
          const colors = ['#9b51e0', '#5e9aa8', '#a17c5b', '#eb5757', '#f2c94c']
          const user: User = {
            id: `u_${nanoid(8)}`,
            name: name || email,
            email,
            avatarColor: colors[s.users.length % colors.length],
            role,
            pending: true,
          }
          return { users: [...s.users, user] }
        }),

      removeUser: (id) =>
        set((s) => {
          const me = s.users.find((u) => u.isMe)
          if (me?.id === id) return s // never remove yourself
          return {
            users: s.users.filter((u) => u.id !== id),
            issues: s.issues.map((i) =>
              i.assigneeId === id ? { ...i, assigneeId: undefined } : i,
            ),
            teams: s.teams.map((t) => ({
              ...t,
              memberIds: (t.memberIds ?? []).filter((m) => m !== id),
            })),
          }
        }),

      createState: (st) => {
        const state: WorkflowState = { ...st, id: `s_${nanoid(8)}` }
        set((s) => ({ states: [...s.states, state] }))
        return state
      },

      updateState: (id, patch) =>
        set((s) => ({
          states: s.states.map((st) => (st.id === id ? { ...st, ...patch } : st)),
        })),

      deleteState: (id) =>
        set((s) => {
          if (s.states.length <= 1) return s
          const fallback = s.states
            .filter((st) => st.id !== id)
            .sort(
              (a, b) =>
                STATUS_TYPE_ORDER[a.type] - STATUS_TYPE_ORDER[b.type] ||
                a.position - b.position,
            )[0]
          return {
            states: s.states.filter((st) => st.id !== id),
            issues: s.issues.map((i) =>
              i.stateId === id ? { ...i, stateId: fallback.id } : i,
            ),
          }
        }),

      moveState: (id, dir) =>
        set((s) => {
          const state = s.states.find((st) => st.id === id)
          if (!state) return s
          const peers = s.states
            .filter((st) => st.type === state.type)
            .sort((a, b) => a.position - b.position)
          const idx = peers.findIndex((st) => st.id === id)
          const target = dir === 'up' ? peers[idx - 1] : peers[idx + 1]
          if (!target) return s
          return {
            states: s.states.map((st) => {
              if (st.id === id) return { ...st, position: target.position }
              if (st.id === target.id) return { ...st, position: state.position }
              return st
            }),
          }
        }),

      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        })),

      setNotificationRead: (id, read) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read } : n,
          ),
        })),

      markAllNotificationsRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),

      snoozeNotification: (id, untilIso) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, snoozedUntil: untilIso } : n,
          ),
        })),

      unsnoozeNotification: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, snoozedUntil: undefined } : n,
          ),
        })),

      deleteNotification: (id) =>
        set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        })),

      deleteAllNotifications: () => set({ notifications: [] }),

      deleteAllReadNotifications: () =>
        set((s) => ({
          notifications: s.notifications.filter((n) => !n.read),
        })),

      setNotificationPref: (type, on) =>
        set((s) => ({
          notificationPrefs: { ...s.notificationPrefs, [type]: on },
        })),

      setNotificationChannelEnabled: (channel, enabled) =>
        set((s) => ({
          notificationSettings: {
            ...s.notificationSettings,
            channels: {
              ...s.notificationSettings.channels,
              [channel]: { ...s.notificationSettings.channels[channel], enabled },
            },
          },
        })),

      setNotificationEvent: (channel, event, on) =>
        set((s) => {
          const ch = s.notificationSettings.channels[channel]
          return {
            notificationSettings: {
              ...s.notificationSettings,
              channels: {
                ...s.notificationSettings.channels,
                [channel]: { ...ch, events: { ...ch.events, [event]: on } },
              },
            },
          }
        }),

      updateNotificationSettings: (patch) =>
        set((s) => ({
          notificationSettings: { ...s.notificationSettings, ...patch },
        })),

      setTheme: (theme) => set({ theme }),
      setPreference: (key, value) =>
        set((s) => ({ preferences: { ...s.preferences, [key]: value } })),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (commandOpen) =>
        // Closing the menu drops any row-hotkey context so a later plain ⌘K
        // opens clean.
        set(commandOpen ? { commandOpen } : { commandOpen, commandIssueId: null, commandPage: null }),
      openIssuePropertyMenu: (commandIssueId, commandPage) =>
        set({ commandIssueId, commandPage, commandOpen: true }),
      openRelationPicker: (issueId, kind) =>
        set({ relationPicker: { issueId, kind } }),
      closeRelationPicker: () => set({ relationPicker: null }),
      setCreateOpen: (createOpen) =>
        set(createOpen ? { createOpen } : { createOpen, createPrefill: null }),
      openCreateWith: (createPrefill) => set({ createOpen: true, createPrefill }),
      setCreateMore: (createMore) => set({ createMore }),
      setCreateInitiativeOpen: (createInitiativeOpen) =>
        set({ createInitiativeOpen }),
      setHelpOpen: (helpOpen) => set({ helpOpen }),
      setPeek: (peekIssueId) => set({ peekIssueId }),
      setNavIssueIds: (navIssueIds) =>
        set((s) =>
          // Avoid a needless re-render when the order is unchanged.
          s.navIssueIds.length === navIssueIds.length &&
          s.navIssueIds.every((v, i) => v === navIssueIds[i])
            ? s
            : { navIssueIds },
        ),
      setFocusedIssue: (focusedIssueId) => set({ focusedIssueId }),
      moveFocus: (dir) =>
        set((s) => {
          const list = s.navIssueIds
          if (list.length === 0) return s
          const cur = s.focusedIssueId ? list.indexOf(s.focusedIssueId) : -1
          let next: number
          if (cur === -1) {
            // No focus yet: ↓ focuses the first row, ↑ focuses the last.
            next = dir === 1 ? 0 : list.length - 1
          } else {
            next = Math.min(Math.max(cur + dir, 0), list.length - 1)
          }
          return { focusedIssueId: list[next] }
        }),

      addRecentSearch: (q) =>
        set((s) => {
          const query = q.trim()
          if (!query) return s
          return {
            recentSearches: [
              query,
              ...s.recentSearches.filter((x) => x !== query),
            ].slice(0, 8),
          }
        }),
      clearRecentSearches: () => set({ recentSearches: [] }),

      toggleFavorite: (type, id) =>
        set((s) => {
          const exists = s.favorites.some((f) => f.type === type && f.id === id)
          return {
            favorites: exists
              ? s.favorites.filter((f) => !(f.type === type && f.id === id))
              : [...s.favorites, { type, id }],
          }
        }),

      dismissOnboardingStep: (key) =>
        set((s) =>
          s.onboardingDismissed.includes(key)
            ? s
            : { onboardingDismissed: [...s.onboardingDismissed, key] },
        ),
      toggleDisplayProperty: (prop) =>
        set((s) => ({
          displayProperties: {
            ...s.displayProperties,
            [prop]: !s.displayProperties[prop],
          },
        })),
      setFeatureSetting: (key, on) =>
        set((s) => ({ featureSettings: { ...s.featureSettings, [key]: on } })),

      toggleSelectIssue: (id) =>
        set((s) => ({
          selectedIssueIds: s.selectedIssueIds.includes(id)
            ? s.selectedIssueIds.filter((x) => x !== id)
            : [...s.selectedIssueIds, id],
        })),
      setSelectedIssues: (selectedIssueIds) => set({ selectedIssueIds }),
      clearSelection: () => set({ selectedIssueIds: [] }),

      bulkSetStatus: (ids, stateId) =>
        set((s) => {
          const set_ = new Set(ids)
          const newState = s.states.find((x) => x.id === stateId)
          const ts = nowIso()
          return {
            issues: s.issues.map((i) =>
              set_.has(i.id)
                ? {
                    ...i,
                    stateId,
                    updatedAt: ts,
                    completedAt: newState?.type === 'completed' ? ts : undefined,
                    canceledAt: newState?.type === 'canceled' ? ts : undefined,
                  }
                : i,
            ),
          }
        }),
      bulkSetPriority: (ids, priority) =>
        set((s) => {
          const set_ = new Set(ids)
          return {
            issues: s.issues.map((i) =>
              set_.has(i.id) ? { ...i, priority, updatedAt: nowIso() } : i,
            ),
          }
        }),
      bulkSetAssignee: (ids, assigneeId) =>
        set((s) => {
          const set_ = new Set(ids)
          return {
            issues: s.issues.map((i) =>
              set_.has(i.id) ? { ...i, assigneeId, updatedAt: nowIso() } : i,
            ),
          }
        }),
      bulkAddLabel: (ids, labelId) =>
        set((s) => {
          const set_ = new Set(ids)
          return {
            issues: s.issues.map((i) =>
              set_.has(i.id) && !i.labelIds.includes(labelId)
                ? { ...i, labelIds: [...i.labelIds, labelId], updatedAt: nowIso() }
                : i,
            ),
          }
        }),
      bulkDelete: (ids) =>
        set((s) => {
          const set_ = new Set(ids)
          return {
            issues: s.issues.filter(
              (i) => !set_.has(i.id) && !(i.parentId && set_.has(i.parentId)),
            ),
            comments: s.comments.filter((c) => !set_.has(c.issueId)),
            activities: s.activities.filter((a) => !set_.has(a.issueId)),
            issueLinks: s.issueLinks.filter((l) => !set_.has(l.issueId)),
            relations: s.relations.filter(
              (r) => !set_.has(r.fromIssueId) && !set_.has(r.toIssueId),
            ),
            selectedIssueIds: [],
          }
        }),

      openContextMenu: (issueId, x, y) =>
        set({ contextMenu: { issueId, x, y } }),
      closeContextMenu: () => set({ contextMenu: null }),

      openLinkModal: (issueId, editId) =>
        set({ linkModal: { issueId, editId: editId ?? null } }),
      closeLinkModal: () => set({ linkModal: null }),

      openShareIssue: (issueId) => set({ shareIssueId: issueId }),
      closeShareIssue: () => set({ shareIssueId: null }),
      toggleIssuePublic: (issueId) =>
        set((s) => ({
          publicIssueIds: s.publicIssueIds.includes(issueId)
            ? s.publicIssueIds.filter((x) => x !== issueId)
            : [...s.publicIssueIds, issueId],
        })),
      openMoveIssue: (issueId) => set({ moveIssueId: issueId }),
      closeMoveIssue: () => set({ moveIssueId: null }),
      moveIssueToTeam: (issueId, teamId) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === issueId)
          if (!issue || issue.teamId === teamId) return {}
          const team = s.teams.find((t) => t.id === teamId)
          if (!team) return {}
          // Next number within the destination team.
          const number =
            s.issues
              .filter((i) => i.teamId === teamId)
              .reduce((max, i) => Math.max(max, i.number), 0) + 1
          return {
            issues: s.issues.map((i) =>
              i.id === issueId
                ? {
                    ...i,
                    teamId,
                    number,
                    identifier: `${team.key}-${number}`,
                    // Cycles are team-specific — drop the old one on a move.
                    cycleId: undefined,
                    updatedAt: nowIso(),
                  }
                : i,
            ),
          }
        }),

      resetWorkspace: () => {
        const fresh = buildSeed()
        set({ ...fresh })
      },

      importIssues: (rows) => {
        const s = get()
        if (!rows.length) return 0
        const norm = (v?: string) => (v ?? '').trim().toLowerCase()
        // Per-team running issue number, seeded from existing max.
        const counters: Record<string, number> = {}
        for (const t of s.teams)
          counters[t.id] = s.issues
            .filter((i) => i.teamId === t.id)
            .reduce((m, i) => Math.max(m, i.number), 0)
        let sort = s.issues.reduce((m, i) => Math.max(m, i.sortOrder), 0)
        const unstarted = s.states.find((x) => x.type === 'unstarted')!
        const ts = nowIso()

        const created: Issue[] = rows.map((row) => {
          const team =
            s.teams.find((t) => norm(t.key) === norm(row.team)) ??
            s.teams.find((t) => norm(t.name) === norm(row.team)) ??
            s.teams[0]
          const state =
            s.states.find((x) => norm(x.name) === norm(row.status)) ?? unstarted
          const assignee = row.assignee
            ? s.users.find(
                (u) =>
                  norm(u.name) === norm(row.assignee) ||
                  norm(u.email) === norm(row.assignee),
              )
            : undefined
          const project = row.project
            ? s.projects.find((p) => norm(p.name) === norm(row.project))
            : undefined
          const milestone =
            project && row.milestone
              ? s.milestones.find(
                  (m) =>
                    m.projectId === project.id && norm(m.name) === norm(row.milestone),
                )
              : undefined
          const labelIds = (row.labels ?? [])
            .map((name) => s.labels.find((l) => norm(l.name) === norm(name))?.id)
            .filter((id): id is string => !!id)
          const estimate =
            row.estimate != null && row.estimate !== '' && !isNaN(Number(row.estimate))
              ? Number(row.estimate)
              : undefined
          const number = ++counters[team.id]
          sort += 100
          return {
            id: `i_${nanoid(8)}`,
            number,
            identifier: `${team.key}-${number}`,
            title: (row.title || 'Untitled').trim(),
            description: row.description ?? '',
            teamId: team.id,
            stateId: state.id,
            priority: parsePriority(row.priority),
            assigneeId: assignee?.id,
            creatorId: s.currentUserId,
            labelIds,
            projectId: project?.id,
            milestoneId: milestone?.id,
            estimate,
            dueDate: row.dueDate || undefined,
            subscriberIds: [s.currentUserId],
            sortOrder: sort,
            createdAt: row.createdAt || ts,
            updatedAt: row.updatedAt || ts,
            completedAt: state.type === 'completed' ? row.completedAt || ts : undefined,
          }
        })

        set({
          issues: [...s.issues, ...created],
          activities: [
            ...s.activities,
            ...created.map((i) => logActivity(s, i.id, 'created')),
          ],
        })
        return created.length
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => {
        // Persist data + theme/sidebar; keep transient UI out of storage.
        const {
          commandOpen: _c,
          commandIssueId: _cmi,
          commandPage: _cmp,
          relationPicker: _rp,
          createOpen: _cr,
          createPrefill: _crp,
          createInitiativeOpen: _ci,
          helpOpen: _h,
          peekIssueId: _p,
          selectedIssueIds: _sel,
          navIssueIds: _nav,
          focusedIssueId: _foc,
          contextMenu: _cm,
          linkModal: _lm,
          shareIssueId: _sh,
          moveIssueId: _mv,
          ...rest
        } = s
        void _c
        void _cr
        void _crp
        void _ci
        void _h
        void _p
        void _sel
        void _nav
        void _foc
        void _cm
        void _lm
        void _sh
        void _mv
        return rest as Store
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<Store>) }
        // Backfill display properties (added later); fill any missing keys.
        merged.displayProperties = {
          ...DEFAULT_DISPLAY_PROPERTIES,
          ...(merged.displayProperties ?? {}),
        }
        // Backfill notification settings (added later); deep-fill missing keys
        // so workspaces persisted before this slice existed still load.
        {
          const d = DEFAULT_NOTIFICATION_SETTINGS
          const ns = merged.notificationSettings
          merged.notificationSettings = {
            ...d,
            ...(ns ?? {}),
            channels: {
              desktop: { ...d.channels.desktop, events: { ...d.channels.desktop.events, ...(ns?.channels?.desktop?.events ?? {}) }, ...(ns?.channels?.desktop ? { enabled: ns.channels.desktop.enabled } : {}) },
              mobile: { ...d.channels.mobile, events: { ...d.channels.mobile.events, ...(ns?.channels?.mobile?.events ?? {}) }, ...(ns?.channels?.mobile ? { enabled: ns.channels.mobile.enabled } : {}) },
              email: { ...d.channels.email, events: { ...d.channels.email.events, ...(ns?.channels?.email?.events ?? {}) }, ...(ns?.channels?.email ? { enabled: ns.channels.email.enabled } : {}) },
              slack: { ...d.channels.slack, events: { ...d.channels.slack.events, ...(ns?.channels?.slack?.events ?? {}) }, ...(ns?.channels?.slack ? { enabled: ns.channels.slack.enabled } : {}) },
            },
          }
        }
        // Backfill issue links for workspaces persisted before they existed.
        if (!Array.isArray(merged.issueLinks)) {
          merged.issueLinks = seed.issueLinks
        }
        // Backfill documents for workspaces persisted before they existed.
        if (!Array.isArray(merged.documents)) {
          merged.documents = seed.documents
        }
        // Backfill customers / releases / attachments (added later).
        if (!Array.isArray(merged.publicIssueIds)) merged.publicIssueIds = []
        if (!Array.isArray(merged.customers)) merged.customers = seed.customers
        if (!Array.isArray(merged.releases)) merged.releases = seed.releases
        if (!Array.isArray(merged.attachments)) merged.attachments = seed.attachments
        // Backfill team estimation / cycle defaults for older workspaces.
        if (Array.isArray(merged.teams)) {
          merged.teams = merged.teams.map((t) => ({
            estimationType: 'fibonacci' as const,
            estimationAllowZero: false,
            cyclesEnabled: true,
            ...t,
          }))
        }
        // Backfill initiatives for workspaces persisted before they existed.
        // Also link the seed projects so the seeded initiative isn't empty.
        if (!Array.isArray(merged.initiatives)) {
          merged.initiatives = seed.initiatives
          if (Array.isArray(merged.projects)) {
            merged.projects = merged.projects.map((p) => {
              const seeded = seed.projects.find((x) => x.id === p.id)
              return seeded?.initiativeId && !p.initiativeId
                ? { ...p, initiativeId: seeded.initiativeId }
                : p
            })
          }
        }
        // Backfill initiative updates for workspaces persisted before they existed.
        if (!Array.isArray(merged.initiativeUpdates)) {
          merged.initiativeUpdates = seed.initiativeUpdates
        }
        // Backfill team.memberIds for workspaces persisted before teams had members.
        if (Array.isArray(merged.teams)) {
          merged.teams = merged.teams.map((t) =>
            t.memberIds
              ? t
              : { ...t, memberIds: seed.teams.find((x) => x.id === t.id)?.memberIds ?? [] },
          )
        }
        // Backfill user.role for workspaces persisted before roles existed.
        if (Array.isArray(merged.users)) {
          merged.users = merged.users.map((u) =>
            u.role
              ? u
              : { ...u, role: seed.users.find((x) => x.id === u.id)?.role ?? (u.isMe ? 'admin' : 'member') },
          )
        }
        return merged
      },
    },
  ),
)

/**
 * Object-returning selector hook. Zustand v5 does not shallow-compare by
 * default, so selecting an object literal must go through `useShallow` to
 * avoid an infinite render loop.
 */
export function useStoreShallow<T>(selector: (state: Store) => T): T {
  return useStore(useShallow(selector))
}

/**
 * Returns a `(name) => string` formatter honouring the "Display names"
 * preference (Full name / First name). Stable per render — the underlying
 * pure `displayName` is recomputed only when the preference changes.
 */
export function useDisplayName(): (name: string | undefined) => string {
  const mode = useStore((s) => s.preferences.displayNames)
  return (name) => (name ? displayName(name, mode) : '')
}

// Notification helper used by Notification entities (kept here for type export).
export type { Notification }
