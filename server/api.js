// REST API for the product domain, backed by the single workspace document
// (workspace.js). The web app and these endpoints read/write the same document,
// so they stay perfectly consistent. All routes require a Bearer token.
import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { requireAuth } from './auth.js'
import { getWorkspace, saveWorkspace, getMeta } from './workspace.js'

export const apiRouter = Router()
apiRouter.use(requireAuth)

const now = () => new Date().toISOString()
const clampLimit = (v) => Math.min(Math.max(parseInt(v, 10) || 50, 1), 250)
// Read the workspace, defaulting every collection to an empty array so the API
// behaves before any client has populated the document.
function doc() {
  const w = getWorkspace() || {}
  for (const k of ['teams', 'states', 'labels', 'users', 'projects', 'cycles', 'issues', 'comments']) {
    if (!Array.isArray(w[k])) w[k] = []
  }
  return w
}

// ---- whole-workspace document (used by the web app to hydrate + persist) ----
apiRouter.get('/workspace', (_req, res) => {
  res.json({ workspace: getWorkspace(), meta: getMeta() })
})
// Cheap endpoint clients poll to detect changes from other devices/the API.
apiRouter.get('/workspace/meta', (_req, res) => res.json(getMeta()))
apiRouter.put('/workspace', (req, res) => {
  const data = req.body?.workspace ?? req.body
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'workspace must be a JSON object' })
  }
  const writer = req.get('x-client-id') || req.body?.clientId || null
  const version = saveWorkspace(data, writer)
  res.json({ ok: true, version, updatedAt: now() })
})

// ---- reference collections ----
apiRouter.get('/teams', (_req, res) => res.json({ teams: doc().teams }))
apiRouter.get('/workflow-states', (req, res) => {
  const states = doc().states.filter((s) => !req.query.teamId || s.teamId === req.query.teamId || s.teamId === undefined)
  res.json({ states })
})
apiRouter.get('/labels', (_req, res) => res.json({ labels: doc().labels }))
apiRouter.get('/users', (_req, res) => {
  // Strip nothing sensitive — these are workspace member profiles (no secrets).
  res.json({ users: doc().users })
})

// ---- projects ----
apiRouter.get('/projects', (_req, res) => res.json({ projects: doc().projects }))
apiRouter.get('/projects/:id', (req, res) => {
  const p = doc().projects.find((x) => x.id === req.params.id)
  if (!p) return res.status(404).json({ error: 'Project not found' })
  res.json({ project: p })
})
apiRouter.post('/projects', (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'name is required' })
  const w = doc()
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
  saveWorkspace(w)
  res.status(201).json({ project })
})
apiRouter.patch('/projects/:id', (req, res) => {
  const w = doc()
  const p = w.projects.find((x) => x.id === req.params.id)
  if (!p) return res.status(404).json({ error: 'Project not found' })
  for (const k of ['name', 'description', 'status', 'health', 'leadId', 'targetDate', 'icon', 'color']) {
    if (req.body?.[k] !== undefined) p[k] = req.body[k]
  }
  saveWorkspace(w)
  res.json({ project: p })
})
apiRouter.delete('/projects/:id', (req, res) => {
  const w = doc()
  const before = w.projects.length
  w.projects = w.projects.filter((x) => x.id !== req.params.id)
  if (w.projects.length === before) return res.status(404).json({ error: 'Project not found' })
  w.issues.forEach((i) => { if (i.projectId === req.params.id) i.projectId = undefined })
  saveWorkspace(w)
  res.json({ ok: true })
})

