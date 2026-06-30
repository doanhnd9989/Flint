// Single source of truth for the product data: the entire workspace is stored
// as one JSON document. The web app hydrates from it on login and writes it
// back on change; the REST API reads/writes the same document. This keeps the
// app and the API perfectly consistent and preserves every field with no lossy
// column mapping.
import { db } from './db.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS workspace_doc (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`)

export function getWorkspace() {
  const row = db.prepare('SELECT data FROM workspace_doc WHERE id = 1').get()
  if (!row) return null
  try {
    return JSON.parse(row.data)
  } catch {
    return null
  }
}

export function saveWorkspace(data) {
  db.prepare(
    `INSERT INTO workspace_doc (id, data, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(JSON.stringify(data), new Date().toISOString())
}

/** Has the workspace ever been populated by a client? */
export function hasWorkspace() {
  return !!db.prepare('SELECT 1 FROM workspace_doc WHERE id = 1').get()
}
