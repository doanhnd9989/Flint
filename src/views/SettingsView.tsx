import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronDown, ChevronLeft, Search, Settings2 } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { Popover } from '@/components/ui/Popover'
import { Avatar } from '@/components/Avatar'
import { MembersSettings } from '@/components/MembersSettings'
import { LabelsSettings } from '@/components/LabelsSettings'
import { StatesSettings } from '@/components/StatesSettings'
import { TemplatesSettings } from '@/components/TemplatesSettings'
import { TeamsSettings } from '@/components/TeamsSettings'
import { ImportExportSettings } from '@/components/ImportExportSettings'
import { NotificationsSettings } from '@/components/NotificationsSettings'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import { ESTIMATION_TYPES } from '@/lib/constants'
import type { EstimationType, Preferences, ThemeMode } from '@/lib/types'

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

// ── Preferences building blocks (mirror Linear's setting cards) ──────────────
/** A bordered card grouping setting rows with hairline separators. */
function PrefCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {children}
    </div>
  )
}

/** One setting row: title + description on the left, a control on the right. */
function PrefRow({
  title,
  description,
  control,
}: {
  title: string
  description: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg">{title}</div>
        <div className="mt-0.5 text-[12px] text-muted">{description}</div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

/** Linear's pill toggle. */
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

interface DropOption {
  value: string
  label: string
  swatch?: React.ReactNode
}

/** A small dropdown control matching Linear's preference selects. */
function PrefDropdown({
  value,
  options,
  onSelect,
}: {
  value: string
  options: DropOption[]
  onSelect: (value: string) => void
}) {
  const current = options.find((o) => o.value === value)
  return (
    <Popover
      align="end"
      width={220}
      trigger={
        <span className="flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover">
          {current?.swatch}
          {current?.label ?? value}
          <ChevronDown size={14} className="text-faint" />
        </span>
      }
    >
      {(close) => (
        <div className="max-h-72 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onSelect(o.value)
                close()
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
            >
              {o.swatch}
              <span className="flex-1 truncate">{o.label}</span>
              {o.value === value && <Check size={14} className="text-fg" />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}

/** Tiny "Aa" theme swatch shown inside the theme dropdowns. */
function ThemeSwatch({ dark }: { dark: boolean }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-[11px] font-semibold',
        dark
          ? 'border-[#2a2a2e] bg-[#1a1a1e] text-white'
          : 'border-[#e6e6e6] bg-white text-black',
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      Aa
    </span>
  )
}

const THEME_OPTIONS: DropOption[] = [
  { value: 'light', label: 'Light', swatch: <ThemeSwatch dark={false} /> },
  { value: 'dark', label: 'Dark', swatch: <ThemeSwatch dark /> },
]

// ── individual setting pages ─────────────────────────────────────────────────
function PreferencesPage() {
  const { theme, setTheme, preferences, setPreference } = useStoreShallow((s) => ({
    theme: s.theme,
    setTheme: s.setTheme,
    preferences: s.preferences,
    setPreference: s.setPreference,
  }))
  const p = preferences
  const set = <K extends keyof Preferences>(key: K) => (v: Preferences[K]) =>
    setPreference(key, v)
  return (
    <Page title="Preferences">
      <Section title="General">
        <PrefCard>
          <PrefRow
            title="Default home view"
            description="Select which view to display when launching Linear"
            control={
              <PrefDropdown
                value={p.homeView}
                onSelect={(v) => set('homeView')(v as Preferences['homeView'])}
                options={[
                  { value: 'active', label: 'Active issues' },
                  { value: 'my-issues', label: 'My issues' },
                  { value: 'inbox', label: 'Inbox' },
                ]}
              />
            }
          />
          <PrefRow
            title="Display names"
            description="Select how names are displayed in the Linear interface"
            control={
              <PrefDropdown
                value={p.displayNames}
                onSelect={(v) => set('displayNames')(v as Preferences['displayNames'])}
                options={[
                  { value: 'full', label: 'Full name' },
                  { value: 'first', label: 'First name' },
                ]}
              />
            }
          />
          <PrefRow
            title="First day of the week"
            description="Used for date pickers"
            control={
              <PrefDropdown
                value={p.firstDayOfWeek}
                onSelect={(v) =>
                  set('firstDayOfWeek')(v as Preferences['firstDayOfWeek'])
                }
                options={[
                  { value: 'sunday', label: 'Sunday' },
                  { value: 'monday', label: 'Monday' },
                ]}
              />
            }
          />
          <PrefRow
            title="Convert text emoticons into emojis"
            description="Strings like :) will be converted to 🙂"
            control={
              <Toggle on={p.convertEmoticons} onChange={set('convertEmoticons')} />
            }
          />
          <PrefRow
            title="Send comment on..."
            description="Choose which key press is used to submit a comment"
            control={
              <PrefDropdown
                value={p.sendCommentOn}
                onSelect={(v) =>
                  set('sendCommentOn')(v as Preferences['sendCommentOn'])
                }
                options={[
                  { value: 'enter', label: 'Enter' },
                  { value: 'mod-enter', label: '⌘ + Enter' },
                ]}
              />
            }
          />
        </PrefCard>
      </Section>

      <Section title="Interface and theme">
        <PrefCard>
          <PrefRow
            title="App sidebar"
            description="Customize sidebar item visibility, ordering, and badge style"
            control={
              <span className="text-[13px] font-medium text-muted">Customize</span>
            }
          />
          <PrefRow
            title="Font size"
            description="Adjust the size of text across the app"
            control={
              <PrefDropdown
                value={p.fontSize}
                onSelect={(v) => set('fontSize')(v as Preferences['fontSize'])}
                options={[
                  { value: 'small', label: 'Small' },
                  { value: 'default', label: 'Default' },
                  { value: 'large', label: 'Large' },
                ]}
              />
            }
          />
          <PrefRow
            title="Use pointer cursors"
            description="Change the cursor to a pointer when hovering over any interactive elements"
            control={
              <Toggle on={p.pointerCursors} onChange={set('pointerCursors')} />
            }
          />
        </PrefCard>

        <div className="mt-3" />
        <PrefCard>
          <PrefRow
            title="Interface theme"
            description="Select or customize your interface color scheme"
            control={
              <PrefDropdown
                value={theme}
                onSelect={(v) => setTheme(v as ThemeMode)}
                options={[
                  {
                    value: 'system',
                    label: 'System preference',
                    swatch: <ThemeSwatch dark={false} />,
                  },
                  {
                    value: 'light',
                    label: 'Light',
                    swatch: <ThemeSwatch dark={false} />,
                  },
                  { value: 'dark', label: 'Dark', swatch: <ThemeSwatch dark /> },
                ]}
              />
            }
          />
          <PrefRow
            title="Light"
            description="Theme to use for light system appearance"
            control={
              <PrefDropdown
                value={p.lightTheme}
                onSelect={(v) => set('lightTheme')(v as Preferences['lightTheme'])}
                options={THEME_OPTIONS}
              />
            }
          />
          <PrefRow
            title="Dark"
            description="Theme to use for dark system appearance"
            control={
              <PrefDropdown
                value={p.darkTheme}
                onSelect={(v) => set('darkTheme')(v as Preferences['darkTheme'])}
                options={THEME_OPTIONS}
              />
            }
          />
        </PrefCard>
      </Section>

      <Section title="Desktop application">
        <PrefCard>
          <PrefRow
            title="Open in desktop app"
            description="Automatically open links in desktop app when possible"
            control={<Toggle on={p.openInDesktop} onChange={set('openInDesktop')} />}
          />
        </PrefCard>
      </Section>

      <Section title="Automations and workflows">
        <PrefCard>
          <PrefRow
            title="Auto-assign to self"
            description="When creating new issues, always assign them to yourself by default"
            control={<Toggle on={p.autoAssignSelf} onChange={set('autoAssignSelf')} />}
          />
          <PrefRow
            title="On move to started status, assign to yourself"
            description="When you move an unassigned issue to started, it will be automatically assigned to you"
            control={
              <Toggle on={p.assignSelfOnStart} onChange={set('assignSelfOnStart')} />
            }
          />
        </PrefCard>
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

/**
 * Per-team settings — Linear's "Your teams → {team}" page. General summary +
 * Estimates (scale + allow-zero) + Cycles (enable) + Workflow statuses.
 */
function TeamPage({ teamId }: { teamId: string }) {
  const { teams, issues, setTeamEstimation, setTeamCyclesEnabled } =
    useStoreShallow((s) => ({
      teams: s.teams,
      issues: s.issues,
      setTeamEstimation: s.setTeamEstimation,
      setTeamCyclesEnabled: s.setTeamCyclesEnabled,
    }))
  const team = teams.find((t) => t.id === teamId)
  if (!team) return <ComingSoon title="Team" />
  const issueCount = issues.filter((i) => i.teamId === team.id).length
  const type: EstimationType = team.estimationType ?? 'fibonacci'

  return (
    <Page title={team.name} description="Manage this team's settings.">
      <Section title="General">
        <PrefCard>
          <PrefRow
            title="Team icon & name"
            description={`${team.name} · ${issueCount} issues`}
            control={
              <span className="flex items-center gap-2 text-[20px]">
                {team.icon}
              </span>
            }
          />
          <PrefRow
            title="Identifier"
            description="Prefixed to every issue created in this team"
            control={
              <span className="rounded-md bg-bg-tertiary px-2 py-0.5 text-[13px] font-medium text-fg">
                {team.key}
              </span>
            }
          />
        </PrefCard>
      </Section>

      <Section title="Estimates">
        <PrefCard>
          <PrefRow
            title="Estimation type"
            description="Choose the scale used to estimate issues in this team"
            control={
              <PrefDropdown
                value={type}
                onSelect={(v) =>
                  setTeamEstimation(team.id, { estimationType: v as EstimationType })
                }
                options={ESTIMATION_TYPES.map((e) => ({
                  value: e.id,
                  label: e.example ? `${e.label} · ${e.example}` : e.label,
                }))}
              />
            }
          />
          <PrefRow
            title="Allow zero"
            description="Offer 0 as a selectable estimate value"
            control={
              <Toggle
                on={!!team.estimationAllowZero}
                onChange={(v) =>
                  setTeamEstimation(team.id, { estimationAllowZero: v })
                }
              />
            }
          />
        </PrefCard>
      </Section>

      <Section title="Cycles">
        <PrefCard>
          <PrefRow
            title="Enable cycles"
            description="Cycles are time-boxed sprints of issues for this team"
            control={
              <Toggle
                on={team.cyclesEnabled ?? true}
                onChange={(v) => setTeamCyclesEnabled(team.id, v)}
              />
            }
          />
        </PrefCard>
      </Section>

      <Section title="Workflow">
        <StatesSettings />
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
    case 'notifications':
      return <NotificationsSettings />
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
          <TeamPage teamId={page.slice('team-'.length)} />
        ) : (
          <SettingsContent page={page} />
        )}
      </div>
    </div>
  )
}
