import { useState } from 'react'
import type { Activity } from '@/lib/types'
import { ChevronDown, ChevronRight } from 'lucide-react'

/** One diff line and whether it was added / removed / unchanged. */
interface DiffLine {
  text: string
  kind: 'add' | 'del' | 'same'
}

/**
 * Cheap line-level diff (LCS over lines) good enough to visualise an edit. We
 * walk both line arrays building an LCS table, then emit removed (from-only),
 * added (to-only) and unchanged lines in order.
 */
function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const n = a.length
  const m = b.length
  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ text: a[i], kind: 'same' })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ text: a[i], kind: 'del' })
      i++
    } else {
      out.push({ text: b[j], kind: 'add' })
      j++
    }
  }
  while (i < n) out.push({ text: a[i++], kind: 'del' })
  while (j < m) out.push({ text: b[j++], kind: 'add' })
  return out
}

/**
 * The expandable "Show changes" affordance for a `description` activity. When
 * the activity carries before/after text (`from` / `to`) we render a compact
 * line-level diff — added lines green, removed lines red. Degrades gracefully:
 * if either side is absent there's nothing meaningful to diff, so we render
 * nothing and the parent shows just the plain "updated the description" line.
 */
export function ActivityDescriptionDiff({ activity }: { activity: Activity }) {
  const [open, setOpen] = useState(false)
  const a = activity

  // `from === 'edit'` is the sentinel marker, not real text — treat as absent.
  const before = a.from && a.from !== 'edit' ? a.from : undefined
  const after = a.to && a.to !== 'edit' ? a.to : undefined

  // Need at least one side of actual text to show a diff.
  if (before == null && after == null) return null

  const lines = lineDiff(before ?? '', after ?? '')
  if (lines.every((l) => l.kind === 'same')) return null

  return (
    <div className="ml-[26px]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded px-0.5 text-[11px] text-faint hover:text-fg"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {open ? 'Hide changes' : 'Show changes'}
      </button>
      {open && (
        <div className="mt-1 overflow-hidden rounded-md border border-border font-mono text-[11px] leading-relaxed">
          {lines.map((l, idx) => (
            <div
              key={idx}
              className="flex gap-2 px-2 py-px"
              style={{
                backgroundColor:
                  l.kind === 'add'
                    ? 'color-mix(in srgb, var(--status-completed) 12%, transparent)'
                    : l.kind === 'del'
                      ? 'color-mix(in srgb, var(--priority-urgent) 12%, transparent)'
                      : 'transparent',
              }}
            >
              <span
                className="select-none"
                style={{
                  color:
                    l.kind === 'add'
                      ? 'var(--status-completed)'
                      : l.kind === 'del'
                        ? 'var(--priority-urgent)'
                        : 'var(--text-tertiary)',
                }}
              >
                {l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}
              </span>
              <span
                className={
                  l.kind === 'same'
                    ? 'whitespace-pre-wrap break-words text-muted'
                    : 'whitespace-pre-wrap break-words text-fg'
                }
              >
                {l.text || ' '}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
