import { useState } from 'react'
import { Trash2, Plus, ChevronRight } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import { LABEL_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Label } from '@/lib/types'
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

// Linear's group glyph: a small cluster of overlapping dots tinted from the
// group's child label colors (falls back to neutral grey dots when empty).
function LabelGroupIcon({ colors }: { colors: string[] }) {
  const palette = colors.length ? colors : ['#95a2b3', '#95a2b3', '#95a2b3']
  const c = [palette[0], palette[1 % palette.length], palette[2 % palette.length]]
  return (
    <span className="relative inline-block h-3.5 w-3.5 shrink-0">
      <span className="absolute left-0 top-0 h-2 w-2 rounded-full" style={{ background: c[0] }} />
      <span className="absolute right-0 top-0 h-2 w-2 rounded-full" style={{ background: c[1] }} />
      <span className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full" style={{ background: c[2] }} />
    </span>
  )
}

function LabelRow({
  label,
  indented,
  usage,
  onUpdate,
  onDelete,
}: {
  label: Label
  indented?: boolean
  usage: number
  onUpdate: (patch: Partial<Pick<Label, 'name' | 'color'>>) => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 rounded-md px-1 py-1 hover:bg-bg-hover',
        indented && 'ml-3 pl-3',
      )}
    >
      {/* tree connector for grouped labels */}
      {indented && (
        <span className="absolute left-0 top-0 h-1/2 w-3 border-b border-l border-border" />
      )}
      <ColorPicker color={label.color} onPick={(c) => onUpdate({ color: c })} />
      <input
        value={label.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="flex-1 bg-transparent text-[13px] text-fg outline-none"
      />
      <span className="text-[11px] text-faint">{usage} issues</span>
      <button
        type="button"
        onClick={onDelete}
        className="flex h-6 w-6 items-center justify-center rounded text-faint opacity-0 hover:text-[var(--priority-urgent)] group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// Inline "add a label" input — used both ungrouped and inside a group.
function NewLabelInput({
  indented,
  onCreate,
}: {
  indented?: boolean
  onCreate: (name: string, color: string) => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(LABEL_COLORS[7])
  const submit = () => {
    if (!name.trim()) return
    onCreate(name.trim(), color)
    setName('')
  }
  return (
    <div className={cn('relative flex items-center gap-2 px-1 py-1', indented && 'ml-3 pl-3')}>
      {indented && (
        <span className="absolute left-0 top-0 h-1/2 w-3 border-b border-l border-border" />
      )}
      <ColorPicker color={color} onPick={setColor} />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Label name…"
        autoFocus={indented}
        className="flex-1 bg-transparent text-[13px] text-fg outline-none"
      />
      <button
        type="button"
        disabled={!name.trim()}
        onClick={submit}
        className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[12px] text-white disabled:opacity-40 hover:bg-accent-hover"
      >
        <Plus size={13} /> Add
      </button>
    </div>
  )
}

export function LabelsSettings() {
  const { labels, issues, createLabel, createLabelGroup, updateLabel, deleteLabel } =
    useStoreShallow((s) => ({
      labels: s.labels,
      issues: s.issues,
      createLabel: s.createLabel,
      createLabelGroup: s.createLabelGroup,
      updateLabel: s.updateLabel,
      deleteLabel: s.deleteLabel,
    }))

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newGroup, setNewGroup] = useState<string | null>(null)

  const usage = (labelId: string) => issues.filter((i) => i.labelIds.includes(labelId)).length

  const groups = labels.filter((l) => l.isGroup)
  const childrenOf = (gid: string) => labels.filter((l) => l.groupId === gid)
  const ungrouped = labels.filter((l) => !l.isGroup && !l.groupId)

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div className="space-y-1">
      {/* groups, each with its child labels */}
      {groups.map((g) => {
        const kids = childrenOf(g.id)
        const isCollapsed = collapsed.has(g.id)
        return (
          <div key={g.id}>
            <div className="group flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-bg-hover">
              <button
                type="button"
                onClick={() => toggle(g.id)}
                className="flex h-4 w-4 items-center justify-center text-faint"
              >
                <ChevronRight size={13} className={cn('transition-transform', !isCollapsed && 'rotate-90')} />
              </button>
              <LabelGroupIcon colors={kids.map((k) => k.color)} />
              <input
                value={g.name}
                onChange={(e) => updateLabel(g.id, { name: e.target.value })}
                className="flex-1 bg-transparent text-[13px] font-medium text-fg outline-none"
              />
              <span className="text-[11px] text-faint">
                {kids.length} {kids.length === 1 ? 'label' : 'labels'}
              </span>
              <button
                type="button"
                title="Add label to group"
                onClick={() => {
                  setCollapsed((p) => {
                    const n = new Set(p)
                    n.delete(g.id)
                    return n
                  })
                  setAddingTo(g.id)
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-faint opacity-0 hover:text-fg group-hover:opacity-100"
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete group "${g.name}"? Its labels will be ungrouped.`))
                    deleteLabel(g.id)
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-faint opacity-0 hover:text-[var(--priority-urgent)] group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {!isCollapsed && (
              <>
                {kids.map((k) => (
                  <LabelRow
                    key={k.id}
                    label={k}
                    indented
                    usage={usage(k.id)}
                    onUpdate={(patch) => updateLabel(k.id, patch)}
                    onDelete={() => {
                      if (confirm(`Delete label "${k.name}"? It will be removed from all issues.`))
                        deleteLabel(k.id)
                    }}
                  />
                ))}
                {addingTo === g.id && (
                  <NewLabelInput
                    indented
                    onCreate={(name, color) => createLabel(name, color, g.id)}
                  />
                )}
              </>
            )}
          </div>
        )
      })}

      {/* ungrouped labels */}
      {ungrouped.map((l) => (
        <LabelRow
          key={l.id}
          label={l}
          usage={usage(l.id)}
          onUpdate={(patch) => updateLabel(l.id, patch)}
          onDelete={() => {
            if (confirm(`Delete label "${l.name}"? It will be removed from all issues.`))
              deleteLabel(l.id)
          }}
        />
      ))}

      {/* new group inline input */}
      {newGroup !== null && (
        <div className="flex items-center gap-1.5 px-1 py-1">
          <span className="h-4 w-4" />
          <LabelGroupIcon colors={[]} />
          <input
            value={newGroup}
            autoFocus
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newGroup.trim()) {
                const g = createLabelGroup(newGroup.trim())
                setNewGroup(null)
                setAddingTo(g.id) // Linear drops you into adding the first label
              } else if (e.key === 'Escape') {
                setNewGroup(null)
              }
            }}
            placeholder="Group name…"
            className="flex-1 bg-transparent text-[13px] font-medium text-fg outline-none"
          />
        </div>
      )}

      {/* toolbar: New group + new (ungrouped) label */}
      <div className="mt-2 border-t border-border pt-2">
        <button
          type="button"
          onClick={() => setNewGroup('')}
          className="mb-1 flex items-center gap-1.5 rounded-md px-1 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
        >
          <Plus size={13} /> New group
        </button>
        <NewLabelInput onCreate={(name, color) => createLabel(name, color)} />
      </div>
    </div>
  )
}
