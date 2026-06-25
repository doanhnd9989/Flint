import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ── Settings → Pulse (mirrors Linear's workspace Pulse / AI-digest page) ──────

/** A bordered settings group. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
      {children}
    </div>
  )
}

/** A single labelled row inside a Card. */
function Row({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13px] text-fg">{label}</div>
        {description ? (
          <div className="mt-0.5 text-[12px] text-muted">{description}</div>
        ) : null}
      </div>
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

const FREQUENCIES = ['Daily', 'Weekly', 'Monthly'] as const
type Frequency = (typeof FREQUENCIES)[number]

export function PulseSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)
  const [frequency, setFrequency] = useState<Frequency>('Weekly')

  // Defaults follow Linear's out-of-the-box Pulse configuration.
  const get = (key: string, fallback: boolean) =>
    featureSettings[key] ?? fallback

  const enabled = get('pulse.enabled', true)

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Pulse</h1>
      <p className="mt-1 text-[13px] text-muted">
        AI-written summaries of what's moving across your workspace.
      </p>

      <div className="mt-7 space-y-9">
        {/* Master enable */}
        <Card>
          <Row
            label="Enable Pulse"
            description="Generate a recurring digest of workspace activity."
          >
            <Toggle
              checked={enabled}
              onChange={(v) => setFeatureSetting('pulse.enabled', v)}
            />
          </Row>
        </Card>

        {enabled ? (
          <>
            {/* Delivery */}
            <div>
              <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Delivery
              </div>
              <Card>
                <Row label="Frequency">
                  <div className="flex rounded-md bg-bg-secondary p-0.5">
                    {FREQUENCIES.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFrequency(f)}
                        className={cn(
                          'rounded px-2 py-1 text-[12px] transition-colors',
                          frequency === f
                            ? 'bg-bg-elevated text-fg shadow-sm'
                            : 'text-muted',
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="Send to Slack">
                  <Toggle
                    checked={get('pulse.slack', false)}
                    onChange={(v) => setFeatureSetting('pulse.slack', v)}
                  />
                </Row>
                <Row label="Email me a copy">
                  <Toggle
                    checked={get('pulse.email', true)}
                    onChange={(v) => setFeatureSetting('pulse.email', v)}
                  />
                </Row>
              </Card>
            </div>

            {/* Content */}
            <div>
              <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Content
              </div>
              <Card>
                <Row label="Project updates">
                  <Toggle
                    checked={get('pulse.projects', true)}
                    onChange={(v) => setFeatureSetting('pulse.projects', v)}
                  />
                </Row>
                <Row label="Completed issues">
                  <Toggle
                    checked={get('pulse.completed', true)}
                    onChange={(v) => setFeatureSetting('pulse.completed', v)}
                  />
                </Row>
                <Row label="Risks & blockers">
                  <Toggle
                    checked={get('pulse.risks', true)}
                    onChange={(v) => setFeatureSetting('pulse.risks', v)}
                  />
                </Row>
                <Row label="Cycle progress">
                  <Toggle
                    checked={get('pulse.cycles', true)}
                    onChange={(v) => setFeatureSetting('pulse.cycles', v)}
                  />
                </Row>
              </Card>
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-border bg-bg-secondary p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0" color="var(--accent)" />
                <span className="text-[13px] font-semibold text-fg">
                  This week in Claude Test App
                </span>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="text-[12px] text-muted">
                  • 24 issues completed across 3 projects
                </div>
                <div className="text-[12px] text-muted">
                  • MVP Launch is on track for Jul 1
                </div>
                <div className="text-[12px] text-muted">
                  • 2 issues flagged as blocked
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted">
            Turn on Pulse to receive workspace digests.
          </p>
        )}
      </div>
    </div>
  )
}
