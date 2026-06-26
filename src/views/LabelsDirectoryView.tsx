import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tag, Search, ArrowUpDown, ChevronRight, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { LabelChip, LabelDot } from '@/components/LabelChip'
import { EmptyState } from '@/components/EmptyState'
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu'
import type { Label } from '@/lib/types'

// Sort modes for the directory. Default mirrors Linear's alphabetical listing;
// "used" surfaces the busiest labels first by issue count.
type SortMode = 'name' | 'used'

// Linear's group glyph: a small cluster of overlapping dots tinted from the
// group's child label colors (falls back to neutral grey dots when empty).
// Mirrors LabelsSettings' LabelGroupIcon so the directory reads the same.
function LabelGroupIcon({ colors }: { colors: string[] }) {
  const palette = colors.length ? colors : ['#95a2b3', '#95a2b3', '#95a2b3']
  const c = [palette[0], palette[1 % palette.length], palette[2 % palette.length]]
  return (
    <span className="relative inline-block h-3.5 w-3.5 shrink-0">
      <span className="absolute left-0 top-0 h-2 w-2 rounded-full" style={{ background: c[0] }} />
      <span className="absolute right-0 top-0 h-2 w-2 rounded-full" style={{ background: c[1] }} />
      <span className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full" style={{ background: c[2] }} />
    </span>
  )
}

/**
 * A clickable label row → navigates to that label's issues view (/label/:id).
 * A "Details" affordance (revealed on hover) instead opens the co-occurrence
 * panel for that label without leaving the directory. `active` highlights the
 * row whose details panel is currently open.
 */
