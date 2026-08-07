import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useToasts } from '@/lib/toast'
import { Toggle } from './ui/Toggle'

/**
 * Linear's "Create team" dialog, reached from the `+` in the Teams header and
 * from ⌘K. Name, an identifier derived from the name but editable, and the
 * private switch. Creating drops you into the new team, as Linear does.
 */
export function CreateTeamModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const createTeam = useStore((s) => s.createTeam)
  const navigate = useNavigate()
  const addToast = useToasts((s) => s.add)

  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  // Once the identifier has been typed into, stop overwriting it from the name.
  const [keyTouched, setKeyTouched] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setKey('')
    setKeyTouched(false)
    setIsPrivate(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const suggested = name.includes(' ')
    ? name
        .split(/\s+/)
        .map((w) => w[0] ?? '')
        .join('')
        .toUpperCase()
        .slice(0, 5)
    : name.slice(0, 3).toUpperCase()

  const submit = () => {
    if (!name.trim()) return
    const team = createTeam(name, {
      key: keyTouched ? key : undefined,
      private: isPrivate,
    })
    addToast({ message: `Team ${team.name} created` })
    onClose()
    navigate(`/team/${team.key}/active`)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-[440px] rounded-lg border border-border bg-bg-elevated shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3 text-[13px] font-medium text-fg">
          Create team
        </div>

        <div className="space-y-4 px-4 py-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-muted">Team name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. Design"
              className="w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] text-muted">Identifier</span>
            <input
              value={keyTouched ? key : suggested}
              onChange={(e) => {
                setKeyTouched(true)
                setKey(e.target.value.toUpperCase())
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="TEA"
              maxLength={5}
              className="w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] uppercase tabular-nums text-fg outline-none focus:border-accent"
            />
            <span className="mt-1 block text-[11px] text-faint">
              Issues in this team will be numbered {(keyTouched ? key : suggested) || 'TEA'}-123
            </span>
          </label>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[13px] text-fg">Make team private</div>
              <div className="text-[12px] text-muted">
                Only invited members can see this team
              </div>
            </div>
            <Toggle checked={isPrivate} onChange={setIsPrivate} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2.5 py-1.5 text-[13px] text-muted hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-[13px] text-accent-text hover:bg-accent-hover disabled:opacity-50"
          >
            Create team
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Mounted once in App so ⌘K can open the dialog from anywhere. */
export function CreateTeamModalHost() {
  const open = useStore((s) => s.createTeamOpen)
  const setOpen = useStore((s) => s.setCreateTeamOpen)
  return <CreateTeamModal open={open} onClose={() => setOpen(false)} />
}

/** The `+` Linear parks in the Teams header. */
export function CreateTeamButton() {
  const setOpen = useStore((s) => s.setCreateTeamOpen)
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Create team"
      title="Create team"
      className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg"
    >
      <Plus size={15} />
    </button>
  )
}
