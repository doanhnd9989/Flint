import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Target } from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { Avatar } from './Avatar'
import { PriorityIcon } from './PriorityIcon'
import { DatePicker } from './DatePicker'
import { SelectMenu } from './ui/SelectMenu'
import type { SelectOption } from './ui/SelectMenu'
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  PROJECT_STATUS,
  PROJECT_STATUS_ORDER,
} from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { Priority, ProjectStatus } from '@/lib/types'

const chip =
  'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover'

// A small palette of project-flavored emoji to pick the project icon from.
const ICONS = ['📋', '🚀', '🎯', '⭐', '🏗️', '🔭', '🌱', '⚡', '🛠️', '💡', '📈', '🧩', '🎨', '📦']

// Project-icon background colors (the colored square Linear shows behind the icon).
const COLORS = [
  '#95a2b3',
  '#eb5757',
  '#f2994a',
  '#f2c94c',
  '#4cb782',
  '#5e9aa8',
  '#4ea7fc',
  '#5e6ad2',
  '#9b51e0',
  '#eb5da8',
]

// Project templates that pre-fill name/description — Linear's "Use a template"
// gallery. We have no store collection for project templates, so this mirrors
// the inline list that ProjectTemplatesSettings.tsx seeds with.
type ProjectTemplate = { id: string; emoji: string; name: string; description: string }
const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'launch',
    emoji: '🚀',
    name: 'Product Launch',
    description:
      'Plan and coordinate a product launch: define scope, line up marketing, and ship.',
  },
  {
    id: 'research',
    emoji: '🔬',
    name: 'Research Spike',
    description: 'Time-boxed investigation to de-risk an approach before committing.',
  },
  {
    id: 'migration',
    emoji: '🛠️',
    name: 'Platform Migration',
    description: 'Migrate a system to a new platform with milestones and rollback steps.',
  },
]

