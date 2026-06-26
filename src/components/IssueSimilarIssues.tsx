import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Issue } from '@/lib/types'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'

/** Words ignored when comparing titles — too common to signal similarity. */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'your', 'you', 'this', 'that', 'from', 'are',
  'was', 'were', 'has', 'have', 'had', 'will', 'would', 'should', 'could',
  'when', 'what', 'where', 'which', 'who', 'why', 'how', 'into', 'onto',
  'out', 'off', 'over', 'under', 'than', 'then', 'them', 'they', 'their',
  'our', 'its', 'his', 'her', 'all', 'any', 'not', 'but', 'can', 'get',
  'got', 'use', 'using', 'add', 'new', 'set', 'via',
])

/** Tokenize a title into lowercased words length ≥ 3, minus stopwords. */
function tokenize(title: string): Set<string> {
  const out = new Set<string>()
  for (const raw of title.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length >= 3 && !STOPWORDS.has(raw)) out.add(raw)
  }
  return out
}

/**
 * Linear's "Similar issues" — a read-only suggestion section surfacing the
 * issues most related to the current one. Purely derived: scored by title-word
 * overlap (plus a small nudge for shared project/label). Unlike IssueLinks /
 * IssueRelations this has no add button, and it hides entirely when empty.
 */
export function IssueSimilarIssues({
  issue,
  onOpenIssue,
}: {
  issue: Issue
  onOpenIssue?: (identifier: string) => void
}) {
  const issues = useStore((s) => s.issues)
  const states = useStore((s) => s.states)
  const [collapsed, setCollapsed] = useState(false)

  const similar = useMemo(() => {
    const selfTokens = tokenize(issue.title)
    if (selfTokens.size === 0) return []

    const selfLabels = new Set(issue.labelIds)
    const subIds = new Set(
      issues.filter((i) => i.parentId === issue.id).map((i) => i.id),
    )

    const scored: { other: Issue; score: number }[] = []
    for (const other of issues) {
      if (other.id === issue.id) continue
      if (other.triage) continue
      if (subIds.has(other.id)) continue
      if (issue.parentId && other.id === issue.parentId) continue

      let score = 0
      const otherTokens = tokenize(other.title)
      for (const w of otherTokens) if (selfTokens.has(w)) score += 1
      if (score < 1) continue // require at least one shared title word

      if (issue.projectId && other.projectId === issue.projectId) score += 0.5
      if (selfLabels.size && other.labelIds.some((l) => selfLabels.has(l)))
        score += 0.5

      scored.push({ other, score })
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 4).map((s) => s.other)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.id, issue.title, issue.projectId, issue.parentId, issue.labelIds, issues])

  if (similar.length === 0) return null

  const open = (other: Issue) => {
    if (onOpenIssue) onOpenIssue(other.identifier)
    else useStore.getState().setPeek(other.id)
  }

  return (
    <div className="mt-6">
      <div className="mb-1 flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1 rounded px-0.5 text-[12px] font-medium text-faint hover:text-fg"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          <Sparkles size={12} className="text-faint" />
          Similar issues
        </button>
      </div>

      {!collapsed && (
        <div className="divide-y divide-border rounded-md border border-border">
          {similar.map((other) => {
            const st = states.find((s) => s.id === other.stateId)
            return (
              <button
                key={other.id}
                onClick={() => open(other)}
                className="group flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-bg-hover"
              >
                {st && <StatusIcon type={st.type} color={st.color} />}
                <PriorityIcon priority={other.priority} />
                <span className="font-mono text-[11px] text-faint">
                  {other.identifier}
                </span>
                <span className="truncate text-[13px] text-fg">
                  {other.title}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
