import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Trash2, Archive, CalendarDays, IterationCw, Bell, Star, Hash,
} from 'lucide-react'
import { useStoreShallow, useDisplayName } from '@/lib/store'
import { SelectMenu, type SelectOption } from './ui/SelectMenu'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { DatePicker } from './DatePicker'
import { PRIORITY_ORDER, PRIORITY_LABELS, STATUS_TYPE_ORDER } from '@/lib/constants'
import type { Priority } from '@/lib/types'

const btn =
  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-muted hover:bg-bg-hover hover:text-fg'

/** Floating bulk-action bar, shown while one or more issues are selected. */
export function BulkActionBar() {
  const {
    selectedIssueIds, states, users, labels, projects, cycles, issues, currentUserId, favorites,
    clearSelection, bulkSetStatus, bulkSetPriority, bulkSetAssignee, bulkAddLabel,
    bulkSetProject, bulkSetCycle, bulkSetDueDate, bulkSetEstimate, bulkSubscribe, bulkFavorite,
    bulkArchive, bulkDelete,
  } = useStoreShallow((s) => ({
    selectedIssueIds: s.selectedIssueIds,
    states: s.states,
    users: s.users,
    labels: s.labels,
    projects: s.projects,
    cycles: s.cycles,
    issues: s.issues,
    currentUserId: s.currentUserId,
    favorites: s.favorites,
    clearSelection: s.clearSelection,
    bulkSetStatus: s.bulkSetStatus,
    bulkSetPriority: s.bulkSetPriority,
    bulkSetAssignee: s.bulkSetAssignee,
    bulkAddLabel: s.bulkAddLabel,
    bulkSetProject: s.bulkSetProject,
    bulkSetCycle: s.bulkSetCycle,
    bulkSetDueDate: s.bulkSetDueDate,
    bulkSetEstimate: s.bulkSetEstimate,
    bulkSubscribe: s.bulkSubscribe,
    bulkFavorite: s.bulkFavorite,
    bulkArchive: s.bulkArchive,
    bulkDelete: s.bulkDelete,
  }))

  const fmt = useDisplayName()
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
    ...users.map((u) => ({ id: u.id, label: fmt(u.name), icon: <Avatar user={u} size={16} /> })),
  ]
  const labelOptions: SelectOption[] = labels
    .filter((l) => !l.isGroup)
    .map((l) => ({ id: l.id, label: l.name, icon: <LabelDot color={l.color} /> }))
  const projectOptions: SelectOption[] = [
    { id: '__none', label: 'No project', icon: <Hash size={14} className="text-faint" /> },
    ...projects.map((p) => ({ id: p.id, label: p.name, icon: <span className="text-[13px]">{p.icon}</span> })),
  ]
  const cycleOptions: SelectOption[] = [
    { id: '__none', label: 'No cycle', icon: <IterationCw size={14} className="text-faint" /> },
    ...[...cycles]
      .sort((a, b) => b.number - a.number)
      .map((c) => ({ id: c.id, label: c.name ?? `Cycle ${c.number}`, icon: <IterationCw size={14} /> })),
  ]
  const estimateOptions: SelectOption[] = [
    { id: '__none', label: 'No estimate', icon: <Hash size={14} className="text-faint" /> },
    ...[1, 2, 3, 5, 8].map((n) => ({ id: String(n), label: String(n), icon: <Hash size={14} /> })),
  ]

  // Subscribe acts as a toggle: if every selected issue already has me, unsubscribe.
  const allSubscribed = ids.every((id) => {
    const iss = issues.find((i) => i.id === id)
    return iss?.subscriberIds.includes(currentUserId)
  })
  const allFavorited = ids.every((id) => favorites.some((f) => f.type === 'issue' && f.id === id))

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
        <SelectMenu
          options={projectOptions}
          onSelect={(id) => bulkSetProject(ids, id === '__none' ? undefined : id)}
          placeholder="Add to project…"
          trigger={<span className={btn}><Hash size={14} /> Project</span>}
        />
        {cycles.length > 0 && (
          <SelectMenu
            options={cycleOptions}
            onSelect={(id) => bulkSetCycle(ids, id === '__none' ? undefined : id)}
            placeholder="Add to cycle…"
            trigger={<span className={btn}><IterationCw size={14} /> Cycle</span>}
          />
        )}
        <SelectMenu
          options={estimateOptions}
          onSelect={(id) => bulkSetEstimate(ids, id === '__none' ? undefined : Number(id))}
          placeholder="Set estimate…"
          trigger={<span className={btn}><Hash size={14} /> Estimate</span>}
        />
        <DatePicker
          onChange={(iso) => bulkSetDueDate(ids, iso)}
          trigger={<span className={btn}><CalendarDays size={14} /> Due date</span>}
        />

        <button
          onClick={() => bulkSubscribe(ids, !allSubscribed)}
          className={btn}
          title={allSubscribed ? 'Unsubscribe' : 'Subscribe'}
        >
          <Bell size={14} /> {allSubscribed ? 'Unsubscribe' : 'Subscribe'}
        </button>
        <button
          onClick={() => bulkFavorite(ids)}
          className={btn}
          title="Add to favorites"
        >
          <Star size={14} fill={allFavorited ? 'currentColor' : 'none'} className={allFavorited ? 'text-[var(--status-started)]' : ''} /> Favorite
        </button>

        <button onClick={() => bulkArchive(ids)} className={btn} title="Archive selected">
          <Archive size={14} /> Archive
        </button>

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
