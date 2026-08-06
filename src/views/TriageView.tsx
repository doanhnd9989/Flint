import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Inbox,
  IterationCw,
  MoreHorizontal,
  MoveRight,
  X,
  Zap,
} from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import { cycleState } from '@/lib/selectors'
import { timeAgo } from '@/lib/utils'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, CheckIllustration } from '@/components/EmptyState'
import { StatusIcon } from '@/components/StatusIcon'
import { PriorityIcon } from '@/components/PriorityIcon'
import { Avatar } from '@/components/Avatar'
import { LabelDot } from '@/components/LabelChip'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { SelectOption } from '@/components/ui/SelectMenu'
import { Popover } from '@/components/ui/Popover'
import {
  StatusPicker,
  PriorityPicker,
  AssigneePicker,
  LabelPicker,
} from '@/components/pickers'
import { PRIORITY_LABELS, PRIORITY_ORDER, PRIORITY_SORT } from '@/lib/constants'
import type { Priority } from '@/lib/types'

const chip =
  'flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover'

/** Ordering options for the Triage queue (local-only). */
type SortKey = 'newest' | 'oldest' | 'priority'
const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  priority: 'Priority high→low',
}

/** Snooze presets — each resolves to an ISO timestamp relative to now. Snoozing
 * sets issue.snoozedUntil, which hides the card from active lists and pulls it
 * out of the immediate triage focus until the chosen moment. */
