import type { ReactNode } from 'react'

/**
 * A small, dependency-free Markdown renderer that returns React nodes (no
 * dangerouslySetInnerHTML, so no XSS surface). Supports the subset Linear's
 * editor commonly produces: headings, bold/italic, inline + fenced code,
 * bullet / ordered / task lists, blockquotes, links and horizontal rules.
 */

const INLINE_RE =
  /(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*]+)\*)|(_([^_]+)_)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))/g

function renderInline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1]) nodes.push(<strong key={`${key}-${i}`}>{m[2]}</strong>)
    else if (m[3]) nodes.push(<strong key={`${key}-${i}`}>{m[4]}</strong>)
    else if (m[5]) nodes.push(<em key={`${key}-${i}`}>{m[6]}</em>)
    else if (m[7]) nodes.push(<em key={`${key}-${i}`}>{m[8]}</em>)
    else if (m[9])
      nodes.push(
        <code key={`${key}-${i}`} className="rounded bg-bg-tertiary px-1 py-0.5 font-mono text-[12px]">
          {m[10]}
        </code>,
      )
    else if (m[11])
      nodes.push(
        <a
          key={`${key}-${i}`}
          href={m[13]}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline"
          onClick={(e) => e.stopPropagation()}
        >
          {m[12]}
        </a>,
      )
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export interface MarkdownProps {
  source: string
  /** Toggle a `- [ ]` ↔ `- [x]` task on the given source line index. */
  onToggleTask?: (lineIndex: number) => void
}

export function Markdown({ source, onToggleTask }: MarkdownProps) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []

  let i = 0
  let listBuffer: { node: ReactNode }[] = []
  let listType: 'ul' | 'ol' | 'task' | null = null

  const flushList = () => {
    if (!listType || listBuffer.length === 0) return
    const items = listBuffer.map((b, idx) => <li key={idx}>{b.node}</li>)
    if (listType === 'ol')
      blocks.push(
        <ol key={`b${blocks.length}`} className="my-2 ml-5 list-decimal space-y-1">
          {items}
        </ol>,
      )
    else if (listType === 'ul')
      blocks.push(
        <ul key={`b${blocks.length}`} className="my-2 ml-5 list-disc space-y-1">
          {items}
        </ul>,
      )
    else
      blocks.push(
        <ul key={`b${blocks.length}`} className="my-2 space-y-1">
          {items}
        </ul>,
      )
    listBuffer = []
    listType = null
  }

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      flushList()
      const code: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i])
        i++
      }
      i++ // skip closing fence
      blocks.push(
        <pre
          key={`b${blocks.length}`}
          className="my-2 overflow-x-auto rounded-md border border-border bg-bg-tertiary p-3 font-mono text-[12px] leading-relaxed text-fg"
        >
          <code>{code.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // Task list item
    const task = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/)
    if (task) {
      if (listType && listType !== 'task') flushList()
      listType = 'task'
      const checked = task[1].toLowerCase() === 'x'
      const lineIndex = i
      listBuffer.push({
        node: (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                e.stopPropagation()
                onToggleTask?.(lineIndex)
              }}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span className={checked ? 'text-faint line-through' : ''}>
              {renderInline(task[2], `t${lineIndex}`)}
            </span>
          </label>
        ),
      })
      i++
      continue
    }

    // Ordered list
    const ol = line.match(/^\d+\.\s+(.*)$/)
    if (ol) {
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listBuffer.push({ node: <>{renderInline(ol[1], `o${i}`)}</> })
      i++
      continue
    }

    // Unordered list
    const ul = line.match(/^[-*]\s+(.*)$/)
    if (ul) {
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listBuffer.push({ node: <>{renderInline(ul[1], `u${i}`)}</> })
      i++
      continue
    }

    flushList()

    // Headings
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const cls =
        level === 1
          ? 'mt-4 mb-1 text-[18px] font-semibold text-fg'
          : level === 2
            ? 'mt-3 mb-1 text-[15px] font-semibold text-fg'
            : 'mt-3 mb-1 text-[13px] font-semibold text-fg'
      const content = renderInline(h[2], `h${i}`)
      blocks.push(
        level === 1 ? (
          <h1 key={`b${blocks.length}`} className={cls}>{content}</h1>
        ) : level === 2 ? (
          <h2 key={`b${blocks.length}`} className={cls}>{content}</h2>
        ) : (
          <h3 key={`b${blocks.length}`} className={cls}>{content}</h3>
        ),
      )
      i++
      continue
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push(<hr key={`b${blocks.length}`} className="my-3 border-border" />)
      i++
      continue
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      blocks.push(
        <blockquote
          key={`b${blocks.length}`}
          className="my-2 border-l-2 border-border-strong pl-3 text-muted"
        >
          {renderInline(line.replace(/^>\s?/, ''), `q${i}`)}
        </blockquote>,
      )
      i++
      continue
    }

    // Blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph (merge consecutive non-blank, non-special lines)
    const para: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3}\s|[-*]\s|\d+\.\s|>\s?|```|(---|\*\*\*|___)\s*$)/.test(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push(
      <p key={`b${blocks.length}`} className="my-1.5 leading-relaxed">
        {renderInline(para.join(' '), `p${blocks.length}`)}
      </p>,
    )
  }

  flushList()
  return <div className="text-[14px] text-muted">{blocks}</div>
}
