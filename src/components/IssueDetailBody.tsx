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
  SubscriberPicker,
} from './pickers'
import { SelectMenu } from './ui/SelectMenu'
import { IssueRelations } from './IssueRelations'
import { IssueLinks } from './IssueLinks'
import { MarkdownEditor } from './MarkdownEditor'
import { MentionInput } from './MentionInput'
import { CommentThread } from './CommentThread'
import { ActivityItem } from './ActivityItem'
import { DatePicker } from './DatePicker'
import { subIssueProgress, cycleState } from '@/lib/selectors'
import { PRIORITY_LABELS, ESTIMATE_SCALE } from '@/lib/constants'
import {
  cn,
  formatDate,
  formatFullDate,
  isDueSoon,
  isOverdue,
} from '@/lib/utils'
import {
  GitBranch,
  CornerLeftUp,
  Calendar,
  Flag,
  IterationCw,
  Bell,
  BellOff,
  Plus,
  X,
} from 'lucide-react'

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
  const projectMilestones = issue.projectId
    ? store.milestones.filter((m) => m.projectId === issue.projectId)
    : []
  const milestone = store.milestones.find((m) => m.id === issue.milestoneId)
  const teamCycles = store.cycles
    .filter((c) => c.teamId === issue.teamId)
    .sort((a, b) => a.number - b.number)
  const cycle = store.cycles.find((c) => c.id === issue.cycleId)
  const issueLabels = issue.labelIds
    .map((id) => store.labels.find((l) => l.id === id))
    .filter(Boolean)
  const comments = store.comments
    .filter((c) => c.issueId === issue.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  // Thread roots: top-level comments, plus replies whose parent was deleted.
  const commentIds = new Set(comments.map((c) => c.id))
  const threads = comments.filter((c) => !c.parentId || !commentIds.has(c.parentId))
  const subIssues = store.issues.filter((i) => i.parentId === issue.id)
  const progress = subIssueProgress(issue.id, store.issues, store)
  const parent = issue.parentId
    ? store.issues.find((i) => i.id === issue.parentId)
    : undefined
  // Ancestors of this issue — candidates for "add existing sub-issue" must
  // exclude them (and this issue itself, and current sub-issues) to avoid cycles.
  const ancestorIds = new Set<string>()
  {
    let cursor = issue.parentId
    while (cursor) {
      ancestorIds.add(cursor)
      cursor = store.issues.find((i) => i.id === cursor)?.parentId
    }
  }
  const addSubIssueOptions = [
    { id: '__new', label: 'Create new sub-issue', icon: <Plus size={14} /> },
    ...store.issues
      .filter(
        (i) =>
          i.id !== issue.id &&
          i.parentId !== issue.id &&
          !ancestorIds.has(i.id) &&
          !i.triage,
      )
      .map((i) => {
        const st = store.states.find((s) => s.id === i.stateId)!
        return {
          id: i.id,
          label: i.title,
          hint: i.identifier,
          keywords: `${i.identifier} ${i.title}`,
          icon: <StatusIcon type={st.type} color={st.color} />,
        }
      }),
  ]
  const activities = store.activities
    .filter((a) => a.issueId === issue.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const subscribers = [...new Set(issue.subscriberIds)]
    .map((id) => store.users.find((u) => u.id === id))
    .filter(Boolean)
  const isSubscribed = issue.subscriberIds.includes(store.currentUserId)

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className={compact ? 'px-6 py-6' : 'mx-auto max-w-3xl px-10 py-8'}>
          {parent && (
            <div className="group/parent mb-2 flex items-center gap-0.5">
              <button
                onClick={() => onOpenIssue(parent.identifier)}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
              >
                <CornerLeftUp size={13} className="text-faint" />
                <span className="font-mono text-faint">{parent.identifier}</span>
                <span className="truncate">{parent.title}</span>
              </button>
              <button
                onClick={() => store.setIssueParent(issue.id, undefined)}
                className="rounded p-1 text-faint opacity-0 hover:text-[var(--priority-urgent)] group-hover/parent:opacity-100"
                title="Remove parent"
              >
                <X size={12} />
              </button>
            </div>
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
              <SelectMenu
                options={addSubIssueOptions}
                onSelect={(id) => {
                  if (id === '__new') {
                    store.createIssue({
                      title: 'New sub-issue',
                      teamId: issue.teamId,
                      parentId: issue.id,
                      projectId: issue.projectId,
                    })
                  } else {
                    store.setIssueParent(id, issue.id)
                  }
                }}
                placeholder="Add sub-issue…"
                width={280}
                align="end"
                trigger={
                  <span className="text-[12px] text-muted hover:text-fg">+ Add sub-issue</span>
                }
              />
            </div>
            {subIssues.length === 0 ? (
              <div className="text-[12px] text-faint">No sub-issues yet.</div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {subIssues.map((sub) => {
                  const sst = store.states.find((s) => s.id === sub.stateId)!
                  return (
                    <div
                      key={sub.id}
                      className="group/sub flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover"
                    >
                      <button
                        onClick={() => onOpenIssue(sub.identifier)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        <StatusIcon type={sst.type} color={sst.color} />
                        <span className="font-mono text-[11px] text-faint">{sub.identifier}</span>
                        <span className="text-[13px] text-fg">{sub.title}</span>
                      </button>
                      <button
                        onClick={() => store.setIssueParent(sub.id, undefined)}
                        className="text-faint opacity-0 hover:text-[var(--priority-urgent)] group-hover/sub:opacity-100"
                        title="Remove sub-issue"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Resources (external links) */}
          <IssueLinks issue={issue} />

          {/* Relations */}
          <IssueRelations issue={issue} onOpenIssue={onOpenIssue} />

          {/* Activity + comments */}
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12px] font-medium text-faint">Activity</span>
              <button
                onClick={() =>
                  store.toggleIssueSubscriber(issue.id, store.currentUserId)
                }
                title={
                  isSubscribed
                    ? "You'll be notified of any changes. Click to unsubscribe."
                    : 'Get notified of any changes to this issue.'
                }
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
              >
                {isSubscribed ? <BellOff size={13} /> : <Bell size={13} />}
                {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
              </button>
            </div>
            <div className="space-y-3">
              {activities.map((a) => (
                <ActivityItem key={a.id} activity={a} />
              ))}
              {threads.map((c) => (
                <CommentThread
                  key={c.id}
                  root={c}
                  replies={comments.filter((r) => r.parentId === c.id)}
                />
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <Avatar user={store.users.find((u) => u.isMe)} size={22} />
              <div className="flex-1">
                <MentionInput
                  value={commentBody}
                  onChange={setCommentBody}
                  placeholder="Leave a comment… (@ to mention)"
                  minHeight={64}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && commentBody.trim()) {
                      store.addComment(issue.id, commentBody.trim())
                      setCommentBody('')
                    }
                  }}
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
          {teamCycles.length > 0 && (
            <PropRow label="Cycle">
              <SelectMenu
                options={[
                  { id: '__none', label: 'No cycle', selected: !issue.cycleId },
                  ...teamCycles.map((c) => {
                    const cs = cycleState(c.startsAt, c.endsAt, Date.now())
                    return {
                      id: c.id,
                      label: c.name ?? `Cycle ${c.number}`,
                      keywords: String(c.number),
                      hint:
                        cs.status === 'active'
                          ? 'Active'
                          : cs.status === 'upcoming'
                            ? 'Upcoming'
                            : `${formatDate(c.startsAt)} – ${formatDate(c.endsAt)}`,
                      selected: issue.cycleId === c.id,
                    }
                  }),
                ]}
                onSelect={(id) =>
                  store.setIssueCycle(issue.id, id === '__none' ? undefined : id)
                }
                trigger={
                  <span className={triggerCls}>
                    <IterationCw size={14} className="text-faint" />
                    {cycle ? (
                      cycle.name ?? `Cycle ${cycle.number}`
                    ) : (
                      <span className="text-faint">No cycle</span>
                    )}
                  </span>
                }
              />
            </PropRow>
          )}
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
          <PropRow label="Due date">
            <DatePicker
              value={issue.dueDate}
              onChange={(iso) => store.setIssueDueDate(issue.id, iso)}
              trigger={
                <span className={triggerCls}>
                  <Calendar size={14} className="text-faint" />
                  {issue.dueDate ? (
                    <span
                      className={cn(
                        isOverdue(issue.dueDate)
                          ? 'text-[var(--priority-urgent)]'
                          : isDueSoon(issue.dueDate)
                            ? 'text-[var(--status-started)]'
                            : 'text-fg',
                      )}
                    >
                      {formatFullDate(issue.dueDate)}
                    </span>
                  ) : (
                    <span className="text-faint">Set due date</span>
                  )}
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

        {projectMilestones.length > 0 && (
          <>
            <div className="mt-4 text-[11px] font-medium uppercase tracking-wide text-faint">
              Milestone
            </div>
            <SelectMenu
              options={[
                { id: '__none', label: 'No milestone', selected: !issue.milestoneId },
                ...projectMilestones.map((m) => ({
                  id: m.id,
                  label: m.name,
                  selected: issue.milestoneId === m.id,
                })),
              ]}
              onSelect={(id) =>
                store.setIssueMilestone(issue.id, id === '__none' ? undefined : id)
              }
              trigger={
                <span className={triggerCls + ' mt-1'}>
                  <Flag size={13} className="text-faint" />
                  {milestone?.name ?? (
                    <span className="text-faint">No milestone</span>
                  )}
                </span>
              }
            />
          </>
        )}

        <div className="mt-4 text-[11px] font-medium uppercase tracking-wide text-faint">
          Subscribers
        </div>
        <SubscriberPicker
          subscriberIds={issue.subscriberIds}
          onToggle={(id) => store.toggleIssueSubscriber(issue.id, id)}
          trigger={
            <span className="mt-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-bg-hover">
              {subscribers.length === 0 ? (
                <span className="text-[13px] text-faint">Add subscribers</span>
              ) : (
                <>
                  <span className="flex -space-x-1">
                    {subscribers.slice(0, 5).map((u) => (
                      <span
                        key={u!.id}
                        className="rounded-full ring-1 ring-bg"
                        title={u!.name}
                      >
                        <Avatar user={u!} size={20} />
                      </span>
                    ))}
                  </span>
                  <span className="text-[12px] text-muted">
                    {subscribers.length === 1
                      ? subscribers[0]!.name
                      : `${subscribers.length} subscribers`}
                  </span>
                </>
              )}
            </span>
          }
        />
      </aside>
    </div>
  )
}
