// Server sync: each workspace lives on the server as one JSON document, and a
// request only ever reaches the workspace the signed-in account belongs to. We
// hydrate the store from it on login, write it back (debounced) on change, and
// poll a cheap `version` endpoint so changes from another device or from the
// REST API live-refresh into this client. The backend — not localStorage — is
// the source of truth.
import { useStore } from './store'
import { api } from './api'
import { useAuth } from './auth'
import type { User } from './types'

// `currentUserId` is deliberately absent: it answers "who am I", which is a
// property of the session, not of the workspace. Syncing it made two members of
// the same workspace overwrite each other's identity on every push.
const WORKSPACE_KEYS = [
  'workspaceName', 'users', 'teams', 'states', 'labels',
  'initiatives', 'projects', 'milestones', 'cycles', 'issues', 'issueLinks',
  'relations', 'templates', 'projectUpdates', 'initiativeUpdates', 'comments',
  'activities', 'notifications', 'savedViews', 'documents', 'customers',
  'releases', 'attachments', 'pullRequests',
] as const

type Workspace = Record<string, unknown>
interface Meta { version: number; updatedAt: string | null; lastWriter: string | null }
export interface WorkspaceInfo { id: string; name: string; slug: string; role: string }

// A per-tab id so polling can ignore changes this client itself wrote.
const CLIENT_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `c_${Date.now()}`

function pickWorkspace(state: Record<string, unknown>): Workspace {
  const out: Workspace = {}
  for (const k of WORKSPACE_KEYS) out[k] = state[k]
  return out
}

/** Strip per-viewer fields before the document goes to the server. `isMe` marks
 *  the signed-in member, so shipping it would label everyone else "you". */
function sanitize(w: Workspace): Workspace {
  if (!Array.isArray(w.users)) return w
  return {
    ...w,
    users: (w.users as User[]).map(({ isMe: _isMe, ...rest }) => rest),
  }
}

let applyingRemote = false
let started = false
let lastVersion = 0
let workspaceInfo: WorkspaceInfo | null = null

/** The workspace this client is connected to, once hydrated. */
export function currentWorkspace(): WorkspaceInfo | null {
  return workspaceInfo
}

function push() {
  return api<{ version: number }>('/workspace', {
    method: 'PUT',
    body: { workspace: sanitize(pickWorkspace(useStore.getState() as never)), clientId: CLIENT_ID },
  })
    .then((r) => {
      if (typeof r?.version === 'number') lastVersion = r.version
    })
    .catch(() => {})
}

/**
 * Bind the signed-in account to a member of the workspace document.
 *
 * The SPA seed shipped a fabricated "You" row, so the person actually logged in
 * was never in the roster — the app showed one name in the sidebar and another
 * in Members. Match on id, then email; add the account if it isn't there yet.
 */
function reconcileIdentity(): void {
  const auth = useAuth.getState().user
  if (!auth) return
  const state = useStore.getState()
  const users: User[] = Array.isArray(state.users) ? state.users : []

  const mine =
    users.find((u) => u.id === auth.id) ||
    users.find((u) => u.email?.toLowerCase() === auth.email.toLowerCase())

  const next: User[] = mine
    ? users.map((u) =>
        u.id === mine.id
          ? { ...u, name: auth.name, email: auth.email, isMe: true }
          : u.isMe
            ? { ...u, isMe: false }
            : u,
      )
    : [
        ...users.map((u) => (u.isMe ? { ...u, isMe: false } : u)),
        {
          id: auth.id,
          name: auth.name,
          email: auth.email,
          avatarColor: auth.avatarColor,
          role: auth.role,
          isMe: true,
        },
      ]

  const meId = mine?.id ?? auth.id
  const unchanged =
    state.currentUserId === meId && next.every((u, i) => u === users[i]) && next.length === users.length
  if (unchanged) return
  useStore.setState({ users: next, currentUserId: meId })
}

/** Load the workspace from the server, seeding it from local state on first boot. */
export async function hydrateWorkspace(): Promise<void> {
  try {
    const { workspace, meta, workspaceInfo: info } = await api<{
      workspace: Workspace | null
      meta: Meta
      workspaceInfo?: WorkspaceInfo
    }>('/workspace')
    lastVersion = meta?.version || 0
    workspaceInfo = info || null
    if (workspace && Object.keys(workspace).length > 0) {
      applyingRemote = true
      useStore.setState(workspace as never)
      applyingRemote = false
      reconcileIdentity()
    } else {
      // No document yet for this workspace — publish what we have locally.
      reconcileIdentity()
      await push()
    }
  } catch {
    // Offline — fall back to the locally persisted store.
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
function schedulePush() {
  if (applyingRemote) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void push()
  }, 800)
}

async function poll() {
  // Nobody is signed in — polling would just 401 every tick.
  if (!useAuth.getState().token) return
  // Don't clobber a local edit that hasn't been flushed yet.
  if (timer) return
  try {
    const meta = await api<Meta>('/workspace/meta')
    if (meta.version > lastVersion && meta.lastWriter !== CLIENT_ID) {
      const { workspace } = await api<{ workspace: Workspace | null }>('/workspace')
      if (workspace && Object.keys(workspace).length > 0) {
        applyingRemote = true
        useStore.setState(workspace as never)
        applyingRemote = false
        // The incoming document carries no `isMe` — re-derive it for this tab.
        reconcileIdentity()
      }
    }
    lastVersion = Math.max(lastVersion, meta.version)
  } catch {
    /* transient — try again next tick */
  }
}

// Realtime: a WebSocket pushes version bumps for instant refresh. Polling stays
// on as a fallback for when the socket can't connect.
function connectWebsocket() {
  const token = useAuth.getState().token
  if (!token || typeof WebSocket === 'undefined') return
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws_ = workspaceInfo ? `&workspaceId=${encodeURIComponent(workspaceInfo.id)}` : ''
  let ws: WebSocket
  try {
    ws = new WebSocket(`${proto}://${location.host}/api/ws?token=${encodeURIComponent(token)}${ws_}`)
  } catch {
    return
  }
  ws.onmessage = (ev) => {
    try {
      const m = JSON.parse(ev.data)
      // Ignore our own writes; refresh on anything else.
      if (m.type === 'workspace' && m.lastWriter !== CLIENT_ID && m.version > lastVersion) {
        void poll()
      }
    } catch {
      /* ignore */
    }
  }
  // Reconnect with a small backoff; polling covers the gap meanwhile.
  ws.onclose = () => setTimeout(connectWebsocket, 5000)
  ws.onerror = () => {
    try { ws.close() } catch { /* ignore */ }
  }
}

/** Begin persisting changes (debounced) + realtime/poll refresh. Idempotent. */
export function startWorkspaceSync(): void {
  if (started) return
  started = true
  let prev = pickWorkspace(useStore.getState() as never)
  useStore.subscribe((state) => {
    const next = pickWorkspace(state as never)
    for (const k of WORKSPACE_KEYS) {
      if (next[k] !== prev[k]) {
        prev = next
        schedulePush()
        return
      }
    }
  })
  connectWebsocket()
  setInterval(() => void poll(), 5000)
}

/** Forget this session's sync state so the next login hydrates from scratch. */
export function resetSyncState(): void {
  lastVersion = 0
  workspaceInfo = null
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}
