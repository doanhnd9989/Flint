import { useMemo, useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus,
  Trash2,
  Flag,
  Goal,
  CalendarRange,
  Users,
  Diamond,
  MoreHorizontal,
} from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { sortIssues, projectProgress, milestoneProgress } from '@/lib/selectors'
import { ProjectProgressGraph } from '@/components/ProjectProgressGraph'
import { ProjectResources } from '@/components/ProjectResources'
import { IssueRow } from '@/components/IssueRow'
import { Avatar } from '@/components/Avatar'
import { ProjectUpdates, HealthBadge } from '@/components/ProjectUpdates'
import { ProjectStatusIcon } from '@/components/ProjectStatusIcon'
import { ProgressDonut } from '@/components/ProgressDonut'
import { AssigneePicker } from '@/components/pickers'
import { DatePicker } from '@/components/DatePicker'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { Popover } from '@/components/ui/Popover'
import { StarButton } from '@/components/StarButton'
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from '@/lib/constants'
import { formatFullDate, cn } from '@/lib/utils'
import type { Issue, Milestone, Project, ProjectStatus } from '@/lib/types'

const triggerCls =
  'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[13px] text-fg hover:bg-bg-hover'

/** A label/value row in the right-hand Properties panel. */
function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="w-16 shrink-0 text-[12px] text-faint">{label}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Milestone-grouped issue list (Issues tab). */
function Section({
  title,
  issues,
  progress,
  onDelete,
}: {
  title: React.ReactNode
  issues: Issue[]
  progress?: { done: number; total: number; percent: number }
  onDelete?: () => void
}) {
  if (issues.length === 0 && !onDelete) return null
  return (
    <div>
      <div className="group sticky top-0 z-10 flex items-center gap-2 bg-bg-secondary/95 px-4 py-1.5 backdrop-blur border-b border-border">
        <Flag size={13} className="text-faint" />
        <span className="text-[13px] font-medium text-fg">{title}</span>
        {progress && (
          <>
            <span className="text-[12px] text-faint">
              {progress.done}/{progress.total}
            </span>
            <div className="h-1 w-20 overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </>
        )}
        <div className="flex-1" />
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 hover:text-[var(--priority-urgent)] group-hover:opacity-100"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {issues.length === 0 ? (
        <div className="px-4 py-2 text-[12px] text-faint">No issues</div>
      ) : (
        issues.map((i) => <IssueRow key={i.id} issue={i} />)
      )}
    </div>
  )
}

/** Multi-select members field (Properties panel). */
function MembersField({ project }: { project: Project }) {
  const users = useStore((s) => s.users)
  const updateProject = useStore((s) => s.updateProject)
  const fmt = useDisplayName()
  const members = project.memberIds
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean)
  const options: SelectOption[] = users.map((u) => ({
    id: u.id,
    label: fmt(u.name),
    icon: <Avatar user={u} size={18} />,
    selected: project.memberIds.includes(u.id),
  }))
  const toggle = (id: string) => {
    const has = project.memberIds.includes(id)
    updateProject(project.id, {
      memberIds: has
        ? project.memberIds.filter((x) => x !== id)
        : [...project.memberIds, id],
    })
  }
  return (
    <SelectMenu
      keepOpen
      options={options}
      onSelect={toggle}
      placeholder="Add members…"
      trigger={
        <span className={triggerCls}>
          {members.length === 0 ? (
            <>
              <Users size={14} className="text-faint" />
              <span className="text-faint">Add members</span>
            </>
          ) : (
            <span className="flex items-center -space-x-1.5">
              {members.map((m) => (
                <Avatar key={m!.id} user={m!} size={18} />
              ))}
            </span>
          )}
        </span>
      }
    />
  )
}

