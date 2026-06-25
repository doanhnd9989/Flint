import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
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

/** Customer requests (features) settings page. */
export function CustomerRequestsSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  const enabled = featureSettings['customerRequests.enabled'] ?? false
  const weightArr = featureSettings['customerRequests.weightArr'] ?? true

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Customer requests</h1>
      <p className="mt-1 text-[13px] text-muted">
        Capture customer feedback and link it to issues to prioritize what matters.
      </p>

      <div className="mt-7 space-y-9">
        {/* Master enable */}
        <Card>
          <Row
            title="Enable customer requests"
            description="Link customer feedback to issues across your workspace"
            control={
              <Toggle
                on={enabled}
                onChange={(next) => setFeatureSetting('customerRequests.enabled', next)}
              />
            }
          />
        </Card>

        {!enabled && (
          <p className="text-[13px] text-muted">
            Turn on customer requests to configure sources and prioritization.
          </p>
        )}

        {enabled && (
          <>
            {/* Sources */}
            <section>
              <h2 className="mb-3 text-[13px] font-semibold text-fg">Sources</h2>
              <Card>
                <Row
                  title="Slack"
                  description="Capture requests from Slack messages"
                  control={
                    <Toggle
                      on={featureSettings['customerRequests.slack'] ?? false}
                      onChange={(next) => setFeatureSetting('customerRequests.slack', next)}
                    />
                  }
                />
                <Row
                  title="Intercom"
                  description="Sync conversations from Intercom"
                  control={
                    <Toggle
                      on={featureSettings['customerRequests.intercom'] ?? false}
                      onChange={(next) => setFeatureSetting('customerRequests.intercom', next)}
                    />
                  }
                />
                <Row
                  title="Email forwarding"
                  description="Forward customer emails to create requests"
                  control={
                    <Toggle
                      on={featureSettings['customerRequests.email'] ?? false}
                      onChange={(next) => setFeatureSetting('customerRequests.email', next)}
                    />
                  }
                />
                <Row
                  title="Public portal"
                  description="Let customers submit requests from a public page"
                  control={
                    <Toggle
                      on={featureSettings['customerRequests.portal'] ?? false}
                      onChange={(next) => setFeatureSetting('customerRequests.portal', next)}
                    />
                  }
                />
              </Card>
            </section>

            {/* Prioritization */}
            <section>
              <h2 className="mb-3 text-[13px] font-semibold text-fg">Prioritization</h2>
              <Card>
                <Row
                  title="Weight requests by customer revenue (ARR)"
                  description="Surface requests from higher-value customers first"
                  control={
                    <Toggle
                      on={weightArr}
                      onChange={(next) => setFeatureSetting('customerRequests.weightArr', next)}
                    />
                  }
                />
                <Row
                  title="Default customer tier"
                  description="Tier applied to new customers without a set value"
                  control={
                    <span className="flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[13px] font-medium text-fg">
                      Enterprise
                      <ChevronDown size={14} className="text-faint" />
                    </span>
                  }
                />
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
