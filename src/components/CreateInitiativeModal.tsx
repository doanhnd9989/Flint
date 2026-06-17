import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { Avatar } from './Avatar'
import { SelectMenu } from './ui/SelectMenu'
import type { SelectOption } from './ui/SelectMenu'
import { INITIATIVE_STATUS, INITIATIVE_STATUS_ORDER } from '@/lib/constants'
import type { InitiativeStatus } from '@/lib/types'

const chip =
  'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover'

// A small palette of strategy-flavored emoji to pick the initiative icon from.
const ICONS = ['🎯', '🚀', '🧭', '⭐', '🏆', '🔭', '🌱', '⚡', '🛠️', '💡', '📈', '🧩']

export function CreateInitiativeModal() {
  const navigate = useNavigate()
  const store = useStore()
  const open = store.createInitiativeOpen

  const [icon, setIcon] = useState('🎯')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<InitiativeStatus>('planned')
  const [ownerId, setOwnerId] = useState<string | undefined>(store.currentUserId)

  useEffect(() => {
    if (open) {
      setIcon('🎯')
      setName('')
      setDescription('')
      setStatus('planned')
      setOwnerId(store.currentUserId)
    }
  }, [open, store.currentUserId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) store.setCreateInitiativeOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, store])

  if (!open) return null

  const owner = store.users.find((u) => u.id === ownerId)

  const iconOptions: SelectOption[] = ICONS.map((e) => ({
    id: e,
    label: e,
    icon: <span className="text-base">{e}</span>,
    selected: e === icon,
  }))
  const statusOptions: SelectOption[] = INITIATIVE_STATUS_ORDER.map((s) => ({
    id: s,
    label: INITIATIVE_STATUS[s].label,
    icon: (
      <span
        className="inline-block h-3 w-3 rounded-full border-2"
        style={{ borderColor: INITIATIVE_STATUS[s].color }}
      />
    ),
    selected: s === status,
  }))
  const ownerOptions: SelectOption[] = [
    { id: '__none', label: 'No owner', icon: <Avatar />, selected: !ownerId },
    ...store.users.map((u) => ({
      id: u.id,
      label: u.name,
      icon: <Avatar user={u} />,
      selected: u.id === ownerId,
    })),
  ]

  function submit() {
    if (!name.trim()) return
    const initiative = store.createInitiative({
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      color: '#5e6ad2',
      status,
      ownerId,
    })
    store.setCreateInitiativeOpen(false)
    navigate(`/initiative/${initiative.id}`)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-24 animate-fade"
      onMouseDown={() => store.setCreateInitiativeOpen(false)}
    >
      <div
        className="w-[560px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[12px] text-muted">
          <span className="rounded-md bg-bg-tertiary px-1.5 py-0.5">{store.workspaceName}</span>
          <span>New initiative</span>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-start gap-2">
            <SelectMenu
              width={160}
              options={iconOptions}
              onSelect={setIcon}
              placeholder="Icon…"
              trigger={
                <span className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-bg-hover">
                  {icon}
                </span>
              }
            />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Initiative name"
              className="mt-0.5 flex-1 bg-transparent text-[16px] font-medium text-fg outline-none"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description…"
            className="mt-2 min-h-16 w-full resize-none bg-transparent text-[13px] text-muted outline-none"
          />

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <SelectMenu
              options={statusOptions}
              onSelect={(s) => setStatus(s as InitiativeStatus)}
              placeholder="Change status…"
              trigger={
                <span className={chip}>
                  <span
                    className="inline-block h-3 w-3 rounded-full border-2"
                    style={{ borderColor: INITIATIVE_STATUS[status].color }}
                  />
                  {INITIATIVE_STATUS[status].label}
                </span>
              }
            />
            <SelectMenu
              options={ownerOptions}
              onSelect={(uid) => setOwnerId(uid === '__none' ? undefined : uid)}
              placeholder="Set owner…"
              trigger={
                <span className={chip}>
                  <Avatar user={owner} size={16} />
                  {owner?.name ?? 'No owner'}
                </span>
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={() => store.setCreateInitiativeOpen(false)}
            className="rounded-md px-3 py-1.5 text-[13px] text-muted hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={submit}
            className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Create initiative
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
