import { create } from 'zustand'

/**
 * Transient "quote reply" hand-off — Linear's quote-reply seeds the thread's
 * reply composer with the quoted text. Kept in a tiny non-persisted store so a
 * comment's ⋯ menu can prime the root thread's composer (keyed by root id)
 * without threading callbacks through every comment row.
 */
interface ReplyDraftState {
  drafts: Record<string, string>
  /** Seed (and open) the reply composer for a thread root. */
  set: (rootId: string, body: string) => void
  /** Consume + clear the draft once the composer has picked it up. */
  clear: (rootId: string) => void
}

export const useReplyDraft = create<ReplyDraftState>((set) => ({
  drafts: {},
  set: (rootId, body) =>
    set((s) => ({ drafts: { ...s.drafts, [rootId]: body } })),
  clear: (rootId) =>
    set((s) => {
      const drafts = { ...s.drafts }
      delete drafts[rootId]
      return { drafts }
    }),
}))

/** Markdown blockquote of a comment body (each line prefixed with "> "). */
export function quoteOf(body: string): string {
  return (
    body
      .trim()
      .split('\n')
      .map((l) => `> ${l}`)
      .join('\n') + '\n\n'
  )
}
