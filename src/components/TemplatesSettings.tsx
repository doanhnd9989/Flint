import { useState } from 'react'
import { Trash2, FileText } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import type { Priority } from '@/lib/types'
import { PriorityPicker, LabelPicker } from './pickers'
import { PriorityIcon } from './PriorityIcon'
import { LabelDot } from './LabelChip'
import { PRIORITY_LABELS } from '@/lib/constants'

export function TemplatesSettings() {
  const { templates, labels, teams, createTemplate, deleteTemplate } = useStoreShallow((s) => ({
    templates: s.templates,
    labels: s.labels,
    teams: s.teams,
    createTemplate: s.createTemplate,
    deleteTemplate: s.deleteTemplate,
  }))

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>(0)
  const [labelIds, setLabelIds] = useState<string[]>([])

  function add() {
    if (!name.trim()) return
    createTemplate({
      name: name.trim(),
      teamId: teams[0].id,
      title,
      description,
      priority,
      labelIds,
    })
    setName('')
    setTitle('')
    setDescription('')
    setPriority(0)
    setLabelIds([])
  }

  return (
    <div className="space-y-1">
      {templates.map((t) => (
        <div key={t.id} className="group flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-bg-hover">
          <FileText size={15} className="text-faint" />
          <div className="flex-1">
            <div className="text-[13px] text-fg">{t.name}</div>
            <div className="truncate text-[11px] text-faint">
              {t.title || 'Untitled'} · {PRIORITY_LABELS[t.priority]}
              {t.labelIds.length ? ` · ${t.labelIds.length} label${t.labelIds.length > 1 ? 's' : ''}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete template "${t.name}"?`)) deleteTemplate(t.id)
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-faint opacity-0 hover:text-[var(--priority-urgent)] group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div className="mt-2 space-y-2 rounded-lg border border-border p-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name (e.g. Bug report)"
          className="w-full bg-transparent text-[13px] font-medium text-fg outline-none"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Default issue title"
          className="w-full bg-transparent text-[13px] text-fg outline-none"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Default description (markdown)…"
          className="min-h-14 w-full resize-none bg-transparent text-[12px] text-muted outline-none"
        />
        <div className="flex items-center gap-1.5">
          <PriorityPicker
            priority={priority}
            onChange={setPriority}
            trigger={
              <span className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:bg-bg-hover">
                <PriorityIcon priority={priority} />
                {PRIORITY_LABELS[priority]}
              </span>
            }
          />
          <LabelPicker
            labelIds={labelIds}
            onToggle={(id) =>
              setLabelIds((ids) =>
                ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
              )
            }
            trigger={
              <span className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:bg-bg-hover">
                {labelIds.length ? (
                  <>
                    {labelIds.slice(0, 3).map((id) => {
                      const l = labels.find((x) => x.id === id)!
                      return <LabelDot key={id} color={l.color} />
                    })}
                    {labelIds.length} label{labelIds.length > 1 ? 's' : ''}
                  </>
                ) : (
                  'Labels'
                )}
              </span>
            }
          />
          <div className="flex-1" />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={add}
            className="rounded-md bg-accent px-2.5 py-1 text-[12px] text-white disabled:opacity-40 hover:bg-accent-hover"
          >
            Add template
          </button>
        </div>
      </div>
    </div>
  )
}
