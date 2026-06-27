import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Clock, CheckCheck, Trash2, X } from 'lucide-react'
import { Avatar } from './Avatar'
import { AssigneePicker } from './pickers'

// ── Inbox floating bulk-action bar ───────────────────────────────────────────
// Mirrors the issue list's BulkActionBar (fixed, bottom-centre, animate-pop) but
// scoped to inbox notifications: every action maps the checked notification ids
// to their underlying issue (Assign to…) or runs a per-notification store action
// (Mark read / Snooze / Delete) supplied by the Inbox host. Selection state is
// owned by Inbox; this is a pure presentational bar.
const btn =
  'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] text-muted hover:bg-bg-hover hover:text-fg'

export function InboxBulkActions({
  count,
  onAssign,
  onMarkRead,
  onSnooze,
  onDelete,
  onClear,
  snoozeMenu,
}: {
  count: number
  onAssign: (assigneeId?: string) => void
  onMarkRead: () => void
  onSnooze?: () => void
  onDelete: () => void
  onClear: () => void
  // Optional snooze popover trigger rendered by the host (it owns the calendar
  // presets); when omitted the bar shows no snooze affordance.
  snoozeMenu?: React.ReactNode
}) {
  // Esc clears the selection — matches the issue list's bulk bar. The Inbox
  // keydown handler also clears on Esc, but binding here keeps the bar
  // self-contained when reused elsewhere.
  useEffect(() => {
    if (count === 0) return
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
        return
      if (e.key === 'Escape') onClear()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [count, onClear])

  if (count === 0) return null

  return createPortal(
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-pop">
      <div className="flex items-center gap-1 rounded-xl border border-border bg-bg-elevated px-2 py-1.5 shadow-lg">
        <span className="flex items-center gap-2 rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white">
          {count} selected
          <button onClick={onClear} className="hover:opacity-80" title="Clear (Esc)">
            <X size={13} />
          </button>
        </span>

        <AssigneePicker
          onChange={onAssign}
          align="start"
          trigger={
            <span className={btn}>
              <Avatar size={16} /> Assign to…
            </span>
          }
        />
        <button onClick={onMarkRead} className={btn} title="Mark as read">
          <CheckCheck size={14} /> Mark read
        </button>
        {snoozeMenu ?? (onSnooze ? (
          <button onClick={onSnooze} className={btn} title="Snooze">
            <Clock size={14} /> Snooze
          </button>
        ) : null)}
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-muted hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
          title="Delete"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>,
    document.body,
  )
}
