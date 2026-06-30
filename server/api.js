// REST API for the product domain (issues, projects, cycles, teams, labels,
// workflow states, comments). All routes require a Bearer token (any role).
// Mounted at /api by index.js.
import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from './db.js'
import { seedDomain } from './domain.js'
import { requireAuth, publicUser } from './auth.js'

seedDomain()

export const apiRouter = Router()
apiRouter.use(requireAuth)

const now = () => new Date().toISOString()
const clampLimit = (v) => Math.min(Math.max(parseInt(v, 10) || 50, 1), 250)

// ---- serializers (snake_case row → camelCase resource) ----
const mapTeam = (r) => ({ id: r.id, key: r.key, name: r.name, icon: r.icon, color: r.color })
const mapState = (r) => ({ id: r.id, teamId: r.team_id, name: r.name, type: r.type, color: r.color, position: r.position })
const mapLabel = (r) => ({ id: r.id, name: r.name, color: r.color })
const mapProject = (r) => ({
  id: r.id, name: r.name, description: r.description, status: r.status, health: r.health,
  leadId: r.lead_id, targetDate: r.target_date, icon: r.icon, color: r.color, createdAt: r.created_at,
})
const mapCycle = (r) => ({
  id: r.id, teamId: r.team_id, number: r.number, name: r.name,
  startsAt: r.starts_at, endsAt: r.ends_at, status: r.status,
})
const labelIdsFor = (issueId) =>
  db.prepare('SELECT label_id FROM issue_labels WHERE issue_id = ?').all(issueId).map((x) => x.label_id)
const mapIssue = (r) => ({
  id: r.id, identifier: r.identifier, number: r.number, teamId: r.team_id,
  title: r.title, description: r.description, stateId: r.state_id, priority: r.priority,
  assigneeId: r.assignee_id, projectId: r.project_id, cycleId: r.cycle_id, parentId: r.parent_id,
  estimate: r.estimate, dueDate: r.due_date, labelIds: labelIdsFor(r.id),
  createdAt: r.created_at, updatedAt: r.updated_at, archivedAt: r.archived_at,
})
const mapComment = (r) => ({ id: r.id, issueId: r.issue_id, authorId: r.author_id, body: r.body, createdAt: r.created_at })

// ---- reference resources ----
apiRouter.get('/teams', (_req, res) => res.json({ teams: db.prepare('SELECT * FROM teams ORDER BY key').all().map(mapTeam) }))
apiRouter.get('/workflow-states', (req, res) => {
  const rows = req.query.teamId
    ? db.prepare('SELECT * FROM workflow_states WHERE team_id = ? ORDER BY position').all(req.query.teamId)
    : db.prepare('SELECT * FROM workflow_states ORDER BY position').all()
  res.json({ states: rows.map(mapState) })
})
apiRouter.get('/labels', (_req, res) => res.json({ labels: db.prepare('SELECT * FROM labels ORDER BY name').all().map(mapLabel) }))
apiRouter.get('/users', (_req, res) => res.json({ users: db.prepare('SELECT * FROM users ORDER BY created_at').all().map(publicUser) }))

