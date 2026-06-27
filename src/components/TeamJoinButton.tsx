import { useStoreShallow } from '@/lib/store';

// Join/Leave toggle for a team (Linear lets you join/leave teams).
export function TeamJoinButton({ teamId }: { teamId: string }) {
  const { teams, currentUserId, toggleTeamMember } = useStoreShallow((s) => ({
    teams: s.teams,
    currentUserId: s.currentUserId,
    toggleTeamMember: s.toggleTeamMember,
  }));

  const team = teams.find((t) => t.id === teamId);
  if (!team) return null;

  const member = (team.memberIds ?? []).includes(currentUserId);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleTeamMember(teamId, currentUserId);
      }}
      className={
        member
          ? 'rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg'
          : 'rounded-md bg-accent px-2 py-1 text-[12px] text-white hover:bg-accent-hover'
      }
    >
      {member ? 'Leave' : 'Join'}
    </button>
  );
}
