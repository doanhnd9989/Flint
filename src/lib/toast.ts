import { create } from 'zustand'
import { nanoid } from 'nanoid'

/**
 * Ephemeral toast notifications (Linear shows these bottom-right after copy /
 * background actions). Kept in their own non-persisted store so they never
 * leak into localStorage and never trigger a re-render of the main store.
 */
export interface Toast {
  id: string
  message: string
}

interface ToastState {
  toasts: Toast[]
  add: (message: string) => void
  dismiss: (id: string) => void
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  add: (message) =>
    set((s) => ({ toasts: [...s.toasts, { id: `t_${nanoid(6)}`, message }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Fire a toast from anywhere (components or plain handlers). */
export function toast(message: string) {
  useToasts.getState().add(message)
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
