import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRightLeft, Check } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { toast } from '@/lib/toast'

/**
 * Linear's "Move to team" modal (issue ⋯ → Move to team…). Picks a destination
 * team for the active issue; moving re-keys the issue into that team's sequence
 * (it gets a brand-new identifier like "ENG-N"). Mirrors AddLinkModal's
 * portal/overlay/Esc pattern.
 */
export function MoveIssueModal() {
  const { moveIssueId, issues, teams } = useStoreShallow((s) => ({
    moveIssueId: s.moveIssueId,
    issues: s.issues,
    teams: s.teams,
  }))
  const closeMoveIssue = useStore((s) => s.closeMoveIssue)
  const moveIssueToTeam = useStore((s) => s.moveIssueToTeam)

  const issue = issues.find((i) => i.id === moveIssueId)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && moveIssueId) closeMoveIssue()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [moveIssueId, closeMoveIssue])

  if (!moveIssueId || !issue) return null

  function pick(teamId: string) {
    if (!issue || teamId === issue.teamId) return
    const team = teams.find((t) => t.id === teamId)
    moveIssueToTeam(issue.id, teamId)
    if (team) toast(`Moved to ${team.name}`)
    closeMoveIssue()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-32 animate-fade"
      onMouseDown={() => closeMoveIssue()}
    >
      <div
        className="w-[460px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated p-5 shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-fg">
          <ArrowRightLeft size={15} className="text-faint" />
          {`Move ${issue.identifier} to team`}
          <button
            type="button"
            onClick={() => closeMoveIssue()}
            className="ml-auto rounded-md p-1 text-faint hover:bg-bg-hover hover:text-muted"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mb-3 truncate text-[13px] text-muted" title={issue.title}>
          {issue.title}
        </div>

        <div className="-mx-1 max-h-[320px] overflow-y-auto">
          {teams.map((team) => {
            const current = team.id === issue.teamId
            return (
              <button
                key={team.id}
                type="button"
                disabled={current}
                onClick={() => pick(team.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px] ${
                  current
                    ? 'cursor-default text-muted'
                    : 'text-fg hover:bg-bg-hover'
                }`}
              >
                <span className="text-[15px] leading-none" style={{ color: team.color }}>
                  {team.icon}
                </span>
                <span className="truncate font-medium">{team.name}</span>
                <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[11px] font-medium text-muted">
                  {team.key}
                </span>
                {current && (
                  <span className="ml-auto flex items-center gap-1 text-[12px] text-faint">
                    <Check size={13} />
                    Current
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-3 border-t border-border pt-3 text-[12px] text-faint">
          The issue will get a new identifier in the destination team (e.g.{' '}
          <span className="text-muted">
            {(teams.find((t) => t.id !== issue.teamId)?.key ?? issue.identifier.split('-')[0])}-N
          </span>
          ).
        </div>
      </div>
    </div>,
    document.body,
  )
}
