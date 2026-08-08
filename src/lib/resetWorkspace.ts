// Clearing the product store when a session ends.
//
// The auth session and the workspace data live in two separate persisted stores
// under two separate localStorage keys, and logout only ever cleared the first.
// Whatever the previous account had loaded stayed on disk, so the next person to
// sign in on this browser saw their issues until the server replaced them — and
// kept seeing them for good if the app was offline.
import { useStore } from './store'
import { emptyWorkspace } from './seed'

export function resetWorkspaceStore(): void {
  useStore.setState(emptyWorkspace() as never)
  try {
    useStore.persist?.clearStorage?.()
  } catch {
    /* storage may be unavailable (private mode, SSR) — the in-memory reset stands */
  }
}
