import { ArrowRight } from 'lucide-react';
import { useStoreShallow } from '@/lib/store';
import { useToasts } from '@/lib/toast';

// End-of-cycle carry-over: move a cycle's unfinished issues to the next cycle.
export function CycleCarryOver({ cycleId }: { cycleId: string }) {
  const { issues, states, carryOverCycle } = useStoreShallow((s) => ({
    issues: s.issues,
    states: s.states,
    carryOverCycle: s.carryOverCycle,
  }));
  const addToast = useToasts((s) => s.add);

  // unfinished = in this cycle, not archived, state not completed/canceled
  const unfinished = issues.filter((i) => {
    if (i.cycleId !== cycleId || i.archivedAt) return false;
    const st = states.find((s) => s.id === i.stateId);
    return st ? st.type !== 'completed' && st.type !== 'canceled' : true;
  });
  if (unfinished.length === 0) return null;

  return (
    <button
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
      onClick={() => {
        const moved = carryOverCycle(cycleId);
        addToast({ message: `Moved ${moved} issue${moved === 1 ? '' : 's'} to the next cycle` });
      }}
    >
      Move {unfinished.length} unfinished
      <ArrowRight size={12} />
    </button>
  );
}
