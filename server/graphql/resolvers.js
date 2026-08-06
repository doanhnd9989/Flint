// Resolvers over the single workspace document (workspace.js). Every field name
// here mirrors Linear's schema; the mapping to our storage shape happens in the
// resolver bodies so the wire format stays Linear's.
import { randomUUID } from 'node:crypto'
import { GraphQLScalarType, GraphQLError } from 'graphql'
import { getWorkspace, saveWorkspace, getMeta } from '../workspace.js'
import { fireEvent } from '../webhooks.js'
import { connect, sortRows, matchFilter } from './pagination.js'

const COLLECTIONS = [
  'teams', 'states', 'labels', 'users', 'projects', 'cycles', 'issues',
  'comments', 'milestones', 'relations', 'attachments',
]

/** The workspace document with every collection guaranteed to be an array. */
function doc() {
  const w = getWorkspace() || {}
  for (const k of COLLECTIONS) if (!Array.isArray(w[k])) w[k] = []
  return w
}

/** Persist and notify webhook subscribers. Returns the new document version. */
function commit(w, writer) {
  return saveWorkspace(w, writer || 'graphql')
}

const now = () => new Date().toISOString()

const PRIORITY_LABELS = ['No priority', 'Urgent', 'High', 'Medium', 'Low']

const APP_URL = process.env.APP_URL || 'http://localhost:5173'

function userError(message) {
  return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } })
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── scalars ──────────────────────────────────────────────────────────────────
const DateTime = new GraphQLScalarType({
  name: 'DateTime',
  description: 'An ISO-8601 date-time string.',
  serialize: (v) => (v == null ? null : new Date(v).toISOString()),
  parseValue: (v) => (v == null ? null : new Date(v).toISOString()),
  parseLiteral: (ast) => ('value' in ast ? new Date(ast.value).toISOString() : null),
})

const TimelessDate = new GraphQLScalarType({
  name: 'TimelessDate',
  description: 'A calendar date with no time component (YYYY-MM-DD).',
  serialize: (v) => (v == null ? null : String(v).slice(0, 10)),
  parseValue: (v) => (v == null ? null : String(v).slice(0, 10)),
  parseLiteral: (ast) => ('value' in ast ? String(ast.value).slice(0, 10) : null),
})

const passthrough = (name, description) =>
  new GraphQLScalarType({
    name,
    description,
    serialize: (v) => v,
    parseValue: (v) => v,
    parseLiteral: (ast) => ('value' in ast ? ast.value : null),
  })

// ── filter field maps (used by matchFilter) ──────────────────────────────────
const userFields = {
  id: (u) => u.id,
  name: (u) => u.name,
  email: (u) => u.email,
  displayName: (u) => u.name,
}
const teamFields = { id: (t) => t.id, name: (t) => t.name, key: (t) => t.key }
const stateFields = { id: (s) => s.id, name: (s) => s.name, type: (s) => s.type }
const projectFields = { id: (p) => p.id, name: (p) => p.name, state: (p) => p.status }
const cycleFields = { id: (c) => c.id, name: (c) => c.name, number: (c) => c.number }
const labelFields = { id: (l) => l.id, name: (l) => l.name }

const issueFields = {
  id: (i) => i.id,
  number: (i) => i.number,
  title: (i) => i.title,
  description: (i) => i.description,
  priority: (i) => i.priority,
  estimate: (i) => i.estimate,
  dueDate: (i) => i.dueDate,
  createdAt: (i) => i.createdAt,
  updatedAt: (i) => i.updatedAt,
  completedAt: (i) => i.completedAt,
  canceledAt: (i) => i.canceledAt,
  assignee: { relation: (i, w) => w.users.find((u) => u.id === i.assigneeId), filter: userFields },
  creator: { relation: (i, w) => w.users.find((u) => u.id === i.creatorId), filter: userFields },
  team: { relation: (i, w) => w.teams.find((t) => t.id === i.teamId), filter: teamFields },
  state: { relation: (i, w) => w.states.find((s) => s.id === i.stateId), filter: stateFields },
  project: { relation: (i, w) => w.projects.find((p) => p.id === i.projectId), filter: projectFields },
  cycle: { relation: (i, w) => w.cycles.find((c) => c.id === i.cycleId), filter: cycleFields },
  labels: { collection: (i, w) => w.labels.filter((l) => (i.labelIds || []).includes(l.id)), filter: labelFields },
}
// Self-reference: a parent filter is just an issue filter one level up.
issueFields.parent = {
  relation: (i, w) => w.issues.find((x) => x.id === i.parentId),
  filter: issueFields,
}

