import { CheckSquare } from 'lucide-react';
import { useStore } from '@/lib/store';

// Linear-style checklist progress chip: parses task-list items from an issue's
// markdown description and shows "done/total" with a thin progress bar.
export function IssueChecklistProgress({ issueId }: { issueId: string }) {
  const issue = useStore((s) => s.issues.find((i) => i.id === issueId));
  if (!issue) return null;

  let open = 0;
  let done = 0;
  for (const line of (issue.description ?? '').split('\n')) {
    if (/^\s*[-*]\s+\[ \]\s+/.test(line)) open++;
    else if (/^\s*[-*]\s+\[[xX]\]\s+/.test(line)) done++;
  }
  const total = open + done;
  if (total === 0) return null;

  const pct = (done / total) * 100;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-secondary px-2 py-0.5 text-[12px] text-muted"
      title={`Checklist: ${done} of ${total} complete`}
    >
      <CheckSquare size={13} />
      {done}/{total}
      <span className="h-1 w-16 rounded-full bg-bg-hover overflow-hidden">
        <span className="h-full bg-accent block" style={{ width: pct + '%' }} />
      </span>
    </span>
  );
}
