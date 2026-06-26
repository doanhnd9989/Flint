import { useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { copyToClipboard } from '@/lib/toast'

/**
 * A small, dependency-free Markdown renderer that returns React nodes (no
 * dangerouslySetInnerHTML, so no XSS surface). Supports the subset Linear's
 * editor commonly produces: headings, bold/italic, inline + fenced code,
 * bullet / ordered / task lists, blockquotes, links, images, pipe tables
 * and horizontal rules.
 */

/** Friendly display names for fenced-code language hints. */
const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JavaScript',
  jsx: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  ruby: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  rust: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  kotlin: 'Kotlin',
  swift: 'Swift',
  c: 'C',
  cpp: 'C++',
  'c++': 'C++',
  cs: 'C#',
  csharp: 'C#',
  php: 'PHP',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Shell',
  shell: 'Shell',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
  graphql: 'GraphQL',
  md: 'Markdown',
  markdown: 'Markdown',
  diff: 'Diff',
  xml: 'XML',
  text: 'Plain Text',
  plaintext: 'Plain Text',
}

function languageLabel(lang: string): string {
  const key = lang.toLowerCase()
  return LANGUAGE_LABELS[key] ?? lang.charAt(0).toUpperCase() + lang.slice(1)
}

/** Reject `javascript:` / `data:` URLs so rendered links + images stay safe. */
function safeUrl(url: string): boolean {
  return !/^\s*(javascript|data|vbscript):/i.test(url)
}

/** Fenced code block with a language bar and a hover Copy button. */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = () => {
    copyToClipboard(code, 'Code copied to clipboard')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="group/code my-2 overflow-hidden rounded-md border border-border bg-bg-tertiary">
      <div className="flex items-center justify-between border-b border-border px-3 py-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
          {lang ? languageLabel(lang) : 'Code'}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCopy()
          }}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted opacity-0 transition hover:bg-hover hover:text-fg group-hover/code:opacity-100"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-fg">
        <code>{code}</code>
      </pre>
    </div>
  )
}

const INLINE_RE =
  /(@\[([^\]]+)\]\(([^)\s]+)\))|(!\[([^\]]*)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*]+)\*)|(_([^_]+)_)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))/g

function renderInline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1])
      nodes.push(
        <span
          key={`${key}-${i}`}
          className="rounded bg-accent-subtle px-1 font-medium text-accent"
        >
          @{m[2]}
        </span>,
      )
    else if (m[4]) {
      // ![alt](src) — image
      const src = m[6]
      if (safeUrl(src))
        nodes.push(
          <img
            key={`${key}-${i}`}
            src={src}
            alt={m[5]}
            loading="lazy"
            className="my-2 block max-w-full rounded-md border border-border"
            onClick={(e) => e.stopPropagation()}
          />,
        )
      else nodes.push(m[5] || src)
    } else if (m[7]) nodes.push(<strong key={`${key}-${i}`}>{m[8]}</strong>)
    else if (m[9]) nodes.push(<strong key={`${key}-${i}`}>{m[10]}</strong>)
    else if (m[11]) nodes.push(<em key={`${key}-${i}`}>{m[12]}</em>)
    else if (m[13]) nodes.push(<em key={`${key}-${i}`}>{m[14]}</em>)
    else if (m[15])
      nodes.push(
        <code key={`${key}-${i}`} className="rounded bg-bg-tertiary px-1 py-0.5 font-mono text-[12px]">
          {m[16]}
        </code>,
      )
    else if (m[17]) {
      const href = m[19]
      if (safeUrl(href))
        nodes.push(
          <a
            key={`${key}-${i}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
            onClick={(e) => e.stopPropagation()}
          >
            {m[18]}
          </a>,
        )
      else nodes.push(m[18])
    }
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
    const fence = line.match(/^```([\w+#-]*)\s*$/)
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
        <CodeBlock key={`b${blocks.length}`} code={code.join('\n')} lang={fence[1]} />,
      )
      continue
    }

    // GitHub pipe table: a header row + a `|---|:--:|` separator + body rows.
    const sep = lines[i + 1]
    if (
      line.includes('|') &&
      sep !== undefined &&
      /^\s*\|?(\s*:?-+:?\s*\|)+(\s*:?-+:?\s*)?\|?\s*$/.test(sep) &&
      sep.includes('-')
    ) {
      flushList()
      const splitRow = (row: string) =>
        row
          .replace(/^\s*\|/, '')
          .replace(/\|\s*$/, '')
          .split('|')
          .map((c) => c.trim())
      const headers = splitRow(line)
      const aligns = splitRow(sep).map((c): 'left' | 'center' | 'right' => {
        const l = c.startsWith(':')
        const r = c.endsWith(':')
        return l && r ? 'center' : r ? 'right' : 'left'
      })
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]))
        i++
      }
      const alignCls = (idx: number) =>
        aligns[idx] === 'center'
          ? 'text-center'
          : aligns[idx] === 'right'
            ? 'text-right'
            : 'text-left'
      blocks.push(
        <div key={`b${blocks.length}`} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {headers.map((cell, c) => (
                  <th
                    key={c}
                    className={`border border-border bg-bg-tertiary px-2 py-1 font-semibold text-fg ${alignCls(c)}`}
                  >
                    {renderInline(cell, `th${blocks.length}-${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {headers.map((_, c) => (
                    <td
                      key={c}
                      className={`border border-border px-2 py-1 text-muted ${alignCls(c)}`}
                    >
                      {renderInline(row[c] ?? '', `td${blocks.length}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
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
