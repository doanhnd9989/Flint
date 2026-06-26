import { useMemo, useState } from 'react'
import { Search, Trash2, UserPlus } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Avatar } from './Avatar'

const ROLES: UserRole[] = ['admin', 'member', 'guest']

// Role filter segment options ("all" plus one tab per role).
type RoleFilter = 'all' | UserRole
const FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'admin', label: 'Admins' },
  { value: 'member', label: 'Members' },
  { value: 'guest', label: 'Guests' },
]

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: UserRole
  onChange: (r: UserRole) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as UserRole)}
      className="rounded-md border border-border bg-bg px-1.5 py-0.5 text-[12px] capitalize text-muted outline-none disabled:opacity-60"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  )
}

export function MembersSettings() {
  const { users, setUserRole, inviteMember, removeUser, setUserSuspended } = useStoreShallow((s) => ({
    users: s.users,
    setUserRole: s.setUserRole,
    inviteMember: s.inviteMember,
    removeUser: s.removeUser,
    setUserSuspended: s.setUserSuspended,
  }))

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('member')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RoleFilter>('all')

  // Count summary across all members (independent of the active filter/search).
  const counts = useMemo(() => {
    let admins = 0
    let guests = 0
    for (const u of users) {
      if (u.role === 'admin') admins++
      else if (u.role === 'guest') guests++
    }
    return { total: users.length, admins, guests }
  }, [users])

  // Apply role-segment + name/email search filters.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (filter !== 'all' && u.role !== filter) return false
      if (!q) return true
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [users, query, filter])

  function invite() {
    const e = email.trim()
    if (!e || !e.includes('@')) return
    inviteMember(e, role)
    setEmail('')
  }

  return (
    <div className="space-y-3">
      <div className="text-[12px] text-faint">
        {counts.total} {counts.total === 1 ? 'member' : 'members'} · {counts.admins}{' '}
        {counts.admins === 1 ? 'admin' : 'admins'} · {counts.guests}{' '}
        {counts.guests === 1 ? 'guest' : 'guests'}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1.5 rounded-md border border-border bg-bg px-2">
          <Search size={13} className="text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="flex-1 bg-transparent py-1 text-[13px] text-fg outline-none placeholder:text-faint"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'rounded px-2 py-0.5 text-[12px] transition-colors',
                filter === f.value
                  ? 'bg-secondary text-fg'
                  : 'text-muted hover:text-fg',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {visible.map((u) => (
          <div key={u.id} className={cn('group flex items-center gap-2', u.suspended && 'opacity-60')}>
            <Avatar user={u} size={26} />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-[13px] text-fg">
                {u.name}
                {u.isMe && <span className="text-faint">(you)</span>}
                {u.pending && (
                  <span className="rounded bg-bg-tertiary px-1 text-[10px] text-faint">
                    Pending
                  </span>
                )}
                {u.suspended && (
                  <span className="rounded bg-bg-tertiary px-1 text-[10px] text-faint">
                    Suspended
                  </span>
                )}
              </div>
              <div className="text-[11px] text-faint">{u.email}</div>
            </div>
            {u.suspended ? (
              <button
                type="button"
                onClick={() => setUserSuspended(u.id, false)}
                className="rounded-md border border-border bg-bg px-2 py-0.5 text-[12px] text-muted hover:text-fg"
              >
                Reactivate
              </button>
            ) : (
              <>
                <RoleSelect
                  value={u.role}
                  onChange={(r) => setUserRole(u.id, r)}
                  disabled={u.isMe}
                />
                {!u.isMe && (
                  <button
                    type="button"
                    onClick={() => setUserSuspended(u.id, true)}
                    className="rounded-md border border-border bg-bg px-2 py-0.5 text-[12px] text-muted opacity-0 hover:text-fg group-hover:opacity-100"
                  >
                    Suspend
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              disabled={u.isMe}
              onClick={() => {
                if (confirm(`Remove ${u.name} from the workspace?`)) removeUser(u.id)
              }}
              className="flex h-7 w-7 items-center justify-center rounded text-faint opacity-0 hover:text-[var(--priority-urgent)] disabled:opacity-0 group-hover:opacity-100 disabled:group-hover:opacity-20"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="py-3 text-center text-[12px] text-faint">No members match your filters.</div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && invite()}
          placeholder="name@company.com"
          className="flex-1 bg-transparent text-[13px] text-fg outline-none"
        />
        <RoleSelect value={role} onChange={setRole} />
        <button
          type="button"
          disabled={!email.includes('@')}
          onClick={invite}
          className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[12px] text-white disabled:opacity-40 hover:bg-accent-hover"
        >
          <UserPlus size={13} /> Invite
        </button>
      </div>
    </div>
  )
}
