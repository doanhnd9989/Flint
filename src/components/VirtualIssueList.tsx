import { useEffect, useRef, useState } from 'react'
import type { IssueGroup } from '@/lib/selectors'
import type { GroupBy, Issue } from '@/lib/types'
import { IssueRow } from './IssueRow'
import { IssueGroupHeader } from './IssueGroupHeader'
import { useFontScale } from '@/lib/useTheme'

/** Row height at the default font size; scaled by the Font size preference. */
const BASE_ITEM_H = 36
/**
 * A row never gets shorter than its fixed chrome: the 20px picker buttons plus
 * `py-1.5` and the bottom border measure ~42.4px however small the type gets.
 * The scaled height only overtakes that from the "larger" step up, so without
 * this floor every windowed row is a few px short of its own content and loses
 * its bottom border — the JS-sizing trap, in its quiet form.
 */
const MIN_ITEM_H = 43
const OVERSCAN = 8

type Row =
  | { kind: 'header'; group: IssueGroup }
  | { kind: 'issue'; issue: Issue }

/**
 * Windowed renderer for large grouped issue lists — only the rows visible in the
 * viewport are mounted, so a list with thousands of issues stays smooth.
 * Fixed row height keeps the math exact; used in place of the dnd list above a
 * size threshold (so drag-to-reorder drops out, which is the right trade-off
 * for very large lists). The group header is the shared one: Linear keeps its
 * collapse / select-all / `⋯` / `+` controls at every list size, so a long list
 * must not degrade into bare labels.
 */
export function VirtualIssueList({
  groups,
  groupBy,
  collapsed,
  onToggleCollapsed,
  onCollapse,
}: {
  groups: IssueGroup[]
  groupBy: GroupBy
  collapsed: Record<string, boolean>
  onToggleCollapsed: (key: string) => void
  onCollapse: (key: string) => void
}) {
  const rows: Row[] = []
  for (const group of groups) {
    rows.push({ kind: 'header', group })
    if (!collapsed[group.key])
      for (const issue of group.issues) rows.push({ kind: 'issue', issue })
  }

  const ref = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(800)
  // The rows are sized in JS, so they can't inherit the font scale from CSS the
  // way the rest of the list does — without this the text grows and the row
  // doesn't, and every title gets its descenders clipped.
  const ITEM_H = Math.max(MIN_ITEM_H, Math.round(BASE_ITEM_H * useFontScale()))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setHeight(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const total = rows.length
  const start = Math.max(0, Math.floor(scrollTop / ITEM_H) - OVERSCAN)
  const end = Math.min(total, Math.ceil((scrollTop + height) / ITEM_H) + OVERSCAN)
  const visible = rows.slice(start, end)

  return (
    <div
      ref={ref}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="flex-1 overflow-y-auto"
    >
      <div style={{ height: total * ITEM_H, position: 'relative' }}>
        <div style={{ transform: `translateY(${start * ITEM_H}px)` }}>
          {visible.map((row, i) =>
            row.kind === 'header' ? (
              <IssueGroupHeader
                key={`h-${row.group.key}-${start + i}`}
                group={row.group}
                groupBy={groupBy}
                collapsed={!!collapsed[row.group.key]}
                onToggleCollapsed={() => onToggleCollapsed(row.group.key)}
                onCollapse={() => onCollapse(row.group.key)}
                height={ITEM_H}
                // The header is absolutely positioned inside the window, so a
                // sticky header would detach from its group as you scroll.
                sticky={false}
              />
            ) : (
              <div key={row.issue.id} style={{ height: ITEM_H }} className="overflow-hidden">
                <IssueRow issue={row.issue} showStatus={groupBy !== 'status'} />
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
