import { useState } from 'react'
import { Target } from 'lucide-react'
import { useStore } from '@/lib/store'

// Inline-editable cycle goal — Linear shows a free-text objective at the top of
// the cycle view. Reads Cycle.goal, writes via setCycleGoal. Click to edit;
// save on blur or ⌘↵/Enter, Escape to cancel.
export function CycleGoals({ cycleId }: { cycleId: string }) {
  const cycle = useStore((s) => s.cycles.find((c) => c.id === cycleId))
  const setCycleGoal = useStore((s) => s.setCycleGoal)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  if (!cycle) return null
  const goal = cycle.goal ?? ''

  function startEdit() {
    setDraft(goal)
    setEditing(true)
  }
  function save() {
    setCycleGoal(cycleId, draft.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            setEditing(false)
          } else if (e.key === 'Enter' && (e.metaKey || !e.shiftKey)) {
            e.preventDefault()
            save()
          }
        }}
        rows={2}
        placeholder="Set a goal for this cycle…"
        className="mt-1.5 w-full resize-none rounded-md border border-border bg-bg-secondary px-2 py-1 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
      />
    )
  }

  if (!goal) {
    return (
      <button
        onClick={startEdit}
        className="mt-1.5 text-[13px] text-faint hover:text-fg"
      >
        + Add cycle goal
      </button>
    )
  }

  return (
    <button
      onClick={startEdit}
      className="group mt-1.5 flex items-start gap-1.5 text-left"
    >
      <Target
        size={14}
        className="mt-0.5 shrink-0 text-muted group-hover:text-fg"
      />
      <span className="text-[13px] text-fg group-hover:text-fg">{goal}</span>
    </button>
  )
}
