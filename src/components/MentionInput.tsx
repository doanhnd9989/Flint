import { useRef, useState, type KeyboardEvent } from 'react'
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
  /** Forwarded keydown (e.g. ⌘↵ submit). Skipped while the @-menu is open. */
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  onBlur?: () => void
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

/** Textarea with an inline @-mention autocomplete over workspace users. */
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
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [anchor, setAnchor] = useState(0) // index of the '@'

  const matches =
    query === null
      ? []
      : users
          .filter((u) =>
            u.name.toLowerCase().includes(query.toLowerCase()) ||
            u.email.toLowerCase().startsWith(query.toLowerCase()),
          )
          .slice(0, 6)

  const open = query !== null && matches.length > 0

  function detect(text: string, caret: number) {
    const before = text.slice(0, caret)
    const m = before.match(/(?:^|\s)@([^\s@]*)$/)
    if (m) {
      setQuery(m[1])
      setActive(0)
      setAnchor(caret - m[1].length - 1)
    } else {
      setQuery(null)
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
    // restore caret after the inserted token on next tick
    requestAnimationFrame(() => {
      const pos = anchor + token.length
      el.selectionStart = el.selectionEnd = pos
      el.focus()
    })
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
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
    onKeyDown?.(e)
  }

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
          setTimeout(() => setQuery(null), 120)
          onBlur?.()
        }}
        className={className}
        style={{ minHeight }}
      />
      {open && (
        <div className="absolute left-2 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-bg-elevated py-1 shadow-lg animate-pop">
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
    </div>
  )
}
