import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Search, Settings2 } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { Avatar } from '@/components/Avatar'
import { MembersSettings } from '@/components/MembersSettings'
import { LabelsSettings } from '@/components/LabelsSettings'
import { StatesSettings } from '@/components/StatesSettings'
import { TemplatesSettings } from '@/components/TemplatesSettings'
import { TeamsSettings } from '@/components/TeamsSettings'
import { ImportExportSettings } from '@/components/ImportExportSettings'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import type { ThemeMode } from '@/lib/types'

// ── Settings navigation — mirrors Linear's Settings sidebar 1:1 ──────────────
// (workspace "Claude Test App"): groups Personal / Issues / Projects / Features
// / Administration / Your teams, in this exact order with these exact labels.
type NavItem = { id: string; label: string }
type NavGroup = { header: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    header: 'Personal',
    items: [
      { id: 'preferences', label: 'Preferences' },
      { id: 'profile', label: 'Profile' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'code-and-reviews', label: 'Code & reviews' },
      { id: 'security-access', label: 'Security & access' },
      { id: 'connected-accounts', label: 'Connected accounts' },
      { id: 'agent-personalization', label: 'Agent personalization' },
    ],
  },
  {
    header: 'Issues',
    items: [
      { id: 'issue-labels', label: 'Labels' },
      { id: 'issue-templates', label: 'Templates' },
      { id: 'slas', label: 'SLAs' },
    ],
  },
  {
    header: 'Projects',
    items: [
      { id: 'project-labels', label: 'Labels' },
      { id: 'project-templates', label: 'Templates' },
      { id: 'project-statuses', label: 'Statuses' },
      { id: 'project-updates', label: 'Updates' },
    ],
  },
  {
    header: 'Features',
    items: [
      { id: 'ai-agents', label: 'AI & Agents' },
      { id: 'initiatives', label: 'Initiatives' },
      { id: 'documents', label: 'Documents' },
      { id: 'customer-requests', label: 'Customer requests' },
      { id: 'releases', label: 'Releases' },
      { id: 'pulse', label: 'Pulse' },
      { id: 'asks', label: 'Asks' },
      { id: 'emojis', label: 'Emojis' },
      { id: 'integrations', label: 'Integrations' },
    ],
  },
  {
    header: 'Administration',
    items: [
      { id: 'workspace', label: 'Workspace' },
      { id: 'teams', label: 'Teams' },
      { id: 'members', label: 'Members' },
      { id: 'security', label: 'Security' },
      { id: 'api', label: 'API' },
      { id: 'applications', label: 'Applications' },
      { id: 'billing', label: 'Billing' },
    ],
  },
]

const THEMES: { id: ThemeMode; label: string; hint: string }[] = [
  { id: 'system', label: 'System', hint: 'Sync with your device' },
  { id: 'light', label: 'Light', hint: 'Always light' },
  { id: 'dark', label: 'Dark', hint: 'Always dark' },
]

// ── content scaffolding ──────────────────────────────────────────────────────
function Page({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">{title}</h1>
      {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
      <div className="mt-7 space-y-9">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && (
        <h2 className="mb-3 text-[13px] font-semibold text-fg">{title}</h2>
      )}
      {children}
    </section>
  )
}

// ── individual setting pages ─────────────────────────────────────────────────
function PreferencesPage() {
  const { theme, setTheme } = useStoreShallow((s) => ({
    theme: s.theme,
    setTheme: s.setTheme,
  }))
  return (
    <Page title="Preferences">
      <Section title="Interface and theme">
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition-colors',
                theme === t.id
                  ? 'border-accent ring-1 ring-accent'
                  : 'border-border hover:bg-bg-hover',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-full items-center justify-center rounded-md border text-[15px] font-semibold',
                  t.id === 'dark'
                    ? 'border-[#2a2a2e] bg-[#1a1a1e] text-white'
                    : t.id === 'light'
                      ? 'border-[#e6e6e6] bg-white text-black'
                      : 'border-border bg-gradient-to-r from-white to-[#1a1a1e] text-muted',
                )}
              >
                Aa
              </span>
              <span className="text-[13px] font-medium text-fg">{t.label}</span>
              <span className="text-[11px] text-faint">{t.hint}</span>
            </button>
          ))}
        </div>
      </Section>
    </Page>
  )
}

function ProfilePage() {
  const { users, currentUserId, updateUser } = useStoreShallow((s) => ({
    users: s.users,
    currentUserId: s.currentUserId,
    updateUser: s.updateUser,
  }))
  const me = users.find((u) => u.id === currentUserId)
  const [name, setName] = useState(me?.name ?? '')
  if (!me) return null
  return (
    <Page title="Profile" description="Manage your personal information.">
      <div className="flex items-center gap-4">
        <Avatar user={me} size={64} />
        <div>
          <div className="text-[15px] font-medium text-fg">{me.name}</div>
          <div className="text-[13px] text-faint">{me.email}</div>
        </div>
      </div>
      <Section title="Full name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => updateUser(me.id, { name: name.trim() || me.name })}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-fg outline-none focus:border-accent"
        />
      </Section>
      <Section title="Email">
        <input
          value={me.email}
          readOnly
          className="w-full cursor-default rounded-md border border-border bg-bg-secondary px-3 py-2 text-[13px] text-muted outline-none"
        />
      </Section>
    </Page>
  )
}

