import { useRef, useState, type KeyboardEvent } from 'react'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Code2,
  TextQuote,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { Avatar } from './Avatar'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  minHeight?: number
  /** Forwarded keydown (e.g. ⌘↵ submit). Skipped while a menu is open. */
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  onBlur?: () => void
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

/**
 * A slash command — typed `/` at the start of a line opens this menu (just like
 * Linear's editor). Each command rewrites the current line into the markdown our
 * renderer understands. `insert` returns [text-to-insert, caret-offset-within-it].
 */
interface SlashCommand {
  id: string
  label: string
  hint: string
  keywords: string
  icon: typeof Heading1
  insert: () => [string, number]
}

const SLASH_GROUPS: SlashCommand[][] = [
  [
    { id: 'h1', label: 'Heading 1', hint: '⌘ ⌥ 1', keywords: 'heading title big', icon: Heading1, insert: () => ['# ', 2] },
    { id: 'h2', label: 'Heading 2', hint: '⌘ ⌥ 2', keywords: 'heading subtitle', icon: Heading2, insert: () => ['## ', 3] },
    { id: 'h3', label: 'Heading 3', hint: '⌘ ⌥ 3', keywords: 'heading small', icon: Heading3, insert: () => ['### ', 4] },
  ],
  [
    { id: 'bullet', label: 'Bulleted list', hint: '⌘ ⇧ 8', keywords: 'bullet unordered list dash', icon: List, insert: () => ['- ', 2] },
    { id: 'numbered', label: 'Numbered list', hint: '⌘ ⇧ 9', keywords: 'numbered ordered list', icon: ListOrdered, insert: () => ['1. ', 3] },
    { id: 'checklist', label: 'Checklist', hint: '⌘ ⇧ 7', keywords: 'todo task checkbox checklist', icon: ListChecks, insert: () => ['- [ ] ', 6] },
  ],
  [
    { id: 'code', label: 'Code block', hint: '⌘ ⇧ \\', keywords: 'code snippet fenced pre', icon: Code2, insert: () => ['```\n\n```', 4] },
    { id: 'quote', label: 'Blockquote', hint: '⌥ ⇧ .', keywords: 'quote blockquote citation', icon: TextQuote, insert: () => ['> ', 2] },
  ],
]

const ALL_SLASH = SLASH_GROUPS.flat()

/**
 * ASCII emoticon → emoji map (a clean canonical subset of Linear's), applied as
 * you type once an emoticon is completed by a space or end-of-input. Longer keys
 * are matched first so `:-)` wins over a hypothetical `:-`.
 */
const EMOTICONS: Record<string, string> = {
  ':)': '🙂',
  ':-)': '🙂',
  ':(': '🙁',
  ':-(': '🙁',
  ':D': '😄',
  ':-D': '😄',
  ';)': '😉',
  ';-)': '😉',
  ':P': '😛',
  ':-P': '😛',
  ":'(": '😢',
  '<3': '❤️',
  ':o': '😮',
  ':O': '😮',
  ':|': '😐',
  ':/': '😕',
  '>:(': '😠',
  ':*)': '😘',
}
const EMOTICON_KEYS = Object.keys(EMOTICONS).sort((a, b) => b.length - a.length)

/** Matches a single bare URL (http/https) — used for paste-to-autolink. */
const URL_RE = /^(https?:\/\/[^\s]+)$/i

/** A pending upload — the placeholder text we inserted and its data/object URL. */
let uploadSeq = 0

