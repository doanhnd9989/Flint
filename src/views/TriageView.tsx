import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Filter,
  Inbox,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { EmptyState, CheckIllustration } from '@/components/EmptyState'
import { StatusIcon } from '@/components/StatusIcon'
import { PriorityIcon } from '@/components/PriorityIcon'
import { Avatar } from '@/components/Avatar'
import { LabelDot } from '@/components/LabelChip'
import { StarButton } from '@/components/StarButton'
import { IssueDetailBody } from '@/components/IssueDetailBody'
import { IssueOptionsMenu } from '@/components/IssueOptionsMenu'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { Popover } from '@/components/ui/Popover'
import { Toggle } from '@/components/ui/Toggle'
import { TriageContextMenu } from '@/components/TriageContextMenu'
import { DatePicker } from '@/components/DatePicker'
import { snoozePresets, stamp } from '@/lib/dateOptions'
import { PRIORITY_LABELS, PRIORITY_ORDER, PRIORITY_SORT } from '@/lib/constants'
import type { Issue, Priority } from '@/lib/types'

const chip =
  'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover'

/** The four triage actions in the detail header — Linear's plain text buttons. */
const actionCls =
  'flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg'

/**
 * Ordering options for the Triage queue, in Linear's Display menu wording and
 * order. `Added to triage` is Linear's default and means newest-first — the
 * moment an issue entered the queue.
 */
type SortKey = 'added' | 'priority' | 'due'
const SORT_LABELS: Record<SortKey, string> = {
  added: 'Added to triage',
  priority: 'Priority',
  due: 'Due date',
}
const SORT_ORDER: SortKey[] = ['added', 'priority', 'due']

/**
 * Triage — Linear's split pane: a narrow queue on the left, the selected issue
 * in full on the right. The selection lives in the URL
 * (`/team/:teamKey/triage/:identifier`) so it survives a reload and can be
 * linked; Linear reuses its own `/issue/:id` URL for the same pane, which would
 * mean the issue route rendering the triage layout — see PROGRESS.md.
 */
