// SQLite layer for the Flint auth/admin API.
// Owns three tables: users (login accounts), feature_flags (system feature
// toggles), and workspace (key/value system config). The product data
// (issues, projects, …) is NOT stored here — it stays in the SPA's localStorage.
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data')
mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(join(DATA_DIR, 'flint.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    avatar_color  TEXT NOT NULL DEFAULT '#5e6ad2',
    role          TEXT NOT NULL DEFAULT 'member',  -- admin | member | guest
    status        TEXT NOT NULL DEFAULT 'active',  -- active | suspended
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feature_flags (
    key         TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    enabled     INTEGER NOT NULL DEFAULT 1,
    position    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS workspace (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    name         TEXT NOT NULL,
    prefix       TEXT NOT NULL,   -- first chars, shown in the UI
    hash         TEXT NOT NULL UNIQUE,  -- sha256 of the full key
    created_at   TEXT NOT NULL,
    last_used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS webhooks (
    id          TEXT PRIMARY KEY,
    url         TEXT NOT NULL,
    secret      TEXT NOT NULL,        -- HMAC-SHA256 signing secret
    events      TEXT NOT NULL DEFAULT 'all',  -- comma list or 'all'
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    last_status TEXT,                 -- last delivery result
    last_at     TEXT
  );
`)

// Default feature set — keys match the SPA's sidebar sections so the admin can
// hide/show whole areas of the product.
const DEFAULT_FLAGS = [
  ['initiatives', 'Initiatives', 'Strategic initiatives grouping projects', 1, 10],
  ['projects', 'Projects', 'Project tracking with health & milestones', 1, 20],
  ['cycles', 'Cycles', 'Time-boxed iteration planning', 1, 30],
  ['roadmap', 'Roadmap', 'Timeline roadmap of projects', 1, 40],
  ['insights', 'Insights', 'Analytics & reporting dashboards', 1, 50],
  ['customers', 'Customers', 'Customer requests & accounts', 1, 60],
  ['releases', 'Releases', 'Release tracking & changelog', 1, 70],
  ['documents', 'Documents', 'Collaborative documents', 1, 80],
  ['pulse', 'Pulse', 'Team activity feed', 1, 90],
  ['changelog', 'Changelog', 'Public product changelog', 1, 100],
  ['members', 'Members', 'Team member directory', 1, 110],
  ['labels', 'Labels', 'Issue label management', 1, 120],
  ['views', 'Saved Views', 'Custom saved filtered views', 1, 130],
]

const DEFAULT_WORKSPACE = [
  ['name', 'Flint Task'],
  ['tagline', 'The issue tracker built for speed.'],
  ['accentColor', '#5e6ad2'],
]

// Demo accounts mirror the SPA seed so signed-in identities feel continuous.
// All share the default member password; the admin account is the real one.
const DEMO_USERS = [
  { name: 'Avery Chen', email: 'avery@workspace.dev', role: 'admin', color: '#4cb782' },
  { name: 'Jordan Lee', email: 'jordan@workspace.dev', role: 'member', color: '#f2994a' },
  { name: 'Sam Rivera', email: 'sam@workspace.dev', role: 'member', color: '#eb5da8' },
  { name: 'Kai Nakamura', email: 'kai@workspace.dev', role: 'guest', color: '#4ea7fc' },
]

export function seed() {
  const now = new Date().toISOString()

  const insFlag = db.prepare(
    `INSERT OR IGNORE INTO feature_flags (key, label, description, enabled, position)
     VALUES (?, ?, ?, ?, ?)`,
  )
  for (const f of DEFAULT_FLAGS) insFlag.run(...f)

  const insWs = db.prepare(`INSERT OR IGNORE INTO workspace (key, value) VALUES (?, ?)`)
  for (const w of DEFAULT_WORKSPACE) insWs.run(...w)

  const insUser = db.prepare(
    `INSERT OR IGNORE INTO users (id, name, email, password_hash, avatar_color, role, status, created_at)
     VALUES (@id, @name, @email, @password_hash, @avatar_color, @role, @status, @created_at)`,
  )

  // System admin — credentials come from env so production isn't hardcoded.
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@flinttask.com').toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234'
  insUser.run({
    id: randomUUID(),
    name: process.env.ADMIN_NAME || 'System Admin',
    email: adminEmail,
    password_hash: bcrypt.hashSync(adminPassword, 10),
    avatar_color: '#5e6ad2',
    role: 'admin',
    status: 'active',
    created_at: now,
  })

  const demoPassword = process.env.DEMO_PASSWORD || 'demo1234'
  for (const u of DEMO_USERS) {
    insUser.run({
      id: randomUUID(),
      name: u.name,
      email: u.email.toLowerCase(),
      password_hash: bcrypt.hashSync(demoPassword, 10),
      avatar_color: u.color,
      role: u.role,
      status: 'active',
      created_at: now,
    })
  }

  return { adminEmail }
}

// `node db.js --seed` for manual seeding / CI.
if (process.argv.includes('--seed')) {
  const { adminEmail } = seed()
  console.log(`Seeded database. Admin: ${adminEmail}`)
}