const SNOOZE_PRESETS: { id: string; label: string; resolve: () => string }[] = [
  {
    id: 'later',
    label: 'Later today',
    resolve: () => {
      const d = new Date()
      d.setHours(d.getHours() + 4, 0, 0, 0)
      return d.toISOString()
    },
  },
  {
    id: 'tomorrow',
    label: 'Tomorrow',
    resolve: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0, 0)
      return d.toISOString()
    },
  },
  {
    id: 'next-week',
    label: 'Next week',
    resolve: () => {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      d.setHours(9, 0, 0, 0)
      return d.toISOString()
    },
  },
]

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

  // Local-only header controls: a priority filter ('all' or a Priority value)
  // and a sort order. They compose — filter narrows, then sort orders.
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('newest')

  // The full triage queue for this team (also the count shown in the header).
  const allQueue = useMemo(
    () =>
      store.issues.filter(
        (i) =>
          i.teamId === team.id &&
          i.triage &&
          !i.archivedAt &&
          // Snoozed issues (snoozedUntil still in the future) drop out of the
          // immediate triage focus until the snooze elapses — like active lists.
          !(i.snoozedUntil && new Date(i.snoozedUntil).getTime() > Date.now()),
      ),
    [store.issues, team.id],
  )

  // Apply the priority filter, then the chosen sort order.
  const queue = useMemo(() => {
    const filtered =
      priorityFilter === 'all'
        ? allQueue
        : allQueue.filter((i) => i.priority === Number(priorityFilter))
    const sorted = [...filtered]
    if (sort === 'priority') {
      sorted.sort((a, b) => PRIORITY_SORT[a.priority] - PRIORITY_SORT[b.priority])
    } else if (sort === 'oldest') {
      sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
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
    // Accept — A acts on the whole selection when one exists, otherwise on the
    // active card (which leaves the queue, so the cursor lands on the next one).
    if (e.code === 'KeyA') {
      own()
      if (selected.size) acceptSelected()
      else if (cur) store.acceptTriage(cur.id)
      return
    }
    // Decline (D / ⌫) — same selection-aware behaviour as Accept.
    if (e.code === 'KeyD' || e.key === 'Backspace' || e.key === 'Delete') {
      own()
      if (selected.size) declineSelected()
      else if (cur) store.declineTriage(cur.id)
      return
    }
    // Snooze (H) — push the issue out of triage focus until tomorrow (Linear's
    // default snooze). Acts on the whole selection when one exists, else the
    // active card, which leaves the queue so the cursor lands on the next one.
    if (e.code === 'KeyH') {
      own()
      const iso = SNOOZE_PRESETS[1].resolve()
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

  // Sort options, in menu order.
  const sortOptions = useMemo<SelectOption[]>(
    () =>
      (['newest', 'oldest', 'priority'] as SortKey[]).map((k) => ({
        id: k,
        label: SORT_LABELS[k],
        selected: sort === k,
      })),
    [sort],
  )

  // "Move to team" targets — every other team, in name order. Picking one calls
  // the store's moveIssueToTeam (which re-keys the identifier) and re-homes the
  // issue out of this team's triage queue, mirroring Linear's row action.
  const moveTeamOptions = useMemo<SelectOption[]>(
    () =>
      store.teams
        .filter((t) => t.id !== team.id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((t) => ({
          id: t.id,
          label: t.name,
          icon: <span className="text-[13px] leading-none">{t.icon}</span>,
          keywords: t.key,
        })),
    [store.teams, team.id],
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
        {/* Header controls — priority filter + sort, both local-only. Hidden
            when there's nothing in the queue at all. */}
        {allQueue.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            {/* Speedrun — enter a focused, one-card-at-a-time triage mode driven
                entirely by the keyboard (A accept / D decline). */}
            {queue.length > 0 && (
              <button
                onClick={enterSpeedrun}
                className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg"
              >
                <Zap size={13} className="shrink-0 text-faint" />
                Speedrun
              </button>
            )}
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
            <SelectMenu
              width={200}
              align="end"
              options={sortOptions}
              onSelect={(id) => setSort(id as SortKey)}
              placeholder="Sort by…"
              trigger={
                <span className="flex items-center gap-1 rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[12px] text-muted hover:text-fg">
                  <ArrowDownUp size={13} className="shrink-0 text-faint" />
                  <span className="max-w-[120px] truncate">{SORT_LABELS[sort]}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" />
                </span>
              }
            />
          </div>
        )}
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
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-faint">{issue.identifier}</span>
                        <span className="text-[14px] font-medium text-fg">{issue.title}</span>
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
                      {/* Overflow "…" — extra Linear triage actions that don't
                          warrant their own button: move the issue to another
                          team, or mark it as a duplicate of an existing one. */}
                      <Popover
                        align="end"
                        width={180}
                        trigger={
                          <span
                            className="flex size-[28px] items-center justify-center rounded-md border border-border text-muted hover:bg-bg-hover hover:text-fg"
                            aria-label="More triage actions"
                          >
                            <MoreHorizontal size={14} />
                          </span>
                        }
                      >
                        {(close) => (
                          <div className="text-[13px] text-fg">
                            {/* Move to team — only when there's another team to
                                move into; declining is implicit (the issue
                                leaves this team's triage queue). */}
                            {moveTeamOptions.length > 0 && (
                              <SelectMenu
                                width={200}
                                options={moveTeamOptions}
                                placeholder="Move to team…"
                                onSelect={(teamId) => {
                                  store.moveIssueToTeam(issue.id, teamId)
                                  close()
                                }}
                                trigger={
                                  <span className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-hover">
                                    <MoveRight size={14} className="text-faint" />
                                    Move to team…
                                  </span>
                                }
                              />
                            )}
                            {/* Snooze — pick a preset to push this issue out of
                                the immediate triage focus until later. */}
                            <SelectMenu
                              width={200}
                              options={SNOOZE_PRESETS.map((p) => ({
                                id: p.id,
                                label: p.label,
                              }))}
                              placeholder="Snooze until…"
                              onSelect={(id) => {
                                const preset = SNOOZE_PRESETS.find(
                                  (p) => p.id === id,
                                )
                                if (preset) snoozeIssue(issue.id, preset.resolve())
                                close()
                              }}
                              trigger={
                                <span className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-hover">
                                  <Clock size={14} className="text-faint" />
                                  Snooze…
                                </span>
                              }
                            />
                            <button
                              onClick={() => {
                                store.openRelationPicker(issue.id, 'duplicateOf')
                                close()
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-bg-hover"
                            >
                              <Copy size={14} className="text-faint" />
                              Mark as duplicate…
                            </button>
                          </div>
                        )}
                      </Popover>
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
                <Kbd>A</Kbd> accept
              </span>
              <span>
                <Kbd>D</Kbd> decline
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
