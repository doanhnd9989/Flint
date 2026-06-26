import { useState } from 'react'
import { Archive, ArchiveRestore, ChevronRight, UserPlus } from 'lucide-react'
import { useStoreShallow, useDisplayName } from '@/lib/store'
import { Avatar } from './Avatar'
import { SelectMenu, type SelectOption } from './ui/SelectMenu'

export function TeamsSettings() {
  const { teams, users, issues, toggleTeamMember, archiveTeam, unarchiveTeam } =
    useStoreShallow((s) => ({
      teams: s.teams,
      users: s.users,
      issues: s.issues,
      toggleTeamMember: s.toggleTeamMember,
      archiveTeam: s.archiveTeam,
      unarchiveTeam: s.unarchiveTeam,
    }))
  const fmt = useDisplayName()
  const [showArchived, setShowArchived] = useState(false)

  const activeTeams = teams.filter((t) => !t.archivedAt)
  const archivedTeams = teams.filter((t) => t.archivedAt)
  // Don't allow archiving the last remaining active team.
  const canArchive = activeTeams.length > 1

  return (
    <div className="space-y-3">
      {activeTeams.map((team) => {
        const memberIds = team.memberIds ?? []
        const members = users.filter((u) => memberIds.includes(u.id))
        const issueCount = issues.filter((i) => i.teamId === team.id).length
        const options: SelectOption[] = users.map((u) => ({
          id: u.id,
          label: fmt(u.name),
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
              <button
                type="button"
                onClick={() => canArchive && archiveTeam(team.id)}
                disabled={!canArchive}
                title={
                  canArchive
                    ? 'Archive team'
                    : 'You can’t archive your only team'
                }
                className="flex h-6 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Archive size={12} /> Archive
              </button>
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

      {archivedTeams.length > 0 && (
        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12px] font-medium text-muted hover:bg-bg-hover"
          >
            <ChevronRight
              size={14}
              className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}
            />
            Archived teams
            <span className="text-faint">({archivedTeams.length})</span>
          </button>
          {showArchived && (
            <div className="space-y-1 border-t border-border p-2">
              {archivedTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-bg-hover"
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[13px] opacity-70"
                    style={{ background: `${team.color}22` }}
                  >
                    {team.icon}
                  </span>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-muted">
                      {team.name}
                    </div>
                    <div className="text-[11px] text-faint">{team.key}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => unarchiveTeam(team.id)}
                    title="Restore team"
                    className="flex h-6 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted hover:bg-bg-hover"
                  >
                    <ArchiveRestore size={12} /> Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