/** Textarea with inline @-mention and /-command autocompletes, like Linear. */
export function MentionInput({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  minHeight = 64,
  onKeyDown,
  onBlur,
  textareaRef,
}: Props) {
  const users = useStore((s) => s.users)
  // Preferences → "Enable spell check" toggles native spellcheck in editors.
  const spellCheck = useStore((s) => s.preferences.spellCheck !== false)
  // Preferences → "Convert text emoticons into emojis" (on by default).
  const convertEmoticons = useStore((s) => s.preferences.convertEmoticons !== false)
  const localRef = useRef<HTMLTextAreaElement>(null)
  const ref = textareaRef ?? localRef

  // @-mention state
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [anchor, setAnchor] = useState(0) // index of the '@'

  // /-command state
  const [slashQuery, setSlashQuery] = useState<string | null>(null)
  const [slashActive, setSlashActive] = useState(0)
  const [slashAnchor, setSlashAnchor] = useState(0) // index of the '/'
  const dismissedAt = useRef(-1) // anchor index dismissed via Escape

  // Selection-formatting toolbar — appears while text is selected (Linear's
  // floating format bar). We track only whether a non-empty selection exists.
  const [hasSelection, setHasSelection] = useState(false)
  function syncSelection() {
    const el = ref.current
    setHasSelection(!!el && (el.selectionEnd ?? 0) > (el.selectionStart ?? 0))
  }

  const matches =
    query === null
      ? []
      : users
          .filter((u) =>
            u.name.toLowerCase().includes(query.toLowerCase()) ||
            u.email.toLowerCase().startsWith(query.toLowerCase()),
          )
          .slice(0, 6)
  const mentionOpen = query !== null && matches.length > 0

  // Grouped commands stay grouped while unfiltered; once you type a query they
  // collapse into a single ranked list (matching Linear).
  const slashGroups =
    slashQuery === null
      ? []
      : slashQuery === ''
        ? SLASH_GROUPS
        : [
            ALL_SLASH.filter(
              (c) =>
                c.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
                c.keywords.includes(slashQuery.toLowerCase()),
            ),
          ]
  const slashFlat = slashGroups.flat()
  const slashOpen = slashQuery !== null && slashFlat.length > 0

  function detect(text: string, caret: number) {
    const before = text.slice(0, caret)
    // @-mention: '@' preceded by start/whitespace
    const at = before.match(/(?:^|\s)@([^\s@]*)$/)
    if (at) {
      setQuery(at[1])
      setActive(0)
      setAnchor(caret - at[1].length - 1)
    } else {
      setQuery(null)
    }
    // /-command: '/' at the very start of the current line
    const slash = before.match(/(?:^|\n)\/([a-zA-Z ]*)$/)
    if (slash) {
      const a = caret - slash[1].length - 1
      if (a === dismissedAt.current) {
        setSlashQuery(null)
      } else {
        setSlashQuery(slash[1])
        setSlashActive(0)
        setSlashAnchor(a)
      }
    } else {
      setSlashQuery(null)
      dismissedAt.current = -1
    }
  }

  /**
   * Replace a just-completed ASCII emoticon with its emoji, like Linear. Fires
   * when the emoticon is terminated by a space the user just typed or it sits at
   * the very end of the input. Returns the rewritten value + caret, or null when
   * nothing matched. An emoticon must be preceded by start-of-input or whitespace
   * so we never mangle text like `http://` or `8:30`.
   */
  function convertEmoticon(text: string, caret: number): { next: string; caret: number } | null {
    // The boundary is either the space just typed, or end-of-input.
    const typedSpace = caret > 0 && /\s/.test(text[caret - 1])
    if (!typedSpace && caret !== text.length) return null // mid-text edits need a space
    const end = typedSpace ? caret - 1 : caret
    for (const key of EMOTICON_KEYS) {
      const start = end - key.length
      if (start < 0 || text.slice(start, end) !== key) continue
      const prev = start === 0 ? '' : text[start - 1]
      if (prev !== '' && !/\s/.test(prev)) continue
      const emoji = EMOTICONS[key]
      const next = text.slice(0, start) + emoji + text.slice(end)
      return { next, caret: start + emoji.length + (typedSpace ? 1 : 0) }
    }
    return null
  }

  function choose(userId: string, name: string) {
    const el = ref.current
    if (!el) return
    const caret = el.selectionStart ?? value.length
    const token = `@[${name}](${userId}) `
    const next = value.slice(0, anchor) + token + value.slice(caret)
    onChange(next)
    setQuery(null)
    requestAnimationFrame(() => {
      const pos = anchor + token.length
      el.selectionStart = el.selectionEnd = pos
      el.focus()
    })
  }

  function chooseSlash(cmd: SlashCommand) {
    const el = ref.current
    if (!el) return
    const caret = el.selectionStart ?? value.length
    const [text, offset] = cmd.insert()
    const next = value.slice(0, slashAnchor) + text + value.slice(caret)
    onChange(next)
    setSlashQuery(null)
    requestAnimationFrame(() => {
      const pos = slashAnchor + offset
      el.selectionStart = el.selectionEnd = pos
      el.focus()
    })
  }

  /**
   * Rewrite `value` and reposition the caret/selection in one shot, the way
   * Linear's editor does after a formatting shortcut. `selStart`/`selEnd` are
   * absolute offsets into the new string; pass them equal to collapse the caret.
   */
  function rewrite(next: string, selStart: number, selEnd = selStart) {
    onChange(next)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.selectionStart = selStart
      el.selectionEnd = selEnd
      el.focus()
    })
  }

  /**
   * Wrap the current selection in a pair of markers (e.g. `**` for bold). If
   * nothing is selected we drop the markers in and place the caret between them
   * so the user can type. If the selection is already wrapped we unwrap it, so
   * the shortcut toggles — exactly like Linear.
   */
  function wrapSelection(open: string, close: string) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? start
    const sel = value.slice(start, end)
    // Toggle off when the selection is already surrounded by the markers.
    const outerStart = start - open.length
    const outerEnd = end + close.length
    if (
      outerStart >= 0 &&
      outerEnd <= value.length &&
      value.slice(outerStart, start) === open &&
      value.slice(end, outerEnd) === close
    ) {
      const next = value.slice(0, outerStart) + sel + value.slice(outerEnd)
      rewrite(next, outerStart, outerStart + sel.length)
      return
    }
    const next = value.slice(0, start) + open + sel + close + value.slice(end)
    if (sel) {
      rewrite(next, start + open.length, start + open.length + sel.length)
    } else {
      const caret = start + open.length
      rewrite(next, caret)
    }
  }

  /** ⌘K — wrap the selection as a markdown link, caret landing in the URL. */
  function wrapLink() {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? start
    const sel = value.slice(start, end)
    const inserted = `[${sel}](https://)`
    const next = value.slice(0, start) + inserted + value.slice(end)
    // Place the caret just inside the empty url, after `https://`.
    const urlCaret = start + sel.length + 3 + 'https://'.length // [ ] ( = 3 chars before url
    rewrite(next, urlCaret)
  }

  /**
   * ⌘⌥1/2/3 — set the heading level of the current line, replacing any existing
   * leading `#`s. Toggling the same level back off clears the heading.
   */
  function setHeading(level: number) {
    const el = ref.current
    if (!el) return
    const caret = el.selectionStart ?? value.length
    const lineStart = value.lastIndexOf('\n', caret - 1) + 1
    let lineEnd = value.indexOf('\n', caret)
    if (lineEnd === -1) lineEnd = value.length
    const line = value.slice(lineStart, lineEnd)
    const existing = line.match(/^(#{1,6})\s+/)
    const body = existing ? line.slice(existing[0].length) : line
    const prefix = '#'.repeat(level) + ' '
    // Toggle off if the line is already at this exact level.
    const nextLine = existing && existing[1].length === level ? body : prefix + body
    const next = value.slice(0, lineStart) + nextLine + value.slice(lineEnd)
    const delta = nextLine.length - line.length
    rewrite(next, Math.max(lineStart, caret + delta))
  }

  /** Insert markdown at the caret, replacing any current selection. */
  function insertAt(text: string, selStart: number, selEnd: number, caretInText: number) {
    const next = value.slice(0, selStart) + text + value.slice(selEnd)
    rewrite(next, selStart + caretInText)
  }

  /** Read a pasted/dropped file and resolve its placeholder to a data URL. */
  function uploadFile(file: File, selStart: number, selEnd: number) {
    const id = ++uploadSeq
    const placeholder = `![Uploading ${file.name}…]()`
    insertAt(placeholder, selStart, selEnd, placeholder.length)
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      // Resolve the placeholder in place — find it in the latest value via the
      // textarea (value prop may be stale inside this async callback).
      const el = ref.current
      const current = el?.value ?? value
      const idx = current.indexOf(placeholder)
      const resolved = `![${file.name}](${url})`
      if (idx === -1) return // placeholder was edited away; drop silently
      const next = current.slice(0, idx) + resolved + current.slice(idx + placeholder.length)
      const caret = idx + resolved.length
      // Only steal the caret if our placeholder is still the last thing we touched.
      if (id === uploadSeq) rewrite(next, caret)
      else onChange(next)
    }
    reader.readAsDataURL(file)
  }

  /** Paste — image files become uploads; a URL onto a selection auto-links. */
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (mentionOpen || slashOpen) return
    const el = e.currentTarget
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? start
    // 1) Image/file paste → placeholder upload.
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'))
    if (file) {
      e.preventDefault()
      uploadFile(file, start, end)
      return
    }
    // 2) URL paste onto a selection → wrap as a markdown link.
    const text = e.clipboardData.getData('text/plain').trim()
    if (URL_RE.test(text)) {
      e.preventDefault()
      const sel = value.slice(start, end)
      if (sel) {
        const inserted = `[${sel}](${text})`
        insertAt(inserted, start, end, inserted.length)
      } else {
        insertAt(text, start, end, text.length)
      }
    }
  }

  /** Drop — image files dropped onto the editor become placeholder uploads. */
  function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (!file) return
    e.preventDefault()
    const el = e.currentTarget
    const caret = el.selectionStart ?? value.length
    uploadFile(file, caret, caret)
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, matches.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const u = matches[active]
        if (u) choose(u.id, u.name)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setQuery(null)
        return
      }
    }
    if (slashOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashActive((a) => Math.min(a + 1, slashFlat.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashActive((a) => Math.max(a - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const cmd = slashFlat[slashActive]
        if (cmd) chooseSlash(cmd)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        dismissedAt.current = slashAnchor
        setSlashQuery(null)
        return
      }
    }
    // Markdown formatting shortcuts — only when no autocomplete is open, so they
    // never clash with menu navigation. Mirrors Linear's editor bindings.
    const mod = e.metaKey || e.ctrlKey
    if (mod) {
      // ⌘⌥1/2/3 — heading levels (⌥ distinguishes from list shortcuts).
      if (e.altKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault()
        setHeading(Number(e.key))
        return
      }
      if (!e.altKey) {
        if (e.key.toLowerCase() === 'b' && !e.shiftKey) {
          e.preventDefault()
          wrapSelection('**', '**')
          return
        }
        if (e.key.toLowerCase() === 'i' && !e.shiftKey) {
          e.preventDefault()
          wrapSelection('_', '_')
          return
        }
        if (e.key.toLowerCase() === 'e' && !e.shiftKey) {
          e.preventDefault()
          wrapSelection('`', '`')
          return
        }
        if (e.key.toLowerCase() === 'x' && e.shiftKey) {
          e.preventDefault()
          wrapSelection('~~', '~~')
          return
        }
        if (e.key.toLowerCase() === 'k' && !e.shiftKey) {
          e.preventDefault()
          wrapLink()
          return
        }
      }
    }
    onKeyDown?.(e)
  }

  let flatIndex = -1

  return (
    <div className="relative">
      <textarea
        ref={ref}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const el = e.target
          let next = el.value
          let caret = el.selectionStart ?? next.length
          // Emoticon → emoji as you type (preference-gated). Rewrite before we
          // run mention/command detection so it sees the post-conversion text.
          if (convertEmoticons) {
            const converted = convertEmoticon(next, caret)
            if (converted) {
              next = converted.next
              caret = converted.caret
              requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = caret
              })
            }
          }
          onChange(next)
          detect(next, caret)
        }}
        onKeyUp={(e) => {
          const el = e.currentTarget
          detect(el.value, el.selectionStart ?? el.value.length)
        }}
        onClick={(e) => {
          const el = e.currentTarget
          detect(el.value, el.selectionStart ?? el.value.length)
        }}
        onSelect={syncSelection}
        onKeyDown={handleKey}
        onPaste={handlePaste}
        onDrop={handleDrop}
        spellCheck={spellCheck}
        onBlur={() => {
          // let a click on a menu item land first
          setTimeout(() => {
            setQuery(null)
            setSlashQuery(null)
            setHasSelection(false)
          }, 120)
          onBlur?.()
        }}
        className={className}
        style={{ minHeight }}
      />
      {hasSelection && (
        <div
          data-overlay
          className="absolute right-2 top-2 z-30 flex items-center gap-0.5 rounded-lg border border-border bg-bg-elevated px-1 py-0.5 shadow-lg animate-pop"
        >
          {(
            [
              { icon: Bold, title: 'Bold ⌘B', run: () => wrapSelection('**', '**') },
              { icon: Italic, title: 'Italic ⌘I', run: () => wrapSelection('_', '_') },
              { icon: Strikethrough, title: 'Strikethrough ⌘⇧X', run: () => wrapSelection('~~', '~~') },
              { icon: Code, title: 'Code ⌘E', run: () => wrapSelection('`', '`') },
              { icon: LinkIcon, title: 'Link ⌘K', run: () => wrapLink() },
            ] as const
          ).map(({ icon: Icon, title, run }) => (
            <button
              key={title}
              type="button"
              title={title}
              onMouseDown={(e) => {
                // Keep the textarea's selection; apply the wrap in place.
                e.preventDefault()
                run()
                requestAnimationFrame(syncSelection)
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-bg-hover hover:text-fg"
            >
              <Icon size={13} />
            </button>
          ))}
          <span className="mx-0.5 h-4 w-px bg-border" />
          {([1, 2, 3] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              title={`Heading ${lvl} ⌘⌥${lvl}`}
              onMouseDown={(e) => {
                e.preventDefault()
                setHeading(lvl)
                requestAnimationFrame(syncSelection)
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold text-muted hover:bg-bg-hover hover:text-fg"
            >
              H{lvl}
            </button>
          ))}
        </div>
      )}
      {mentionOpen && (
        <div
          data-overlay
          className="absolute left-2 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-bg-elevated py-1 shadow-lg animate-pop"
        >
          {matches.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                choose(u.id, u.name)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-fg',
                i === active && 'bg-bg-hover',
              )}
            >
              <Avatar user={u} size={18} />
              <span className="flex-1 truncate">{u.name}</span>
            </button>
          ))}
        </div>
      )}
      {slashOpen && (
        <div
          data-overlay
          className="absolute left-2 top-full z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-bg-elevated py-1 shadow-lg animate-pop"
        >
          {slashGroups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="my-1 border-t border-border" />}
              {group.map((cmd) => {
                flatIndex += 1
                const i = flatIndex
                const Icon = cmd.icon
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      chooseSlash(cmd)
                    }}
                    onMouseEnter={() => setSlashActive(i)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-[13px] text-fg',
                      i === slashActive && 'bg-bg-hover',
                    )}
                  >
                    <Icon size={16} className="shrink-0 text-muted" />
                    <span className="flex-1 truncate">{cmd.label}</span>
                    <span className="shrink-0 font-mono text-[11px] tracking-tight text-faint">
                      {cmd.hint}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
