import { useStore } from '@/lib/store'

/**
 * Member status badge — a small account-status pill for the members directory,
 * mirroring Linear's people directory. Reflects the highest-priority status:
 * Suspended (red) → Invited/pending (amber) → Admin / Guest role. A plain
 * active member needs no badge, so we render nothing in that case.
 */
export function MemberStatusBadge({ userId }: { userId: string }) {
  const user = useStore((s) => s.users.find((u) => u.id === userId))
  if (!user) return null

  // Status priority: suspended outranks a pending invite, which outranks role.
  let label: string
  let style: string
  if (user.suspended) {
    label = 'Suspended'
    style = 'bg-[var(--priority-urgent)]/12 text-[var(--priority-urgent)]'
  } else if (user.pending) {
    label = 'Invited'
    style = 'bg-[var(--status-started)]/15 text-[var(--status-started)]'
  } else if (user.role === 'admin') {
    label = 'Admin'
    style = 'bg-bg-tertiary text-muted'
  } else if (user.role === 'guest') {
    label = 'Guest'
    style = 'bg-bg-tertiary text-faint'
  } else {
    // Plain active member — no badge needed.
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
