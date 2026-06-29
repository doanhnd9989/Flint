// JWT + bcrypt helpers and Express middleware.
import jwt from 'jsonwebtoken'
import { db } from './db.js'

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

/** Populates req.user from the Bearer token; 401 if missing/invalid/suspended. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub)
    if (!user) return res.status(401).json({ error: 'Account no longer exists' })
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/** Must run after requireAuth. 403 unless the user is an admin. */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}
