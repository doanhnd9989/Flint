import { useStore } from '@/lib/store';

/**
 * Team velocity — Linear's throughput trend: a small vertical bar chart of
 * completed issues per cycle across the team's most recent cycles. Bars are
 * height-proportional to the busiest cycle; hover (or the value on top) reveals
 * the exact completed count and points shipped.
 */
export function TeamVelocityChart({ teamId }: { teamId: string }) {
  // Single-value selectors only — never an object literal without useStoreShallow.
  const cycles = useStore((s) => s.cycles);
  const issues = useStore((s) => s.issues);
  const states = useStore((s) => s.states);

  // State ids whose workflow type is 'completed' (see StatusType in types.ts).
  const completedStateIds = new Set(
    states.filter((s) => s.type === 'completed').map((s) => s.id),
  );

  // The team's cycles, newest first, capped at the last ~6 for a readable trend.
  const teamCycles = cycles
    .filter((c) => c.teamId === teamId)
    .sort((a, b) => b.number - a.number)
    .slice(0, 6)
    .reverse(); // oldest → newest, left → right

  // Per-cycle completed-issue count (+ points shipped) for issues in that cycle.
  const bars = teamCycles.map((cycle) => {
    let count = 0;
    let points = 0;
    for (const i of issues) {
      if (i.cycleId !== cycle.id) continue;
      if (i.archivedAt) continue;
      if (!completedStateIds.has(i.stateId)) continue;
      count++;
      points += i.estimate ?? 0;
    }
    return { number: cycle.number, count, points };
  });

  // Need at least two cycles that actually shipped something to show a trend.
  const withData = bars.filter((b) => b.count > 0);
  if (withData.length < 2) {
    return (
      <section>
        <h3 className="text-[11px] font-medium uppercase text-faint mb-1">Velocity</h3>
        <p className="text-[12px] text-faint">Not enough cycle history yet.</p>
      </section>
    );
  }

  const max = Math.max(...bars.map((b) => b.count), 1);

  return (
    <section>
      <h3 className="text-[11px] font-medium uppercase text-faint mb-0.5">Velocity</h3>
      <p className="text-[12px] text-muted mb-3">Completed issues per cycle</p>

      {/* Vertical bars — heights proportional to the busiest cycle's count. */}
      <div className="flex items-end gap-2 h-28">
        {bars.map((b) => (
          <div key={b.number} className="flex flex-1 flex-col items-center gap-1">
            {/* Value on top */}
            <div className="text-[11px] tabular-nums text-faint">{b.count}</div>
            {/* The bar itself; grows from the baseline. */}
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-accent"
                style={{ height: `${Math.max((b.count / max) * 100, 3)}%` }}
                title={`Cycle ${b.number} — ${b.count} completed${
                  b.points > 0 ? `, ${b.points} pts` : ''
                }`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* X-axis: cycle numbers under each bar. */}
      <div className="mt-1.5 flex gap-2">
        {bars.map((b) => (
          <div
            key={b.number}
            className="flex-1 text-center text-[11px] tabular-nums text-faint"
          >
            {b.number}
          </div>
        ))}
      </div>
    </section>
  );
}
