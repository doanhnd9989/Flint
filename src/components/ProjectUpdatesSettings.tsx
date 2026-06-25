import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** A bordered settings card grouping related rows. */
function Card({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-secondary">
      {children}
    </div>
  )
}

/** A single settings row: title + description on the left, control on the right. */
function Row({
  title,
  desc,
  control,
}: {
  title: string
  desc?: string
  control: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg">{title}</div>
        {desc && <div className="mt-0.5 text-[12px] text-muted">{desc}</div>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

/** Linear-style pill toggle. */
function Toggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-[18px] w-[30px] rounded-full transition-colors',
        on ? 'bg-accent' : 'bg-bg-tertiary',
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 h-[14px] w-[14px] rounded-full bg-white transition-transform',
          on && 'translate-x-[14px]',
        )}
      />
    </button>
  )
}

const CADENCES = ['Weekly', 'Biweekly', 'Monthly'] as const
type Cadence = (typeof CADENCES)[number]

/** Project updates settings — cadence reminders for project health updates. */
export function ProjectUpdatesSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  const [cadence, setCadence] = useState<Cadence>('Weekly')

  const get = (key: string, fallback: boolean) =>
    featureSettings[key] ?? fallback

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Updates</h1>
      <p className="mt-1 text-[13px] text-muted">
        Remind project leads to post regular health updates.
      </p>

      <div className="mt-7 space-y-9">
        {/* Reminders */}
        <Card>
          <Row
            title="Send update reminders"
            desc="Nudge project leads when an update is due."
            control={
              <Toggle
                on={get('projectUpdates.reminders', true)}
                onChange={(on) => setFeatureSetting('projectUpdates.reminders', on)}
              />
            }
          />
          <Row
            title="Cadence"
            control={
              <div className="flex rounded-md bg-bg-secondary p-0.5">
                {CADENCES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCadence(c)}
                    className={cn(
                      'rounded px-2 py-1 text-[12px] transition-colors',
                      cadence === c
                        ? 'bg-bg-elevated text-fg shadow-sm'
                        : 'text-muted',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            }
          />
          <Row
            title="Reminder day"
            control={
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[13px] font-medium text-fg">
                Friday
                <ChevronDown size={14} className="text-faint" />
              </div>
            }
          />
        </Card>

        {/* Delivery */}
        <Card>
          <Row
            title="Post reminders in Slack"
            control={
              <Toggle
                on={get('projectUpdates.slack', false)}
                onChange={(on) => setFeatureSetting('projectUpdates.slack', on)}
              />
            }
          />
          <Row
            title="Email project leads"
            control={
              <Toggle
                on={get('projectUpdates.email', true)}
                onChange={(on) => setFeatureSetting('projectUpdates.email', on)}
              />
            }
          />
        </Card>

        {/* Health */}
        <Card>
          <Row
            title="Require a health status (On track / At risk / Off track) on each update"
            control={
              <Toggle
                on={get('projectUpdates.requireHealth', true)}
                onChange={(on) =>
                  setFeatureSetting('projectUpdates.requireHealth', on)
                }
              />
            }
          />
        </Card>
      </div>
    </div>
  )
}
