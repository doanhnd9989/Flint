import { useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import type { UserRole } from '@/lib/types'
import { Avatar } from './Avatar'

const ROLES: UserRole[] = ['admin', 'member', 'guest']

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
  const { users, setUserRole, inviteMember, removeUser } = useStoreShallow((s) => ({
    users: s.users,
    setUserRole: s.setUserRole,
    inviteMember: s.inviteMember,
    removeUser: s.removeUser,
  }))

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('member')

  function invite() {
    const e = email.trim()
    if (!e || !e.includes('@')) return
    inviteMember(e, role)
    setEmail('')
  }

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className="group flex items-center gap-2">
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
            </div>
            <div className="text-[11px] text-faint">{u.email}</div>
          </div>
          <RoleSelect
            value={u.role}
            onChange={(r) => setUserRole(u.id, r)}
            disabled={u.isMe}
          />
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
