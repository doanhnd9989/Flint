import type { Issue } from '@/lib/types'

/** Average adult silent reading speed, words per minute. */
const WPM = 200

/**
 * A subtle word-count / reading-time line under a long issue description —
 * mirrors the metadata Linear surfaces on lengthy specs. Renders nothing for
 * short descriptions (~under 280 chars) to avoid clutter.
 */
export function IssueDescriptionMeta({ issue }: { issue: Issue }) {
  const text = issue.description?.trim() ?? ''
  if (text.length < 280) return null

  // Strip markdown noise just enough to count words sensibly.
  const words = text
    .replace(/[#>*_`~\-|]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  if (words === 0) return null

  const minutes = Math.max(1, Math.round(words / WPM))

  return (
    <div className="mt-1 text-[11px] text-faint">
      {words.toLocaleString()} words · {minutes} min read
    </div>
  )
}
