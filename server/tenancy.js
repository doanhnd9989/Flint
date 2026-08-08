// Workspaces (tenants) and membership. This is the access-control layer that
// decides *which* document a request is allowed to touch.
//
// A user belongs to one or more workspaces through `workspace_members`. Every
// authenticated product request resolves to exactly one workspace id, and the
// storage layer (workspace.js) refuses to run without one.
import { randomUUID } from 'node:crypto'
import { db } from './db.js'
import {
  getWorkspace, saveWorkspace, hasWorkspace, deleteWorkspaceDoc,
  legacyWorkspaceDoc, dropLegacyWorkspaceDoc,
} from './workspace.js'
import { starterWorkspace, defaultWorkspaceName, memberFromUser } from './starterWorkspace.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    owner_id   TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Role here is workspace-scoped and separate from users.role (which governs
  -- the system/admin console). owner is the account that created the workspace.
  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'member',  -- owner | admin | member | guest
    created_at   TEXT NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_ws_members_user ON workspace_members (user_id);
`)

export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'guest']

function slugify(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'workspace'
  let slug = base
  let n = 1
  while (db.prepare('SELECT 1 FROM workspaces WHERE slug = ?').get(slug)) slug = `${base}-${++n}`
  return slug
}

/** Create a workspace, its owner membership and its starter document. */
export function createWorkspace(user, name) {
  const wsName = name || defaultWorkspaceName(user)
  const id = randomUUID()
  const at = new Date().toISOString()
  db.prepare('INSERT INTO workspaces (id, name, slug, owner_id, created_at) VALUES (?,?,?,?,?)')
    .run(id, wsName, slugify(wsName), user.id, at)
  db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?,?,?,?)')
    .run(id, user.id, 'owner', at)
  saveWorkspace(id, starterWorkspace(user, wsName), 'system')
  return getWorkspaceRow(id)
}

export function getWorkspaceRow(id) {
  return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) || null
}

export function membershipsFor(userId) {
  return db
    .prepare(
      `SELECT m.workspace_id, m.role, w.name, w.slug, w.owner_id, m.created_at
       FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.user_id = ? ORDER BY m.created_at`,
    )
    .all(userId)
}

export function membership(workspaceId, userId) {
  return db
    .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
    .get(workspaceId, userId) || null
}

export function membersOf(workspaceId) {
  return db
    .prepare(
      `SELECT u.*, m.role AS workspace_role, m.created_at AS joined_at
       FROM workspace_members m JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = ? ORDER BY m.created_at`,
    )
    .all(workspaceId)
}

/**
 * Add a user to a workspace and mirror them into the product document's member
 * list, so the app shows them without waiting for a client write.
 */
export function addMember(workspaceId, user, role = 'member') {
  db.prepare(
    `INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?,?,?,?)
     ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role`,
  ).run(workspaceId, user.id, WORKSPACE_ROLES.includes(role) ? role : 'member', new Date().toISOString())

  const w = getWorkspace(workspaceId)
  if (w) {
    if (!Array.isArray(w.users)) w.users = []
    const existing = w.users.find((u) => u.id === user.id)
    if (existing) Object.assign(existing, memberFromUser(user))
    else w.users.push(memberFromUser(user))
    saveWorkspace(workspaceId, w, 'system')
  }
}

/** Revoke access. The person stays in the document's `users` so their past
 *  assignments and comments still render — the same way Linear keeps them. */
export function removeMember(workspaceId, userId) {
  return db
    .prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
    .run(workspaceId, userId).changes > 0
}

export function deleteWorkspace(workspaceId) {
  db.prepare('DELETE FROM workspace_members WHERE workspace_id = ?').run(workspaceId)
  db.prepare('DELETE FROM workspaces WHERE id = ?').run(workspaceId)
  deleteWorkspaceDoc(workspaceId)
}

/**
 * The workspace a request acts on. `requested` (header or query) must be one
 * the user actually belongs to — a non-member gets null rather than a silent
 * fallback, so a wrong id fails loudly instead of leaking the default.
 *
 * An account with no workspace at all gets one provisioned here. That covers
 * accounts created before this change as well as any path that forgets to.
 */
export function resolveMembership(user, requested) {
  if (requested) return membership(requested, user.id)
  const mine = membershipsFor(user.id)
  if (mine.length) return membership(mine[0].workspace_id, user.id)
  const ws = createWorkspace(user)
  return membership(ws.id, user.id)
}

/** Express middleware. Must run after requireAuth. */
export function requireWorkspace(req, res, next) {
  const requested = req.get('x-workspace-id') || req.query.workspaceId || null
  const m = resolveMembership(req.user, requested)
  if (!m) return res.status(403).json({ error: 'You do not have access to that workspace' })
  req.workspaceId = m.workspace_id
  req.workspaceRole = m.role
  next()
}

/** Workspace-level admin (owner or admin). Must run after requireWorkspace. */
export function requireWorkspaceAdmin(req, res, next) {
  if (req.workspaceRole !== 'owner' && req.workspaceRole !== 'admin') {
    return res.status(403).json({ error: 'Workspace admin access required' })
  }
  next()
}

/**
 * The member id to attribute a server-side write to: the document member that
 * matches the authenticated account, falling back to the account id itself.
 * Never `currentUserId` — that is one client's idea of "me", not this caller's.
 */
export function viewerId(w, user) {
  const users = Array.isArray(w?.users) ? w.users : []
  return (
    users.find((u) => u.id === user.id)?.id ||
    users.find((u) => u.email?.toLowerCase() === user.email?.toLowerCase())?.id ||
    user.id
  )
}

// ---- one-time migration off the shared document ----
// Before tenancy every account read and wrote the same row. Move it into a real
// workspace owned by the earliest admin, and carry over everyone who could
// already see it — taking access away from existing users would be a surprise,
// and the leak this closes is future registrations, not the current roster.
function migrateLegacy() {
  const legacy = legacyWorkspaceDoc()
  if (!legacy) {
    dropLegacyWorkspaceDoc() // empty table left behind by an older boot
    return
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n > 0) {
    dropLegacyWorkspaceDoc()
    return
  }
  const users = db.prepare('SELECT * FROM users ORDER BY created_at, rowid').all()
  const owner = users.find((u) => u.role === 'admin') || users[0]
  if (!owner) return // nobody to own it yet — try again on the next boot

  const name = legacy.data?.workspaceName || defaultWorkspaceName(owner)
  const id = randomUUID()
  const at = new Date().toISOString()
  db.prepare('INSERT INTO workspaces (id, name, slug, owner_id, created_at) VALUES (?,?,?,?,?)')
    .run(id, name, slugify(name), owner.id, at)
  const insMember = db.prepare(
    'INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?,?,?,?)',
  )
  for (const u of users) {
    insMember.run(id, u.id, u.id === owner.id ? 'owner' : u.role === 'admin' ? 'admin' : 'member', at)
  }
  saveWorkspace(id, legacy.data, 'migration')
  dropLegacyWorkspaceDoc()

  console.warn(
    `[tenancy] Migrated the shared workspace document into "${name}" (${id}).\n` +
      `           Owner: ${owner.email}. Members carried over: ${users.map((u) => u.email).join(', ')}.\n` +
      `           Until now every account on this server could read and overwrite this data — ` +
      `review the member list and remove anyone who should not be there.`,
  )
}

migrateLegacy()

export { getWorkspace, saveWorkspace, hasWorkspace }
