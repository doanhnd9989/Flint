import { useStoreShallow, useDisplayName } from '@/lib/store';
import { Avatar } from '@/components/Avatar';

// Per-assignee active issue load (top 8) for the members directory.
export function MemberWorkload() {
  const { issues, users, states } = useStoreShallow((s) => ({
    issues: s.issues,
    users: s.users,
    states: s.states,
  }));
  const fmt = useDisplayName();

  // State ids that count as "open" work.
  const activeStateIds = new Set(
    states
      .filter((x) => x.type === 'started' || x.type === 'unstarted' || x.type === 'backlog')
      .map((x) => x.id),
  );

  // Count open issues per assignee.
  const counts = new Map<string, number>();
  for (const i of issues) {
    if (i.archivedAt || i.triage || !i.assigneeId) continue;
    if (!activeStateIds.has(i.stateId)) continue;
    counts.set(i.assigneeId, (counts.get(i.assigneeId) ?? 0) + 1);
  }

  const rows = users
    .map((user) => ({ user, count: counts.get(user.id) ?? 0 }))
    .filter((r) => r.count >= 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <section>
      <h3 className="text-[11px] font-medium uppercase text-faint mb-2">Workload by assignee</h3>
      <div className="flex flex-col gap-1.5">
        {rows.map(({ user, count }) => (
          <div key={user.id} className="flex items-center gap-2.5">
            <Avatar user={user} size={18} />
            <div className="w-32 truncate text-[12px] text-fg">{fmt(user.name)}</div>
            <div className="flex-1 h-1.5 rounded-full bg-bg-hover overflow-hidden">
              <div className="h-full bg-accent" style={{ width: (count / max) * 100 + '%' }} />
            </div>
            <div className="w-8 text-right text-[11px] text-faint tabular-nums">{count}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
