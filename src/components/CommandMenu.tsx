import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  format,
  isBefore,
  isValid,
  parse,
  startOfDay,
  startOfWeek,
} from 'date-fns'
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
  BarChart3,
  Activity,
  IterationCw,
  Building2,
  Rocket,
  Users,
  Megaphone,
  CircleUser,
  Goal,
  FileText,
  History,
  Star,
  Archive,
  Bell,
  Layers3,
  User,
  Tag,
  FolderPlus,
  CalendarDays,
  Copy,
  Link2,
  GitBranch,
  Check,
  X,
  PanelLeft,
  CopyPlus,
  Trash2,
  BellOff,
} from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { Calendar } from './DatePicker'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import { PRIORITY_LABELS, PRIORITY_ORDER, STATUS_TYPE_ORDER } from '@/lib/constants'
import { branchName, cn, issueUrl } from '@/lib/utils'
import { copyToClipboard, copyToast } from '@/lib/toast'
import type { Priority } from '@/lib/types'
import type { ReactNode } from 'react'

/** A sub-page the menu can drill into for the issue currently in context. */
type Page = 'status' | 'priority' | 'assignee' | 'project' | 'label' | 'dueDate'

interface Command {
  id: string
  label: string
  icon: ReactNode
  hint?: string
  /** Right-aligned muted helper text (e.g. a resolved date). */
  meta?: string
  keywords?: string
  selected?: boolean
  /** Drill into a sub-page instead of running + closing. */
  goPage?: Page
  /** Open the inline calendar (Custom due date) instead of running + closing. */
  openCalendar?: boolean
  /** Keep the menu open after running (e.g. toggling labels). */
  keepOpen?: boolean
  run?: () => void
}

const PAGE_PLACEHOLDER: Record<Page, string> = {
  status: 'Change status…',
  priority: 'Set priority…',
  assignee: 'Assign to…',
  project: 'Add to project…',
  label: 'Add labels…',
  dueDate: 'Try: 24h, 7 days, Feb 9',
}

/**
 * Derive a command's section from its id prefix. Linear buckets root-page
 * results under uppercase headers ("Issue actions", "Navigation", …); the
 * header is purely presentational — keyboard traversal stays flat (below).
 */
function groupOf(id: string): string {
  if (id.startsWith('ctx-')) return 'Issue actions'
  if (id.startsWith('issue-')) return 'Issues'
  if (id.startsWith('switch-team-')) return 'Teams'
  if (id.startsWith('theme-') || id.startsWith('toggle-')) return 'Preferences'
  if (id === 'go-settings' || id === 'help') return 'Settings'
  if (id.startsWith('new-')) return 'Create'
  if (id.startsWith('go-')) return 'Navigation'
  // Sub-page options (st-, pr-, as-, pj-, lb-, due-) — single ungrouped list.
  return ''
}

/**
 * Parse Linear's relative/natural due-date input ("24h", "7 days", "Feb 9").
 * Returns a start-of-day Date, or undefined when nothing sensible is typed.
 */
function parseDueInput(raw: string): Date | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const q = trimmed.toLowerCase()
  const today = startOfDay(new Date())
  if (q === 'today') return today
  if (q === 'tomorrow' || q === 'tmr') return addDays(today, 1)

  const rel = q.match(
    /^(\d+)\s*(h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|mo|month|months)$/,
  )
  if (rel) {
    const n = parseInt(rel[1], 10)
    const unit = rel[2]
    if (unit.startsWith('h')) return startOfDay(addHours(new Date(), n))
    if (unit.startsWith('mo')) return addMonths(today, n)
    if (unit.startsWith('w')) return addWeeks(today, n)
    return addDays(today, n)
  }

  // Month name / numeric dates, e.g. "Feb 9", "February 9", "6/20".
  const cap = trimmed.replace(/\b\w/g, (c) => c.toUpperCase())
  for (const fmt of ['MMM d', 'MMMM d', 'MMM d yyyy', 'MMMM d yyyy', 'd MMM', 'M/d', 'M/d/yyyy']) {
    for (const candidate of [trimmed, cap]) {
      const d = parse(candidate, fmt, new Date())
      if (isValid(d)) {
        let res = startOfDay(d)
        // Year-less formats default to the current year — bump past dates forward.
        if (!fmt.includes('yyyy') && isBefore(res, today)) res = addMonths(res, 12)
        return res
      }
    }
  }
  return undefined
}

