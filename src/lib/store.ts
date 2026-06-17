import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { nanoid } from 'nanoid'
import { buildSeed } from './seed'
import type { WorkspaceData } from './seed'
import { nowIso } from './utils'
import { STORAGE_KEY, STATUS_TYPE_ORDER } from './constants'
import type {
  Activity,
  ActivityKind,
  Comment,
  Issue,
  IssueTemplate,
  Label,
  Milestone,
  Notification,
  Priority,
  Project,
  Relation,
  RelationType,
  SavedView,
  ThemeMode,
  WorkflowState,
} from './types'

interface UIState {
  theme: ThemeMode
  sidebarCollapsed: boolean
  commandOpen: boolean
  createOpen: boolean
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
  createLabel: (name: string, color: string) => Label
  updateLabel: (id: string, patch: Partial<Pick<Label, 'name' | 'color'>>) => void
  deleteLabel: (id: string) => void
  createProject: (p: Omit<Project, 'id' | 'createdAt' | 'sortOrder'>) => Project
  updateProject: (id: string, patch: Partial<Project>) => void
  createMilestone: (projectId: string, name: string) => Milestone
  deleteMilestone: (id: string) => void
  createView: (v: Omit<SavedView, 'id'>) => SavedView
  updateView: (id: string, patch: Partial<SavedView>) => void
  deleteView: (id: string) => void
  createTemplate: (t: Omit<IssueTemplate, 'id'>) => IssueTemplate
  deleteTemplate: (id: string) => void
  createState: (s: Omit<WorkflowState, 'id'>) => WorkflowState
  updateState: (id: string, patch: Partial<Pick<WorkflowState, 'name' | 'color' | 'type'>>) => void
  deleteState: (id: string) => void
  moveState: (id: string, dir: 'up' | 'down') => void

  // ── notifications ────────────────────────────────────────────
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void

  // ── ui ───────────────────────────────────────────────────────
  setTheme: (t: ThemeMode) => void
  toggleSidebar: () => void
  setCommandOpen: (open: boolean) => void
  setCreateOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setPeek: (id: string | null) => void
  addRecentSearch: (q: string) => void
  clearRecentSearches: () => void

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
      helpOpen: false,
      peekIssueId: null,
      selectedIssueIds: [],
      contextMenu: null,
      recentSearches: [],

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
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === id ? { ...i, priority, updatedAt: nowIso() } : i,
          ),
          activities: [...s.activities, logActivity(s, id, 'priority')],
        })),

      setIssueAssignee: (id, assigneeId) =>
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === id ? { ...i, assigneeId, updatedAt: nowIso() } : i,
          ),
          activities: [
            ...s.activities,
            logActivity(s, id, 'assignee', undefined, assigneeId),
          ],
        })),

      toggleIssueLabel: (id, labelId) =>
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === id
              ? {
                  ...i,
                  labelIds: i.labelIds.includes(labelId)
                    ? i.labelIds.filter((l) => l !== labelId)
                    : [...i.labelIds, labelId],
                  updatedAt: nowIso(),
                }
              : i,
          ),
        })),

      setIssueProject: (id, projectId) =>
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === id
              ? { ...i, projectId, milestoneId: undefined, updatedAt: nowIso() }
              : i,
          ),
        })),

      setIssueMilestone: (id, milestoneId) =>
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === id ? { ...i, milestoneId, updatedAt: nowIso() } : i,
          ),
        })),

      setIssueEstimate: (id, estimate) =>
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === id ? { ...i, estimate, updatedAt: nowIso() } : i,
          ),
        })),

      setIssueDueDate: (id, dueDate) =>
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === id ? { ...i, dueDate, updatedAt: nowIso() } : i,
          ),
        })),

      setIssueTitle: (id, title) =>
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === id ? { ...i, title, updatedAt: nowIso() } : i,
          ),
        })),

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

      createLabel: (name, color) => {
        const label: Label = { id: `l_${nanoid(8)}`, name, color }
        set((s) => ({ labels: [...s.labels, label] }))
        return label
      },

      updateLabel: (id, patch) =>
        set((s) => ({
          labels: s.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),

      deleteLabel: (id) =>
        set((s) => ({
          labels: s.labels.filter((l) => l.id !== id),
          issues: s.issues.map((i) =>
            i.labelIds.includes(id)
              ? { ...i, labelIds: i.labelIds.filter((l) => l !== id) }
              : i,
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

      setTheme: (theme) => set({ theme }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setCreateOpen: (createOpen) => set({ createOpen }),
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
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => {
        // Persist data + theme/sidebar; keep transient UI out of storage.
        const {
          commandOpen: _c,
          createOpen: _cr,
          helpOpen: _h,
          peekIssueId: _p,
          selectedIssueIds: _sel,
          contextMenu: _cm,
          ...rest
        } = s
        void _c
        void _cr
        void _h
        void _p
        void _sel
        void _cm
        return rest as Store
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
