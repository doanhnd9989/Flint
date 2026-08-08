// REST API for the product domain. Every route is scoped to one workspace: the
// caller's, resolved by requireWorkspace from their membership. The web app and
// these endpoints read/write the same document, so they stay consistent — but
// only ever the document the caller belongs to.
import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from './db.js'
import { requireAuth, publicUser } from './auth.js'
import { getWorkspace, saveWorkspace, getMeta } from './workspace.js'
import {
  requireWorkspace, requireWorkspaceAdmin, viewerId,
  membersOf, addMember, removeMember, membershipsFor, getWorkspaceRow,
} from './tenancy.js'
import { fireEvent } from './webhooks.js'

export const apiRouter = Router()
apiRouter.use(requireAuth, requireWorkspace)

const now = () => new Date().toISOString()
const clampLimit = (v) => Math.min(Math.max(parseInt(v, 10) || 50, 1), 250)
// Read the caller's workspace, defaulting every collection to an empty array so
// the API behaves before any client has populated the document.
function doc(req) {
  const w = getWorkspace(req.workspaceId) || {}
  for (const k of ['teams', 'states', 'labels', 'users', 'projects', 'cycles', 'issues', 'comments']) {
    if (!Array.isArray(w[k])) w[k] = []
  }
  return w
}

// ---- whole-workspace document (used by the web app to hydrate + persist) ----
apiRouter.get('/workspace', (req, res) => {
  const ws = getWorkspaceRow(req.workspaceId)
  res.json({
    workspace: getWorkspace(req.workspaceId),
    meta: getMeta(req.workspaceId),
    workspaceInfo: ws && { id: ws.id, name: ws.name, slug: ws.slug, role: req.workspaceRole },
  })
})
// Cheap endpoint clients poll to detect changes from other devices/the API.
apiRouter.get('/workspace/meta', (req, res) => res.json(getMeta(req.workspaceId)))
apiRouter.put('/workspace', (req, res) => {
  const data = req.body?.workspace ?? req.body
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'workspace must be a JSON object' })
  }
  const writer = req.get('x-client-id') || req.body?.clientId || null
  const prevIssues = (getWorkspace(req.workspaceId)?.issues) || []
  const version = saveWorkspace(req.workspaceId, data, writer)
  res.json({ ok: true, version, updatedAt: now() })
  // Diff issues so app-driven changes fire webhooks too (bounded to issues).
  try {
    const prev = new Map(prevIssues.map((i) => [i.id, i]))
    const nextIssues = Array.isArray(data.issues) ? data.issues : []
    const nextIds = new Set()
    for (const i of nextIssues) {
      nextIds.add(i.id)
      const before = prev.get(i.id)
      if (!before) fireEvent('issue', 'create', i)
      else if (before.updatedAt !== i.updatedAt) fireEvent('issue', 'update', i)
    }
    for (const i of prevIssues) if (!nextIds.has(i.id)) fireEvent('issue', 'remove', { id: i.id })
  } catch {
    /* diff is best-effort */
  }
})

// ---- reference collections ----
apiRouter.get('/teams', (req, res) => res.json({ teams: doc(req).teams }))
apiRouter.get('/workflow-states', (req, res) => {
  const states = doc(req).states.filter((s) => !req.query.teamId || s.teamId === req.query.teamId || s.teamId === undefined)
  res.json({ states })
})
apiRouter.get('/labels', (req, res) => res.json({ labels: doc(req).labels }))
apiRouter.get('/users', (req, res) => {
  // Strip nothing sensitive — these are workspace member profiles (no secrets).
  res.json({ users: doc(req).users })
})

// ---- projects ----
apiRouter.get('/projects', (req, res) => res.json({ projects: doc(req).projects }))
apiRouter.get('/projects/:id', (req, res) => {
  const p = doc(req).projects.find((x) => x.id === req.params.id)
  if (!p) return res.status(404).json({ error: 'Project not found' })
  res.json({ project: p })
})
apiRouter.post('/projects', (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'name is required' })
  const w = doc(req)
  const project = {
    id: randomUUID(),
    name,
    description: String(req.body?.description || ''),
    status: req.body?.status || 'planned',
    health: req.body?.health || 'onTrack',
    leadId: req.body?.leadId,
    targetDate: req.body?.targetDate,
    icon: req.body?.icon || '📁',
    color: req.body?.color || '#5e6ad2',
    memberIds: [],
    teamIds: req.body?.teamIds || [],
    sortOrder: w.projects.length,
    createdAt: now(),
  }
  w.projects.push(project)
  saveWorkspace(req.workspaceId, w)
  res.status(201).json({ project })
})
apiRouter.patch('/projects/:id', (req, res) => {
  const w = doc(req)
  const p = w.projects.find((x) => x.id === req.params.id)
  if (!p) return res.status(404).json({ error: 'Project not found' })
  for (const k of ['name', 'description', 'status', 'health', 'leadId', 'targetDate', 'icon', 'color']) {
    if (req.body?.[k] !== undefined) p[k] = req.body[k]
  }
  saveWorkspace(req.workspaceId, w)
  res.json({ project: p })
})
apiRouter.delete('/projects/:id', (req, res) => {
  const w = doc(req)
  const before = w.projects.length
  w.projects = w.projects.filter((x) => x.id !== req.params.id)
  if (w.projects.length === before) return res.status(404).json({ error: 'Project not found' })
  w.issues.forEach((i) => { if (i.projectId === req.params.id) i.projectId = undefined })
  saveWorkspace(req.workspaceId, w)
  res.json({ ok: true })
})

