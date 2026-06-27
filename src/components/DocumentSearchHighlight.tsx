import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react'

/**
 * "Find in document" widget — Linear's in-doc search box. It takes the
 * document's plain text/markdown as a prop, finds case-insensitive matches of
 * the query, shows an "X/N" counter, and lets you step through matches with
 * Enter / ↑↓. Each active match renders a short CONTEXT SNIPPET (the
 * surrounding ~60 chars, with the hit wrapped in a <mark>) so you can preview a
 * result without us having to re-highlight the externally-rendered Markdown
 * (which would be brittle to reach into). The parent decides where to scroll;
 * we just report the active match via `onActiveMatchChange`.
 */

/** A single match: its start offset in `text` and length of the matched run. */
interface Match {
  start: number
  end: number
}

/** Characters of context to show on either side of a match in the snippet. */
const SNIPPET_RADIUS = 60

/**
 * Find every case-insensitive occurrence of `query` in `text`. Non-overlapping,
 * left-to-right. Returns [] for an empty/whitespace-only query so the UI can
 * cleanly fall back to its idle state.
 */
function findMatches(text: string, query: string): Match[] {
  const q = query.toLowerCase()
  if (!q.trim()) return []
  const hay = text.toLowerCase()
  const out: Match[] = []
  let from = 0
  // indexOf-walk avoids RegExp escaping pitfalls and is plenty fast for a doc.
  for (let i = hay.indexOf(q, from); i !== -1; i = hay.indexOf(q, from)) {
    out.push({ start: i, end: i + q.length })
    from = i + q.length
  }
  return out
}

export function DocumentSearchHighlight({
  text,
  onActiveMatchChange,
}: {
  text: string
  onActiveMatchChange?: (index: number, total: number) => void
}) {
  const [query, setQuery] = useState('')
  // Index of the focused match within `matches` (clamped on every recompute).
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => findMatches(text, query), [text, query])
  // Keep `active` in range whenever the match set shrinks (e.g. query edit).
  const clamped = matches.length === 0 ? 0 : Math.min(active, matches.length - 1)

  // Focus the input on mount — opening the find bar should let you type at once.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // A fresh query resets the cursor to the first hit (mirrors browser find).
  useEffect(() => {
    setActive(0)
  }, [query])

  // Report the active match upward so the parent can scroll the doc if it wants.
  useEffect(() => {
    onActiveMatchChange?.(matches.length === 0 ? -1 : clamped, matches.length)
  }, [clamped, matches.length, onActiveMatchChange])

  const step = (delta: number) => {
    if (matches.length === 0) return
    // Wrap around in both directions, like Linear / the browser find bar.
    setActive((i) => {
      const cur = Math.min(i, matches.length - 1)
      return (cur + delta + matches.length) % matches.length
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      step(e.shiftKey ? -1 : 1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      step(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      step(-1)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      // Escape clears the query (a second press is the parent's cue to close).
      setQuery('')
    }
  }

  // Build the context snippet for the active match: ~60 chars on each side with
  // the matched run wrapped in <mark>. Ellipses signal truncation at the edges.
  const snippet = useMemo(() => {
    if (matches.length === 0) return null
    const m = matches[clamped]
    const from = Math.max(0, m.start - SNIPPET_RADIUS)
    const to = Math.min(text.length, m.end + SNIPPET_RADIUS)
    return {
      before: (from > 0 ? '…' : '') + text.slice(from, m.start),
      hit: text.slice(m.start, m.end),
      after: text.slice(m.end, to) + (to < text.length ? '…' : ''),
    }
  }, [matches, clamped, text])

  const hasQuery = query.trim().length > 0

  return (
    <div className="w-80 rounded-lg border border-border bg-bg shadow-lg">
      {/* Search row — input, counter, steppers, close. */}
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <Search size={14} className="shrink-0 text-faint" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Find in document…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
        />
        {hasQuery && (
          <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-faint">
            {matches.length === 0 ? '0/0' : `${clamped + 1}/${matches.length}`}
          </span>
        )}
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            title="Previous match"
            disabled={matches.length === 0}
            onClick={() => step(-1)}
            className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-faint"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            title="Next match"
            disabled={matches.length === 0}
            onClick={() => step(1)}
            className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-faint"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            title="Clear search"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Context snippet for the active match — only when there's something to
          preview. Mirrors the doc body text with the hit highlighted. */}
      {hasQuery && (
        <div className="border-t border-border px-3 py-2 text-[12px] leading-relaxed text-muted">
          {snippet ? (
            <p className="whitespace-pre-wrap break-words">
              {snippet.before}
              <mark className="rounded bg-[var(--status-started)]/30 px-0.5 text-fg">
                {snippet.hit}
              </mark>
              {snippet.after}
            </p>
          ) : (
            <span className="text-faint">No matches</span>
          )}
        </div>
      )}
    </div>
  )
}
