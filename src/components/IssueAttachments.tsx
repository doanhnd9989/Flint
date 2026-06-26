import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Image as ImageIcon,
  FileText,
  Frame,
  Video,
  ExternalLink,
  X,
} from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import type { Attachment, Issue } from '@/lib/types'
import { Popover } from './ui/Popover'
import { Avatar } from './Avatar'
import { timeAgo } from '@/lib/utils'

type Kind = Attachment['kind']

const KIND_ICON: Record<Kind, typeof ImageIcon> = {
  image: ImageIcon,
  file: FileText,
  design: Frame,
  video: Video,
}

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: 'image', label: 'Image' },
  { value: 'file', label: 'File' },
  { value: 'design', label: 'Design' },
  { value: 'video', label: 'Video' },
]

/** Header filter: 'all' or a specific {@link Kind} to narrow the list by type. */
type KindFilter = 'all' | Kind

const fieldCls =
  'w-full rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-fg placeholder:text-faint outline-none focus:border-accent'

/**
 * Linear's "Attachments" section — files/designs/media attached to an issue,
 * sibling to the "Resources" links section ({@link IssueLinks}). We have no
 * upload backend, so an attachment is metadata (name + kind + optional URL)
 * the user adds manually. Mirrors IssueLinks' collapsible visual grammar; the
 * header (with the `+` add button) always renders so the first attachment can
 * be added even when the list is empty.
 */
export function IssueAttachments({ issue }: { issue: Issue }) {
  const attachments = useStore((s) => s.attachments)
  const users = useStore((s) => s.users)
  const { addAttachment, removeAttachment } = useStoreShallow((s) => ({
    addAttachment: s.addAttachment,
    removeAttachment: s.removeAttachment,
  }))
  const [collapsed, setCollapsed] = useState(false)
  const [filter, setFilter] = useState<KindFilter>('all')

  const all = attachments
    .filter((a) => a.issueId === issue.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  // Per-kind counts drive which filter chips are worth showing.
  const counts = all.reduce<Record<Kind, number>>(
    (acc, a) => {
      acc[a.kind] += 1
      return acc
    },
    { image: 0, file: 0, design: 0, video: 0 },
  )
  // Only offer a type filter once it can actually partition the list — i.e.
  // there are 2+ attachments spanning at least two kinds (matches Linear,
  // which hides the affordance when there's nothing to filter).
  const kindsPresent = KIND_OPTIONS.filter((o) => counts[o.value] > 0)
  const showFilter = all.length > 1 && kindsPresent.length > 1

  const items =
    filter === 'all' ? all : all.filter((a) => a.kind === filter)

  return (
    <div className="mt-6">
      <div className="mb-1 flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1 rounded px-0.5 text-[12px] font-medium text-faint hover:text-fg"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          Attachments
          {all.length > 0 && (
            <span className="text-faint">· {all.length}</span>
          )}
        </button>
        <Popover
          width={240}
          align="end"
          trigger={
            <span
              title="Add attachment"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-faint hover:bg-bg-hover hover:text-fg"
            >
              <Plus size={14} />
            </span>
          }
        >
          {(close) => (
            <AddForm
              onAdd={(input) => addAttachment(issue.id, input)}
              close={close}
            />
          )}
        </Popover>
      </div>

      {!collapsed && showFilter && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          <FilterChip
            label="All"
            count={all.length}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          {kindsPresent.map((o) => (
            <FilterChip
              key={o.value}
              label={o.label}
              count={counts[o.value]}
              active={filter === o.value}
              onClick={() => setFilter(o.value)}
            />
          ))}
        </div>
      )}

      {!collapsed && all.length > 0 && items.length === 0 && (
        <div className="rounded-md border border-border px-3 py-4 text-center text-[12px] text-faint">
          No {filter} attachments.
        </div>
      )}

      {!collapsed && items.length > 0 && (
        <div className="divide-y divide-border rounded-md border border-border">
          {items.map((att) => {
            const Icon = KIND_ICON[att.kind]
            const creator = users.find((u) => u.id === att.creatorId)
            return (
              <div
                key={att.id}
                className="group flex items-center gap-2.5 px-3 py-2 hover:bg-bg-hover"
              >
                <Icon size={16} className="shrink-0 text-faint" />
                {att.url ? (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-1 truncate text-[13px] font-medium text-fg hover:underline"
                  >
                    <span className="truncate">{att.name}</span>
                    <ExternalLink size={12} className="shrink-0 text-faint" />
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
                    {att.name}
                  </span>
                )}
                {att.size && (
                  <span className="shrink-0 text-[11px] text-faint">
                    {att.size}
                  </span>
                )}
                {creator && (
                  <span
                    className="shrink-0"
                    title={`Added by ${creator.name}`}
                  >
                    <Avatar user={creator} size={16} />
                  </span>
                )}
                <span className="shrink-0 text-[11px] text-faint">
                  {timeAgo(att.createdAt)}
                </span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  title="Remove attachment"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-selected hover:text-fg group-hover:opacity-100"
                >
                  <X size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** A single segmented filter chip in the header row (kind + its count). */
function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={
        'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ' +
        (active
          ? 'border-accent bg-accent/10 text-fg'
          : 'border-border text-muted hover:bg-bg-hover hover:text-fg')
      }
    >
      {label}
      <span className="text-faint">{count}</span>
    </button>
  )
}

/** Inline add form rendered inside the `+` popover. */
function AddForm({
  onAdd,
  close,
}: {
  onAdd: (input: { name: string; kind: Kind; url?: string }) => void
  close: () => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Kind>('file')
  const [url, setUrl] = useState('')

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ name: trimmed, kind, url: url.trim() || undefined })
    close()
  }

  return (
    <div className="flex flex-col gap-2 p-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        placeholder="Attachment name"
        className={fieldCls}
      />
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as Kind)}
        className={fieldCls}
      >
        {KIND_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        placeholder="URL (optional)"
        className={fieldCls}
      />
      <div className="flex justify-end gap-1.5">
        <button
          onClick={close}
          className="rounded-md px-2.5 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="rounded-md bg-accent px-2.5 py-1 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  )
}
