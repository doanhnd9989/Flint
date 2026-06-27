import { Check, Minus } from 'lucide-react'
import type { UserRole } from '@/lib/types'

// ── Settings → Members → Roles & permissions ──────────────────────────────────
// A read-only reference matrix mirroring Linear's roles documentation:
//   rows    = workspace capabilities
//   columns = Admin / Member / Guest
//   cells   = check (allowed) / dash (not allowed)
// This is purely informational — no store state, no mutations. It documents the
// role model already enforced elsewhere (admins manage everything; members
// create/edit content; guests are limited to the teams they're invited to).

type Capability = {
  /** Short capability label (left column). */
  label: string
  /** One-line clarification shown beneath the label. */
  hint: string
  /** Whether each role is granted this capability, keyed by role. */
  grant: Record<UserRole, boolean>
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'guest', label: 'Guest' },
]

// Faithful to Linear's real role model. Order roughly mirrors Linear's docs:
// workspace administration first, then content, then access scope.
const CAPABILITIES: Capability[] = [
  {
    label: 'Manage workspace settings',
    hint: 'Edit workspace name, security, integrations and preferences',
    grant: { admin: true, member: false, guest: false },
  },
  {
    label: 'Manage members & billing',
    hint: 'Invite, remove and change roles; manage the subscription',
    grant: { admin: true, member: false, guest: false },
  },
  {
    label: 'Manage teams',
    hint: 'Create, configure, archive and delete teams',
    grant: { admin: true, member: false, guest: false },
  },
  {
    label: 'Create projects',
    hint: 'Start new projects and milestones',
    grant: { admin: true, member: true, guest: false },
  },
  {
    label: 'Create & edit issues',
    hint: 'Open, update and triage issues in teams they belong to',
    grant: { admin: true, member: true, guest: true },
  },
  {
    label: 'Comment & react',
    hint: 'Participate in discussions on accessible issues',
    grant: { admin: true, member: true, guest: true },
  },
  {
    label: 'View public teams',
    hint: 'Browse and join any team marked public',
    grant: { admin: true, member: true, guest: false },
  },
  {
    label: 'Access guest-restricted teams',
    hint: 'See only the specific teams they were invited to',
    grant: { admin: true, member: true, guest: true },
  },
  {
    label: 'Delete workspace',
    hint: 'Permanently delete the workspace and all of its data',
    grant: { admin: true, member: false, guest: false },
  },
]

/** A single matrix cell: check for allowed, dash for not allowed. */
function Cell({ allowed }: { allowed: boolean }) {
  return (
    <div className="flex items-center justify-center">
      {allowed ? (
        <Check size={15} className="text-accent" aria-label="Allowed" />
      ) : (
        <Minus size={15} className="text-faint" aria-label="Not allowed" />
      )}
    </div>
  )
}

/** Read-only role/permission reference matrix. */
export function RolePermissionsSettings() {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Header row: capability label spacer + one column per role */}
      <div className="grid grid-cols-[1fr_72px_72px_72px] items-center border-b border-border bg-bg-secondary px-4 py-2.5">
        <div className="text-[12px] font-medium text-muted">Capability</div>
        {ROLES.map((r) => (
          <div key={r.value} className="text-center text-[12px] font-medium text-fg">
            {r.label}
          </div>
        ))}
      </div>

      {/* One row per capability */}
      <div className="divide-y divide-border">
        {CAPABILITIES.map((cap) => (
          <div
            key={cap.label}
            className="grid grid-cols-[1fr_72px_72px_72px] items-center px-4 py-3"
          >
            <div className="min-w-0 pr-4">
              <div className="text-[13px] text-fg">{cap.label}</div>
              <div className="mt-0.5 text-[12px] text-muted">{cap.hint}</div>
            </div>
            {ROLES.map((r) => (
              <Cell key={r.value} allowed={cap.grant[r.value]} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
