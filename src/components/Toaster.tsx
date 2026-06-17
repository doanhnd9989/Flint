import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useToasts } from '@/lib/toast'
import type { Toast } from '@/lib/toast'

const TOAST_MS = 5000

/** A single toast row — auto-dismisses after a few seconds. */
function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss)
  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), TOAST_MS)
    return () => clearTimeout(t)
  }, [toast.id, dismiss])

  return (
    <div className="animate-toast flex w-[340px] items-start gap-2.5 rounded-[10px] border border-border bg-bg-elevated py-2.5 pl-3 pr-2 shadow-lg">
      <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-fg text-[11px] font-semibold leading-none text-bg">
        i
      </span>
      <span className="flex-1 pt-px text-[13px] leading-snug text-fg">
        {toast.message}
      </span>
      <button
        onClick={() => dismiss(toast.id)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-muted"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

/** Bottom-right toast stack, mirroring Linear's notification toasts. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  if (!toasts.length) return null
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>,
    document.body,
  )
}
