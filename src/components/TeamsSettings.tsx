import { UserPlus } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import { Avatar } from './Avatar'
import { SelectMenu, type SelectOption } from './ui/SelectMenu'

export function TeamsSettings() {
  const { teams, users, issues, toggleTeamMember } = useStoreShallow((s) => ({
    teams: s.teams,
    users: s.users,
    issues: s.issues,
    toggleTeamMember: s.toggleTeamMember,
  }))

  return (
    <div className="space-y-3">
      {teams.map((team) => {
        const memberIds = team.memberIds ?? []
        const members = users.filter((u) => memberIds.includes(u.id))
        const issueCount = issues.filter((i) => i.teamId === team.id).length
        const options: SelectOption[] = users.map((u) => ({
          id: u.id,
          label: u.name,
          icon: <Avatar user={u} size={16} />,
          selected: memberIds.includes(u.id),
        }))
        return (
          <div key={team.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md text-[15px]"
                style={{ background: `${team.color}22` }}
              >
                {team.icon}
              </span>
              <div className="flex-1">
                <div className="text-[13px] font-medium text-fg">{team.name}</div>
                <div className="text-[11px] text-faint">
                  {team.key} · {issueCount} issues · {members.length} members
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <div className="flex -space-x-1.5">
                {members.map((u) => (
                  <span key={u.id} className="rounded-full ring-2 ring-bg-secondary">
                    <Avatar user={u} size={22} />
                  </span>
                ))}
              </div>
              <SelectMenu
                options={options}
                onSelect={(userId) => toggleTeamMember(team.id, userId)}
                keepOpen
                placeholder="Add member…"
                trigger={
                  <span className="ml-1 flex h-6 items-center gap-1 rounded-md border border-dashed border-border-strong px-2 text-[11px] text-muted hover:bg-bg-hover">
                    <UserPlus size={12} /> Members
                  </span>
                }
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
