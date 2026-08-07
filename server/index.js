// Flint auth + system-management API.
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { randomUUID, randomBytes, randomInt, createHash } from 'node:crypto'
import { db, seed } from './db.js'
import { signToken, publicUser, requireAuth, requireAdmin, hashApiKey, API_KEY_PREFIX } from './auth.js'
import { apiRouter } from './api.js'
import { graphqlRouter } from './graphql/index.js'
import { filesRouter } from './files.js'
import { setupWebsocket } from './realtime.js'
import {
  getMailConfig, publicMailConfig, saveMailConfig, sendMail, verifyMail,
  resetPasswordEmail, otpEmail,
} from './mailer.js'

seed() // idempotent: creates tables' default rows + admin on first boot

const app = express()
app.use(cors())
// Mounted before express.json() so raw upload bodies reach it untouched — a
// .json file being uploaded would otherwise be eaten by the JSON parser.
app.use('/api/files', filesRouter)
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

// ---- password reset ----
// The emailed token is random and single-use; only its sha256 is stored, and
// every response is identical whether or not the address exists — an attacker
// must not be able to probe which emails have accounts.
const RESET_TTL_MIN = Number(process.env.RESET_TTL_MIN) || 60
const resetThrottle = new Map() // email -> ms of the last accepted request

const sha256 = (s) => createHash('sha256').update(s).digest('hex')
const workspaceName = () =>
  db.prepare("SELECT value FROM workspace WHERE key = 'name'").get()?.value || 'Flint Task'

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Email is required' })
  const ok = () => res.json({ ok: true })

  const last = resetThrottle.get(email) || 0
  if (Date.now() - last < 60_000) return ok() // one mail a minute per address
  resetThrottle.set(email, Date.now())

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user || user.status === 'suspended') return ok()

  const nowIso = new Date().toISOString()
  // Requesting a new link retires any earlier one.
  db.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
    .run(nowIso, user.id)

  const token = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO password_resets (id, user_id, hash, created_at, expires_at) VALUES (?,?,?,?,?)')
    .run(randomUUID(), user.id, sha256(token), nowIso,
         new Date(Date.now() + RESET_TTL_MIN * 60_000).toISOString())

  const url = `${getMailConfig().appUrl}/reset-password?token=${token}`
  const msg = resetPasswordEmail({
    name: user.name, url, minutes: RESET_TTL_MIN, workspace: workspaceName(),
  })
  await sendMail({ to: user.email, ...msg })
  ok()
})

/** Check a token before rendering the form, so an expired link fails early. */
app.get('/api/auth/reset-password/:token', (req, res) => {
  const row = db.prepare('SELECT * FROM password_resets WHERE hash = ?').get(sha256(req.params.token))
  if (!row || row.used_at || row.expires_at < new Date().toISOString()) {
    return res.status(400).json({ valid: false, error: 'Link đã hết hạn hoặc đã dùng rồi' })
  }
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(row.user_id)
  if (!user) return res.status(400).json({ valid: false, error: 'Tài khoản không còn tồn tại' })
  // Hint at the account without exposing the whole address.
  const [name, domain] = user.email.split('@')
  res.json({ valid: true, email: `${name.slice(0, 2)}${'•'.repeat(Math.max(name.length - 2, 1))}@${domain}` })
})

app.post('/api/auth/reset-password', (req, res) => {
  const token = String(req.body?.token || '')
  const password = String(req.body?.password || '')
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const row = db.prepare('SELECT * FROM password_resets WHERE hash = ?').get(sha256(token))
  if (!row || row.used_at || row.expires_at < new Date().toISOString()) {
    return res.status(400).json({ error: 'Link đã hết hạn hoặc đã dùng rồi' })
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id)
  if (!user) return res.status(400).json({ error: 'Tài khoản không còn tồn tại' })
  if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' })

  const nowIso = new Date().toISOString()
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), user.id)
  db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(nowIso, row.id)
  // Any other live link for this account dies with the reset.
  db.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
    .run(nowIso, user.id)

  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
  res.json({ token: signToken(fresh), user: publicUser(fresh) })
})

// ---- passwordless sign-in (email OTP) ----
// A 6-digit code is emailed for both sign-in and sign-up. The request step is
// non-enumerating — it answers the same way for any valid address — and a new
// account is created at verify time if none exists yet. Only the sha256 of the
// code is stored; it is single-use, short-lived, and rate-limited by attempts.
const OTP_TTL_MIN = 10
const OTP_MAX_ATTEMPTS = 5
const otpThrottle = new Map() // email -> ms of the last accepted request

