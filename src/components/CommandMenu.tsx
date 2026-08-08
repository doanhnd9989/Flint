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
  Plus,
  PlusCircle,
  LogOut,
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
  Diamond,
  Hash,
  ArchiveRestore,
  ArrowRightLeft,
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
  Eye,
  EyeOff,
  Group,
  ArrowUpDown,
  Filter,
  PenSquare,
  SlidersHorizontal,
  Type,
  Link,
} from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { Calendar } from './DatePicker'
import { StatusIcon } from './StatusIcon'
import { PriorityIcon } from './PriorityIcon'
import { Avatar } from './Avatar'
import { LabelDot } from './LabelChip'
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  STATUS_TYPE_ORDER,
  DISPLAY_PROPERTIES,
  estimatePoints,
  estimateLabel,
  teamEstimationType,
} from '@/lib/constants'
import { cycleState } from '@/lib/selectors'
import { branchName, cn, issueUrl, formatDate } from '@/lib/utils'
import { copyToClipboard, copyToast } from '@/lib/toast'
import type { DisplayProperty, GroupBy, Issue, OrderBy, Priority } from '@/lib/types'
import type { ReactNode } from 'react'

/** Display presets offered when viewing a saved view (mirrors DisplayMenu). */
const GROUP_PRESETS: { id: GroupBy; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'priority', label: 'Priority' },
  { id: 'project', label: 'Project' },
  { id: 'label', label: 'Label' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'none', label: 'No grouping' },
]
const ORDER_PRESETS: { id: OrderBy; label: string }[] = [
  { id: 'priority', label: 'Priority' },
  { id: 'updated', label: 'Last updated' },
  { id: 'created', label: 'Last created' },
  { id: 'title', label: 'Title' },
  { id: 'manual', label: 'Manual' },
]

/** A sub-page the menu can drill into for the issue currently in context. */
type Page =
  | 'status'
  | 'priority'
  | 'assignee'
  | 'project'
  | 'label'
  | 'dueDate'
  | 'cycle'
  | 'milestone'
  | 'estimate'
  | 'moveTeam'
  /** Pick the issue this one should become a sub-issue of (Convert → sub-issue). */
  | 'parent'
  /** Global quick-create drill-in (New issue / project / document / view / …). */
  | 'create'
  /** Bulk drill-ins for an active multi-selection (no single-issue context). */
  | 'bulkStatus'
  | 'bulkPriority'
  | 'bulkAssignee'
  /** Scope-filter drill-ins: pick a project / cycle, then list its issues. */
  | 'scopeProject'
  | 'scopeCycle'

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
  cycle: 'Move to cycle…',
  milestone: 'Set milestone…',
  estimate: 'Set estimate…',
  moveTeam: 'Move to team…',
  parent: 'Make sub-issue of…',
  create: 'Create…',
  bulkStatus: 'Set status…',
  bulkPriority: 'Set priority…',
  bulkAssignee: 'Assign to…',
  scopeProject: 'Search issues in project…',
  scopeCycle: 'Search issues in cycle…',
}

/**
 * Linear's command-palette quick-filter tokens. Typing one (e.g. `is:assigned`)
 * at the START of the query narrows the palette to the matching issues; typing a
 * bare `is:` / `in:` surfaces this menu as a hint row. `in:project` / `in:cycle`
 * drill into a picker first (handled separately via a sub-page).
 */
type ScopeId =
  | 'is:assigned'
  | 'is:mine'
  | 'is:unassigned'
  | 'is:active'
  | 'is:backlog'
  | 'in:project'
  | 'in:cycle'

const SCOPES: { id: ScopeId; label: string; hint: string }[] = [
  { id: 'is:assigned', label: 'Assigned issues', hint: 'has an assignee' },
  { id: 'is:mine', label: 'My issues', hint: 'assigned to me' },
  { id: 'is:unassigned', label: 'Unassigned issues', hint: 'no assignee' },
  { id: 'is:active', label: 'Active issues', hint: 'in progress' },
  { id: 'is:backlog', label: 'Backlog issues', hint: 'in backlog' },
  { id: 'in:project', label: 'Issues in project…', hint: 'pick a project' },
  { id: 'in:cycle', label: 'Issues in cycle…', hint: 'pick a cycle' },
]

/**
 * Split a leading scope token off the query. Returns the matched scope (if the
 * first whitespace-delimited word is a known `is:`/`in:` token) plus the rest of
 * the query (the free-text filter applied to the scoped issues). A bare `is:` /
 * `in:` prefix (no value yet) is reported so the palette can show the hint menu.
 */
function parseScope(raw: string): {
  scope?: ScopeId
  rest: string
  hintFor?: 'is' | 'in'
} {
  const q = raw.trimStart()
  const lower = q.toLowerCase()
  // Bare prefix → show the available-scope hint menu.
  if (lower === 'is:' || lower === 'in:')
    return { rest: '', hintFor: lower.slice(0, 2) as 'is' | 'in' }
  const m = lower.match(/^(is|in):(\S*)/)
  if (m) {
    const token = `${m[1]}:${m[2]}` as ScopeId
    const known = SCOPES.find((s) => s.id === token)
    // `in:project` / `in:cycle` resolve to a picker (a sub-page), not a direct
    // issue filter — surface the hint menu so the user drills in deliberately.
    if (known && token !== 'in:project' && token !== 'in:cycle') {
      const rest = q.slice(m[0].length).trimStart()
      return { scope: token, rest }
    }
    // `is:`/`in:` typed but value still partial (or a picker token) — keep
    // showing the hint menu.
    if (m[2] === '' || token === 'in:project' || token === 'in:cycle')
      return { rest: '', hintFor: m[1] as 'is' | 'in' }
  }
  return { rest: raw }
}

/**
 * Derive a command's section from its id prefix. Linear buckets root-page
 * results under uppercase headers ("Issue actions", "Navigation", …); the
 * header is purely presentational — keyboard traversal stays flat (below).
 */
