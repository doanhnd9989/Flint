import type { Issue } from '@/lib/types';

// Estimate distribution — Linear's cycle/insights estimate breakdown.
export function EstimateDistribution({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;

  // estimate-value → count; undefined estimates collect in the "No estimate" bucket.
  const counts = new Map<number, number>();
  let noEstimate = 0;
  for (const i of issues) {
    if (i.estimate === undefined) noEstimate++;
    else counts.set(i.estimate, (counts.get(i.estimate) ?? 0) + 1);
  }

  // Ascending by points; "No estimate" always last.
  const buckets: { label: string; count: number }[] = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pts, count]) => ({ label: `${pts} pts`, count }));
  if (noEstimate > 0) buckets.push({ label: 'No estimate', count: noEstimate });

  const max = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="mb-2 text-[11px] font-medium uppercase text-faint">Estimate distribution</div>
      <div className="flex flex-col gap-1.5">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <div className="w-20 shrink-0 text-[12px] text-muted">{b.label}</div>
            <div className="h-1.5 flex-1 rounded-full bg-bg-hover">
              <div
                className="h-1.5 rounded-full bg-accent"
                style={{ width: `${(b.count / max) * 100}%` }}
              />
            </div>
            <div className="w-6 shrink-0 text-right text-[12px] tabular-nums text-muted">{b.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
