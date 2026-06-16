import { useEffect, useRef, useState } from 'react'
import { Markdown } from '@/lib/markdown'

interface Props {
  value: string
  onChange: (next: string) => void
  placeholder?: string
}

/**
 * Click-to-edit Markdown field: renders formatted Markdown, switches to a raw
 * textarea on click, saves on blur. Task checkboxes toggle in place without
 * entering edit mode.
 */
export function MarkdownEditor({ value, onChange, placeholder = 'Add description…' }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (editing && ref.current) {
      const el = ref.current
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editing])

  const toggleTask = (lineIndex: number) => {
    const lines = value.replace(/\r\n/g, '\n').split('\n')
    const l = lines[lineIndex]
    if (!l) return
    lines[lineIndex] = /\[\s\]/.test(l)
      ? l.replace(/\[\s\]/, '[x]')
      : l.replace(/\[[xX]\]/, '[ ]')
    onChange(lines.join('\n'))
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = `${e.target.scrollHeight}px`
        }}
        onBlur={() => {
          onChange(draft)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        placeholder={placeholder}
        className="mt-3 w-full resize-none bg-transparent font-mono text-[13px] leading-relaxed text-fg outline-none"
        style={{ minHeight: 120 }}
      />
    )
  }

  if (!value.trim()) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="mt-3 cursor-text text-[14px] text-faint"
      >
        {placeholder}
      </div>
    )
  }

  return (
    <div onClick={() => setEditing(true)} className="mt-3 cursor-text">
      <Markdown source={value} onToggleTask={toggleTask} />
    </div>
  )
}
