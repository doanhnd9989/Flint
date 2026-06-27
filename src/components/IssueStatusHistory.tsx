import { useStoreShallow, useDisplayName } from '@/lib/store'
import { timeAgo } from '@/lib/utils'

/** Condensed timeline of an issue's workflow-state transitions. */
export function IssueStatusHistory({ issueId }: { issueId: string }) {
  const { activities, states, users } = useStoreShallow((s) => ({
    activities: s.activities,
    states: s.states,
    users: s.users,
  }))
  const fmt = useDisplayName()

  const history = activities
    .filter((a) => a.issueId === issueId && a.kind === 'status')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  if (history.length === 0) return null

  return (
    <section>
      <h3 className="text-[11px] font-medium uppercase text-faint mb-2">
        Status history
      </h3>
      <ul className="space-y-1.5">
        {history.map((a) => {
          const fromState = states.find((x) => x.id === a.from)
          const toState = states.find((x) => x.id === a.to)
          const actor = users.find((u) => u.id === a.userId)
          const actorName = fmt(actor?.name)
          return (
            <li key={a.id} className="flex items-center gap-2 text-[12px]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: toState?.color }}
              />
              <span className="text-muted">
                {actorName} changed status from {fromState?.name ?? '—'} to{' '}
                <span className="text-fg">{toState?.name ?? '—'}</span>
              </span>
              <span className="ml-auto shrink-0 text-faint text-[11px]">
                {timeAgo(a.createdAt)}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
