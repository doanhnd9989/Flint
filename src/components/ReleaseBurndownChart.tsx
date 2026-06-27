import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { RELEASE_STATUS } from '@/lib/constants'
import { formatDate, cn } from '@/lib/utils'
import type { Issue, WorkflowState } from '@/lib/types'

/**
 * "Release progress" — a compact panel showing how far a release is toward
 * completion. Mirrors Linear's release progress indicator.
 *
 * Issue association: a {@link Release} has no direct issue link in the data
 * model, but it carries an optional `projectId`. {@link ReleasesView} already
 * derives a release's progress from that linked **project's issues** (it counts
 * completed/canceled issues as "done" via `progressByProject`). We use the same
 * association here — the issues of the release's `projectId`, bucketed by
 * workflow-state type into Completed / In progress / Remaining.
 *
 * When the release has no linked project (or the project has no issues), we
 * fall back to an honest date-based bar: percent of the planned window elapsed
 * from `createdAt` → `targetDate`, with a "today" marker.
 */
export function ReleaseBurndownChart({ releaseId }: { releaseId: string }) {
  const releases = useStore((s) => s.releases)
  const issues = useStore((s) => s.issues)
  const states = useStore((s) => s.states)

  const release = useMemo(
    () => releases.find((r) => r.id === releaseId),
    [releases, releaseId],
  )

  /** stateId → workflow type, used to bucket the project's issues. */
  const typeByState = useMemo(() => {
    const m: Record<string, WorkflowState['type']> = {}
    for (const st of states as WorkflowState[]) m[st.id] = st.type
    return m
  }, [states])

  /** Completed / in-progress / remaining counts over the linked project's issues. */
  const counts = useMemo(() => {
    if (!release?.projectId) return null
    let done = 0
    let inProgress = 0
    let remaining = 0
    let total = 0
    for (const i of issues as Issue[]) {
      if (i.projectId !== release.projectId) continue
      total += 1
      const t = typeByState[i.stateId]
      if (t === 'completed' || t === 'canceled') done += 1
      else if (t === 'started') inProgress += 1
      else remaining += 1
    }
    if (total === 0) return null
    return { done, inProgress, remaining, total }
  }, [release?.projectId, issues, typeByState])

  if (!release) return null

  // ── Issue-based progress (preferred) ──────────────────────────────────────
  if (counts) {
    const { done, inProgress, remaining, total } = counts
    const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100)
    const donePct = Math.round(pct(done))

    return (
      <Panel>
        <Header
          label={`${done}/${total}`}
          sub={`${donePct}% complete`}
          color={RELEASE_STATUS[release.status].color}
        />

        {/* Segmented bar: done (accent) · in progress (subtle) · remainder */}
        <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
          <span
            className="h-full bg-accent transition-all"
            style={{ width: `${pct(done)}%` }}
          />
          <span
            className="h-full bg-accent-subtle transition-all"
            style={{ width: `${pct(inProgress)}%` }}
          />
        </div>

        {/* Count breakdown */}
        <div className="mt-2.5 flex items-center gap-4 text-[11px] tabular-nums">
          <Legend dotClass="bg-accent" label="Completed" value={done} />
          <Legend dotClass="bg-accent-subtle" label="In progress" value={inProgress} />
          <Legend dotClass="bg-bg-tertiary" label="Remaining" value={remaining} />
        </div>
      </Panel>
    )
  }

  // ── Date-based fallback (no issue association available) ───────────────────
  const start = release.createdAt ? new Date(release.createdAt).getTime() : null
  const end = release.targetDate ? new Date(release.targetDate).getTime() : null

  if (start == null || end == null || end <= start) {
    // Nothing to chart — neither issues nor a usable date window.
    return (
      <Panel>
        <Header label="—" color={RELEASE_STATUS[release.status].color} />
        <p className="mt-2 text-[11px] text-faint">
          No linked project issues or target date to track progress.
        </p>
      </Panel>
    )
  }

  const now = Date.now()
  const elapsedPct = Math.round(
    (Math.min(Math.max(now, start), end) - start) / (end - start) * 100,
  )

  return (
    <Panel>
      <Header
        label={`${elapsedPct}%`}
        sub="of timeline elapsed"
        color={RELEASE_STATUS[release.status].color}
      />

      {/* Time-elapsed bar with a "today" marker */}
      <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
        <span
          className="block h-full bg-accent transition-all"
          style={{ width: `${elapsedPct}%` }}
        />
        {now > start && now < end && (
          <span
            className="absolute top-0 h-full w-px bg-[var(--border-strong)]"
            style={{ left: `${elapsedPct}%` }}
          />
        )}
      </div>

      {/* start → target */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] tabular-nums text-faint">
        <span>{formatDate(release.createdAt)}</span>
        <span className={cn(now > end && 'text-accent')}>
          {release.targetDate ? formatDate(release.targetDate) : '—'}
        </span>
      </div>
    </Panel>
  )
}

/** Bordered "Progress" card matching the releases UI tokens. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-faint">
        Progress
      </div>
      {children}
    </div>
  )
}

/** The big figure + sub-label, with a status dot. */
function Header({
  label,
  sub,
  color,
}: {
  label: string
  sub?: string
  color: string
}) {
  return (
    <div className="mt-1 flex items-baseline gap-2">
      <span
        className="h-2 w-2 shrink-0 self-center rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[15px] font-semibold tabular-nums text-fg">{label}</span>
      {sub && <span className="text-[12px] text-muted">{sub}</span>}
    </div>
  )
}

/** One legend chip: a color dot, a label, and a count. */
function Legend({
  dotClass,
  label,
  value,
}: {
  dotClass: string
  label: string
  value: number
}) {
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <span className={cn('h-2 w-2 rounded-full', dotClass)} />
      {label}
      <span className="text-fg">{value}</span>
    </span>
  )
}
