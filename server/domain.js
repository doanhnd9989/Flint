// Domain data layer — the product model behind the REST API (issues, projects,
// cycles, teams, labels, workflow states, comments). Shares the SQLite handle
// with the auth/admin layer (db.js). Seeded with a realistic starter dataset.
import { db } from './db.js'
import { randomUUID } from 'node:crypto'

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    icon TEXT DEFAULT '', color TEXT DEFAULT '#5e6ad2',
    issue_counter INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS workflow_states (
    id TEXT PRIMARY KEY, team_id TEXT NOT NULL, name TEXT NOT NULL,
    type TEXT NOT NULL, color TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planned', health TEXT DEFAULT 'onTrack',
    lead_id TEXT, target_date TEXT, icon TEXT DEFAULT '', color TEXT DEFAULT '#5e6ad2',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cycles (
    id TEXT PRIMARY KEY, team_id TEXT NOT NULL, number INTEGER NOT NULL,
    name TEXT DEFAULT '', starts_at TEXT, ends_at TEXT, status TEXT DEFAULT 'upcoming'
  );
  CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY, team_id TEXT NOT NULL, identifier TEXT NOT NULL UNIQUE,
    number INTEGER NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '',
    state_id TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0,
    assignee_id TEXT, project_id TEXT, cycle_id TEXT, parent_id TEXT,
    estimate INTEGER, due_date TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT
  );
  CREATE TABLE IF NOT EXISTS issue_labels (
    issue_id TEXT NOT NULL, label_id TEXT NOT NULL,
    PRIMARY KEY (issue_id, label_id)
  );
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY, issue_id TEXT NOT NULL, author_id TEXT,
    body TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_issues_team ON issues(team_id);
  CREATE INDEX IF NOT EXISTS idx_issues_state ON issues(state_id);
  CREATE INDEX IF NOT EXISTS idx_comments_issue ON comments(issue_id);
