import { useStore, useDisplayName } from '@/lib/store'
import { Avatar } from '@/components/Avatar'

/**
 * Member utilization — an Insights widget (Linear's "Utilization"): a horizontal
 * bar per member showing their current open-issue load relative to the busiest
 * person, so over- and under-loaded teammates pop out at a glance. Bars are
 * sorted by utilization (load ÷ busiest), and each row carries a % utilization
 * label rather than a raw count — the busiest member reads 100%.
 */
export function UtilizationChart() {
  // Single-value selectors only (no object literal → no useStoreShallow needed).
  const users = useStore((s) => s.users)
  const issues = useStore((s) => s.issues)
  const states = useStore((s) => s.states)
  const fmt = useDisplayName()

  // State ids that count as "open" work — anything not completed and not canceled.
  const openStateIds = new Set(
    states.filter((s) => s.type !== 'completed' && s.type !== 'canceled').map((s) => s.id),
  )

  // Open issues assigned to each member (skip archived / triage / unassigned).
  const counts = new Map<string, number>()
  for (const i of issues) {
    if (i.archivedAt || i.triage || !i.assigneeId) continue
    if (!openStateIds.has(i.stateId)) continue
    counts.set(i.assigneeId, (counts.get(i.assigneeId) ?? 0) + 1)
  }

  // Active members only — pending invites and suspended accounts don't take work.
  const rows = users
    .filter((u) => !u.pending && !u.suspended)
    .map((user) => ({ user, count: counts.get(user.id) ?? 0 }))
    .filter((r) => r.count >= 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const max = Math.max(...rows.map((r) => r.count), 1)

  return (
    <section className="rounded-xl border border-border bg-bg p-5">
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold text-fg">Utilization</h2>
        <p className="mt-0.5 text-[12px] text-muted">Open issues by assignee</p>
      </div>

      {rows.length === 0 ? (
        <div className="px-1 py-6 text-center text-[12px] text-faint">No open issues assigned</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map(({ user, count }) => {
            // Utilization = this member's load as a share of the busiest member's.
            const pct = Math.round((count / max) * 100)
            return (
              <div key={user.id} className="group flex items-center gap-2.5" title={`${count} open issues`}>
                <Avatar user={user} size={18} />
                <div className="w-28 shrink-0 truncate text-[12px] text-muted group-hover:text-fg">
                  {fmt(user.name)}
                </div>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-10 shrink-0 text-right text-[12px] tabular-nums text-fg">{pct}%</div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
