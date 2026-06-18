import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, X } from 'lucide-react'
import { useStore, useStoreShallow, useDisplayName } from '@/lib/store'
import { Avatar } from '@/components/Avatar'
import { EmptyState, StackIllustration } from '@/components/EmptyState'
import { HealthBadge } from '@/components/ProjectUpdates'
import { InitiativeUpdates } from '@/components/InitiativeUpdates'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { initiativeProgress, projectProgress } from '@/lib/selectors'
import { INITIATIVE_STATUS, INITIATIVE_STATUS_ORDER } from '@/lib/constants'
import type { InitiativeStatus } from '@/lib/types'
import { formatFullDate, cn } from '@/lib/utils'

const PROJECT_STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  planned: 'Planned',
  started: 'In Progress',
  paused: 'Paused',
  completed: 'Completed',
  canceled: 'Canceled',
}

export function InitiativeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'overview' | 'updates'>('overview')
  const { initiatives, projects, issues, users, initiativeUpdates } = useStoreShallow((s) => ({
    initiatives: s.initiatives,
    projects: s.projects,
    issues: s.issues,
    users: s.users,
    initiativeUpdates: s.initiativeUpdates,
  }))
  const data = useStore()
  const fmt = useDisplayName()
  const {
    updateInitiative,
    deleteInitiative,
    setProjectInitiative,
  } = useStoreShallow((s) => ({
    updateInitiative: s.updateInitiative,
    deleteInitiative: s.deleteInitiative,
    setProjectInitiative: s.setProjectInitiative,
  }))

  const initiative = initiatives.find((i) => i.id === id)
  if (!initiative) {
    return (
      <div className="flex h-full items-center justify-center text-faint">
        Initiative not found
      </div>
    )
  }

  const owner = users.find((u) => u.id === initiative.ownerId)
  const prog = initiativeProgress(initiative.id, projects, issues, data)
  const latestUpdate = initiativeUpdates
    .filter((u) => u.initiativeId === initiative.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const inProjects = projects
    .filter((p) => p.initiativeId === initiative.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const statusOptions: SelectOption[] = INITIATIVE_STATUS_ORDER.map((s) => ({
    id: s,
    label: INITIATIVE_STATUS[s].label,
    icon: (
      <span
        className="inline-block h-3 w-3 rounded-full border-2"
        style={{ borderColor: INITIATIVE_STATUS[s].color }}
      />
    ),
    selected: s === initiative.status,
  }))

  const ownerOptions: SelectOption[] = [
    { id: '__none', label: 'No owner', icon: <Avatar />, selected: !initiative.ownerId },
    ...users.map((u) => ({
      id: u.id,
      label: fmt(u.name),
      icon: <Avatar user={u} />,
      selected: u.id === initiative.ownerId,
    })),
  ]

  // Projects not yet in any initiative — candidates to add here.
  const addable: SelectOption[] = projects
    .filter((p) => !p.initiativeId)
    .map((p) => ({ id: p.id, label: p.name, icon: <span>{p.icon}</span> }))

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-[13px]">
        <button
          onClick={() => navigate('/initiatives')}
          className="text-muted hover:text-fg"
        >
          Initiatives
        </button>
        <span className="text-faint">›</span>
        <span className="font-medium text-fg">
          {initiative.icon} {initiative.name}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          title="Delete initiative"
          onClick={() => {
            if (confirm(`Delete initiative "${initiative.name}"? Its projects will be kept.`)) {
              deleteInitiative(initiative.id)
              navigate('/initiatives')
            }
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-bg-hover hover:text-fg"
        >
          <Trash2 size={15} />
        </button>
      </header>

      <div className="border-b border-border px-6 py-5">
        <div className="flex items-start gap-4">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-lg text-2xl"
            style={{ background: `${initiative.color}20` }}
          >
            {initiative.icon}
          </span>
          <div className="flex-1">
            <h1 className="text-[18px] font-semibold text-fg">{initiative.name}</h1>
            {initiative.description && (
              <p className="mt-1 max-w-2xl text-[13px] text-muted">
                {initiative.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted">
              <SelectMenu
                options={statusOptions}
                onSelect={(s) =>
                  updateInitiative(initiative.id, { status: s as InitiativeStatus })
                }
                placeholder="Change status…"
                trigger={
                  <span className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 hover:bg-bg-hover">
                    <span
                      className="inline-block h-3 w-3 rounded-full border-2"
                      style={{ borderColor: INITIATIVE_STATUS[initiative.status].color }}
                    />
                    {INITIATIVE_STATUS[initiative.status].label}
                  </span>
                }
              />
              <SelectMenu
                options={ownerOptions}
                onSelect={(uid) =>
                  updateInitiative(initiative.id, {
                    ownerId: uid === '__none' ? undefined : uid,
                  })
                }
                placeholder="Set owner…"
                trigger={
                  <span className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 hover:bg-bg-hover">
                    <Avatar user={owner} size={16} />
                    {owner ? fmt(owner.name) : 'No owner'}
                  </span>
                }
              />
              {latestUpdate && <HealthBadge health={latestUpdate.health} />}
              {initiative.targetDate && (
                <span className="rounded-md border border-border px-2 py-1">
                  Target {formatFullDate(initiative.targetDate)}
                </span>
              )}
              <span className="rounded-md border border-border px-2 py-1">
                {prog.done}/{prog.total} issues · {prog.percent}%
              </span>
            </div>
            <div className="mt-3 h-1.5 w-64 overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${prog.percent}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1">
          {(['overview', 'updates'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] capitalize text-muted hover:bg-bg-hover',
                tab === t && 'bg-bg-selected text-fg font-medium',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'updates' ? (
        <div className="flex-1 overflow-y-auto">
          <InitiativeUpdates initiativeId={initiative.id} />
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-fg">
            Projects
            <span className="ml-1.5 text-faint">{inProjects.length}</span>
          </h2>
          {addable.length > 0 && (
            <SelectMenu
              align="end"
              options={addable}
              onSelect={(pid) => setProjectInitiative(pid, initiative.id)}
              placeholder="Add a project…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover">
                  <Plus size={13} /> Add project
                </span>
              }
            />
          )}
        </div>

        {inProjects.length === 0 ? (
          <EmptyState
            illustration={<StackIllustration />}
            title="No projects in this initiative"
            description="Add the projects that contribute toward this initiative to roll up their progress here."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {inProjects.map((p) => {
              const pp = projectProgress(p.id, issues, data)
              const lead = users.find((u) => u.id === p.leadId)
              return (
                <div
                  key={p.id}
                  className="group flex items-center gap-3 border-b border-border bg-bg-secondary px-4 py-2.5 last:border-b-0 hover:bg-bg-hover"
                >
                  <button
                    onClick={() => navigate(`/project/${p.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span className="text-base">{p.icon}</span>
                    <span className="truncate text-[13px] font-medium text-fg">
                      {p.name}
                    </span>
                    <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-[11px] text-muted">
                      {PROJECT_STATUS_LABEL[p.status]}
                    </span>
                  </button>
                  <div className="flex w-32 shrink-0 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${pp.percent}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[11px] text-faint">
                      {pp.percent}%
                    </span>
                  </div>
                  <Avatar user={lead} size={20} />
                  <button
                    type="button"
                    title="Remove from initiative"
                    onClick={() => setProjectInitiative(p.id, undefined)}
                    className="flex h-6 w-6 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-tertiary hover:text-fg group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}
    </div>
  )
}