function groupOf(id: string): string {
  // Linear prints no header above the contextual issue commands — the issue
  // chip sitting above the input is what names the context. They lead the list.
  if (id.startsWith('ctx-')) return ''
  if (id.startsWith('bulk-')) return 'Selection'
  if (id.startsWith('scope-')) return 'Filter issues'
  if (id.startsWith('recent-')) return 'Recently viewed'
  if (id.startsWith('issue-')) return 'Issues'
  if (id.startsWith('view-')) return 'Views'
  if (id.startsWith('group-')) return 'Group by'
  if (id.startsWith('order-')) return 'Order by'
  if (id.startsWith('disp-')) return 'Display properties'
  if (id.startsWith('switch-team-')) return 'Teams'
  if (id.startsWith('account-')) return 'Account'
  if (id === 'help') return 'Help'
  // Linear has no "Create" bucket — a create command sits under the section of
  // the thing it creates, and theme lives under Settings alongside the other
  // preference rows.
  if (id.startsWith('theme-')) return 'Settings'
  if (id === 'create' || id === 'new-issue') return 'Issues'
  if (id === 'new-initiative') return 'Projects'
  if (id === 'new-document') return 'Documents'
  if (id === 'toggle-sidebar' || id === 'customize-sidebar') return 'Navigation'
  // Navigate-straight-to-an-entity commands (typing a project / cycle / label /
  // member / initiative name jumps there) — Linear buckets these by type.
  if (id.startsWith('nav-project-')) return 'Projects'
  if (id.startsWith('nav-cycle-')) return 'Cycles'
  if (id.startsWith('nav-label-')) return 'Labels'
  if (id.startsWith('nav-initiative-')) return 'Initiatives'
  if (id.startsWith('nav-member-')) return 'Members'
  if (id.startsWith('go-')) return 'Navigation'
  // Sub-page options (st-, pr-, as-, pj-, lb-, due-, cy-, ms-, es-, mt-, cr-) —
  // single ungrouped list.
  return ''
}

/**
 * Fuzzy scorer ranking a command's searchable text against the query. Linear's
 * palette ranks an exact prefix first, then word-boundary initials ("gtp" →
 * "Go to Projects"), then a contiguous substring, then a scattered subsequence;
 * non-matches score 0 and are filtered out. Higher is better.
 */
function scoreMatch(query: string, text: string): number {
  const q = query.toLowerCase().trim()
  const t = text.toLowerCase()
  if (!q) return 1
  // Exact / prefix — the strongest signal.
  if (t === q) return 1000
  if (t.startsWith(q)) return 900 - t.length

  // Word-boundary initials: gather the first letter of each word and match the
  // query against them ("go to projects" → "gtp").
  const initials = t
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
  if (initials.startsWith(q)) return 800 - t.length
  if (initials.includes(q)) return 700 - t.length

  // Contiguous substring (mid-word).
  const idx = t.indexOf(q)
  if (idx >= 0) return 600 - idx - t.length * 0.1

  // Scattered subsequence — every query char appears in order. Reward matches
  // that start on word boundaries and sit close together.
  let ti = 0
  let prev = -1
  let gaps = 0
  let boundaryHits = 0
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    let found = -1
    for (let k = ti; k < t.length; k++) {
      if (t[k] === ch) {
        found = k
        break
      }
    }
    if (found < 0) return 0
    if (found === 0 || /[^a-z0-9]/i.test(t[found - 1])) boundaryHits++
    if (prev >= 0) gaps += found - prev - 1
    prev = found
    ti = found + 1
  }
  return Math.max(1, 400 + boundaryHits * 10 - gaps)
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

/**
 * Section order on the root palette, following Linear's own top-to-bottom
 * sequence. Root commands are declared in whatever order reads best in source,
 * so they are grouped by this before rendering — otherwise a section whose
 * members aren't contiguous would print its header more than once.
 */
const ROOT_SECTIONS = [
  'Recently viewed',
  'Issues',
  'Projects',
  'Documents',
  'Views',
  'Navigation',
  'Settings',
  'Teams',
  'Help',
  'Account',
]

