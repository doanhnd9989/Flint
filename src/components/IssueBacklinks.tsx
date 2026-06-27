import { Link } from 'react-router-dom';
import { useStoreShallow } from '@/lib/store';
import type { Issue } from '@/lib/types';

// "Referenced by" — issues whose description or comments mention this issue.
export function IssueBacklinks({ issueId }: { issueId: string }) {
  const { issues, comments } = useStoreShallow((s) => ({
    issues: s.issues,
    comments: s.comments,
  }));

  const issue = issues.find((i) => i.id === issueId);
  if (!issue) return null;
  const ident = issue.identifier;

  // De-duplicated set of referencing issues (never this issue itself).
  const refs = new Map<string, Issue>();

  for (const i of issues) {
    if (i.id === issueId || i.archivedAt) continue;
    if (i.description?.includes(ident)) refs.set(i.id, i);
  }
  for (const c of comments) {
    if (!c.body.includes(ident)) continue;
    const src = issues.find((i) => i.id === c.issueId);
    if (src && src.id !== issueId && !src.archivedAt) refs.set(src.id, src);
  }

  const list = [...refs.values()];
  if (list.length === 0) return null;

  return (
    <section>
      <div className="text-[11px] font-medium uppercase text-faint mb-2">
        Referenced by
      </div>
      <div className="space-y-px">
        {list.map((ref) => (
          <Link
            key={ref.id}
            to={`/issue/${ref.identifier}`}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px] hover:bg-bg-hover"
          >
            <span className="font-mono text-[11px] text-faint">{ref.identifier}</span>
            <span className="text-fg truncate">{ref.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
