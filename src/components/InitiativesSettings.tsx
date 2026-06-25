import { useState } from 'react'
import type { ReactNode } from 'react'
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

const CADENCES = ['Monthly', 'Quarterly'] as const
type Cadence = (typeof CADENCES)[number]

/** Initiatives settings — group projects into strategic initiatives. */
export function InitiativesSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)
  const initiatives = useStore((s) => s.initiatives)

  const [cadence, setCadence] = useState<Cadence>('Quarterly')

  const get = (key: string, fallback: boolean) => featureSettings[key] ?? fallback

  const enabled = get('initiatives.enabled', true)

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Initiatives</h1>
      <p className="mt-1 text-[13px] text-muted">
        Group projects into strategic initiatives to track big-picture goals.
      </p>

      <div className="mt-7 space-y-9">
        {/* Master enable */}
        <Card>
          <Row
            title="Enable initiatives"
            desc="Show Initiatives in the sidebar and let projects roll up into them."
            control={
              <Toggle
                on={enabled}
                onChange={(on) => setFeatureSetting('initiatives.enabled', on)}
              />
            }
          />
          {enabled && (
            <div className="px-4 py-2.5 text-[12px] text-muted">
              {initiatives.length} initiatives in this workspace
            </div>
          )}
        </Card>

        {enabled ? (
          <>
            {/* Display */}
            <Card>
              <Row
                title="Show initiative progress on the sidebar"
                control={
                  <Toggle
                    on={get('initiatives.sidebarProgress', false)}
                    onChange={(on) =>
                      setFeatureSetting('initiatives.sidebarProgress', on)
                    }
                  />
                }
              />
              <Row
                title="Show health on initiative cards"
                control={
                  <Toggle
                    on={get('initiatives.showHealth', true)}
                    onChange={(on) => setFeatureSetting('initiatives.showHealth', on)}
                  />
                }
              />
            </Card>

            {/* Updates */}
            <Card>
              <Row
                title="Remind owners to post initiative updates"
                control={
                  <Toggle
                    on={get('initiatives.updateReminders', true)}
                    onChange={(on) =>
                      setFeatureSetting('initiatives.updateReminders', on)
                    }
                  />
                }
              />
              <Row
                title="Update cadence"
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
            </Card>
          </>
        ) : (
          <p className="text-[13px] text-muted">
            Turn on initiatives to group your projects.
          </p>
        )}
      </div>
    </div>
  )
}
