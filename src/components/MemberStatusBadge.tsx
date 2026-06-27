import { useStore } from '@/lib/store'

/**
 * Member account-status pill for the members directory, mirroring Linear's
 * people directory. Surfaces only the account *state* that isn't already shown
 * by the row's role pill: Suspended (red) → Invited/pending (amber). Active
 * members (any role) render nothing here — their role is shown separately.
 */
export function MemberStatusBadge({ userId }: { userId: string }) {
  const user = useStore((s) => s.users.find((u) => u.id === userId))
  if (!user) return null

  // Suspended outranks a pending invite. Role is rendered by the row, not here.
  let label: string
  let style: string
  if (user.suspended) {
    label = 'Suspended'
    style = 'bg-[var(--priority-urgent)]/12 text-[var(--priority-urgent)]'
  } else if (user.pending) {
    label = 'Invited'
    style = 'bg-[var(--status-started)]/15 text-[var(--status-started)]'
  } else {
    // Active member — its role pill already conveys the status.
    return null
  }

  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${style}`}
    >
      {label}
    </span>
  )
}