function WorkspacePage() {
  const { workspaceName, setWorkspaceName, resetWorkspace, teams, users, labels } =
    useStoreShallow((s) => ({
      workspaceName: s.workspaceName,
      setWorkspaceName: s.setWorkspaceName,
      resetWorkspace: s.resetWorkspace,
      teams: s.teams,
      users: s.users,
      labels: s.labels,
    }))
  const [name, setName] = useState(workspaceName)
  return (
    <Page title="Workspace" description="Manage your workspace settings.">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-xl font-bold text-white">
          {workspaceName.slice(0, 1)}
        </span>
        <div className="text-[12px] text-faint">
          {teams.length} teams · {users.length} members · {labels.length} labels
        </div>
      </div>
      <Section title="Workspace name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setWorkspaceName(name)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-fg outline-none focus:border-accent"
        />
      </Section>
      <Section title="Import & export">
        <ImportExportSettings />
      </Section>
      <Section title="Danger zone">
        <button
          onClick={() => {
            if (confirm('Reset the workspace to seed data? This clears your changes.'))
              resetWorkspace()
          }}
          className="rounded-md border border-[var(--priority-urgent)] px-3 py-1.5 text-[13px] text-[var(--priority-urgent)] hover:bg-[var(--priority-urgent)]/10"
        >
          Reset workspace
        </button>
      </Section>
    </Page>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col">
      <EmptyState
        illustration={<Settings2 size={34} strokeWidth={1.5} />}
        title={title}
        description="This settings section isn't available in this clone yet."
      />
    </div>
  )
}

function SettingsContent({ page }: { page: string }) {
  switch (page) {
    case 'preferences':
      return <PreferencesPage />
    case 'profile':
      return <ProfilePage />
    case 'issue-labels':
      return (
        <Page title="Labels" description="Labels can be used to organize and filter issues.">
          <LabelsSettings />
        </Page>
      )
    case 'issue-templates':
      return (
        <Page title="Templates" description="Templates pre-fill new issues to keep work consistent.">
          <TemplatesSettings />
        </Page>
      )
    case 'project-statuses':
      return (
        <Page title="Statuses" description="Configure the statuses an issue moves through.">
          <StatesSettings />
        </Page>
      )
    case 'workspace':
      return <WorkspacePage />
    case 'teams':
      return (
        <Page title="Teams" description="Teams group issues, cycles and members.">
          <TeamsSettings />
        </Page>
      )
    case 'members':
      return (
        <Page title="Members" description="Manage who has access to this workspace.">
          <MembersSettings />
        </Page>
      )
    default: {
      const label = NAV.flatMap((g) => g.items).find((i) => i.id === page)?.label ?? 'Settings'
      return <ComingSoon title={label} />
    }
  }
}

// ── shell ────────────────────────────────────────────────────────────────────
export function SettingsView() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const teamKey = useStore((s) => s.teams[0].key)
  const workspaceName = useStore((s) => s.workspaceName)
  const teams = useStore((s) => s.teams)
  const [query, setQuery] = useState('')

  const page = params.get('page') ?? 'preferences'
  const q = query.trim().toLowerCase()

  // The "Your teams" group is data-driven from the workspace's teams.
  const groups: NavGroup[] = [
    ...NAV,
    {
      header: 'Your teams',
      items: teams.map((t) => ({ id: `team-${t.id}`, label: t.name })),
    },
  ]
  const filtered = groups
    .map((g) => ({
      ...g,
      items: q ? g.items.filter((i) => i.label.toLowerCase().includes(q)) : g.items,
    }))
    .filter((g) => g.items.length > 0)

  function select(id: string) {
    setParams({ page: id }, { replace: false })
  }

  return (
    <div className="flex h-full w-full">
      {/* Settings nav — replaces the app sidebar */}
      <nav className="flex w-[240px] shrink-0 flex-col border-r border-border bg-bg">
        <div className="px-3 pb-1 pt-3.5">
          <button
            onClick={() => navigate(`/team/${teamKey}/active`)}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-muted hover:text-fg"
          >
            <ChevronLeft size={16} />
            Settings
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1.5 rounded-md bg-bg-secondary px-2 py-1.5">
            <Search size={13} className="text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {filtered.map((g) => (
            <div key={g.header} className="mb-3">
              <div className="px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
                {g.header}
              </div>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => select(item.id)}
                  className={cn(
                    'flex w-full items-center rounded-md px-1.5 py-1 text-left text-[13px]',
                    page === item.id
                      ? 'bg-bg-tertiary font-medium text-fg'
                      : 'text-muted hover:bg-bg-hover hover:text-fg',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-border px-4 py-2.5 text-[12px] text-faint">
          {workspaceName}
        </div>
      </nav>

      {/* Content pane */}
      <div className="flex-1 overflow-y-auto bg-bg-secondary">
        {page.startsWith('team-') ? (
          <Page title="Workflow" description="Statuses for this team's issues.">
            <StatesSettings />
          </Page>
        ) : (
          <SettingsContent page={page} />
        )}
      </div>
    </div>
  )
}
