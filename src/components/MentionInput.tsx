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
          onChange(e.target.value)
          detect(e.target.value, e.target.selectionStart ?? e.target.value.length)
        }}
        onKeyUp={(e) => {
          const el = e.currentTarget
          detect(el.value, el.selectionStart ?? el.value.length)
        }}
        onClick={(e) => {
          const el = e.currentTarget
          detect(el.value, el.selectionStart ?? el.value.length)
        }}
        onKeyDown={handleKey}
        onBlur={() => {
          // let a click on a menu item land first
          setTimeout(() => {
            setQuery(null)
            setSlashQuery(null)
          }, 120)
          onBlur?.()
        }}
        className={className}
        style={{ minHeight }}
      />
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