const commentFields = {
  id: (c) => c.id,
  body: (c) => c.body,
  createdAt: (c) => c.createdAt,
  user: { relation: (c, w) => w.users.find((u) => u.id === c.userId), filter: userFields },
}

/**
 * The standard connection pipeline: filter → drop archived → sort → paginate.
 * Every list field in the schema funnels through this so they behave alike.
 */
function list(rows, args, { w, fields, archivable = false } = {}) {
  let out = rows
  if (archivable && !args?.includeArchived) out = out.filter((r) => !r.archivedAt)
  if (args?.filter && fields) out = out.filter((r) => matchFilter(r, args.filter, fields, w))
  return connect(sortRows(out, args?.orderBy), args)
}

export const resolvers = {
  DateTime,
  TimelessDate,
  JSON: passthrough('JSON', 'An arbitrary JSON value.'),
  JSONObject: passthrough('JSONObject', 'An arbitrary JSON object.'),

  Node: {
    __resolveType: () => null,
  },

  // ── Query ──────────────────────────────────────────────────────────────────
  Query: {
    viewer: (_r, _a, ctx) => {
      const w = doc()
      // Prefer the workspace member matching the authenticated account, so
      // `viewer` lines up with the identity the app shows.
      return (
        w.users.find((u) => u.email?.toLowerCase() === ctx.user.email?.toLowerCase()) ||
        w.users.find((u) => u.id === w.currentUserId) || {
          id: ctx.user.id,
          name: ctx.user.name,
          email: ctx.user.email,
          createdAt: ctx.user.created_at,
        }
      )
    },
    organization: () => {
      const w = doc()
      return {
        id: 'org',
        name: w.workspaceName || 'Flint Task',
        urlKey: slugify(w.workspaceName || 'flint'),
        createdAt: w.issues?.[0]?.createdAt || now(),
      }
    },

    user: (_r, { id }) => doc().users.find((u) => u.id === id) || null,
    users: (_r, args) => {
      const w = doc()
      return list(w.users, args, { w, fields: userFields })
    },

    team: (_r, { id }) => {
      const w = doc()
      // Linear accepts either the uuid or the team key.
      return w.teams.find((t) => t.id === id || t.key === id) || null
    },
    teams: (_r, args) => {
      const w = doc()
      return list(w.teams, args, { w, fields: teamFields, archivable: true })
    },

    issue: (_r, { id }) => {
      const w = doc()
      return w.issues.find((i) => i.id === id || i.identifier === id) || null
    },
    issues: (_r, args) => {
      const w = doc()
      return list(w.issues, args, { w, fields: issueFields, archivable: true })
    },

    project: (_r, { id }) => doc().projects.find((p) => p.id === id) || null,
    projects: (_r, args) => {
      const w = doc()
      return list(w.projects, args, { w, fields: projectFields, archivable: true })
    },

    cycle: (_r, { id }) => doc().cycles.find((c) => c.id === id) || null,
    cycles: (_r, args) => {
      const w = doc()
      return list(w.cycles, args, { w, fields: cycleFields })
    },

    workflowState: (_r, { id }) => doc().states.find((s) => s.id === id) || null,
    workflowStates: (_r, args) => {
      const w = doc()
      return list(w.states, args, { w, fields: stateFields })
    },

    issueLabel: (_r, { id }) => doc().labels.find((l) => l.id === id) || null,
    issueLabels: (_r, args) => {
      const w = doc()
      return list(w.labels, args, { w, fields: labelFields })
    },

    comment: (_r, { id }) => doc().comments.find((c) => c.id === id) || null,
    comments: (_r, args) => {
      const w = doc()
      return list(w.comments, args, { w, fields: commentFields })
    },

    searchIssues: (_r, args) => {
      const w = doc()
      const term = String(args.term || '').toLowerCase()
      const hits = w.issues.filter(
        (i) =>
          i.identifier?.toLowerCase().includes(term) ||
          i.title?.toLowerCase().includes(term) ||
          i.description?.toLowerCase().includes(term),
      )
      return list(hits, args, { w, archivable: true })
    },
  },

  // ── object types ───────────────────────────────────────────────────────────
  Organization: {
    teams: (_o, args) => {
      const w = doc()
      return list(w.teams, args, { w, fields: teamFields, archivable: true })
    },
    users: (_o, args) => {
      const w = doc()
      return list(w.users, args, { w, fields: userFields })
    },
  },

  User: {
    displayName: (u) => u.name,
    avatarUrl: () => null,
    active: (u) => !u.suspended,
    admin: (u) => u.role === 'admin',
    createdAt: (u) => u.createdAt || now(),
    updatedAt: (u) => u.updatedAt || u.createdAt || now(),
    url: (u) => `${APP_URL}/member/${u.id}`,
    assignedIssues: (u, args) => {
      const w = doc()
      return list(w.issues.filter((i) => i.assigneeId === u.id), args, {
        w, fields: issueFields, archivable: true,
      })
    },
    createdIssues: (u, args) => {
      const w = doc()
      return list(w.issues.filter((i) => i.creatorId === u.id), args, {
        w, fields: issueFields, archivable: true,
      })
    },
    teams: (u, args) => {
      const w = doc()
      return list(w.teams.filter((t) => (t.memberIds || []).includes(u.id)), args, { w })
    },
  },

  Team: {
    private: (t) => !!t.private,
    cyclesEnabled: (t) => t.cyclesEnabled !== false,
    createdAt: (t) => t.createdAt || now(),
    updatedAt: (t) => t.updatedAt || t.createdAt || now(),
    issues: (t, args) => {
      const w = doc()
      return list(w.issues.filter((i) => i.teamId === t.id), args, {
        w, fields: issueFields, archivable: true,
      })
    },
    states: (t, args) => {
      const w = doc()
      const states = w.states.filter((s) => !s.teamId || s.teamId === t.id)
      return connect([...states].sort((a, b) => a.position - b.position), args)
    },
    labels: (t, args) => connect(doc().labels, args),
    cycles: (t, args) => {
      const w = doc()
      return list(w.cycles.filter((c) => c.teamId === t.id), args, { w })
    },
    projects: (t, args) => {
      const w = doc()
      return list(w.projects.filter((p) => (p.teamIds || []).includes(t.id)), args, {
        w, archivable: true,
      })
    },
    members: (t, args) => {
      const w = doc()
      return connect(w.users.filter((u) => (t.memberIds || []).includes(u.id)), args)
    },
    activeCycle: (t) => {
      const nowMs = Date.now()
      return (
        doc().cycles.find(
          (c) =>
            c.teamId === t.id &&
            new Date(c.startsAt).getTime() <= nowMs &&
            new Date(c.endsAt).getTime() >= nowMs,
        ) || null
      )
    },
  },

  WorkflowState: {
    createdAt: (s) => s.createdAt || now(),
    updatedAt: (s) => s.updatedAt || s.createdAt || now(),
    description: (s) => s.description || null,
    team: (s) => (s.teamId ? doc().teams.find((t) => t.id === s.teamId) || null : null),
    issues: (s, args) => {
      const w = doc()
      return list(w.issues.filter((i) => i.stateId === s.id), args, { w, fields: issueFields, archivable: true })
    },
  },

  IssueLabel: {
    isGroup: (l) => !!l.isGroup,
    description: (l) => l.description || null,
    createdAt: (l) => l.createdAt || now(),
    updatedAt: (l) => l.updatedAt || l.createdAt || now(),
    parent: (l) => (l.groupId ? doc().labels.find((x) => x.id === l.groupId) || null : null),
    children: (l, args) => connect(doc().labels.filter((x) => x.groupId === l.id), args),
    issues: (l, args) => {
      const w = doc()
      return list(w.issues.filter((i) => (i.labelIds || []).includes(l.id)), args, {
        w, fields: issueFields, archivable: true,
      })
    },
  },

  Cycle: {
    name: (c) => c.name || `Cycle ${c.number}`,
    description: (c) => c.goal || null,
    createdAt: (c) => c.createdAt || c.startsAt,
    updatedAt: (c) => c.updatedAt || c.startsAt,
    completedAt: (c) => c.completedAt || null,
    progress: (c) => {
      const w = doc()
      const inCycle = w.issues.filter((i) => i.cycleId === c.id)
      if (!inCycle.length) return 0
      const done = new Set(w.states.filter((s) => s.type === 'completed').map((s) => s.id))
      return inCycle.filter((i) => done.has(i.stateId)).length / inCycle.length
    },
    team: (c) => doc().teams.find((t) => t.id === c.teamId) || null,
    issues: (c, args) => {
      const w = doc()
      return list(w.issues.filter((i) => i.cycleId === c.id), args, {
        w, fields: issueFields, archivable: true,
      })
    },
  },

  ProjectMilestone: {
    description: (m) => m.description || null,
    targetDate: (m) => m.targetDate || null,
    createdAt: (m) => m.createdAt || now(),
    updatedAt: (m) => m.updatedAt || m.createdAt || now(),
    project: (m) => doc().projects.find((p) => p.id === m.projectId) || null,
  },

  Project: {
    description: (p) => p.description || '',
    slugId: (p) => slugify(p.name),
    state: (p) => p.status,
    priority: (p) => p.priority ?? 0,
    color: (p) => p.color || '#5e6ad2',
    startDate: (p) => p.startDate || null,
    targetDate: (p) => p.targetDate || null,
    updatedAt: (p) => p.updatedAt || p.createdAt,
    completedAt: (p) => (p.status === 'completed' ? p.updatedAt || p.createdAt : null),
    canceledAt: (p) => (p.status === 'canceled' ? p.updatedAt || p.createdAt : null),
    url: (p) => `${APP_URL}/project/${p.id}`,
    progress: (p) => {
      const w = doc()
      const inProject = w.issues.filter((i) => i.projectId === p.id)
      if (!inProject.length) return 0
      const done = new Set(w.states.filter((s) => s.type === 'completed').map((s) => s.id))
      return inProject.filter((i) => done.has(i.stateId)).length / inProject.length
    },
    lead: (p) => (p.leadId ? doc().users.find((u) => u.id === p.leadId) || null : null),
    members: (p, args) => connect(doc().users.filter((u) => (p.memberIds || []).includes(u.id)), args),
    teams: (p, args) => connect(doc().teams.filter((t) => (p.teamIds || []).includes(t.id)), args),
    issues: (p, args) => {
      const w = doc()
      return list(w.issues.filter((i) => i.projectId === p.id), args, {
        w, fields: issueFields, archivable: true,
      })
    },
    projectMilestones: (p, args) => {
      const ms = doc().milestones.filter((m) => m.projectId === p.id)
      return connect([...ms].sort((a, b) => a.sortOrder - b.sortOrder), args)
    },
  },

  Comment: {
    updatedAt: (c) => c.editedAt || c.createdAt,
    editedAt: (c) => c.editedAt || null,
    resolvedAt: (c) => c.resolvedAt || null,
    url: (c) => {
      const issue = doc().issues.find((i) => i.id === c.issueId)
      return `${APP_URL}/issue/${issue?.identifier || c.issueId}#comment-${c.id}`
    },
    user: (c) => doc().users.find((u) => u.id === c.userId) || null,
    issue: (c) => doc().issues.find((i) => i.id === c.issueId) || null,
    parent: (c) => (c.parentId ? doc().comments.find((x) => x.id === c.parentId) || null : null),
    children: (c, args) => connect(doc().comments.filter((x) => x.parentId === c.id), args),
    resolvingUser: (c) => (c.resolvedBy ? doc().users.find((u) => u.id === c.resolvedBy) || null : null),
  },

  IssueRelation: {
    // Our storage uses "blocks" for the blocking direction, matching Linear.
    createdAt: (r) => r.createdAt || now(),
    updatedAt: (r) => r.updatedAt || r.createdAt || now(),
    issue: (r) => doc().issues.find((i) => i.id === r.fromIssueId),
    relatedIssue: (r) => doc().issues.find((i) => i.id === r.toIssueId),
  },

  Attachment: {
    title: (a) => a.name,
    subtitle: (a) => a.size || null,
    url: (a) => a.url || '',
    updatedAt: (a) => a.updatedAt || a.createdAt,
    issue: (a) => doc().issues.find((i) => i.id === a.issueId) || null,
    creator: (a) => doc().users.find((u) => u.id === a.creatorId) || null,
  },

  Issue: {
    description: (i) => i.description || null,
    priorityLabel: (i) => PRIORITY_LABELS[i.priority] || 'No priority',
    boardOrder: (i) => i.sortOrder ?? 0,
    branchName: (i) => {
      const w = doc()
      const user = w.users.find((u) => u.id === (i.assigneeId || i.creatorId))
      const handle = slugify((user?.email || 'user').split('@')[0])
      return `${handle}/${String(i.identifier).toLowerCase()}-${slugify(i.title).slice(0, 40)}`
    },
    url: (i) => `${APP_URL}/issue/${i.identifier}`,
    dueDate: (i) => i.dueDate || null,
    startedAt: (i) => {
      const w = doc()
      const state = w.states.find((s) => s.id === i.stateId)
      return state?.type === 'started' ? i.updatedAt : null
    },
    triagedAt: (i) => i.triageAcceptedAt || null,
    snoozedUntilAt: (i) => i.snoozedUntil || null,
    snoozedBy: () => null,
    customerTicketCount: (i) => (i.customerIds || []).length,
    state: (i) => doc().states.find((s) => s.id === i.stateId) || null,
    team: (i) => doc().teams.find((t) => t.id === i.teamId) || null,
    assignee: (i) => (i.assigneeId ? doc().users.find((u) => u.id === i.assigneeId) || null : null),
    creator: (i) => doc().users.find((u) => u.id === i.creatorId) || null,
    project: (i) => (i.projectId ? doc().projects.find((p) => p.id === i.projectId) || null : null),
    projectMilestone: (i) =>
      i.milestoneId ? doc().milestones.find((m) => m.id === i.milestoneId) || null : null,
    cycle: (i) => (i.cycleId ? doc().cycles.find((c) => c.id === i.cycleId) || null : null),
    parent: (i) => (i.parentId ? doc().issues.find((x) => x.id === i.parentId) || null : null),
    children: (i, args) => {
      const w = doc()
      return list(w.issues.filter((x) => x.parentId === i.id), args, {
        w, fields: issueFields, archivable: true,
      })
    },
    labels: (i, args) => {
      const w = doc()
      return list(w.labels.filter((l) => (i.labelIds || []).includes(l.id)), args, {
        w, fields: labelFields,
      })
    },
    comments: (i, args) => {
      const w = doc()
      return list(w.comments.filter((c) => c.issueId === i.id), args, { w, fields: commentFields })
    },
    subscribers: (i, args) =>
      connect(doc().users.filter((u) => (i.subscriberIds || []).includes(u.id)), args),
    relations: (i, args) => connect(doc().relations.filter((r) => r.fromIssueId === i.id), args),
    inverseRelations: (i, args) => connect(doc().relations.filter((r) => r.toIssueId === i.id), args),
    attachments: (i, args) => connect(doc().attachments.filter((a) => a.issueId === i.id), args),
    // Activity is stored app-side in a different shape; the connection exists so
    // clients can query it without erroring, and returns an empty page for now.
    history: (_i, args) => connect([], args),
  },

  // ── Mutation ───────────────────────────────────────────────────────────────
  Mutation: {
    issueCreate: (_r, { input }, ctx) => {
      const w = doc()
      const team = w.teams.find((t) => t.id === input.teamId || t.key === input.teamId)
      if (!team) throw userError(`No team with id "${input.teamId}"`)
      const stateId =
        input.stateId ||
        w.states.find((s) => s.type === 'unstarted')?.id ||
        w.states[0]?.id
      if (!stateId) throw userError('The workspace has no workflow states yet')

      const number =
        w.issues.filter((i) => i.teamId === team.id).reduce((m, i) => Math.max(m, i.number || 0), 0) + 1
      const creatorId = ctx.viewerId(w)
      const ts = now()
      const issue = {
        id: input.id || randomUUID(),
        number,
        identifier: `${team.key}-${number}`,
        title: input.title,
        description: input.description || '',
        teamId: team.id,
        stateId,
        priority: input.priority ?? 0,
        assigneeId: input.assigneeId,
        creatorId,
        labelIds: input.labelIds || [],
        projectId: input.projectId,
        milestoneId: input.projectMilestoneId,
        cycleId: input.cycleId,
        parentId: input.parentId,
        estimate: input.estimate,
        dueDate: input.dueDate,
        subscriberIds: input.subscriberIds || [creatorId],
        sortOrder: input.sortOrder ?? w.issues.length,
        createdAt: ts,
        updatedAt: ts,
      }
      w.issues.push(issue)
      const lastSyncId = commit(w, ctx.clientId)
      fireEvent('issue', 'create', issue)
      return { lastSyncId, success: true, issue }
    },

    issueUpdate: (_r, { id, input }, ctx) => {
      const w = doc()
      const issue = w.issues.find((i) => i.id === id || i.identifier === id)
      if (!issue) throw userError(`No issue with id "${id}"`)

      const map = {
        title: 'title', description: 'description', teamId: 'teamId', stateId: 'stateId',
        assigneeId: 'assigneeId', parentId: 'parentId', projectId: 'projectId',
        projectMilestoneId: 'milestoneId', cycleId: 'cycleId', priority: 'priority',
        estimate: 'estimate', dueDate: 'dueDate', labelIds: 'labelIds',
        subscriberIds: 'subscriberIds', sortOrder: 'sortOrder',
      }
      for (const [inputKey, field] of Object.entries(map)) {
        if (input[inputKey] !== undefined) issue[field] = input[inputKey]
      }
      // Completing / cancelling an issue stamps the matching timestamp, as Linear does.
      if (input.stateId !== undefined) {
        const type = w.states.find((s) => s.id === input.stateId)?.type
        issue.completedAt = type === 'completed' ? now() : undefined
        issue.canceledAt = type === 'canceled' ? now() : undefined
      }
      issue.updatedAt = now()
      const lastSyncId = commit(w, ctx.clientId)
      fireEvent('issue', 'update', issue)
      return { lastSyncId, success: true, issue }
    },

    issueDelete: (_r, { id }, ctx) => {
      const w = doc()
      const issue = w.issues.find((i) => i.id === id || i.identifier === id)
      if (!issue) throw userError(`No issue with id "${id}"`)
      w.issues = w.issues.filter((i) => i.id !== issue.id)
      w.comments = w.comments.filter((c) => c.issueId !== issue.id)
      w.relations = w.relations.filter((r) => r.fromIssueId !== issue.id && r.toIssueId !== issue.id)
      const lastSyncId = commit(w, ctx.clientId)
      fireEvent('issue', 'remove', { id: issue.id })
      return { lastSyncId, success: true, entityId: issue.id }
    },

    issueArchive: (_r, { id }, ctx) => {
      const w = doc()
      const issue = w.issues.find((i) => i.id === id || i.identifier === id)
      if (!issue) throw userError(`No issue with id "${id}"`)
      issue.archivedAt = now()
      issue.updatedAt = issue.archivedAt
      const lastSyncId = commit(w, ctx.clientId)
      return { lastSyncId, success: true, entity: issue }
    },

    issueUnarchive: (_r, { id }, ctx) => {
      const w = doc()
      const issue = w.issues.find((i) => i.id === id || i.identifier === id)
      if (!issue) throw userError(`No issue with id "${id}"`)
      delete issue.archivedAt
      issue.updatedAt = now()
      const lastSyncId = commit(w, ctx.clientId)
      return { lastSyncId, success: true, entity: issue }
    },

    commentCreate: (_r, { input }, ctx) => {
      const w = doc()
      const issue = w.issues.find((i) => i.id === input.issueId || i.identifier === input.issueId)
      if (!issue) throw userError(`No issue with id "${input.issueId}"`)
      const comment = {
        id: input.id || randomUUID(),
        issueId: issue.id,
        userId: ctx.viewerId(w),
        body: input.body,
        parentId: input.parentId,
        createdAt: now(),
      }
      w.comments.push(comment)
      const lastSyncId = commit(w, ctx.clientId)
      fireEvent('comment', 'create', comment)
      return { lastSyncId, success: true, comment }
    },

    commentUpdate: (_r, { id, input }, ctx) => {
      const w = doc()
      const comment = w.comments.find((c) => c.id === id)
      if (!comment) throw userError(`No comment with id "${id}"`)
      comment.body = input.body
      comment.editedAt = now()
      const lastSyncId = commit(w, ctx.clientId)
      return { lastSyncId, success: true, comment }
    },

    commentDelete: (_r, { id }, ctx) => {
      const w = doc()
      if (!w.comments.some((c) => c.id === id)) throw userError(`No comment with id "${id}"`)
      w.comments = w.comments.filter((c) => c.id !== id && c.parentId !== id)
      const lastSyncId = commit(w, ctx.clientId)
      return { lastSyncId, success: true, entityId: id }
    },

    projectCreate: (_r, { input }, ctx) => {
      const w = doc()
      const ts = now()
      const project = {
        id: input.id || randomUUID(),
        name: input.name,
        description: input.description || '',
        icon: input.icon || '📋',
        color: input.color || '#5e6ad2',
        status: input.state || 'backlog',
        priority: input.priority ?? 0,
        leadId: input.leadId,
        memberIds: input.memberIds || [],
        teamIds: input.teamIds,
        startDate: input.startDate,
        targetDate: input.targetDate,
        createdAt: ts,
        sortOrder: w.projects.length,
      }
      w.projects.push(project)
      const lastSyncId = commit(w, ctx.clientId)
      return { lastSyncId, success: true, project }
    },

    projectUpdate: (_r, { id, input }, ctx) => {
      const w = doc()
      const project = w.projects.find((p) => p.id === id)
      if (!project) throw userError(`No project with id "${id}"`)
      const map = {
        name: 'name', description: 'description', teamIds: 'teamIds', leadId: 'leadId',
        memberIds: 'memberIds', state: 'status', priority: 'priority', icon: 'icon',
        color: 'color', startDate: 'startDate', targetDate: 'targetDate',
      }
      for (const [inputKey, field] of Object.entries(map)) {
        if (input[inputKey] !== undefined) project[field] = input[inputKey]
      }
      project.updatedAt = now()
      const lastSyncId = commit(w, ctx.clientId)
      return { lastSyncId, success: true, project }
    },

    projectDelete: (_r, { id }, ctx) => {
      const w = doc()
      if (!w.projects.some((p) => p.id === id)) throw userError(`No project with id "${id}"`)
      w.projects = w.projects.filter((p) => p.id !== id)
      for (const i of w.issues) if (i.projectId === id) i.projectId = undefined
      const lastSyncId = commit(w, ctx.clientId)
      return { lastSyncId, success: true, entityId: id }
    },

    cycleCreate: (_r, { input }, ctx) => {
      const w = doc()
      const team = w.teams.find((t) => t.id === input.teamId || t.key === input.teamId)
      if (!team) throw userError(`No team with id "${input.teamId}"`)
      const number =
        w.cycles.filter((c) => c.teamId === team.id).reduce((m, c) => Math.max(m, c.number || 0), 0) + 1
      const cycle = {
        id: input.id || randomUUID(),
        teamId: team.id,
        number,
        name: input.name,
        goal: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        createdAt: now(),
      }
      w.cycles.push(cycle)
      const lastSyncId = commit(w, ctx.clientId)
      return { lastSyncId, success: true, cycle }
    },

    cycleUpdate: (_r, { id, input }, ctx) => {
      const w = doc()
      const cycle = w.cycles.find((c) => c.id === id)
      if (!cycle) throw userError(`No cycle with id "${id}"`)
      if (input.name !== undefined) cycle.name = input.name
      if (input.description !== undefined) cycle.goal = input.description
      if (input.startsAt !== undefined) cycle.startsAt = input.startsAt
      if (input.endsAt !== undefined) cycle.endsAt = input.endsAt
      if (input.completedAt !== undefined) cycle.completedAt = input.completedAt
      cycle.updatedAt = now()
      const lastSyncId = commit(w, ctx.clientId)
      return { lastSyncId, success: true, cycle }
    },

    issueLabelCreate: (_r, { input }, ctx) => {
      const w = doc()
      const label = {
        id: input.id || randomUUID(),
        name: input.name,
        color: input.color || '#95a2b3',
        description: input.description,
        groupId: input.parentId,
        createdAt: now(),
      }
      w.labels.push(label)
      const lastSyncId = commit(w, ctx.clientId)
      return { lastSyncId, success: true, issueLabel: label }
    },

    issueLabelUpdate: (_r, { id, input }, ctx) => {
      const w = doc()
      const label = w.labels.find((l) => l.id === id)
      if (!label) throw userError(`No label with id "${id}"`)
      if (input.name !== undefined) label.name = input.name
      if (input.color !== undefined) label.color = input.color
      if (input.description !== undefined) label.description = input.description
      if (input.parentId !== undefined) label.groupId = input.parentId
      const lastSyncId = commit(w, ctx.clientId)
      return { lastSyncId, success: true, issueLabel: label }
    },

    issueLabelDelete: (_r, { id }, ctx) => {
      const w = doc()
      if (!w.labels.some((l) => l.id === id)) throw userError(`No label with id "${id}"`)
      w.labels = w.labels.filter((l) => l.id !== id)
      for (const i of w.issues) {
        if (Array.isArray(i.labelIds)) i.labelIds = i.labelIds.filter((x) => x !== id)
      }
      const lastSyncId = commit(w, ctx.clientId)
      return { lastSyncId, success: true, entityId: id }
    },
  },
}

export { doc, getMeta }
