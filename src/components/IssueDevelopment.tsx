import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  GitPullRequest,
  ExternalLink,
  Trash2,
  MoreHorizontal,
  Check,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Issue, PullRequest, PullRequestStatus } from '@/lib/types'
import { Popover } from './ui/Popover'
import { Avatar } from './Avatar'
import { branchName, timeAgo } from '@/lib/utils'
import { copyToClipboard } from '@/lib/toast'

const menuRow =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

/** Ordered list of statuses + their human label and dot/icon color token. */
const STATUSES: { value: PullRequestStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'var(--status-backlog)' },
  { value: 'open', label: 'Open', color: 'var(--status-started)' },
  { value: 'merged', label: 'Merged', color: 'var(--accent)' },
  { value: 'closed', label: 'Closed', color: 'var(--status-canceled)' },
]

function statusMeta(status: PullRequestStatus) {
  return STATUSES.find((s) => s.value === status) ?? STATUSES[0]
}

/**
 * Review posture for a PR row. We have no review backend, so the review state
 * is derived from the PR's lifecycle status — the same summary Linear surfaces
 * next to a linked PR: drafts await review, open PRs need one, merged PRs are
 * approved, closed PRs no longer apply. Returns `null` when there's nothing
 * meaningful to show. Color is a token string for the dot.
 */
function reviewMeta(
  status: PullRequestStatus,
): { label: string; color: string } | null {
  switch (status) {
    case 'draft':
      return { label: 'In review', color: 'var(--status-backlog)' }
    case 'open':
      return { label: 'Review required', color: 'var(--status-started)' }
    case 'merged':
      return { label: 'Approved', color: 'var(--accent)' }
    case 'closed':
      return null
  }
}

/** The fixed CI suite we mock per PR — mirrors a typical GitHub Actions setup. */
const CHECK_NAMES = ['build', 'test', 'lint'] as const

/**
 * CI/checks summary for a PR row. We have no CI backend, so the result is
 * derived deterministically from the PR's lifecycle: merged → everything
 * passed, closed → the run failed, draft → still pending. An open PR's run is
 * pseudo-random but stable — the id's char-code sum decides pass vs. pending —
 * so a given PR always renders the same state. Returns the {@link CHECK_NAMES}
 * pass count, total, and a presentation token. `passed`/`failed`/`pending`.
 */
function checksMeta(pr: PullRequest): {
  state: 'passed' | 'failed' | 'pending'
  passed: number
  total: number
} {
  const total = CHECK_NAMES.length
  switch (pr.status) {
    case 'merged':
      return { state: 'passed', passed: total, total }
    case 'closed':
      return { state: 'failed', passed: 0, total }
    case 'draft':
      return { state: 'pending', passed: 0, total }
    case 'open': {
      // Stable per-PR coin flip from the id's char-code sum.
      const sum = [...pr.id].reduce((n, c) => n + c.charCodeAt(0), 0)
      return sum % 2 === 0
        ? { state: 'passed', passed: total, total }
        : { state: 'pending', passed: 0, total }
    }
  }
}

/**
 * Linear's "Development" section — linked GitHub-style pull requests / branches
 * on an issue. We have no VCS backend, so each PR is metadata the user attaches
 * (title + branch + status + optional URL). Mirrors {@link IssueLinks}' section
 * grammar: a collapsible header with a count and a circular add button, then a
 * bordered, divided list of rows. The header is always rendered so a PR can be
 * added even when the list is empty.
 */
