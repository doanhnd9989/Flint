import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { placePanel } from '@/lib/anchor'
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
  /** Accessible name for the trigger — required when the trigger is icon-only. */
  label?: string
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
  label,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const reposition = useCallback(() => {
    if (menuRef.current && anchorRef.current)
      placePanel(anchorRef.current, menuRef.current, { align, width })
  }, [align, width])

  /** Ref callback: position the menu in the commit that mounts it. */
  const place = useCallback(
    (menu: HTMLDivElement | null) => {
      menuRef.current = menu
      if (menu) reposition()
    },
    [reposition],
  )

  const filtered = options.filter((o) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      o.label.toLowerCase().includes(q) ||
      (o.keywords ?? '').toLowerCase().includes(q)
    )
  })

  // Typing in the search box changes how many rows render, so the menu has to
  // be re-placed as it shrinks and grows — otherwise a menu that flipped above
  // its trigger stays anchored to the height it had when it opened.
  useLayoutEffect(() => {
    if (open) reposition()
  }, [open, filtered.length, reposition])

  // A fixed panel does not move with the page. Follow the trigger on scroll
  // (capture, so inner scroll containers count) and on resize.
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, reposition])

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
        aria-label={label}
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
        createPortal(
          <div
            ref={place}
            data-overlay="menu"
            className="fixed z-50 flex flex-col rounded-lg border border-border bg-bg-elevated shadow-lg animate-pop overflow-hidden"
            style={{ width }}
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
              className="w-full shrink-0 border-b border-border bg-transparent px-3 py-2 text-[13px] outline-none text-fg"
            />
            {header}
            {/* `min-h-0 flex-1` lets the list give way when placePanel caps the
                panel's height, so the rows scroll instead of being clipped. */}
            <div className="max-h-64 min-h-0 flex-1 overflow-y-auto py-1">
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
