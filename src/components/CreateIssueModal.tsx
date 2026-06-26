import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore, useDisplayName } from '@/lib/store'
import type { Priority } from '@/lib/types'
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
import { FileText, IterationCw, GitBranch, Flag, X } from 'lucide-react'
import {
  PRIORITY_LABELS,
  estimatePoints,
  estimateLabel,
  teamEstimationType,
} from '@/lib/constants'
import { cycleState } from '@/lib/selectors'
import { formatDate } from '@/lib/utils'

const chip =
  'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover'

export function CreateIssueModal() {
  const navigate = useNavigate()
  const store = useStore()
  const fmt = useDisplayName()
  const open = store.createOpen
  const teams = store.teams
  const states = store.states

  const [teamId, setTeamId] = useState(teams[0].id)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stateId, setStateId] = useState(
    states.find((s) => s.type === 'unstarted')?.id ?? states[0].id,
  )
  const [priority, setPriority] = useState<Priority>(0)
  const [assigneeId, setAssigneeId] = useState<string | undefined>()
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [projectId, setProjectId] = useState<string | undefined>()
  const [cycleId, setCycleId] = useState<string | undefined>()
  const [estimate, setEstimate] = useState<number | undefined>()
  const [milestoneId, setMilestoneId] = useState<string | undefined>()
  // Lines parsed from a multi-line paste into the title input. When non-empty,
  // we surface a "Create N issues" affordance (Linear's paste-to-create).
  const [pasteLines, setPasteLines] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      const p = store.createPrefill
      setTitle('')
      setDescription('')
      setPriority(p?.priority ?? 0)
      setAssigneeId(p?.assigneeId ?? (store.preferences.autoAssignSelf ? store.currentUserId : undefined))
      setLabelIds(p?.labelIds ?? [])
      setProjectId(p?.projectId)
      setCycleId(undefined)
      setEstimate(undefined)
      setMilestoneId(undefined)
      setPasteLines([])
      if (p?.teamId) setTeamId(p.teamId)
      if (p?.stateId) setStateId(p.stateId)
    }
    // Only re-seed when the modal opens, not on every store change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) store.setCreateOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, store])

  if (!open) return null

  const state = states.find((s) => s.id === stateId)!
  const team = teams.find((t) => t.id === teamId)!
  const assignee = store.users.find((u) => u.id === assigneeId)
  const project = store.projects.find((p) => p.id === projectId)
  const teamCycles = store.cycles
    .filter((c) => c.teamId === teamId)
    .sort((a, b) => a.number - b.number)
  const cycle = store.cycles.find((c) => c.id === cycleId)
  const projectMilestones = projectId
    ? store.milestones
        .filter((m) => m.projectId === projectId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : []
  const milestone = store.milestones.find((m) => m.id === milestoneId)

  function applyTemplate(id: string) {
    const t = store.templates.find((x) => x.id === id)
    if (!t) return
    if (t.teamId) setTeamId(t.teamId)
    setTitle(t.title)
    setDescription(t.description)
    setPriority(t.priority)
    setLabelIds(t.labelIds)
    if (t.stateId) setStateId(t.stateId)
    if (t.assigneeId) setAssigneeId(t.assigneeId)
  }

  // Reset the form back to the modal's opening context for rapid re-entry.
  function resetForm() {
    const p = store.createPrefill
    setTitle('')
    setDescription('')
    setPriority(p?.priority ?? 0)
    setAssigneeId(p?.assigneeId ?? (store.preferences.autoAssignSelf ? store.currentUserId : undefined))
    setLabelIds(p?.labelIds ?? [])
    setProjectId(p?.projectId)
    setCycleId(undefined)
    setEstimate(undefined)
    setMilestoneId(undefined)
    setPasteLines([])
  }

  function submit(openAfter: boolean) {
    if (!title.trim()) return
    const issue = store.createIssue({
      title,
      description,
      teamId,
      stateId,
      priority,
      assigneeId,
      labelIds,
      projectId,
      cycleId,
      estimate,
    })
    // createIssue's input has no milestoneId field; persist it via the action.
    if (milestoneId) store.setIssueMilestone(issue.id, milestoneId)
    if (store.createMore) {
      // Linear's "Create more": keep the modal open and reset the form for rapid
      // entry, preserving the group context the modal was opened with.
      resetForm()
      return
    }
    store.setCreateOpen(false)
    if (openAfter) navigate(`/issue/${issue.identifier}`)
  }

  // Paste-to-create: one issue per pasted line, each sharing the modal's
  // currently-selected team/status/priority/assignee/labels/project context.
  function createFromLines(lines: string[]) {
    if (lines.length === 0) return
    for (const line of lines) {
      const issue = store.createIssue({
        title: line,
        description: '',
        teamId,
        stateId,
        priority,
        assigneeId,
        labelIds,
        projectId,
        cycleId,
        estimate,
      })
      if (milestoneId) store.setIssueMilestone(issue.id, milestoneId)
    }
    if (store.createMore) {
      resetForm()
      return
    }
    store.setCreateOpen(false)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-24 animate-fade"
      onMouseDown={() => store.setCreateOpen(false)}
    >
      <div
        className="w-[640px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            // ⌘↵ commits the bulk paste when the affordance is live, else a single issue.
            if (pasteLines.length > 1) createFromLines(pasteLines)
            else submit(false)
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[12px] text-muted">
          <button
            onClick={() => {
              setTeamId(
                teams[(teams.findIndex((t) => t.id === teamId) + 1) % teams.length].id,
              )
              setCycleId(undefined)
            }}
            className="flex items-center gap-1 rounded-md bg-bg-tertiary px-1.5 py-0.5"
          >
            {team.icon} {team.key}
          </button>
          <span>New issue</span>
          <div className="flex-1" />
          {store.templates.length > 0 && (
            <SelectMenu
              align="end"
              width={220}
              placeholder="Use a template…"
              options={store.templates.map((t) => ({ id: t.id, label: t.name }))}
              onSelect={applyTemplate}
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] hover:bg-bg-hover">
                  <FileText size={12} /> Template
                </span>
              }
            />
          )}
          <button
            onClick={() => store.setCreateOpen(false)}
            aria-label="Close"
            className="-mr-1 flex h-6 w-6 items-center justify-center rounded-md text-faint hover:bg-bg-hover hover:text-muted"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-4 py-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              // Any manual edit dismisses a pending paste-to-create affordance.
              if (pasteLines.length) setPasteLines([])
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text')
              const lines = text
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean)
              // Multi-line paste: offer bulk create. Single-line falls through to
              // the browser's default paste behavior.
              if (lines.length > 1) {
                e.preventDefault()
                setTitle(lines[0])
                setPasteLines(lines)
              }
            }}
            placeholder="Issue title"
            className="w-full bg-transparent text-[16px] font-medium text-fg outline-none"
          />
          {pasteLines.length > 1 && (
            <button
              type="button"
              onClick={() => createFromLines(pasteLines)}
              className="mt-2 flex w-full items-center justify-between rounded-md border border-border bg-bg-secondary px-2.5 py-1.5 text-left text-[12px] text-muted hover:bg-bg-hover"
            >
              <span>
                Create{' '}
                <span className="font-medium text-fg">{pasteLines.length} issues</span> from{' '}
                {pasteLines.length} lines
              </span>
              <span className="text-faint">↵</span>
            </button>
          )}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add description…"
            className="mt-2 min-h-20 w-full resize-none bg-transparent text-[13px] text-muted outline-none"
          />

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusPicker
              stateId={stateId}
              onChange={setStateId}
              trigger={
                <span className={chip}>
                  <StatusIcon type={state.type} color={state.color} />
                  {state.name}
                </span>
              }
            />
            <PriorityPicker
              priority={priority}
              onChange={setPriority}
              trigger={
                <span className={chip}>
                  <PriorityIcon priority={priority} />
                  {PRIORITY_LABELS[priority]}
                </span>
              }
            />
            <AssigneePicker
              assigneeId={assigneeId}
              onChange={setAssigneeId}
              trigger={
                <span className={chip}>
                  <Avatar user={assignee} size={16} />
                  {assignee ? fmt(assignee.name) : 'Assignee'}
                </span>
              }
            />
            <LabelPicker
              labelIds={labelIds}
              onToggle={(id) =>
                setLabelIds((ids) =>
                  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
                )
              }
              trigger={
                <span className={chip}>
                  {labelIds.length ? (
                    <>
                      {labelIds.slice(0, 3).map((id) => {
                        const l = store.labels.find((x) => x.id === id)!
                        return <LabelDot key={id} color={l.color} />
                      })}
                      {labelIds.length} label{labelIds.length > 1 ? 's' : ''}
                    </>
                  ) : (
                    'Label'
                  )}
                </span>
              }
            />
            <ProjectPicker
              projectId={projectId}
              onChange={(id) => {
                setProjectId(id)
                // Milestones belong to a project; drop the selection on change.
                setMilestoneId(undefined)
              }}
              trigger={
                <span className={chip}>
                  {project ? (
                    <>
                      {project.icon} {project.name}
                    </>
                  ) : (
                    'Project'
                  )}
                </span>
              }
            />
            {teamCycles.length > 0 && (
              <SelectMenu
                width={220}
                options={[
                  { id: '__none', label: 'No cycle', selected: !cycleId },
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
                      selected: cycleId === c.id,
                    }
                  }),
                ]}
                onSelect={(id) => setCycleId(id === '__none' ? undefined : id)}
                trigger={
                  <span className={chip}>
                    <IterationCw size={13} />
                    {cycle ? cycle.name ?? `Cycle ${cycle.number}` : 'Cycle'}
                  </span>
                }
              />
            )}
            {teamEstimationType(team) !== 'notUsed' && (
              <SelectMenu
                width={200}
                options={[
                  { id: '0', label: 'No estimate', selected: !estimate },
                  ...estimatePoints(team)
                    .filter((n) => n !== 0)
                    .map((n) => ({
                      id: String(n),
                      label: estimateLabel(n, team),
                      selected: estimate === n,
                    })),
                ]}
                onSelect={(id) => setEstimate(Number(id) || undefined)}
                trigger={
                  <span className={chip}>
                    <GitBranch size={13} />
                    {estimate ? estimateLabel(estimate, team) : 'Estimate'}
                  </span>
                }
              />
            )}
            {projectMilestones.length > 0 && (
              <SelectMenu
                width={220}
                options={[
                  { id: '__none', label: 'No milestone', selected: !milestoneId },
                  ...projectMilestones.map((m) => ({
                    id: m.id,
                    label: m.name,
                    selected: milestoneId === m.id,
                  })),
                ]}
                onSelect={(id) =>
                  setMilestoneId(id === '__none' ? undefined : id)
                }
                trigger={
                  <span className={chip}>
                    <Flag size={13} />
                    {milestone?.name ?? 'Milestone'}
                  </span>
                }
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border px-4 py-1.5 text-[10px] text-faint">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-bg-tertiary px-1 py-px text-[10px] text-muted">Tab</kbd>
            properties
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-bg-tertiary px-1 py-px text-[10px] text-muted">↵</kbd>
            open picker
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-bg-tertiary px-1 py-px text-[10px] text-muted">⌘↵</kbd>
            create
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <span className="text-[11px] text-faint">
            {pasteLines.length > 1
              ? `⌘↵ to create ${pasteLines.length} issues`
              : '⌘↵ to create'}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
              <button
                type="button"
                role="switch"
                aria-checked={store.createMore}
                onClick={() => store.setCreateMore(!store.createMore)}
                className={`relative h-4 w-7 rounded-full transition-colors ${
                  store.createMore ? 'bg-accent' : 'bg-bg-tertiary'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                    store.createMore ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              Create more
            </label>
            <button
              onClick={() => submit(false)}
              disabled={!title.trim()}
              className="rounded-md bg-accent px-3 py-1.5 text-[13px] text-white disabled:opacity-40 hover:bg-accent-hover"
            >
              Create issue
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
