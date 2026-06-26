import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, FolderKanban, Trash2 } from 'lucide-react'
import { useStore, useStoreShallow, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { ProjectPicker } from '@/components/pickers'
import { Popover } from '@/components/ui/Popover'
import { timeAgo } from '@/lib/utils'

// A small set of emoji to pick a document icon from (Linear opens a full emoji
// picker; we ship a representative grid).
const DOC_EMOJI = ['📄', '📝', '📋', '📐', '🎨', '🚀', '🧭', '💡', '📊', '🔖', '🗂️', '⚙️']

/** A single entry in the document outline (Linear's table-of-contents rail). */
interface Heading {
  level: 1 | 2 | 3
  text: string
}

/** Outline depth filter — how deep the table of contents shows headings. */
const OUTLINE_DEPTHS = [
  { key: 'all', label: 'All', max: 3 },
  { key: 'h1', label: 'H1', max: 1 },
  { key: 'h12', label: 'H1+H2', max: 2 },
] as const
type OutlineDepth = (typeof OUTLINE_DEPTHS)[number]['key']

/**
 * Parse `# / ## / ###` Markdown headings out of the document body, skipping any
 * inside fenced code blocks (which the renderer leaves verbatim). The order here
 * matches the DOM order of the rendered <h1>/<h2>/<h3> nodes, so the outline can
 * scroll to the Nth heading element by index.
 */
function extractHeadings(content: string): Heading[] {
  const out: Heading[] = []
  let inFence = false
  for (const raw of content.replace(/\r\n/g, '\n').split('\n')) {
    // Mirror the renderer's fence rules EXACTLY (markdown.tsx open
    // /^```(\w*)\s*$/, close /^```\s*$/) so the outline's heading set stays
    // index-aligned with the rendered <h1>/<h2>/<h3> nodes — a looser /^\s*```/
    // here would diverge on indented or trailing-text fences.
    if (!inFence && /^```(\w*)\s*$/.test(raw)) {
      inFence = true
      continue
    }
    if (inFence) {
      if (/^```\s*$/.test(raw)) inFence = false
      continue
    }
    const m = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(raw)
    if (m) {
      out.push({
        level: m[1].length as 1 | 2 | 3,
        // Strip inline Markdown emphasis so the outline reads as plain text.
        text: m[2].replace(/[*_`]/g, '').trim(),
      })
    }
  }
  return out
}

export function DocumentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fmt = useDisplayName()
  const doc = useStore((s) => s.documents.find((d) => d.id === id))
  const { users, projects, updateDocument, deleteDocument } = useStoreShallow((s) => ({
    users: s.users,
    projects: s.projects,
    updateDocument: s.updateDocument,
    deleteDocument: s.deleteDocument,
  }))

  // The scrollable body, so the outline can scroll a heading into view.
  const scrollRef = useRef<HTMLDivElement>(null)
  // Document outline (Linear's table-of-contents rail), derived from the body.
  const headings = useMemo(() => extractHeadings(doc?.content ?? ''), [doc?.content])
  // Outline depth filter — how deep the rail renders headings (default: all).
  const [depth, setDepth] = useState<OutlineDepth>('all')
  // Filter by depth, keeping each heading's original index so scrollToHeading
  // still maps onto the Nth rendered <h1>/<h2>/<h3> node in DOM order.
  const maxLevel = OUTLINE_DEPTHS.find((d) => d.key === depth)?.max ?? 3
  const visibleHeadings = useMemo(
    () => headings.map((h, i) => ({ h, i })).filter(({ h }) => h.level <= maxLevel),
    [headings, maxLevel],
  )

  // Word count + reading time (Linear shows these in the document header). Strip
  // the common Markdown syntax so fences, links and emphasis don't inflate the
  // count, then split on whitespace. Reading time uses ~200 wpm, rounded up so a
  // non-empty doc always reads as at least "1 min".
  const stats = useMemo(() => {
    const plain = (doc?.content ?? '')
      .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
      .replace(/`[^`]*`/g, ' ') // inline code
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links / images → label
      .replace(/[#>*_~`-]/g, ' ') // residual markdown punctuation
    const words = plain.split(/\s+/).filter(Boolean).length
    return { words, minutes: Math.max(1, Math.ceil(words / 200)) }
  }, [doc?.content])

  // Scroll to the Nth rendered heading element by DOM order — keeps us decoupled
  // from the Markdown renderer (no slug/anchor coupling needed).
  const scrollToHeading = (index: number) => {
    const root = scrollRef.current
    if (!root) return
    const nodes = root.querySelectorAll('h1, h2, h3')
    const el = nodes[index] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!doc) {
    return (
      <div className="flex h-full flex-col">
        <ViewHeader title="Document" />
        <div className="flex flex-1 items-center justify-center text-[13px] text-faint">
          This document no longer exists.
        </div>
      </div>
    )
  }

  const author = users.find((u) => u.id === doc.creatorId)
  const project = projects.find((p) => p.id === doc.projectId)

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={doc.title || 'Untitled'}
        right={
          <button
            type="button"
            title="Delete document"
            onClick={() => {
              if (confirm('Delete this document? You cannot undo this action.')) {
                deleteDocument(doc.id)
                navigate('/documents')
              }
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
          >
            <Trash2 size={15} />
          </button>
        }
      >
        <button
          type="button"
          onClick={() => navigate('/documents')}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg"
        >
          <ChevronLeft size={15} /> Documents
        </button>
      </ViewHeader>

      <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
        {/* Outline rail — Linear's document table of contents. Sits in the right
            margin and scrolls a heading into view when clicked. */}
        {headings.length > 1 && (
          <aside className="pointer-events-none absolute right-6 top-10 hidden w-52 xl:block">
            <div className="pointer-events-auto sticky top-0">
              <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                On this page
              </div>
              {/* Depth filter — Linear lets you collapse the outline to top-level
                  headings. Segmented control; purely local, derives the list. */}
              <div className="mb-2 flex items-center gap-0.5 rounded-md bg-secondary p-0.5">
                {OUTLINE_DEPTHS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDepth(d.key)}
                    className={`flex-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      depth === d.key
                        ? 'bg-bg text-fg shadow-sm'
                        : 'text-muted hover:text-fg'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <nav className="flex flex-col">
                {visibleHeadings.map(({ h, i }) => (
                  <button
                    key={`${i}-${h.text}`}
                    type="button"
                    onClick={() => scrollToHeading(i)}
                    title={h.text}
                    style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
                    className="truncate rounded-md py-1 pr-2 text-left text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
                  >
                    {h.text}
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        )}

        <div className="mx-auto max-w-3xl px-10 py-10">
          {/* Icon + title */}
          <div className="flex items-start gap-3">
            <Popover
              align="start"
              width={220}
              trigger={
                <span className="cursor-pointer rounded-md px-1 text-[40px] leading-none hover:bg-bg-hover">
                  {doc.icon}
                </span>
              }
            >
              {(close) => (
                <div className="grid grid-cols-6 gap-1 p-1">
                  {DOC_EMOJI.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        updateDocument(doc.id, { icon: e })
                        close()
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[20px] hover:bg-bg-hover"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </Popover>
            <div className="min-w-0 flex-1">
              <input
                value={doc.title}
                onChange={(e) => updateDocument(doc.id, { title: e.target.value })}
                placeholder="Untitled"
                className="w-full bg-transparent text-[28px] font-semibold tracking-tight text-fg outline-none placeholder:text-faint"
              />
              <div className="mt-1 flex items-center gap-3 text-[12px] text-faint">
                <span>
                  {author ? fmt(author.name) : 'Someone'} · updated {timeAgo(doc.updatedAt)}
                </span>
                <ProjectPicker
                  projectId={doc.projectId}
                  onChange={(pid) => updateDocument(doc.id, { projectId: pid })}
                  trigger={
                    <span className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-muted hover:bg-bg-hover">
                      <FolderKanban size={13} className="text-faint" />
                      {project ? project.name : 'No project'}
                    </span>
                  }
                />
                {/* Word count + reading time — Linear surfaces these in the doc
                    header once there's any body text to measure. */}
                {stats.words > 0 && (
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    {stats.words.toLocaleString()} {stats.words === 1 ? 'word' : 'words'}
                    <span className="text-faint">·</span>
                    {stats.minutes} min read
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="mt-6">
            <MarkdownEditor
              value={doc.content}
              onChange={(next) => updateDocument(doc.id, { content: next })}
              placeholder="Write something, or press / for commands…"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
