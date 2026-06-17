import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { nanoid } from 'nanoid'
import { buildSeed } from './seed'
import type { WorkspaceData } from './seed'
import { nowIso } from './utils'
import { STORAGE_KEY, STATUS_TYPE_ORDER } from './constants'
import { parsePriority, type ImportRow } from './importExport'
import type {
  Activity,
  ActivityKind,
  Comment,
  Favorite,
  FavoriteType,
  Initiative,
  Issue,
  IssueTemplate,
  Label,
  Milestone,
  Notification,
  NotificationPrefs,
  NotificationType,
  Priority,
  Project,
  ProjectHealth,
  ProjectUpdate,
  Relation,
  RelationType,
  SavedView,
  ThemeMode,
  User,
  UserRole,
  WorkflowState,
} from './types'

interface UIState {
  theme: ThemeMode
  sidebarCollapsed: boolean
  commandOpen: boolean
  createOpen: boolean
  /** New-initiative modal (transient). */
  createInitiativeOpen: boolean
  /** Keyboard-shortcuts help overlay (transient). */
  helpOpen: boolean
  /** Issue currently shown in the right-side peek panel (transient). */
  peekIssueId: string | null
  /** Issues selected for bulk actions (transient). */
  selectedIssueIds: string[]
  /** Right-click context menu target + position (transient). */
  contextMenu: { issueId: string; x: number; y: number } | null
  /** Recent search queries (persisted, newest first). */
  recentSearches: string[]
  /** Starred issues / projects / views (persisted). */
  favorites: Favorite[]
  /** Per-type notification preferences (persisted). */
  notificationPrefs: NotificationPrefs
  /** Dismissed "Try" onboarding step keys (persisted). */
  onboardingDismissed: string[]
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
  updateIssue: (id: string, patch: Partial<Issue>) => void
  deleteIssue: (id: string) => void
  setIssueStatus: (id: string, stateId: string) => void
  setIssuePriority: (id: string, priority: Priority) => void
  setIssueAssignee: (id: string, assigneeId?: string) => void
  toggleIssueLabel: (id: string, labelId: string) => void
  setIssueProject: (id: string, projectId?: string) => void
  setIssueMilestone: (id: string, milestoneId?: string) => void
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

  // ── comments ─────────────────────────────────────────────────
  addComment: (issueId: string, body: string, parentId?: string) => void
  deleteComment: (id: string) => void
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
  deleteMilestone: (id: string) => void
  createProjectUpdate: (projectId: string, health: ProjectHealth, body: string) => void
  deleteProjectUpdate: (id: string) => void
  createView: (v: Omit<SavedView, 'id'>) => SavedView
  updateView: (id: string, patch: Partial<SavedView>) => void
  deleteView: (id: string) => void
  createTemplate: (t: Omit<IssueTemplate, 'id'>) => IssueTemplate
  deleteTemplate: (id: string) => void
  toggleTeamMember: (teamId: string, userId: string) => void
  setUserRole: (id: string, role: UserRole) => void
  inviteMember: (email: string, role: UserRole) => void
  removeUser: (id: string) => void
  createState: (s: Omit<WorkflowState, 'id'>) => WorkflowState
  updateState: (id: string, patch: Partial<Pick<WorkflowState, 'name' | 'color' | 'type'>>) => void
  deleteState: (id: string) => void
  moveState: (id: string, dir: 'up' | 'down') => void

  // ── notifications ────────────────────────────────────────────
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  snoozeNotification: (id: string, untilIso: string) => void
  unsnoozeNotification: (id: string) => void
  deleteNotification: (id: string) => void
  setNotificationPref: (type: NotificationType, on: boolean) => void

  // ── ui ───────────────────────────────────────────────────────
  setTheme: (t: ThemeMode) => void
  toggleSidebar: () => void
  setCommandOpen: (open: boolean) => void
  setCreateOpen: (open: boolean) => void
  setCreateInitiativeOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setPeek: (id: string | null) => void
  addRecentSearch: (q: string) => void
  clearRecentSearches: () => void
  toggleFavorite: (type: FavoriteType, id: string) => void
  dismissOnboardingStep: (key: string) => void

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
      sidebarCollapsed: false,
      commandOpen: false,
      createOpen: false,
      createInitiativeOpen: false,
      helpOpen: false,
      peekIssueId: null,
      selectedIssueIds: [],
      contextMenu: null,
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
          return {
            issues: s.issues.map((i) =>
              i.id === id
                ? {
                    ...i,
                    stateId,
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

      deleteComment: (id) =>
        set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),

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

      setUserRole: (id, role) =>
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, role } : u)),
        })),

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

      setNotificationPref: (type, on) =>
        set((s) => ({
          notificationPrefs: { ...s.notificationPrefs, [type]: on },
        })),

      setTheme: (theme) => set({ theme }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setCreateOpen: (createOpen) => set({ createOpen }),
      setCreateInitiativeOpen: (createInitiativeOpen) =>
        set({ createInitiativeOpen }),
      setHelpOpen: (helpOpen) => set({ helpOpen }),
      setPeek: (peekIssueId) => set({ peekIssueId }),

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
            relations: s.relations.filter(
              (r) => !set_.has(r.fromIssueId) && !set_.has(r.toIssueId),
            ),
            selectedIssueIds: [],
          }
        }),

      openContextMenu: (issueId, x, y) =>
        set({ contextMenu: { issueId, x, y } }),
      closeContextMenu: () => set({ contextMenu: null }),

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
          createOpen: _cr,
          createInitiativeOpen: _ci,
          helpOpen: _h,
          peekIssueId: _p,
          selectedIssueIds: _sel,
          contextMenu: _cm,
          ...rest
        } = s
        void _c
        void _cr
        void _ci
        void _h
        void _p
        void _sel
        void _cm
        return rest as Store
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<Store>) }
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

// Notification helper used by Notification entities (kept here for type export).
export type { Notification }
