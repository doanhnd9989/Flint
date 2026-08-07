import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Inbox,
  IterationCw,
  MoreHorizontal,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { cycleState } from '@/lib/selectors'
import { formatDate, timeAgo } from '@/lib/utils'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, CheckIllustration } from '@/components/EmptyState'
import { StatusIcon } from '@/components/StatusIcon'
import { PriorityIcon } from '@/components/PriorityIcon'
import { Avatar } from '@/components/Avatar'
import { LabelDot } from '@/components/LabelChip'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { Popover } from '@/components/ui/Popover'
import { Toggle } from '@/components/ui/Toggle'
import { TriageContextMenu } from '@/components/TriageContextMenu'
import {
  StatusPicker,
  PriorityPicker,
  AssigneePicker,
  LabelPicker,
} from '@/components/pickers'
import { snoozePresets } from '@/lib/dateOptions'
import { PRIORITY_LABELS, PRIORITY_ORDER, PRIORITY_SORT } from '@/lib/constants'
import type { Priority } from '@/lib/types'

const chip =
  'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover'

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

export function TriageView() {
  const { teamKey } = useParams()
  const store = useStore()
  const fmt = useDisplayName()
  const team = store.teams.find((t) => t.key === teamKey) ?? store.teams[0]

  // The team's current + upcoming cycles, in number order — the options the
  // per-card Cycle picker offers (past cycles aren't valid triage targets).
  const teamCycles = useMemo(
    () =>
      store.cycles
        .filter((c) => c.teamId === team.id)
        .filter(
          (c) => cycleState(c.startsAt, c.endsAt, Date.now()).status !== 'past',
        )
        .sort((a, b) => a.number - b.number),
    [store.cycles, team.id],
  )

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

  // ── Keyboard-driven queue navigation (Linear's signature Triage workflow) ──
  // A single "active" card is highlighted; j/k (or arrows) move it, Enter opens
  // it, and A/D accept or decline it. Accept/decline removes the card from the
  // queue, so the cursor stays on the same slot to land on the next one.
  const [cursor, setCursor] = useState(0)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  // ── Speedrun mode (Linear-style focused triage) ──
  // A distraction-free single-card mode: the first issue in the queue is shown
  // large with big on-screen key hints, and A accepts / D|X declines, advancing
  // to the next issue after each action. Esc exits. The queue narrows from the
  // front as you act, so we always focus queue[0].
  const [speedrun, setSpeedrun] = useState(false)
  // The card under the speedrun spotlight — always the head of the live queue,
  // so accepting/declining (which removes it) naturally advances to the next.
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
  // A set of selected issue ids; `x` toggles the active row, and a floating
  // action bar appears while anything is selected to Accept / Decline the whole
  // batch in one shot. Ids that leave the queue are pruned automatically.
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  // Keep the cursor in range as the queue shrinks (accept/decline/filter) or
  // empties out — clamp to the last row so it never points past the end.
  useEffect(() => {
    setCursor((c) => (queue.length === 0 ? 0 : Math.min(c, queue.length - 1)))
  }, [queue.length])

  // Drop any selected ids that are no longer in the queue (accepted, declined,
  // filtered out) so the action-bar count never overstates the selection.
  useEffect(() => {
    setSelected((prev) => {
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

  // The selected issues, in queue order, plus a tiny toggle helper.
  const selectedIssues = useMemo(
    () => queue.filter((i) => selected.has(i.id)),
    [queue, selected],
  )
  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Accept / decline the whole current selection, then clear it.
  const acceptSelected = () => {
    selectedIssues.forEach((i) => store.acceptTriage(i.id))
    setSelected(new Set())
  }
  const declineSelected = () => {
    selectedIssues.forEach((i) => store.declineTriage(i.id))
    setSelected(new Set())
  }

  // Snooze an issue out of the immediate triage focus until the given ISO time
  // (a snoozedUntil in the future hides it from active lists). Mirrors Linear's
  // "remind me later" — the card leaves the queue, so we keep the cursor on the
  // same slot to advance onto the next issue, and drop it from any selection.
  const snoozeIssue = (id: string, iso: string) => {
    store.setIssueSnooze(id, iso)
    setSelected((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  // Scroll the active card into view whenever the cursor moves.
  useEffect(() => {
    cardRefs.current[cursor]?.scrollIntoView({ block: 'nearest' })
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
    const cur = queue[Math.min(cursor, queue.length - 1)]
    const own = () => {
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    if (e.key === 'ArrowDown' || e.key === 'j') {
      own()
      setCursor((c) => Math.min(c + 1, queue.length - 1))
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'k') {
      own()
      setCursor((c) => Math.max(c - 1, 0))
      return
    }
    // Toggle the active row's selection (X), Linear's multi-select key.
    if (e.code === 'KeyX') {
      if (!cur) return
      own()
      toggleSelected(cur.id)
      return
    }
    // Clear the whole selection (Escape).
    if (e.key === 'Escape' && selected.size) {
      own()
      setSelected(new Set())
      return
    }
    // Open the active issue (Enter / O).
    if (e.key === 'Enter' || e.code === 'KeyO') {
      if (!cur) return
      own()
      store.setPeek(cur.id)
      return
    }
    // Accept — Linear binds this to `1`; `A` stays as the mnemonic this app
    // shipped with. Acts on the whole selection when one exists, otherwise on
    // the active card (which leaves the queue, so the cursor lands on the next).
    if (e.code === 'KeyA' || e.key === '1') {
      own()
      if (selected.size) acceptSelected()
      else if (cur) store.acceptTriage(cur.id)
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
      if (selected.size) declineSelected()
      else if (cur) store.declineTriage(cur.id)
      return
    }
    // Mark as duplicate (`3`) — opens the relation picker on the active card.
    // Bulk has no meaning here (a duplicate points at one issue), so this one
    // always acts on the cursor.
    if (e.key === '3') {
      if (!cur) return
      own()
      store.openRelationPicker(cur.id, 'duplicateOf')
      return
    }
    // Snooze (H) — push the issue out of triage focus until tomorrow (Linear's
    // default snooze). Acts on the whole selection when one exists, else the
    // active card, which leaves the queue so the cursor lands on the next one.
    if (e.code === 'KeyH') {
      own()
      // presets[1] is `Tomorrow` — Linear's default when H is pressed bare.
      const iso = snoozePresets()[1].at.toISOString()
      if (selected.size) {
        selectedIssues.forEach((i) => snoozeIssue(i.id, iso))
        setSelected(new Set())
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
      store.acceptTriage(focusIssue.id)
      return
    }
    if (e.code === 'KeyD' || e.code === 'KeyX') {
      own()
      store.declineTriage(focusIssue.id)
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

  // Label for the priority-filter trigger chip.
  const priorityFilterLabel =
    priorityFilter === 'all'
      ? 'All priorities'
      : PRIORITY_LABELS[Number(priorityFilter) as Priority]

  return (
    <div className="relative flex h-full flex-col">
      <ViewHeader title="Triage" teamName={team.name} teamIcon={team.icon}>
        {/* ViewHeader's slot is a plain block, so the count and the controls
            need their own row — otherwise the count wraps above them and the
            44px-tall header clips it. */}
        <div className="flex items-center gap-2">
        <span className="text-[12px] tabular-nums text-faint">
          {allQueue.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* Speedrun and the priority filter only mean something with a queue
              to work through. Display options stays — it holds `Show snoozed`,
              and hiding it when everything is snoozed would strand you. */}
          {queue.length > 0 && (
            <button
              onClick={enterSpeedrun}
              className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg"
            >
              <Zap size={13} className="shrink-0 text-faint" />
              Speedrun
            </button>
          )}
          {allQueue.length > 0 && (
            <SelectMenu
              width={200}
              align="end"
              options={priorityOptions}
              onSelect={setPriorityFilter}
              placeholder="Filter by priority…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <span className="max-w-[120px] truncate">{priorityFilterLabel}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
          )}
          {/* Display options — Linear's icon-only trigger, holding `Ordering`
              and the `Show snoozed` switch in that order. */}
          <Popover align="end" width={268} label="Display options"
            trigger={
              <span className="flex size-[26px] items-center justify-center rounded-md border border-border bg-bg-tertiary text-muted hover:text-fg">
                <SlidersHorizontal size={13} />
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
        </div>
      </ViewHeader>
      <div className="flex-1 overflow-y-auto p-4">
        {allQueue.length === 0 ? (
          <EmptyState
            illustration={<CheckIllustration />}
            title="Triage is clear"
            description="New issues that need triage will show up here. Nothing to review right now."
          />
        ) : queue.length === 0 ? (
          <EmptyState
            illustration={<CheckIllustration />}
            title="No matching issues"
            description="No issues in this triage queue match the selected priority."
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            {queue.map((issue, i) => {
              const state = store.states.find((s) => s.id === issue.stateId)!
              const assignee = store.users.find((u) => u.id === issue.assigneeId)
              const labels = issue.labelIds
                .map((id) => store.labels.find((l) => l.id === id))
                .filter(Boolean)
              const cycle = store.cycles.find((c) => c.id === issue.cycleId)
              const active = i === cursor
              const isSelected = selected.has(issue.id)
              return (
                <div
                  key={issue.id}
                  ref={(el) => {
                    cardRefs.current[i] = el
                  }}
                  onMouseDown={() => setCursor(i)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setCursor(i)
                    setMenu({
                      id: issue.id,
                      x: e.clientX,
                      y: e.clientY,
                      nowMs: Date.now(),
                    })
                  }}
                  className={`group rounded-xl border bg-bg-secondary p-4 transition-colors ${
                    isSelected
                      ? 'border-accent ring-1 ring-accent bg-accent/5'
                      : active
                        ? 'border-accent ring-1 ring-accent'
                        : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Selection checkbox — appears on hover, or whenever this
                        card (or any card) is selected, mirroring Linear. */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelected(issue.id)
                      }}
                      aria-label={isSelected ? 'Deselect issue' : 'Select issue'}
                      className={`mt-0.5 flex size-[16px] shrink-0 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent text-white'
                          : 'border-border text-transparent hover:border-faint group-hover:opacity-100 ' +
                            (selected.size ? 'opacity-100' : 'opacity-0')
                      }`}
                    >
                      <Check size={11} strokeWidth={3} />
                    </button>
                    <button
                      onClick={() => store.setPeek(issue.id)}
                      className="flex-1 text-left"
                    >
                      {/* `shrink-0` on everything but the title: without it the
                          identifier and the snooze badge get squeezed and break
                          mid-word, while the title is the one thing that should
                          wrap. */}
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-faint">
                          {issue.identifier}
                        </span>
                        <span className="text-[14px] font-medium text-fg">{issue.title}</span>
                        {/* Only reachable with `Show snoozed` on, and then it's
                            the one thing that tells these rows apart. */}
                        {snoozedIds.has(issue.id) && (
                          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-border px-1.5 py-px text-[11px] text-faint">
                            <Clock size={11} />
                            {formatDate(issue.snoozedUntil!)}
                          </span>
                        )}
                      </div>
                      {issue.description && (
                        <p className="mt-1 line-clamp-2 text-[12px] text-muted">
                          {issue.description}
                        </p>
                      )}
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => store.acceptTriage(issue.id)}
                        className="flex items-center gap-1 rounded-md bg-[var(--status-review)] px-2.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
                      >
                        <Check size={13} /> Accept
                      </button>
                      <button
                        onClick={() => store.declineTriage(issue.id)}
                        className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
                      >
                        <X size={13} /> Decline
                      </button>
                      {/* Overflow "…" — the same menu a right-click opens, so
                          the two can't drift apart. Anchored under the button
                          rather than at the pointer. */}
                      <button
                        aria-label="More triage actions"
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect()
                          setMenu({
                            id: issue.id,
                            x: r.left,
                            y: r.bottom + 4,
                            nowMs: Date.now(),
                          })
                        }}
                        className="flex size-[28px] items-center justify-center rounded-md border border-border text-muted hover:bg-bg-hover hover:text-fg"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <StatusPicker
                      stateId={issue.stateId}
                      onChange={(id) => store.setIssueStatus(issue.id, id)}
                      trigger={
                        <span className={chip}>
                          <StatusIcon type={state.type} color={state.color} />
                          {state.name}
                        </span>
                      }
                    />
                    <PriorityPicker
                      priority={issue.priority}
                      onChange={(p) => store.setIssuePriority(issue.id, p)}
                      trigger={
                        <span className={chip}>
                          <PriorityIcon priority={issue.priority} />
                          {PRIORITY_LABELS[issue.priority]}
                        </span>
                      }
                    />
                    <AssigneePicker
                      assigneeId={issue.assigneeId}
                      onChange={(id) => store.setIssueAssignee(issue.id, id)}
                      trigger={
                        <span className={chip}>
                          <Avatar user={assignee} size={16} />
                          {assignee ? fmt(assignee.name) : 'Assignee'}
                        </span>
                      }
                    />
                    <LabelPicker
                      labelIds={issue.labelIds}
                      onToggle={(id) => store.toggleIssueLabel(issue.id, id)}
                      trigger={
                        <span className={chip}>
                          {labels.length ? (
                            <>
                              {labels.slice(0, 3).map((l) => (
                                <LabelDot key={l!.id} color={l!.color} />
                              ))}
                              {labels.length} label{labels.length > 1 ? 's' : ''}
                            </>
                          ) : (
                            'Label'
                          )}
                        </span>
                      }
                    />
                    {/* Cycle — only offered when the team runs cycles. Lists the
                        team's current + upcoming cycles plus "No cycle". */}
                    {teamCycles.length > 0 && (
                      <SelectMenu
                        width={220}
                        options={[
                          { id: '__none', label: 'No cycle', selected: !issue.cycleId },
                          ...teamCycles.map((c) => {
                            const cs = cycleState(c.startsAt, c.endsAt, Date.now())
                            return {
                              id: c.id,
                              label: c.name ?? `Cycle ${c.number}`,
                              keywords: String(c.number),
                              hint: cs.status === 'active' ? 'Active' : 'Upcoming',
                              selected: issue.cycleId === c.id,
                            }
                          }),
                        ]}
                        onSelect={(id) =>
                          store.setIssueCycle(
                            issue.id,
                            id === '__none' ? undefined : id,
                          )
                        }
                        trigger={
                          <span className={chip}>
                            <IterationCw size={13} className="text-faint" />
                            {cycle ? (cycle.name ?? `Cycle ${cycle.number}`) : 'No cycle'}
                          </span>
                        }
                      />
                    )}
                  </div>
                </div>
              )
            })}
            {/* Keyboard hints — the active card responds to these. */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1 text-[11px] text-faint">
              <span>
                <Kbd>J</Kbd> <Kbd>K</Kbd> navigate
              </span>
              <span>
                <Kbd>1</Kbd> accept
              </span>
              <span>
                <Kbd>2</Kbd> decline
              </span>
              <span>
                <Kbd>3</Kbd> duplicate
              </span>
              <span>
                <Kbd>X</Kbd> select
              </span>
              <span>
                <Kbd>H</Kbd> snooze
              </span>
              <span>
                <Kbd>↵</Kbd> open
              </span>
            </div>
          </div>
        )}

        {/* Recently-accepted archive — a collapsible reference list of issues
            that recently left triage by being accepted into the workflow.
            Newest first, capped; reuses StatusIcon / Avatar / timeAgo. */}
        {recentlyAccepted.length > 0 && (
          <div className="mx-auto mt-8 max-w-3xl">
            <button
              onClick={() => setArchiveOpen((o) => !o)}
              className="flex w-full items-center gap-1.5 text-[12px] font-medium text-muted hover:text-fg"
            >
              <ChevronRight
                size={14}
                className={`shrink-0 text-faint transition-transform ${
                  archiveOpen ? 'rotate-90' : ''
                }`}
              />
              <Inbox size={13} className="shrink-0 text-faint" />
              Recently accepted
              <span className="tabular-nums text-faint">
                {recentlyAccepted.length}
              </span>
            </button>
            {archiveOpen && (
              <div className="mt-2 overflow-hidden rounded-lg border border-border bg-bg-secondary">
                {recentlyAccepted.map((issue) => {
                  const state = store.states.find((s) => s.id === issue.stateId)
                  const assignee = store.users.find(
                    (u) => u.id === issue.assigneeId,
                  )
                  return (
                    <button
                      key={issue.id}
                      onClick={() => store.setPeek(issue.id)}
                      className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-bg-hover"
                    >
                      {state && (
                        <StatusIcon type={state.type} color={state.color} />
                      )}
                      <span className="font-mono text-[11px] text-faint">
                        {issue.identifier}
                      </span>
                      <span className="flex-1 truncate text-[13px] text-fg">
                        {issue.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-faint">
                        accepted {timeAgo(issue.triageAcceptedAt!)}
                      </span>
                      <Avatar user={assignee} size={16} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
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

      {/* Floating bulk-action bar — shown only while a selection is active.
          Accept / Decline apply to the whole batch; the count mirrors Linear. */}
      {selectedIssues.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-2 py-1.5 shadow-lg">
            <span className="px-1.5 text-[12px] tabular-nums text-muted">
              {selectedIssues.length} selected
            </span>
            <span className="h-4 w-px bg-border" />
            <button
              onClick={acceptSelected}
              className="flex items-center gap-1 rounded-md bg-[var(--status-review)] px-2.5 py-1 text-[12px] font-medium text-white hover:opacity-90"
            >
              <Check size={13} /> Accept
            </button>
            <button
              onClick={declineSelected}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-[var(--priority-urgent)]"
            >
              <X size={13} /> Decline
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-md px-2 py-1 text-[12px] text-faint hover:bg-bg-hover hover:text-fg"
            >
              Clear
            </button>
          </div>
        </div>
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
              onClick={() => store.acceptTriage(focusIssue.id)}
              className="flex items-center gap-2 rounded-lg bg-[var(--status-review)] px-4 py-2.5 text-[14px] font-medium text-white hover:opacity-90"
            >
              <Check size={16} /> Accept <Kbd>A</Kbd>
            </button>
            <button
              onClick={() => store.declineTriage(focusIssue.id)}
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

/** Small inline keycap used by the Triage keyboard-hint footer. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-bg-tertiary px-1 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  )
}
