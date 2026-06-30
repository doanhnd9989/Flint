// Server sync: the workspace lives on the server as one JSON document. We
// hydrate the store from it on login, write it back (debounced) on change, and
// poll a cheap `version` endpoint so changes from another device or from the
// REST API live-refresh into this client. The backend — not localStorage — is
// the source of truth.
import { useStore } from './store'
import { api } from './api'
import { useAuth } from './auth'

const WORKSPACE_KEYS = [
  'workspaceName', 'users', 'currentUserId', 'teams', 'states', 'labels',
  'initiatives', 'projects', 'milestones', 'cycles', 'issues', 'issueLinks',
  'relations', 'templates', 'projectUpdates', 'initiativeUpdates', 'comments',
  'activities', 'notifications', 'savedViews', 'documents', 'customers',
  'releases', 'attachments', 'pullRequests',
] as const

type Workspace = Record<string, unknown>
interface Meta { version: number; updatedAt: string | null; lastWriter: string | null }

// A per-tab id so polling can ignore changes this client itself wrote.
const CLIENT_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `c_${Date.now()}`

function pickWorkspace(state: Record<string, unknown>): Workspace {
  const out: Workspace = {}
  for (const k of WORKSPACE_KEYS) out[k] = state[k]
  return out
}

let applyingRemote = false
let started = false
let lastVersion = 0

function push() {
  return api<{ version: number }>('/workspace', {
    method: 'PUT',
    body: { workspace: pickWorkspace(useStore.getState() as never), clientId: CLIENT_ID },
  })
    .then((r) => {
      if (typeof r?.version === 'number') lastVersion = r.version
    })
    .catch(() => {})
}

/** Load the workspace from the server, seeding it from local state on first boot. */
export async function hydrateWorkspace(): Promise<void> {
  try {
    const { workspace, meta } = await api<{ workspace: Workspace | null; meta: Meta }>('/workspace')
    lastVersion = meta?.version || 0
    if (workspace && Object.keys(workspace).length > 0) {
      applyingRemote = true
      useStore.setState(workspace as never)
      applyingRemote = false
    } else {
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
  let ws: WebSocket
  try {
    ws = new WebSocket(`${proto}://${location.host}/api/ws?token=${encodeURIComponent(token)}`)
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