export function CreateProjectModal() {
  const navigate = useNavigate()
  const store = useStore()
  const fmt = useDisplayName()
  const open = store.createProjectOpen

  const [icon, setIcon] = useState('📋')
  const [color, setColor] = useState('#5e6ad2')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('backlog')
  const [priority, setPriority] = useState<Priority>(0)
  const [leadId, setLeadId] = useState<string | undefined>(store.currentUserId)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [initiativeId, setInitiativeId] = useState<string | undefined>(undefined)
  const [startDate, setStartDate] = useState<string | undefined>(undefined)
  const [targetDate, setTargetDate] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (open) {
      setIcon('📋')
      setColor('#5e6ad2')
      setName('')
      setDescription('')
      setStatus('backlog')
      setPriority(0)
      setLeadId(store.currentUserId)
      setMemberIds([])
      // Default to the first team so a new project is always team-scoped.
      setTeamIds(store.teams[0] ? [store.teams[0].id] : [])
      setInitiativeId(undefined)
      setStartDate(undefined)
      setTargetDate(undefined)
    }
  }, [open, store.currentUserId, store.teams])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) store.setCreateProjectOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, store])

  if (!open) return null

  const lead = store.users.find((u) => u.id === leadId)
  const initiative = store.initiatives.find((i) => i.id === initiativeId)

  function applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id)
    if (!t) return
    setIcon(t.emoji)
    setName(t.name)
    setDescription(t.description)
  }

  const templateOptions: SelectOption[] = TEMPLATES.map((t) => ({
    id: t.id,
    label: t.name,
    icon: <span className="text-base">{t.emoji}</span>,
    hint: 'Template',
  }))

  const iconOptions: SelectOption[] = ICONS.map((e) => ({
    id: e,
    label: e,
    icon: <span className="text-base">{e}</span>,
    selected: e === icon,
  }))

  const statusOptions: SelectOption[] = PROJECT_STATUS_ORDER.map((s) => ({
    id: s,
    label: PROJECT_STATUS[s].label,
    icon: (
      <span
        className="inline-block h-3 w-3 rounded-full border-2"
        style={{ borderColor: PROJECT_STATUS[s].color }}
      />
    ),
    selected: s === status,
  }))

  const priorityOptions: SelectOption[] = PRIORITY_ORDER.map((p) => ({
    id: String(p),
    label: PRIORITY_LABELS[p],
    icon: <PriorityIcon priority={p} />,
    selected: p === priority,
  }))

  const leadOptions: SelectOption[] = [
    { id: '__none', label: 'No lead', icon: <Avatar />, selected: !leadId },
    ...store.users.map((u) => ({
      id: u.id,
      label: fmt(u.name),
      icon: <Avatar user={u} />,
      selected: u.id === leadId,
    })),
  ]

  const memberOptions: SelectOption[] = store.users.map((u) => ({
    id: u.id,
    label: fmt(u.name),
    icon: <Avatar user={u} />,
    selected: memberIds.includes(u.id),
  }))

  const teamOptions: SelectOption[] = store.teams.map((t) => ({
    id: t.id,
    label: t.name,
    icon: <span style={{ color: t.color }}>{t.icon}</span>,
    hint: t.key,
    selected: teamIds.includes(t.id),
  }))

  const initiativeOptions: SelectOption[] = [
    { id: '__none', label: 'No initiative', icon: <span className="text-faint">○</span>, selected: !initiativeId },
    ...store.initiatives.map((i) => ({
      id: i.id,
      label: i.name,
      icon: <span>{i.icon}</span>,
      selected: i.id === initiativeId,
    })),
  ]

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  function submit() {
    if (!name.trim()) return
    const project = store.createProject({
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      color,
      status,
      priority,
      leadId,
      memberIds,
      teamIds,
      initiativeId,
      startDate,
      targetDate,
    })
    store.setCreateProjectOpen(false)
    navigate(`/project/${project.id}`)
  }

  const memberLabel =
    memberIds.length === 0
      ? 'Members'
      : memberIds.length === 1
        ? fmt(store.users.find((u) => u.id === memberIds[0])?.name)
        : `${memberIds.length} members`

  const teamLabel =
    teamIds.length === 0
      ? 'Team'
      : teamIds.length === 1
        ? store.teams.find((t) => t.id === teamIds[0])?.name
        : `${teamIds.length} teams`

  return createPortal(
    <div
      data-overlay
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-24 animate-fade"
      onMouseDown={() => store.setCreateProjectOpen(false)}
    >
      <div
        className="w-[600px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[12px] text-muted">
          <span className="rounded-md bg-bg-tertiary px-1.5 py-0.5">{store.workspaceName}</span>
          <span>New project</span>
          <div className="ml-auto">
            <SelectMenu
              width={220}
              options={templateOptions}
              onSelect={applyTemplate}
              placeholder="Use a template…"
              align="end"
              trigger={
                <span className="rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover">
                  Use a template
                </span>
              }
            />
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-start gap-2">
            <SelectMenu
              width={200}
              options={iconOptions}
              onSelect={setIcon}
              placeholder="Icon…"
              header={
                <div className="flex flex-wrap gap-1 border-b border-border px-2 py-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="h-4 w-4 rounded-full"
                      style={{
                        background: c,
                        outline: c === color ? '2px solid var(--accent)' : 'none',
                        outlineOffset: 1,
                      }}
                    />
                  ))}
                </div>
              }
              trigger={
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:opacity-90"
                  style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
                >
                  {icon}
                </span>
              }
            />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="mt-0.5 flex-1 bg-transparent text-[16px] font-medium text-fg outline-none"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a short summary…"
            className="mt-2 min-h-16 w-full resize-none bg-transparent text-[13px] text-muted outline-none"
          />

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <SelectMenu
              options={statusOptions}
              onSelect={(s) => setStatus(s as ProjectStatus)}
              placeholder="Change status…"
              trigger={
                <span className={chip}>
                  <span
                    className="inline-block h-3 w-3 rounded-full border-2"
                    style={{ borderColor: PROJECT_STATUS[status].color }}
                  />
                  {PROJECT_STATUS[status].label}
                </span>
              }
            />
            <SelectMenu
              options={priorityOptions}
              onSelect={(p) => setPriority(Number(p) as Priority)}
              placeholder="Set priority…"
              trigger={
                <span className={chip}>
                  <PriorityIcon priority={priority} />
                  {PRIORITY_LABELS[priority]}
                </span>
              }
            />
            <SelectMenu
              options={leadOptions}
              onSelect={(uid) => setLeadId(uid === '__none' ? undefined : uid)}
              placeholder="Set lead…"
              trigger={
                <span className={chip}>
                  <Avatar user={lead} size={16} />
                  {lead ? fmt(lead.name) : 'Lead'}
                </span>
              }
            />
            <SelectMenu
              keepOpen
              options={memberOptions}
              onSelect={(uid) => setMemberIds((m) => toggle(m, uid))}
              placeholder="Add members…"
              trigger={
                <span className={chip}>
                  {memberIds.length > 0 ? (
                    <span className="flex -space-x-1.5">
                      {memberIds.slice(0, 3).map((id) => (
                        <Avatar key={id} user={store.users.find((u) => u.id === id)} size={16} />
                      ))}
                    </span>
                  ) : (
                    <Avatar size={16} />
                  )}
                  {memberLabel}
                </span>
              }
            />
            <SelectMenu
              keepOpen
              options={teamOptions}
              onSelect={(tid) => setTeamIds((t) => toggle(t, tid))}
              placeholder="Add teams…"
              trigger={
                <span className={chip}>
                  {teamIds.length === 1 ? (
                    <span style={{ color: store.teams.find((t) => t.id === teamIds[0])?.color }}>
                      {store.teams.find((t) => t.id === teamIds[0])?.icon}
                    </span>
                  ) : null}
                  {teamLabel}
                </span>
              }
            />
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              trigger={
                <span className={chip}>
                  <CalendarDays size={14} />
                  {startDate ? formatDate(startDate) : 'Start'}
                </span>
              }
            />
            <DatePicker
              value={targetDate}
              onChange={setTargetDate}
              trigger={
                <span className={chip}>
                  <Target size={14} />
                  {targetDate ? formatDate(targetDate) : 'Target'}
                </span>
              }
            />
            <SelectMenu
              options={initiativeOptions}
              onSelect={(id) => setInitiativeId(id === '__none' ? undefined : id)}
              placeholder="Add to initiative…"
              trigger={
                <span className={chip}>
                  {initiative ? <span>{initiative.icon}</span> : null}
                  {initiative ? initiative.name : 'Initiative'}
                </span>
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={() => store.setCreateProjectOpen(false)}
            className="rounded-md px-3 py-1.5 text-[13px] text-muted hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={submit}
            className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Create project
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
