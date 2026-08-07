import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  BookText,
  CircleCheck,
  Keyboard,
  MessageSquare,
  Monitor,
  Search,
  Settings,
  MessagesSquare,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '@/lib/store'

interface HelpItem {
  icon: LucideIcon
  label: string
  /** Right-aligned shortcut hint, Linear's chord wording ("G then S"). */
  hint?: string
  run: () => void
}

/**
 * What Linear opens on `?` — the help centre, not the shortcuts sheet. Same
 * eight rows in the same order; only the brand name differs.
 */
export function HelpMenu() {
  const open = useStore((s) => s.helpMenuOpen)
  const setHelpMenuOpen = useStore((s) => s.setHelpMenuOpen)
  const setHelpOpen = useStore((s) => s.setHelpOpen)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const close = () => setHelpMenuOpen(false)

  const items: HelpItem[] = [
    { icon: Search, label: 'Search for help…', run: () => navigate('/search') },
    { icon: BookText, label: 'Docs', run: () => navigate('/api-docs') },
    { icon: MessageSquare, label: 'Contact us', run: () => navigate('/settings') },
    {
      icon: Keyboard,
      label: 'Keyboard shortcuts',
      hint: '⌘ /',
      run: () => setHelpOpen(true),
    },
    { icon: CircleCheck, label: 'Flint status', run: () => navigate('/changelog') },
    { icon: Monitor, label: 'Download apps', run: () => navigate('/changelog') },
    {
      icon: Settings,
      label: 'Settings',
      hint: 'G then S',
      run: () => navigate('/settings'),
    },
    {
      icon: MessagesSquare,
      label: 'Slack community',
      run: () => navigate('/changelog'),
    },
  ]

  const q = query.trim().toLowerCase()
  const shown = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items

  // Reset each time it opens, and keep the highlight inside the filtered list.
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, shown.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = shown[active]
        if (!item) return
        close()
        item.run()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-[12vh] animate-fade"
      data-overlay
      onMouseDown={close}
    >
      <div
        className="w-[500px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-3 pt-2.5">
          <span className="text-[11px] text-faint">Help</span>
        </div>
        <div className="border-b border-border px-3 pb-2 pt-1">
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder="Help with…"
            className="w-full bg-transparent text-[14px] text-fg placeholder:text-faint focus:outline-none"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-1.5">
          {shown.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-muted">
              No results
            </div>
          ) : (
            shown.map((item, i) => (
              <button
                key={item.label}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  close()
                  item.run()
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] ${
                  i === active ? 'bg-bg-hover text-fg' : 'text-muted'
                }`}
              >
                <item.icon size={14} className="shrink-0 text-faint" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && (
                  <span className="shrink-0 text-[12px] text-faint">{item.hint}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
