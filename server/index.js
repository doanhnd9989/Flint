// Flint auth + system-management API.
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { db, seed } from './db.js'
import { signToken, publicUser, requireAuth, requireAdmin } from './auth.js'
import { apiRouter } from './api.js'

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

// Product domain REST API (issues, projects, cycles, …) — mounted after the
// auth/admin routes so those specific paths win.
app.use('/api', apiRouter)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Flint API listening on :${PORT}`))
