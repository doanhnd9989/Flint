import { NavLink, useNavigate } from 'react-router-dom'
import {
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
  Home,
  Copy,
  MoreHorizontal,
  SlidersHorizontal,
  Plus,
  X,
  Pin,
  PanelLeftClose,
  Shield,
  LogOut,
  KeyRound,
  UserPlus,
  Monitor,
  ArrowLeftRight,
  Check,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useStore, useStoreShallow } from '@/lib/store'
import { useAuth, useFeature } from '@/lib/auth'
import { orderedSidebarItems, type SidebarItemDef } from '@/lib/constants'
import type { Team } from '@/lib/types'
import { sidebarItemIcon } from './sidebarIcons'
import { TeamContextMenu } from './TeamContextMenu'

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

/** A row in one of the sidebar's popover menus, with Linear's right-aligned
 *  shortcut hint. */
function MenuRow({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </button>
  )
}

/**
 * "Switch workspace ▸" in the workspace menu — a hover flyout listing every
 * workspace with a check beside the current one, then Linear's "Create or join
 * a workspace" at the foot. This build is single-workspace, so the list has one
 * entry; the shape is Linear's so a second workspace slots straight in.
 */
function SwitchWorkspaceRow() {
  const workspaceName = useStore((s) => s.workspaceName)
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover">
        <ArrowLeftRight size={14} className="text-faint" />
        <span className="flex-1 truncate">Switch workspace</span>
        <span className="text-[11px] text-faint">O then W</span>
      </span>
      {open && (
        <div className="absolute left-full top-0 ml-1 w-[220px] rounded-lg border border-border bg-bg-elevated p-1 shadow-lg">
          <span className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-fg hover:bg-bg-hover">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-accent text-[10px] font-bold text-white">
              {workspaceName.slice(0, 1)}
            </span>
            <span className="flex-1 truncate">{workspaceName}</span>
            <Check size={13} className="text-faint" />
          </span>
          <div className="my-1 h-px bg-border" />
          <span className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted hover:bg-bg-hover">
            <Plus size={14} className="text-faint" />
            <span className="flex-1 truncate">Create or join a workspace</span>
          </span>
        </div>
      )}
    </div>
  )
}

