import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ── Settings → Agent personalization (mirrors Linear's personal AI agent page) ──

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

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-secondary">
      {children}
    </div>
  )
}

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
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg">{title}</div>
        {description && (
          <div className="mt-0.5 text-[12px] text-muted">{description}</div>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

const TONES = ['Concise', 'Balanced', 'Detailed'] as const

export function AgentPersonalizationSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  const get = (key: string, fallback: boolean) => featureSettings[key] ?? fallback
  const toggle = (key: string, fallback: boolean) => (
    <Toggle on={get(key, fallback)} onChange={(v) => setFeatureSetting(key, v)} />
  )

  // Session-local only — tone + custom instructions are ephemeral, not persisted.
  const [tone, setTone] = useState<(typeof TONES)[number]>('Balanced')
  const [instructions, setInstructions] = useState('')

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">
        Agent personalization
      </h1>
      <p className="mt-1 text-[13px] text-muted">
        Tune how Flint's AI agent drafts, summarizes and suggests on your behalf.
      </p>

      <div className="mt-7 space-y-9">
        {/* ── Assistance ── */}
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-fg">
            <Sparkles size={13} className="text-muted" />
            Assistance
          </h2>
          <Card>
            <Row
              title="Suggest sub-issues and acceptance criteria"
              control={toggle('agent.suggestSubissues', true)}
            />
            <Row
              title="Auto-summarize long comment threads"
              control={toggle('agent.summarize', true)}
            />
            <Row
              title="Suggest assignees and labels on new issues"
              control={toggle('agent.autotag', true)}
            />
            <Row
              title="Draft project updates"
              control={toggle('agent.draftUpdates', false)}
            />
          </Card>
        </section>

        {/* ── Tone ── */}
        <section>
          <h2 className="mb-2 text-[13px] font-semibold text-fg">Tone</h2>
          <Card>
            <Row
              title="Response tone"
              description="How the agent writes for you"
              control={
                <div className="flex rounded-md bg-bg-secondary p-0.5">
                  {TONES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTone(t)}
                      className={cn(
                        'rounded px-2 py-1 text-[12px] transition-colors',
                        t === tone
                          ? 'bg-bg-elevated text-fg shadow-sm'
                          : 'text-muted',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              }
            />
          </Card>
        </section>

        {/* ── Custom instructions ── */}
        <section>
          <h2 className="mb-1 text-[13px] font-semibold text-fg">
            Custom instructions
          </h2>
          <p className="mb-3 text-[12px] text-muted">
            Standing guidance the agent applies to everything it writes for you.
          </p>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Always reference the linked Figma file and keep summaries under 3 sentences."
            className="min-h-[120px] w-full rounded-xl border border-border bg-bg p-3 text-[13px] text-fg outline-none focus:border-accent placeholder:text-faint"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[12px] text-muted">
              These instructions are included with every agent request.
            </span>
            <button
              type="button"
              className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white"
            >
              Save
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
