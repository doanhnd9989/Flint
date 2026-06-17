import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import { LABEL_COLORS } from '@/lib/constants'
import { Popover } from './ui/Popover'
import { LabelDot } from './LabelChip'

function ColorPicker({
  color,
  onPick,
}: {
  color: string
  onPick: (c: string) => void
}) {
  return (
    <Popover
      width={132}
      trigger={
        <span className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-bg-hover">
          <LabelDot color={color} size={12} />
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
              className="flex h-5 w-5 items-center justify-center rounded-full hover:scale-110"
              style={{ background: c }}
            >
              {c === color && (
                <svg width="11" height="11" viewBox="0 0 16 16" className="text-white">
                  <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}

export function LabelsSettings() {
  const { labels, issues, createLabel, updateLabel, deleteLabel } = useStoreShallow((s) => ({
    labels: s.labels,
    issues: s.issues,
    createLabel: s.createLabel,
    updateLabel: s.updateLabel,
    deleteLabel: s.deleteLabel,
  }))

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(LABEL_COLORS[7])

  const usage = (labelId: string) =>
    issues.filter((i) => i.labelIds.includes(labelId)).length

  return (
    <div className="space-y-1">
      {labels.map((l) => (
        <div
          key={l.id}
          className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-bg-hover"
        >
          <ColorPicker color={l.color} onPick={(c) => updateLabel(l.id, { color: c })} />
          <input
            value={l.name}
            onChange={(e) => updateLabel(l.id, { name: e.target.value })}
            className="flex-1 bg-transparent text-[13px] text-fg outline-none"
          />
          <span className="text-[11px] text-faint">{usage(l.id)} issues</span>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete label "${l.name}"? It will be removed from all issues.`))
                deleteLabel(l.id)
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-faint opacity-0 hover:text-[var(--priority-urgent)] group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
        <ColorPicker color={newColor} onPick={setNewColor} />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) {
              createLabel(newName.trim(), newColor)
              setNewName('')
            }
          }}
          placeholder="New label name…"
          className="flex-1 bg-transparent text-[13px] text-fg outline-none"
        />
        <button
          type="button"
          disabled={!newName.trim()}
          onClick={() => {
            createLabel(newName.trim(), newColor)
            setNewName('')
          }}
          className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[12px] text-white disabled:opacity-40 hover:bg-accent-hover"
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}
