// SQLite layer for the Flint auth/admin API.
// Owns three tables: users (login accounts), feature_flags (system feature
// toggles), and workspace (key/value system config). The product data
// (issues, projects, …) is NOT stored here — it stays in the SPA's localStorage.
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IS_PROD = process.env.NODE_ENV === 'production'
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

/**
 * A secret that must survive restarts but must never be a value someone can
 * read out of this repository. Env wins when set; otherwise we mint 32 random
 * bytes once and keep them in the workspace table.
 *
 * The old code fell back to a constant string committed here, which meant
 * anyone holding the source could forge an admin JWT without a password.
 */
export function getOrCreateSecret(key) {
  const fromEnv = process.env[key]
  if (fromEnv) return fromEnv
  const stored = db.prepare('SELECT value FROM workspace WHERE key = ?').get(`secret:${key}`)
  if (stored) return stored.value
  const minted = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO workspace (key, value) VALUES (?, ?)').run(`secret:${key}`, minted)
  console.warn(`[db] ${key} was not set — generated a random one and stored it in the database.`)
  return minted
}

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

  // System admin. No literal fallback password: unset env mints a random one and
  // prints it once, so an unconfigured box is inaccessible rather than open.
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@flinttask.com').toLowerCase()
  const generatedAdminPassword = process.env.ADMIN_PASSWORD
    ? null
    : randomBytes(12).toString('base64url')
  const adminPassword = process.env.ADMIN_PASSWORD || generatedAdminPassword
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
  if (generatedAdminPassword) {
    console.warn(
      `[db] ADMIN_PASSWORD not set. If ${adminEmail} was created just now, its password is: ${generatedAdminPassword}`,
    )
  }

  // The insert above is INSERT OR IGNORE, so on every boot after the first it
  // does nothing — which used to mean that setting ADMIN_PASSWORD later had no
  // effect at all and the account silently kept whatever it was seeded with.
  // When the env var is set, it is the authority: reconcile the stored hash.
  if (process.env.ADMIN_PASSWORD) {
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail)
    if (existing && !bcrypt.compareSync(process.env.ADMIN_PASSWORD, existing.password_hash)) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
        bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10),
        existing.id,
      )
      console.warn(`[db] Reset ${adminEmail} to match ADMIN_PASSWORD.`)
    }
  }

  // Demo accounts share one password and one of them is an admin, so they are a
  // development convenience only. Production has to ask for them explicitly.
  const wantDemoUsers = IS_PROD ? process.env.SEED_DEMO_USERS === '1' : true
  if (wantDemoUsers) {
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
  }

  // Seeding is skipped from now on, but a box seeded before this change still
  // carries those accounts — and `avery@workspace.dev` is an admin. Say so on
  // every boot until someone deals with it.
  if (IS_PROD) {
    const leftovers = db
      .prepare(
        `SELECT email, role FROM users WHERE email IN (${DEMO_USERS.map(() => '?').join(',')})`,
      )
      .all(...DEMO_USERS.map((u) => u.email.toLowerCase()))
    if (leftovers.length) {
      console.warn(
        `[db] SECURITY: seeded demo accounts exist in production: ${leftovers
          .map((u) => `${u.email} (${u.role})`)
          .join(', ')}. They share a known password — reset or remove them.`,
      )
    }
  }

  return { adminEmail }
}

// `node db.js --seed` for manual seeding / CI.
if (process.argv.includes('--seed')) {
  const { adminEmail } = seed()
  console.log(`Seeded database. Admin: ${adminEmail}`)
}
