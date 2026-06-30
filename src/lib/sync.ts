// Server sync: the workspace lives on the server as one JSON document. We
// hydrate the store from it on login and write it back (debounced) on every
// change, so the backend — not localStorage — is the source of truth.
import { useStore } from './store'
import { api } from './api'

// The data slice of the store that constitutes the workspace document. Mirrors
// the keys returned by seed.ts (everything except transient UI + actions).
const WORKSPACE_KEYS = [
  'workspaceName', 'users', 'currentUserId', 'teams', 'states', 'labels',
  'initiatives', 'projects', 'milestones', 'cycles', 'issues', 'issueLinks',
  'relations', 'templates', 'projectUpdates', 'initiativeUpdates', 'comments',
  'activities', 'notifications', 'savedViews', 'documents', 'customers',
  'releases', 'attachments', 'pullRequests',
] as const

type Workspace = Record<string, unknown>

function pickWorkspace(state: Record<string, unknown>): Workspace {
  const out: Workspace = {}
  for (const k of WORKSPACE_KEYS) out[k] = state[k]
  return out
}

// True while we're applying server data, so the change subscription doesn't
// immediately echo it back with a PUT.
let applyingRemote = false
let started = false

/**
 * Load the workspace from the server. If the server has never been populated,
 * seed it with the client's current (seeded/local) state.
 */
export async function hydrateWorkspace(): Promise<void> {
  try {
    const { workspace } = await api<{ workspace: Workspace | null }>('/workspace')
    if (workspace && Object.keys(workspace).length > 0) {
      applyingRemote = true
      useStore.setState(workspace as never)
      applyingRemote = false
    } else {
      // First boot — push the local seed up so the server becomes the source.
      await api('/workspace', { method: 'PUT', body: pickWorkspace(useStore.getState() as never) })
    }
  } catch {
    // Offline / server unreachable — fall back to the local persisted store.
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
function schedulePush() {
  if (applyingRemote) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    api('/workspace', { method: 'PUT', body: pickWorkspace(useStore.getState() as never) }).catch(() => {})
  }, 800)
}

/** Begin persisting workspace changes to the server (debounced). Idempotent. */
export function startWorkspaceSync(): void {
  if (started) return
  started = true
  let prev = pickWorkspace(useStore.getState() as never)
  useStore.subscribe((state) => {
    const next = pickWorkspace(state as never)
    // Only push when a workspace key actually changed (ignore pure UI updates).
    for (const k of WORKSPACE_KEYS) {
      if (next[k] !== prev[k]) {
        prev = next
        schedulePush()
        return
      }
    }
  })
}

/** Flush any pending change immediately (e.g. before sign-out). */
export function flushWorkspace(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
    api('/workspace', { method: 'PUT', body: pickWorkspace(useStore.getState() as never) }).catch(() => {})
  }
}
