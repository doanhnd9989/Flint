import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { placePanel } from '@/lib/anchor'

interface Props {
  trigger: ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  width?: number
  /**
   * Accessible name for the trigger. Icon-only triggers render no text, so
   * without this the button reaches assistive tech — and our control crawl —
   * unnamed. Linear labels every one of them ("Add filter", "Display options").
   */
  label?: string
  /**
   * Exposes the trigger button so a keyboard shortcut can open this popover the
   * same way a click does — Linear's `F` opens the filter menu without the
   * caller having to mirror the open state.
   */
  triggerRef?: RefObject<HTMLButtonElement | null>
}

/** Generic click-anchored popover rendered in a portal. */
export function Popover({ trigger, children, align = 'start', width = 220, label, triggerRef }: Props) {
  const [open, setOpen] = useState(false)
  const ownRef = useRef<HTMLButtonElement>(null)
  const anchorRef = triggerRef ?? ownRef
  const panelRef = useRef<HTMLDivElement>(null)

  /** Ref callback: position the panel in the commit that mounts it. */
  const place = useCallback(
    (panel: HTMLDivElement | null) => {
      panelRef.current = panel
      if (panel && anchorRef.current)
        placePanel(anchorRef.current, panel, { align, width })
    },
    [align, width],
  )

  // Scrolling moves the trigger but not a fixed panel, which would leave the
  // menu stranded mid-screen. Re-place on scroll (capture, so inner scroll
  // containers count) and on resize.
  useEffect(() => {
    if (!open) return
    const reposition = () => {
      if (panelRef.current && anchorRef.current)
        placePanel(anchorRef.current, panelRef.current, { align, width })
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, align, width])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      )
        setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center"
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={place}
            data-overlay="menu"
            className="fixed z-50 overflow-y-auto rounded-lg border border-border bg-bg-elevated p-1 shadow-lg animate-pop"
            style={{ width }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  )
}
