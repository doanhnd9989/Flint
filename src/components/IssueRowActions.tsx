import { useNavigate } from 'react-router-dom'
import { Link2, PanelRight, ArrowUpRight, MoreHorizontal } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { issueUrl } from '@/lib/utils'
import { copyToClipboard, copyToast } from '@/lib/toast'

/**
 * Hover quick-actions toolbar for a list row — Linear reveals a small cluster of
 * icon buttons on the right of a row when you hover it: copy the issue URL, open
 * it in the peek panel, open the full page, and a ⋯ that drops the same row
 * context menu. Hidden by default (opacity-0) so it never disturbs row layout,
 * faded in via the row's `group-hover`. Every button stops propagation so the
 * click never bubbles up to open the row's peek.
 */
export function IssueRowActions({ issue }: { issue: Issue }) {
  const navigate = useNavigate()
  const { setPeek, openContextMenu } = useStoreShallow((s) => ({
    setPeek: s.setPeek,
    openContextMenu: s.openContextMenu,
  }))

  const btn =
    'flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-selected hover:text-fg'

  return (
    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        className={btn}
        title="Copy issue URL"
        onClick={(e) => {
          e.stopPropagation()
          copyToClipboard(issueUrl(issue.identifier), copyToast.url())
        }}
      >
        <Link2 size={14} />
      </button>
      <button
        type="button"
        className={btn}
        title="Open in peek"
        onClick={(e) => {
          e.stopPropagation()
          setPeek(issue.id)
        }}
      >
        <PanelRight size={14} />
      </button>
      <button
        type="button"
        className={btn}
        title="Open full page"
        onClick={(e) => {
          e.stopPropagation()
          navigate(`/issue/${issue.identifier}`)
        }}
      >
        <ArrowUpRight size={14} />
      </button>
      <button
        type="button"
        className={btn}
        title="More options"
        onClick={(e) => {
          e.stopPropagation()
          const r = e.currentTarget.getBoundingClientRect()
          openContextMenu(issue.id, r.left, r.bottom)
        }}
      >
        <MoreHorizontal size={14} />
      </button>
    </div>
  )
}