/** Listbox/option ids wiring the input's `aria-activedescendant` to the rows. */
const LISTBOX_ID = 'command-menu-listbox'
const optionId = (i: number) => `command-menu-option-${i}`

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
  /** A project / cycle chosen via `in:project` / `in:cycle` — scopes the issue
   * list to that entity once picked (cleared when the menu resets). */
  const [scopeEntity, setScopeEntity] = useState<
    { kind: 'project' | 'cycle'; id: string } | undefined
  >(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // A row property hotkey (s/p/a/l) seeds the sub-page to drill straight into.
      setPage((useStore.getState().commandPage as Page) ?? null)
      setDueCustom(false)
      setNoCtx(false)
      setScopeEntity(undefined)
    }
  }, [open])

  // Keep the search input focused across sub-page drill-ins (incl. mouse clicks),
  // so the user can keep typing — matches Linear.
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open, page, dueCustom, scopeEntity])

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

  // —— Command-palette scope filters (`is:assigned`, `in:project`, …) ——
  // A leading token narrows the palette to matching issues; a bare `is:`/`in:`
  // surfaces the available-scope hint menu. The `in:project`/`in:cycle` tokens
  // drill into a picker sub-page first, then list that entity's issues.
  const scopeInfo = useMemo(() => parseScope(query), [query])

  // The saved view whose route we're on — its display config is mutable from the
  // palette (Group by / Order by presets), matching Linear's scoping of display
  // options to the active view.
  const currentView = useMemo(() => {
    const m = location.pathname.match(/^\/view\/([^/]+)/)
    return m ? store.savedViews.find((v) => v.id === decodeURIComponent(m[1])) : undefined
  }, [location.pathname, store.savedViews])

  const commands = useMemo<Command[]>(() => {
    const team = store.teams[0]

    // Turn a set of issues into navigate-to-issue command rows.
    const issueRow = (i: Issue, prefix: string): Command => {
      const st = store.states.find((s) => s.id === i.stateId)!
      return {
        id: `${prefix}-${i.id}`,
        label: i.title,
        icon: <StatusIcon type={st.type} color={st.color} />,
        hint: i.identifier,
        keywords: `${i.identifier} ${i.title}`,
        run: () => navigate(`/issue/${i.identifier}`),
      }
    }

    const stateType = (stateId: string) =>
      store.states.find((s) => s.id === stateId)?.type

    // —— Scope sub-pages: pick a project / cycle, then (back at root) list that
    // entity's issues. Selecting sets `scopeEntity` and pops back out of the page.
    if (page === 'scopeProject') {
      return store.projects.map((p) => ({
        id: `sp-${p.id}`,
        label: p.name,
        icon: <span>{p.icon}</span>,
        keywords: p.name,
        keepOpen: true,
        meta: `${store.issues.filter((i) => i.projectId === p.id && !i.archivedAt).length}`,
        run: () => {
          setScopeEntity({ kind: 'project', id: p.id })
          setPage(null)
          setQuery('')
        },
      }))
    }
    if (page === 'scopeCycle') {
      return store.cycles
        .slice()
        .sort((a, b) => a.number - b.number)
        .map((c) => {
          const cycleTeam = store.teams.find((t) => t.id === c.teamId)
          return {
            id: `sc-${c.id}`,
            label: c.name ?? `Cycle ${c.number}`,
            icon: <IterationCw size={15} />,
            hint: cycleTeam?.key,
            keywords: `cycle ${c.number} ${c.name ?? ''}`,
            keepOpen: true,
            run: () => {
              setScopeEntity({ kind: 'cycle', id: c.id })
              setPage(null)
              setQuery('')
            },
          }
        })
    }

    // —— Global sub-page: quick-create drill-in (no issue context needed) ——
    if (page === 'create') {
      return [
        {
          id: 'cr-issue',
          label: 'New issue',
          icon: <PlusCircle size={15} />,
          hint: 'C',
          keywords: 'new issue task bug create',
          run: () => store.setCreateOpen(true),
        },
        {
          id: 'cr-project',
          label: 'New project',
          icon: <Box size={15} />,
          keywords: 'new project create',
          run: () => store.setCreateProjectOpen(true),
        },
        {
          id: 'cr-team',
          label: 'New team',
          icon: <Users size={15} />,
          keywords: 'new team create squad group',
          run: () => store.setCreateTeamOpen(true),
        },
        {
          id: 'cr-document',
          label: 'New document',
          icon: <FileText size={15} />,
          keywords: 'new document doc note spec create',
          run: () => store.setCreateDocumentOpen(true),
        },
        {
          id: 'cr-view',
          label: 'New view',
          icon: <Layers3 size={15} />,
          keywords: 'new view saved filter create',
          run: () =>
            store.openViewModal({
              layout: 'list',
              groupBy: 'status',
              orderBy: 'manual',
              filters: {
                statusIds: [],
                assigneeIds: [],
                priorities: [],
                labelIds: [],
                projectIds: [],
              },
            }),
        },
        {
          id: 'cr-initiative',
          label: 'New initiative',
          icon: <Goal size={15} />,
          keywords: 'new initiative strategy goal create',
          run: () => store.setCreateInitiativeOpen(true),
        },
      ]
    }

    // —— Bulk sub-pages: apply one property to the whole active selection ——
    // (no single-issue context — these mirror the per-issue pickers but call the
    // bulkSet* actions over store.selectedIssueIds.)
    if (page === 'bulkStatus' || page === 'bulkPriority' || page === 'bulkAssignee') {
      const ids = store.selectedIssueIds
      if (page === 'bulkStatus') {
        return [...store.states]
          .sort(
            (a, b) =>
              STATUS_TYPE_ORDER[a.type] - STATUS_TYPE_ORDER[b.type] ||
              a.position - b.position,
          )
          .map((st) => ({
            id: `bs-${st.id}`,
            label: st.name,
            icon: <StatusIcon type={st.type} color={st.color} />,
            keywords: st.name,
            run: () => store.bulkSetStatus(ids, st.id),
          }))
      }
      if (page === 'bulkPriority') {
        return PRIORITY_ORDER.map((p) => ({
          id: `bp-${p}`,
          label: PRIORITY_LABELS[p],
          icon: <PriorityIcon priority={p} />,
          keywords: PRIORITY_LABELS[p],
          run: () => store.bulkSetPriority(ids, p as Priority),
        }))
      }
      // bulkAssignee
      return [
        {
          id: 'ba-none',
          label: 'No assignee',
          icon: <Avatar />,
          keywords: 'unassigned none',
          run: () => store.bulkSetAssignee(ids, undefined),
        },
        ...store.users.map((u) => ({
          id: `ba-${u.id}`,
          label: fmt(u.name),
          icon: <Avatar user={u} />,
          keywords: u.name,
          run: () => store.bulkSetAssignee(ids, u.id),
        })),
      ]
    }

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
      if (page === 'cycle') {
        const teamCycles = store.cycles
          .filter((c) => c.teamId === issue.teamId)
          .sort((a, b) => a.number - b.number)
        return [
          {
            id: 'cy-none',
            label: 'No cycle',
            icon: <IterationCw size={15} />,
            keywords: 'no cycle none',
            selected: !issue.cycleId,
            run: () => store.setIssueCycle(issue.id, undefined),
          },
          ...teamCycles.map((c) => {
            const cs = cycleState(c.startsAt, c.endsAt, Date.now())
            return {
              id: `cy-${c.id}`,
              label: c.name ?? `Cycle ${c.number}`,
              icon: <IterationCw size={15} />,
              keywords: `cycle ${c.number}`,
              meta:
                cs.status === 'active'
                  ? 'Active'
                  : cs.status === 'upcoming'
                    ? 'Upcoming'
                    : `${formatDate(c.startsAt)} – ${formatDate(c.endsAt)}`,
              selected: issue.cycleId === c.id,
              run: () => store.setIssueCycle(issue.id, c.id),
            }
          }),
        ]
      }
      if (page === 'milestone') {
        const projectMilestones = issue.projectId
          ? store.milestones
              .filter((m) => m.projectId === issue.projectId)
              .sort((a, b) => a.sortOrder - b.sortOrder)
          : []
        return [
          {
            id: 'ms-none',
            label: 'No milestone',
            icon: <Diamond size={15} />,
            keywords: 'no milestone none',
            selected: !issue.milestoneId,
            run: () => store.setIssueMilestone(issue.id, undefined),
          },
          ...projectMilestones.map((m) => ({
            id: `ms-${m.id}`,
            label: m.name,
            icon: <Diamond size={15} />,
            keywords: m.name,
            selected: issue.milestoneId === m.id,
            run: () => store.setIssueMilestone(issue.id, m.id),
          })),
        ]
      }
      if (page === 'estimate') {
        const team = store.teams.find((t) => t.id === issue.teamId)
        return [
          {
            id: 'es-none',
            label: 'No estimate',
            icon: <Hash size={15} />,
            keywords: 'no estimate none zero',
            selected: !issue.estimate,
            run: () => store.setIssueEstimate(issue.id, undefined),
          },
          ...estimatePoints(team)
            .filter((n) => n !== 0)
            .map((n) => ({
              id: `es-${n}`,
              label: estimateLabel(n, team),
              icon: <Hash size={15} />,
              keywords: `estimate ${n} points`,
              selected: issue.estimate === n,
              run: () => store.setIssueEstimate(issue.id, n),
            })),
        ]
      }
      if (page === 'moveTeam') {
        return store.teams
          .filter((t) => t.id !== issue.teamId)
          .map((t) => ({
            id: `mt-${t.id}`,
            label: t.name,
            icon: <span className="text-[13px]">{t.icon}</span>,
            hint: t.key,
            keywords: `move team ${t.name} ${t.key}`,
            run: () => store.moveIssueToTeam(issue.id, t.id),
          }))
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
          // "End of this week" is the Friday of the current week — which has
          // already gone by once it's the weekend. A due-date suggestion in the
          // past is never useful, so the row drops out on Sat/Sun.
          ...(isBefore(startOfDay(today), endOfThisWeek)
            ? [
                {
                  id: 'due-endweek',
                  label: 'End of this week',
                  icon: <CalendarDays size={15} />,
                  meta: format(endOfThisWeek, 'EEE, d MMM'),
                  keywords: 'end of this week friday',
                  run: () => set(endOfThisWeek),
                },
              ]
            : []),
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

      if (page === 'parent') {
        // Collect this issue + all its descendants so they can't be chosen as a
        // parent (that would create a cycle — the store guards it too, but the
        // picker shouldn't even offer them).
        const blocked = new Set<string>([issue.id])
        let grew = true
        while (grew) {
          grew = false
          for (const i of store.issues) {
            if (i.parentId && blocked.has(i.parentId) && !blocked.has(i.id)) {
              blocked.add(i.id)
              grew = true
            }
          }
        }
        return store.issues
          .filter((i) => !blocked.has(i.id) && !i.archivedAt)
          // Most-recently-touched first, so the (capped) landing list is the one
          // you'd actually reach for; typing still searches the whole workspace.
          .slice()
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map((i) => {
            const st = store.states.find((s) => s.id === i.stateId)!
            return {
              id: `pa-${i.id}`,
              label: i.title,
              icon: <StatusIcon type={st.type} color={st.color} />,
              hint: i.identifier,
              keywords: `${i.identifier} ${i.title}`,
              selected: i.id === issue.parentId,
              run: () => store.setIssueParent(issue.id, i.id),
            }
          })
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

    // —— `in:project` / `in:cycle` result list (after picking the entity) ——
    // The free-text query narrows within the chosen project's / cycle's issues.
    if (!page && scopeEntity) {
      const text = query.toLowerCase().trim()
      const inEntity = (i: Issue) =>
        scopeEntity.kind === 'project'
          ? i.projectId === scopeEntity.id
          : i.cycleId === scopeEntity.id
      return store.issues
        .filter((i) => !i.archivedAt && inEntity(i))
        .filter(
          (i) =>
            !text ||
            i.title.toLowerCase().includes(text) ||
            i.identifier.toLowerCase().includes(text),
        )
        .slice(0, 50)
        .map((i) => issueRow(i, 'issue'))
    }

    // —— Scope filters (only at the root, no issue-context page) ——
    // A bare `is:`/`in:` shows the available-scope hint rows…
    if (!page && scopeInfo.hintFor) {
      return SCOPES.filter((s) => s.id.startsWith(`${scopeInfo.hintFor}:`)).map(
        (s) => ({
          id: `scope-${s.id}`,
          label: s.id,
          icon: <Filter size={15} />,
          meta: s.hint,
          keywords: `${s.id} ${s.label} ${s.hint}`,
          run: () => {
            // Project / cycle scopes drill into a picker; the rest re-seed the
            // query with the chosen token so the scoped issues render.
            if (s.id === 'in:project') {
              setPage('scopeProject')
              setQuery('')
            } else if (s.id === 'in:cycle') {
              setPage('scopeCycle')
              setQuery('')
            } else {
              setQuery(`${s.id} `)
            }
          },
          keepOpen: true,
        }),
      )
    }

    // …and a fully-typed `is:` token narrows the palette to matching issues,
    // with the trailing text (`scopeInfo.rest`) applied as a free-text filter.
    // (`in:project` / `in:cycle` need a picker — handled via their sub-pages.)
    if (
      !page &&
      scopeInfo.scope &&
      scopeInfo.scope !== 'in:project' &&
      scopeInfo.scope !== 'in:cycle'
    ) {
      const sc = scopeInfo.scope
      const text = scopeInfo.rest.toLowerCase()
      const matches = (i: Issue): boolean => {
        if (i.archivedAt) return false
        if (sc === 'is:assigned' && !i.assigneeId) return false
        if (sc === 'is:mine' && i.assigneeId !== store.currentUserId) return false
        if (sc === 'is:unassigned' && i.assigneeId) return false
        if (sc === 'is:active') {
          const t = stateType(i.stateId)
          if (t !== 'started' && t !== 'unstarted') return false
        }
        if (sc === 'is:backlog' && stateType(i.stateId) !== 'backlog') return false
        return true
      }
      const scoped = store.issues
        .filter(matches)
        .filter(
          (i) =>
            !text ||
            i.title.toLowerCase().includes(text) ||
            i.identifier.toLowerCase().includes(text),
        )
        .slice(0, 50)
        .map((i) => issueRow(i, 'issue'))
      // Keep the scope chip itself visible as a non-actionable header-like row by
      // returning just the issues — the input still shows the typed token.
      return scoped
    }

    // —— Root page ——
    const contextual: Command[] = currentIssue
      ? (() => {
          const issue = currentIssue
          const st = store.states.find((s) => s.id === issue.stateId)!
          const issueTeam = store.teams.find((t) => t.id === issue.teamId)
          const hasTeamCycles = store.cycles.some(
            (c) => c.teamId === issue.teamId,
          )
          const hasProjectMilestones = issue.projectId
            ? store.milestones.some((m) => m.projectId === issue.projectId)
            : false
          const usesEstimates = teamEstimationType(issueTeam) !== 'notUsed'
          const archived = !!issue.archivedAt
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
              label: 'Change priority…',
              icon: <PriorityIcon priority={issue.priority} />,
              hint: 'P',
              keywords: 'priority set change',
              goPage: 'priority' as Page,
            },
            {
              id: 'ctx-project',
              label: 'Move to project…',
              icon: <FolderPlus size={15} />,
              hint: '⇧ P',
              keywords: 'project add to move',
              goPage: 'project' as Page,
            },
            {
              id: 'ctx-label',
              label: 'Change or add labels…',
              icon: <Tag size={15} />,
              hint: 'L',
              keywords: 'label labels add change',
              goPage: 'label' as Page,
            },
            ...(usesEstimates
              ? [
                  {
                    id: 'ctx-estimate',
                    label: 'Set estimate…',
                    icon: <Hash size={15} />,
                    // Bound as ⇧E in `useShortcuts` — the plain `E` this used to
                    // print did nothing.
                    hint: '⇧ E',
                    keywords: 'estimate points effort size',
                    goPage: 'estimate' as Page,
                  },
                ]
              : []),
            ...(hasTeamCycles
              ? [
                  {
                    id: 'ctx-cycle',
                    label: 'Move to cycle…',
                    icon: <IterationCw size={15} />,
                    hint: '⇧ C',
                    keywords: 'cycle move sprint iteration',
                    goPage: 'cycle' as Page,
                  },
                ]
              : []),
            ...(hasProjectMilestones
              ? [
                  {
                    id: 'ctx-milestone',
                    label: 'Set milestone…',
                    icon: <Diamond size={15} />,
                    hint: '⇧ M',
                    keywords: 'milestone set project',
                    goPage: 'milestone' as Page,
                  },
                ]
              : []),
            ...(store.teams.length > 1
              ? [
                  {
                    id: 'ctx-move-team',
                    label: 'Move to a different team…',
                    icon: <ArrowRightLeft size={15} />,
                    keywords: 'move team transfer change different',
                    goPage: 'moveTeam' as Page,
                  },
                ]
              : []),
            {
              id: 'ctx-duedate',
              label: 'Set due date…',
              icon: <CalendarDays size={15} />,
              hint: '⇧ D',
              keywords: 'due date deadline set',
              goPage: 'dueDate' as Page,
            },
            // —— Copy block, in Linear's order. Only the three chords we actually
            // bind in `useShortcuts` print a hint.
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
              hint: '⌘ ⇧ ,',
              keywords: 'copy url link',
              run: () => copyToClipboard(issueUrl(issue.identifier), copyToast.url()),
            },
            {
              id: 'ctx-copy-title',
              label: 'Copy issue title',
              icon: <Type size={15} />,
              keywords: 'copy title name text',
              run: () => copyToClipboard(issue.title, copyToast.title()),
            },
            {
              id: 'ctx-copy-title-link',
              label: 'Copy title as link',
              icon: <Link size={15} />,
              keywords: 'copy title as link markdown anchor',
              run: () =>
                copyToClipboard(
                  `[${issue.identifier} ${issue.title}](${issueUrl(issue.identifier)})`,
                  copyToast.link(),
                ),
            },
            {
              id: 'ctx-copy-description',
              label: 'Copy issue description as Markdown',
              icon: <FileText size={15} />,
              keywords: 'copy description body markdown md',
              run: () =>
                copyToClipboard(issue.description, copyToast.description()),
            },
            {
              id: 'ctx-copy-content',
              label: 'Copy issue content as Markdown',
              icon: <FileText size={15} />,
              keywords: 'copy content issue markdown md title description',
              run: () =>
                copyToClipboard(
                  `# ${issue.title}\n\n${issue.description}`.trimEnd(),
                  copyToast.content(),
                ),
            },
            {
              id: 'ctx-copy-branch',
              label: 'Copy git branch name',
              icon: <GitBranch size={15} />,
              hint: '⌘ ⇧ .',
              keywords: 'copy git branch name',
              run: () =>
                copyToClipboard(
                  branchName(issue.identifier, issue.title, me),
                  copyToast.branch(),
                ),
            },
            {
              id: 'ctx-subscribe',
              label: subscribed ? 'Unsubscribe from issue' : 'Subscribe to issue',
              icon: subscribed ? <BellOff size={15} /> : <Bell size={15} />,
              keywords: 'subscribe unsubscribe notifications follow watch',
              run: () =>
                store.toggleIssueSubscriber(issue.id, store.currentUserId),
            },
            {
              id: 'ctx-favorite',
              label: starred ? 'Unfavorite issue' : 'Favorite issue',
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
              id: 'ctx-add-link',
              label: 'Add link…',
              icon: <Link2 size={15} />,
              keywords: 'add link url attachment reference',
              run: () => store.openLinkModal(issue.id),
            },
            {
              id: 'ctx-parent',
              label: 'Make sub-issue of…',
              icon: <GitBranch size={15} />,
              keywords: 'parent sub issue convert nest move under child',
              goPage: 'parent' as Page,
            },
            ...(issue.parentId
              ? [
                  {
                    id: 'ctx-remove-parent',
                    label: 'Remove parent',
                    icon: <X size={15} />,
                    keywords: 'remove parent unlink unnest detach sub issue',
                    run: () => store.setIssueParent(issue.id, undefined),
                  },
                ]
              : []),
            {
              id: 'ctx-duplicate',
              label: 'Make a copy as new issue…',
              icon: <CopyPlus size={15} />,
              keywords: 'duplicate copy clone new issue',
              run: () => {
                const dupe = store.duplicateIssue(issue.id)
                if (dupe) navigate(`/issue/${dupe.identifier}`)
              },
            },
            {
              id: 'ctx-archive',
              label: archived ? 'Unarchive issue' : 'Archive issue',
              icon: archived ? (
                <ArchiveRestore size={15} />
              ) : (
                <Archive size={15} />
              ),
              hint: archived ? undefined : '⌘ ⇧ ⌫',
              keywords: archived
                ? 'unarchive restore'
                : 'archive remove hide',
              run: () =>
                archived
                  ? store.unarchiveIssue(issue.id)
                  : store.archiveIssue(issue.id),
            },
            {
              id: 'ctx-delete',
              label: 'Delete issue',
              icon: <Trash2 size={15} />,
              keywords: 'delete remove trash',
              run: () => store.deleteIssue(issue.id),
            },
          ]
        })()
      : []

    // —— Bulk actions over an active multi-selection (only when no single issue
    // is in context — those get the per-issue `contextual` commands instead).
    const selectedCount = store.selectedIssueIds.length
    const bulkCommands: Command[] =
      !currentIssue && selectedCount > 0
        ? [
            {
              id: 'bulk-status',
              label: `Set status for ${selectedCount} ${selectedCount === 1 ? 'issue' : 'issues'}…`,
              icon: <StatusIcon type="started" color="var(--status-started)" />,
              keywords: 'bulk set status state selection selected issues',
              goPage: 'bulkStatus' as Page,
            },
            {
              id: 'bulk-priority',
              label: `Set priority for ${selectedCount} ${selectedCount === 1 ? 'issue' : 'issues'}…`,
              icon: <PriorityIcon priority={0} />,
              keywords: 'bulk set priority selection selected issues',
              goPage: 'bulkPriority' as Page,
            },
            {
              id: 'bulk-assign',
              label: `Assign selected to…`,
              icon: <User size={15} />,
              keywords: 'bulk assign assignee selection selected issues member',
              goPage: 'bulkAssignee' as Page,
            },
          ]
        : []

    const base: Command[] = [
      {
        id: 'create',
        label: 'Create…',
        icon: <Plus size={15} />,
        keywords: 'create new add issue project document view initiative',
        goPage: 'create' as Page,
      },
      {
        id: 'new-issue',
        label: 'Create new issue…',
        icon: <PlusCircle size={15} />,
        hint: 'C',
        keywords: 'add create issue new',
        run: () => store.setCreateOpen(true),
      },
      {
        id: 'new-initiative',
        label: 'Create new initiative…',
        icon: <Goal size={15} />,
        keywords: 'add create initiative new strategy',
        run: () => store.setCreateInitiativeOpen(true),
      },
      {
        id: 'go-inbox',
        label: 'Go to inbox',
        hint: 'G then I',
        icon: <Inbox size={15} />,
        keywords: 'inbox notifications',
        run: () => navigate('/inbox'),
      },
      {
        id: 'go-my',
        label: 'Go to my issues',
        hint: 'G then M',
        icon: <CircleDot size={15} />,
        keywords: 'my issues assigned',
        run: () => navigate('/my-issues'),
      },
      {
        id: 'go-issues',
        label: 'Go to active issues',
        icon: <StatusIcon type="started" color="var(--status-started)" />,
        keywords: 'issues team',
        run: () => navigate(`/team/${team.key}/active`),
      },
      {
        id: 'go-cycles',
        label: 'Go to cycles',
        hint: 'G then C',
        icon: <StatusIcon type="started" color="var(--status-started)" />,
        keywords: 'cycles sprints',
        run: () => navigate(`/team/${team.key}/cycles`),
      },
      {
        id: 'go-projects',
        label: 'Go to projects',
        hint: 'G then P',
        icon: <Box size={15} />,
        keywords: 'projects',
        run: () => navigate('/projects'),
      },
      {
        id: 'go-initiatives',
        label: 'Go to initiatives',
        icon: <Goal size={15} />,
        keywords: 'initiatives strategy goals',
        run: () => navigate('/initiatives'),
      },
      {
        id: 'go-roadmap',
        label: 'Go to roadmap',
        hint: 'G then R',
        icon: <Map size={15} />,
        keywords: 'roadmap timeline',
        run: () => navigate('/roadmap'),
      },
      {
        id: 'go-documents',
        label: 'Go to documents',
        icon: <FileText size={15} />,
        keywords: 'documents docs notes specs',
        run: () => navigate('/documents'),
      },
      {
        id: 'go-active-cycles',
        label: 'Go to current cycle',
        icon: <IterationCw size={15} />,
        keywords: 'cycles active sprints all teams overview iteration',
        run: () => navigate('/cycles'),
      },
      {
        id: 'go-pulse',
        label: 'Go to pulse',
        icon: <Activity size={15} />,
        keywords: 'pulse activity feed workspace recent changes',
        run: () => navigate('/pulse'),
      },
      {
        id: 'go-customers',
        label: 'Go to customers',
        icon: <Building2 size={15} />,
        keywords: 'customers crm accounts requests arr',
        run: () => navigate('/customers'),
      },
      {
        id: 'go-releases',
        label: 'Go to releases',
        icon: <Rocket size={15} />,
        keywords: 'releases version ship deploy launch',
        run: () => navigate('/releases'),
      },
      {
        id: 'go-members',
        label: 'Go to members',
        icon: <Users size={15} />,
        keywords: 'members people directory users team',
        run: () => navigate('/members'),
      },
      {
        id: 'go-changelog',
        label: 'Go to changelog',
        icon: <Megaphone size={15} />,
        keywords: 'changelog shipped releases whats new timeline',
        run: () => navigate('/changelog'),
      },
      {
        id: 'go-profile',
        label: 'Go to profile',
        icon: <CircleUser size={15} />,
        keywords: 'profile your work me account dashboard',
        run: () => navigate('/profile'),
      },
      {
        id: 'go-insights',
        label: 'Go to insights',
        icon: <BarChart3 size={15} />,
        keywords: 'insights analytics charts metrics reports stats',
        run: () => navigate('/insights'),
      },
      {
        id: 'go-all-issues',
        label: 'Go to all issues',
        icon: <Layers3 size={15} />,
        keywords: 'all issues workspace every team list',
        run: () => navigate('/all-issues'),
      },
      {
        id: 'go-teams',
        label: 'Go to teams',
        icon: <Building2 size={15} />,
        keywords: 'teams directory groups workspace',
        run: () => navigate('/teams'),
      },
      {
        id: 'go-favorites',
        label: 'Go to favorites',
        icon: <Star size={15} />,
        keywords: 'favorites starred bookmarks pinned',
        run: () => navigate('/favorites'),
      },
      {
        id: 'go-recent',
        label: 'Go to recently viewed',
        icon: <History size={15} />,
        keywords: 'recent recently viewed history opened',
        run: () => navigate('/recent'),
      },
      {
        id: 'go-archive',
        label: 'Go to team archive',
        icon: <Archive size={15} />,
        keywords: 'archive archived deleted removed restore',
        run: () => navigate('/archive'),
      },
      {
        id: 'go-reminders',
        label: 'Go to reminders',
        icon: <Bell size={15} />,
        keywords: 'reminders remind me snooze follow up due',
        run: () => navigate('/reminders'),
      },
      {
        id: 'go-drafts',
        label: 'Go to drafts',
        icon: <PenSquare size={15} />,
        keywords: 'drafts unsent draft issue saved',
        run: () => navigate('/drafts'),
      },
      {
        id: 'customize-sidebar',
        label: 'Customize sidebar',
        icon: <SlidersHorizontal size={15} />,
        keywords: 'customize sidebar navigation hide show reorder badge',
        run: () => store.setCustomizeSidebarOpen(true),
      },
      {
        id: 'go-labels',
        label: 'Go to labels',
        icon: <Tag size={15} />,
        keywords: 'labels tags categories directory',
        run: () => navigate('/labels'),
      },
      {
        id: 'new-document',
        label: 'Create new document…',
        icon: <FileText size={15} />,
        keywords: 'add create document doc new note',
        run: () => {
          const doc = store.createDocument()
          navigate(`/document/${doc.id}`)
        },
      },
      {
        id: 'go-settings',
        label: 'Go to settings',
        icon: <Settings size={15} />,
        keywords: 'settings preferences',
        run: () => navigate('/settings'),
      },
      {
        id: 'help',
        label: 'Open Keyboard Shortcuts Cheat Sheet',
        icon: <Keyboard size={15} />,
        hint: '⌘ /',
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
      {
        // Linear's palette ends on an Account section, and the ⌥⇧Q chord it
        // prints here is already bound in `useShortcuts`.
        id: 'account-logout',
        label: 'Log out',
        icon: <LogOut size={15} />,
        hint: '⌥⇧Q',
        keywords: 'log out sign out logout signout account',
        run: () => {
          useAuth.getState().logout()
          navigate('/')
        },
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

    // —— Recently viewed (newest first) — shown at the top when the query is
    // empty, mirroring Linear's ⌘K landing state. Drops archived / deleted ids.
    const recentCommands: Command[] = store.recentIssueIds
      .map((id) => store.issues.find((i) => i.id === id))
      .filter((i): i is Issue => !!i && !i.archivedAt)
      .slice(0, 5)
      .map((i) => {
        const st = store.states.find((s) => s.id === i.stateId)!
        return {
          id: `recent-${i.id}`,
          label: i.title,
          icon: <StatusIcon type={st.type} color={st.color} />,
          hint: i.identifier,
          keywords: `${i.identifier} ${i.title}`,
          run: () => navigate(`/issue/${i.identifier}`),
        }
      })

    // —— Navigate-straight-to-an-entity — typing a project / cycle / label /
    // member / initiative name jumps directly there. ──────────────────────────
    const entityCommands: Command[] = [
      ...store.projects.map((p) => ({
        id: `nav-project-${p.id}`,
        label: p.name,
        icon: <span>{p.icon}</span>,
        keywords: `project ${p.name}`,
        run: () => navigate(`/project/${p.id}`),
      })),
      ...store.cycles.map((c) => {
        const cycleTeam = store.teams.find((t) => t.id === c.teamId)
        return {
          id: `nav-cycle-${c.id}`,
          label: c.name ?? `Cycle ${c.number}`,
          icon: <IterationCw size={15} />,
          hint: cycleTeam?.key,
          keywords: `cycle ${c.number} ${c.name ?? ''} ${cycleTeam?.name ?? ''}`,
          run: () => navigate(`/team/${cycleTeam?.key ?? team.key}/cycles`),
        }
      }),
      ...store.labels
        .filter((l) => !l.isGroup)
        .map((l) => ({
          id: `nav-label-${l.id}`,
          label: l.name,
          icon: <LabelDot color={l.color} />,
          keywords: `label ${l.name}`,
          run: () => navigate(`/label/${l.id}`),
        })),
      ...store.initiatives.map((init) => ({
        id: `nav-initiative-${init.id}`,
        label: init.name,
        icon: <Goal size={15} />,
        keywords: `initiative ${init.name}`,
        run: () => navigate(`/initiative/${init.id}`),
      })),
      ...store.users.map((u) => ({
        id: `nav-member-${u.id}`,
        label: fmt(u.name),
        icon: <Avatar user={u} size={16} />,
        keywords: `member ${u.name} ${u.email ?? ''}`,
        run: () => navigate(u.isMe ? '/profile' : '/members'),
      })),
    ]

    // —— Saved views: open one straight from the palette (Linear's "Open view"). —
    const viewCommands: Command[] = store.savedViews.map((v) => ({
      id: `view-${v.id}`,
      label: `Open view: ${v.name}`,
      icon: <span className="text-[13px]">{v.icon}</span>,
      keywords: `view saved ${v.name} preset`,
      run: () => navigate(`/view/${v.id}`),
    }))

    // —— Display presets — Group by / Order by. These mutate display config, so
    // they only make sense against a concrete target: the saved view currently
    // open (mutated through updateView). Outside a saved view there's nothing to
    // apply them to, so they're hidden (matches Linear scoping display to a view).
    const displayCommands: Command[] = currentView
      ? [
          ...GROUP_PRESETS.map((g) => ({
            id: `group-${g.id}`,
            label: `Group by ${g.label.toLowerCase()}`,
            icon: <Group size={15} />,
            keywords: `group by ${g.label} display`,
            selected: currentView.groupBy === g.id,
            keepOpen: true,
            run: () => store.updateView(currentView.id, { groupBy: g.id }),
          })),
          ...ORDER_PRESETS.map((o) => ({
            id: `order-${o.id}`,
            label: `Order by ${o.label.toLowerCase()}`,
            icon: <ArrowUpDown size={15} />,
            keywords: `order by sort ${o.label} display`,
            selected: currentView.orderBy === o.id,
            keepOpen: true,
            run: () => store.updateView(currentView.id, { orderBy: o.id }),
          })),
        ]
      : []

    // —— Toggle issue-row display property visibility (global, persisted). The
    // check marks the currently-visible ones; running flips it via the existing
    // toggleDisplayProperty action and keeps the menu open for rapid toggling.
    const displayPropCommands: Command[] = DISPLAY_PROPERTIES.map((p) => {
      const on = store.displayProperties[p.id]
      return {
        id: `disp-${p.id}`,
        label: `${on ? 'Hide' : 'Show'} ${p.label.toLowerCase()}`,
        icon: on ? <Eye size={15} /> : <EyeOff size={15} />,
        keywords: `display property column ${p.label} show hide toggle`,
        selected: on,
        keepOpen: true,
        run: () => store.toggleDisplayProperty(p.id as DisplayProperty),
      }
    })

    return [
      ...contextual,
      ...bulkCommands,
      ...recentCommands,
      ...base,
      ...viewCommands,
      ...displayCommands,
      ...displayPropCommands,
      ...entityCommands,
      ...issueCommands,
    ]
  }, [
    store,
    navigate,
    fmt,
    page,
    currentIssue,
    currentView,
    scopeInfo,
    scopeEntity,
    me,
    query,
  ])

  const filtered = useMemo(() => {
    // The due-date page bakes the query into its own suggestions — show as-is.
    if (page === 'dueDate') return commands
    // A scope token (`is:…`/`in:…`) or a picked project/cycle already produced
    // the exact result set (query applied inline) — skip fuzzy re-scoring.
    if (!page && (scopeInfo.scope || scopeInfo.hintFor || scopeEntity))
      return commands
    if (!query) {
      // Inside a sub-page show every option; on the root, the landing state is
      // the "Recently viewed" rows followed by *every* root command, sectioned
      // and scrollable. Linear's root palette lists its whole command set this
      // way (~80 rows across 21 sections) rather than a teaser slice — the
      // long entity-nav / per-issue / view / display lists still only surface
      // once you type, because those are workspace data, not commands.
      // A sub-page shows every option — except the entity pickers backed by the
      // whole workspace ("Make sub-issue of…" is one row per issue). Rendering
      // 800 buttons into a 320px listbox is all cost and no use; typing still
      // fuzzy-searches the full set below.
      if (page) return commands.slice(0, 50)
      const recent = commands.filter((c) => c.id.startsWith('recent-'))
      const roots = commands.filter(
        (c) =>
          !c.id.startsWith('recent-') &&
          !c.id.startsWith('nav-') &&
          !c.id.startsWith('issue-') &&
          !c.id.startsWith('view-') &&
          !c.id.startsWith('group-') &&
          !c.id.startsWith('order-') &&
          !c.id.startsWith('disp-'),
      )
      // Stable-sort into Linear's section order so each header prints once.
      // The contextual issue commands and the bulk-selection commands sort
      // *ahead* of every section: Linear opens ⌘K on the thing you're looking
      // at, so its actions come first. (They carry no section name of their own,
      // which is why they'd otherwise land in the unranked bucket at the end.)
      const rank = (c: Command) => {
        if (c.id.startsWith('ctx-')) return -2
        if (c.id.startsWith('bulk-')) return -1
        const i = ROOT_SECTIONS.indexOf(groupOf(c.id))
        return i === -1 ? ROOT_SECTIONS.length : i
      }
      return [...recent, ...roots]
        .map((c, i) => ({ c, i }))
        .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
        .map((x) => x.c)
    }
    // Fuzzy-score every command against the query and rank best-first; ties keep
    // their source order (recent → root → entities → issues) via the index.
    return commands
      .map((c, i) => {
        const score = Math.max(
          scoreMatch(query, c.label),
          scoreMatch(query, c.keywords ?? '') * 0.9,
        )
        return { c, score, i }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, 40)
      .map((x) => x.c)
  }, [commands, query, page, scopeInfo, scopeEntity])

  useEffect(() => {
    setActive(0)
  }, [query, page])

  // The root palette is now the full command set, so the highlight routinely
  // sits outside the 320px viewport — keep it scrolled into view the way
  // Linear does. `nearest` scrolls the minimum amount, so the list doesn't
  // jump when the row is already visible.
  useEffect(() => {
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(active))}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

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
    } else if (scopeEntity) {
      // Pop the picked project/cycle scope back to the plain palette.
      setScopeEntity(undefined)
      setQuery('')
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

  // Name the active project/cycle scope so the chip + placeholder reflect it.
  const scopeEntityName = scopeEntity
    ? scopeEntity.kind === 'project'
      ? store.projects.find((p) => p.id === scopeEntity.id)?.name
      : (() => {
          const c = store.cycles.find((cy) => cy.id === scopeEntity.id)
          return c ? (c.name ?? `Cycle ${c.number}`) : undefined
        })()
    : undefined

  const placeholder = page
    ? PAGE_PLACEHOLDER[page]
    : scopeEntity
      ? `Search issues in ${scopeEntityName ?? scopeEntity.kind}…`
      : 'Type a command or search…'

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
          } else if (
            e.key === 'Backspace' &&
            query === '' &&
            (page || scopeEntity || currentIssue)
          ) {
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
          {scopeEntity && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-bg-hover py-1 pl-2 pr-1 text-[12px] text-fg">
              <Filter size={11} className="text-faint" />
              <span className="max-w-40 truncate text-muted">
                {scopeEntityName ?? scopeEntity.kind}
              </span>
              <button
                type="button"
                onClick={back}
                className="flex h-4 w-4 items-center justify-center rounded text-faint hover:bg-bg-hover hover:text-fg"
                aria-label="Remove scope filter"
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
            // Linear's palette input is a combobox driving a listbox: the
            // options own the ids, the input points at the active one. Keyboard
            // focus never leaves the field, so `aria-activedescendant` is what
            // tells a screen reader which row is highlighted.
            role="combobox"
            aria-label="Command menu"
            aria-expanded
            aria-controls={LISTBOX_ID}
            aria-autocomplete="list"
            aria-activedescendant={filtered[active] ? optionId(active) : undefined}
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
          <div
            ref={listRef}
            id={LISTBOX_ID}
            role="listbox"
            aria-label="Commands"
            className="max-h-80 overflow-y-auto py-1"
          >
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
                    // Linear renders these section labels in sentence case, not
                    // caps — "Navigation", not "NAVIGATION".
                    <div className="select-none px-4 pb-1 pt-2.5 text-[11px] font-medium text-faint">
                      {group}
                    </div>
                  )}
                  <button
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
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
