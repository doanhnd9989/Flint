// Carries the resolved workspace id through a GraphQL request.
//
// The GraphQL resolvers reach the document from ~90 places, most of them field
// resolvers that never see the context argument. Threading an id through all of
// them would be churn with a bug in every line it missed; an AsyncLocalStorage
// scope set once at the transport boundary cannot be forgotten by a resolver.
import { AsyncLocalStorage } from 'node:async_hooks'

const storage = new AsyncLocalStorage()

export function runInWorkspace(workspaceId, fn) {
  if (!workspaceId) throw new Error('runInWorkspace: a workspaceId is required')
  return storage.run({ workspaceId }, fn)
}

/** The workspace of the request in flight. Throws outside a scope — that would
 *  mean an unscoped read, which is the bug this module exists to prevent. */
export function currentWorkspaceId() {
  const store = storage.getStore()
  if (!store?.workspaceId) throw new Error('No workspace in context for this request')
  return store.workspaceId
}
