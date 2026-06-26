import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { EmptyState, SearchIllustration } from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import type { User, UserRole, Team } from '@/lib/types'

type RoleFilter = 'all' | UserRole

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'admin', label: 'Admin' },
  { id: 'member', label: 'Member' },
  { id: 'guest', label: 'Guest' },
]

const ROLE_RANK: Record<UserRole, number> = { admin: 0, member: 1, guest: 2 }

/** Capitalised role chip (Admin / Member / Guest). */
function RoleChip({ role }: { role: UserRole }) {
  return (
    <span className="rounded border border-border px-1.5 py-0.5 text-[11px] capitalize text-muted">
      {role}
    </span>
  )
}

/** A small stat in the summary strip. */
function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[13px] font-semibold tabular-nums text-fg">{value}</span>
      <span className="text-[12px] text-muted">{label}</span>
    </div>
  )
}

/**
 * Members directory — a read-only workspace people directory. Browse everyone in
 * the workspace with their role, teams, and assigned-issue counts. Mutations
 * (invites / role changes) live in Settings → Members.
 */
export function MembersDirectoryView() {
  const navigate = useNavigate()
  const fmtName = useDisplayName()
  const users = useStore((s) => s.users)
  const teams = useStore((s) => s.teams)
  const issues = useStore((s) => s.issues)

  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  // assigneeId → count of assigned, non-triage issues.
  const assignedCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of issues) {
      if (i.triage || i.archivedAt || !i.assigneeId) continue
      m.set(i.assigneeId, (m.get(i.assigneeId) ?? 0) + 1)
    }
    return m
  }, [issues])

  // userId → teams they belong to (memberIds includes them).
  const teamsByUser = useMemo(() => {
    const m = new Map<string, Team[]>()
    for (const u of users) {
      m.set(
        u.id,
        teams.filter((t) => t.memberIds.includes(u.id)),
      )
    }
    return m
  }, [users, teams])

  // Summary strip numbers.
  const summary = useMemo(() => {
    let admins = 0
    let guests = 0
    let pending = 0
    for (const u of users) {
      if (u.role === 'admin') admins++
      else if (u.role === 'guest') guests++
      if (u.pending) pending++
    }
    return { total: users.length, admins, guests, pending }
  }, [users])

  // Filter by search + role, then sort: me first → admins → alpha.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (!q) return true
      return (
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      )
    })
    return [...matches].sort((a, b) => {
      if (!!a.isMe !== !!b.isMe) return a.isMe ? -1 : 1
      if (a.role !== b.role) return ROLE_RANK[a.role] - ROLE_RANK[b.role]
      return a.name.localeCompare(b.name)
    })
  }, [users, query, roleFilter])

  function onCountClick(u: User, count: number) {
    if (u.isMe && count > 0) navigate('/my-issues')
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Members" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          {/* Summary strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-border pb-4">
            <SummaryStat value={summary.total} label="members" />
            <SummaryStat value={summary.admins} label="admins" />
            <SummaryStat value={summary.guests} label="guests" />
            <SummaryStat value={summary.pending} label="pending invites" />
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="ml-auto text-[12px] text-muted hover:text-fg"
            >
              Manage in Settings → Members
            </button>
          </div>

          {/* Controls: search + role filter */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1.5">
              <Search size={14} className="shrink-0 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
              />
            </div>
            <div className="flex items-center gap-0.5 rounded-md bg-bg-secondary p-0.5">
              {ROLE_FILTERS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoleFilter(r.id)}
                  className={cn(
                    'rounded px-2.5 py-1 text-[12px]',
                    roleFilter === r.id
                      ? 'bg-bg-elevated font-medium text-fg shadow-sm'
                      : 'text-muted hover:text-fg',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <EmptyState
              illustration={<SearchIllustration />}
              title="No members found"
              description="No one in this workspace matches your search or filter."
              className="py-16"
            />
          ) : (
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {filtered.map((u) => {
                const userTeams = teamsByUser.get(u.id) ?? []
                const count = assignedCounts.get(u.id) ?? 0
                const clickable = u.isMe && count > 0
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 bg-bg px-3 py-2.5 transition-colors hover:bg-bg-hover"
                  >
                    <Avatar user={u} size={30} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-fg">
                          {fmtName(u.name)}
                        </span>
                        {u.isMe && (
                          <span className="rounded bg-bg-tertiary px-1 text-[10px] text-faint">
                            You
                          </span>
                        )}
                        {u.pending && (
                          <span className="rounded bg-bg-tertiary px-1 text-[10px] text-faint">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-muted">{u.email}</div>
                    </div>

                    {/* Teams the user belongs to */}
                    {userTeams.length > 0 && (
                      <div className="hidden items-center gap-1.5 sm:flex">
                        {userTeams.slice(0, 3).map((t) => (
                          <span
                            key={t.id}
                            title={t.name}
                            className="flex items-center gap-1 rounded bg-bg-secondary px-1.5 py-0.5 text-[11px] text-muted"
                          >
                            <span>{t.icon}</span>
                            <span className="max-w-[90px] truncate">{t.name}</span>
                          </span>
                        ))}
                        {userTeams.length > 3 && (
                          <span className="text-[11px] text-faint">
                            +{userTeams.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    <RoleChip role={u.role} />

                    {/* Assigned-issue count */}
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => onCountClick(u, count)}
                      title={
                        clickable
                          ? 'View your assigned issues'
                          : `${count} assigned issue${count === 1 ? '' : 's'}`
                      }
                      className={cn(
                        'w-12 shrink-0 rounded px-1.5 py-0.5 text-right text-[12px] tabular-nums',
                        clickable
                          ? 'text-muted hover:bg-bg-selected hover:text-fg'
                          : 'cursor-default text-faint',
                      )}
                    >
                      {count}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
