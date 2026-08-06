// Flint auth + system-management API.
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { randomUUID, randomBytes } from 'node:crypto'
import { db, seed } from './db.js'
import { signToken, publicUser, requireAuth, requireAdmin, hashApiKey, API_KEY_PREFIX } from './auth.js'
import { apiRouter } from './api.js'
import { graphqlRouter } from './graphql/index.js'
import { setupWebsocket } from './realtime.js'

seed() // idempotent: creates tables' default rows + admin on first boot

const app = express()
app.use(cors())
app.use(express.json())

const ROLES = ['admin', 'member', 'guest']

// ---- health ----
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ---- auth ----
app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' })

  res.json({ token: signToken(user), user: publicUser(user) })
})

const AVATAR_COLORS = ['#5e6ad2', '#4cb782', '#f2994a', '#eb5da8', '#4ea7fc', '#d4b13f']

// Public self-service registration. New accounts are active members and are
// signed in immediately (returns a token).
app.post('/api/auth/register', (req, res) => {
  const name = String(req.body?.name || '').trim()
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'An account with that email already exists' })
  }
  const id = randomUUID()
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, avatar_color, role, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'member', 'active', ?)`,
  ).run(id, name, email, bcrypt.hashSync(password, 10), AVATAR_COLORS[name.length % AVATAR_COLORS.length], new Date().toISOString())
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  res.status(201).json({ token: signToken(user), user: publicUser(user) })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const current = String(req.body?.currentPassword || '')
  const next = String(req.body?.newPassword || '')
  if (next.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })
  if (!bcrypt.compareSync(current, req.user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' })
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.user.id)
  res.json({ ok: true })
})

// ---- personal API keys (Linear-style) ----
app.get('/api/auth/api-keys', requireAuth, (req, res) => {
  const keys = db
    .prepare('SELECT id, name, prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id)
    .map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, createdAt: k.created_at, lastUsedAt: k.last_used_at }))
  res.json({ keys })
})

app.post('/api/auth/api-keys', requireAuth, (req, res) => {
  const name = String(req.body?.name || '').trim() || 'API key'
  const key = API_KEY_PREFIX + randomBytes(24).toString('hex')
  const id = randomUUID()
  const prefix = key.slice(0, 12)
  db.prepare('INSERT INTO api_keys (id, user_id, name, prefix, hash, created_at) VALUES (?,?,?,?,?,?)').run(
    id, req.user.id, name, prefix, hashApiKey(key), new Date().toISOString(),
  )
  // The full key is returned ONCE — it is never retrievable again.
  res.status(201).json({ key, apiKey: { id, name, prefix, createdAt: new Date().toISOString(), lastUsedAt: null } })
})

app.delete('/api/auth/api-keys/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  if (!info.changes) return res.status(404).json({ error: 'API key not found' })
  res.json({ ok: true })
})

// ---- webhooks (admin-managed outgoing integrations) ----
const maskSecret = (s) => `whsec_…${s.slice(-6)}`
app.get('/api/admin/webhooks', requireAuth, requireAdmin, (_req, res) => {
  const hooks = db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all().map((w) => ({
    id: w.id, url: w.url, events: w.events, enabled: !!w.enabled,
    secretHint: maskSecret(w.secret), createdAt: w.created_at,
    lastStatus: w.last_status, lastAt: w.last_at,
  }))
  res.json({ webhooks: hooks })
})
app.post('/api/admin/webhooks', requireAuth, requireAdmin, (req, res) => {
  const url = String(req.body?.url || '').trim()
  if (!/^https?:\/\/.+/.test(url)) return res.status(400).json({ error: 'A valid http(s) URL is required' })
  const events = String(req.body?.events || 'all').trim() || 'all'
  const id = randomUUID()
  const secret = 'whsec_' + randomBytes(24).toString('hex')
  db.prepare('INSERT INTO webhooks (id, url, secret, events, enabled, created_at) VALUES (?,?,?,?,1,?)').run(
    id, url, secret, events, new Date().toISOString(),
  )
  // Secret returned once so the admin can configure signature verification.
  res.status(201).json({ webhook: { id, url, events, enabled: true, createdAt: new Date().toISOString() }, secret })
})
app.patch('/api/admin/webhooks/:id', requireAuth, requireAdmin, (req, res) => {
  const w = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id)
  if (!w) return res.status(404).json({ error: 'Webhook not found' })
  const enabled = req.body?.enabled ? 1 : 0
  db.prepare('UPDATE webhooks SET enabled = ? WHERE id = ?').run(enabled, req.params.id)
  res.json({ id: req.params.id, enabled: !!enabled })
})
app.delete('/api/admin/webhooks/:id', requireAuth, requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM webhooks WHERE id = ?').run(req.params.id)
  if (!info.changes) return res.status(404).json({ error: 'Webhook not found' })
  res.json({ ok: true })
})

// ---- public config (read-only, used by landing/login + app boot) ----
app.get('/api/config', (_req, res) => {
  const workspace = Object.fromEntries(
    db.prepare('SELECT key, value FROM workspace').all().map((r) => [r.key, r.value]),
  )
  const flags = db
    .prepare('SELECT key, label, description, enabled, position FROM feature_flags ORDER BY position')
    .all()
    .map((f) => ({ ...f, enabled: !!f.enabled }))
  res.json({ workspace, flags })
})

// ---- admin: feature flags ----
app.get('/api/admin/flags', requireAuth, requireAdmin, (_req, res) => {
  const flags = db
    .prepare('SELECT key, label, description, enabled, position FROM feature_flags ORDER BY position')
    .all()
    .map((f) => ({ ...f, enabled: !!f.enabled }))
  res.json({ flags })
})

app.patch('/api/admin/flags/:key', requireAuth, requireAdmin, (req, res) => {
  const flag = db.prepare('SELECT * FROM feature_flags WHERE key = ?').get(req.params.key)
  if (!flag) return res.status(404).json({ error: 'Unknown flag' })
  const enabled = req.body?.enabled ? 1 : 0
  db.prepare('UPDATE feature_flags SET enabled = ? WHERE key = ?').run(enabled, req.params.key)
  res.json({ key: req.params.key, enabled: !!enabled })
})

// ---- admin: workspace config ----
app.patch('/api/admin/workspace', requireAuth, requireAdmin, (req, res) => {
  const allowed = ['name', 'tagline', 'accentColor']
  const upsert = db.prepare(
    'INSERT INTO workspace (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  )
  for (const key of allowed) {
    if (typeof req.body?.[key] === 'string') upsert.run(key, req.body[key])
  }
  const workspace = Object.fromEntries(
    db.prepare('SELECT key, value FROM workspace').all().map((r) => [r.key, r.value]),
  )
  res.json({ workspace })
})

// ---- admin: users ----
app.get('/api/admin/users', requireAuth, requireAdmin, (_req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at').all().map(publicUser)
  res.json({ users })
})

app.post('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const name = String(req.body?.name || '').trim()
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const role = ROLES.includes(req.body?.role) ? req.body.role : 'member'
  if (!name || !email || password.length < 6) {
    return res.status(400).json({ error: 'Name, email and a 6+ char password are required' })
  }
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'A user with that email already exists' })
  }
  const id = randomUUID()
  const colors = ['#5e6ad2', '#4cb782', '#f2994a', '#eb5da8', '#4ea7fc', '#d4b13f']
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, avatar_color, role, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
  ).run(id, name, email, bcrypt.hashSync(password, 10), colors[Math.floor(name.length % colors.length)], role, new Date().toISOString())
  res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) })
})

app.patch('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const role = ROLES.includes(req.body?.role) ? req.body.role : user.role
  const status = ['active', 'suspended'].includes(req.body?.status) ? req.body.status : user.status

  // Guard: never strip the last active admin of their access.
  const activeAdmins = db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'")
    .get().n
  const losingAdmin =
    user.role === 'admin' && user.status === 'active' && (role !== 'admin' || status !== 'active')
  if (losingAdmin && activeAdmins <= 1) {
    return res.status(400).json({ error: 'Cannot demote or suspend the last active admin' })
  }

  db.prepare('UPDATE users SET role = ?, status = ? WHERE id = ?').run(role, status, req.params.id)
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)) })
})

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  if (user.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' })
  const activeAdmins = db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'")
    .get().n
  if (user.role === 'admin' && user.status === 'active' && activeAdmins <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last active admin' })
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// GraphQL API, shaped after Linear's (see graphql/schema.js). Mounted at the
// same path Linear uses so a client only has to swap the host.
app.use('/graphql', graphqlRouter)

// Product domain REST API (issues, projects, cycles, …) — mounted after the
// auth/admin routes so those specific paths win.
app.use('/api', apiRouter)

const PORT = process.env.PORT || 3001
const server = app.listen(PORT, () => console.log(`Flint API listening on :${PORT}`))
setupWebsocket(server)
