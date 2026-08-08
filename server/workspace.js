// Product data, stored one JSON document per workspace (tenant). Every read and
// write is keyed by a workspace id — there is deliberately no "the" workspace.
//
// This used to be a single row pinned with CHECK (id = 1), which meant every
// account on the server shared one document: anyone who could authenticate
// could read and overwrite everyone else's issues. The legacy row is migrated
// into a real workspace by tenancy.js on first boot after this change.
//
// A monotonic `version` + `last_writer` (a per-client id) lets other clients of
// the same workspace poll for changes without echoing their own writes.
import { db } from './db.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS workspace_docs (
    workspace_id TEXT PRIMARY KEY,
    data         TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    version      INTEGER NOT NULL DEFAULT 0,
    last_writer  TEXT
  );
`)

/** Guard against a caller that forgot to scope its query. */
function requireId(workspaceId, op) {
  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new Error(`workspace.${op}: a workspaceId is required`)
  }
  return workspaceId
}

export function getWorkspace(workspaceId) {
  requireId(workspaceId, 'getWorkspace')
  const row = db.prepare('SELECT data FROM workspace_docs WHERE workspace_id = ?').get(workspaceId)
  if (!row) return null
  try {
    return JSON.parse(row.data)
  } catch {
    return null
  }
}

const saveListeners = []
/** Register a callback fired after every save ({workspaceId, version, writer}). */
export function onWorkspaceSave(cb) {
  saveListeners.push(cb)
}

export function saveWorkspace(workspaceId, data, writer = null) {
  requireId(workspaceId, 'saveWorkspace')
  const cur = db.prepare('SELECT version FROM workspace_docs WHERE workspace_id = ?').get(workspaceId)
  const version = (cur?.version || 0) + 1
  db.prepare(
    `INSERT INTO workspace_docs (workspace_id, data, updated_at, version, last_writer)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(workspace_id) DO UPDATE SET
       data = excluded.data, updated_at = excluded.updated_at,
       version = excluded.version, last_writer = excluded.last_writer`,
  ).run(workspaceId, JSON.stringify(data), new Date().toISOString(), version, writer)
  for (const cb of saveListeners) {
    try { cb({ workspaceId, version, writer }) } catch { /* listener errors are non-fatal */ }
  }
  return version
}

/** Cheap change-detection payload for polling clients. */
export function getMeta(workspaceId) {
  requireId(workspaceId, 'getMeta')
  const row = db
    .prepare('SELECT version, updated_at, last_writer FROM workspace_docs WHERE workspace_id = ?')
    .get(workspaceId)
  return { version: row?.version || 0, updatedAt: row?.updated_at || null, lastWriter: row?.last_writer || null }
}

export function hasWorkspace(workspaceId) {
  if (!workspaceId) return false
  return !!db.prepare('SELECT 1 FROM workspace_docs WHERE workspace_id = ?').get(workspaceId)
}

export function deleteWorkspaceDoc(workspaceId) {
  requireId(workspaceId, 'deleteWorkspaceDoc')
  db.prepare('DELETE FROM workspace_docs WHERE workspace_id = ?').run(workspaceId)
}

// ---- legacy single-document storage (pre-tenancy) ----
// Read-only accessors used once by the migration in tenancy.js.

function legacyTableExists() {
  return !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'workspace_doc'")
    .get()
}

/** The old shared document, or null when there is nothing to migrate. */
export function legacyWorkspaceDoc() {
  if (!legacyTableExists()) return null
  const row = db.prepare('SELECT * FROM workspace_doc WHERE id = 1').get()
  if (!row) return null
  try {
    return { data: JSON.parse(row.data), updatedAt: row.updated_at }
  } catch {
    return null
  }
}

export function dropLegacyWorkspaceDoc() {
  if (legacyTableExists()) db.exec('DROP TABLE workspace_doc')
}
