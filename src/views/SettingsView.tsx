import { useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { LabelsSettings } from '@/components/LabelsSettings'
import { StatesSettings } from '@/components/StatesSettings'
import { TemplatesSettings } from '@/components/TemplatesSettings'
import { TeamsSettings } from '@/components/TeamsSettings'
import { cn } from '@/lib/utils'
import type { ThemeMode } from '@/lib/types'

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
]

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-bg-secondary p-4">
      <h2 className="mb-3 text-[13px] font-semibold text-fg">{title}</h2>
      {children}
    </section>
  )
}

export function SettingsView() {
  const { theme, setTheme, workspaceName, users, teams, labels, resetWorkspace } =
    useStoreShallow((s) => ({
      theme: s.theme,
      setTheme: s.setTheme,
      workspaceName: s.workspaceName,
      users: s.users,
      teams: s.teams,
      labels: s.labels,
      resetWorkspace: s.resetWorkspace,
    }))

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Settings" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <Card title="Workspace">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-lg font-bold text-white">
                {workspaceName.slice(0, 1)}
              </span>
              <div>
                <div className="text-[14px] font-medium text-fg">{workspaceName}</div>
                <div className="text-[12px] text-faint">
                  {teams.length} teams · {users.length} members · {labels.length} labels
                </div>
              </div>
            </div>
          </Card>

          <Card title="Appearance">
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-[13px]',
                    theme === t.id
                      ? 'border-accent bg-accent-subtle text-fg'
                      : 'border-border text-muted hover:bg-bg-hover',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Members">
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-2">
                  <Avatar user={u} size={26} />
                  <div className="flex-1">
                    <div className="text-[13px] text-fg">
                      {u.name} {u.isMe && <span className="text-faint">(you)</span>}
                    </div>
                    <div className="text-[11px] text-faint">{u.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Teams">
            <TeamsSettings />
          </Card>

          <Card title="Workflow states">
            <StatesSettings />
          </Card>

          <Card title="Labels">
            <LabelsSettings />
          </Card>

          <Card title="Templates">
            <TemplatesSettings />
          </Card>

          <Card title="Danger zone">
            <button
              onClick={() => {
                if (confirm('Reset the workspace to seed data? This clears your changes.'))
                  resetWorkspace()
              }}
              className="rounded-md border border-[var(--priority-urgent)] px-3 py-1.5 text-[13px] text-[var(--priority-urgent)] hover:bg-[var(--priority-urgent)]/10"
            >
              Reset workspace
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}
