import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, Search } from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { MemberWorkload } from '@/components/MemberWorkload'
import { Avatar } from '@/components/Avatar'
import { EmptyState, SearchIllustration } from '@/components/EmptyState'
import { cn, timeAgo } from '@/lib/utils'
import type { User, UserRole, Team } from '@/lib/types'

type RoleFilter = 'all' | UserRole

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'admin', label: 'Admin' },
  { id: 'member', label: 'Member' },
  { id: 'guest', label: 'Guest' },
]

const ROLE_RANK: Record<UserRole, number> = { admin: 0, member: 1, guest: 2 }

type SortKey = 'name' | 'assigned' | 'active' | 'teams'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'assigned', label: 'Assigned issues' },
  { id: 'active', label: 'Active issues' },
  { id: 'teams', label: 'Teams' },
]

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
  const states = useStore((s) => s.states)
  const activities = useStore((s) => s.activities)
  const comments = useStore((s) => s.comments)

  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')

  // stateId → whether it's a started/unstarted (i.e. "active") workflow state.
  const activeStateIds = useMemo(() => {
    const s = new Set<string>()
    for (const st of states) {
      if (st.type === 'started' || st.type === 'unstarted') s.add(st.id)
    }
    return s
  }, [states])

  // assigneeId → { assigned, active } counts over non-triage, non-archived issues.
  const counts = useMemo(() => {
    const m = new Map<string, { assigned: number; active: number }>()
    for (const i of issues) {
      if (i.triage || i.archivedAt || !i.assigneeId) continue
      const c = m.get(i.assigneeId) ?? { assigned: 0, active: 0 }
      c.assigned++
      if (activeStateIds.has(i.stateId)) c.active++
      m.set(i.assigneeId, c)
    }
    return m
  }, [issues, activeStateIds])

  // userId → ISO of their most-recent footprint (activity, comment, or created
  // issue). Approximates Linear's "Last active" — when we last saw them act.
  const lastActiveByUser = useMemo(() => {
    const m = new Map<string, string>()
    const note = (userId: string, at: string) => {
      const cur = m.get(userId)
      if (!cur || at > cur) m.set(userId, at)
    }
    for (const a of activities) note(a.userId, a.createdAt)
    for (const c of comments) note(c.userId, c.createdAt)
    for (const i of issues) note(i.creatorId, i.createdAt)
    return m
  }, [activities, comments, issues])

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

  // Per-role tallies for the filter pills (All shows the full roster size).
  const roleCounts = useMemo(() => {
    const m: Record<RoleFilter, number> = {
      all: users.length,
      admin: 0,
      member: 0,
      guest: 0,
    }
    for (const u of users) m[u.role]++
    return m
  }, [users])

  // Filter by search + role, then sort by the chosen key. Name (default) keeps
  // Linear's me-first → admins → alpha ordering; count sorts go descending.
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
      if (sortKey === 'assigned' || sortKey === 'active') {
        const ca = counts.get(a.id)?.[sortKey] ?? 0
        const cb = counts.get(b.id)?.[sortKey] ?? 0
        if (ca !== cb) return cb - ca
        return a.name.localeCompare(b.name)
      }
      if (sortKey === 'teams') {
        const ta = teamsByUser.get(a.id)?.length ?? 0
        const tb = teamsByUser.get(b.id)?.length ?? 0
        if (ta !== tb) return tb - ta
        return a.name.localeCompare(b.name)
      }
      // 'name' (default)
      if (!!a.isMe !== !!b.isMe) return a.isMe ? -1 : 1
      if (a.role !== b.role) return ROLE_RANK[a.role] - ROLE_RANK[b.role]
      return a.name.localeCompare(b.name)
    })
  }, [users, query, roleFilter, sortKey, counts, teamsByUser])

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

          {/* Workload by assignee — open issues per member. */}
          <div className="mt-4">
            <MemberWorkload />
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
              {ROLE_FILTERS.map((r) => {
                const active = roleFilter === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRoleFilter(r.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px]',
                      active
                        ? 'bg-bg-elevated font-medium text-fg shadow-sm'
                        : 'text-muted hover:text-fg',
                    )}
                  >
                    {r.label}
                    {/* Per-role count badge */}
                    <span
                      className={cn(
                        'tabular-nums text-[11px]',
                        active ? 'text-muted' : 'text-faint',
                      )}
                    >
                      {roleCounts[r.id]}
                    </span>
                  </button>
                )
              })}
            </div>
            {/* Sort dropdown */}
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg px-2 py-1.5">
              <ArrowUpDown size={14} className="shrink-0 text-faint" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                title="Sort members"
                className="cursor-pointer bg-transparent text-[12px] text-fg outline-none"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id} className="bg-bg text-fg">
                    {o.label}
                  </option>
                ))}
              </select>
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
                const c = counts.get(u.id) ?? { assigned: 0, active: 0 }
                const count = c.assigned
                const lastActive = lastActiveByUser.get(u.id)
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

                    {/* Last active — most recent footprint, relative time */}
                    <span
                      title={
                        lastActive
                          ? `Last active ${timeAgo(lastActive)}`
                          : 'No recent activity'
                      }
                      className="hidden w-20 shrink-0 text-right text-[12px] tabular-nums text-faint sm:block"
                    >
                      {lastActive ? timeAgo(lastActive) : '—'}
                    </span>

                    <RoleChip role={u.role} />

                    {/* Active-issue count — emphasised when sorting by active */}
                    <span
                      title={`${c.active} active issue${c.active === 1 ? '' : 's'}`}
                      className={cn(
                        'hidden w-16 shrink-0 text-right text-[12px] tabular-nums sm:block',
                        sortKey === 'active' ? 'text-fg' : 'text-faint',
                      )}
                    >
                      {c.active} active
                    </span>

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
                          : sortKey === 'assigned'
                            ? 'cursor-default text-fg'
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
