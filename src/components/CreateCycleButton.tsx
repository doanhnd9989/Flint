import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useToasts } from '@/lib/toast'

/** "New cycle" button + modal: appends a fresh 2-week cycle after the latest. */
export function CreateCycleButton({ teamId }: { teamId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const addToast = useToasts((s) => s.add)

  // Esc closes the modal.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    setOpen(false)
    setName('')
  }

  function create() {
    useStore.getState().createCycle(teamId, name.trim() || undefined)
    close()
    addToast({ message: 'Cycle created' })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:text-fg"
      >
        <Plus size={13} />
        New cycle
      </button>

      {open &&
        createPortal(
          <div
            data-overlay
            onClick={close}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          >
            <div
              data-overlay
              onClick={(e) => e.stopPropagation()}
              className="w-[380px] rounded-xl border border-border bg-bg p-4 shadow-xl"
            >
              <div className="text-[13px] font-medium text-fg">New cycle</div>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') create()
                }}
                placeholder="Cycle name (optional)"
                className="mt-3 w-full rounded-md border border-border bg-bg-secondary px-2 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
              />
              <p className="mt-2 text-[11px] text-faint">
                A new 2-week cycle will be added after the latest one.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={close}
                  className="px-2 py-1 text-[12px] text-muted hover:text-fg"
                >
                  Cancel
                </button>
                <button
                  onClick={create}
                  className="rounded-md bg-accent px-3 py-1 text-[12px] text-white"
                >
                  Create
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
