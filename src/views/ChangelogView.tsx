import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, CheckIllustration } from '@/components/EmptyState'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { RELEASE_STATUS } from '@/lib/constants'
import { cn, formatFullDate, timeAgo } from '@/lib/utils'
import type { Issue, Release, WorkflowState } from '@/lib/types'

/** The header type-filter segments. */
type TypeFilter = 'all' | 'releases' | 'issues'
const TYPE_SEGMENTS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'releases', label: 'Releases' },
  { id: 'issues', label: 'Completed issues' },
]

/** A shipped release with its completed issues, ready to render. */
interface ChangelogEntry {
  release: Release
  issues: Issue[]
}

/** A small ✓ + identifier + title row used in both timeline + recent lists. */
function ShippedRow({ issue, time }: { issue: Issue; time?: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[13px]">
      <span className="shrink-0 text-[var(--status-completed)]">✓</span>
      <span className="shrink-0 font-mono text-[12px] tabular-nums text-faint">
        {issue.identifier}
      </span>
      <span className="min-w-0 flex-1 truncate text-fg">{issue.title}</span>
      {time && <span className="shrink-0 text-[12px] text-faint">{time}</span>}
    </div>
  )
}

export function ChangelogView() {
  const data = useStore()

  // Local-only header filters: a type segment (all / releases / completed
  // issues) and a team picker. They compose with AND.
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')

  // Map of stateId → workflow state, to read each issue's state type.
  const stateById = useMemo(() => {
    const m = new Map<string, WorkflowState>()
    data.states.forEach((s) => m.set(s.id, s))
    return m
  }, [data.states])

  const isCompleted = useMemo(
    () => (i: Issue) => stateById.get(i.stateId)?.type === 'completed',
    [stateById],
  )

  // projectId → the team ids it spans, for resolving a release's team.
  const projectTeamIds = useMemo(() => {
    const m = new Map<string, string[]>()
    data.projects.forEach((p) => m.set(p.id, p.teamIds))
    return m
  }, [data.projects])

  // A release belongs to `teamFilter` when its linked project spans that team.
  // Releases with no project (or no team match) are hidden when a team is set.
  const releaseInTeam = useMemo(
    () => (r: Release) => {
      if (teamFilter === 'all') return true
      if (!r.projectId) return false
      return (projectTeamIds.get(r.projectId) ?? []).includes(teamFilter)
    },
    [teamFilter, projectTeamIds],
  )

  // An issue belongs to `teamFilter` when its own teamId matches.
  const issueInTeam = useMemo(
    () => (i: Issue) => teamFilter === 'all' || i.teamId === teamFilter,
    [teamFilter],
  )

  // ── Shipped releases (newest first) with their completed project issues ──────
  // Releases are dropped entirely when the type filter excludes them or when a
  // team is chosen the release can't be resolved into.
  const entries = useMemo<ChangelogEntry[]>(() => {
    if (typeFilter === 'issues') return []
    const released = data.releases
      .filter((r) => r.status === 'released' && releaseInTeam(r))
      .sort((a, b) => {
        const ta = a.releasedAt ? new Date(a.releasedAt).getTime() : 0
        const tb = b.releasedAt ? new Date(b.releasedAt).getTime() : 0
        return tb - ta
      })
    return released.map((release) => ({
      release,
      issues: release.projectId
        ? data.issues
            .filter((i) => i.projectId === release.projectId && isCompleted(i) && !i.archivedAt)
            .sort((a, b) => {
              const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0
              const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0
              return tb - ta
            })
        : [],
    }))
  }, [data.releases, data.issues, isCompleted, typeFilter, releaseInTeam])

  // ── "Recently completed" — 10 most-recent completed issues not in a release ──
  // Suppressed when the type filter is "releases"; team-filtered by issue teamId.
  const recent = useMemo<Issue[]>(() => {
    if (typeFilter === 'releases') return []
    const covered = new Set<string>()
    entries.forEach((e) => e.issues.forEach((i) => covered.add(i.id)))
    return data.issues
      .filter(
        (i) =>
          isCompleted(i) && !covered.has(i.id) && !i.archivedAt && issueInTeam(i),
      )
      .sort((a, b) => {
        const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0
        const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0
        return tb - ta
      })
      .slice(0, 10)
  }, [data.issues, entries, isCompleted, typeFilter, issueInTeam])

  // Team filter options: "All teams" + every team in the workspace.
  const teamOptions = useMemo<SelectOption[]>(
    () => [
      { id: 'all', label: 'All teams', selected: teamFilter === 'all' },
      ...data.teams.map((t) => ({
        id: t.id,
        label: t.name,
        icon: t.icon ? <span>{t.icon}</span> : undefined,
        selected: teamFilter === t.id,
      })),
    ],
    [data.teams, teamFilter],
  )

  // Label for the team-filter trigger chip.
  const teamFilterLabel =
    teamFilter === 'all'
      ? 'All teams'
      : (data.teams.find((t) => t.id === teamFilter)?.name ?? 'All teams')

  // Whether any source data exists at all (drives the empty vs. no-match copy).
  const hasAnyData = data.releases.some((r) => r.status === 'released') ||
    data.issues.some((i) => isCompleted(i) && !i.archivedAt)
  const empty = entries.length === 0 && recent.length === 0

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Changelog">
        {/* Header filters — type segments + team picker, both local-only and
            composed with AND. Hidden when there's no shipped data at all. */}
        {hasAnyData && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg-tertiary p-0.5">
              {TYPE_SEGMENTS.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setTypeFilter(seg.id)}
                  className={cn(
                    'rounded px-2 py-0.5 text-[12px] transition-colors',
                    typeFilter === seg.id
                      ? 'bg-bg-selected text-fg'
                      : 'text-muted hover:text-fg',
                  )}
                >
                  {seg.label}
                </button>
              ))}
            </div>
            <SelectMenu
              width={200}
              align="end"
              options={teamOptions}
              onSelect={setTeamFilter}
              placeholder="Filter by team…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <span className="max-w-[120px] truncate">{teamFilterLabel}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
          </div>
        )}
      </ViewHeader>
      {empty ? (
        <EmptyState
          illustration={<CheckIllustration />}
          title={hasAnyData ? 'Nothing matches' : 'Nothing shipped yet'}
          description={
            hasAnyData
              ? 'No shipped work matches the current type or team filter.'
              : "When releases ship and issues are completed, they'll appear here as a timeline of everything that's shipped."
          }
        />
      ) : (
        <div className="flex-1 overflow-y-auto bg-bg-secondary">
          <div className="mx-auto max-w-3xl px-8 py-8">
            <div className="mb-6">
              <h1 className="text-[18px] font-semibold tracking-tight text-fg">
                What's shipped
              </h1>
              <p className="mt-0.5 text-[13px] text-muted">
                A timeline of released work, newest first.
              </p>
            </div>

            {/* Vertical timeline rail — a left border with accent dots per entry. */}
            <div className="relative space-y-8 border-l border-border pl-7">
              {entries.map((entry) => {
                const meta = RELEASE_STATUS[entry.release.status]
                return (
                  <article key={entry.release.id} className="relative">
                    {/* dot on the rail */}
                    <span className="absolute -left-[33px] top-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-bg-secondary" />
                    <div className="text-[12px] font-medium uppercase tracking-wide text-faint">
                      {formatFullDate(entry.release.releasedAt)}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white"
                        style={{ backgroundColor: meta.color }}
                      >
                        {entry.release.version}
                      </span>
                      <h2 className="text-[15px] font-semibold text-fg">
                        {entry.release.name}
                      </h2>
                    </div>
                    {entry.release.description && (
                      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                        {entry.release.description}
                      </p>
                    )}
                    {entry.issues.length > 0 && (
                      <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-bg p-3">
                        {entry.issues.map((i) => (
                          <ShippedRow key={i.id} issue={i} />
                        ))}
                      </div>
                    )}
                  </article>
                )
              })}

              {/* Recently completed — loose completed issues not in a release. */}
              {recent.length > 0 && (
                <article className="relative">
                  <span className="absolute -left-[33px] top-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-bg-secondary" />
                  <h2 className="text-[15px] font-semibold text-fg">
                    Recently completed
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted">
                    The latest issues completed across the workspace.
                  </p>
                  <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-bg p-3">
                    {recent.map((i) => (
                      <ShippedRow
                        key={i.id}
                        issue={i}
                        time={i.completedAt ? timeAgo(i.completedAt) : undefined}
                      />
                    ))}
                  </div>
                </article>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