export function IssueDevelopment({ issue }: { issue: Issue }) {
  const pullRequests = useStore((s) => s.pullRequests)
  const users = useStore((s) => s.users)
  const me = useStore((s) => s.currentUserId)
  const addPullRequest = useStore((s) => s.addPullRequest)
  const setPullRequestStatus = useStore((s) => s.setPullRequestStatus)
  const removePullRequest = useStore((s) => s.removePullRequest)

  const [collapsed, setCollapsed] = useState(false)

  const prs = useMemo(
    () =>
      pullRequests
        .filter((p) => p.issueId === issue.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [pullRequests, issue.id],
  )

  return (
    <div className="mt-6">
      <div className="mb-1 flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1 rounded px-0.5 text-[12px] font-medium text-faint hover:text-fg"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          Development
          {prs.length > 0 && (
            <span className="text-faint">{prs.length}</span>
          )}
        </button>
        <Popover
          width={300}
          align="end"
          trigger={
            <span
              title="Link pull request"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-faint hover:bg-bg-hover hover:text-fg"
            >
              <Plus size={14} />
            </span>
          }
        >
          {(close) => (
            <AddPrForm
              issue={issue}
              user={users.find((u) => u.id === me)}
              onAdd={(input) => {
                addPullRequest(issue.id, input)
                close()
              }}
            />
          )}
        </Popover>
      </div>

      {!collapsed && prs.length > 0 && (
        <div className="divide-y divide-border rounded-md border border-border">
          {prs.map((pr) => {
            const meta = statusMeta(pr.status)
            const review = reviewMeta(pr.status)
            const checks = checksMeta(pr)
            const author = users.find((u) => u.id === pr.authorId)
            return (
              <div
                key={pr.id}
                className="group flex items-center gap-2.5 px-3 py-2 hover:bg-bg-hover"
              >
                <GitPullRequest
                  size={16}
                  className="shrink-0"
                  style={{ color: meta.color }}
                />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {pr.url ? (
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[13px] font-medium text-fg hover:underline"
                    >
                      {pr.title}
                    </a>
                  ) : (
                    <span className="truncate text-[13px] font-medium text-fg">
                      {pr.title}
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-[11px] text-faint">
                    #{pr.number}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-px text-[11px] text-muted">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: meta.color }}
                    />
                    {meta.label}
                  </span>
                  {review && (
                    <span className="hidden shrink-0 items-center gap-1 rounded-full bg-secondary px-1.5 py-px text-[11px] text-muted sm:flex">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: review.color }}
                      />
                      {review.label}
                    </span>
                  )}
                  {checks.state === 'passed' && (
                    <span
                      title={`${checks.passed}/${checks.total} checks passed`}
                      className="hidden shrink-0 items-center gap-1 text-[11px] text-accent sm:flex"
                    >
                      <CheckCircle2 size={12} />
                      Checks passed
                    </span>
                  )}
                  {checks.state === 'pending' && (
                    <span
                      title="Checks running"
                      className="hidden shrink-0 items-center gap-1 text-[11px] text-muted sm:flex"
                    >
                      <Clock size={12} />
                      Checks running
                    </span>
                  )}
                  {checks.state === 'failed' && (
                    <span
                      title={`${checks.passed}/${checks.total} checks passed`}
                      className="hidden shrink-0 items-center gap-1 text-[11px] sm:flex"
                      style={{ color: 'var(--priority-urgent)' }}
                    >
                      <XCircle size={12} />
                      Checks failed
                      <span className="font-mono text-faint">
                        {checks.passed}/{checks.total}
                      </span>
                    </span>
                  )}
                  {pr.branch && (
                    <span className="hidden min-w-0 shrink truncate font-mono text-[11px] text-muted sm:inline">
                      {pr.branch}
                    </span>
                  )}
                </div>
                {author && <Avatar user={author} size={16} />}
                <span className="shrink-0 text-[11px] text-faint">
                  {timeAgo(pr.createdAt)}
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
                      {pr.url && (
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={close}
                          className={menuRow}
                        >
                          <ExternalLink size={14} className="text-faint" />
                          Open PR
                        </a>
                      )}
                      {pr.branch && (
                        <button
                          onClick={() => {
                            copyToClipboard(pr.branch!, 'Branch name copied')
                            close()
                          }}
                          className={menuRow}
                        >
                          <Copy size={14} className="text-faint" />
                          Copy branch name
                        </button>
                      )}
                      {(pr.url || pr.branch) && (
                        <div className="my-1 h-px bg-border" />
                      )}
                      {STATUSES.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => {
                            setPullRequestStatus(pr.id, s.value)
                            close()
                          }}
                          className={menuRow}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: s.color }}
                          />
                          {s.label}
                          {pr.status === s.value && (
                            <Check size={14} className="ml-auto text-faint" />
                          )}
                        </button>
                      ))}
                      <div className="my-1 h-px bg-border" />
                      <button
                        onClick={() => {
                          removePullRequest(pr.id)
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
            )
          })}
        </div>
      )}
    </div>
  )
}

type PrInput = Omit<
  PullRequest,
  'id' | 'issueId' | 'number' | 'authorId' | 'createdAt'
>

/** The inline "link a pull request" form inside the add-button popover. */
function AddPrForm({
  issue,
  user,
  onAdd,
}: {
  issue: Issue
  user?: { email?: string; name?: string }
  onAdd: (input: PrInput) => void
}) {
  const [title, setTitle] = useState(issue.title)
  const [branch, setBranch] = useState(() =>
    branchName(issue.identifier, issue.title, user),
  )
  const [status, setStatus] = useState<PullRequestStatus>('open')
  const [url, setUrl] = useState('')

  const submit = () => {
    const t = title.trim()
    if (!t) return
    onAdd({
      title: t,
      status,
      branch: branch.trim() || undefined,
      url: url.trim() || undefined,
    })
  }

  const field =
    'w-full rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent'

  return (
    <div
      className="flex flex-col gap-2 p-1"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Pull request title"
        className={field}
      />
      <input
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
        placeholder="branch-name"
        className={`${field} font-mono`}
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as PullRequestStatus)}
        className={field}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/… (optional)"
        className={field}
      />
      <button
        onClick={submit}
        disabled={!title.trim()}
        className="mt-0.5 w-full rounded-md bg-accent px-2 py-1.5 text-[13px] font-medium text-[var(--accent-text)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
      >
        Add
      </button>
    </div>
  )
}
