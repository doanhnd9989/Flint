import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Search,
  Code2,
  GitBranch,
  MessageSquare,
  PenTool,
  Bug,
  LifeBuoy,
  MessageCircle,
  FileText,
  Calendar,
  Zap,
  Kanban,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

type Integration = {
  id: string
  name: string
  desc: string
  icon: LucideIcon
  color: string
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'github',
    name: 'GitHub',
    desc: 'Link pull requests, commits and branches to issues automatically.',
    icon: Code2,
    color: '#F0F6FC',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    desc: 'Connect merge requests and commits to keep issues in sync.',
    icon: GitBranch,
    color: '#FC6D26',
  },
  {
    id: 'slack',
    name: 'Slack',
    desc: 'Create issues from messages and get notified in your channels.',
    icon: MessageSquare,
    color: '#4A154B',
  },
  {
    id: 'figma',
    name: 'Figma',
    desc: 'Embed live design previews directly inside your issues.',
    icon: PenTool,
    color: '#F24E1E',
  },
  {
    id: 'sentry',
    name: 'Sentry',
    desc: 'Turn application errors into actionable, trackable issues.',
    icon: Bug,
    color: '#362D59',
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    desc: 'Convert customer support tickets into prioritized issues.',
    icon: LifeBuoy,
    color: '#03363D',
  },
  {
    id: 'discord',
    name: 'Discord',
    desc: 'Receive update notifications and create issues from chat.',
    icon: MessageCircle,
    color: '#5865F2',
  },
  {
    id: 'notion',
    name: 'Notion',
    desc: 'Link Notion documents and sync project specs to your issues.',
    icon: FileText,
    color: '#E6E6E6',
  },
  {
    id: 'google',
    name: 'Google Calendar',
    desc: 'Sync cycle dates and project milestones with your calendar.',
    icon: Calendar,
    color: '#4285F4',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    desc: 'Automate workflows by connecting Flint to 5,000+ apps.',
    icon: Zap,
    color: '#FF4A00',
  },
  {
    id: 'jira',
    name: 'Jira',
    desc: 'Import existing projects and keep issues in sync with Jira.',
    icon: Kanban,
    color: '#2684FF',
  },
]

export function IntegrationsSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const visible = q
    ? INTEGRATIONS.filter((i) => i.name.toLowerCase().includes(q))
    : INTEGRATIONS

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">
        Integrations
      </h1>
      <p className="mt-1 text-[13px] text-muted">
        Connect Flint to the tools your team already uses.
      </p>

      <div className="mt-7 space-y-9">
        <div className="flex items-center gap-1.5 rounded-md bg-bg-secondary px-2 py-1.5">
          <Search size={13} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search integrations…"
            className="w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {visible.map((integration) => {
            const key = `integrations.${integration.id}`
            const connected = featureSettings[key] ?? false
            const Icon = integration.icon
            return (
              <div
                key={integration.id}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-secondary">
                    <Icon size={16} color={integration.color} />
                  </div>
                  {!connected && (
                    <button
                      type="button"
                      onClick={() => setFeatureSetting(key, true)}
                      className="rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[12px] font-medium text-fg hover:bg-bg-hover"
                    >
                      Connect
                    </button>
                  )}
                </div>

                <div className="mt-3 text-[13px] font-medium text-fg">
                  {integration.name}
                </div>
                <p className="mt-2 text-[12px] text-muted">{integration.desc}</p>

                {connected && (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[12px] text-muted">
                      <span className="text-emerald-500">●</span>
                      Connected
                    </span>
                    <button
                      type="button"
                      onClick={() => setFeatureSetting(key, false)}
                      className={cn(
                        'text-[12px] font-medium text-muted hover:text-fg',
                      )}
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
