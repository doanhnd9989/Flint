import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, MoreHorizontal, Plus, Rocket, X } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, StackIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { RELEASE_STATUS, RELEASE_STATUS_ORDER } from '@/lib/constants'
import { formatDate, timeAgo, cn } from '@/lib/utils'
import type { Project, ReleaseStatus } from '@/lib/types'

/** Small status color dot used in headers, rows and pickers. */
function StatusDot({ status }: { status: ReleaseStatus }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: RELEASE_STATUS[status].color }}
    />
  )
}

const chip =
  'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover'

export function ReleasesView() {
  const { releases, projects } = useStoreShallow((s) => ({
    releases: s.releases,
    projects: s.projects,
  }))
  const updateRelease = useStore((s) => s.updateRelease)
  const deleteRelease = useStore((s) => s.deleteRelease)

  const [modalOpen, setModalOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const projectById = useMemo(() => {
    const m: Record<string, Project> = {}
    for (const p of projects) m[p.id] = p
    return m
  }, [projects])

  /** Releases grouped by status, in RELEASE_STATUS_ORDER (empty groups dropped). */
  const groups = useMemo(() => {
    const sorted = [...releases].sort((a, b) => a.sortOrder - b.sortOrder)
    return RELEASE_STATUS_ORDER.map((status) => ({
      status,
      items: sorted.filter((r) => r.status === status),
    })).filter((g) => g.items.length > 0)
  }, [releases])

  const statusOptions = (current: ReleaseStatus): SelectOption[] =>
    RELEASE_STATUS_ORDER.map((s) => ({
      id: s,
      label: RELEASE_STATUS[s].label,
      icon: <StatusDot status={s} />,
      selected: s === current,
    }))

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Releases"
        right={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:bg-accent-hover"
          >
            <Plus size={13} />
            New release
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {releases.length === 0 ? (
          <EmptyState
            illustration={<StackIllustration />}
            title="Releases"
            description="Releases bundle shipped work into versioned milestones. Track what's planned, in progress, and shipped — optionally tied to a project."
            action={{ label: 'New release', onClick: () => setModalOpen(true) }}
          />
        ) : (
          groups.map((g) => {
            const isCollapsed = collapsed[g.status]
            return (
              <div key={g.status}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [g.status]: !c[g.status] }))
                  }
                  className="sticky top-0 z-10 flex w-full items-center gap-1.5 bg-bg-secondary px-4 py-1.5 text-[12px] font-medium text-fg"
                >
                  <ChevronRight
                    size={13}
                    className={cn(
                      'text-faint transition-transform',
                      !isCollapsed && 'rotate-90',
                    )}
                  />
                  <StatusDot status={g.status} />
                  <span>{RELEASE_STATUS[g.status].label}</span>
                  <span className="text-faint">{g.items.length}</span>
                </button>

                {!isCollapsed &&
                  g.items.map((r) => {
                    const project = r.projectId
                      ? projectById[r.projectId]
                      : undefined
                    return (
                      <div
                        key={r.id}
                        className="group flex items-center gap-2.5 border-b border-border px-4 py-2 hover:bg-bg-hover"
                      >
                        {/* version chip */}
                        <span className="shrink-0 rounded-md bg-bg-tertiary px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted">
                          {r.version}
                        </span>

                        {/* name */}
                        <span className="truncate text-[13px] font-medium text-fg">
                          {r.name}
                        </span>

                        {/* linked project chip */}
                        {project && (
                          <span className="flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted">
                            <span className="text-[12px] leading-none">
                              {project.icon}
                            </span>
                            <span className="max-w-[120px] truncate">
                              {project.name}
                            </span>
                          </span>
                        )}

                        <div className="ml-auto flex shrink-0 items-center gap-3 text-[12px] text-muted">
                          {/* status picker */}
                          <SelectMenu
                            align="end"
                            width={180}
                            options={statusOptions(r.status)}
                            onSelect={(s) =>
                              updateRelease(r.id, { status: s as ReleaseStatus })
                            }
                            placeholder="Change status…"
                            trigger={
                              <span className={chip}>
                                <StatusDot status={r.status} />
                                {RELEASE_STATUS[r.status].label}
                              </span>
                            }
                          />

                          {/* date */}
                          <span className="tabular-nums text-faint">
                            {r.status === 'released' && r.releasedAt
                              ? `Released ${timeAgo(r.releasedAt)}`
                              : r.targetDate
                                ? formatDate(r.targetDate)
                                : '—'}
                          </span>

                          {/* delete (hover) */}
                          <button
                            type="button"
                            title="Delete release"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete release "${r.name}"? This cannot be undone.`,
                                )
                              )
                                deleteRelease(r.id)
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-faint opacity-0 transition-opacity hover:bg-bg-tertiary hover:text-fg group-hover:opacity-100"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )
          })
        )}
      </div>

      {modalOpen && (
        <NewReleaseModal
          projects={projects}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

// ── New release modal ────────────────────────────────────────────────────────

function NewReleaseModal({
  projects,
  onClose,
}: {
  projects: Project[]
  onClose: () => void
}) {
  const createRelease = useStore((s) => s.createRelease)
  const workspaceName = useStore((s) => s.workspaceName)

  const [name, setName] = useState('')
  const [version, setVersion] = useState('v1.0.0')
  const [status, setStatus] = useState<ReleaseStatus>('planned')
  const [projectId, setProjectId] = useState<string | undefined>(undefined)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const project = projectId
    ? projects.find((p) => p.id === projectId)
    : undefined

  const statusOptions: SelectOption[] = RELEASE_STATUS_ORDER.map((s) => ({
    id: s,
    label: RELEASE_STATUS[s].label,
    icon: <StatusDot status={s} />,
    selected: s === status,
  }))
  const projectOptions: SelectOption[] = [
    {
      id: '__none',
      label: 'No project',
      icon: <MoreHorizontal size={14} className="text-faint" />,
      selected: !projectId,
    },
    ...projects.map((p) => ({
      id: p.id,
      label: p.name,
      icon: <span className="text-[13px] leading-none">{p.icon}</span>,
      selected: p.id === projectId,
    })),
  ]

  function submit() {
    if (!name.trim() || !version.trim()) return
    createRelease({
      name: name.trim(),
      version: version.trim(),
      status,
      projectId,
    })
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-24 animate-fade"
      onMouseDown={onClose}
    >
      <div
        className="w-[520px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[12px] text-muted">
          <span className="rounded-md bg-bg-tertiary px-1.5 py-0.5">
            {workspaceName}
          </span>
          <span className="flex items-center gap-1">
            <Rocket size={12} />
            New release
          </span>
        </div>

        <div className="px-4 py-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Release name"
            className="w-full bg-transparent text-[16px] font-medium text-fg outline-none placeholder:text-faint"
          />

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v1.0.0"
              className="w-28 rounded-md border border-border bg-bg-tertiary px-2 py-1 font-mono text-[12px] tabular-nums text-fg outline-none focus:border-accent"
            />

            <SelectMenu
              width={180}
              options={statusOptions}
              onSelect={(s) => setStatus(s as ReleaseStatus)}
              placeholder="Change status…"
              trigger={
                <span className={chip}>
                  <StatusDot status={status} />
                  {RELEASE_STATUS[status].label}
                </span>
              }
            />

            <SelectMenu
              width={220}
              options={projectOptions}
              onSelect={(id) => setProjectId(id === '__none' ? undefined : id)}
              placeholder="Link a project…"
              trigger={
                <span className={chip}>
                  {project ? (
                    <>
                      <span className="text-[13px] leading-none">
                        {project.icon}
                      </span>
                      <span className="max-w-[140px] truncate">
                        {project.name}
                      </span>
                    </>
                  ) : (
                    'No project'
                  )}
                </span>
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[13px] text-muted hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || !version.trim()}
            onClick={submit}
            className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Create release
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