// ---- cycles ----
apiRouter.get('/cycles', (req, res) => {
  const cycles = doc(req).cycles.filter((c) => !req.query.teamId || c.teamId === req.query.teamId)
  res.json({ cycles })
})
apiRouter.post('/cycles', (req, res) => {
  const w = doc(req)
  const teamId = req.body?.teamId
  if (!teamId || !w.teams.some((t) => t.id === teamId)) return res.status(400).json({ error: 'valid teamId is required' })
  const number = req.body?.number || w.cycles.filter((c) => c.teamId === teamId).reduce((m, c) => Math.max(m, c.number || 0), 0) + 1
  const cycle = {
    id: randomUUID(), teamId, number,
    name: req.body?.name || `Cycle ${number}`,
    startsAt: req.body?.startsAt, endsAt: req.body?.endsAt,
    status: req.body?.status || 'upcoming',
  }
  w.cycles.push(cycle)
  saveWorkspace(req.workspaceId, w)
  res.status(201).json({ cycle })
})
apiRouter.patch('/cycles/:id', (req, res) => {
  const w = doc(req)
  const c = w.cycles.find((x) => x.id === req.params.id)
  if (!c) return res.status(404).json({ error: 'Cycle not found' })
  for (const k of ['name', 'startsAt', 'endsAt', 'status']) if (req.body?.[k] !== undefined) c[k] = req.body[k]
  saveWorkspace(req.workspaceId, w)
  res.json({ cycle: c })
})
apiRouter.delete('/cycles/:id', (req, res) => {
  const w = doc(req)
  const before = w.cycles.length
  w.cycles = w.cycles.filter((x) => x.id !== req.params.id)
  if (w.cycles.length === before) return res.status(404).json({ error: 'Cycle not found' })
  saveWorkspace(req.workspaceId, w)
  res.json({ ok: true })
})

// ---- issues ----
apiRouter.get('/issues', (req, res) => {
  let items = doc(req).issues
  if (req.query.includeArchived !== 'true') items = items.filter((i) => !i.archivedAt)
  for (const [param, field] of [['teamId', 'teamId'], ['stateId', 'stateId'], ['assigneeId', 'assigneeId'], ['projectId', 'projectId'], ['cycleId', 'cycleId']]) {
    if (req.query[param]) items = items.filter((i) => i[field] === req.query[param])
  }
  if (req.query.priority !== undefined) items = items.filter((i) => i.priority === (parseInt(req.query.priority, 10) || 0))
  if (req.query.q) {
    const q = String(req.query.q).toLowerCase()
    items = items.filter((i) => (i.title || '').toLowerCase().includes(q))
  }
  items = [...items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const total = items.length
  const limit = clampLimit(req.query.limit)
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)
  res.json({ issues: items.slice(offset, offset + limit), pageInfo: { total, limit, offset } })
})
apiRouter.get('/issues/:id', (req, res) => {
  const w = doc(req)
  const i = w.issues.find((x) => x.id === req.params.id || x.identifier === req.params.id)
  if (!i) return res.status(404).json({ error: 'Issue not found' })
  res.json({ issue: i })
})
apiRouter.post('/issues', (req, res) => {
  const title = String(req.body?.title || '').trim()
  if (!title) return res.status(400).json({ error: 'title is required' })
  const w = doc(req)
  const team = req.body?.teamId ? w.teams.find((t) => t.id === req.body.teamId) : w.teams[0]
  if (!team) return res.status(400).json({ error: 'no team available — populate the workspace first' })
  const stateId = req.body?.stateId
    || w.states.find((s) => s.type === 'unstarted')?.id
    || w.states[0]?.id
  if (!stateId) return res.status(400).json({ error: 'no workflow state available' })
  const number = w.issues.filter((i) => i.teamId === team.id).reduce((m, i) => Math.max(m, i.number || 0), 0) + 1
  const creatorId = viewerId(w, req.user)
  const issue = {
    id: randomUUID(), number, identifier: `${team.key}-${number}`,
    title, description: String(req.body?.description || ''),
    teamId: team.id, stateId, priority: parseInt(req.body?.priority, 10) || 0,
    assigneeId: req.body?.assigneeId, creatorId,
    labelIds: Array.isArray(req.body?.labelIds) ? req.body.labelIds : [],
    projectId: req.body?.projectId, cycleId: req.body?.cycleId, parentId: req.body?.parentId,
    estimate: req.body?.estimate, dueDate: req.body?.dueDate,
    subscriberIds: [creatorId], sortOrder: w.issues.length,
    createdAt: now(), updatedAt: now(),
  }
  w.issues.unshift(issue)
  saveWorkspace(req.workspaceId, w)
  fireEvent('issue', 'create', issue)
  res.status(201).json({ issue })
})
apiRouter.patch('/issues/:id', (req, res) => {
  const w = doc(req)
  const i = w.issues.find((x) => x.id === req.params.id || x.identifier === req.params.id)
  if (!i) return res.status(404).json({ error: 'Issue not found' })
  for (const k of ['title', 'description', 'stateId', 'priority', 'assigneeId', 'projectId', 'milestoneId', 'cycleId', 'parentId', 'estimate', 'dueDate', 'labelIds', 'archivedAt']) {
    if (req.body?.[k] !== undefined) i[k] = req.body[k]
  }
  i.updatedAt = now()
  saveWorkspace(req.workspaceId, w)
  fireEvent('issue', 'update', i)
  res.json({ issue: i })
})
apiRouter.delete('/issues/:id', (req, res) => {
  const w = doc(req)
  const before = w.issues.length
  w.issues = w.issues.filter((x) => x.id !== req.params.id && x.identifier !== req.params.id)
  if (w.issues.length === before) return res.status(404).json({ error: 'Issue not found' })
  w.comments = (w.comments || []).filter((c) => w.issues.some((i) => i.id === c.issueId))
  saveWorkspace(req.workspaceId, w)
  fireEvent('issue', 'remove', { id: req.params.id })
  res.json({ ok: true })
})

