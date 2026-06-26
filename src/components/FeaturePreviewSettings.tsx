import {
  Beaker,
  Box,
  GitBranch,
  Inbox,
  MessageSquare,
  Repeat,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ── Settings → Features (mirrors Linear's admin "Features" page) ──────────────
// Each row is a workspace feature that admins flip on or off. Persistence rides
// on the generic featureSettings boolean map via setFeatureSetting — no new
// store action needed. Toggles default to ON when the key is unset.

/** A bordered settings group. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
      {children}
    </div>
  )
}

/** The exact Linear pill toggle. */
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-bg-tertiary',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[14px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}

/** A feature row: icon + name + description + toggle. */
function FeatureRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: LucideIcon
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-bg-tertiary">
        <Icon className="h-4 w-4" color="var(--muted)" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-fg">{label}</div>
        <div className="mt-0.5 text-[12px] text-muted">{description}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

type Feature = {
  key: string
  icon: LucideIcon
  label: string
  description: string
}

// Core workspace features, in Linear's ordering.
const CORE_FEATURES: Feature[] = [
  {
    key: 'feature.cycles',
    icon: Repeat,
    label: 'Cycles',
    description: 'Time-boxed sprints to focus your team on a set of issues.',
  },
  {
    key: 'feature.triage',
    icon: Inbox,
    label: 'Triage',
    description: 'Review and prioritize incoming issues before they reach a team.',
  },
  {
    key: 'feature.projects',
    icon: Box,
    label: 'Projects',
    description: 'Group issues into a body of work with a target date and lead.',
  },
  {
    key: 'feature.initiatives',
    icon: Target,
    label: 'Initiatives',
    description: 'Organize projects under company-wide strategic goals.',
  },
  {
    key: 'feature.customerRequests',
    icon: Users,
    label: 'Customer requests',
    description: 'Link customer feedback to issues to prioritize by demand.',
  },
  {
    key: 'feature.pulse',
    icon: Sparkles,
    label: 'Pulse',
    description: 'AI-written summaries of what is moving across your workspace.',
  },
  {
    key: 'feature.asks',
    icon: MessageSquare,
    label: 'Asks',
    description: 'Turn requests from across your company into trackable issues.',
  },
  {
    key: 'feature.releases',
    icon: GitBranch,
    label: 'Releases',
    description: 'Coordinate and track shipping work across teams and projects.',
  },
]

// Beta / opt-in preview features.
const PREVIEW_FEATURES: Feature[] = [
  {
    key: 'feature.preview.aiAgents',
    icon: Sparkles,
    label: 'AI agents',
    description: 'Delegate issues to autonomous agents that draft and triage work.',
  },
  {
    key: 'feature.preview.dependencies',
    icon: GitBranch,
    label: 'Project dependencies',
    description: 'Model blocking relationships between projects on the timeline.',
  },
]

export function FeaturePreviewSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  // Core features ship on by default; preview features ship off by default.
  const isOn = (key: string, fallback: boolean) => featureSettings[key] ?? fallback

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Features</h1>
      <p className="mt-1 text-[13px] text-muted">
        Enable or disable features for everyone in your workspace.
      </p>

      <div className="mt-7 space-y-9">
        {/* Core features */}
        <div>
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Workspace features
          </div>
          <Card>
            {CORE_FEATURES.map((f) => (
              <FeatureRow
                key={f.key}
                icon={f.icon}
                label={f.label}
                description={f.description}
                checked={isOn(f.key, true)}
                onChange={(v) => setFeatureSetting(f.key, v)}
              />
            ))}
          </Card>
        </div>

        {/* Preview features */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <Beaker className="h-3.5 w-3.5" color="var(--faint)" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              Preview features
            </span>
          </div>
          <p className="mb-2 px-1 text-[12px] text-muted">
            Try features that are still in beta. They may change or be removed.
          </p>
          <Card>
            {PREVIEW_FEATURES.map((f) => (
              <FeatureRow
                key={f.key}
                icon={f.icon}
                label={f.label}
                description={f.description}
                checked={isOn(f.key, false)}
                onChange={(v) => setFeatureSetting(f.key, v)}
              />
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