function Item({
  to,
  icon,
  label,
  badge,
  onClick,
  indent,
}: {
  to?: string
  icon: ReactNode
  label: string
  badge?: number
  onClick?: () => void
  /** Nested one level under a team, the way Linear indents a team's rows. */
  indent?: boolean
}) {
  // Preferences → "Show counts in sidebar" (defaults on for older workspaces).
  const showCounts = useStore((s) => s.preferences.showSidebarCounts !== false)
  // Customize sidebar → "Default badge style": a count chip or a plain dot.
  const badgeStyle = useStore((s) => s.sidebarPrefs.badgeStyle)
  const base = cn(
    'flex items-center gap-2 rounded-md py-1 pr-2 text-[13px] text-muted hover:bg-bg-hover hover:text-fg transition-colors w-full',
    indent ? 'pl-[25px]' : 'pl-2',
  )
  const inner = (
    <>
      <span className="flex h-4 w-4 items-center justify-center text-faint">
        {icon}
      </span>
      <span className="flex-1 truncate text-left">{label}</span>
      {badge && showCounts ? (
        badgeStyle === 'dot' ? (
          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-accent" />
        ) : (
          <span className="rounded bg-bg-tertiary px-1 text-[11px] text-muted">
            {badge}
          </span>
        )
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

/** An Item that the admin can hide via a feature flag. Renders nothing when the
 *  flag is disabled. Unknown flags default to enabled (useFeature). */
function FlagItem({
  flag,
  ...props
}: {
  flag: string
  to: string
  icon: ReactNode
  label: string
  indent?: boolean
}) {
  const enabled = useFeature(flag)
  if (!enabled) return null
  return <Item {...props} />
}

/**
 * An indented child row (Linear nests Current / Upcoming under Cycles). It has
 * no icon, so its padding is the indented row's plus the icon column (16px) and
 * gap (8px) — that lands the label on the same x as its icon-bearing siblings,
 * which is how Linear aligns them.
 */
function SubItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-md py-1 pl-[49px] pr-2 text-[13px] text-muted hover:bg-bg-hover hover:text-fg transition-colors',
          isActive && 'bg-bg-selected text-fg font-medium',
        )
      }
    >
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

/**
 * A configurable navigation row. Beyond the feature flag it also honours the
 * user's Customize-sidebar choice: `hidden` rows move into the More menu and
 * `badged` rows only appear while they carry a badge.
 */
function RegistryItem({ item, badge }: { item: SidebarItemDef; badge?: number }) {
  const visibility = useStore(
    (s) => s.sidebarPrefs.visibility[item.key] ?? item.visibility,
  )
  const enabled = useFeature(item.flag ?? '')
  if (item.flag && !enabled) return null
  if (visibility === 'hidden') return null
  if (visibility === 'badged' && !badge) return null
  return (
    <Item to={item.to} icon={sidebarItemIcon(item.key)} label={item.label} badge={badge} />
  )
}

/**
 * Linear's "More" row at the end of the Workspace section: everything the user
 * set to "Don't show", plus the Customize sidebar entry.
 */
function MoreMenu({ hidden }: { hidden: SidebarItemDef[] }) {
  const navigate = useNavigate()
  const openCustomize = useStore((s) => s.setCustomizeSidebarOpen)
  return (
    <Popover
      align="start"
      width={220}
      trigger={
        <span className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg transition-colors">
          <span className="flex h-4 w-4 items-center justify-center text-faint">
            <MoreHorizontal size={15} />
          </span>
          <span className="flex-1 truncate text-left">More</span>
        </span>
      }
    >
      {(close) => (
        <div>
          {hidden.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                close()
                navigate(item.to)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
            >
              <span className="flex h-4 w-4 items-center justify-center text-faint">
                {sidebarItemIcon(item.key, 14)}
              </span>
              {item.label}
            </button>
          ))}
          {hidden.length > 0 && <div className="my-1 h-px bg-border" />}
          <button
            type="button"
            onClick={() => {
              close()
              openCustomize(true)
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
          >
            <SlidersHorizontal size={14} className="text-faint" /> Customize sidebar
          </button>
        </div>
      )}
    </Popover>
  )
}

/** The rows of a configurable section, in the user's saved order, with rows
 *  whose workspace feature flag is off dropped. */
function useSectionItems(section: 'personal' | 'workspace') {
  const order = useStore((s) => s.sidebarPrefs.order[section])
  const flags = useAuth((s) => s.flags)
  return orderedSidebarItems(section, order).filter(
    (i) => !i.flag || (flags[i.flag] ?? true),
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
  sectionKey,
  children,
}: {
  title: string
  /** Stable key persisted in store.collapsedSidebarSections (absent = expanded). */
  sectionKey: string
  children: ReactNode
}) {
  const collapsed = useStore((s) => s.collapsedSidebarSections)
  const toggle = useStore((s) => s.toggleSidebarSection)
  const open = !collapsed.includes(sectionKey)
  return (
    <div className="mt-4">
      {/* Linear's section header: sentence case, and the caret sits *after* the
          label, appearing on hover — not as a leading chevron. */}
      <button
        type="button"
        onClick={() => toggle(sectionKey)}
        className="group flex w-full items-center gap-1 py-1 pl-[13px] pr-1 text-[12px] font-medium text-faint hover:text-muted"
      >
        {title}
        <ChevronDown
          size={12}
          className={cn(
            'transition-transform opacity-0 group-hover:opacity-100',
            !open && '-rotate-90 opacity-100',
          )}
        />
      </button>
      {open && <div className="mt-0.5 space-y-px">{children}</div>}
    </div>
  )
}

/**
 * One team in the sidebar's "Your teams" section. Unlike a Section header the
 * team is a full row — icon, name in sentence case, caret on hover — and its
 * children are indented one level under it, as Linear nests them.
 */
function TeamGroup({ team, children }: { team: Team; children: ReactNode }) {
  const collapsed = useStore((s) => s.collapsedSidebarSections)
  const toggle = useStore((s) => s.toggleSidebarSection)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const key = `team:${team.id}`
  const open = !collapsed.includes(key)
  return (
    <div>
      <button
        type="button"
        onClick={() => toggle(key)}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        className="group flex w-full items-center gap-2 rounded-md px-2 py-1 text-[13px] font-medium text-fg hover:bg-bg-hover"
      >
        <span className="flex h-4 w-4 items-center justify-center text-[13px]">
          {team.icon}
        </span>
        <span className="flex-1 truncate text-left">{team.name}</span>
        <ChevronDown
          size={12}
          className={cn(
            'text-faint transition-transform opacity-0 group-hover:opacity-100',
            !open && '-rotate-90 opacity-100',
          )}
        />
      </button>
      {open && <div className="mt-px space-y-px">{children}</div>}
      {menu && (
        <TeamContextMenu
          teamId={team.id}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}
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
    pinnedIssueIds,
    drafts,
    sidebarVisibility,
    setCreateOpen,
    dismissOnboardingStep,
    toggleSidebar,
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
    pinnedIssueIds: s.pinnedIssueIds,
    drafts: s.drafts,
    sidebarVisibility: s.sidebarPrefs.visibility,
    setCreateOpen: s.setCreateOpen,
    dismissOnboardingStep: s.dismissOnboardingStep,
    toggleSidebar: s.toggleSidebar,
  }))

  // The admin-managed workspace name (backend) wins over the local seed so a
  // rename in the admin console shows up here too.
  const backendName = useAuth((s) => s.workspace.name)
  const displayName = backendName || workspaceName
  const logout = useAuth((s) => s.logout)

  const personalItems = useSectionItems('personal')
  const workspaceItems = useSectionItems('workspace')

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
      if (f.type === 'team') {
        const t = teams.find((x) => x.id === f.id)
        return t ? { to: `/team/${t.key}/active`, icon: <span className="text-[13px]">{t.icon}</span>, label: t.name } : null
      }
      const v = savedViews.find((x) => x.id === f.id)
      return v ? { to: `/view/${v.id}`, icon: <LayersIcon size={15} />, label: v.name } : null
    })
    .filter(Boolean) as { to: string; icon: ReactNode; label: string }[]
  // Pinned issues (Linear's quick-access pins) — newest first, skip archived/missing.
  const pinnedItems = pinnedIssueIds
    .map((id) => issues.find((i) => i.id === id))
    .filter((i): i is NonNullable<typeof i> => !!i && !i.archivedAt)
    .map((i) => ({
      to: `/issue/${i.identifier}`,
      icon: <Pin size={15} className="text-faint" />,
      label: i.title,
    }))
  const unread = notifications.filter(
    (n) => !n.read && !(n.snoozedUntil && new Date(n.snoozedUntil).getTime() > Date.now()),
  ).length
  // Badge counts by registry key — also decide whether a "Show when badged" row
  // renders at all.
  const badges: Record<string, number | undefined> = {
    inbox: unread,
    drafts: drafts.length,
  }
  const hiddenVisibility = (item: SidebarItemDef) =>
    (sidebarVisibility[item.key] ?? item.visibility) === 'hidden'
  const hiddenItems = [...personalItems, ...workspaceItems].filter(hiddenVisibility)

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
                  {displayName.slice(0, 1)}
                </span>
                <span className="truncate text-[13px] font-semibold text-fg">
                  {displayName}
                </span>
                <ChevronDown size={14} className="text-faint" />
              </span>
            }
          >
            {(close) => (
              // Linear's workspace menu, in its exact order and grouping:
              // Settings · Invite and manage members / Download desktop app /
              // Switch workspace ▸ · Log out. It deliberately does not list
              // teams — those live in the sidebar body below.
              <div>
                <MenuRow
                  icon={<Settings size={14} className="text-faint" />}
                  label="Settings"
                  hint="G then S"
                  onClick={() => {
                    close()
                    navigate('/settings')
                  }}
                />
                <MenuRow
                  icon={<UserPlus size={14} className="text-faint" />}
                  label="Invite and manage members"
                  onClick={() => {
                    close()
                    navigate('/members')
                  }}
                />
                <div className="my-1 h-px bg-border" />
                <MenuRow
                  icon={<Monitor size={14} className="text-faint" />}
                  label="Download desktop app"
                  onClick={() => {
                    close()
                    navigate('/releases')
                  }}
                />
                <div className="my-1 h-px bg-border" />
                <SwitchWorkspaceRow />
                <MenuRow
                  icon={<LogOut size={14} className="text-faint" />}
                  label="Log out"
                  hint="⌥⇧Q"
                  onClick={() => {
                    close()
                    logout()
                    navigate('/')
                  }}
                />
              </div>
            )}
          </Popover>
        </div>
        {/* Linear keeps search in the header next to the compose button. */}
        <button
          type="button"
          title="Search"
          onClick={() => navigate('/search')}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg"
        >
          <Search size={16} />
        </button>
        <button
          type="button"
          title="New issue"
          onClick={() => setCreateOpen(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg"
        >
          <PenSquare size={16} />
        </button>
        <button
          type="button"
          title="Collapse sidebar (⌘/)"
          onClick={toggleSidebar}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="space-y-px">
          {personalItems.map((item) => (
            <RegistryItem key={item.key} item={item} badge={badges[item.key]} />
          ))}
        </div>

        {favoriteItems.length > 0 && (
          <Section title="Favorites" sectionKey="favorites">
            {favoriteItems.map((f) => (
              <Item key={f.to} to={f.to} icon={f.icon} label={f.label} />
            ))}
          </Section>
        )}

        {pinnedItems.length > 0 && (
          <Section title="Pinned" sectionKey="pinned">
            {pinnedItems.map((p) => (
              <Item key={p.to} to={p.to} icon={p.icon} label={p.label} />
            ))}
          </Section>
        )}

        <Section title="Workspace" sectionKey="workspace">
          {workspaceItems.map((item) => (
            <RegistryItem key={item.key} item={item} badge={badges[item.key]} />
          ))}
          {/* Pinned saved views surface directly in the sidebar (Linear). */}
          {savedViews
            .filter((v) => v.pinned)
            .map((v) => (
              <Item
                key={v.id}
                to={`/view/${v.id}`}
                icon={<LayersIcon size={15} className="text-faint" />}
                label={v.name}
              />
            ))}
          <MoreMenu hidden={hiddenItems} />
        </Section>

        {/* Linear groups every team under one "Your teams" header, with each
            team a row of its own rather than another section header. */}
        <Section title="Your teams" sectionKey="teams">
          {teams.map((team) => (
            <TeamGroup key={team.id} team={team}>
              <Item
                indent
                to={`/team/${team.key}/overview`}
                icon={<Home size={15} />}
                label="Home"
              />
              <Item
                indent
                to={`/team/${team.key}/triage`}
                icon={<Ticket size={15} />}
                label="Triage"
                badge={issues.filter((i) => i.teamId === team.id && i.triage && !i.archivedAt).length}
              />
              <Item
                indent
                to={`/team/${team.key}/active`}
                icon={<Layers3 size={15} />}
                label="Issues"
              />
              {(team.cyclesEnabled ?? true) && (
                <>
                  <FlagItem
                    flag="cycles"
                    indent
                    to={`/team/${team.key}/cycles`}
                    icon={<IterationCw size={15} />}
                    label="Cycles"
                  />
                  {/* Linear nests Current / Upcoming under a team's Cycles. */}
                  <SubItem to={`/team/${team.key}/cycle/current`} label="Current" />
                  <SubItem to={`/team/${team.key}/cycle/upcoming`} label="Upcoming" />
                </>
              )}
              <Item
                indent
                to={`/team/${team.key}/projects`}
                icon={<FolderKanban size={15} />}
                label="Projects"
              />
              <Item
                indent
                to={`/team/${team.key}/views`}
                icon={<LayersIcon size={15} />}
                label="Views"
              />
            </TeamGroup>
          ))}
        </Section>

        {trySteps.length > 0 && (
          <Section title="Try" sectionKey="try">
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

      <div className="border-t border-border px-2 py-2 space-y-px">
        <Item to="/settings" icon={<Settings size={15} />} label="Settings" />
        <UserMenu />
      </div>
    </aside>
  )
}

/** Footer account row: shows the signed-in user with a popover for the admin
 *  console (admins only) and sign-out. */
function UserMenu() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  if (!user) return null
  return (
    <Popover
      align="start"
      width={220}
      trigger={
        <span className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ background: user.avatarColor }}
          >
            {user.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="flex-1 truncate text-left">{user.name}</span>
          {user.role === 'admin' && <Shield size={13} className="text-faint" />}
        </span>
      }
    >
      {(close) => (
        <div>
          <div className="px-2 py-1.5">
            <p className="truncate text-[13px] font-medium text-fg">{user.name}</p>
            <p className="truncate text-[11px] text-faint">{user.email}</p>
            <span className="mt-1 inline-block rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
              {user.role}
            </span>
          </div>
          <div className="my-1 h-px bg-border" />
          {user.role === 'admin' && (
            <button
              type="button"
              onClick={() => {
                close()
                navigate('/admin')
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
            >
              <Shield size={14} className="text-faint" /> System administration
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              close()
              navigate('/api-keys')
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
          >
            <KeyRound size={14} className="text-faint" /> API keys
          </button>
          <button
            type="button"
            onClick={() => {
              close()
              logout()
              navigate('/')
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
          >
            <LogOut size={14} className="text-faint" /> Sign out
          </button>
        </div>
      )}
    </Popover>
  )
}
