import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { StatusIcon } from './StatusIcon'

/**
 * Linear's inline "Create new sub-issue" input. Replaces the modal flow: typing
 * a title and pressing Enter creates a sub-issue (inheriting the parent's team
 * and project) and keeps the input open to add another. Esc (or blurring an
 * empty input) closes it. Controlled open/close by the parent so it can be
 * triggered from the "Create new sub-issue" menu item.
 */
export function SubIssueCreator({
  parent,
  onClose,
}: {
  parent: Issue
  onClose: () => void
}) {
  const store = useStore()
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // The state a freshly-created issue lands in, just for the leading glyph.
  const newState = store.states.find((s) => s.type === 'unstarted')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = () => {
    const t = title.trim()
    if (!t) return
    store.createIssue({
      title: t,
      teamId: parent.teamId,
      parentId: parent.id,
      projectId: parent.projectId,
    })
    setTitle('')
    // Stay open to add more — refocus for rapid entry.
    inputRef.current?.focus()
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
      {newState && <StatusIcon type={newState.type} color={newState.color} />}
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
        onBlur={() => {
          if (!title.trim()) onClose()
        }}
        placeholder="Sub-issue title…"
        className="flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
      />
    </div>
  )
}
