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
  Map as MapIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useStoreShallow } from '@/lib/store'
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
  const { workspaceName, teams, notifications, issues, projects, savedViews, favorites, setCreateOpen } =
    useStoreShallow((s) => ({
      workspaceName: s.workspaceName,
      teams: s.teams,
      notifications: s.notifications,
      issues: s.issues,
      projects: s.projects,
      savedViews: s.savedViews,
      favorites: s.favorites,
      setCreateOpen: s.setCreateOpen,
    }))

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
  const unread = notifications.filter((n) => !n.read).length

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
        </div>

        {favoriteItems.length > 0 && (
          <Section title="Favorites">
            {favoriteItems.map((f) => (
              <Item key={f.to} to={f.to} icon={f.icon} label={f.label} />
            ))}
          </Section>
        )}

        <Section title="Workspace">
          <Item to="/projects" icon={<Box size={15} />} label="Projects" />
          <Item to="/roadmap" icon={<MapIcon size={15} />} label="Roadmap" />
          <Item to="/views" icon={<LayersIcon size={15} />} label="Views" />
        </Section>

        {teams.map((team) => (
          <Section key={team.id} title={team.name}>
            <Item
              to={`/team/${team.key}/triage`}
              icon={<Ticket size={15} />}
              label="Triage"
              badge={issues.filter((i) => i.teamId === team.id && i.triage).length}
            />
            <Item
              to={`/team/${team.key}/active`}
              icon={<Layers3 size={15} />}
              label="Issues"
            />
            <Item
              to={`/team/${team.key}/cycles`}
              icon={<IterationCw size={15} />}
              label="Cycles"
            />
            <Item
              to={`/team/${team.key}/projects`}
              icon={<FolderKanban size={15} />}
              label="Projects"
            />
          </Section>
        ))}
      </div>

      <div className="border-t border-border px-2 py-2">
        <Item to="/settings" icon={<Settings size={15} />} label="Settings" />
      </div>
    </aside>
  )
}