// ---- comments ----
apiRouter.get('/issues/:id/comments', (req, res) => {
  const w = doc(req)
  const issue = w.issues.find((x) => x.id === req.params.id || x.identifier === req.params.id)
  if (!issue) return res.status(404).json({ error: 'Issue not found' })
  res.json({ comments: (w.comments || []).filter((c) => c.issueId === issue.id) })
})
apiRouter.post('/issues/:id/comments', (req, res) => {
  const w = doc(req)
  const issue = w.issues.find((x) => x.id === req.params.id || x.identifier === req.params.id)
  if (!issue) return res.status(404).json({ error: 'Issue not found' })
  const body = String(req.body?.body || '').trim()
  if (!body) return res.status(400).json({ error: 'body is required' })
  const comment = {
    id: randomUUID(), issueId: issue.id, body,
    authorId: viewerId(w, req.user), createdAt: now(),
  }
  if (!Array.isArray(w.comments)) w.comments = []
  w.comments.push(comment)
  saveWorkspace(req.workspaceId, w)
  fireEvent('comment', 'create', comment)
  res.status(201).json({ comment })
})

// ---- workspace membership ----
// Who can see this workspace's data. Distinct from the document's `users`
// array, which is the product-level roster (and keeps former members so their
// past assignments still render). This list is the access control.
apiRouter.get('/workspace/members', (req, res) => {
  const members = membersOf(req.workspaceId).map((u) => ({
    ...publicUser(u), workspaceRole: u.workspace_role, joinedAt: u.joined_at,
  }))
  res.json({ members })
})

/** Every workspace the caller belongs to — the data behind a workspace switcher. */
apiRouter.get('/workspaces', (req, res) => {
  const workspaces = membershipsFor(req.user.id).map((m) => ({
    id: m.workspace_id, name: m.name, slug: m.slug, role: m.role,
  }))
  res.json({ workspaces, currentId: req.workspaceId })
})

/** Invite an existing account into this workspace. */
apiRouter.post('/workspace/members', requireWorkspaceAdmin, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const role = String(req.body?.role || 'member')
  if (!email) return res.status(400).json({ error: 'email is required' })
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user) {
    return res.status(404).json({ error: 'No account with that email yet — ask them to sign up first' })
  }
  addMember(req.workspaceId, user, role)
  res.status(201).json({ member: { ...publicUser(user), workspaceRole: role } })
})

apiRouter.delete('/workspace/members/:userId', requireWorkspaceAdmin, (req, res) => {
  const ws = getWorkspaceRow(req.workspaceId)
  if (ws?.owner_id === req.params.userId) {
    return res.status(400).json({ error: 'The workspace owner cannot be removed' })
  }
  if (!removeMember(req.workspaceId, req.params.userId)) {
    return res.status(404).json({ error: 'Not a member of this workspace' })
  }
  res.json({ ok: true })
})