export function CommandMenu() {
  const navigate = useNavigate()
  const location = useLocation()
  const store = useStore()
  const fmt = useDisplayName()
  const open = store.commandOpen
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [page, setPage] = useState<Page | null>(null)
  /** Inline calendar shown when picking a Custom due date. */
  const [dueCustom, setDueCustom] = useState(false)
  /** When the user dismisses the issue-context chip, fall back to global commands. */
  const [noCtx, setNoCtx] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // A row property hotkey (s/p/a/l) seeds the sub-page to drill straight into.
      setPage((useStore.getState().commandPage as Page) ?? null)
      setDueCustom(false)
      setNoCtx(false)
    }
  }, [open])

  // Keep the search input focused across sub-page drill-ins (incl. mouse clicks),
  // so the user can keep typing — matches Linear.
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open, page, dueCustom])

  // The issue currently being viewed — the peek panel takes precedence, else the
  // /issue/:identifier route. This is what ⌘K offers contextual actions for.
  const currentIssue = useMemo(() => {
    if (noCtx) return undefined
    // A row property hotkey explicitly targets one issue — it wins.
    if (store.commandIssueId)
      return store.issues.find((i) => i.id === store.commandIssueId)
    if (store.peekIssueId) return store.issues.find((i) => i.id === store.peekIssueId)
    const m = location.pathname.match(/^\/issue\/([^/]+)/)
    if (m) {
      const id = decodeURIComponent(m[1])
      return store.issues.find((i) => i.identifier === id)
    }
    return undefined
  }, [noCtx, store.commandIssueId, store.peekIssueId, store.issues, location.pathname])

  const me = store.users.find((u) => u.isMe)

  const commands = useMemo<Command[]>(() => {
    const team = store.teams[0]

    // —— Sub-page: options for one property of the current issue ——
    if (page && currentIssue) {
      const issue = currentIssue
      if (page === 'status') {
        return [...store.states]
          .sort(
            (a, b) =>
              STATUS_TYPE_ORDER[a.type] - STATUS_TYPE_ORDER[b.type] ||
              a.position - b.position,
          )
          .map((st) => ({
            id: `st-${st.id}`,
            label: st.name,
            icon: <StatusIcon type={st.type} color={st.color} />,
            keywords: st.name,
            selected: st.id === issue.stateId,
            run: () => store.setIssueStatus(issue.id, st.id),
          }))
      }
      if (page === 'priority') {
        return PRIORITY_ORDER.map((p) => ({
          id: `pr-${p}`,
          label: PRIORITY_LABELS[p],
          icon: <PriorityIcon priority={p} />,
          keywords: PRIORITY_LABELS[p],
          selected: p === issue.priority,
          run: () => store.setIssuePriority(issue.id, p as Priority),
        }))
      }
      if (page === 'assignee') {
        return [
          {
            id: 'as-none',
            label: 'No assignee',
            icon: <Avatar />,
            keywords: 'unassigned none',
            selected: !issue.assigneeId,
            run: () => store.setIssueAssignee(issue.id, undefined),
          },
          ...store.users.map((u) => ({
            id: `as-${u.id}`,
            label: fmt(u.name),
            icon: <Avatar user={u} />,
            keywords: u.name,
            selected: u.id === issue.assigneeId,
            run: () => store.setIssueAssignee(issue.id, u.id),
          })),
        ]
      }
      if (page === 'project') {
        return [
          {
            id: 'pj-none',
            label: 'No project',
            icon: <span className="text-faint">○</span>,
            keywords: 'no project none',
            selected: !issue.projectId,
            run: () => store.setIssueProject(issue.id, undefined),
          },
          ...store.projects.map((p) => ({
            id: `pj-${p.id}`,
            label: p.name,
            icon: <span>{p.icon}</span>,
            keywords: p.name,
            selected: p.id === issue.projectId,
            run: () => store.setIssueProject(issue.id, p.id),
          })),
        ]
      }
      if (page === 'dueDate') {
        const set = (d: Date) =>
          store.setIssueDueDate(issue.id, startOfDay(d).toISOString())

        // Typing a relative/explicit date surfaces a single resolved suggestion.
        const parsed = parseDueInput(query)
        if (parsed) {
          return [
            {
              id: 'due-parsed',
              label: format(parsed, 'EEE, MMM d, yyyy'),
              icon: <CalendarDays size={15} />,
              run: () => set(parsed),
            },
          ]
        }

        const today = new Date()
        const tomorrow = addDays(today, 1)
        const endOfThisWeek = addDays(startOfWeek(today, { weekStartsOn: 1 }), 4)
        const inOneWeek = addWeeks(today, 1)
        const opts: Command[] = [
          {
            id: 'due-custom',
            label: 'Custom…',
            icon: <CalendarDays size={15} />,
            keywords: 'custom calendar pick',
            openCalendar: true,
          },
          {
            id: 'due-tomorrow',
            label: 'Tomorrow',
            icon: <CalendarDays size={15} />,
            meta: format(tomorrow, 'EEE, d MMM'),
            keywords: 'tomorrow',
            run: () => set(tomorrow),
          },
          {
            id: 'due-endweek',
            label: 'End of this week',
            icon: <CalendarDays size={15} />,
            meta: format(endOfThisWeek, 'EEE, d MMM'),
            keywords: 'end of this week friday',
            run: () => set(endOfThisWeek),
          },
          {
            id: 'due-inweek',
            label: 'In one week',
            icon: <CalendarDays size={15} />,
            meta: format(inOneWeek, 'EEE, d MMM'),
            keywords: 'in one week next',
            run: () => set(inOneWeek),
          },
        ]
        if (issue.dueDate) {
          opts.push({
            id: 'due-remove',
            label: 'Remove due date',
            icon: <X size={15} />,
            keywords: 'remove clear delete due date',
            run: () => store.setIssueDueDate(issue.id, undefined),
          })
        }
        return opts
      }

      // label
      return store.labels.filter((l) => !l.isGroup).map((l) => ({
        id: `lb-${l.id}`,
        label: l.name,
        icon: <LabelDot color={l.color} />,
        keywords: l.name,
        selected: issue.labelIds.includes(l.id),
        keepOpen: true,
        run: () => store.toggleIssueLabel(issue.id, l.id),
      }))
    }

    // —— Root page ——
    const contextual: Command[] = currentIssue
      ? (() => {
          const issue = currentIssue
          const st = store.states.find((s) => s.id === issue.stateId)!
          const starred = store.favorites.some(
            (f) => f.type === 'issue' && f.id === issue.id,
          )
          const subscribed = issue.subscriberIds.includes(store.currentUserId)
          return [
            {
              id: 'ctx-assign',
              label: 'Assign to…',
              icon: <User size={15} />,
              hint: 'A',
              keywords: 'assign assignee',
              goPage: 'assignee' as Page,
            },
            {
              id: 'ctx-assign-me',
              label: 'Assign to me',
              icon: <Avatar user={me} size={16} />,
              hint: 'I',
              keywords: 'assign me self',
              run: () => store.setIssueAssignee(issue.id, me?.id),
            },
            {
              id: 'ctx-status',
              label: 'Change status…',
              icon: <StatusIcon type={st.type} color={st.color} />,
              hint: 'S',
              keywords: 'status change state',
              goPage: 'status' as Page,
            },
            {
              id: 'ctx-priority',
              label: 'Set priority…',
              icon: <PriorityIcon priority={issue.priority} />,
              hint: 'P',
              keywords: 'priority',
              goPage: 'priority' as Page,
            },
            {
              id: 'ctx-project',
              label: 'Add to project…',
              icon: <FolderPlus size={15} />,
              hint: '⇧ P',
              keywords: 'project add to',
              goPage: 'project' as Page,
            },
            {
              id: 'ctx-label',
              label: 'Add labels…',
              icon: <Tag size={15} />,
              hint: 'L',
              keywords: 'label labels add',
              goPage: 'label' as Page,
            },
            {
              id: 'ctx-duedate',
              label: 'Set due date…',
              icon: <CalendarDays size={15} />,
              hint: '⇧ D',
              keywords: 'due date deadline set',
              goPage: 'dueDate' as Page,
            },
            {
              id: 'ctx-copy-id',
              label: 'Copy issue ID',
              icon: <Copy size={15} />,
              hint: '⌘ .',
              keywords: 'copy id identifier',
              run: () => copyToClipboard(issue.identifier, copyToast.id(issue.identifier)),
            },
            {
              id: 'ctx-copy-url',
              label: 'Copy issue URL',
              icon: <Link2 size={15} />,
              keywords: 'copy url link',
              run: () => copyToClipboard(issueUrl(issue.identifier), copyToast.url()),
            },
            {
              id: 'ctx-copy-branch',
              label: 'Copy git branch name',
              icon: <GitBranch size={15} />,
              keywords: 'copy git branch name',
              run: () =>
                copyToClipboard(
                  branchName(issue.identifier, issue.title, me),
                  copyToast.branch(),
                ),
            },
            {
              id: 'ctx-favorite',
              label: starred ? 'Remove from favorites' : 'Add to favorites',
              icon: (
                <Star
                  size={15}
                  fill={starred ? 'currentColor' : 'none'}
                  className={starred ? 'text-[var(--status-started)]' : ''}
                />
              ),
              keywords: 'favorite unfavorite star bookmark pin',
              run: () => store.toggleFavorite('issue', issue.id),
            },
            {
              id: 'ctx-subscribe',
              label: subscribed ? 'Unsubscribe' : 'Subscribe',
              icon: subscribed ? <BellOff size={15} /> : <Bell size={15} />,
              keywords: 'subscribe unsubscribe notifications follow watch',
              run: () =>
                store.toggleIssueSubscriber(issue.id, store.currentUserId),
            },
            {
              id: 'ctx-duplicate',
              label: 'Duplicate issue',
              icon: <CopyPlus size={15} />,
              keywords: 'duplicate copy clone',
              run: () => {
                const dupe = store.duplicateIssue(issue.id)
                if (dupe) navigate(`/issue/${dupe.identifier}`)
              },
            },
            {
              id: 'ctx-delete',
              label: 'Delete issue…',
              icon: <Trash2 size={15} />,
              keywords: 'delete remove trash',
              run: () => store.deleteIssue(issue.id),
            },
          ]
        })()
      : []

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
        id: 'new-initiative',
        label: 'Create new initiative',
        icon: <Goal size={15} />,
        keywords: 'add create initiative new strategy',
        run: () => store.setCreateInitiativeOpen(true),
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
        id: 'go-initiatives',
        label: 'Go to Initiatives',
        icon: <Goal size={15} />,
        keywords: 'initiatives strategy goals',
        run: () => navigate('/initiatives'),
      },
      {
        id: 'go-roadmap',
        label: 'Go to Roadmap',
        icon: <Map size={15} />,
        keywords: 'roadmap timeline',
        run: () => navigate('/roadmap'),
      },
      {
        id: 'go-documents',
        label: 'Go to Documents',
        icon: <FileText size={15} />,
        keywords: 'documents docs notes specs',
        run: () => navigate('/documents'),
      },
      {
        id: 'go-active-cycles',
        label: 'Go to Active Cycles',
        icon: <IterationCw size={15} />,
        keywords: 'cycles active sprints all teams overview iteration',
        run: () => navigate('/cycles'),
      },
      {
        id: 'go-pulse',
        label: 'Go to Pulse',
        icon: <Activity size={15} />,
        keywords: 'pulse activity feed workspace recent changes',
        run: () => navigate('/pulse'),
      },
      {
        id: 'go-customers',
        label: 'Go to Customers',
        icon: <Building2 size={15} />,
        keywords: 'customers crm accounts requests arr',
        run: () => navigate('/customers'),
      },
      {
        id: 'go-releases',
        label: 'Go to Releases',
        icon: <Rocket size={15} />,
        keywords: 'releases version ship deploy launch',
        run: () => navigate('/releases'),
      },
      {
        id: 'go-members',
        label: 'Go to Members',
        icon: <Users size={15} />,
        keywords: 'members people directory users team',
        run: () => navigate('/members'),
      },
      {
        id: 'go-changelog',
        label: 'Go to Changelog',
        icon: <Megaphone size={15} />,
        keywords: 'changelog shipped releases whats new timeline',
        run: () => navigate('/changelog'),
      },
      {
        id: 'go-profile',
        label: 'Go to Profile',
        icon: <CircleUser size={15} />,
        keywords: 'profile your work me account dashboard',
        run: () => navigate('/profile'),
      },
      {
        id: 'go-insights',
        label: 'Go to Insights',
        icon: <BarChart3 size={15} />,
        keywords: 'insights analytics charts metrics reports stats',
        run: () => navigate('/insights'),
      },
      {
        id: 'go-all-issues',
        label: 'Go to All issues',
        icon: <Layers3 size={15} />,
        keywords: 'all issues workspace every team list',
        run: () => navigate('/all-issues'),
      },
      {
        id: 'go-teams',
        label: 'Go to Teams',
        icon: <Building2 size={15} />,
        keywords: 'teams directory groups workspace',
        run: () => navigate('/teams'),
      },
      {
        id: 'go-favorites',
        label: 'Go to Favorites',
        icon: <Star size={15} />,
        keywords: 'favorites starred bookmarks pinned',
        run: () => navigate('/favorites'),
      },
      {
        id: 'go-recent',
        label: 'Go to Recently viewed',
        icon: <History size={15} />,
        keywords: 'recent recently viewed history opened',
        run: () => navigate('/recent'),
      },
      {
        id: 'go-archive',
        label: 'Go to Archive',
        icon: <Archive size={15} />,
        keywords: 'archive archived deleted removed restore',
        run: () => navigate('/archive'),
      },
      {
        id: 'go-reminders',
        label: 'Go to Reminders',
        icon: <Bell size={15} />,
        keywords: 'reminders remind me snooze follow up due',
        run: () => navigate('/reminders'),
      },
      {
        id: 'go-labels',
        label: 'Go to Labels',
        icon: <Tag size={15} />,
        keywords: 'labels tags categories directory',
        run: () => navigate('/labels'),
      },
      {
        id: 'new-document',
        label: 'Create new document',
        icon: <FileText size={15} />,
        keywords: 'add create document doc new note',
        run: () => {
          const doc = store.createDocument()
          navigate(`/document/${doc.id}`)
        },
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
      {
        id: 'toggle-sidebar',
        label: 'Toggle sidebar',
        icon: <PanelLeft size={15} />,
        hint: '⌘/',
        keywords: 'sidebar collapse expand hide show toggle',
        run: () => store.toggleSidebar(),
      },
      ...store.teams.map((t) => ({
        id: `switch-team-${t.id}`,
        label: `Switch to ${t.name}`,
        icon: <span className="text-[13px]">{t.icon}</span>,
        hint: t.key,
        keywords: `switch team ${t.name} ${t.key}`,
        run: () => navigate(`/team/${t.key}/active`),
      })),
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

    return [...contextual, ...base, ...issueCommands]
  }, [store, navigate, page, currentIssue, me, query])

  const filtered = useMemo(() => {
    // The due-date page bakes the query into its own suggestions — show as-is.
    if (page === 'dueDate') return commands
    if (!query) return page ? commands : commands.slice(0, 8)
    const q = query.toLowerCase()
    return commands
      .filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          (c.keywords ?? '').toLowerCase().includes(q),
      )
      .slice(0, 40)
  }, [commands, query, page])

  useEffect(() => {
    setActive(0)
  }, [query, page])

  if (!open) return null

  function exec(c: Command) {
    if (c.goPage) {
      setPage(c.goPage)
      setQuery('')
      setActive(0)
      return
    }
    if (c.openCalendar) {
      setDueCustom(true)
      setQuery('')
      return
    }
    c.run?.()
    if (!c.keepOpen) store.setCommandOpen(false)
  }

  /** Pop the calendar, then a sub-page, then the issue context, then close. */
  function back() {
    if (dueCustom) {
      setDueCustom(false)
    } else if (page) {
      // A row property hotkey opens a focused picker — backing out of it closes
      // the menu rather than revealing the full command palette (matches Linear).
      if (store.commandIssueId) {
        store.setCommandOpen(false)
      } else {
        setPage(null)
        setQuery('')
      }
    } else if (currentIssue) {
      setNoCtx(true)
    } else {
      store.setCommandOpen(false)
    }
  }

  const placeholder = page ? PAGE_PLACEHOLDER[page] : 'Type a command or search…'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay pt-[15vh] animate-fade"
      onMouseDown={() => store.setCommandOpen(false)}
    >
      <div
        className="w-[600px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            if (dueCustom || page) back()
            else store.setCommandOpen(false)
            return
          }
          // The inline calendar owns arrows/enter for day navigation.
          if (dueCustom) {
            if (e.key === 'Backspace' && query === '') {
              e.preventDefault()
              back()
            }
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (filtered[active]) exec(filtered[active])
          } else if (e.key === 'Backspace' && query === '' && (page || currentIssue)) {
            e.preventDefault()
            back()
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search size={16} className="text-faint" />
          {currentIssue && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-bg-hover py-1 pl-2 pr-1 text-[12px] text-fg">
              <span className="font-medium text-muted">{currentIssue.identifier}</span>
              <span className="max-w-40 truncate text-muted">{currentIssue.title}</span>
              <button
                type="button"
                onClick={back}
                className="flex h-4 w-4 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
                aria-label="Remove issue context"
              >
                <X size={12} />
              </button>
            </span>
          )}
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-[14px] text-fg outline-none"
          />
        </div>
        {dueCustom && currentIssue ? (
          <div className="flex justify-center py-2">
            <Calendar
              value={currentIssue.dueDate}
              onChange={(iso) => store.setIssueDueDate(currentIssue.id, iso)}
              close={() => store.setCommandOpen(false)}
            />
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-[13px] text-faint">
                No results
              </div>
            )}
            {filtered.map((c, i) => {
              // A non-selectable header precedes the first row of each new group;
              // the buttons keep their flat index `i`, so up/down traversal over
              // `filtered` is unchanged — matches Linear's sectioned palette.
              const group = groupOf(c.id)
              const showHeader = group !== '' && group !== groupOf(filtered[i - 1]?.id ?? '')
              return (
                <div key={c.id}>
                  {showHeader && (
                    <div className="select-none px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                      {group}
                    </div>
                  )}
                  <button
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
                    {c.selected ? (
                      <Check size={14} className="text-fg" />
                    ) : c.meta ? (
                      <span className="text-[12px] text-muted">{c.meta}</span>
                    ) : (
                      c.hint && (
                        <span className="font-mono text-[11px] text-faint">{c.hint}</span>
                      )
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
