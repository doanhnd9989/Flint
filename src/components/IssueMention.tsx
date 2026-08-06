import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useStore, useDisplayName } from '@/lib/store'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { PRIORITY_LABELS } from '@/lib/constants'
import { timeAgo } from '@/lib/utils'

/** How long the pointer must rest on a mention before the card appears. */
const OPEN_DELAY = 400
const CLOSE_DELAY = 120

/** The floating card Linear shows when you rest on an issue link. */
function PreviewCard({
  identifier,
  rect,
}: {
  identifier: string
  rect: DOMRect
}) {
  const store = useStore()
  const fmt = useDisplayName()
  const issue = store.issues.find((i) => i.identifier === identifier)
  if (!issue) return null

  const state = store.states.find((s) => s.id === issue.stateId)
  const assignee = store.users.find((u) => u.id === issue.assigneeId)
  const project = store.projects.find((p) => p.id === issue.projectId)
  const labels = store.labels.filter((l) => issue.labelIds.includes(l.id))

  const WIDTH = 340
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - WIDTH - 8))
  // Flip above the mention when there isn't room underneath it.
  const below = rect.bottom + 8
  const flip = below + 190 > window.innerHeight
  const top = flip ? Math.max(8, rect.top - 8) : below

  return createPortal(
    <div
      data-overlay="menu"
      style={{
        top,
        left,
        width: WIDTH,
        transform: flip ? 'translateY(-100%)' : undefined,
      }}
      className="pointer-events-none fixed z-50 rounded-lg border border-border bg-bg-elevated p-3 shadow-lg animate-pop"
    >
      <div className="flex items-center gap-2 text-[11px] text-faint">
        <span>{issue.identifier}</span>
        {project && (
          <span className="truncate">
            {project.icon} {project.name}
          </span>
        )}
        <span className="ml-auto shrink-0">{timeAgo(issue.updatedAt)}</span>
      </div>

      <div className="mt-1.5 flex items-start gap-2">
        {state && <span className="mt-0.5"><StatusIcon type={state.type} color={state.color} /></span>}
        <span className="text-[13px] font-medium leading-snug text-fg">{issue.title}</span>
      </div>

      {issue.description && (
        <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
          {issue.description.replace(/[#*`_~>\-]/g, ' ').replace(/\s+/g, ' ').trim()}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <PriorityIcon priority={issue.priority} />
          {PRIORITY_LABELS[issue.priority]}
        </span>
        <span className="flex items-center gap-1">
          <Avatar user={assignee} size={16} />
          {assignee ? fmt(assignee.name) : 'Unassigned'}
        </span>
        {labels.map((l) => (
          <span key={l.id} className="flex items-center gap-1 rounded-full border border-border px-1.5 py-px">
            <LabelDot color={l.color} />
            {l.name}
          </span>
        ))}
      </div>
    </div>,
    document.body,
  )
}

/**
 * An inline reference to another issue (Linear auto-links bare identifiers like
 * FLI-42 in descriptions and comments). Clicking opens the issue; resting on it
 * shows a preview card so you don't have to navigate away to remember what it is.
 */
export function IssueMention({ identifier }: { identifier: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLAnchorElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const exists = useStore((s) => s.issues.some((i) => i.identifier === identifier))

  function open() {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (ref.current) setRect(ref.current.getBoundingClientRect())
    }, OPEN_DELAY)
  }
  function close() {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setRect(null), CLOSE_DELAY)
  }

  // An identifier for an issue we don't have stays plain text.
  if (!exists) {
    return (
      <code className="rounded bg-bg-tertiary px-1 py-0.5 font-mono text-[12px]">{identifier}</code>
    )
  }

  return (
    <>
      <Link
        ref={ref}
        to={`/issue/${identifier}`}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onClick={(e) => e.stopPropagation()}
        className="rounded bg-bg-tertiary px-1 py-0.5 font-mono text-[12px] text-accent hover:underline"
      >
        {identifier}
      </Link>
      {rect && <PreviewCard identifier={identifier} rect={rect} />}
    </>
  )
}
