import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tag, Search, ArrowUpDown } from 'lucide-react'
import { useStore } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { LabelDot } from '@/components/LabelChip'
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

/** A clickable label row → navigates to that label's issues view (/label/:id). */
function LabelRow({
  label,
  count,
  indented,
  onClick,
}: {
  label: Label
  count: number
  indented?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full items-center gap-2.5 bg-bg px-3 py-2.5 text-left transition-colors hover:bg-bg-hover"
    >
      {indented && (
        <span className="absolute left-3 top-0 h-1/2 w-3 border-b border-l border-border" />
      )}
      <span className={indented ? 'pl-4' : undefined}>
        <LabelDot color={label.color} size={10} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-fg group-hover:text-fg">
        {label.name}
      </span>
      <span className="shrink-0 text-right text-[12px] tabular-nums text-faint">
        {count}
      </span>
    </button>
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
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {/* Groups first, each with its nested child labels */}
              {groups.map(({ group: g, kids }) => (
                <div key={g.id}>
                  {/* group header — a non-link container row */}
                  <div className="flex items-center gap-2.5 bg-bg-secondary px-3 py-2">
                    <LabelGroupIcon colors={kids.map((k) => k.color)} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
                      {g.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-faint">
                      {kids.length} {kids.length === 1 ? 'label' : 'labels'}
                    </span>
                  </div>
                  {/* child labels nested below */}
                  {kids.map((k) => (
                    <LabelRow
                      key={k.id}
                      label={k}
                      count={usage(k.id)}
                      indented
                      onClick={() => navigate(`/label/${k.id}`)}
                    />
                  ))}
                </div>
              ))}

              {/* Ungrouped labels in a flat list */}
              {ungrouped.map((l) => (
                <LabelRow
                  key={l.id}
                  label={l}
                  count={usage(l.id)}
                  onClick={() => navigate(`/label/${l.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