/** A single inline-editable milestone in the Overview main column (Linear-style). */
function MilestoneItem({
  milestone,
  progress,
  autoFocus,
  onChange,
  onDelete,
}: {
  milestone: Milestone
  progress: { done: number; total: number; percent: number }
  autoFocus: boolean
  onChange: (patch: Partial<Milestone>) => void
  onDelete: () => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) nameRef.current?.focus()
  }, [autoFocus])

  // Empty milestones (created via "+ Milestone" then abandoned) clean themselves
  // up when focus leaves the row — matching Linear's transient placeholder row.
  function handleBlur(e: React.FocusEvent) {
    if (rowRef.current?.contains(e.relatedTarget as Node)) return
    if (!milestone.name.trim() && !milestone.description?.trim()) onDelete()
  }

  return (
    <div ref={rowRef} className="group rounded-md px-1.5 py-1.5 hover:bg-bg-hover">
      <div className="flex items-center gap-2">
        <Diamond size={13} className="shrink-0 text-faint" />
        <input
          ref={nameRef}
          value={milestone.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={handleBlur}
          placeholder="Milestone name"
          className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-fg outline-none placeholder:text-faint"
        />
        <span className="shrink-0 text-[12px] text-faint">
          {progress.done}/{progress.total}
        </span>
        <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-bg-tertiary">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <DatePicker
          value={milestone.targetDate}
          onChange={(iso) => onChange({ targetDate: iso })}
          trigger={
            <span
              onBlur={handleBlur}
              className="flex items-center gap-1 rounded px-1 py-0.5 text-[12px] text-faint hover:bg-bg-hover"
            >
              <CalendarRange size={12} />
              {milestone.targetDate ? formatFullDate(milestone.targetDate) : null}
            </span>
          }
        />
        <Popover
          align="end"
          width={180}
          trigger={
            <span
              onBlur={handleBlur}
              className="flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-hover hover:text-fg group-hover:opacity-100"
            >
              <MoreHorizontal size={14} />
            </span>
          }
        >
          {(close) => (
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => {
                  nameRef.current?.focus()
                  close()
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
              >
                <Goal size={14} className="text-faint" /> Edit…
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete()
                  close()
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-red hover:bg-bg-hover"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </Popover>
      </div>
      <input
        value={milestone.description ?? ''}
        onChange={(e) => onChange({ description: e.target.value })}
        onBlur={handleBlur}
        placeholder="Add a description…"
        className="ml-[21px] mt-0.5 w-[calc(100%-21px)] bg-transparent text-[12px] text-muted outline-none placeholder:text-faint"
      />
    </div>
  )
}

export function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useStore()
  const fmt = useDisplayName()
  const project = data.projects.find((p) => p.id === id)
  const [tab, setTab] = useState<'overview' | 'activity' | 'graph' | 'issues'>('overview')
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const [focusMilestoneId, setFocusMilestoneId] = useState<string | null>(null)

  const latestUpdate = useMemo(
    () =>
      data.projectUpdates
        .filter((u) => u.projectId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [data.projectUpdates, id],
  )

  const milestones = useMemo(
    () =>
      data.milestones
        .filter((m) => m.projectId === id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [data.milestones, id],
  )

  const scoped = useMemo(() => {
    if (!project) return []
    return sortIssues(
      data.issues.filter((i) => i.projectId === project.id),
      'priority',
      data,
    )
  }, [data, project])

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-faint">
        Project not found
      </div>
    )
  }

  const lead = data.users.find((u) => u.id === project.leadId)
  const prog = projectProgress(project.id, data.issues, data)
  const noMilestone = scoped.filter((i) => !i.milestoneId)
  const initiative = data.initiatives.find((x) => x.id === project.initiativeId)
  const teams = project.teamIds
    .map((tid) => data.teams.find((t) => t.id === tid))
    .filter(Boolean)

  const statusOptions: SelectOption[] = PROJECT_STATUS_ORDER.map((s) => ({
    id: s,
    label: PROJECT_STATUS[s].label,
    icon: <ProjectStatusIcon status={s} />,
    selected: s === project.status,
  }))

  function addMilestone() {
    const m = data.createMilestone(project!.id, '')
    setFocusMilestoneId(m.id)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-[13px]">
        <button onClick={() => navigate('/projects')} className="text-muted hover:text-fg">
          Projects
        </button>
        <span className="text-faint">›</span>
        <ProjectStatusIcon status={project.status} />
        <span className="font-medium text-fg">
          {project.icon} {project.name}
        </span>
        <div className="flex-1" />
        <StarButton type="project" id={project.id} />
      </header>

      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-4 py-1.5">
        {(['overview', 'activity', 'graph', 'issues'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[13px] capitalize text-muted hover:bg-bg-hover',
              tab === t && 'bg-bg-selected text-fg font-medium',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Body */}
      {tab === 'overview' ? (
        <div className="flex min-h-0 flex-1">
          {/* Main column */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-10 py-10">
              <span className="text-3xl">{project.icon}</span>
              <h1 className="mt-3 text-[22px] font-semibold text-fg">
                {project.name}
              </h1>
              {project.description ? (
                <p className="mt-1 text-[14px] text-muted">{project.description}</p>
              ) : null}

              {/* Project update card */}
              <button
                type="button"
                onClick={() => setTab('activity')}
                className="mt-6 flex w-full items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2.5 text-left text-[13px] hover:bg-bg-hover"
              >
                {latestUpdate ? (
                  <>
                    <HealthBadge health={latestUpdate.health} />
                    <span className="truncate text-muted">{latestUpdate.body}</span>
                  </>
                ) : (
                  <span className="text-muted">Write first project update</span>
                )}
              </button>

              {/* Description */}
              <div className="mt-8">
                <div className="mb-1.5 text-[13px] font-medium text-fg">Description</div>
                {editingDesc ? (
                  <textarea
                    autoFocus
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    onBlur={() => {
                      data.updateProject(project.id, { description: descDraft.trim() })
                      setEditingDesc(false)
                    }}
                    placeholder="Add description…"
                    className="min-h-[80px] w-full resize-none rounded-md bg-transparent text-[13px] text-fg outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDescDraft(project.description ?? '')
                      setEditingDesc(true)
                    }}
                    className="block w-full whitespace-pre-wrap text-left text-[13px] text-fg"
                  >
                    {project.description || (
                      <span className="text-faint">Add description…</span>
                    )}
                  </button>
                )}
              </div>

              {/* Resources */}
              <div className="mt-8">
                <ProjectResources projectId={project.id} />
              </div>

              {/* Milestones */}
              <div className="mt-8">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[13px] font-medium text-fg">Milestones</span>
                  <button
                    onClick={addMilestone}
                    className="flex h-5 w-5 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {milestones.length === 0 ? (
                  <p className="text-[13px] text-faint">
                    Add milestones to organize work within your project and break it
                    into more granular stages.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {milestones.map((m) => (
                      <MilestoneItem
                        key={m.id}
                        milestone={m}
                        progress={milestoneProgress(m.id, data.issues, data)}
                        autoFocus={m.id === focusMilestoneId}
                        onChange={(patch) => data.updateMilestone(m.id, patch)}
                        onDelete={() => data.deleteMilestone(m.id)}
                      />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={addMilestone}
                  className="mt-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-faint hover:bg-bg-hover hover:text-fg"
                >
                  <Plus size={14} /> Milestone
                </button>
              </div>
            </div>
          </div>

          {/* Properties sidebar */}
          <aside className="w-[268px] shrink-0 overflow-y-auto border-l border-border px-4 py-4">
            <div className="mb-1.5 text-[12px] font-medium text-muted">Properties</div>
            <PropRow label="Status">
              <SelectMenu
                options={statusOptions}
                onSelect={(s) =>
                  data.updateProject(project.id, { status: s as ProjectStatus })
                }
                placeholder="Set status…"
                trigger={
                  <span className={triggerCls}>
                    <ProjectStatusIcon status={project.status} />
                    {PROJECT_STATUS[project.status].label}
                  </span>
                }
              />
            </PropRow>
            <PropRow label="Lead">
              <AssigneePicker
                assigneeId={project.leadId}
                onChange={(uid) => data.updateProject(project.id, { leadId: uid })}
                trigger={
                  <span className={triggerCls}>
                    {lead ? (
                      <>
                        <Avatar user={lead} size={18} /> {fmt(lead.name)}
                      </>
                    ) : (
                      <>
                        <Avatar size={18} /> <span className="text-faint">Add lead</span>
                      </>
                    )}
                  </span>
                }
              />
            </PropRow>
            <PropRow label="Members">
              <MembersField project={project} />
            </PropRow>
            <PropRow label="Issues">
              <div className="flex items-center gap-1.5 px-1.5 py-1 text-[13px] text-fg">
                <ProgressDonut percent={prog.percent} size={14} />
                {prog.total}
              </div>
            </PropRow>
            <PropRow label="Start">
              <DatePicker
                value={project.startDate}
                onChange={(iso) => data.updateProject(project.id, { startDate: iso })}
                trigger={
                  <span className={triggerCls}>
                    <CalendarRange size={14} className="text-faint" />
                    {project.startDate ? (
                      formatFullDate(project.startDate)
                    ) : (
                      <span className="text-faint">Set start</span>
                    )}
                  </span>
                }
              />
            </PropRow>
            <PropRow label="Target">
              <DatePicker
                value={project.targetDate}
                onChange={(iso) => data.updateProject(project.id, { targetDate: iso })}
                trigger={
                  <span className={triggerCls}>
                    <CalendarRange size={14} className="text-faint" />
                    {project.targetDate ? (
                      formatFullDate(project.targetDate)
                    ) : (
                      <span className="text-faint">Set target</span>
                    )}
                  </span>
                }
              />
            </PropRow>
            <PropRow label="Teams">
              <div className="px-1.5 py-1 text-[13px] text-fg">
                {teams.length ? teams.map((t) => t!.name).join(', ') : (
                  <span className="text-faint">—</span>
                )}
              </div>
            </PropRow>
            <PropRow label="Initiative">
              <SelectMenu
                options={[
                  {
                    id: '__none',
                    label: 'No initiative',
                    icon: <Goal size={14} />,
                    selected: !project.initiativeId,
                  },
                  ...data.initiatives
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((i) => ({
                      id: i.id,
                      label: i.name,
                      icon: <span>{i.icon}</span>,
                      selected: i.id === project.initiativeId,
                    })),
                ]}
                onSelect={(iid) =>
                  data.setProjectInitiative(
                    project.id,
                    iid === '__none' ? undefined : iid,
                  )
                }
                placeholder="Set initiative…"
                trigger={
                  <span className={triggerCls}>
                    {initiative ? (
                      <>
                        <span>{initiative.icon}</span> {initiative.name}
                      </>
                    ) : (
                      <>
                        <Goal size={14} className="text-faint" />
                        <span className="text-faint">No initiative</span>
                      </>
                    )}
                  </span>
                }
              />
            </PropRow>
          </aside>
        </div>
      ) : tab === 'activity' ? (
        <div className="flex-1 overflow-y-auto">
          <ProjectUpdates projectId={project.id} />
        </div>
      ) : tab === 'graph' ? (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-10 py-10">
            <ProjectProgressGraph projectId={project.id} />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {milestones.map((m) => (
            <Section
              key={m.id}
              title={m.name}
              issues={scoped.filter((i) => i.milestoneId === m.id)}
              progress={milestoneProgress(m.id, data.issues, data)}
              onDelete={() => {
                if (confirm(`Delete milestone "${m.name}"?`)) data.deleteMilestone(m.id)
              }}
            />
          ))}
          <Section title="No milestone" issues={noMilestone} />
        </div>
      )}
    </div>
  )
}
