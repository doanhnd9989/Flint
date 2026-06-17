import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  ExternalLink,
  Link2,
  Pencil,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { Popover } from './ui/Popover'
import { LinkFavicon, linkHost } from './LinkFavicon'
import { copyToClipboard } from '@/lib/toast'
import { timeAgo } from '@/lib/utils'

const menuRow =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

/**
 * Linear's "Resources" section — external links attached to an issue. Shown
 * between the sub-issues and the activity feed. Hidden entirely when the issue
 * has no links (matching Linear; the first link is added from the issue's
 * context menu / "Add link…").
 */
export function IssueLinks({ issue }: { issue: Issue }) {
  const { issueLinks, openLinkModal, removeIssueLink } = useStoreShallow((s) => ({
    issueLinks: s.issueLinks,
    openLinkModal: s.openLinkModal,
    removeIssueLink: s.removeIssueLink,
  }))
  const [collapsed, setCollapsed] = useState(false)

  const links = issueLinks
    .filter((l) => l.issueId === issue.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  if (links.length === 0) return null

  return (
    <div className="mt-6">
      <div className="mb-1 flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1 rounded px-0.5 text-[12px] font-medium text-faint hover:text-fg"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          Resources
        </button>
        <button
          onClick={() => openLinkModal(issue.id)}
          title="Add link"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-faint hover:bg-bg-hover hover:text-fg"
        >
          <Plus size={14} />
        </button>
      </div>

      {!collapsed && (
        <div className="divide-y divide-border rounded-md border border-border">
          {links.map((link) => (
            <div
              key={link.id}
              className="group flex items-center gap-2.5 px-3 py-2 hover:bg-bg-hover"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2.5"
              >
                <LinkFavicon url={link.url} size={16} />
                <span className="truncate text-[13px] font-medium text-fg">
                  {link.title || linkHost(link.url)}
                </span>
              </a>
              <span className="shrink-0 text-[11px] text-faint">
                {timeAgo(link.createdAt)}
              </span>
              <Popover
                width={180}
                align="end"
                trigger={
                  <span className="flex h-6 w-6 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-selected group-hover:opacity-100">
                    <MoreHorizontal size={15} />
                  </span>
                }
              >
                {(close) => (
                  <>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={close}
                      className={menuRow}
                    >
                      <ExternalLink size={14} className="text-faint" />
                      Open link
                    </a>
                    <button
                      onClick={() => {
                        copyToClipboard(link.url, 'Link copied to clipboard')
                        close()
                      }}
                      className={menuRow}
                    >
                      <Link2 size={14} className="text-faint" />
                      Copy link
                    </button>
                    <div className="my-1 h-px bg-border" />
                    <button
                      onClick={() => {
                        openLinkModal(issue.id, link.id)
                        close()
                      }}
                      className={menuRow}
                    >
                      <Pencil size={14} className="text-faint" />
                      Edit…
                    </button>
                    <button
                      onClick={() => {
                        removeIssueLink(link.id)
                        close()
                      }}
                      className={`${menuRow} hover:text-[var(--priority-urgent)]`}
                    >
                      <Trash2 size={14} className="text-faint" />
                      Remove…
                    </button>
                  </>
                )}
              </Popover>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
