import { useState } from 'react';
import { ArrowRight, History } from 'lucide-react';
import type { Cycle } from '@/lib/types';
import { useStoreShallow } from '@/lib/store';
import { useToasts } from '@/lib/toast';

// Human-readable label for a cycle ("Cycle 4" / its custom name).
function cycleLabel(c: Cycle | undefined): string {
  if (!c) return 'a previous cycle';
  return c.name?.trim() ? c.name : `Cycle ${c.number}`;
}

// End-of-cycle carry-over: move a cycle's unfinished issues to the next cycle,
// and show which issues in THIS cycle were carried over from an earlier one.
export function CycleCarryOver({ cycleId }: { cycleId: string }) {
  const { issues, states, cycles, carryOverCycle } = useStoreShallow((s) => ({
    issues: s.issues,
    states: s.states,
    cycles: s.cycles,
    carryOverCycle: s.carryOverCycle,
  }));
  const addToast = useToasts((s) => s.add);
  const [showCarried, setShowCarried] = useState(false);

  // unfinished = in this cycle, not archived, state not completed/canceled
  const unfinished = issues.filter((i) => {
    if (i.cycleId !== cycleId || i.archivedAt) return false;
    const st = states.find((s) => s.id === i.stateId);
    return st ? st.type !== 'completed' && st.type !== 'canceled' : true;
  });

  // carried = issues now in this cycle that were carried over from an earlier one.
  const carried = issues.filter(
    (i) => i.cycleId === cycleId && !i.archivedAt && i.carriedFromCycleId,
  );

  // Group carried issues by their source cycle for the "N from Cycle X" summary.
  const bySource = new Map<string, number>();
  for (const i of carried) {
    const key = i.carriedFromCycleId!;
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }

  if (unfinished.length === 0 && carried.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {unfinished.length > 0 && (
          <button
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
            onClick={() => {
              const moved = carryOverCycle(cycleId);
              addToast({
                message: `Moved ${moved} issue${moved === 1 ? '' : 's'} to the next cycle`,
              });
            }}
          >
            Move {unfinished.length} unfinished
            <ArrowRight size={12} />
          </button>
        )}

        {carried.length > 0 && (
          <button
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
            onClick={() => setShowCarried((v) => !v)}
            title="Issues carried over into this cycle from a previous one"
          >
            <History size={12} />
            {carried.length} carried over
          </button>
        )}
      </div>

      {/* Per-source summary: "N carried over from Cycle X" */}
      {carried.length > 0 && (
        <div className="flex flex-col gap-0.5 text-[12px] text-faint">
          {[...bySource.entries()].map(([fromId, count]) => {
            const from = cycles.find((c) => c.id === fromId);
            return (
              <div key={fromId}>
                {count} carried over from {cycleLabel(from)}
              </div>
            );
          })}
        </div>
      )}

      {/* Expandable list of the individual carried-over issues. */}
      {showCarried && carried.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-border bg-bg-secondary p-2">
          {carried.map((i) => {
            const from = cycles.find((c) => c.id === i.carriedFromCycleId);
            return (
              <li
                key={i.id}
                className="flex items-center gap-2 text-[12px] text-muted"
              >
                <span className="font-mono text-faint">{i.identifier}</span>
                <span className="truncate text-fg">{i.title}</span>
                <span className="ml-auto shrink-0 rounded border border-border px-1 py-px text-[10px] text-faint">
                  from {cycleLabel(from)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