app.post('/api/auth/otp/request', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const name = String(req.body?.name || '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Nhập email hợp lệ' })
  const ok = () => res.json({ ok: true })

  const last = otpThrottle.get(email) || 0
  if (Date.now() - last < 60_000) return ok() // one code a minute per address
  otpThrottle.set(email, Date.now())

  const nowIso = new Date().toISOString()
  // Requesting a new code retires any earlier one for this address.
  db.prepare('UPDATE otp_codes SET used_at = ? WHERE email = ? AND used_at IS NULL').run(nowIso, email)

  const exists = !!db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)
  const code = String(randomInt(1_000_000)).padStart(6, '0')
  db.prepare(
    'INSERT INTO otp_codes (id, email, hash, purpose, name, created_at, expires_at) VALUES (?,?,?,?,?,?,?)',
  ).run(
    randomUUID(), email, sha256(code), exists ? 'login' : 'register', name || null,
    nowIso, new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString(),
  )

  const msg = otpEmail({
    name: name || email.split('@')[0], code, minutes: OTP_TTL_MIN, workspace: workspaceName(),
  })
  await sendMail({ to: email, ...msg })
  ok()
})

app.post('/api/auth/otp/verify', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const code = String(req.body?.code || '').trim()
  const remember = !!req.body?.remember
  if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Mã gồm 6 chữ số' })

  const row = db
    .prepare('SELECT * FROM otp_codes WHERE email = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1')
    .get(email)
  const nowIso = new Date().toISOString()
  if (!row || row.expires_at < nowIso) return res.status(400).json({ error: 'Mã đã hết hạn — xin mã mới' })
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    db.prepare('UPDATE otp_codes SET used_at = ? WHERE id = ?').run(nowIso, row.id)
    return res.status(400).json({ error: 'Nhập sai quá nhiều lần — xin mã mới' })
  }
  if (row.hash !== sha256(code)) {
    db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id)
    return res.status(400).json({ error: 'Mã không đúng' })
  }
  db.prepare('UPDATE otp_codes SET used_at = ? WHERE id = ?').run(nowIso, row.id)

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (user) {
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' })
  } else {
    // First time this address is seen — create a passwordless member account.
    // A random, undisclosed hash satisfies the NOT NULL column while making
    // password login impossible until the user deliberately sets one.
    const nm = (String(req.body?.name || row.name || '').trim() || email.split('@')[0]).slice(0, 80)
    const id = randomUUID()
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, avatar_color, role, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'member', 'active', ?)`,
    ).run(
      id, nm, email, bcrypt.hashSync(randomBytes(32).toString('hex'), 10),
      AVATAR_COLORS[nm.length % AVATAR_COLORS.length], nowIso,
    )
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  }
  res.json({ token: signToken(user, { remember }), user: publicUser(user) })
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
// ---- outgoing mail (SMTP) ----
// The password is write-only: it goes in from the console and never comes back
// out, the same way webhook signing secrets work.
app.get('/api/admin/mail', requireAuth, requireAdmin, (_req, res) => {
  res.json({ mail: publicMailConfig() })
})
app.put('/api/admin/mail', requireAuth, requireAdmin, (req, res) => {
  res.json({ mail: saveMailConfig(req.body || {}) })
})
app.post('/api/admin/mail/test', requireAuth, requireAdmin, async (req, res) => {
  const check = await verifyMail()
  if (!check.ok) return res.status(400).json({ ok: false, error: check.error })
  const to = String(req.body?.to || req.user.email).trim().toLowerCase()
  const r = await sendMail({
    to,
    subject: `Thử gửi mail từ ${workspaceName()}`,
    text: `Nếu bạn đọc được email này thì cấu hình SMTP của ${workspaceName()} đã chạy.`,
    html: `<p>Nếu bạn đọc được email này thì cấu hình SMTP của <strong>${workspaceName()}</strong> đã chạy.</p>`,
  })
  if (!r.delivered) return res.status(400).json({ ok: false, error: r.error || 'Không gửi được' })
  res.json({ ok: true, to })
})

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

/** Admin password reset. Separate from PATCH so a role edit can never carry a
 *  credential change by accident, and so this one line is easy to audit. */
app.post('/api/admin/users/:id/password', requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  const next = String(req.body?.password || '')
  if (next.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' })
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(next, 10),
    user.id,
  )
  res.json({ ok: true })
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
