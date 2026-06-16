import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface SelectOption {
  id: string
  label: string
  icon?: ReactNode
  hint?: string
  keywords?: string
  selected?: boolean
}

interface Props {
  options: SelectOption[]
  onSelect: (id: string) => void
  trigger: ReactNode
  /** Keep menu open after selecting (multi-select pickers). */
  keepOpen?: boolean
  placeholder?: string
  align?: 'start' | 'end'
  width?: number
  header?: ReactNode
  footer?: ReactNode
  disabled?: boolean
}

export function SelectMenu({
  options,
  onSelect,
  trigger,
  keepOpen = false,
  placeholder = 'Search…',
  align = 'start',
  width = 240,
  header,
  footer,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const filtered = options.filter((o) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      o.label.toLowerCase().includes(q) ||
      (o.keywords ?? '').toLowerCase().includes(q)
    )
  })

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const left = align === 'end' ? r.right - width : r.left
    const maxLeft = window.innerWidth - width - 8
    setPos({
      top: Math.min(r.bottom + 4, window.innerHeight - 320),
      left: Math.max(8, Math.min(left, maxLeft)),
    })
  }, [open, align, width])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  function choose(id: string) {
    onSelect(id)
    if (!keepOpen) setOpen(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) choose(filtered[active].id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) setOpen((o) => !o)
        }}
        className="inline-flex items-center text-left disabled:opacity-50"
      >
        {trigger}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 rounded-lg border border-border bg-bg-elevated shadow-lg animate-pop overflow-hidden"
            style={{ top: pos.top, left: pos.left, width }}
            onKeyDown={onKey}
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              placeholder={placeholder}
              className="w-full border-b border-border bg-transparent px-3 py-2 text-[13px] outline-none text-fg"
            />
            {header}
            <div className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-[13px] text-faint">
                  No results
                </div>
              )}
              {filtered.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={(e) => {
                    e.stopPropagation()
                    choose(o.id)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-fg',
                    i === active && 'bg-bg-hover',
                  )}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {o.icon}
                  </span>
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && (
                    <span className="text-faint text-[11px]">{o.hint}</span>
                  )}
                  {o.selected && (
                    <svg width="14" height="14" viewBox="0 0 16 16" className="text-accent shrink-0">
                      <path
                        d="M3.5 8.5l3 3 6-6.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            {footer}
          </div>,
          document.body,
        )}
    </>
  )
}
