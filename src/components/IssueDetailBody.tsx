import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import {
  StatusPicker,
  PriorityPicker,
  AssigneePicker,
  LabelPicker,
  ProjectPicker,
} from './pickers'
import { SelectMenu } from './ui/SelectMenu'
import { IssueRelations } from './IssueRelations'
import { MarkdownEditor } from './MarkdownEditor'
import { subIssueProgress } from '@/lib/selectors'
import { PRIORITY_LABELS, ESTIMATE_SCALE } from '@/lib/constants'
import { formatFullDate, timeAgo } from '@/lib/utils'
import { GitBranch, CornerLeftUp } from 'lucide-react'

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="w-20 shrink-0 pt-1 text-[12px] text-faint">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

const triggerCls =
  'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-fg hover:bg-bg-hover'

/**
 * The editable body + property sidebar of an issue. Shared by the full-page
 * `IssueDetail` view and the `IssuePeek` split panel.
 *
 * @param onOpenIssue called with a sub-issue identifier when a sub-issue is
 *        clicked — the page navigates, the peek re-targets itself.
 * @param compact tightens horizontal padding for the narrower peek panel.
 */
export function IssueDetailBody({
  issue,
  onOpenIssue,
  compact = false,
}: {
  issue: Issue
  onOpenIssue: (identifier: string) => void
  compact?: boolean
}) {
  const store = useStore()
  const [commentBody, setCommentBody] = useState('')

  const state = store.states.find((s) => s.id === issue.stateId)!
  const assignee = store.users.find((u) => u.id === issue.assigneeId)
  const project = store.projects.find((p) => p.id === issue.projectId)
  const issueLabels = issue.labelIds
    .map((id) => store.labels.find((l) => l.id === id))
    .filter(Boolean)
  const comments = store.comments
    .filter((c) => c.issueId === issue.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const subIssues = store.issues.filter((i) => i.parentId === issue.id)
  const progress = subIssueProgress(issue.id, store.issues, store)
  const parent = issue.parentId
    ? store.issues.find((i) => i.id === issue.parentId)
    : undefined
  const activities = store.activities
    .filter((a) => a.issueId === issue.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className={compact ? 'px-6 py-6' : 'mx-auto max-w-3xl px-10 py-8'}>
          {parent && (
            <button
              onClick={() => onOpenIssue(parent.identifier)}
              className="mb-2 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
            >
              <CornerLeftUp size={13} className="text-faint" />
              <span className="font-mono text-faint">{parent.identifier}</span>
              <span className="truncate">{parent.title}</span>
            </button>
          )}
          <input
            value={issue.title}
            onChange={(e) => store.setIssueTitle(issue.id, e.target.value)}
            className="w-full bg-transparent text-[22px] font-semibold text-fg outline-none"
            placeholder="Issue title"
          />
          <MarkdownEditor
            value={issue.description}
            onChange={(v) => store.setIssueDescription(issue.id, v)}
          />

          {/* Sub-issues */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-faint">Sub-issues</span>
                {progress.total > 0 && (
                  <>
                    <span className="text-[12px] text-muted">
                      {progress.done}/{progress.total}
                    </span>
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-bg-tertiary">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() =>
                  store.createIssue({
                    title: 'New sub-issue',
                    teamId: issue.teamId,
                    parentId: issue.id,
                    projectId: issue.projectId,
                  })
                }
                className="text-[12px] text-muted hover:text-fg"
              >
                + Add sub-issue
              </button>
            </div>
            {subIssues.length === 0 ? (
              <div className="text-[12px] text-faint">No sub-issues yet.</div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {subIssues.map((sub) => {
                  const sst = store.states.find((s) => s.id === sub.stateId)!
                  return (
                    <button
                      key={sub.id}
                      onClick={() => onOpenIssue(sub.identifier)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-bg-hover"
                    >
                      <StatusIcon type={sst.type} color={sst.color} />
                      <span className="font-mono text-[11px] text-faint">{sub.identifier}</span>
                      <span className="text-[13px] text-fg">{sub.title}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Relations */}
          <IssueRelations issue={issue} onOpenIssue={onOpenIssue} />

          {/* Activity + comments */}
          <div className="mt-8">
            <div className="mb-3 text-[12px] font-medium text-faint">Activity</div>
            <div className="space-y-3">
              {activities.map((a) => {
                const u = store.users.find((x) => x.id === a.userId)
                return (
                  <div key={a.id} className="flex items-center gap-2 text-[12px] text-muted">
                    <Avatar user={u} size={18} />
                    <span className="text-fg">{u?.name}</span>
                    <span>{a.kind === 'created' ? 'created the issue' : `changed ${a.kind}`}</span>
                    <span className="text-faint">· {timeAgo(a.createdAt)}</span>
                  </div>
                )
              })}
              {comments.map((c) => {
                const u = store.users.find((x) => x.id === c.userId)
                return (
                  <div key={c.id} className="flex gap-2">
                    <Avatar user={u} size={22} />
                    <div className="flex-1 rounded-lg border border-border bg-bg-secondary px-3 py-2">
                      <div className="mb-0.5 flex items-center gap-2 text-[12px]">
                        <span className="font-medium text-fg">{u?.name}</span>
                        <span className="text-faint">{timeAgo(c.createdAt)}</span>
                      </div>
                      <div className="text-[13px] text-fg whitespace-pre-wrap">{c.body}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <Avatar user={store.users.find((u) => u.isMe)} size={22} />
              <div className="flex-1">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Leave a comment…"
                  className="min-h-16 w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-fg outline-none focus:border-border-strong"
                />
                <div className="mt-1 flex justify-end">
                  <button
                    disabled={!commentBody.trim()}
                    onClick={() => {
                      store.addComment(issue.id, commentBody.trim())
                      setCommentBody('')
                    }}
                    className="rounded-md bg-accent px-3 py-1 text-[12px] text-white disabled:opacity-40 hover:bg-accent-hover"
                  >
                    Comment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <aside className="w-64 shrink-0 overflow-y-auto border-l border-border px-3 py-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-faint">
          Properties
        </div>
        <div className="mt-1">
          <PropRow label="Status">
            <StatusPicker
              stateId={issue.stateId}
              onChange={(id) => store.setIssueStatus(issue.id, id)}
              trigger={
                <span className={triggerCls}>
                  <StatusIcon type={state.type} color={state.color} />
                  {state.name}
                </span>
              }
            />
          </PropRow>
          <PropRow label="Priority">
            <PriorityPicker
              priority={issue.priority}
              onChange={(p) => store.setIssuePriority(issue.id, p)}
              trigger={
                <span className={triggerCls}>
                  <PriorityIcon priority={issue.priority} />
                  {PRIORITY_LABELS[issue.priority]}
                </span>
              }
            />
          </PropRow>
          <PropRow label="Assignee">
            <AssigneePicker
              assigneeId={issue.assigneeId}
              onChange={(id) => store.setIssueAssignee(issue.id, id)}
              trigger={
                <span className={triggerCls}>
                  <Avatar user={assignee} size={18} />
                  {assignee?.name ?? 'Unassigned'}
                </span>
              }
            />
          </PropRow>
          <PropRow label="Estimate">
            <SelectMenu
              options={ESTIMATE_SCALE.map((n) => ({
                id: String(n),
                label: n === 0 ? 'No estimate' : `${n} point${n > 1 ? 's' : ''}`,
                selected: issue.estimate === n,
              }))}
              onSelect={(id) =>
                store.setIssueEstimate(issue.id, Number(id) || undefined)
              }
              trigger={
                <span className={triggerCls}>
                  <GitBranch size={14} className="text-faint" />
                  {issue.estimate ? `${issue.estimate} pts` : 'No estimate'}
                </span>
              }
            />
          </PropRow>
        </div>

        <div className="mt-4 text-[11px] font-medium uppercase tracking-wide text-faint">
          Labels
        </div>
        <LabelPicker
          labelIds={issue.labelIds}
          onToggle={(id) => store.toggleIssueLabel(issue.id, id)}
          trigger={
            <span className="mt-1 flex flex-wrap items-center gap-1 rounded-md px-1.5 py-1 hover:bg-bg-hover">
              {issueLabels.length === 0 ? (
                <span className="text-[13px] text-faint">Add label</span>
              ) : (
                issueLabels.map((l) => (
                  <span
                    key={l!.id}
                    className="flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-[11px] text-muted"
                  >
                    <LabelDot color={l!.color} />
                    {l!.name}
                  </span>
                ))
              )}
            </span>
          }
        />

        <div className="mt-4 text-[11px] font-medium uppercase tracking-wide text-faint">
          Project
        </div>
        <ProjectPicker
          projectId={issue.projectId}
          onChange={(id) => store.setIssueProject(issue.id, id)}
          trigger={
            <span className={triggerCls + ' mt-1'}>
              {project ? (
                <>
                  <span>{project.icon}</span>
                  {project.name}
                </>
              ) : (
                <span className="text-faint">Add to project</span>
              )}
            </span>
          }
        />

        {issue.dueDate && (
          <div className="mt-4 text-[12px] text-muted">
            Due {formatFullDate(issue.dueDate)}
          </div>
        )}
      </aside>
    </div>
  )
}
