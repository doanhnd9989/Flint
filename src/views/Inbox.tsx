import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, Clock, X, Settings2, AlarmClock } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { Popover } from '@/components/ui/Popover'
import { timeAgo, cn } from '@/lib/utils'
import type { NotificationType } from '@/lib/types'

const TYPE_LABEL: Record<NotificationType, string> = {
  assigned: 'Assignments',
  mention: 'Mentions',
  comment: 'Comments',
  status: 'Status changes',
  subscribed: 'Subscribed updates',
}

function isSnoozed(until: string | undefined, now: number) {
  return !!until && new Date(until).getTime() > now
}

function NotificationPrefsMenu() {
  const { notificationPrefs, setNotificationPref } = useStoreShallow((s) => ({
    notificationPrefs: s.notificationPrefs,
    setNotificationPref: s.setNotificationPref,
  }))
  return (
    <Popover
      align="end"
      width={240}
      trigger={
        <span className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover">
          <Settings2 size={13} /> Preferences
        </span>
      }
    >
      {() => (
        <div>
          <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-faint">
            Notify me about
          </div>
          {(Object.keys(TYPE_LABEL) as NotificationType[]).map((t) => (
            <label
              key={t}
              className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-fg hover:bg-bg-hover"
            >
              {TYPE_LABEL[t]}
              <input
                type="checkbox"
                checked={notificationPrefs[t]}
                onChange={(e) => setNotificationPref(t, e.target.checked)}
                className="accent-[var(--accent)]"
              />
            </label>
          ))}
        </div>
      )}
    </Popover>
  )
}

export function Inbox() {
  const navigate = useNavigate()
  const store = useStore()
  const [tab, setTab] = useState<'inbox' | 'snoozed'>('inbox')
  const now = Date.now()

  const all = [...store.notifications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  const list = all.filter((n) =>
    tab === 'snoozed' ? isSnoozed(n.snoozedUntil, now) : !isSnoozed(n.snoozedUntil, now),
  )

  const snooze = (id: string, ms: number) =>
    store.snoozeNotification(id, new Date(now + ms).toISOString())

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Inbox"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={store.markAllNotificationsRead}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover"
            >
              <CheckCheck size={13} /> Mark all read
            </button>
            <NotificationPrefsMenu />
          </div>
        }
      >
        <div className="flex items-center gap-1">
          {(['inbox', 'snoozed'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] capitalize text-muted hover:bg-bg-hover',
                tab === t && 'bg-bg-selected text-fg font-medium',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </ViewHeader>

      <div className="flex-1 overflow-y-auto">
        {list.length === 0 && (
          <div className="flex h-full items-center justify-center text-faint">
            {tab === 'snoozed' ? 'Nothing snoozed.' : "You're all caught up."}
          </div>
        )}
        {list.map((n) => {
          const actor = store.users.find((u) => u.id === n.actorId)
          const issue = store.issues.find((i) => i.id === n.issueId)
          return (
            <div
              key={n.id}
              className="group flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-bg-hover"
            >
              {!n.read && tab === 'inbox' ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
              ) : (
                <span className="h-2 w-2 shrink-0" />
              )}
              <button
                onClick={() => {
                  store.markNotificationRead(n.id)
                  if (issue) navigate(`/issue/${issue.identifier}`)
                }}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <Avatar user={actor} size={24} />
                <div className="flex-1">
                  <div className={cn('text-[13px]', n.read ? 'text-muted' : 'text-fg')}>
                    <span className="font-medium">{actor?.name}</span> {n.body}{' '}
                    <span className="text-muted">{issue?.title}</span>
                  </div>
                  <div className="text-[11px] text-faint">
                    {issue?.identifier} · {timeAgo(n.createdAt)}
                    {isSnoozed(n.snoozedUntil, now) &&
                      ` · snoozed until ${new Date(n.snoozedUntil!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })}`}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                {tab === 'snoozed' ? (
                  <button
                    onClick={() => store.unsnoozeNotification(n.id)}
                    title="Unsnooze"
                    className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-bg-selected hover:text-fg"
                  >
                    <AlarmClock size={15} />
                  </button>
                ) : (
                  <Popover
                    align="end"
                    width={160}
                    trigger={
                      <span className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-bg-selected hover:text-fg">
                        <Clock size={15} />
                      </span>
                    }
                  >
                    {(close) => (
                      <div>
                        {[
                          { label: 'In 1 hour', ms: 3_600_000 },
                          { label: 'Tomorrow', ms: 86_400_000 },
                          { label: 'Next week', ms: 7 * 86_400_000 },
                        ].map((o) => (
                          <button
                            key={o.label}
                            onClick={() => {
                              snooze(n.id, o.ms)
                              close()
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
                          >
                            <Clock size={13} className="text-faint" /> {o.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </Popover>
                )}
                <button
                  onClick={() => store.deleteNotification(n.id)}
                  title="Delete"
                  className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-bg-selected hover:text-[var(--priority-urgent)]"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
