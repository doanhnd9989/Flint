import { create } from 'zustand'
import { nanoid } from 'nanoid'

/**
 * Ephemeral toast notifications (Linear shows these bottom-right after copy /
 * background actions). Kept in their own non-persisted store so they never
 * leak into localStorage and never trigger a re-render of the main store.
 */
export interface ToastAction {
  /** Button label, e.g. "Download". */
  label: string
  /** Run on click; the toast then dismisses itself. */
  onClick: () => void
}

export interface Toast {
  id: string
  /** Optional bold first line (Linear's two-line toasts, e.g. "Check your email"). */
  title?: string
  message: string
  /** Optional inline action button (e.g. the export "Download" link). */
  action?: ToastAction
  /** Override auto-dismiss time (ms). Defaults to TOAST_MS in the Toaster. */
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  add: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  add: (toast) =>
    set((s) => ({ toasts: [...s.toasts, { id: `t_${nanoid(6)}`, ...toast }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/**
 * Fire a toast from anywhere (components or plain handlers). Pass a string for
 * a simple one-liner, or an object for a titled / actionable toast.
 */
export function toast(toast: string | Omit<Toast, 'id'>) {
  useToasts.getState().add(typeof toast === 'string' ? { message: toast } : toast)
}

/** Copy text to the clipboard and confirm with a Linear-style toast. */
export function copyToClipboard(text: string, message: string) {
  navigator.clipboard?.writeText(text)
  toast(message)
}

/** Messages copied verbatim from Linear's own copy toasts. */
export const copyToast = {
  id: (identifier: string) => `"${identifier}" copied to clipboard`,
  url: () => 'Issue URL copied to clipboard',
  branch: () =>
    'Branch name copied to clipboard. Paste it into your favorite git client.',
} as const
