import { useMemo, useState } from 'react'
import { ChevronDown, Copy, Link, Search } from 'lucide-react'
import { useStore } from '@/lib/store'
import { copyToClipboard } from '@/lib/toast'
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

/** Entries bucketed under a single calendar month, e.g. "June 2026". */
interface MonthGroup {
  /** Stable key, e.g. "2026-05" (zero-padded) used for React keys. */
  key: string
  /** Human label, e.g. "June 2026". */
  label: string
  entries: ChangelogEntry[]
}

/** Bucket a release's released date into a "YYYY-MM" key / "Month YYYY" label. */
function monthKey(iso?: string): { key: string; label: string } {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return { key: '0000-00', label: 'Undated' }
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  return { key, label }
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

  // Local-only header filters: a full-text query, a type segment (all /
  // releases / completed issues) and a team picker. All compose with AND.
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')

  // Normalized search needle; empty string means "no text filter".
  const needle = query.trim().toLowerCase()

  // An issue matches the search when its title or identifier contains the
  // needle (case-insensitive). Empty needle matches everything.
  const issueMatches = useMemo(
    () => (i: Issue) =>
      needle === '' ||
      i.title.toLowerCase().includes(needle) ||
      i.identifier.toLowerCase().includes(needle),
    [needle],
  )

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
    // Does the release's own text (version / name / description) match search?
    const releaseTextMatches = (r: Release) =>
      needle === '' ||
      r.version.toLowerCase().includes(needle) ||
      r.name.toLowerCase().includes(needle) ||
      (r.description?.toLowerCase().includes(needle) ?? false)

    const released = data.releases
      .filter((r) => r.status === 'released' && releaseInTeam(r))
      .sort((a, b) => {
        const ta = a.releasedAt ? new Date(a.releasedAt).getTime() : 0
        const tb = b.releasedAt ? new Date(b.releasedAt).getTime() : 0
        return tb - ta
      })
    return released
      .map((release) => {
        const allIssues = release.projectId
          ? data.issues
              .filter((i) => i.projectId === release.projectId && isCompleted(i) && !i.archivedAt)
              .sort((a, b) => {
                const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0
                const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0
                return tb - ta
              })
          : []
        // When the release header itself matches, keep all its issues;
        // otherwise narrow to the issues that match the search needle.
        const matchedIssues = releaseTextMatches(release)
          ? allIssues
          : allIssues.filter(issueMatches)
        return { release, issues: matchedIssues, headerMatch: releaseTextMatches(release) }
      })
      // Drop a release entirely when neither it nor any of its issues match.
      .filter((e) => e.headerMatch || e.issues.length > 0)
      .map(({ release, issues }) => ({ release, issues }))
  }, [data.releases, data.issues, isCompleted, typeFilter, releaseInTeam, needle, issueMatches])

  // ── Bucket the (already date-sorted) entries under month section dividers ─────
  // Entries arrive newest-first, so groups and their members preserve that
  // order; each month renders as a "June 2026" header on the shared rail.
  const monthGroups = useMemo<MonthGroup[]>(() => {
    const groups: MonthGroup[] = []
    let current: MonthGroup | null = null
    for (const entry of entries) {
      const { key, label } = monthKey(entry.release.releasedAt)
      if (!current || current.key !== key) {
        current = { key, label, entries: [] }
        groups.push(current)
      }
      current.entries.push(entry)
    }
    return groups
  }, [entries])

  // ── "Recently completed" — 10 most-recent completed issues not in a release ──
  // Suppressed when the type filter is "releases"; team-filtered by issue teamId.
  const recent = useMemo<Issue[]>(() => {
    if (typeFilter === 'releases') return []
    const covered = new Set<string>()
    entries.forEach((e) => e.issues.forEach((i) => covered.add(i.id)))
    return data.issues
      .filter(
        (i) =>
          isCompleted(i) &&
          !covered.has(i.id) &&
          !i.archivedAt &&
          issueInTeam(i) &&
          issueMatches(i),
      )
      .sort((a, b) => {
        const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0
        const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0
        return tb - ta
      })
      .slice(0, 10)
  }, [data.issues, entries, isCompleted, typeFilter, issueInTeam, issueMatches])

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

  // Smooth-scroll the matching release article into view. Reuses the per-entry
  // anchor id (`#${release.id}`) the copy-link affordance already links to.
  const scrollToEntry = (releaseId: string) => {
    const el = document.getElementById(releaseId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Changelog">
        {/* Header filters — type segments + team picker, both local-only and
            composed with AND. Hidden when there's no shipped data at all. */}
        {hasAnyData && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg-tertiary px-2 py-1 focus-within:border-accent">
              <Search size={13} className="shrink-0 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search changelog…"
                className="w-40 bg-transparent text-[12px] text-fg outline-none placeholder:text-faint"
              />
            </div>
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
          title={
            hasAnyData
              ? needle
                ? 'No results'
                : 'Nothing matches'
              : 'Nothing shipped yet'
          }
          description={
            hasAnyData
              ? needle
                ? `No shipped work matches “${query.trim()}”.`
                : 'No shipped work matches the current type or team filter.'
              : "When releases ship and issues are completed, they'll appear here as a timeline of everything that's shipped."
          }
        />
      ) : (
        <div className="flex-1 overflow-y-auto bg-bg-secondary">
          <div className="mx-auto flex max-w-5xl gap-10 px-8 py-8">
            <div className="min-w-0 max-w-3xl flex-1">
            <div className="mb-6">
              <h1 className="text-[18px] font-semibold tracking-tight text-fg">
                What's shipped
              </h1>
              <p className="mt-0.5 text-[13px] text-muted">
                A timeline of released work, newest first.
              </p>
            </div>

            {/* Vertical timeline rail — a left border, grouped under month
                section dividers ("June 2026") with accent dots per entry. */}
            <div className="relative space-y-8 border-l border-border pl-7">
              {monthGroups.map((group) => (
                <section key={group.key} className="relative space-y-8">
                  {/* Month divider — sits on the rail with a hollow marker. */}
                  <div className="relative">
                    <span className="absolute -left-[33px] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-border bg-bg-secondary" />
                    <h3 className="text-[13px] font-semibold tracking-tight text-fg">
                      {group.label}
                    </h3>
                  </div>
                  {group.entries.map((entry) => {
                    const meta = RELEASE_STATUS[entry.release.status]
                    return (
                      <article
                        key={entry.release.id}
                        id={entry.release.id}
                        className="group/release relative scroll-mt-8"
                      >
                        {/* dot on the rail */}
                        <span className="absolute -left-[33px] top-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-bg-secondary" />
                        <div className="flex items-center gap-2">
                          <div className="text-[12px] font-medium uppercase tracking-wide text-faint">
                            {formatFullDate(entry.release.releasedAt)}
                          </div>
                          {/* Hover-revealed deep link to this release on the changelog. */}
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                `${window.location.origin}/changelog#${entry.release.id}`,
                                'Link to release copied to clipboard',
                              )
                            }
                            title="Copy link"
                            aria-label={`Copy link to ${entry.release.name}`}
                            className="flex h-5 items-center gap-1 rounded px-1 text-[11px] text-faint opacity-0 transition-opacity hover:bg-bg-hover hover:text-fg focus-visible:opacity-100 group-hover/release:opacity-100"
                          >
                            <Link size={11} />
                            Copy link
                          </button>
                        </div>
                        <div className="group/version mt-1.5 flex items-center gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white"
                            style={{ backgroundColor: meta.color }}
                          >
                            {entry.release.version}
                          </span>
                          {/* Hover-revealed copy affordance for the version string. */}
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                entry.release.version,
                                `"${entry.release.version}" copied to clipboard`,
                              )
                            }
                            title="Copy version"
                            aria-label={`Copy version ${entry.release.version}`}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-faint opacity-0 transition-opacity hover:bg-bg-hover hover:text-fg group-hover/version:opacity-100"
                          >
                            <Copy size={12} />
                          </button>
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
                </section>
              ))}

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

            {/* Sticky version index — one row per release (version + date),
                grouped under its month, smooth-scrolling to that article on
                click. Reuses the same `#${release.id}` anchors as copy-link.
                Hidden on narrow viewports where the column won't fit. */}
            {monthGroups.length > 0 && (
              <aside className="hidden w-52 shrink-0 lg:block">
                <nav className="sticky top-8 space-y-4">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                    Versions
                  </h2>
                  {monthGroups.map((group) => (
                    <div key={group.key} className="space-y-1">
                      <h3 className="text-[12px] font-medium tracking-tight text-muted">
                        {group.label}
                      </h3>
                      <ul className="space-y-0.5">
                        {group.entries.map((entry) => (
                          <li key={entry.release.id}>
                            <button
                              type="button"
                              onClick={() => scrollToEntry(entry.release.id)}
                              className="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-bg-hover"
                            >
                              <span className="shrink-0 text-[12px] font-medium tabular-nums text-fg">
                                {entry.release.version}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[12px] text-faint">
                                {formatFullDate(entry.release.releasedAt)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </nav>
              </aside>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