`)

export function seedDomain() {
  const already = db.prepare('SELECT COUNT(*) AS n FROM issues').get().n
  if (already > 0) return // idempotent — only seed an empty domain

  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    // Teams
    const teams = [
      { id: 't_cla', key: 'CLA', name: 'Flint Task', icon: '🔥', color: '#5e6ad2' },
      { id: 't_eng', key: 'ENG', name: 'Engineering', icon: '⚙️', color: '#4ea7fc' },
    ]
    const insTeam = db.prepare('INSERT OR IGNORE INTO teams (id,key,name,icon,color,issue_counter) VALUES (@id,@key,@name,@icon,@color,0)')
    teams.forEach((t) => insTeam.run(t))

    // Workflow states (shared shape per team; we attach to CLA for the seed)
    const states = [
      { id: 's_backlog', name: 'Backlog', type: 'backlog', color: '#bec2c8', position: 0 },
      { id: 's_todo', name: 'Todo', type: 'unstarted', color: '#e2e2e2', position: 1 },
      { id: 's_progress', name: 'In Progress', type: 'started', color: '#f2994a', position: 2 },
      { id: 's_review', name: 'In Review', type: 'started', color: '#4ea7fc', position: 3 },
      { id: 's_done', name: 'Done', type: 'completed', color: '#4cb782', position: 4 },
      { id: 's_canceled', name: 'Canceled', type: 'canceled', color: '#95a2b3', position: 5 },
    ]
    const insState = db.prepare('INSERT OR IGNORE INTO workflow_states (id,team_id,name,type,color,position) VALUES (@id,@team_id,@name,@type,@color,@position)')
    states.forEach((s) => insState.run({ ...s, team_id: 't_cla' }))

    // Labels
    const labels = [
      { id: 'l_feature', name: 'Feature', color: '#5e6ad2' },
      { id: 'l_bug', name: 'Bug', color: '#eb5757' },
      { id: 'l_design', name: 'Design', color: '#eb5da8' },
      { id: 'l_improvement', name: 'Improvement', color: '#4cb782' },
      { id: 'l_docs', name: 'Documentation', color: '#4ea7fc' },
    ]
    const insLabel = db.prepare('INSERT OR IGNORE INTO labels (id,name,color) VALUES (@id,@name,@color)')
    labels.forEach((l) => insLabel.run(l))

    // Pick a lead from the seeded auth users if present
    const lead = db.prepare("SELECT id FROM users ORDER BY created_at LIMIT 1").get()
    const leadId = lead?.id || null
    const someUser = db.prepare("SELECT id FROM users WHERE role != 'admin' ORDER BY created_at LIMIT 1").get()
    const assigneeId = someUser?.id || leadId

    // Projects
    const projects = [
      { id: 'p_mvp', name: 'MVP Launch', description: 'Ship the first public release.', status: 'started', health: 'onTrack', lead_id: leadId, target_date: '2026-07-29', icon: '🚀', color: '#5e6ad2' },
      { id: 'p_mobile', name: 'Mobile App', description: 'Native mobile companion.', status: 'planned', health: 'onTrack', lead_id: leadId, target_date: '2026-09-27', icon: '📱', color: '#4ea7fc' },
    ]
    const insProject = db.prepare('INSERT OR IGNORE INTO projects (id,name,description,status,health,lead_id,target_date,icon,color,created_at) VALUES (@id,@name,@description,@status,@health,@lead_id,@target_date,@icon,@color,@created_at)')
    projects.forEach((p) => insProject.run({ ...p, created_at: now }))

    // Cycles
    const cycles = [
      { id: 'c_1', team_id: 't_cla', number: 1, name: 'Cycle 1', starts_at: '2026-06-22', ends_at: '2026-07-06', status: 'active' },
      { id: 'c_2', team_id: 't_cla', number: 2, name: 'Cycle 2', starts_at: '2026-07-06', ends_at: '2026-07-20', status: 'upcoming' },
    ]
    const insCycle = db.prepare('INSERT OR IGNORE INTO cycles (id,team_id,number,name,starts_at,ends_at,status) VALUES (@id,@team_id,@number,@name,@starts_at,@ends_at,@status)')
    cycles.forEach((c) => insCycle.run(c))

    // Issues
    const issues = [
      { title: 'Get familiar with the workspace', state: 's_todo', pr: 2, project: 'p_mvp', cycle: 'c_1', labels: ['l_docs'] },
      { title: 'Set up your teams', state: 's_todo', pr: 2, project: 'p_mvp', cycle: 'c_1', labels: ['l_feature'] },
      { title: 'Filter issues by label and assignee', state: 's_todo', pr: 3, project: 'p_mvp', cycle: 'c_1', labels: ['l_feature'] },
      { title: 'Notifications inbox', state: 's_todo', pr: 2, project: null, cycle: 'c_1', labels: ['l_feature'] },
      { title: 'Keyboard navigation feels sluggish on long lists', state: 's_progress', pr: 1, project: 'p_mvp', cycle: 'c_1', labels: ['l_bug'] },
      { title: 'Board view for issues', state: 's_progress', pr: 2, project: 'p_mvp', cycle: 'c_1', labels: ['l_feature'] },
      { title: 'Design the command palette', state: 's_review', pr: 2, project: 'p_mvp', cycle: null, labels: ['l_design', 'l_feature'] },
      { title: 'Dark mode polish', state: 's_done', pr: 3, project: 'p_mvp', cycle: null, labels: ['l_design', 'l_improvement'] },
      { title: 'Command menu fuzzy search', state: 's_backlog', pr: 0, project: null, cycle: 'c_2', labels: ['l_feature'] },
      { title: 'Sub-issue progress rollups', state: 's_backlog', pr: 2, project: 'p_mobile', cycle: 'c_2', labels: ['l_feature'] },
    ]
    const insIssue = db.prepare(`INSERT INTO issues
      (id,team_id,identifier,number,title,description,state_id,priority,assignee_id,project_id,cycle_id,parent_id,estimate,due_date,created_at,updated_at,archived_at)
      VALUES (@id,@team_id,@identifier,@number,@title,'',@state_id,@priority,@assignee_id,@project_id,@cycle_id,NULL,NULL,NULL,@created_at,@updated_at,NULL)`)
    const insIL = db.prepare('INSERT OR IGNORE INTO issue_labels (issue_id,label_id) VALUES (?,?)')
    let n = 0
    for (const it of issues) {
      n += 1
      const id = randomUUID()
      insIssue.run({
        id, team_id: 't_cla', identifier: `CLA-${n}`, number: n, title: it.title,
        state_id: it.state, priority: it.pr, assignee_id: assigneeId,
        project_id: it.project, cycle_id: it.cycle, created_at: now, updated_at: now,
      })
      it.labels.forEach((lid) => insIL.run(id, lid))
    }
    db.prepare('UPDATE teams SET issue_counter = ? WHERE id = ?').run(n, 't_cla')
  })
  tx()
}
