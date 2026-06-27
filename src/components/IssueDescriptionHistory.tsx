import { useStore, useDisplayName } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { Popover } from './ui/Popover'
import { Avatar } from './Avatar'
import { formatFullDate, timeAgo } from '@/lib/utils'
import { History, RotateCcw } from 'lucide-react'

/** Strip markdown noise and collapse whitespace into a short one-line preview. */
function previewOf(body: string): string {
  const text = body
    .replace(/[#>*_`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 80 ? `${text.slice(0, 80)}…` : text || 'Empty description'
}

/**
 * A small "History" affordance next to the issue description — mirrors Linear's
 * ability to inspect and roll back to a prior version of an issue's body.
 * Lists previous versions newest-first (relative time + author + a short
 * preview) with a per-version "Restore" that swaps the description back,
 * capturing the current one as a new version first. Renders nothing until the
 * issue has at least one prior version.
 */
export function IssueDescriptionHistory({ issue }: { issue: Issue }) {
  const restoreIssueDescription = useStore((s) => s.restoreIssueDescription)
  const users = useStore((s) => s.users)
  const fmt = useDisplayName()

  const history = issue.descriptionHistory ?? []
  if (history.length === 0) return null

  return (
    <Popover
      align="end"
      width={320}
      trigger={
        <span
          className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-faint hover:bg-bg-hover hover:text-fg"
          title="Description history"
        >
          <History size={12} />
          History
        </span>
      }
    >
      {(close) => (
        <div className="max-h-80 overflow-y-auto">
          <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
            Description history
          </div>
          {history.map((v, i) => {
            const author = users.find((u) => u.id === v.userId)
            return (
              <div
                key={`${v.at}-${i}`}
                className="group/ver flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-bg-hover"
              >
                <Avatar user={author} size={18} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[12px]">
                    <span className="text-fg">
                      {author ? fmt(author.name) : 'Someone'}
                    </span>
                    <span className="text-faint" title={formatFullDate(v.at)}>
                      {timeAgo(v.at)}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted">
                    {previewOf(v.body)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    restoreIssueDescription(issue.id, i)
                    close()
                  }}
                  className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted opacity-0 hover:bg-bg-tertiary hover:text-fg group-hover/ver:opacity-100"
                  title="Restore this version"
                >
                  <RotateCcw size={11} />
                  Restore
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Popover>
  )
}
