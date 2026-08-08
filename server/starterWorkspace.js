// The document a brand-new workspace starts with. Deliberately empty of
// content: one team, the default workflow states and labels, and exactly one
// member — the account that created it.
//
// Two things this fixes by construction:
//   • a new account no longer inherits somebody else's data, and
//   • the signed-in identity IS a workspace member, instead of the fabricated
//     "You" row the SPA seed used to ship.
import { randomUUID } from 'node:crypto'

const rid = (p) => `${p}_${randomUUID().slice(0, 8)}`

/** A 3-letter team key (Linear-style) from a workspace or person's name. */
export function teamKeyFrom(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1
    ? words.map((w) => w[0]).join('')
    : (words[0] || 'team')
  const key = letters.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3)
  return key.length >= 2 ? key : 'TEA'
}

/** Default name for the workspace a new account gets. */
export function defaultWorkspaceName(user) {
  const first = String(user?.name || '').trim().split(/\s+/)[0]
  return first ? `${first}'s workspace` : 'My workspace'
}

const STATES = [
  ['Backlog', 'backlog', '#bec2c8'],
  ['Todo', 'unstarted', '#8a8f98'],
  ['In Progress', 'started', '#f2c94c'],
  ['In Review', 'started', '#4cb782'],
  ['Done', 'completed', '#5e6ad2'],
  ['Canceled', 'canceled', '#95a2b3'],
]

const LABELS = [
  ['Bug', '#eb5757'],
  ['Feature', '#5e6ad2'],
  ['Improvement', '#4cb782'],
]

/**
 * Build the initial document. `user` is a row from the `users` table.
 * Every collection in the SPA's WorkspaceData is present so the client never
 * has to fall back to its local seed.
 */
export function starterWorkspace(user, workspaceName) {
  const name = workspaceName || defaultWorkspaceName(user)
  const me = {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarColor: user.avatar_color || '#5e6ad2',
    role: 'admin',
    isMe: true,
  }

  const groupId = rid('lg')
  return {
    workspaceName: name,
    users: [me],
    currentUserId: me.id,
    teams: [
      {
        id: rid('t'),
        name,
        key: teamKeyFrom(name),
        icon: '🚀',
        color: '#5e6ad2',
        memberIds: [me.id],
        estimationType: 'fibonacci',
        estimationAllowZero: false,
        cyclesEnabled: true,
      },
    ],
    states: STATES.map(([sName, type, color], i) => ({
      id: rid('s'), name: sName, type, color, position: i,
    })),
    labels: [
      { id: groupId, name: 'Type', color: '#95a2b3', isGroup: true },
      ...LABELS.map(([lName, color]) => ({ id: rid('l'), name: lName, color, groupId })),
    ],
    initiatives: [],
    projects: [],
    milestones: [],
    cycles: [],
    issues: [],
    issueLinks: [],
    relations: [],
    templates: [],
    projectUpdates: [],
    initiativeUpdates: [],
    comments: [],
    activities: [],
    notifications: [],
    savedViews: [],
    documents: [],
    customers: [],
    releases: [],
    attachments: [],
    pullRequests: [],
  }
}

/** The workspace-member shape the SPA expects, from a `users` table row. */
export function memberFromUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarColor: user.avatar_color || '#5e6ad2',
    role: user.role === 'admin' ? 'admin' : user.role === 'guest' ? 'guest' : 'member',
  }
}
