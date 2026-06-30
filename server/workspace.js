// Single source of truth for the product data: the entire workspace is stored
// as one JSON document. The web app hydrates from it on login and writes it
// back on change; the REST API reads/writes the same document. A monotonic
// `version` + `last_writer` (a per-client id) lets other clients poll for
// changes and live-refresh without echoing their own writes.
import { db } from './db.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS workspace_doc (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    data        TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
`)

// Migrate older deployments that created the table before version/last_writer.
const cols = db.prepare('PRAGMA table_info(workspace_doc)').all().map((c) => c.name)
if (!cols.includes('version')) db.exec('ALTER TABLE workspace_doc ADD COLUMN version INTEGER NOT NULL DEFAULT 0')
if (!cols.includes('last_writer')) db.exec('ALTER TABLE workspace_doc ADD COLUMN last_writer TEXT')

export function getWorkspace() {
  const row = db.prepare('SELECT data FROM workspace_doc WHERE id = 1').get()
  if (!row) return null
  try {
    return JSON.parse(row.data)
  } catch {
    return null
  }
}

const saveListeners = []
/** Register a callback fired after every workspace save ({version, writer}). */
export function onWorkspaceSave(cb) {
  saveListeners.push(cb)
}

export function saveWorkspace(data, writer = null) {
  const cur = db.prepare('SELECT version FROM workspace_doc WHERE id = 1').get()
  const version = (cur?.version || 0) + 1
  db.prepare(
    `INSERT INTO workspace_doc (id, data, updated_at, version, last_writer)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       data = excluded.data, updated_at = excluded.updated_at,
       version = excluded.version, last_writer = excluded.last_writer`,
  ).run(JSON.stringify(data), new Date().toISOString(), version, writer)
  for (const cb of saveListeners) {
    try { cb({ version, writer }) } catch { /* listener errors are non-fatal */ }
  }
  return version
}

/** Cheap change-detection payload for polling clients. */
export function getMeta() {
  const row = db.prepare('SELECT version, updated_at, last_writer FROM workspace_doc WHERE id = 1').get()
  return { version: row?.version || 0, updatedAt: row?.updated_at || null, lastWriter: row?.last_writer || null }
}

export function hasWorkspace() {
  return !!db.prepare('SELECT 1 FROM workspace_doc WHERE id = 1').get()
}
