import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronDown, GripVertical, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useFeature } from '@/lib/auth'
import {
  SIDEBAR_VISIBILITY_LABELS,
  orderedSidebarItems,
  type SidebarItemDef,
} from '@/lib/constants'
import type { SidebarBadgeStyle, SidebarVisibility } from '@/lib/types'
import { Popover } from './ui/Popover'
import { cn, menuOverlayOpen } from '@/lib/utils'
import { sidebarItemIcon } from './sidebarIcons'

const BADGE_STYLES: { id: SidebarBadgeStyle; label: string; glyph: ReactNode }[] = [
  { id: 'count', label: 'Count', glyph: <span className="text-[11px] text-faint">1</span> },
  {
    id: 'dot',
    label: 'Dot',
    glyph: <span className="h-1.5 w-1.5 rounded-full bg-faint" />,
  },
]

/** The compact right-hand dropdown on each row (and the badge-style row). */
function RowMenu({
  value,
  options,
  onSelect,
}: {
  value: string
  options: { id: string; label: string; glyph?: ReactNode }[]
  onSelect: (id: string) => void
}) {
  const current = options.find((o) => o.id === value)
  return (
    <Popover
      align="end"
      width={168}
      trigger={
        <span className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg">
          {current?.glyph}
          {current?.label ?? value}
          <ChevronDown size={12} className="text-faint" />
        </span>
      }
    >
      {(close) => (
        <div>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onSelect(o.id)
                close()
              }}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
            >
              {o.glyph}
              <span className="flex-1 truncate">{o.label}</span>
              {o.id === value && <Check size={13} className="text-muted" />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}

/** One sortable row: drag handle · icon · label · visibility selector. */
function ItemRow({
  item,
  visibility,
  onVisibility,
}: {
  item: SidebarItemDef
  visibility: SidebarVisibility
  onVisibility: (v: SidebarVisibility) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key })
  // Rows that can't be hidden (Inbox) drop the "Don't show" option, like Linear.
  const options = (
    item.alwaysAvailable
      ? (['always', 'badged'] as const)
      : (['always', 'badged', 'hidden'] as const)
  ).map((v) => ({ id: v, label: SIDEBAR_VISIBILITY_LABELS[v] }))

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5',
        visibility === 'hidden' && 'opacity-50',
      )}
    >
      {/* Only the handle starts a drag, so the visibility menu stays clickable. */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-transparent group-hover:text-faint"
      >
        <GripVertical size={13} />
      </span>
      <span className="flex h-4 w-4 items-center justify-center text-faint">
        {sidebarItemIcon(item.key)}
      </span>
      <span className="flex-1 truncate text-[13px] text-fg">{item.label}</span>
      <RowMenu
        value={visibility}
        options={options}
        onSelect={(v) => onVisibility(v as SidebarVisibility)}
      />
    </div>
  )
}

/** Renders `children` only when the item's feature flag is enabled. */
function IfEnabled({ flag, children }: { flag?: string; children: ReactNode }) {
  const enabled = useFeature(flag ?? '')
  if (flag && !enabled) return null
  return <>{children}</>
}

function SectionBlock({
  title,
  section,
}: {
  title: string
  section: 'personal' | 'workspace'
}) {
  const prefs = useStore((s) => s.sidebarPrefs)
  const setVisibility = useStore((s) => s.setSidebarVisibility)
  const setOrder = useStore((s) => s.setSidebarOrder)
  const items = orderedSidebarItems(section, prefs.order[section])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const keys = items.map((i) => i.key)
    const from = keys.indexOf(String(active.id))
    const to = keys.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    setOrder(section, arrayMove(keys, from, to))
  }

  return (
    <div className="mt-4">
      <p className="px-1 pb-1 text-[12px] text-muted">{title}</p>
      <div className="rounded-lg border border-border bg-bg p-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.key)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item) => (
              <IfEnabled key={item.key} flag={item.flag}>
                <ItemRow
                  item={item}
                  visibility={prefs.visibility[item.key] ?? item.visibility}
                  onVisibility={(v) => setVisibility(item.key, v)}
                />
              </IfEnabled>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}

/**
 * Linear's "Customize sidebar" dialog (sidebar → More → Customize sidebar):
 * a default badge style plus per-row visibility + drag-reorder, grouped into
 * Personal and Workspace sections.
 */
export function CustomizeSidebarModal() {
  const open = useStore((s) => s.customizeSidebarOpen)
  const setOpen = useStore((s) => s.setCustomizeSidebarOpen)
  const badgeStyle = useStore((s) => s.sidebarPrefs.badgeStyle)
  const setBadgeStyle = useStore((s) => s.setSidebarBadgeStyle)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !menuOverlayOpen()) setOpen(false)
    }
    // Capture phase: a picker's own Escape handler is a React one, which
    // runs first and would unmount the menu before we could notice it.
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, setOpen])

  if (!open) return null

  return createPortal(
    <div
      data-overlay
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-20 animate-fade"
      onMouseDown={() => !menuOverlayOpen() && setOpen(false)}
    >
      <div
        className="max-h-[76vh] w-[420px] max-w-[92vw] overflow-y-auto rounded-xl border border-border bg-bg-elevated p-4 shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-medium text-fg">Customize sidebar</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
          >
            <X size={14} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
          <span className="flex-1 text-[13px] text-fg">Default badge style</span>
          <RowMenu
            value={badgeStyle}
            options={BADGE_STYLES}
            onSelect={(id) => setBadgeStyle(id as SidebarBadgeStyle)}
          />
        </div>

        <SectionBlock title="Personal" section="personal" />
        <SectionBlock title="Workspace" section="workspace" />
      </div>
    </div>,
    document.body,
  )
}