// ---- projects ----
apiRouter.get('/projects', (_req, res) => res.json({ projects: db.prepare('SELECT * FROM projects ORDER BY created_at').all().map(mapProject) }))
apiRouter.get('/projects/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Project not found' })
  res.json({ project: mapProject(r) })
})
apiRouter.post('/projects', (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'name is required' })
  const id = randomUUID()
  db.prepare(`INSERT INTO projects (id,name,description,status,health,lead_id,target_date,icon,color,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    id, name, String(req.body?.description || ''), req.body?.status || 'planned',
    req.body?.health || 'onTrack', req.body?.leadId || null, req.body?.targetDate || null,
    req.body?.icon || '', req.body?.color || '#5e6ad2', now(),
  )
  res.status(201).json({ project: mapProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(id)) })
})
apiRouter.patch('/projects/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Project not found' })
  const f = req.body || {}
  db.prepare('UPDATE projects SET name=?,description=?,status=?,health=?,lead_id=?,target_date=?,icon=?,color=? WHERE id=?').run(
    f.name ?? r.name, f.description ?? r.description, f.status ?? r.status, f.health ?? r.health,
    f.leadId ?? r.lead_id, f.targetDate ?? r.target_date, f.icon ?? r.icon, f.color ?? r.color, req.params.id,
  )
  res.json({ project: mapProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)) })
})
apiRouter.delete('/projects/:id', (req, res) => {
  const info = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  if (!info.changes) return res.status(404).json({ error: 'Project not found' })
  res.json({ ok: true })
})

// ---- cycles ----
apiRouter.get('/cycles', (req, res) => {
  const rows = req.query.teamId
    ? db.prepare('SELECT * FROM cycles WHERE team_id = ? ORDER BY number').all(req.query.teamId)
    : db.prepare('SELECT * FROM cycles ORDER BY number').all()
  res.json({ cycles: rows.map(mapCycle) })
})
apiRouter.post('/cycles', (req, res) => {
  const teamId = req.body?.teamId
  if (!teamId || !db.prepare('SELECT 1 FROM teams WHERE id = ?').get(teamId)) {
    return res.status(400).json({ error: 'valid teamId is required' })
  }
  const max = db.prepare('SELECT COALESCE(MAX(number),0) AS m FROM cycles WHERE team_id = ?').get(teamId).m
  const id = randomUUID()
  const number = req.body?.number || max + 1
  db.prepare('INSERT INTO cycles (id,team_id,number,name,starts_at,ends_at,status) VALUES (?,?,?,?,?,?,?)').run(
    id, teamId, number, req.body?.name || `Cycle ${number}`, req.body?.startsAt || null, req.body?.endsAt || null, req.body?.status || 'upcoming',
  )
  res.status(201).json({ cycle: mapCycle(db.prepare('SELECT * FROM cycles WHERE id = ?').get(id)) })
})
apiRouter.patch('/cycles/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM cycles WHERE id = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Cycle not found' })
  const f = req.body || {}
  db.prepare('UPDATE cycles SET name=?,starts_at=?,ends_at=?,status=? WHERE id=?').run(
    f.name ?? r.name, f.startsAt ?? r.starts_at, f.endsAt ?? r.ends_at, f.status ?? r.status, req.params.id,
  )
  res.json({ cycle: mapCycle(db.prepare('SELECT * FROM cycles WHERE id = ?').get(req.params.id)) })
})
apiRouter.delete('/cycles/:id', (req, res) => {
  const info = db.prepare('DELETE FROM cycles WHERE id = ?').run(req.params.id)
  if (!info.changes) return res.status(404).json({ error: 'Cycle not found' })
  res.json({ ok: true })
})

// ---- issues (list with filtering + pagination) ----
apiRouter.get('/issues', (req, res) => {
  const where = []
  const args = []
  for (const [param, col] of [['teamId', 'team_id'], ['stateId', 'state_id'], ['assigneeId', 'assignee_id'], ['projectId', 'project_id'], ['cycleId', 'cycle_id']]) {
    if (req.query[param]) { where.push(`${col} = ?`); args.push(req.query[param]) }
  }
  if (req.query.priority !== undefined) { where.push('priority = ?'); args.push(parseInt(req.query.priority, 10) || 0) }
  if (req.query.q) { where.push('title LIKE ?'); args.push(`%${req.query.q}%`) }
  if (req.query.includeArchived !== 'true') where.push('archived_at IS NULL')
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const limit = clampLimit(req.query.limit)
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)
  const total = db.prepare(`SELECT COUNT(*) AS n FROM issues ${clause}`).get(...args).n
  const rows = db.prepare(`SELECT * FROM issues ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, limit, offset)
  res.json({ issues: rows.map(mapIssue), pageInfo: { total, limit, offset } })
})
apiRouter.get('/issues/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id)
    || db.prepare('SELECT * FROM issues WHERE identifier = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Issue not found' })
  res.json({ issue: mapIssue(r) })
})
apiRouter.post('/issues', (req, res) => {
  const title = String(req.body?.title || '').trim()
  if (!title) return res.status(400).json({ error: 'title is required' })
  const team = req.body?.teamId
    ? db.prepare('SELECT * FROM teams WHERE id = ?').get(req.body.teamId)
    : db.prepare('SELECT * FROM teams ORDER BY key LIMIT 1').get()
  if (!team) return res.status(400).json({ error: 'no team available' })
  const stateId = req.body?.stateId
    || db.prepare("SELECT id FROM workflow_states WHERE team_id = ? AND type='unstarted' ORDER BY position LIMIT 1").get(team.id)?.id
    || db.prepare('SELECT id FROM workflow_states ORDER BY position LIMIT 1').get()?.id
  if (!stateId) return res.status(400).json({ error: 'no workflow state available' })

  const number = team.issue_counter + 1
  const id = randomUUID()
  const ts = now()
  db.prepare(`INSERT INTO issues
    (id,team_id,identifier,number,title,description,state_id,priority,assignee_id,project_id,cycle_id,parent_id,estimate,due_date,created_at,updated_at,archived_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`).run(
    id, team.id, `${team.key}-${number}`, number, title, String(req.body?.description || ''),
    stateId, parseInt(req.body?.priority, 10) || 0, req.body?.assigneeId || null,
    req.body?.projectId || null, req.body?.cycleId || null, req.body?.parentId || null,
    req.body?.estimate ?? null, req.body?.dueDate || null, ts, ts,
  )
  db.prepare('UPDATE teams SET issue_counter = ? WHERE id = ?').run(number, team.id)
  if (Array.isArray(req.body?.labelIds)) {
    const insIL = db.prepare('INSERT OR IGNORE INTO issue_labels (issue_id,label_id) VALUES (?,?)')
    req.body.labelIds.forEach((lid) => insIL.run(id, lid))
  }
  res.status(201).json({ issue: mapIssue(db.prepare('SELECT * FROM issues WHERE id = ?').get(id)) })
})
apiRouter.patch('/issues/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Issue not found' })
  const f = req.body || {}
  db.prepare(`UPDATE issues SET title=?,description=?,state_id=?,priority=?,assignee_id=?,project_id=?,cycle_id=?,estimate=?,due_date=?,archived_at=?,updated_at=? WHERE id=?`).run(
    f.title ?? r.title, f.description ?? r.description, f.stateId ?? r.state_id,
    f.priority ?? r.priority, f.assigneeId ?? r.assignee_id, f.projectId ?? r.project_id,
    f.cycleId ?? r.cycle_id, f.estimate ?? r.estimate, f.dueDate ?? r.due_date,
    f.archivedAt ?? r.archived_at, now(), req.params.id,
  )
  if (Array.isArray(f.labelIds)) {
    db.prepare('DELETE FROM issue_labels WHERE issue_id = ?').run(req.params.id)
    const insIL = db.prepare('INSERT OR IGNORE INTO issue_labels (issue_id,label_id) VALUES (?,?)')
    f.labelIds.forEach((lid) => insIL.run(req.params.id, lid))
  }
  res.json({ issue: mapIssue(db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id)) })
})
apiRouter.delete('/issues/:id', (req, res) => {
  const info = db.prepare('DELETE FROM issues WHERE id = ?').run(req.params.id)
  if (!info.changes) return res.status(404).json({ error: 'Issue not found' })
  db.prepare('DELETE FROM issue_labels WHERE issue_id = ?').run(req.params.id)
  db.prepare('DELETE FROM comments WHERE issue_id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ---- comments ----
apiRouter.get('/issues/:id/comments', (req, res) => {
  if (!db.prepare('SELECT 1 FROM issues WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Issue not found' })
  res.json({ comments: db.prepare('SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at').all(req.params.id).map(mapComment) })
})
apiRouter.post('/issues/:id/comments', (req, res) => {
  if (!db.prepare('SELECT 1 FROM issues WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Issue not found' })
  const body = String(req.body?.body || '').trim()
  if (!body) return res.status(400).json({ error: 'body is required' })
  const id = randomUUID()
  db.prepare('INSERT INTO comments (id,issue_id,author_id,body,created_at) VALUES (?,?,?,?,?)').run(id, req.params.id, req.user.id, body, now())
  res.status(201).json({ comment: mapComment(db.prepare('SELECT * FROM comments WHERE id = ?').get(id)) })
})
