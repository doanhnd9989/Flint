// JWT + bcrypt helpers and Express middleware.
import jwt from 'jsonwebtoken'
import { createHash } from 'node:crypto'
import { db } from './db.js'

export const API_KEY_PREFIX = 'flint_'
export function hashApiKey(key) {
  return createHash('sha256').update(key).digest('hex')
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me'
const JWT_TTL = '7d'

if (!process.env.JWT_SECRET) {
  console.warn('[auth] JWT_SECRET not set — using insecure dev secret. Set it in production.')
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_TTL })
}

/** Strip the password hash before sending a user to the client. */
export function publicUser(u) {
  if (!u) return null
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarColor: u.avatar_color,
    role: u.role,
    status: u.status,
    createdAt: u.created_at,
  }
}

/**
 * Populates req.user from the Authorization header — accepts either a JWT
 * (from login) or a personal API key (`flint_…`). 401 if missing/invalid,
 * 403 if the account is suspended.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  let user
  if (token.startsWith(API_KEY_PREFIX)) {
    const row = db.prepare('SELECT * FROM api_keys WHERE hash = ?').get(hashApiKey(token))
    if (!row) return res.status(401).json({ error: 'Invalid API key' })
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id)
    if (user) db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), row.id)
  } else {
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub)
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
  }
  if (!user) return res.status(401).json({ error: 'Account no longer exists' })
  if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' })
  req.user = user
  next()
}

/** Resolve a user from a raw token (JWT or API key). Returns null if invalid or
 *  suspended. Used for non-Express contexts like the WebSocket handshake. */
export function verifyToken(token) {
  if (!token) return null
  let user
  if (token.startsWith(API_KEY_PREFIX)) {
    const row = db.prepare('SELECT * FROM api_keys WHERE hash = ?').get(hashApiKey(token))
    if (!row) return null
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id)
  } else {
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub)
    } catch {
      return null
    }
  }
  if (!user || user.status === 'suspended') return null
  return user
}

/** Must run after requireAuth. 403 unless the user is an admin. */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}