export function TriageView() {
  const { teamKey, identifier } = useParams()
  const navigate = useNavigate()
  const store = useStore()
  const fmt = useDisplayName()
  const team = store.teams.find((t) => t.key === teamKey) ?? store.teams[0]

  // Local-only header controls: a priority filter ('all' or a Priority value),
  // a sort order, and Linear's `Show snoozed`. They compose — filter narrows,
  // then sort orders.
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('added')
  // Snoozing hides a card until its moment arrives. Without a way back it looks
  // like the issue was deleted, so Linear puts a `Show snoozed` switch in the
  // Display menu; off by default, exactly as there.
  const [showSnoozed, setShowSnoozed] = useState(false)

  // The full triage queue for this team (also the count shown in the header),
  // plus the ids that are snoozed *right now*. Both come out of one pass so the
  // list and the row badge can never disagree about what "snoozed" means, and
  // so "now" is read once per recompute rather than once per rendered row.
  const { allQueue, snoozedIds } = useMemo(() => {
    const now = Date.now()
    const snoozed = new Set<string>()
    const rows = store.issues.filter((i) => {
      if (i.teamId !== team.id || !i.triage || i.archivedAt) return false
      const isSnoozed =
        !!i.snoozedUntil && new Date(i.snoozedUntil).getTime() > now
      if (isSnoozed) snoozed.add(i.id)
      // Snoozed issues drop out of the immediate triage focus until the snooze
      // elapses — like active lists — unless `Show snoozed` is on.
      return showSnoozed || !isSnoozed
    })
    return { allQueue: rows, snoozedIds: snoozed }
  }, [store.issues, team.id, showSnoozed])

  // Apply the priority filter, then the chosen sort order.
  const queue = useMemo(() => {
    const filtered =
      priorityFilter === 'all'
        ? allQueue
        : allQueue.filter((i) => i.priority === Number(priorityFilter))
    const sorted = [...filtered]
    if (sort === 'priority') {
      sorted.sort((a, b) => PRIORITY_SORT[a.priority] - PRIORITY_SORT[b.priority])
    } else if (sort === 'due') {
      // Issues without a due date sort last, as they do everywhere else.
      sorted.sort((a, b) => (a.dueDate ?? '￿').localeCompare(b.dueDate ?? '￿'))
    } else {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return sorted
  }, [allQueue, priorityFilter, sort])

  // ── The pane's selection ──
  // Resolved against every issue in the team, not just the queue, so a row that
  // has just been accepted (or one reached from "Recently accepted") still
  // renders instead of blanking the pane. The triage actions key off
  // `issue.triage`, so they disappear on their own once it leaves the queue.
  const selected = useMemo(
    () =>
      identifier
        ? store.issues.find(
            (i) => i.identifier === identifier && i.teamId === team.id,
          )
        : undefined,
    [store.issues, identifier, team.id],
  )
  const cursor = selected
    ? queue.findIndex((i) => i.id === selected.id)
    : -1

  const triageUrl = (i?: Issue) =>
    i ? `/team/${team.key}/triage/${i.identifier}` : `/team/${team.key}/triage`
  /** Move the pane. Keyboard moves replace, so j/k doesn't fill the history. */
  const select = (i?: Issue, replace = false) =>
    navigate(triageUrl(i), { replace })

  /**
   * Where the pane should land once `id` leaves the queue — the next row at the
   * same slot, or the previous one at the end. Read *before* the mutation, so
   * the row is still in the queue when we look it up.
   */
  const nextAfter = (id: string) => {
    const idx = queue.findIndex((i) => i.id === id)
    if (idx === -1) return undefined
    return queue[idx + 1] ?? queue[idx - 1]
  }

  const accept = (id: string) => {
    const nxt = nextAfter(id)
    store.acceptTriage(id)
    if (selected?.id === id) select(nxt, true)
  }
  const decline = (id: string) => {
    const nxt = nextAfter(id)
    store.declineTriage(id)
    if (selected?.id === id) select(nxt, true)
  }

  // ── Recently-accepted archive ──
  // Accepting a triage issue clears its triage flag and stamps triageAcceptedAt
  // (the moment it joined the workflow). We surface the most recent of those
  // below the live queue so you can glance back at what just left triage —
  // newest first, capped so the list stays a quick reference, not a log.
  const recentlyAccepted = useMemo(
    () =>
      store.issues
        .filter((i) => i.teamId === team.id && !!i.triageAcceptedAt)
        .sort((a, b) =>
          (b.triageAcceptedAt ?? '').localeCompare(a.triageAcceptedAt ?? ''),
        )
        .slice(0, 15),
    [store.issues, team.id],
  )
  // The archive section starts collapsed — it's a reference, not the focus.
  const [archiveOpen, setArchiveOpen] = useState(false)

  // Right-click (and the card's ⋯) open the same menu, at a point. Linear's
  // triage rows carry a full context menu; ours had none at all.
  const [menu, setMenu] = useState<{
    id: string
    x: number
    y: number
    /** Stamped here, in the handler, so the menu itself stays pure. */
    nowMs: number
  } | null>(null)

  const rowRefs = useRef<(HTMLButtonElement | null)[]>([])

  // ── Speedrun mode (Linear-style focused triage) ──
  // A distraction-free single-card mode: the first issue in the queue is shown
  // large with big on-screen key hints, and A accepts / D|X declines, advancing
  // to the next issue after each action. Esc exits. The queue narrows from the
  // front as you act, so we always focus queue[0].
  const [speedrun, setSpeedrun] = useState(false)
  const focusIssue = queue[0]
  // Progress: how far through the original session we are. We track the total at
  // the moment speedrun began so "3 of 12" counts down a stable denominator.
  const [speedrunTotal, setSpeedrunTotal] = useState(0)
  const enterSpeedrun = () => {
    setSpeedrunTotal(queue.length)
    setSpeedrun(true)
  }
  // Auto-exit once the queue is exhausted (or filtered to empty) while running.
  useEffect(() => {
    if (speedrun && queue.length === 0) setSpeedrun(false)
  }, [speedrun, queue.length])

  // ── Bulk multi-select (Linear lets you triage several issues at once) ──
  // A set of checked issue ids; `x` toggles the pane's row, ⌘/Ctrl-click toggles
  // a row without moving the pane, and a floating action bar appears while
  // anything is checked. Ids that leave the queue are pruned automatically.
  const [checked, setChecked] = useState<Set<string>>(() => new Set())

  // Drop any checked ids that are no longer in the queue (accepted, declined,
  // filtered out) so the action-bar count never overstates the selection.
  useEffect(() => {
    setChecked((prev) => {
      if (prev.size === 0) return prev
      const live = new Set(queue.map((i) => i.id))
      let changed = false
      const next = new Set<string>()
      prev.forEach((id) => {
        if (live.has(id)) next.add(id)
        else changed = true
      })
      return changed ? next : prev
    })
  }, [queue])

  // The checked issues, in queue order, plus a tiny toggle helper.
  const checkedIssues = useMemo(
    () => queue.filter((i) => checked.has(i.id)),
    [queue, checked],
  )
  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Accept / decline the whole current selection, then clear it. The pane lands
  // on whatever survives, so it never sits on an issue that just left.
  const acceptChecked = () => {
    const nxt = queue.find((i) => !checked.has(i.id))
    checkedIssues.forEach((i) => store.acceptTriage(i.id))
    setChecked(new Set())
    if (selected && checked.has(selected.id)) select(nxt, true)
  }
  const declineChecked = () => {
    const nxt = queue.find((i) => !checked.has(i.id))
    checkedIssues.forEach((i) => store.declineTriage(i.id))
    setChecked(new Set())
    if (selected && checked.has(selected.id)) select(nxt, true)
  }

  // Snooze an issue out of the immediate triage focus until the given ISO time
  // (a snoozedUntil in the future hides it from active lists). Mirrors Linear's
  // "remind me later" — the row leaves the queue, so the pane advances onto the
  // next issue, and it drops out of any checked set.
  const snoozeIssue = (id: string, iso: string) => {
    const nxt = nextAfter(id)
    store.setIssueSnooze(id, iso)
    setChecked((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (!showSnoozed && selected?.id === id) select(nxt, true)
  }

  // Keep the pane's row in view whenever the selection moves.
  useEffect(() => {
    if (cursor >= 0) rowRefs.current[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  // Capture-phase handler so we pre-empt the global j/k/arrow shortcuts, mirror
  // of the Inbox queue. Guarded against typing targets and open overlays.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onKeyRef.current = (e: KeyboardEvent) => {
    // Speedrun owns the keyboard while active — its handler runs the show.
    if (speedrun) return
    const t = e.target as HTMLElement
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      return
    if (document.querySelector('[data-overlay]')) return
    if (!queue.length || e.metaKey || e.ctrlKey || e.altKey) return
    // With nothing selected yet, j/k start at the top of the queue.
    const cur = cursor >= 0 ? queue[cursor] : undefined
    const own = () => {
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    if (e.key === 'ArrowDown' || e.key === 'j') {
      own()
      select(queue[Math.min(cursor + 1, queue.length - 1)] ?? queue[0], true)
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'k') {
      own()
      select(queue[Math.max(cursor - 1, 0)] ?? queue[0], true)
      return
    }
    // Toggle the pane row's checkbox (X), Linear's multi-select key.
    if (e.code === 'KeyX') {
      if (!cur) return
      own()
      toggleChecked(cur.id)
      return
    }
    // Clear the whole checked set (Escape).
    if (e.key === 'Escape' && checked.size) {
      own()
      setChecked(new Set())
      return
    }
    // Open the selected issue on its own page (Enter / O). The pane already
    // shows it, so this is the "give it the full window" move.
    if (e.key === 'Enter' || e.code === 'KeyO') {
      if (!cur) return
      own()
      navigate(`/issue/${cur.identifier}`)
      return
    }
    // Accept — Linear binds this to `1`; `A` stays as the mnemonic this app
    // shipped with. Acts on the whole checked set when one exists, otherwise on
    // the pane's issue (which leaves the queue, so the pane advances).
    if (e.code === 'KeyA' || e.key === '1') {
      own()
      if (checked.size) acceptChecked()
      else if (cur) accept(cur.id)
      return
    }
    // Decline — `2` in Linear; `D` / ⌫ keep working. Same selection awareness.
    if (
      e.code === 'KeyD' ||
      e.key === '2' ||
      e.key === 'Backspace' ||
      e.key === 'Delete'
    ) {
      own()
      if (checked.size) declineChecked()
      else if (cur) decline(cur.id)
      return
    }
    // Mark as duplicate (`3`) — opens the relation picker on the pane's issue.
    // Bulk has no meaning here (a duplicate points at one issue), so this one
    // always acts on the selection.
    if (e.key === '3') {
      if (!cur) return
      own()
      store.openRelationPicker(cur.id, 'duplicateOf')
      return
    }
    // Snooze (H) — push the issue out of triage focus until tomorrow (Linear's
    // default snooze). Acts on the whole checked set when one exists, else the
    // pane's issue, which leaves the queue so the pane advances.
    if (e.code === 'KeyH') {
      own()
      // presets[1] is `Tomorrow` — Linear's default when H is pressed bare.
      const iso = snoozePresets()[1].at.toISOString()
      if (checked.size) {
        checkedIssues.forEach((i) => snoozeIssue(i.id, iso))
        setChecked(new Set())
      } else if (cur) {
        snoozeIssue(cur.id, iso)
      }
      return
    }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyRef.current(e)
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  // ── Speedrun keyboard handler ──
  // Capture-phase, so it pre-empts the queue handler above while speedrun is on.
  // Same guards as the queue: bail when typing in a field or when an overlay /
  // menu is open ([data-overlay]). A accepts, D|X declines, Esc exits — each
  // accept/decline removes the head of the queue, advancing the spotlight.
  const onSpeedKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onSpeedKeyRef.current = (e: KeyboardEvent) => {
    if (!speedrun) return
    const t = e.target as HTMLElement
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      return
    if (document.querySelector('[data-overlay]')) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const own = () => {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    if (e.key === 'Escape') {
      own()
      setSpeedrun(false)
      return
    }
    if (!focusIssue) return
    if (e.code === 'KeyA') {
      own()
      accept(focusIssue.id)
      return
    }
    if (e.code === 'KeyD' || e.code === 'KeyX') {
      own()
      decline(focusIssue.id)
      return
    }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onSpeedKeyRef.current(e)
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  // Priority filter options: "All priorities" + every priority in visual order.
  const priorityOptions = useMemo<SelectOption[]>(
    () => [
      { id: 'all', label: 'All priorities', selected: priorityFilter === 'all' },
      ...PRIORITY_ORDER.map((p) => ({
        id: String(p),
        label: PRIORITY_LABELS[p],
        icon: <PriorityIcon priority={p} />,
        selected: priorityFilter === String(p),
      })),
    ],
    [priorityFilter],
  )

  // Ordering options, in Linear's Display-menu order.
  const sortOptions = useMemo<SelectOption[]>(
    () =>
      SORT_ORDER.map((k) => ({
        id: k,
        label: SORT_LABELS[k],
        selected: sort === k,
      })),
    [sort],
  )

  // Snooze presets for the header's `Snooze` button. They are clock-relative,
  // so — as in TriageContextMenu — the clock is read in the handler that opens
  // the menu, never during render, and each row carries the moment it lands on
  // ("Tomorrow · Sat, 9 Aug, 9:00") exactly as Linear does.
  const [snoozeOptions, setSnoozeOptions] = useState<SelectOption[]>([])
  const stampSnoozeOptions = () => {
    const now = Date.now()
    // `Next cycle` — the team's next cycle that hasn't started yet, matching
    // the row TriageContextMenu already offers.
    const nextCycle = store.cycles
      .filter(
        (c) => c.teamId === team.id && new Date(c.startsAt).getTime() > now,
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
    setSnoozeOptions([
      ...snoozePresets().map((p) => ({
        id: p.at.toISOString(),
        label: p.label,
        hint: stamp(p.at),
      })),
      ...(nextCycle
        ? [
            {
              id: new Date(nextCycle.startsAt).toISOString(),
              label: 'Next cycle',
              hint: stamp(new Date(nextCycle.startsAt)),
            },
          ]
        : []),
    ])
  }

  /** Click a queue row: ⌘/Ctrl toggles the checkbox, a plain click moves the pane. */
  const onRowClick = (e: React.MouseEvent, issue: Issue) => {
    if (e.metaKey || e.ctrlKey) {
      toggleChecked(issue.id)
      return
    }
    select(issue)
  }

  const showList = !selected
  const queueEmpty = queue.length === 0

  return (
    <div className="relative flex h-full">
      {/* ── Queue column ──
          Fixed-width beside the pane on a wide window; below `lg` the two swap
          places (master → detail) so nothing has to scroll sideways. */}
      <div
        className={cn(
          'relative w-full flex-col border-r border-border lg:flex lg:w-[380px] lg:shrink-0',
          showList ? 'flex' : 'hidden',
        )}
      >
        <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-4">
          {/* Linear drops the team crumb here — the sidebar row already says
              which team's triage this is, and the column is 380px wide. */}
          <span className="shrink-0">{team.icon}</span>
          <span className="text-[13px] font-medium text-fg">Triage</span>
          <span className="text-[12px] tabular-nums text-faint">
            {allQueue.length}
          </span>
          {/* Linear stars the *queue*, not the team — a `triage` favorite,
              keyed by team id, so the sidebar row lands back on this screen. */}
          <StarButton type="triage" id={team.id} size={13} />
          <div className="ml-auto flex items-center gap-1">
            {/* Speedrun only means something with a queue to work through.
                Display options stays — it holds `Show snoozed`, and hiding it
                when everything is snoozed would strand you. */}
            {queue.length > 0 && (
              <button
                onClick={enterSpeedrun}
                aria-label="Speedrun"
                title="Speedrun"
                className="flex size-[26px] items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg"
              >
                <Zap size={14} />
              </button>
            )}
            {/* Linear's `Add filter`; ours filters on priority only, so far. */}
            <SelectMenu
              width={200}
              align="end"
              label="Add filter"
              options={priorityOptions}
              onSelect={setPriorityFilter}
              placeholder="Filter by priority…"
              trigger={
                <span className="flex size-[26px] items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg">
                  <Filter size={14} />
                </span>
              }
            />
            <Popover
              align="end"
              width={268}
              label="Display options"
              trigger={
                <span className="flex size-[26px] items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg">
                  <SlidersHorizontal size={14} />
                </span>
              }
            >
              {() => (
                <div className="px-1 py-0.5">
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-[13px] text-fg">Ordering</span>
                    <SelectMenu
                      width={190}
                      align="end"
                      options={sortOptions}
                      onSelect={(id) => setSort(id as SortKey)}
                      placeholder="Order by…"
                      trigger={
                        <span className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[12px] text-muted hover:bg-bg-hover hover:text-fg">
                          {SORT_LABELS[sort]}
                          <ChevronDown size={12} className="shrink-0 text-faint" />
                        </span>
                      }
                    />
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-[13px] text-fg">Show snoozed</span>
                    <Toggle
                      size="sm"
                      checked={showSnoozed}
                      onChange={setShowSnoozed}
                      aria-label="Show snoozed"
                    />
                  </div>
                </div>
              )}
            </Popover>
          </div>
        </header>

        {/* Active-filter bar — Linear's chip row under the header. Only rendered
            while something is actually filtering the queue. */}
        {priorityFilter !== 'all' && (
          <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-1.5">
            <span className="flex items-center gap-1.5 rounded-md border border-border bg-bg-tertiary py-0.5 pl-1.5 pr-1 text-[12px] text-muted">
              <PriorityIcon priority={Number(priorityFilter) as Priority} />
              Priority is {PRIORITY_LABELS[Number(priorityFilter) as Priority]}
              <button
                onClick={() => setPriorityFilter('all')}
                aria-label="Remove filter"
                className="rounded p-0.5 hover:bg-bg-hover hover:text-fg"
              >
                <X size={11} />
              </button>
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {queueEmpty ? (
            <EmptyState
              className="py-16"
              illustration={<CheckIllustration />}
              title={allQueue.length === 0 ? 'Triage is clear' : 'No matching issues'}
              description={
                allQueue.length === 0
                  ? 'New issues that need triage will show up here.'
                  : 'No issues in this queue match the filter.'
              }
            />
          ) : (
            queue.map((issue, i) => {
              // Linear's row shows who filed it, not who it's assigned to —
              // triage is about the incoming report.
              const requester = store.users.find((u) => u.id === issue.creatorId)
              const isSelected = selected?.id === issue.id
              const isChecked = checked.has(issue.id)
              return (
                <button
                  key={issue.id}
                  ref={(el) => {
                    rowRefs.current[i] = el
                  }}
                  onClick={(e) => onRowClick(e, issue)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    select(issue)
                    setMenu({
                      id: issue.id,
                      x: e.clientX,
                      y: e.clientY,
                      nowMs: Date.now(),
                    })
                  }}
                  className={cn(
                    'flex w-full flex-col gap-1 border-b border-border px-3 py-2.5 text-left',
                    isChecked
                      ? 'bg-accent/10'
                      : isSelected
                        ? 'bg-bg-tertiary'
                        : 'hover:bg-bg-hover',
                  )}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
                      {issue.title}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-faint">
                      {issue.identifier}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Avatar user={requester} size={14} />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                      {requester?.email ?? 'Unknown'}
                    </span>
                    {/* Only reachable with `Show snoozed` on, and then it's the
                        one thing that tells these rows apart. */}
                    {snoozedIds.has(issue.id) && (
                      <span
                        title={`Snoozed until ${formatDate(issue.snoozedUntil!)}`}
                        className="shrink-0 text-faint"
                      >
                        <Clock size={11} />
                      </span>
                    )}
                    {issue.priority > 0 && (
                      <span className="shrink-0">
                        <PriorityIcon priority={issue.priority} />
                      </span>
                    )}
                    <span className="shrink-0 text-[11px] text-faint">
                      {timeAgo(issue.createdAt)} ago
                    </span>
                  </div>
                </button>
              )
            })
          )}

          {/* Recently-accepted archive — a collapsible reference list of issues
              that recently left triage by being accepted into the workflow.
              Newest first, capped; clicking one shows it in the pane. */}
          {recentlyAccepted.length > 0 && (
            <div className="px-3 py-3">
              <button
                onClick={() => setArchiveOpen((o) => !o)}
                className="flex w-full items-center gap-1.5 text-[12px] font-medium text-muted hover:text-fg"
              >
                <ChevronRight
                  size={14}
                  className={cn(
                    'shrink-0 text-faint transition-transform',
                    archiveOpen && 'rotate-90',
                  )}
                />
                <Inbox size={13} className="shrink-0 text-faint" />
                Recently accepted
                <span className="tabular-nums text-faint">
                  {recentlyAccepted.length}
                </span>
              </button>
              {archiveOpen && (
                <div className="mt-2 overflow-hidden rounded-lg border border-border">
                  {recentlyAccepted.map((issue) => {
                    const state = store.states.find((s) => s.id === issue.stateId)
                    return (
                      <button
                        key={issue.id}
                        onClick={() => select(issue)}
                        className="flex w-full items-center gap-2 border-b border-border px-2 py-1.5 text-left last:border-b-0 hover:bg-bg-hover"
                      >
                        {state && (
                          <StatusIcon type={state.type} color={state.color} />
                        )}
                        <span className="min-w-0 flex-1 truncate text-[12px] text-fg">
                          {issue.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-faint">
                          {timeAgo(issue.triageAcceptedAt!)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating bulk-action bar — over the queue column, where the checked
            rows are. Accept / Decline apply to the whole batch. */}
        {checkedIssues.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-2 py-1.5 shadow-lg">
              <span className="px-1 text-[12px] tabular-nums text-muted">
                {checkedIssues.length} selected
              </span>
              <span className="h-4 w-px bg-border" />
              <button
                onClick={acceptChecked}
                className="flex items-center gap-1 rounded-md bg-[var(--status-review)] px-2 py-1 text-[12px] font-medium text-white hover:opacity-90"
              >
                <Check size={13} /> Accept
              </button>
              <button
                onClick={declineChecked}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
              >
                <X size={13} /> Decline
              </button>
              <button
                onClick={() => setChecked(new Set())}
                className="rounded-md px-1.5 py-1 text-[12px] text-faint hover:bg-bg-hover hover:text-fg"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail pane ── */}
      <div
        className={cn(
          'min-w-0 flex-1 flex-col lg:flex',
          selected ? 'flex' : 'hidden',
        )}
      >
        {selected ? (
          <>
            <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-[13px]">
              {/* Back to the bare queue — the only way out of the pane below
                  `lg`, where the two columns swap rather than sit side by side. */}
              <button
                onClick={() => select(undefined)}
                aria-label="Back to triage queue"
                className="-ml-1 flex size-[26px] shrink-0 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg lg:hidden"
              >
                <ChevronRight size={15} className="rotate-180" />
              </button>
              <span className="shrink-0 font-mono text-faint">
                {selected.identifier}
              </span>
              <span className="min-w-0 truncate text-fg">{selected.title}</span>
              <StarButton type="issue" id={selected.id} />
              <IssueOptionsMenu
                issue={selected}
                onOpenIssue={(id) => navigate(`/issue/${id}`)}
                onDeleted={() => select(nextAfter(selected.id), true)}
              />
              <div className="flex-1" />
              {/* Linear's four triage actions, in its order and wording. They
                  vanish once the issue leaves the queue — which is exactly what
                  happens the moment you press one. */}
              {selected.triage && (
                <>
                  <button
                    onClick={() => accept(selected.id)}
                    aria-label="Accept issue from triage"
                    className={actionCls}
                  >
                    <Check size={13} /> Accept
                  </button>
                  <button
                    onClick={() => decline(selected.id)}
                    aria-label="Decline triage issue"
                    className={actionCls}
                  >
                    <Ban size={13} /> Decline
                  </button>
                  <button
                    onClick={() =>
                      store.openRelationPicker(selected.id, 'duplicateOf')
                    }
                    aria-label="Mark triage issue as duplicate"
                    className={actionCls}
                  >
                    <Copy size={13} /> Mark as duplicate
                  </button>
                  <SelectMenu
                    width={280}
                    align="end"
                    label="Snooze triage issue"
                    options={snoozeOptions}
                    onSelect={(iso) => snoozeIssue(selected.id, iso)}
                    placeholder="Snooze until…"
                    // Linear's last snooze row is a free date — a SelectMenu
                    // can't hold a calendar, so it rides in the footer.
                    footer={
                      <DatePicker
                        align="start"
                        onChange={(iso) => {
                          if (iso) snoozeIssue(selected.id, iso)
                        }}
                        trigger={
                          <span className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover">
                            <CalendarDays size={14} className="text-faint" />
                            Custom…
                          </span>
                        }
                      />
                    }
                    trigger={
                      <span onMouseDown={stampSnoozeOptions} className={actionCls}>
                        <Clock size={13} /> Snooze
                      </span>
                    }
                  />
                </>
              )}
            </header>
            <IssueDetailBody
              issue={selected}
              onOpenIssue={(id) => navigate(`/issue/${id}`)}
            />
          </>
        ) : (
          // Linear's resting state for the pane: the queue's size and the one
          // thing you can do without picking a row.
          <EmptyState
            illustration={<CheckIllustration />}
            title={`${allQueue.length} issue${allQueue.length === 1 ? '' : 's'} to triage`}
            action={{
              label: 'Create triage issue',
              onClick: () =>
                store.openCreateWith({ teamId: team.id, triage: true }),
            }}
            hint="J K navigate · 1 accept · 2 decline · 3 duplicate · X select · H snooze"
          />
        )}
      </div>

      {/* Right-click / ⋯ menu for a queue row — Linear's five actions. */}
      {menu && (
        <TriageContextMenu
          issueId={menu.id}
          x={menu.x}
          y={menu.y}
          nowMs={menu.nowMs}
          onClose={() => setMenu(null)}
        />
      )}

      {/* Speedrun overlay — a focused, single-card spotlight. The first issue in
          the live queue is shown large; A accepts, D/X declines (each removes it
          and advances to the next), Esc exits. */}
      {speedrun && focusIssue && (
        <div className="absolute inset-0 z-30 flex flex-col bg-bg/95 backdrop-blur-sm">
          {/* Note: intentionally NOT [data-overlay] — this surface OWNS the
              keyboard (A/D/Esc). Real popovers opened on top carry their own
              [data-overlay], which still suppresses the speedrun keys. */}
          {/* Top bar — progress + exit. */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
              <Zap size={15} className="text-[var(--status-review)]" />
              Speedrun
              <span className="tabular-nums text-faint">
                {Math.min(speedrunTotal - queue.length + 1, speedrunTotal)} of{' '}
                {speedrunTotal}
              </span>
            </div>
            <button
              onClick={() => setSpeedrun(false)}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
            >
              <X size={13} /> Exit <Kbd>Esc</Kbd>
            </button>
          </div>

          {/* Progress bar — fills as the queue drains. */}
          <div className="mx-5 h-1 overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className="h-full rounded-full bg-[var(--status-review)] transition-all"
              style={{
                width: `${
                  speedrunTotal === 0
                    ? 0
                    : ((speedrunTotal - queue.length) / speedrunTotal) * 100
                }%`,
              }}
            />
          </div>

          {/* Spotlight card. */}
          <div className="flex flex-1 items-center justify-center p-6">
            {(() => {
              const state = store.states.find((s) => s.id === focusIssue.stateId)!
              const assignee = store.users.find(
                (u) => u.id === focusIssue.assigneeId,
              )
              const labels = focusIssue.labelIds
                .map((id) => store.labels.find((l) => l.id === id))
                .filter(Boolean)
              return (
                <div className="w-full max-w-2xl rounded-2xl border border-accent bg-bg-secondary p-8 shadow-2xl ring-1 ring-accent">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-faint">
                      {focusIssue.identifier}
                    </span>
                    <PriorityIcon priority={focusIssue.priority} />
                    <span className="text-[12px] text-muted">
                      {PRIORITY_LABELS[focusIssue.priority]}
                    </span>
                  </div>
                  <h2 className="mt-3 text-[22px] font-semibold leading-snug text-fg">
                    {focusIssue.title}
                  </h2>
                  {focusIssue.description && (
                    <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-[13px] text-muted">
                      {focusIssue.description}
                    </p>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-1.5">
                    <span className={chip}>
                      <StatusIcon type={state.type} color={state.color} />
                      {state.name}
                    </span>
                    <span className={chip}>
                      <Avatar user={assignee} size={16} />
                      {assignee ? fmt(assignee.name) : 'Unassigned'}
                    </span>
                    {labels.length > 0 && (
                      <span className={chip}>
                        {labels.slice(0, 3).map((l) => (
                          <LabelDot key={l!.id} color={l!.color} />
                        ))}
                        {labels.length} label{labels.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Big on-screen key hints + clickable fallbacks. */}
          <div className="flex items-center justify-center gap-3 px-6 pb-10">
            <button
              onClick={() => accept(focusIssue.id)}
              className="flex items-center gap-2 rounded-lg bg-[var(--status-review)] px-4 py-2.5 text-[14px] font-medium text-white hover:opacity-90"
            >
              <Check size={16} /> Accept <Kbd>A</Kbd>
            </button>
            <button
              onClick={() => decline(focusIssue.id)}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-[14px] text-muted hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
            >
              <X size={16} /> Decline <Kbd>D</Kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Small inline keycap used by the Speedrun overlay. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-bg-tertiary px-1 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  )
}
