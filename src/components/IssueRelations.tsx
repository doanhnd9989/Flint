import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { Issue, RelationType } from '@/lib/types'
import { issueUrl } from '@/lib/utils'
import { copyToClipboard } from '@/lib/toast'
import { StatusIcon } from './StatusIcon'
import { SelectMenu, type SelectOption } from './ui/SelectMenu'
import { X, Plus, ChevronDown, ChevronRight, Link2 } from 'lucide-react'

interface RelRow {
  relationId: string
  other: Issue
}

/**
 * Each add action knows the relation it creates *and* which `RelRow[]` already
 * holds that exact relation, so the picker can hide issues already linked that
 * way — Linear never offers a no-op target in a relation menu.
 */
type BucketKey =
  | 'blocking'
  | 'blockedBy'
  | 'related'
  | 'duplicateOf'
  | 'duplicatedBy'

type AddKind = {
  label: string
  // Buckets to exclude as targets — includes the OPPOSITE bucket so a picker
  // never offers an issue that already holds the contradictory relation
  // (e.g. "Duplicate of" must not offer something already "Duplicated by").
  exclude: ReadonlyArray<BucketKey>
  apply: (selfId: string, targetId: string) => [string, string, RelationType]
}

const ADD_KINDS: AddKind[] = [
  { label: 'Blocking', exclude: ['blocking', 'blockedBy'], apply: (s, t) => [s, t, 'blocks'] },
  { label: 'Blocked by', exclude: ['blockedBy', 'blocking'], apply: (s, t) => [t, s, 'blocks'] },
  { label: 'Related', exclude: ['related'], apply: (s, t) => [s, t, 'related'] },
  { label: 'Duplicate of', exclude: ['duplicateOf', 'duplicatedBy'], apply: (s, t) => [s, t, 'duplicate'] },
]

function Group({
  title,
  rows,
  onOpen,
  onRemove,
}: {
  title: string
  rows: RelRow[]
  onOpen: (identifier: string) => void
  onRemove: (relationId: string) => void
}) {
  const states = useStore((s) => s.states)
  if (rows.length === 0) return null
  return (
    <div className="mb-2">
      <div className="mb-1 text-[11px] font-medium text-faint">{title}</div>
      <div className="divide-y divide-border rounded-md border border-border">
        {rows.map(({ relationId, other }) => {
          const st = states.find((s) => s.id === other.stateId)!
          return (
            <div key={relationId} className="group flex items-center gap-2 px-3 py-1.5">
              <button
                onClick={() => onOpen(other.identifier)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <StatusIcon type={st.type} color={st.color} />
                <span className="font-mono text-[11px] text-faint">{other.identifier}</span>
                <span className="truncate text-[13px] text-fg">{other.title}</span>
              </button>
              <button
                onClick={() =>
                  copyToClipboard(
                    `[${other.identifier} ${other.title}](${issueUrl(other.identifier)})`,
                    'Markdown link copied to clipboard',
                  )
                }
                className="text-faint opacity-0 hover:text-fg group-hover:opacity-100"
                title="Copy as Markdown link"
              >
                <Link2 size={13} />
              </button>
              <button
                onClick={() => onRemove(relationId)}
                className="text-faint opacity-0 hover:text-[var(--priority-urgent)] group-hover:opacity-100"
                title="Remove relation"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** blocks / blocked-by / related / duplicate relations for an issue. */
export function IssueRelations({
  issue,
  onOpenIssue,
}: {
  issue: Issue
  onOpenIssue: (identifier: string) => void
}) {
  const store = useStore()
  const [collapsed, setCollapsed] = useState(false)
  const byId = (id: string) => store.issues.find((i) => i.id === id)

  const blocking: RelRow[] = []
  const blockedBy: RelRow[] = []
  const related: RelRow[] = []
  const duplicateOf: RelRow[] = []
  const duplicatedBy: RelRow[] = []

  for (const r of store.relations) {
    if (r.type === 'blocks') {
      if (r.fromIssueId === issue.id) {
        const o = byId(r.toIssueId)
        if (o) blocking.push({ relationId: r.id, other: o })
      } else if (r.toIssueId === issue.id) {
        const o = byId(r.fromIssueId)
        if (o) blockedBy.push({ relationId: r.id, other: o })
      }
    } else if (r.type === 'related') {
      if (r.fromIssueId === issue.id || r.toIssueId === issue.id) {
        const otherId = r.fromIssueId === issue.id ? r.toIssueId : r.fromIssueId
        const o = byId(otherId)
        if (o) related.push({ relationId: r.id, other: o })
      }
    } else if (r.type === 'duplicate') {
      if (r.fromIssueId === issue.id) {
        const o = byId(r.toIssueId)
        if (o) duplicateOf.push({ relationId: r.id, other: o })
      } else if (r.toIssueId === issue.id) {
        const o = byId(r.fromIssueId)
        if (o) duplicatedBy.push({ relationId: r.id, other: o })
      }
    }
  }

  const total =
    blocking.length + blockedBy.length + related.length + duplicateOf.length + duplicatedBy.length

  // Issues already linked in a given bucket, so each picker can omit them
  // (Linear never lets you re-add an existing relation as a no-op).
  const buckets = { blocking, blockedBy, related, duplicateOf, duplicatedBy } as const
  const linkedIds = (exclude: ReadonlyArray<BucketKey>) =>
    new Set(exclude.flatMap((b) => buckets[b].map((r) => r.other.id)))

  const optionFor = (i: Issue): SelectOption => {
    const st = store.states.find((s) => s.id === i.stateId)!
    return {
      id: i.id,
      label: i.title,
      hint: i.identifier,
      keywords: `${i.identifier} ${i.title}`,
      icon: <StatusIcon type={st.type} color={st.color} />,
    }
  }

  const optionsFor = (kind: AddKind): SelectOption[] => {
    const exclude = linkedIds(kind.exclude)
    return store.issues
      .filter((i) => i.id !== issue.id && !exclude.has(i.id))
      .map(optionFor)
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1 rounded px-0.5 text-[12px] font-medium text-faint hover:text-fg"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          Relations
          {total > 0 && <span className="text-faint">· {total}</span>}
        </button>
        <div className="flex items-center gap-1">
          {ADD_KINDS.map((k) => (
            <SelectMenu
              key={k.label}
              options={optionsFor(k)}
              onSelect={(targetId) => {
                const [from, to, type] = k.apply(issue.id, targetId)
                store.addRelation(from, to, type)
              }}
              placeholder={`${k.label}…`}
              width={260}
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:bg-bg-hover">
                  <Plus size={11} />
                  {k.label}
                </span>
              }
            />
          ))}
        </div>
      </div>

      {!collapsed &&
        (total === 0 ? (
          <div className="text-[12px] text-faint">No relations.</div>
        ) : (
          <>
            <Group title="Blocking" rows={blocking} onOpen={onOpenIssue} onRemove={store.removeRelation} />
            <Group title="Blocked by" rows={blockedBy} onOpen={onOpenIssue} onRemove={store.removeRelation} />
            <Group title="Related" rows={related} onOpen={onOpenIssue} onRemove={store.removeRelation} />
            <Group title="Duplicate of" rows={duplicateOf} onOpen={onOpenIssue} onRemove={store.removeRelation} />
            <Group title="Duplicated by" rows={duplicatedBy} onOpen={onOpenIssue} onRemove={store.removeRelation} />
          </>
        ))}
    </div>
  )
}
