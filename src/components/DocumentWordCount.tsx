// Word-count + reading-time meta line for a document.
export function DocumentWordCount({ content }: { content: string }) {
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  if (words === 0) return null;
  const minutes = Math.max(1, Math.round(words / 200));
  return (
    <div className="text-[12px] text-faint">
      {words.toLocaleString()} words · {minutes} min read
    </div>
  );
}