// ---- cycles ----
apiRouter.get('/cycles', (req, res) => {
  const cycles = doc().cycles.filter((c) => !req.query.teamId || c.teamId === req.query.teamId)
  res.json({ cycles })
})
apiRouter.post('/cycles', (req, res) => {
  const w = doc()
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
  saveWorkspace(w)
  res.status(201).json({ cycle })
})
apiRouter.patch('/cycles/:id', (req, res) => {
  const w = doc()
  const c = w.cycles.find((x) => x.id === req.params.id)
  if (!c) return res.status(404).json({ error: 'Cycle not found' })
  for (const k of ['name', 'startsAt', 'endsAt', 'status']) if (req.body?.[k] !== undefined) c[k] = req.body[k]
  saveWorkspace(w)
  res.json({ cycle: c })
})
apiRouter.delete('/cycles/:id', (req, res) => {
  const w = doc()
  const before = w.cycles.length
  w.cycles = w.cycles.filter((x) => x.id !== req.params.id)
  if (w.cycles.length === before) return res.status(404).json({ error: 'Cycle not found' })
  saveWorkspace(w)
  res.json({ ok: true })
})

// ---- issues ----
apiRouter.get('/issues', (req, res) => {
  let items = doc().issues
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
  const w = doc()
  const i = w.issues.find((x) => x.id === req.params.id || x.identifier === req.params.id)
  if (!i) return res.status(404).json({ error: 'Issue not found' })
  res.json({ issue: i })
})
apiRouter.post('/issues', (req, res) => {
  const title = String(req.body?.title || '').trim()
  if (!title) return res.status(400).json({ error: 'title is required' })
  const w = doc()
  const team = req.body?.teamId ? w.teams.find((t) => t.id === req.body.teamId) : w.teams[0]
  if (!team) return res.status(400).json({ error: 'no team available — populate the workspace first' })
  const stateId = req.body?.stateId
    || w.states.find((s) => s.type === 'unstarted')?.id
    || w.states[0]?.id
  if (!stateId) return res.status(400).json({ error: 'no workflow state available' })
  const number = w.issues.filter((i) => i.teamId === team.id).reduce((m, i) => Math.max(m, i.number || 0), 0) + 1
  const creatorId = w.currentUserId || req.user.id
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
  saveWorkspace(w)
  res.status(201).json({ issue })
})
apiRouter.patch('/issues/:id', (req, res) => {
  const w = doc()
  const i = w.issues.find((x) => x.id === req.params.id || x.identifier === req.params.id)
  if (!i) return res.status(404).json({ error: 'Issue not found' })
  for (const k of ['title', 'description', 'stateId', 'priority', 'assigneeId', 'projectId', 'milestoneId', 'cycleId', 'parentId', 'estimate', 'dueDate', 'labelIds', 'archivedAt']) {
    if (req.body?.[k] !== undefined) i[k] = req.body[k]
  }
  i.updatedAt = now()
  saveWorkspace(w)
  res.json({ issue: i })
})
apiRouter.delete('/issues/:id', (req, res) => {
  const w = doc()
  const before = w.issues.length
  w.issues = w.issues.filter((x) => x.id !== req.params.id && x.identifier !== req.params.id)
  if (w.issues.length === before) return res.status(404).json({ error: 'Issue not found' })
  w.comments = (w.comments || []).filter((c) => w.issues.some((i) => i.id === c.issueId))
  saveWorkspace(w)
  res.json({ ok: true })
})

// ---- comments ----
apiRouter.get('/issues/:id/comments', (req, res) => {
  const w = doc()
  const issue = w.issues.find((x) => x.id === req.params.id || x.identifier === req.params.id)
  if (!issue) return res.status(404).json({ error: 'Issue not found' })
  res.json({ comments: (w.comments || []).filter((c) => c.issueId === issue.id) })
})
apiRouter.post('/issues/:id/comments', (req, res) => {
  const w = doc()
  const issue = w.issues.find((x) => x.id === req.params.id || x.identifier === req.params.id)
  if (!issue) return res.status(404).json({ error: 'Issue not found' })
  const body = String(req.body?.body || '').trim()
  if (!body) return res.status(400).json({ error: 'body is required' })
  const comment = {
    id: randomUUID(), issueId: issue.id, body,
    authorId: w.currentUserId || req.user.id, createdAt: now(),
  }
  if (!Array.isArray(w.comments)) w.comments = []
  w.comments.push(comment)
  saveWorkspace(w)
  res.status(201).json({ comment })
})
