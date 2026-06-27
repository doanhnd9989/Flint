import { useStore } from '@/lib/store'

// ── Contribution heatmap (GitHub/Linear-style) ───────────────────────────────
// A 7-row × ~12-column grid of day cells covering the trailing 12 weeks, each
// shaded by how much the member contributed that day. A "contribution" counts
// when the member completed an issue assigned to them OR created an issue on
// that local day; both are summed. Reusable per-user (e.g. on a member profile).

/** Local-date key (YYYY-MM-DD) — avoids UTC drift across day boundaries. */
function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Map a day's contribution count onto a 4-step intensity ramp (0 = empty). */
function intensity(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  return 3
}

/** Opacity per non-zero intensity step — the green token at increasing weight. */
const STEP_OPACITY = [0, 0.3, 0.6, 1]

const WEEKS = 12
const DAYS = WEEKS * 7 // 84

export function MemberContributionHeatmap({ userId }: { userId: string }) {
  // Single-value selectors only — never an object literal without useStoreShallow.
  const issues = useStore((s) => s.issues)

  // Tally the member's contributions per local day-key over the whole dataset;
  // we slice down to the trailing window below.
  const counts = new Map<string, number>()
  const bump = (iso: string | undefined) => {
    if (!iso) return
    const k = dayKey(new Date(iso))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  for (const i of issues) {
    if (i.archivedAt) continue
    // Completed an assigned issue that day.
    if (i.assigneeId === userId && i.completedAt) bump(i.completedAt)
    // Created an issue that day.
    if (i.creatorId === userId) bump(i.createdAt)
  }

  // Window: today back 84 days, padded forward to the end of this week (Sat) so
  // the rightmost column is whole, then back to the Sunday starting the grid.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setDate(end.getDate() + (6 - end.getDay())) // forward to Saturday
  const startDay = new Date(end)
  startDay.setDate(startDay.getDate() - (DAYS - 1)) // 84 days inclusive

  // Lay days out into Sunday-aligned week columns.
  const weeks: { key: string; date: Date; count: number }[][] = []
  let total = 0
  const cursor = new Date(startDay)
  while (cursor <= end) {
    const week: { key: string; date: Date; count: number }[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(cursor)
      const key = dayKey(date)
      // Future days within the trailing week render empty.
      const count = date > today ? 0 : counts.get(key) ?? 0
      if (date <= today) total += count
      week.push({ key, date, count })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-medium uppercase text-faint">Contributions</h3>
        <span className="text-[11px] text-muted">Last 12 weeks</span>
      </div>
      {/* Week columns */}
      <div className="flex gap-[3px]">
        {weeks.map((week, col) => (
          <div key={col} className="flex flex-col gap-[3px]">
            {week.map((d) => {
              const level = intensity(d.count)
              const label = d.date.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
              return (
                <div
                  key={d.key}
                  title={`${d.count} ${d.count === 1 ? 'contribution' : 'contributions'} on ${label}`}
                  className={`h-2.5 w-2.5 rounded-[2px] ${level === 0 ? 'bg-bg-tertiary' : ''}`}
                  style={
                    level === 0
                      ? undefined
                      : { backgroundColor: 'var(--c-green)', opacity: STEP_OPACITY[level] }
                  }
                />
              )
            })}
          </div>
        ))}
      </div>
      {/* Footer: total + Less → More legend */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
        <span>
          {total} {total === 1 ? 'contribution' : 'contributions'}
        </span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          <span className="h-2.5 w-2.5 rounded-[2px] bg-bg-tertiary" />
          {STEP_OPACITY.slice(1).map((op, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: 'var(--c-green)', opacity: op }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  )
}
