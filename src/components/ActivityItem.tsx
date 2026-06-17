import type { Activity, Priority } from '@/lib/types'
import { useStore } from '@/lib/store'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { PRIORITY_LABELS } from '@/lib/constants'
import { formatFullDate, timeAgo } from '@/lib/utils'
import { Flag, IterationCw } from 'lucide-react'
import { LinkFavicon } from './LinkFavicon'

/** A small inline value chip used inside an activity line. */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-bg-secondary px-1.5 py-0.5 text-[12px] font-medium text-fg">
      {children}
    </span>
  )
}

/**
 * One entry in the issue activity feed. Resolves the change kind + from/to ids
 * into a Linear-style sentence with the relevant glyph/chip diff.
 */
export function ActivityItem({ activity }: { activity: Activity }) {
  const a = activity
  const store = useStore()
  const actor = store.users.find((u) => u.id === a.userId)

  const statusPill = (id?: string) => {
    const st = store.states.find((x) => x.id === id)
    if (!st) return <Pill>—</Pill>
    return (
      <Pill>
        <StatusIcon type={st.type} color={st.color} size={13} />
        {st.name}
      </Pill>
    )
  }
  const priorityPill = (raw?: string) => {
    const p = (raw == null ? 0 : Number(raw)) as Priority
    return (
      <Pill>
        <PriorityIcon priority={p} size={13} />
        {PRIORITY_LABELS[p]}
      </Pill>
    )
  }
  const userPill = (id?: string) => {
    const u = store.users.find((x) => x.id === id)
    return (
      <Pill>
        <Avatar user={u} size={14} />
        {u?.name ?? 'Unassigned'}
      </Pill>
    )
  }
  const labelPill = (id?: string) => {
    const l = store.labels.find((x) => x.id === id)
    return (
      <Pill>
        <LabelDot color={l?.color ?? 'var(--text-tertiary)'} />
        {l?.name ?? 'label'}
      </Pill>
    )
  }
  const projectPill = (id?: string) => {
    const p = store.projects.find((x) => x.id === id)
    return <Pill>{p?.name ?? 'project'}</Pill>
  }
  const milestonePill = (id?: string) => {
    const m = store.milestones.find((x) => x.id === id)
    return (
      <Pill>
        <Flag size={12} />
        {m?.name ?? 'milestone'}
      </Pill>
    )
  }
  const cyclePill = (id?: string) => {
    const c = store.cycles.find((x) => x.id === id)
    return (
      <Pill>
        <IterationCw size={12} />
        {c ? c.name ?? `Cycle ${c.number}` : 'cycle'}
      </Pill>
    )
  }
  const issuePill = (id?: string) => {
    const i = store.issues.find((x) => x.id === id)
    return (
      <Pill>
        <span className="font-mono text-[11px] text-faint">{i?.identifier ?? '—'}</span>
        {i?.title}
      </Pill>
    )
  }

  // The verb phrase for this kind, rendered as inline nodes.
  let body: React.ReactNode
  switch (a.kind) {
    case 'created':
      body = <span>created the issue</span>
      break
    case 'status':
      body = a.from ? (
        <>
          <span>changed status</span>
          {statusPill(a.from)}
          <span className="text-faint">→</span>
          {statusPill(a.to)}
        </>
      ) : (
        <>
          <span>set status to</span>
          {statusPill(a.to)}
        </>
      )
      break
    case 'priority':
      body = a.from && a.from !== '0' ? (
        <>
          <span>changed priority</span>
          {priorityPill(a.from)}
          <span className="text-faint">→</span>
          {priorityPill(a.to)}
        </>
      ) : (
        <>
          <span>set priority to</span>
          {priorityPill(a.to)}
        </>
      )
      break
    case 'assignee':
      body = a.to ? (
        <>
          <span>assigned to</span>
          {userPill(a.to)}
        </>
      ) : (
        <span>removed the assignee</span>
      )
      break
    case 'label':
      body = a.to ? (
        <>
          <span>added label</span>
          {labelPill(a.to)}
        </>
      ) : (
        <>
          <span>removed label</span>
          {labelPill(a.from)}
        </>
      )
      break
    case 'project':
      body = a.to ? (
        <>
          <span>added to project</span>
          {projectPill(a.to)}
        </>
      ) : (
        <>
          <span>removed from project</span>
          {projectPill(a.from)}
        </>
      )
      break
    case 'milestone':
      body = a.to ? (
        <>
          <span>set milestone to</span>
          {milestonePill(a.to)}
        </>
      ) : (
        <span>removed the milestone</span>
      )
      break
    case 'cycle':
      body = a.to ? (
        <>
          <span>added to cycle</span>
          {cyclePill(a.to)}
        </>
      ) : (
        <>
          <span>removed from cycle</span>
          {cyclePill(a.from)}
        </>
      )
      break
    case 'estimate':
      body = a.to ? (
        <>
          <span>set estimate to</span>
          <Pill>{a.to} points</Pill>
        </>
      ) : (
        <span>removed the estimate</span>
      )
      break
    case 'dueDate':
      body = a.to ? (
        <>
          <span>set the due date to</span>
          <Pill>{formatFullDate(a.to)}</Pill>
        </>
      ) : (
        <span>removed the due date</span>
      )
      break
    case 'title':
      body = (
        <>
          <span>renamed to</span>
          <span className="font-medium text-fg">“{a.to}”</span>
        </>
      )
      break
    case 'parent':
      body = a.to ? (
        <>
          <span>set parent to</span>
          {issuePill(a.to)}
        </>
      ) : (
        <span>removed the parent issue</span>
      )
      break
    case 'link':
      // `from` holds the url (favicon), `to` the display text.
      body = (
        <>
          <span>linked</span>
          {a.from ? (
            <a
              href={a.from}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-fg hover:underline"
            >
              <LinkFavicon url={a.from} size={13} />
              {a.to}
            </a>
          ) : (
            <span className="font-medium text-fg">{a.to}</span>
          )}
        </>
      )
      break
    default:
      body = <span>updated the issue</span>
  }

  return (
    <div className="flex items-center gap-2 text-[12px] text-muted">
      <Avatar user={actor} size={18} />
      <span className="text-fg">{actor?.name}</span>
      <span className="flex flex-wrap items-center gap-1.5">{body}</span>
      <span className="text-faint">· {timeAgo(a.createdAt)}</span>
    </div>
  )
}
