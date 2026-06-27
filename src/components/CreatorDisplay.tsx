import { useStore, useDisplayName } from '@/lib/store'
import { Avatar } from './Avatar'

/**
 * The optional "Creator" display property — an avatar of the user who created
 * the issue, mirroring Linear's display column. It self-gates on the
 * `displayProperties.creator` toggle so callers can mount it unconditionally in
 * a list row or board card; it renders nothing when the toggle is off or the
 * creator can't be resolved. The avatar matches the size of the assignee chip
 * in `IssueRow` / `IssueBoard`, with a "Created by …" tooltip.
 */
export function CreatorDisplay({ issueId }: { issueId: string }) {
  const show = useStore((s) => s.displayProperties.creator)
  const issues = useStore((s) => s.issues)
  const users = useStore((s) => s.users)
  const fmt = useDisplayName()

  const issue = issues.find((i) => i.id === issueId)
  const creator = issue ? users.find((u) => u.id === issue.creatorId) : undefined
  if (!show || !creator) return null

  return (
    <span
      className="flex items-center"
      title={`Created by ${fmt(creator.name)}`}
    >
      <Avatar user={creator} size={18} />
    </span>
  )
}
