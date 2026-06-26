import { NavLink, useNavigate } from 'react-router-dom'
import {
  Inbox,
  Box,
  LayersIcon,
  Search,
  Settings,
  PenSquare,
  ChevronDown,
  CircleDot,
  FolderKanban,
  Layers3,
  IterationCw,
  Ticket,
  Goal,
  FileText,
  Map as MapIcon,
  BarChart3,
  Activity,
  Home,
  Building2,
  Rocket,
  Users,
  Megaphone,
  CircleUser,
  Copy,
  History,
  Star,
  Archive,
  Bell,
  Tag as TagIcon,
  Plus,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useStoreShallow } from '@/lib/store'

/** GitHub octocat mark (lucide dropped brand icons) — matches Linear's row. */
function GithubMark({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}
import { Popover } from './ui/Popover'
import { cn } from '@/lib/utils'

function Item({
  to,
  icon,
  label,
  badge,
  onClick,
}: {
  to?: string
  icon: ReactNode
  label: string
  badge?: number
  onClick?: () => void
}) {
  const base =
    'flex items-center gap-2 rounded-md px-2 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg transition-colors w-full'
  const inner = (
    <>
      <span className="flex h-4 w-4 items-center justify-center text-faint">
        {icon}
      </span>
      <span className="flex-1 truncate text-left">{label}</span>
      {badge ? (
        <span className="rounded bg-bg-tertiary px-1 text-[11px] text-muted">
          {badge}
        </span>
      ) : null}
    </>
  )
  if (to) {
    return (
      <NavLink
        to={to}
        className={({ isActive }) =>
          cn(base, isActive && 'bg-bg-selected text-fg font-medium')
        }
      >
        {inner}
      </NavLink>
    )
  }
  return (
    <button type="button" onClick={onClick} className={base}>
      {inner}
    </button>
  )
}

/** A "Try" onboarding row: leading icon + label, click runs the action, and a
 *  dismiss × appears on hover (mirrors Linear's getting-started section). */
function TryItem({
  icon,
  label,
  onClick,
  onDismiss,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  onDismiss: () => void
}) {
  return (
    <div className="group/try relative">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 pr-7 text-[13px] text-muted hover:bg-bg-hover hover:text-fg transition-colors"
      >
        <span className="flex h-4 w-4 items-center justify-center text-faint">
          {icon}
        </span>
        <span className="flex-1 truncate text-left">{label}</span>
      </button>
      <button
        type="button"
        title="Dismiss"
        onClick={(e) => {
          e.stopPropagation()
          onDismiss()
        }}
        className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-tertiary hover:text-fg group-hover/try:opacity-100"
      >
        <X size={13} />
      </button>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-faint hover:text-muted"
      >
        <ChevronDown
          size={12}
          className={cn('transition-transform', !open && '-rotate-90')}
        />
        {title}
      </button>
      {open && <div className="mt-0.5 space-y-px">{children}</div>}
    </div>
  )
}

export function Sidebar() {
  const navigate = useNavigate()
  const {
    workspaceName,
    teams,
    notifications,
    issues,
    projects,
    savedViews,
    favorites,
    users,
    onboardingDismissed,
    setCreateOpen,
    dismissOnboardingStep,
  } = useStoreShallow((s) => ({
    workspaceName: s.workspaceName,
    teams: s.teams,
    notifications: s.notifications,
    issues: s.issues,
    projects: s.projects,
    savedViews: s.savedViews,
    favorites: s.favorites,
    users: s.users,
    onboardingDismissed: s.onboardingDismissed,
    setCreateOpen: s.setCreateOpen,
    dismissOnboardingStep: s.dismissOnboardingStep,
  }))

  // Linear's "Try" getting-started section. Each step is hidden once the user
  // dismisses it (×) or completes the underlying action; the section disappears
  // when none remain.
  const trySteps = [
    {
      key: 'import',
      icon: <Copy size={15} />,
      label: 'Import issues',
      done: false,
      action: () => navigate('/settings'),
    },
    {
      key: 'invite',
      icon: <Plus size={15} />,
      label: 'Invite people',
      done: users.some((u) => u.pending),
      action: () => navigate('/settings'),
    },
    {
      key: 'github',
      icon: <GithubMark />,
      label: 'Connect GitHub',
      done: false,
      action: () => navigate('/settings'),
    },
  ].filter((s) => !s.done && !onboardingDismissed.includes(s.key))

  const favoriteItems = favorites
    .map((f) => {
      if (f.type === 'issue') {
        const i = issues.find((x) => x.id === f.id)
        return i ? { to: `/issue/${i.identifier}`, icon: <CircleDot size={15} />, label: i.title } : null
      }
      if (f.type === 'project') {
        const p = projects.find((x) => x.id === f.id)
        return p ? { to: `/project/${p.id}`, icon: <span className="text-[13px]">{p.icon}</span>, label: p.name } : null
      }
      const v = savedViews.find((x) => x.id === f.id)
      return v ? { to: `/view/${v.id}`, icon: <LayersIcon size={15} />, label: v.name } : null
    })
    .filter(Boolean) as { to: string; icon: ReactNode; label: string }[]
  const unread = notifications.filter(
    (n) => !n.read && !(n.snoozedUntil && new Date(n.snoozedUntil).getTime() > Date.now()),
  ).length

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-bg-sidebar">
      {/* Workspace header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex-1">
          <Popover
            align="start"
            width={220}
            trigger={
              <span className="flex w-full items-center gap-2 rounded-md px-1 py-1 hover:bg-bg-hover">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-accent text-[11px] font-bold text-white">
                  {workspaceName.slice(0, 1)}
                </span>
                <span className="truncate text-[13px] font-semibold text-fg">
                  {workspaceName}
                </span>
                <ChevronDown size={14} className="text-faint" />
              </span>
            }
          >
            {(close) => (
              <div>
                <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                  Teams
                </div>
                {teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => {
                      close()
                      navigate(`/team/${team.key}/active`)
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
                  >
                    <span>{team.icon}</span>
                    <span className="flex-1 truncate">{team.name}</span>
                    <span className="text-[11px] text-faint">{team.key}</span>
                  </button>
                ))}
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  onClick={() => {
                    close()
                    navigate('/settings')
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
                >
                  <Settings size={14} className="text-faint" /> Settings
                </button>
              </div>
            )}
          </Popover>
        </div>
        <button
          type="button"
          title="New issue"
          onClick={() => setCreateOpen(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg"
        >
          <PenSquare size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="space-y-px">
          <Item to="/search" icon={<Search size={15} />} label="Search" />
          <Item to="/inbox" icon={<Inbox size={15} />} label="Inbox" badge={unread} />
          <Item to="/my-issues" icon={<CircleDot size={15} />} label="My Issues" />
          <Item to="/recent" icon={<History size={15} />} label="Recent" />
          <Item to="/reminders" icon={<Bell size={15} />} label="Reminders" />
          <Item to="/profile" icon={<CircleUser size={15} />} label="Profile" />
        </div>

        {favoriteItems.length > 0 && (
          <Section title="Favorites">
            {favoriteItems.map((f) => (
              <Item key={f.to} to={f.to} icon={f.icon} label={f.label} />
            ))}
          </Section>
        )}

        <Section title="Workspace">
          <Item to="/all-issues" icon={<Layers3 size={15} />} label="All issues" />
          <Item to="/initiatives" icon={<Goal size={15} />} label="Initiatives" />
          <Item to="/projects" icon={<Box size={15} />} label="Projects" />
          <Item to="/customers" icon={<Building2 size={15} />} label="Customers" />
          <Item to="/releases" icon={<Rocket size={15} />} label="Releases" />
          <Item to="/members" icon={<Users size={15} />} label="Members" />
          <Item to="/documents" icon={<FileText size={15} />} label="Documents" />
          <Item to="/roadmap" icon={<MapIcon size={15} />} label="Roadmap" />
          <Item to="/changelog" icon={<Megaphone size={15} />} label="Changelog" />
          <Item to="/cycles" icon={<IterationCw size={15} />} label="Cycles" />
          <Item to="/pulse" icon={<Activity size={15} />} label="Pulse" />
          <Item to="/insights" icon={<BarChart3 size={15} />} label="Insights" />
          <Item to="/views" icon={<LayersIcon size={15} />} label="Views" />
          <Item to="/labels" icon={<TagIcon size={15} />} label="Labels" />
          <Item to="/teams" icon={<Building2 size={15} />} label="Teams" />
          <Item to="/favorites" icon={<Star size={15} />} label="Favorites" />
          <Item to="/archive" icon={<Archive size={15} />} label="Archive" />
        </Section>

        {teams.map((team) => (
          <Section key={team.id} title={team.name}>
            <Item
              to={`/team/${team.key}/overview`}
              icon={<Home size={15} />}
              label="Overview"
            />
            <Item
              to={`/team/${team.key}/triage`}
              icon={<Ticket size={15} />}
              label="Triage"
              badge={issues.filter((i) => i.teamId === team.id && i.triage && !i.archivedAt).length}
            />
            <Item
              to={`/team/${team.key}/active`}
              icon={<Layers3 size={15} />}
              label="Issues"
            />
            {(team.cyclesEnabled ?? true) && (
              <Item
                to={`/team/${team.key}/cycles`}
                icon={<IterationCw size={15} />}
                label="Cycles"
              />
            )}
            <Item
              to={`/team/${team.key}/projects`}
              icon={<FolderKanban size={15} />}
              label="Projects"
            />
          </Section>
        ))}

        {trySteps.length > 0 && (
          <Section title="Try">
            {trySteps.map((s) => (
              <TryItem
                key={s.key}
                icon={s.icon}
                label={s.label}
                onClick={s.action}
                onDismiss={() => dismissOnboardingStep(s.key)}
              />
            ))}
          </Section>
        )}
      </div>

      <div className="border-t border-border px-2 py-2">
        <Item to="/settings" icon={<Settings size={15} />} label="Settings" />
      </div>
    </aside>
  )
}
