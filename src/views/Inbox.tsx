import { useNavigate } from 'react-router-dom'
import { useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { timeAgo, cn } from '@/lib/utils'
import { CheckCheck } from 'lucide-react'

export function Inbox() {
  const navigate = useNavigate()
  const { notifications, users, issues, markNotificationRead, markAllNotificationsRead } =
    useStoreShallow((s) => ({
      notifications: s.notifications,
      users: s.users,
      issues: s.issues,
      markNotificationRead: s.markNotificationRead,
      markAllNotificationsRead: s.markAllNotificationsRead,
    }))

  const sorted = [...notifications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Inbox"
        right={
          <button
            onClick={markAllNotificationsRead}
            className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover"
          >
            <CheckCheck size={13} /> Mark all read
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="flex h-full items-center justify-center text-faint">
            You're all caught up.
          </div>
        )}
        {sorted.map((n) => {
          const actor = users.find((u) => u.id === n.actorId)
          const issue = issues.find((i) => i.id === n.issueId)
          return (
            <button
              key={n.id}
              onClick={() => {
                markNotificationRead(n.id)
                if (issue) navigate(`/issue/${issue.identifier}`)
              }}
              className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left hover:bg-bg-hover"
            >
              {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
              {n.read && <span className="h-2 w-2 shrink-0" />}
              <Avatar user={actor} size={24} />
              <div className="flex-1">
                <div className={cn('text-[13px]', n.read ? 'text-muted' : 'text-fg')}>
                  <span className="font-medium">{actor?.name}</span> {n.body}{' '}
                  <span className="text-muted">{issue?.title}</span>
                </div>
                <div className="text-[11px] text-faint">
                  {issue?.identifier} · {timeAgo(n.createdAt)}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
