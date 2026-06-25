import { Bot } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ── Settings → AI & Agents (mirrors Linear's workspace AI & Agents page) ──

const AGENTS = [
  { id: 'flint', name: 'Flint Agent', desc: 'Triages and drafts issues', status: 'Active' },
  { id: 'pr', name: 'PR Reviewer', desc: 'Summarizes pull requests', status: 'Active' },
  { id: 'standup', name: 'Standup Bot', desc: 'Posts daily summaries to Slack', status: 'Paused' },
] as const

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
  icon,
  title,
  description,
  control,
}: {
  icon?: ReactNode
  title: string
  description?: string
  control: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-fg">{title}</div>
          {description && (
            <div className="mt-0.5 text-[12px] text-muted">{description}</div>
          )}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function AiAgentsSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  const get = (key: string, fallback: boolean) => featureSettings[key] ?? fallback
  const toggle = (key: string, fallback: boolean) => (
    <Toggle on={get(key, fallback)} onChange={(v) => setFeatureSetting(key, v)} />
  )

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">AI &amp; Agents</h1>
      <p className="mt-1 text-[13px] text-muted">
        Enable AI features and manage the agents working in your workspace.
      </p>

      <div className="mt-7 space-y-9">
        {/* AI features */}
        <Card>
          <Row
            title="Enable Flint AI"
            description="Workspace-wide AI summaries, search and suggestions."
            control={toggle('ai.enabled', true)}
          />
          <Row
            title="Semantic search"
            description="Find issues by meaning, not just keywords."
            control={toggle('ai.search', true)}
          />
          <Row
            title="Similar issues & duplicate detection"
            description="Surface related work and flag likely duplicates as you type."
            control={toggle('ai.dedupe', true)}
          />
          <Row
            title="AI issue triage"
            description="Automatically label and route incoming issues."
            control={toggle('ai.triage', false)}
          />
        </Card>

        {/* Agents */}
        <div>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Agents</h2>
          <p className="mb-3 text-[13px] text-muted">
            Agents can be assigned issues and act autonomously.
          </p>
          <Card>
            {AGENTS.map((agent) => (
              <Row
                key={agent.id}
                icon={
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-secondary">
                    <Bot size={16} className="text-muted" />
                  </span>
                }
                title={agent.name}
                description={agent.desc}
                control={
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      agent.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-bg-tertiary text-muted',
                    )}
                  >
                    {agent.status}
                  </span>
                }
              />
            ))}
          </Card>
          <button
            type="button"
            className="mt-3 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Add agent
          </button>
        </div>
      </div>
    </div>
  )
}
