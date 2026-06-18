import type { ReactNode } from 'react'
import { useStore, useDisplayName } from '@/lib/store'
import { SelectMenu, type SelectOption } from './ui/SelectMenu'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { PRIORITY_LABELS, PRIORITY_ORDER, STATUS_TYPE_ORDER } from '@/lib/constants'
import type { Priority } from '@/lib/types'

export function StatusPicker({
  stateId,
  onChange,
  trigger,
  align,
}: {
  stateId: string
  onChange: (id: string) => void
  trigger: ReactNode
  align?: 'start' | 'end'
}) {
  const states = useStore((s) => s.states)
  const options: SelectOption[] = [...states]
    .sort((a, b) => STATUS_TYPE_ORDER[a.type] - STATUS_TYPE_ORDER[b.type] || a.position - b.position)
    .map((st) => ({
      id: st.id,
      label: st.name,
      icon: <StatusIcon type={st.type} color={st.color} />,
      selected: st.id === stateId,
    }))
  return <SelectMenu options={options} onSelect={onChange} trigger={trigger} align={align} placeholder="Change status…" />
}

export function PriorityPicker({
  priority,
  onChange,
  trigger,
  align,
}: {
  priority: Priority
  onChange: (p: Priority) => void
  trigger: ReactNode
  align?: 'start' | 'end'
}) {
  const options: SelectOption[] = PRIORITY_ORDER.map((p) => ({
    id: String(p),
    label: PRIORITY_LABELS[p],
    icon: <PriorityIcon priority={p} />,
    selected: p === priority,
  }))
  return (
    <SelectMenu
      options={options}
      onSelect={(id) => onChange(Number(id) as Priority)}
      trigger={trigger}
      align={align}
      placeholder="Set priority…"
    />
  )
}

export function AssigneePicker({
  assigneeId,
  onChange,
  trigger,
  align,
}: {
  assigneeId?: string
  onChange: (id?: string) => void
  trigger: ReactNode
  align?: 'start' | 'end'
}) {
  const users = useStore((s) => s.users)
  const fmt = useDisplayName()
  const options: SelectOption[] = [
    {
      id: '__none',
      label: 'No assignee',
      icon: <Avatar />,
      selected: !assigneeId,
    },
    ...users.map((u) => ({
      id: u.id,
      label: fmt(u.name),
      icon: <Avatar user={u} />,
      selected: u.id === assigneeId,
    })),
  ]
  return (
    <SelectMenu
      options={options}
      onSelect={(id) => onChange(id === '__none' ? undefined : id)}
      trigger={trigger}
      align={align}
      placeholder="Assign to…"
    />
  )
}

export function LabelPicker({
  labelIds,
  onToggle,
  trigger,
  align,
}: {
  labelIds: string[]
  onToggle: (id: string) => void
  trigger: ReactNode
  align?: 'start' | 'end'
}) {
  const labels = useStore((s) => s.labels)
  const options: SelectOption[] = labels
    .filter((l) => !l.isGroup)
    .map((l) => ({
      id: l.id,
      label: l.name,
      icon: <LabelDot color={l.color} />,
      selected: labelIds.includes(l.id),
    }))
  return (
    <SelectMenu
      options={options}
      onSelect={onToggle}
      trigger={trigger}
      align={align}
      keepOpen
      placeholder="Add labels…"
    />
  )
}

export function SubscriberPicker({
  subscriberIds,
  onToggle,
  trigger,
  align,
}: {
  subscriberIds: string[]
  onToggle: (id: string) => void
  trigger: ReactNode
  align?: 'start' | 'end'
}) {
  const users = useStore((s) => s.users)
  const fmt = useDisplayName()
  const options: SelectOption[] = users.map((u) => ({
    id: u.id,
    label: fmt(u.name),
    icon: <Avatar user={u} />,
    selected: subscriberIds.includes(u.id),
  }))
  return (
    <SelectMenu
      options={options}
      onSelect={onToggle}
      trigger={trigger}
      align={align}
      keepOpen
      placeholder="Add subscribers…"
    />
  )
}

export function ProjectPicker({
  projectId,
  onChange,
  trigger,
  align,
}: {
  projectId?: string
  onChange: (id?: string) => void
  trigger: ReactNode
  align?: 'start' | 'end'
}) {
  const projects = useStore((s) => s.projects)
  const options: SelectOption[] = [
    { id: '__none', label: 'No project', icon: <span className="text-faint">○</span>, selected: !projectId },
    ...projects.map((p) => ({
      id: p.id,
      label: p.name,
      icon: <span>{p.icon}</span>,
      selected: p.id === projectId,
    })),
  ]
  return (
    <SelectMenu
      options={options}
      onSelect={(id) => onChange(id === '__none' ? undefined : id)}
      trigger={trigger}
      align={align}
      placeholder="Add to project…"
    />
  )
}
