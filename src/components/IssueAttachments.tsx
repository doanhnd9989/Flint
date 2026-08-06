import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Image as ImageIcon,
  FileText,
  Frame,
  Video,
  ExternalLink,
  Upload,
  X,
} from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import type { Attachment, Issue } from '@/lib/types'
import { Popover } from './ui/Popover'
import { Avatar } from './Avatar'
import { timeAgo, cn } from '@/lib/utils'
import { useIssueUpload } from '@/lib/useUpload'

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

/** An attachment we can show a real thumbnail for. */
const isPreviewable = (a: Attachment) =>
  a.kind === 'image' && !!a.url && (a.contentType?.startsWith('image/') ?? true)

/**
 * Linear's "Attachments" section — files/designs/media attached to an issue,
 * sibling to the "Resources" links section ({@link IssueLinks}). Files dropped
 * here or picked through the `+` menu are uploaded to the API and referenced by
 * URL; an attachment can also be a name plus a link the user typed. Mirrors
 * IssueLinks' collapsible visual grammar; the header always renders so the
 * first attachment can be added even when the list is empty.
 */
export function IssueAttachments({ issue }: { issue: Issue }) {
  const attachments = useStore((s) => s.attachments)
  const users = useStore((s) => s.users)
  const pendingUploads = useStore((s) => s.pendingUploads)
  const { addAttachment, removeAttachment, clearUpload } = useStoreShallow((s) => ({
    addAttachment: s.addAttachment,
    removeAttachment: s.removeAttachment,
    clearUpload: s.clearUpload,
  }))
  const [collapsed, setCollapsed] = useState(false)
  const [filter, setFilter] = useState<KindFilter>('all')
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<Attachment | null>(null)
  const upload = useIssueUpload(issue.id)

  const all = attachments
    .filter((a) => a.issueId === issue.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const pending = pendingUploads.filter((u) => u.issueId === issue.id)

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

  const items = filter === 'all' ? all : all.filter((a) => a.kind === filter)

  return (
    <div
      className="relative mt-6"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        // Only clear when the pointer actually left the section, not on the
        // dragleave fired as it crosses a child element.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        setDragging(false)
        upload(e.dataTransfer.files)
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1 rounded px-0.5 text-[12px] font-medium text-faint hover:text-fg"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          Attachments
          {all.length > 0 && <span className="text-faint">· {all.length}</span>}
        </button>
        <Popover
          width={260}
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
              onUpload={(files) => upload(files)}
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

      {!collapsed && all.length > 0 && items.length === 0 && pending.length === 0 && (
        <div className="rounded-md border border-border px-3 py-4 text-center text-[12px] text-faint">
          No {filter} attachments.
        </div>
      )}

      {!collapsed && (items.length > 0 || pending.length > 0) && (
        <div className="divide-y divide-border rounded-md border border-border">
          {items.map((att) => {
            const Icon = KIND_ICON[att.kind]
            const creator = users.find((u) => u.id === att.creatorId)
            return (
              <div
                key={att.id}
                className="group flex items-center gap-2.5 px-3 py-2 hover:bg-bg-hover"
              >
                {isPreviewable(att) ? (
                  <button
                    type="button"
                    onClick={() => setPreview(att)}
                    title="Preview"
                    className="h-8 w-8 shrink-0 overflow-hidden rounded border border-border"
                  >
                    <img src={att.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ) : (
                  <Icon size={16} className="shrink-0 text-faint" />
                )}
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
                  <span className="shrink-0 text-[11px] text-faint">{att.size}</span>
                )}
                {creator && (
                  <span className="shrink-0" title={`Added by ${creator.name}`}>
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

          {pending.map((u) => (
            <div key={u.id} className="flex items-center gap-2.5 px-3 py-2">
              <Upload size={16} className="shrink-0 text-faint" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-fg">{u.name}</div>
                {u.error ? (
                  <div className="text-[11px] text-[var(--priority-urgent)]">{u.error}</div>
                ) : (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-bg-tertiary">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${Math.round(u.progress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <span className="shrink-0 text-[11px] text-faint">
                {u.error ? 'Failed' : `${Math.round(u.progress * 100)}%`}
              </span>
              {u.error && (
                <button
                  onClick={() => clearUpload(u.id)}
                  title="Dismiss"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint hover:bg-bg-selected hover:text-fg"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-accent bg-accent-subtle text-[12px] font-medium text-accent">
          Drop files to attach
        </div>
      )}

      {preview && <Lightbox attachment={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

/** Full-size image preview, dismissed with Escape or a click anywhere. */
function Lightbox({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div
      data-overlay
      onMouseDown={onClose}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-bg-scrim p-10 animate-fade"
    >
      <img
        src={attachment.url}
        alt={attachment.name}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[80vh] max-w-full rounded-lg border border-border object-contain shadow-lg"
      />
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <span>{attachment.name}</span>
        {attachment.size && <span className="text-faint">{attachment.size}</span>}
      </div>
    </div>,
    document.body,
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
      className={cn(
        'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        active
          ? 'border-accent bg-accent/10 text-fg'
          : 'border-border text-muted hover:bg-bg-hover hover:text-fg',
      )}
    >
      {label}
      <span className="text-faint">{count}</span>
    </button>
  )
}

/**
 * The `+` popover: upload real files, or record an attachment that lives
 * somewhere else (a Figma frame, a shared drive) as a name plus a link.
 */
function AddForm({
  onUpload,
  onAdd,
  close,
}: {
  onUpload: (files: FileList) => void
  onAdd: (input: { name: string; kind: Kind; url?: string }) => void
  close: () => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Kind>('file')
  const [url, setUrl] = useState('')
  const input = useRef<HTMLInputElement>(null)

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ name: trimmed, kind, url: url.trim() || undefined })
    close()
  }

  return (
    <div className="flex flex-col gap-2 p-1">
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            onUpload(e.target.files)
            close()
          }
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-fg hover:bg-bg-hover"
      >
        <Upload size={14} className="text-faint" />
        Upload file…
      </button>

      <div className="flex items-center gap-2 px-0.5">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] text-faint">or link to one</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <input
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
