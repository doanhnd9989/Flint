// Auto-generated outline from markdown ATX headings (Linear's doc outline).
type Heading = { level: number; text: string };

export function DescriptionTableOfContents({ source }: { source: string }) {
  const headings: Heading[] = [];
  for (const line of source.split('\n')) {
    const m = /^(#{1,3})\s+(.+)$/.exec(line);
    if (m) headings.push({ level: m[1].length, text: m[2].trim() });
  }

  // A TOC is pointless for 0-1 headings.
  if (headings.length < 2) return null;

  return (
    <nav>
      <div className="text-[11px] font-medium uppercase text-faint mb-1.5">On this page</div>
      {headings.map((h, i) => (
        <div
          key={i}
          className="text-[12px] text-muted hover:text-fg cursor-default truncate"
          style={{ paddingLeft: (h.level - 1) * 12 + 'px' }}
        >
          {h.text}
        </div>
      ))}
    </nav>
  );
}
