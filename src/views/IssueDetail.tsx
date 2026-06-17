import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { IssueDetailBody } from '@/components/IssueDetailBody'
import { StarButton } from '@/components/StarButton'
import { Trash2, Link2 } from 'lucide-react'

export function IssueDetail() {
  const { identifier } = useParams()
  const navigate = useNavigate()
  const store = useStore()
  const issue = store.issues.find((i) => i.identifier === identifier)

  if (!issue) {
    return (
      <div className="flex h-full items-center justify-center text-faint">
        Issue not found
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-[13px]">
        <button onClick={() => navigate(-1)} className="text-muted hover:text-fg">
          {store.teams.find((t) => t.id === issue.teamId)?.name}
        </button>
        <span className="text-faint">›</span>
        <span className="font-mono text-faint">{issue.identifier}</span>
        <div className="flex-1" />
        <StarButton type="issue" id={issue.id} />
        <button
          title="Copy link"
          onClick={() => navigator.clipboard?.writeText(issue.identifier)}
          className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover"
        >
          <Link2 size={15} />
        </button>
        <button
          title="Delete issue"
          onClick={() => {
            store.deleteIssue(issue.id)
            navigate(-1)
          }}
          className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
        >
          <Trash2 size={15} />
        </button>
      </header>

      <IssueDetailBody
        issue={issue}
        onOpenIssue={(id) => navigate(`/issue/${id}`)}
      />
    </div>
  )
}
