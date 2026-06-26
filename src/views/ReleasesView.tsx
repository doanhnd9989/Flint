import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDownUp,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Rocket,
  X,
} from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, StackIllustration } from '@/components/EmptyState'
import { ProgressDonut } from '@/components/ProgressDonut'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { RELEASE_STATUS, RELEASE_STATUS_ORDER } from '@/lib/constants'
import { formatDate, timeAgo, cn } from '@/lib/utils'
import type { Issue, Project, ReleaseStatus, WorkflowState } from '@/lib/types'

/** Status filter values for the segmented pill row ('all' = no filter). */
type StatusFilter = 'all' | ReleaseStatus
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'planned', label: 'Planned' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'released', label: 'Released' },
  { id: 'canceled', label: 'Canceled' },
]

/** Sort modes ordering releases *within* each status group. */
type SortMode = 'manual' | 'version' | 'target' | 'name' | 'created'
const SORT_LABELS: Record<SortMode, string> = {
  manual: 'Manual',
  version: 'Version',
  target: 'Target date',
  name: 'Name',
  created: 'Recently created',
}

/**
 * Compare two version strings semantically (descending — newest first).
 * Splits on non-digits so "v1.10.0" sorts above "v1.9.0", and falls back to
 * a plain locale compare when a version has no numeric parts.
 */
function compareVersionDesc(a: string, b: string): number {
  const pa = a.match(/\d+/g)?.map(Number) ?? []
  const pb = b.match(/\d+/g)?.map(Number) ?? []
  if (pa.length === 0 && pb.length === 0) return a.localeCompare(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return db - da
  }
  return 0
}

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
  const { releases, projects, issues, states } = useStoreShallow((s) => ({
    releases: s.releases,
    projects: s.projects,
    issues: s.issues,
    states: s.states,
  }))
  const updateRelease = useStore((s) => s.updateRelease)
  const deleteRelease = useStore((s) => s.deleteRelease)

  const [modalOpen, setModalOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortMode>('manual')

  const projectById = useMemo(() => {
    const m: Record<string, Project> = {}
    for (const p of projects) m[p.id] = p
    return m
  }, [projects])

  /** stateIds whose workflow type counts as "done" (completed or canceled). */
  const doneStateIds = useMemo(() => {
    const ids = new Set<string>()
    for (const st of states as WorkflowState[])
      if (st.type === 'completed' || st.type === 'canceled') ids.add(st.id)
    return ids
  }, [states])

  /** projectId → { done, total } over that project's issues. */
  const progressByProject = useMemo(() => {
    const m: Record<string, { done: number; total: number }> = {}
    for (const i of issues as Issue[]) {
      if (!i.projectId) continue
      const p = (m[i.projectId] ??= { done: 0, total: 0 })
      p.total += 1
      if (doneStateIds.has(i.stateId)) p.done += 1
    }
    return m
  }, [issues, doneStateIds])

  /**
   * Releases grouped by status, in RELEASE_STATUS_ORDER (empty groups dropped).
   * Within each group rows are ordered by the chosen sort mode; 'manual' keeps
   * the persisted sortOrder.
   */
  const groups = useMemo(() => {
    const sorted = [...releases]
      .filter((r) => statusFilter === 'all' || r.status === statusFilter)
      .sort((a, b) => {
        switch (sort) {
          case 'version':
            return compareVersionDesc(a.version, b.version)
          case 'target':
            // Releases without a target date sink to the bottom.
            return (a.targetDate ?? '￿').localeCompare(b.targetDate ?? '￿')
          case 'name':
            return a.name.localeCompare(b.name)
          case 'created':
            return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
          default:
            return a.sortOrder - b.sortOrder
        }
      })
    return RELEASE_STATUS_ORDER.map((status) => ({
      status,
      items: sorted.filter((r) => r.status === status),
    })).filter((g) => g.items.length > 0)
  }, [releases, statusFilter, sort])

  /** Sort dropdown options for the header control. */
  const sortOptions: SelectOption[] = (
    Object.keys(SORT_LABELS) as SortMode[]
  ).map((m) => ({ id: m, label: SORT_LABELS[m], selected: sort === m }))

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
          <div className="flex items-center gap-2">
            {/* Sort dropdown — orders rows within each status group. */}
            {releases.length > 0 && (
              <SelectMenu
                width={180}
                align="end"
                options={sortOptions}
                onSelect={(id) => setSort(id as SortMode)}
                placeholder="Sort by…"
                trigger={
                  <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                    <ArrowDownUp size={13} className="shrink-0 text-faint" />
                    <span className="whitespace-nowrap">{SORT_LABELS[sort]}</span>
                    <ChevronDown size={13} className="shrink-0 text-faint" />
                  </span>
                }
              />
            )}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:bg-accent-hover"
            >
              <Plus size={13} />
              New release
            </button>
          </div>
        }
      />

      {/* status filter — segmented pill row narrowing the list */}
      {releases.length > 0 && (
        <div className="flex items-center gap-1 border-b border-border px-4 py-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                'rounded-md px-2 py-1 text-[12px] font-medium',
                statusFilter === f.id
                  ? 'bg-bg-selected text-fg'
                  : 'text-muted hover:bg-bg-hover',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {releases.length === 0 ? (
          <EmptyState
            illustration={<StackIllustration />}
            title="Releases"
            description="Releases bundle shipped work into versioned milestones. Track what's planned, in progress, and shipped — optionally tied to a project."
            action={{ label: 'New release', onClick: () => setModalOpen(true) }}
          />
        ) : groups.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-faint">
            No {RELEASE_STATUS[statusFilter as ReleaseStatus].label.toLowerCase()}{' '}
            releases.
          </div>
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
                    // issue progress from the linked project (none → nothing)
                    const progress = r.projectId
                      ? progressByProject[r.projectId]
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
                          {/* issue progress from linked project */}
                          {progress && progress.total > 0 && (
                            <span
                              className="flex items-center gap-1.5 tabular-nums text-faint"
                              title={`${progress.done} of ${progress.total} issues done`}
                            >
                              <ProgressDonut
                                percent={Math.round(
                                  (progress.done / progress.total) * 100,
                                )}
                              />
                              {progress.done}/{progress.total}
                            </span>
                          )}

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
