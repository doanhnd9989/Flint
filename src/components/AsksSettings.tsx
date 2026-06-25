import type { ReactNode } from 'react'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** Linear-style pill toggle switch. */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-[18px] w-[30px] rounded-full transition-colors',
        on ? 'bg-accent' : 'bg-[var(--border)]',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform',
          on ? 'translate-x-[14px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}

/** Bordered, divided settings card. */
function Card({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border rounded-xl border border-border">{children}</div>
}

/** A single settings row: title + description on the left, control on the right. */
function Row({
  title,
  description,
  control,
}: {
  title: string
  description?: string
  control: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div>
        <div className="text-[13px] font-medium text-fg">{title}</div>
        {description && <div className="mt-0.5 text-[12px] text-muted">{description}</div>}
      </div>
      {control}
    </div>
  )
}

type RequestType = { id: string; name: string; emoji: string }

const genId = () => Math.random().toString(36).slice(2, 9)

/** Asks (features) settings page — turns Slack/email requests into trackable issues. */
export function AsksSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  const enabled = featureSettings['asks.enabled'] ?? false
  const slack = featureSettings['asks.slack'] ?? true
  const email = featureSettings['asks.email'] ?? true
  const autoAssign = featureSettings['asks.autoAssign'] ?? false
  const notifyRequester = featureSettings['asks.notifyRequester'] ?? true

  const [types, setTypes] = useState<RequestType[]>([
    { id: genId(), name: 'IT Support', emoji: '🛠️' },
    { id: genId(), name: 'Access Request', emoji: '🔐' },
    { id: genId(), name: 'Bug Report', emoji: '🐞' },
    { id: genId(), name: 'General Question', emoji: '❓' },
  ])

  const addType = () =>
    setTypes((prev) => [...prev, { id: genId(), name: 'New request type', emoji: '📋' }])

  const removeType = (id: string) => setTypes((prev) => prev.filter((t) => t.id !== id))

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Asks</h1>
      <p className="mt-1 text-[13px] text-muted">
        Turn requests from your team into trackable issues, like an internal help desk.
      </p>

      <div className="mt-7 space-y-9">
        {/* Master enable */}
        <Card>
          <Row
            title="Enable Asks"
            description="Receive requests from Slack and email as issues"
            control={
              <Toggle on={enabled} onChange={(next) => setFeatureSetting('asks.enabled', next)} />
            }
          />
        </Card>

        {enabled ? (
          <>
            {/* Channels */}
            <section>
              <h2 className="mb-3 text-[13px] font-semibold text-fg">Channels</h2>
              <Card>
                <Row
                  title="Slack"
                  description="Create requests from a Slack channel"
                  control={
                    <Toggle on={slack} onChange={(next) => setFeatureSetting('asks.slack', next)} />
                  }
                />
                <Row
                  title="Email"
                  description="Create requests from inbound email"
                  control={
                    <Toggle on={email} onChange={(next) => setFeatureSetting('asks.email', next)} />
                  }
                />
                <Row
                  title="Slack channel"
                  description="Where requests are submitted"
                  control={
                    <span className="rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[13px] font-medium text-fg">
                      #help-requests
                    </span>
                  }
                />
              </Card>
            </section>

            {/* Request types */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-fg">Request types</h2>
                <button
                  type="button"
                  onClick={addType}
                  className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
                >
                  <Plus size={14} />
                  Add type
                </button>
              </div>
              <Card>
                {types.map((type) => (
                  <div
                    key={type.id}
                    className="flex items-center justify-between gap-4 px-4 py-3.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[16px]">{type.emoji}</span>
                      <span className="text-[13px] font-medium text-fg">{type.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeType(type.id)}
                      className="text-[13px] text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </Card>
            </section>

            {/* Automation */}
            <section>
              <h2 className="mb-3 text-[13px] font-semibold text-fg">Automation</h2>
              <Card>
                <Row
                  title="Auto-assign to the on-call member"
                  description="New requests are assigned automatically"
                  control={
                    <Toggle
                      on={autoAssign}
                      onChange={(next) => setFeatureSetting('asks.autoAssign', next)}
                    />
                  }
                />
                <Row
                  title="Send the requester status updates"
                  description="Notify requesters when their issue changes status"
                  control={
                    <Toggle
                      on={notifyRequester}
                      onChange={(next) => setFeatureSetting('asks.notifyRequester', next)}
                    />
                  }
                />
              </Card>
            </section>
          </>
        ) : (
          <p className="text-[13px] text-muted">Turn on Asks to start receiving requests.</p>
        )}
      </div>
    </div>
  )
}
