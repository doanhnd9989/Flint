import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Trash2 } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import { SelectMenu, type SelectOption } from './ui/SelectMenu'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { PRIORITY_ORDER, PRIORITY_LABELS, STATUS_TYPE_ORDER } from '@/lib/constants'
import type { Priority } from '@/lib/types'

const btn =
  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-muted hover:bg-bg-hover hover:text-fg'

/** Floating bulk-action bar, shown while one or more issues are selected. */
export function BulkActionBar() {
  const {
    selectedIssueIds, states, users, labels,
    clearSelection, bulkSetStatus, bulkSetPriority, bulkSetAssignee, bulkAddLabel, bulkDelete,
  } = useStoreShallow((s) => ({
    selectedIssueIds: s.selectedIssueIds,
    states: s.states,
    users: s.users,
    labels: s.labels,
    clearSelection: s.clearSelection,
    bulkSetStatus: s.bulkSetStatus,
    bulkSetPriority: s.bulkSetPriority,
    bulkSetAssignee: s.bulkSetAssignee,
    bulkAddLabel: s.bulkAddLabel,
    bulkDelete: s.bulkDelete,
  }))

  const ids = selectedIssueIds
  const count = ids.length

  useEffect(() => {
    if (count === 0) return
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') clearSelection()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [count, clearSelection])

  if (count === 0) return null

  const statusOptions: SelectOption[] = [...states]
    .sort((a, b) => STATUS_TYPE_ORDER[a.type] - STATUS_TYPE_ORDER[b.type] || a.position - b.position)
    .map((st) => ({ id: st.id, label: st.name, icon: <StatusIcon type={st.type} color={st.color} /> }))
  const priorityOptions: SelectOption[] = PRIORITY_ORDER.map((p) => ({
    id: String(p),
    label: PRIORITY_LABELS[p],
    icon: <PriorityIcon priority={p} />,
  }))
  const assigneeOptions: SelectOption[] = [
    { id: '__none', label: 'No assignee', icon: <Avatar /> },
    ...users.map((u) => ({ id: u.id, label: u.name, icon: <Avatar user={u} size={16} /> })),
  ]
  const labelOptions: SelectOption[] = labels.map((l) => ({
    id: l.id,
    label: l.name,
    icon: <LabelDot color={l.color} />,
  }))

  return createPortal(
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-pop">
      <div className="flex items-center gap-1 rounded-xl border border-border bg-bg-elevated px-2 py-1.5 shadow-lg">
        <span className="flex items-center gap-2 rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white">
          {count} selected
          <button onClick={clearSelection} className="hover:opacity-80" title="Clear (Esc)">
            <X size={13} />
          </button>
        </span>

        <SelectMenu
          options={statusOptions}
          onSelect={(stateId) => bulkSetStatus(ids, stateId)}
          align="start"
          placeholder="Set status…"
          trigger={<span className={btn}><StatusIcon type="started" color="var(--status-started)" /> Status</span>}
        />
        <SelectMenu
          options={priorityOptions}
          onSelect={(p) => bulkSetPriority(ids, Number(p) as Priority)}
          placeholder="Set priority…"
          trigger={<span className={btn}><PriorityIcon priority={2} /> Priority</span>}
        />
        <SelectMenu
          options={assigneeOptions}
          onSelect={(id) => bulkSetAssignee(ids, id === '__none' ? undefined : id)}
          placeholder="Assign to…"
          trigger={<span className={btn}><Avatar size={16} /> Assignee</span>}
        />
        <SelectMenu
          options={labelOptions}
          onSelect={(id) => bulkAddLabel(ids, id)}
          keepOpen
          placeholder="Add label…"
          trigger={<span className={btn}><LabelDot color="var(--text-tertiary)" /> Label</span>}
        />

        <button
          onClick={() => {
            if (confirm(`Delete ${count} issue${count > 1 ? 's' : ''}?`)) bulkDelete(ids)
          }}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-muted hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>,
    document.body,
  )
}