function LabelRow({
  label,
  count,
  indented,
  active,
  onClick,
  onDetails,
}: {
  label: Label
  count: number
  indented?: boolean
  active?: boolean
  onClick: () => void
  onDetails: () => void
}) {
  return (
    <div
      className={`group relative flex w-full items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-bg-hover ${
        active ? 'bg-bg-hover' : 'bg-bg'
      }`}
    >
      {indented && (
        <span className="absolute left-3 top-0 h-1/2 w-3 border-b border-l border-border" />
      )}
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span className={indented ? 'pl-4' : undefined}>
          <LabelDot color={label.color} size={10} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
          {label.name}
        </span>
      </button>
      {/* Details opener — hidden until the row is hovered or active */}
      <button
        type="button"
        onClick={onDetails}
        className={`shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted transition-opacity hover:bg-bg-secondary hover:text-fg ${
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        Details
      </button>
      <span className="shrink-0 text-right text-[12px] tabular-nums text-faint">
        {count}
      </span>
    </div>
  )
}

/**
 * Co-occurrence detail panel — the labels most frequently applied to the same
 * issues as the selected one. Counts are derived live by scanning every
 * non-archived issue's `labelIds`; nothing here mutates state.
 */
function LabelDetailPanel({
  label,
  total,
  related,
  onClose,
  onOpen,
}: {
  label: Label
  total: number
  related: { label: Label; count: number }[]
  onClose: () => void
  onOpen: (id: string) => void
}) {
  return (
    <aside className="w-64 shrink-0 self-start rounded-lg border border-border bg-bg">
      {/* Panel header — the selected label + its overall usage */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <LabelDot color={label.color} size={10} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
          {label.name}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="shrink-0 rounded p-0.5 text-faint hover:bg-bg-hover hover:text-fg"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-muted">Used on</span>
          <span className="text-[13px] tabular-nums text-fg">
            {total} {total === 1 ? 'issue' : 'issues'}
          </span>
        </div>
      </div>

      {/* Most-paired labels, descending by shared-issue count */}
      <div className="border-t border-border px-3 py-2.5">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
          Often used with
        </div>
        {related.length === 0 ? (
          <p className="text-[12px] text-faint">
            No other labels share an issue with this one.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {related.map(({ label: r, count }) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-bg-hover"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <LabelChip label={r} />
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-faint">
                    {count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

    </aside>
  )
}

/**
 * Labels directory — Linear's workspace "Labels" page. Browse every label in the
 * workspace, organized as groups (with their child labels nested below) followed
 * by ungrouped labels, each showing how many non-archived issues carry it.
 * Clicking a label opens that label's issues view (/label/:id). Editing labels
 * (create / rename / recolor / delete) lives in Settings → Labels.
 */
export function LabelsDirectoryView() {
  const navigate = useNavigate()
  const labels = useStore((s) => s.labels)
  const issues = useStore((s) => s.issues)

  // Local-only directory controls (search query + sort mode).
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('name')

  // Collapsed group sections (by group id). Groups expand by default; clicking a
  // group header tucks its child labels away — Linear's collapsible label groups.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const toggleGroup = (gid: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(gid)) next.delete(gid)
      else next.add(gid)
      return next
    })

  // Co-occurrence detail panel: the label whose related-labels panel is open.
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)

  // labelId → number of non-archived issues carrying it.
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of issues) {
      if (i.archivedAt) continue
      for (const lid of i.labelIds) m.set(lid, (m.get(lid) ?? 0) + 1)
    }
    return m
  }, [issues])

  const usage = (id: string) => counts.get(id) ?? 0

  const labelById = useMemo(() => {
    const m = new Map<string, Label>()
    for (const l of labels) m.set(l.id, l)
    return m
  }, [labels])

  // Live co-occurrence for the selected label: for every non-archived issue
  // that carries it, tally each *other* label on that same issue. The result is
  // the top labels most frequently paired with the selection (descending), plus
  // the selection's own total usage. Purely derived — no mutations.
  const detail = useMemo(() => {
    if (!selectedLabelId) return null
    const label = labelById.get(selectedLabelId)
    if (!label) return null
    const pair = new Map<string, number>()
    let total = 0
    for (const i of issues) {
      if (i.archivedAt) continue
      if (!i.labelIds.includes(selectedLabelId)) continue
      total += 1
      for (const lid of i.labelIds) {
        if (lid === selectedLabelId) continue
        pair.set(lid, (pair.get(lid) ?? 0) + 1)
      }
    }
    const related = [...pair.entries()]
      .map(([id, count]) => ({ label: labelById.get(id), count }))
      // Drop any dangling ids and groups (groups aren't applied to issues).
      .filter((r): r is { label: Label; count: number } => !!r.label && !r.label.isGroup)
      .sort((a, b) => b.count - a.count || a.label.name.localeCompare(b.label.name))
      .slice(0, 6)
    return { label, total, related }
  }, [selectedLabelId, labelById, issues])

  // Header count = every non-group label (groups are containers, not labels).
  const labelCount = useMemo(
    () => labels.filter((l) => !l.isGroup).length,
    [labels],
  )

  const childrenOf = (gid: string) => labels.filter((l) => l.groupId === gid)

  // A group's "usage" is the sum of its child labels' counts — used both for
  // "Most used" sorting and to decide whether a group survives the search.
  const groupUsage = (gid: string) =>
    childrenOf(gid).reduce((sum, k) => sum + usage(k.id), 0)

  // Sort helper: A→Z by name, or descending by issue count (name tiebreak).
  const sortLabels = (a: Label, b: Label) =>
    sort === 'used'
      ? usage(b.id) - usage(a.id) || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name)

  // Substring match (case-insensitive) on a label/group name.
  const q = query.trim().toLowerCase()
  const matches = (name: string) => !q || name.toLowerCase().includes(q)

  // Groups: kept when the group name matches OR any child matches. When the
  // group itself matches we keep all its children; otherwise only the matching
  // ones. Empty (fully filtered-out) groups are dropped.
  const groups = useMemo(() => {
    const result = labels
      .filter((l) => l.isGroup)
      .map((g) => {
        const all = childrenOf(g.id)
        const groupHit = matches(g.name)
        const kids = (groupHit ? all : all.filter((k) => matches(k.name)))
          .slice()
          .sort(sortLabels)
        return { group: g, kids, keep: groupHit || kids.length > 0 }
      })
      .filter((g) => g.keep)
    return sort === 'used'
      ? result.sort((a, b) => groupUsage(b.group.id) - groupUsage(a.group.id))
      : result.sort((a, b) => a.group.name.localeCompare(b.group.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels, q, sort, counts])

  const ungrouped = useMemo(
    () =>
      labels
        .filter((l) => !l.isGroup && !l.groupId && matches(l.name))
        .slice()
        .sort(sortLabels),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [labels, q, sort, counts],
  )

  const sortOptions: SelectOption[] = [
    { id: 'name', label: 'Name', hint: 'A→Z', selected: sort === 'name' },
    { id: 'used', label: 'Most used', selected: sort === 'used' },
  ]
  const sortLabelText = sort === 'used' ? 'Most used' : 'Name'

  // Anything visible after applying the current search?
  const hasResults = groups.length > 0 || ungrouped.length > 0

  if (labelCount === 0) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title="Labels" />
        <EmptyState
          illustration={<Tag size={88} strokeWidth={1.25} />}
          title="No labels yet"
          description="Labels help you categorize and filter issues. Create your first label in Settings."
          action={{ label: 'Go to Settings', onClick: () => navigate('/settings') }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Labels"
        right={
          <span className="text-[12px] text-faint">
            {labelCount} {labelCount === 1 ? 'label' : 'labels'}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          {/* Search + sort controls */}
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter labels…"
                className="w-full rounded-md border border-border bg-bg py-1.5 pl-8 pr-2.5 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
              />
            </div>
            <SelectMenu
              options={sortOptions}
              onSelect={(id) => setSort(id as SortMode)}
              width={180}
              align="end"
              placeholder="Sort by…"
              trigger={
                <span className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[13px] text-muted hover:bg-bg-hover hover:text-fg">
                  <ArrowUpDown size={13} />
                  {sortLabelText}
                </span>
              }
            />
          </div>

          {/* Manage hint */}
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="text-[12px] text-muted hover:text-fg"
            >
              Manage in Settings → Labels
            </button>
          </div>

          {!hasResults ? (
            <div className="rounded-lg border border-border px-3 py-10 text-center text-[13px] text-faint">
              No labels match “{query}”.
            </div>
          ) : (
            <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {/* Groups first, each with its nested child labels. An active
                  search force-expands every group so matches stay visible. */}
              {groups.map(({ group: g, kids }) => {
                const isCollapsed = !q && collapsed.has(g.id)
                return (
                  <div key={g.id}>
                    {/* group header — a collapse toggle, not a link */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      aria-expanded={!isCollapsed}
                      className="flex w-full items-center gap-2 bg-bg-secondary px-3 py-2 text-left transition-colors hover:bg-bg-hover"
                    >
                      <ChevronRight
                        size={13}
                        className={`shrink-0 text-faint transition-transform ${
                          isCollapsed ? '' : 'rotate-90'
                        }`}
                      />
                      <LabelGroupIcon colors={kids.map((k) => k.color)} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
                        {g.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-faint">
                        {kids.length} {kids.length === 1 ? 'label' : 'labels'}
                      </span>
                    </button>
                    {/* child labels nested below (hidden while collapsed) */}
                    {!isCollapsed &&
                      kids.map((k) => (
                        <LabelRow
                          key={k.id}
                          label={k}
                          count={usage(k.id)}
                          indented
                          active={selectedLabelId === k.id}
                          onClick={() => navigate(`/label/${k.id}`)}
                          onDetails={() => setSelectedLabelId(k.id)}
                        />
                      ))}
                  </div>
                )
              })}

              {/* Ungrouped labels in a flat list */}
              {ungrouped.map((l) => (
                <LabelRow
                  key={l.id}
                  label={l}
                  count={usage(l.id)}
                  active={selectedLabelId === l.id}
                  onClick={() => navigate(`/label/${l.id}`)}
                  onDetails={() => setSelectedLabelId(l.id)}
                />
              ))}
            </div>

            {/* Right-side co-occurrence panel for the selected label */}
            {detail && (
              <LabelDetailPanel
                label={detail.label}
                total={detail.total}
                related={detail.related}
                onClose={() => setSelectedLabelId(null)}
                onOpen={(id) => navigate(`/label/${id}`)}
              />
            )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
