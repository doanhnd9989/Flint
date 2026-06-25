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

type SlaRule = { id: string; priority: string; target: string }

const genId = () => Math.random().toString(36).slice(2, 9)

/** Colored pill classes per priority. */
const PRIORITY_PILL: Record<string, string> = {
  Urgent: 'bg-red-500/10 text-red-500',
  High: 'bg-orange-500/10 text-orange-500',
  Medium: 'bg-yellow-500/10 text-yellow-600',
  Low: 'bg-blue-500/10 text-blue-500',
}

/** SLAs (issues) settings page. */
export function SlaSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  const enabled = featureSettings['sla.enabled'] ?? false

  const [rules, setRules] = useState<SlaRule[]>([
    { id: genId(), priority: 'Urgent', target: '4 hours' },
    { id: genId(), priority: 'High', target: '1 day' },
    { id: genId(), priority: 'Medium', target: '3 days' },
  ])

  const addRule = () =>
    setRules((prev) => [...prev, { id: genId(), priority: 'Low', target: '1 week' }])

  const removeRule = (id: string) => setRules((prev) => prev.filter((r) => r.id !== id))

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">SLAs</h1>
      <p className="mt-1 text-[13px] text-muted">
        Set service level agreements so issues are resolved within a target time.
      </p>

      <div className="mt-7 space-y-9">
        {/* Master enable */}
        <Card>
          <Row
            title="Enable SLAs"
            description="Track time-to-resolution targets on issues"
            control={
              <Toggle on={enabled} onChange={(next) => setFeatureSetting('sla.enabled', next)} />
            }
          />
        </Card>

        {/* SLA rules — only when enabled */}
        {enabled && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-fg">SLA rules</h2>
              <button
                type="button"
                onClick={addRule}
                className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
              >
                <Plus size={14} />
                Add SLA
              </button>
            </div>
            <Card>
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[11px] font-medium',
                        PRIORITY_PILL[rule.priority] ?? 'bg-bg-tertiary text-muted',
                      )}
                    >
                      {rule.priority}
                    </span>
                    <span className="text-[13px] text-fg">Resolve within {rule.target}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRule(rule.id)}
                    className="text-[12px] text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </Card>
          </section>
        )}
      </div>
    </div>
  )
}
