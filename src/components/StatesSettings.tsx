import { useState } from 'react'
import { Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import { LABEL_COLORS, STATUS_TYPE_ORDER } from '@/lib/constants'
import type { StatusType } from '@/lib/types'
import { Popover } from './ui/Popover'
import { StatusIcon } from './StatusIcon'

const TYPES: { id: StatusType; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: '#bec2c8' },
  { id: 'unstarted', label: 'Unstarted', color: '#8a8f98' },
  { id: 'started', label: 'Started', color: '#f2c94c' },
  { id: 'completed', label: 'Completed', color: '#5e6ad2' },
  { id: 'canceled', label: 'Canceled', color: '#95a2b3' },
]

function ColorSwatch({
  type,
  color,
  onPick,
}: {
  type: StatusType
  color: string
  onPick: (c: string) => void
}) {
  return (
    <Popover
      width={132}
      trigger={
        <span className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-bg-hover">
          <StatusIcon type={type} color={color} size={15} />
        </span>
      }
    >
      {(close) => (
        <div className="grid grid-cols-6 gap-1 p-0.5">
          {LABEL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onPick(c)
                close()
              }}
              className="h-5 w-5 rounded-full hover:scale-110"
              style={{ background: c }}
            />
          ))}
        </div>
      )}
    </Popover>
  )
}

export function StatesSettings() {
  const { states, issues, createState, updateState, deleteState, moveState } = useStoreShallow((s) => ({
    states: s.states,
    issues: s.issues,
    createState: s.createState,
    updateState: s.updateState,
    deleteState: s.deleteState,
    moveState: s.moveState,
  }))

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<StatusType>('unstarted')

  const ordered = [...states].sort(
    (a, b) => STATUS_TYPE_ORDER[a.type] - STATUS_TYPE_ORDER[b.type] || a.position - b.position,
  )
  const usage = (id: string) => issues.filter((i) => i.stateId === id).length
  const peerIndex = (id: string, type: StatusType) => {
    const peers = ordered.filter((s) => s.type === type)
    return { idx: peers.findIndex((s) => s.id === id), len: peers.length }
  }

  function addState() {
    if (!newName.trim()) return
    const maxPos = states.reduce((m, s) => Math.max(m, s.position), 0)
    const t = TYPES.find((x) => x.id === newType)!
    createState({ name: newName.trim(), type: newType, color: t.color, position: maxPos + 1 })
    setNewName('')
  }

  return (
    <div className="space-y-0.5">
      {ordered.map((st) => {
        const { idx, len } = peerIndex(st.id, st.type)
        return (
          <div key={st.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-bg-hover">
            <ColorSwatch type={st.type} color={st.color} onPick={(c) => updateState(st.id, { color: c })} />
            <input
              value={st.name}
              onChange={(e) => updateState(st.id, { name: e.target.value })}
              className="w-36 bg-transparent text-[13px] text-fg outline-none"
            />
            <select
              value={st.type}
              onChange={(e) => updateState(st.id, { type: e.target.value as StatusType })}
              className="rounded-md border border-border bg-bg px-1.5 py-0.5 text-[11px] text-muted outline-none"
            >
              {TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <div className="flex-1" />
            <span className="text-[11px] text-faint">{usage(st.id)}</span>
            <div className="flex opacity-0 group-hover:opacity-100">
              <button
                type="button"
                disabled={idx <= 0}
                onClick={() => moveState(st.id, 'up')}
                className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-selected disabled:opacity-30"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                disabled={idx >= len - 1}
                onClick={() => moveState(st.id, 'down')}
                className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-selected disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                disabled={states.length <= 1}
                onClick={() => {
                  if (confirm(`Delete status "${st.name}"? Issues using it move to another status.`))
                    deleteState(st.id)
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-faint hover:text-[var(--priority-urgent)] disabled:opacity-30"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )
      })}

      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addState()}
          placeholder="New status name…"
          className="w-36 bg-transparent text-[13px] text-fg outline-none"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as StatusType)}
          className="rounded-md border border-border bg-bg px-1.5 py-0.5 text-[11px] text-muted outline-none"
        >
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          type="button"
          disabled={!newName.trim()}
          onClick={addState}
          className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[12px] text-white disabled:opacity-40 hover:bg-accent-hover"
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}
