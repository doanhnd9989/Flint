import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { RelationPickerKind } from '@/lib/types'
import { StatusIcon } from './StatusIcon'
import { cn } from '@/lib/utils'

/** Per-kind palette title / search placeholder, matching Linear's wording. */
const KIND_LABEL: Record<RelationPickerKind, string> = {
  parentOf: 'Parent of',
  subIssueOf: 'Sub-issue of',
  related: 'Related to',
  blockedBy: 'Blocked by',
  blocking: 'Blocking',
  duplicateOf: 'Duplicate of',
}

/**
 * Linear's "Mark as" centered command palette — links the current issue to an
 * existing one. Opened from the issue ⋯ menu ("Mark as" flyout) and the
 * `M`-chord / ⌘⇧P keyboard shortcuts via `store.relationPicker`. The store's
 * `setIssueParent` cycle guard keeps parent/sub-issue linking safe.
 */
export function RelationPicker() {
  const store = useStore()
  const picker = store.relationPicker
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset the search whenever a fresh picker opens.
  useEffect(() => {
    setQuery('')
    setActive(0)
  }, [picker?.issueId, picker?.kind])

  if (!picker) return null
  const issue = store.issues.find((i) => i.id === picker.issueId)
  if (!issue) return null

  const close = () => store.closeRelationPicker()

  const apply = (targetId: string) => {
    switch (picker.kind) {
      case 'parentOf':
        store.setIssueParent(targetId, issue.id)
        break
      case 'subIssueOf':
        store.setIssueParent(issue.id, targetId)
        break
      case 'related':
        store.addRelation(issue.id, targetId, 'related')
        break
      case 'blockedBy':
        store.addRelation(targetId, issue.id, 'blocks')
        break
      case 'blocking':
        store.addRelation(issue.id, targetId, 'blocks')
        break
      case 'duplicateOf':
        store.addRelation(issue.id, targetId, 'duplicate')
        break
    }
    close()
  }

  // Existing-issue candidates (self + triage excluded, like the ⋯ menu).
  const candidates = store.issues.filter(
    (i) => i.id !== issue.id && !i.triage,
  )
  const q = query.toLowerCase()
  const filtered = q
    ? candidates.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.identifier.toLowerCase().includes(q),
      )
    : candidates

  const label = KIND_LABEL[picker.kind]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-[15vh] animate-fade"
      onMouseDown={close}
    >
      <div
        data-overlay
        className="w-[600px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            close()
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (filtered[active]) apply(filtered[active].id)
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search size={16} className="text-faint" />
          <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-bg-hover py-1 pl-2 pr-1 text-[12px] text-fg">
            <span className="font-medium text-muted">{issue.identifier}</span>
            <span className="max-w-40 truncate text-muted">{issue.title}</span>
            <button
              type="button"
              onClick={close}
              className="flex h-4 w-4 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
              aria-label="Cancel"
            >
              <X size={12} />
            </button>
          </span>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder={`${label}…`}
            className="flex-1 bg-transparent text-[14px] text-fg outline-none"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-[13px] text-faint">No issues found</div>
          )}
          {filtered.map((i, idx) => {
            const st = store.states.find((s) => s.id === i.stateId)!
            return (
              <button
                key={i.id}
                type="button"
                onMouseEnter={() => setActive(idx)}
                onClick={() => apply(i.id)}
                className={cn(
                  'flex w-full items-center gap-2 px-4 py-1.5 text-left text-[13px] text-fg',
                  idx === active && 'bg-bg-hover',
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <StatusIcon type={st.type} color={st.color} />
                </span>
                <span className="flex-1 truncate">{i.title}</span>
                <span className="shrink-0 text-[12px] text-faint">
                  {i.identifier}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
