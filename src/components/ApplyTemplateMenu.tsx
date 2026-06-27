import { useStore } from '@/lib/store'

const rowCls =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

/**
 * "Apply template" submenu — Linear's ⋯ → Apply template. Populates the issue's
 * title / description / priority / labels from a saved {@link IssueTemplate}.
 * Reuses the existing per-property store actions (no new mutations); labels are
 * applied additively via toggleIssueLabel for any template label not already on
 * the issue. Templates carrying a teamId for the issue's team float to the top.
 */
export function ApplyTemplateMenu({
  issueId,
  onClose,
}: {
  issueId: string
  onClose?: () => void
}) {
  const templates = useStore((s) => s.templates)
  const issue = useStore((s) => s.issues.find((i) => i.id === issueId))
  const teams = useStore((s) => s.teams)
  const setIssueTitle = useStore((s) => s.setIssueTitle)
  const setIssueDescription = useStore((s) => s.setIssueDescription)
  const setIssuePriority = useStore((s) => s.setIssuePriority)
  const toggleIssueLabel = useStore((s) => s.toggleIssueLabel)

  if (!issue) return null

  // Team-matching templates first, then the rest (Linear shows all teams' too).
  const ordered = [...templates].sort((a, b) => {
    const am = a.teamId === issue.teamId ? 0 : 1
    const bm = b.teamId === issue.teamId ? 0 : 1
    return am - bm || a.name.localeCompare(b.name)
  })

  const apply = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return
    setIssueTitle(issue.id, tpl.title)
    setIssueDescription(issue.id, tpl.description)
    setIssuePriority(issue.id, tpl.priority)
    // Add each template label the issue doesn't already carry.
    for (const labelId of tpl.labelIds) {
      if (!issue.labelIds.includes(labelId)) toggleIssueLabel(issue.id, labelId)
    }
    onClose?.()
  }

  // Renders the bare rows — the host (a SubRow flyout) provides the panel chrome.
  return (
    <>
      {ordered.length === 0 ? (
        <div className="px-2 py-1.5 text-[13px] text-faint">No templates</div>
      ) : (
        ordered.map((tpl) => {
          const team = teams.find((t) => t.id === tpl.teamId)
          return (
            <button key={tpl.id} type="button" onClick={() => apply(tpl.id)} className={rowCls}>
              <span className="flex-1 truncate">{tpl.name}</span>
              {team && (
                <span className="ml-auto pl-3 text-[12px] tracking-wide text-faint">{team.key}</span>
              )}
            </button>
          )
        })
      )}
    </>
  )
}
