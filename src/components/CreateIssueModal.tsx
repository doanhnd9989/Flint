import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
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
import { FileText, X } from 'lucide-react'
import { PRIORITY_LABELS } from '@/lib/constants'

const chip =
  'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover'

export function CreateIssueModal() {
  const navigate = useNavigate()
  const store = useStore()
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

  useEffect(() => {
    if (open) {
      setTitle('')
      setDescription('')
      setPriority(0)
      setAssigneeId(undefined)
      setLabelIds([])
      setProjectId(undefined)
    }
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
    })
    if (store.createMore) {
      // Linear's "Create more": keep the modal open and reset the form for rapid entry.
      setTitle('')
      setDescription('')
      setPriority(0)
      setAssigneeId(undefined)
      setLabelIds([])
      setProjectId(undefined)
      return
    }
    store.setCreateOpen(false)
    if (openAfter) navigate(`/issue/${issue.identifier}`)
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
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(false)
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[12px] text-muted">
          <button
            onClick={() =>
              setTeamId(
                teams[(teams.findIndex((t) => t.id === teamId) + 1) % teams.length].id,
              )
            }
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
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Issue title"
            className="w-full bg-transparent text-[16px] font-medium text-fg outline-none"
          />
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
                  {assignee?.name ?? 'Assignee'}
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
              onChange={setProjectId}
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
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <span className="text-[11px] text-faint">⌘↵ to create</span>
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
