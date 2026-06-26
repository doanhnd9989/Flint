import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import type { Activity, ActivityKind } from '@/lib/types'
import { useStore, useDisplayName } from '@/lib/store'
import { formatFullDate, timeAgo } from '@/lib/utils'
import { Avatar } from './Avatar'

/** Cap on how many entries we render (newest first), matching Linear's paging. */
const MAX_ROWS = 100

/** Human label for each activity kind, used by the type filter + CSV header. */
const KIND_LABELS: Record<ActivityKind, string> = {
  created: 'Created issue',
  status: 'Changed status',
  priority: 'Changed priority',
  assignee: 'Changed assignee',
  label: 'Changed label',
  project: 'Changed project',
  milestone: 'Changed milestone',
  cycle: 'Changed cycle',
  title: 'Renamed issue',
  estimate: 'Changed estimate',
  dueDate: 'Changed due date',
  link: 'Added link',
  parent: 'Changed parent',
  description: 'Updated description',
}

const kindLabel = (kind: ActivityKind): string => KIND_LABELS[kind] ?? 'Updated issue'

/**
 * A concise, self-contained sentence describing an activity — no pills, just
 * the verb phrase. Kept local (rather than reusing ActivityItem) so the row
 * layout can place the issue chip + timestamp exactly where Linear does.
 */
function sentence(a: Activity): string {
  switch (a.kind) {
    case 'created':
      return 'created the issue'
    case 'status':
      return a.from ? 'changed the status' : 'set the status'
    case 'priority':
      return a.from && a.from !== '0' ? 'changed the priority' : 'set the priority'
    case 'assignee':
      return a.to ? 'changed the assignee' : 'removed the assignee'
    case 'label':
      return a.to ? 'added a label' : 'removed a label'
    case 'project':
      return a.to ? 'added the issue to a project' : 'removed the issue from a project'
    case 'milestone':
      return a.to ? 'set the milestone' : 'removed the milestone'
    case 'cycle':
      return a.to ? 'added the issue to a cycle' : 'removed the issue from a cycle'
    case 'title':
      return 'renamed the issue'
    case 'estimate':
      return a.to ? 'set the estimate' : 'removed the estimate'
    case 'dueDate':
      return a.to ? 'set the due date' : 'removed the due date'
    case 'link':
      return 'added a link'
    case 'parent':
      return a.to ? 'set the parent issue' : 'removed the parent issue'
    default:
      return 'updated the issue'
  }
}

/** Quote a CSV cell, escaping embedded quotes per RFC 4180. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * Audit log admin page — a chronological, filterable record of every change
 * made across the workspace, driven by the store's issue activity history.
 */
export function AuditLogSettings() {
  const activities = useStore((s) => s.activities)
  const issues = useStore((s) => s.issues)
  const users = useStore((s) => s.users)
  const fmt = useDisplayName()

  const [actorFilter, setActorFilter] = useState<string>('all')
  const [kindFilter, setKindFilter] = useState<string>('all')

  // Distinct activity kinds actually present, ordered by their canonical order.
  const presentKinds = useMemo(() => {
    const order = Object.keys(KIND_LABELS) as ActivityKind[]
    const seen = new Set(activities.map((a) => a.kind))
    return order.filter((k) => seen.has(k))
  }, [activities])

  // Newest-first, filtered, then capped to MAX_ROWS.
  const filtered = useMemo(() => {
    return activities
      .filter((a) => actorFilter === 'all' || a.userId === actorFilter)
      .filter((a) => kindFilter === 'all' || a.kind === kindFilter)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [activities, actorFilter, kindFilter])

  const visible = filtered.slice(0, MAX_ROWS)
  const truncated = filtered.length > MAX_ROWS

  const userById = (id: string) => users.find((u) => u.id === id)
  const issueById = (id: string) => issues.find((i) => i.id === id)

  /** Build a CSV of the visible rows and trigger a client-side download. */
  const exportLog = () => {
    const header = ['Date', 'Actor', 'Action', 'Issue']
    const rows = visible.map((a) => {
      const actor = userById(a.userId)
      const issue = issueById(a.issueId)
      return [
        formatFullDate(a.createdAt),
        actor?.name ?? 'Unknown',
        kindLabel(a.kind),
        issue?.identifier ?? '',
      ]
    })
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'audit-log.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const selectClass =
    'rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none hover:border-border-strong focus:border-accent'

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-fg">Audit log</h1>
          <p className="mt-1 text-[13px] text-muted">
            A record of changes made across your workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={exportLog}
          disabled={visible.length === 0}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={14} />
          Export log
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="mt-16 text-center text-[13px] text-muted">
          No activity recorded yet.
        </div>
      ) : (
        <div className="mt-7">
          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by member"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">All members</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {fmt(u.name)}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by type"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">All events</option>
              {presentKinds.map((k) => (
                <option key={k} value={k}>
                  {kindLabel(k)}
                </option>
              ))}
            </select>
          </div>

          {/* Log */}
          {visible.length === 0 ? (
            <div className="rounded-xl border border-border py-12 text-center text-[13px] text-muted">
              No matching activity.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {visible.map((a) => {
                const actor = userById(a.userId)
                const issue = issueById(a.issueId)
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-2.5 px-4 py-3 text-[13px]"
                  >
                    <Avatar user={actor} size={20} />
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="font-medium text-fg">
                        {fmt(actor?.name) || 'Unknown'}
                      </span>
                      <span className="text-muted">{sentence(a)}</span>
                      {issue &&
                        (issue.identifier ? (
                          <Link
                            to={`/issue/${issue.identifier}`}
                            className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-faint hover:text-fg"
                          >
                            {issue.identifier}
                          </Link>
                        ) : null)}
                    </div>
                    <span
                      className="ml-auto shrink-0 text-[12px] text-faint"
                      title={formatFullDate(a.createdAt)}
                    >
                      {timeAgo(a.createdAt)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {truncated && (
            <p className="mt-3 text-[12px] text-muted">
              Showing the {MAX_ROWS} most recent of {filtered.length} events.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
