import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { menuOverlayOpen } from '@/lib/utils'

/**
 * A destructive-action confirmation, in Linear's shape: a small centred card
 * with the question as the title, a one-line consequence, then Cancel and the
 * action itself. Esc or the backdrop cancels; ↵ confirms.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (menuOverlayOpen()) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  return createPortal(
    <div
      data-overlay
      className="fixed inset-0 z-[60] flex items-start justify-center bg-bg-overlay pt-32 animate-fade"
      onMouseDown={onCancel}
    >
      <div
        role="alertdialog"
        aria-label={title}
        className="w-[400px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated p-5 shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-medium text-fg">{title}</h2>
        {description && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{description}</p>}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-[13px] text-muted hover:bg-bg-hover hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="rounded-md bg-[var(--priority-urgent)] px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
