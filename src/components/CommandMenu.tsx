import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  PlusCircle,
  Inbox,
  CircleDot,
  Box,
  Settings,
  Moon,
  Sun,
  Monitor,
  Keyboard,
  Map,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { StatusIcon } from './StatusIcon'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface Command {
  id: string
  label: string
  icon: ReactNode
  hint?: string
  keywords?: string
  run: () => void
}

export function CommandMenu() {
  const navigate = useNavigate()
  const store = useStore()
  const open = store.commandOpen
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const team = store.teams[0]
    const base: Command[] = [
      {
        id: 'new-issue',
        label: 'Create new issue',
        icon: <PlusCircle size={15} />,
        hint: 'C',
        keywords: 'add create issue new',
        run: () => store.setCreateOpen(true),
      },
      {
        id: 'go-inbox',
        label: 'Go to Inbox',
        icon: <Inbox size={15} />,
        keywords: 'inbox notifications',
        run: () => navigate('/inbox'),
      },
      {
        id: 'go-my',
        label: 'Go to My Issues',
        icon: <CircleDot size={15} />,
        keywords: 'my issues assigned',
        run: () => navigate('/my-issues'),
      },
      {
        id: 'go-issues',
        label: 'Go to Issues',
        icon: <StatusIcon type="started" color="var(--status-started)" />,
        keywords: 'issues team',
        run: () => navigate(`/team/${team.key}/active`),
      },
      {
        id: 'go-cycles',
        label: 'Go to Cycles',
        icon: <StatusIcon type="started" color="var(--status-started)" />,
        keywords: 'cycles sprints',
        run: () => navigate(`/team/${team.key}/cycles`),
      },
      {
        id: 'go-projects',
        label: 'Go to Projects',
        icon: <Box size={15} />,
        keywords: 'projects',
        run: () => navigate('/projects'),
      },
      {
        id: 'go-roadmap',
        label: 'Go to Roadmap',
        icon: <Map size={15} />,
        keywords: 'roadmap timeline',
        run: () => navigate('/roadmap'),
      },
      {
        id: 'go-settings',
        label: 'Open Settings',
        icon: <Settings size={15} />,
        keywords: 'settings preferences',
        run: () => navigate('/settings'),
      },
      {
        id: 'help',
        label: 'Keyboard shortcuts',
        icon: <Keyboard size={15} />,
        hint: '?',
        keywords: 'help shortcuts keyboard',
        run: () => store.setHelpOpen(true),
      },
      {
        id: 'theme-light',
        label: 'Theme: Light',
        icon: <Sun size={15} />,
        keywords: 'theme light appearance',
        run: () => store.setTheme('light'),
      },
      {
        id: 'theme-dark',
        label: 'Theme: Dark',
        icon: <Moon size={15} />,
        keywords: 'theme dark appearance',
        run: () => store.setTheme('dark'),
      },
      {
        id: 'theme-system',
        label: 'Theme: System',
        icon: <Monitor size={15} />,
        keywords: 'theme system appearance',
        run: () => store.setTheme('system'),
      },
    ]

    const issueCommands: Command[] = store.issues.map((i) => {
      const st = store.states.find((s) => s.id === i.stateId)!
      return {
        id: `issue-${i.id}`,
        label: i.title,
        icon: <StatusIcon type={st.type} color={st.color} />,
        hint: i.identifier,
        keywords: `${i.identifier} ${i.title}`,
        run: () => navigate(`/issue/${i.identifier}`),
      }
    })

    return [...base, ...issueCommands]
  }, [store, navigate])

  const filtered = useMemo(() => {
    if (!query) return commands.slice(0, 8)
    const q = query.toLowerCase()
    return commands
      .filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          (c.keywords ?? '').toLowerCase().includes(q),
      )
      .slice(0, 40)
  }, [commands, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  if (!open) return null

  function exec(c: Command) {
    c.run()
    store.setCommandOpen(false)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-[15vh] animate-fade"
      onMouseDown={() => store.setCommandOpen(false)}
    >
      <div
        className="w-[600px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (filtered[active]) exec(filtered[active])
          } else if (e.key === 'Escape') {
            store.setCommandOpen(false)
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search size={16} className="text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent text-[14px] text-fg outline-none"
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-[13px] text-faint">
              No results
            </div>
          )}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => exec(c)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] text-fg',
                i === active && 'bg-bg-hover',
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center text-faint">
                {c.icon}
              </span>
              <span className="flex-1 truncate">{c.label}</span>
              {c.hint && (
                <span className="font-mono text-[11px] text-faint">{c.hint}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
