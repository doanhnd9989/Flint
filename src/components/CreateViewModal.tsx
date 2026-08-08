import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { menuOverlayOpen } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { LayoutList, LayoutGrid, Group, ArrowUpDown, Filter } from 'lucide-react'
import { useStore } from '@/lib/store'
import { SelectMenu } from './ui/SelectMenu'
import type { SelectOption } from './ui/SelectMenu'
import type { GroupBy, OrderBy, FilterState } from '@/lib/types'

const chip =
  'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted'

// A small palette of view-flavored emoji to pick the view icon from.
const ICONS = ['🔭', '📋', '⭐', '🎯', '🗂️', '🔍', '📌', '🧭', '⚡', '🔥', '🌊', '🧩']

const GROUP_LABEL: Record<GroupBy, string> = {
  status: 'Status',
  assignee: 'Assignee',
  creator: 'Creator',
  priority: 'Priority',
  project: 'Project',
  label: 'Label',
  cycle: 'Cycle',
  milestone: 'Milestone',
  none: 'No grouping',
}

const ORDER_LABEL: Record<OrderBy, string> = {
  manual: 'Manual',
  title: 'Title',
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  estimate: 'Estimate',
  updated: 'Last updated',
  created: 'Created',
  dueDate: 'Due date',
  linkCount: 'Links',
}

/** Count how many filter dimensions carry a value, for the read-only summary. */
function countFilters(f: FilterState): number {
  let n = 0
  n += f.statusIds.length
  n += f.assigneeIds.length
  n += f.priorities.length
  n += f.labelIds.length
  n += f.projectIds.length
  n += f.creatorIds?.length ?? 0
  n += f.subscriberIds?.length ?? 0
  n += f.cycleIds?.length ?? 0
  n += f.milestoneIds?.length ?? 0
  n += f.dates?.length ?? 0
  if (f.text?.trim()) n += 1
  return n
}

export function CreateViewModal() {
  const navigate = useNavigate()
  const store = useStore()
  const config = store.viewModalConfig

  const [icon, setIcon] = useState('🔭')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (config) {
      setIcon('🔭')
      setName('')
      setDescription('')
    }
  }, [config])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && config && !menuOverlayOpen()) store.closeViewModal()
    }
    // Capture phase: a picker's own Escape handler is a React one, which
    // runs first and would unmount the menu before we could notice it.
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [config, store])

  if (!config) return null

  const iconOptions: SelectOption[] = ICONS.map((e) => ({
    id: e,
    label: e,
    icon: <span className="text-base">{e}</span>,
    selected: e === icon,
  }))

  const filterCount = countFilters(config.filters)

  function submit() {
    if (!name.trim() || !config) return
    const view = store.createView({
      ...config,
      name: name.trim(),
      icon,
      ...(description.trim() ? { description: description.trim() } : {}),
    })
    store.closeViewModal()
    navigate(`/view/${view.id}`)
  }

  return createPortal(
    <div
      data-overlay
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-24 animate-fade"
      onMouseDown={() => !menuOverlayOpen() && store.closeViewModal()}
    >
      <div
        className="w-[480px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[12px] text-muted">
          <span className="rounded-md bg-bg-tertiary px-1.5 py-0.5">{store.workspaceName}</span>
          <span>Save view</span>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-start gap-2">
            <SelectMenu
              width={160}
              options={iconOptions}
              onSelect={setIcon}
              placeholder="Icon…"
              trigger={
                <span className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-bg-hover">
                  {icon}
                </span>
              }
            />
            <div className="flex-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="View name"
                className="mt-0.5 w-full bg-transparent text-[16px] font-medium text-fg outline-none"
              />
              {/* Linear's view editor carries a second, optional line. */}
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="mt-1 w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
              />
            </div>
          </div>

          {/* Read-only summary of the captured layout / grouping / filters. */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className={chip}>
              {config.layout === 'board' ? (
                <LayoutGrid size={13} />
              ) : (
                <LayoutList size={13} />
              )}
              {config.layout === 'board' ? 'Board' : 'List'}
            </span>
            <span className={chip}>
              <Group size={13} />
              {GROUP_LABEL[config.groupBy]}
            </span>
            <span className={chip}>
              <ArrowUpDown size={13} />
              {ORDER_LABEL[config.orderBy]}
            </span>
            <span className={chip}>
              <Filter size={13} />
              {filterCount === 0
                ? 'No filters'
                : `${filterCount} filter${filterCount === 1 ? '' : 's'}`}
            </span>
          </div>
          <p className="mt-2 text-[12px] text-faint">
            The current layout, grouping, ordering and filters are saved into this view.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={() => store.closeViewModal()}
            className="rounded-md px-3 py-1.5 text-[13px] text-muted hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={submit}
            className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
