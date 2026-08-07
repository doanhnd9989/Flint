import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Issue, RelationPickerKind, RelationType } from '@/lib/types'
import { branchName, formatDate, issueUrl } from '@/lib/utils'
import { atTime, endOfThisWeek, inHours, nextMonday } from '@/lib/dateOptions'
import { copyToClipboard, copyToast } from '@/lib/toast'
import { useFontScale } from '@/lib/useTheme'
import {
  MoreHorizontal,
  Link2,
  ChevronRight,
  GitBranchPlus,
  CopyPlus,
  CornerLeftUp,
  CircleSlash,
  Ban,
  GitBranch,
  Spline,
  Copy,
  Star,
  Bell,
  BellOff,
  Trash2,
  ArrowRightLeft,
  Share2,
  GitFork,
  Archive,
  ArchiveRestore,
  FolderPlus,
  VolumeX,
  LayoutTemplate,
  Calendar,
  Check,
  Clock,
  History,
  Users,
  X,
} from 'lucide-react'
import { ApplyTemplateMenu } from './ApplyTemplateMenu'
import { Calendar as CalendarGrid } from './DatePicker'
import { DescriptionHistoryList } from './IssueDescriptionHistory'

// Base widths at font-scale 1. Both go through `useFontScale()` below: these
// are JS pixels, so CSS's `--font-scale` never reaches them and the labels
// ("Copy description as Markdown") would ellipsise at the larger steps.
const BASE_MENU_W = 232
// Wider than the parent: the Copy leaves ("Copy description as Markdown", plus
// a ⌘⌥C hint column) ellipsise at 232, and Linear's own flyout is wider too.
const BASE_SUB_W = 268

const rowCls =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

function Hint({ children }: { children: ReactNode }) {
  return <span className="ml-auto pl-3 text-[12px] tracking-wide text-faint">{children}</span>
}

function Row({
  icon,
  label,
  hint,
  danger,
  onClick,
}: {
  icon: ReactNode
  label: string
  hint?: ReactNode
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${rowCls} ${danger ? 'hover:text-[var(--priority-urgent)]' : ''}`}
    >
      <span className="flex h-4 w-4 items-center justify-center text-faint">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {hint && <Hint>{hint}</Hint>}
    </button>
  )
}

const Divider = () => <div className="my-1 h-px bg-border" />

/**
 * The open flyout chain, shared with every {@link SubRow} on the menu. A
 * context rather than props because the rows sit at two nesting depths and
 * threading `path`/`open` through each call site buys nothing.
 */
const SubmenuCtx = createContext<{
  path: string[]
  open: (depth: number, id: string) => void
  width: number
}>({ path: [], open: () => {}, width: BASE_SUB_W })

/**
 * A row that expands a flyout to the right on hover. `depth` is its position in
 * the open chain: hovering truncates the path to that depth and opens this one,
 * so siblings close while ancestors stay put — which is what lets
 * `Due date ▸ Custom…` keep its parent open.
 */
function SubRow({
  id,
  icon,
  label,
  hint,
  depth = 0,
  children,
}: {
  id: string
  icon: ReactNode
  label: string
  hint?: ReactNode
  depth?: number
  children: ReactNode
}) {
  const { path, open, width } = useContext(SubmenuCtx)
  const active = path[depth] === id
  return (
    <div className="relative" onMouseEnter={() => open(depth, id)}>
      <div className={`${rowCls} ${active ? 'bg-bg-hover' : ''}`}>
        <span className="flex h-4 w-4 items-center justify-center text-faint">{icon}</span>
        <span className="flex-1">{label}</span>
        {hint && <span className="pl-3 text-[12px] tracking-wide text-faint">{hint}</span>}
        <ChevronRight size={14} className="ml-1 text-faint" />
      </div>
      {active && (
        <div
          className="absolute left-full top-[-5px] z-50 ml-1 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-bg-elevated p-1 shadow-lg animate-pop"
          style={{ width }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** A submenu row with its resolved date right-aligned, as Linear shows. */
function DateRow({ label, at, onClick }: { label: string; at: Date; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={rowCls}>
      <span className="flex-1 truncate">{label}</span>
      <span className="pl-3 text-[12px] text-faint">{formatDate(at.toISOString())}</span>
    </button>
  )
}

/**
 * Linear's issue ⋯ ("Issue options") header menu, in Linear's own grouping and
 * order: Team / Due date / Add link, then the relation trio (Create related,
 * Mark as, Remove), then Copy / Convert to / Apply template, then Favorite /
 * Remind me / Subscribe, then Show description history, then Delete.
 *
 * Depth is the point — every ▸ row opens the full leaf list Linear shows, not
 * a stub. Shared by the full-page detail and the peek panel.
 */
export function IssueOptionsMenu({
  issue,
  onOpenIssue,
  onDeleted,
}: {
  issue: Issue
  /** Open another issue (navigate on detail, re-peek in the panel). */
  onOpenIssue: (identifier: string) => void
  /** Called after the issue is deleted (navigate back / close peek). */
  onDeleted: () => void
}) {
  const store = useStore()
  const navigate = useNavigate()
  const fs = useFontScale()
  const MENU_W = Math.round(BASE_MENU_W * fs)
  const SUB_W = Math.round(BASE_SUB_W * fs)
  const [open, setOpen] = useState(false)
  // Stamped when the menu opens: "which cycle is current" is read during render,
  // and reading the clock there would make the result drift between renders.
  const [nowMs, setNowMs] = useState(0)
  // The chain of open flyouts, outermost first. A single id would be enough for
  // one level, but `Due date ▸ Custom…` nests — with one id, opening the child
  // closes the parent it lives inside.
  const [path, setPath] = useState<string[]>([])
  const anchorRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  // Deleting an issue takes its comments and relations with it, so it always
  // goes through a confirmation — Linear does the same.
  const [confirmDelete, setConfirmDelete] = useState(false)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    setPos({
      top: Math.min(r.bottom + 4, window.innerHeight - 8),
      left: Math.min(r.left, window.innerWidth - MENU_W - SUB_W - 16),
    })
  }, [open, MENU_W, SUB_W])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Consume Escape so an enclosing peek panel doesn't also close.
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  const close = () => {
    setOpen(false)
    setPath([])
  }

  const me = store.users.find((u) => u.isMe)
  const starred = store.favorites.some((f) => f.type === 'issue' && f.id === issue.id)
  const subscribed = issue.subscriberIds.includes(store.currentUserId)
  const parent = issue.parentId
    ? store.issues.find((i) => i.id === issue.parentId)
    : undefined

  // Relations pointing either way, for the `Remove` submenu.
  const relations = store.relations.filter(
    (r) => r.fromIssueId === issue.id || r.toIssueId === issue.id,
  )

  // Cycles for this team, chronological — backs "End of next cycle" and the
  // "Next cycle" reminder.
  const teamCycles = store.cycles
    .filter((c) => c.teamId === issue.teamId && !c.pausedAt)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const activeIdx = teamCycles.findIndex(
    (c) => nowMs >= new Date(c.startsAt).getTime() && nowMs <= new Date(c.endsAt).getTime(),
  )
  const upcoming = teamCycles.filter((c) => new Date(c.startsAt).getTime() > nowMs)
  const nextCycle = activeIdx >= 0 ? teamCycles[activeIdx + 1] : upcoming[0]

  // Create a fresh issue (same team/project) and run a linker against it.
  const createRelated = (title: string, link: (newId: string) => void) => {
    const created = store.createIssue({
      title,
      teamId: issue.teamId,
      projectId: issue.projectId,
    })
    link(created.id)
    close()
    onOpenIssue(created.identifier)
  }

  // "Mark as" opens the shared centered relation picker (Linear's behavior),
  // so the ⋯ menu and the M-chord / ⌘⇧P shortcuts share one surface.
  const markAs = (label: string, kind: RelationPickerKind) => (
    <Row
      key={kind}
      icon={MARK_ICONS[label]}
      label={`${label}…`}
      hint={MARK_HINTS[label]}
      onClick={() => {
        close()
        store.openRelationPicker(issue.id, kind)
      }}
    />
  )

  const copy = (text: string, message: string) => {
    copyToClipboard(text, message)
    close()
  }

  const setDue = (d?: Date) => {
    store.setIssueDueDate(issue.id, d ? d.toISOString() : undefined)
    close()
  }

  const remind = (d: Date) => {
    store.setIssueReminder(issue.id, d.toISOString())
    close()
  }

  const submenu = useMemo(
    () => ({
      path,
      open: (depth: number, id: string) => setPath((p) => [...p.slice(0, depth), id]),
      width: SUB_W,
    }),
    [path, SUB_W],
  )

  return (
    <SubmenuCtx.Provider value={submenu}>
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${issue.identifier}?`}
        description="This deletes the issue along with its comments and relations. It can't be undone."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          store.deleteIssue(issue.id)
          onDeleted()
        }}
      />
      <button
        ref={anchorRef}
        type="button"
        title="Issue options"
        onClick={() => {
          setNowMs(Date.now())
          setOpen((o) => !o)
        }}
        className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover hover:text-fg"
      >
        <MoreHorizontal size={15} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            data-overlay
            className="fixed inset-0 z-50"
            onMouseDown={close}
            onContextMenu={(e) => {
              e.preventDefault()
              close()
            }}
          >
            <div
              ref={menuRef}
              className="absolute rounded-lg border border-border bg-bg-elevated p-1 shadow-lg animate-pop"
              style={{ top: pos.top, left: pos.left, width: MENU_W }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* — Team / Due date / Add link — */}
              <SubRow id="team" icon={<Users size={14} />} label="Team" hint="⌘⇧M">
                {store.teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={rowCls}
                    onClick={() => {
                      if (t.id === issue.teamId) return close()
                      const moved = store.moveIssueToTeam(issue.id, t.id)
                      close()
                      if (moved) onOpenIssue(moved)
                    }}
                  >
                    <span className="flex h-4 w-4 items-center justify-center">{t.icon}</span>
                    <span className="flex-1 truncate">{t.name}</span>
                    {t.id === issue.teamId && <Check size={14} className="text-accent" />}
                  </button>
                ))}
              </SubRow>

              <SubRow id="due" icon={<Calendar size={14} />} label="Due date" hint="⇧D">
                <SubRow id="due-custom" depth={1} icon={<Calendar size={14} />} label="Custom…">
                  <CalendarGrid
                    value={issue.dueDate}
                    onChange={(iso) => {
                      store.setIssueDueDate(issue.id, iso)
                      close()
                    }}
                    close={close}
                  />
                </SubRow>
                <DateRow label="Tomorrow" at={atTime(1, 9)} onClick={() => setDue(atTime(1, 9))} />
                <DateRow
                  label="End of this week"
                  at={endOfThisWeek()}
                  onClick={() => setDue(endOfThisWeek())}
                />
                <DateRow label="In one week" at={atTime(7, 9)} onClick={() => setDue(atTime(7, 9))} />
                {nextCycle && (
                  <DateRow
                    label="End of next cycle"
                    at={new Date(nextCycle.endsAt)}
                    onClick={() => setDue(new Date(nextCycle.endsAt))}
                  />
                )}
                {issue.dueDate && (
                  <>
                    <Divider />
                    <Row icon={<X size={14} />} label="Remove due date" onClick={() => setDue(undefined)} />
                  </>
                )}
              </SubRow>

              <Row
                icon={<Link2 size={14} />}
                label="Add link…"
                hint="Ctrl L"
                onClick={() => {
                  close()
                  store.openLinkModal(issue.id)
                }}
              />
              <Row
                icon={<Share2 size={14} />}
                label="Share…"
                onClick={() => {
                  close()
                  store.openShareIssue(issue.id)
                }}
              />

              <Divider />

              {/* — the relation trio — */}
              <SubRow id="create" icon={<GitFork size={14} />} label="Create related">
                <Row
                  icon={<CopyPlus size={14} />}
                  label="Issue…"
                  onClick={() => createRelated('New issue', (id) => store.addRelation(issue.id, id, 'related'))}
                />
                <Row
                  icon={<GitBranchPlus size={14} />}
                  label="Sub-issue…"
                  hint="⌘⇧O"
                  onClick={() => createRelated('New sub-issue', (id) => store.setIssueParent(id, issue.id))}
                />
                <Row
                  icon={<CornerLeftUp size={14} />}
                  label="Parent issue…"
                  onClick={() => createRelated('New issue', (id) => store.setIssueParent(issue.id, id))}
                />
                <Row
                  icon={<CircleSlash size={14} />}
                  label="Blocked issue…"
                  onClick={() => createRelated('New issue', (id) => store.addRelation(issue.id, id, 'blocks'))}
                />
                <Row
                  icon={<Ban size={14} />}
                  label="Blocking issue…"
                  onClick={() => createRelated('New issue', (id) => store.addRelation(id, issue.id, 'blocks'))}
                />
              </SubRow>

              <SubRow id="mark" icon={<ArrowRightLeft size={14} />} label="Mark as">
                {markAs('Parent of', 'parentOf')}
                {markAs('Sub-issue of', 'subIssueOf')}
                {markAs('Related to', 'related')}
                {markAs('Blocked by', 'blockedBy')}
                {markAs('Blocking', 'blocking')}
                {markAs('Duplicate of', 'duplicateOf')}
              </SubRow>

              {/* Linear's `Remove` lists the links this issue actually has — an
                  empty state here means there is genuinely nothing to unlink. */}
              <SubRow id="remove" icon={<X size={14} />} label="Remove">
                {parent && (
                  <Row
                    icon={<CornerLeftUp size={14} />}
                    label={`Parent issue ${parent.identifier}`}
                    onClick={() => {
                      store.setIssueParent(issue.id, undefined)
                      close()
                    }}
                  />
                )}
                {relations.map((r) => {
                  const outgoing = r.fromIssueId === issue.id
                  const otherId = outgoing ? r.toIssueId : r.fromIssueId
                  const other = store.issues.find((i) => i.id === otherId)
                  return (
                    <Row
                      key={r.id}
                      icon={<Spline size={14} />}
                      label={`${relationLabel(r.type, outgoing)} ${other?.identifier ?? ''}`}
                      onClick={() => {
                        store.removeRelation(r.id)
                        close()
                      }}
                    />
                  )
                })}
                {!parent && relations.length === 0 && (
                  <div className="px-2 py-1.5 text-[13px] text-faint">Nothing to remove</div>
                )}
              </SubRow>

              <Divider />

              {/* — Copy / Convert to / Apply template — */}
              <SubRow id="copy" icon={<Copy size={14} />} label="Copy">
                <Row
                  icon={<Copy size={14} />}
                  label="Copy ID"
                  hint="⌘."
                  onClick={() => copy(issue.identifier, copyToast.id(issue.identifier))}
                />
                <Row
                  icon={<Link2 size={14} />}
                  label="Copy URL"
                  hint="⌘⇧,"
                  onClick={() => copy(issueUrl(issue.identifier), copyToast.url())}
                />
                <Row
                  icon={<Copy size={14} />}
                  label="Copy title"
                  hint="⌘⇧'"
                  onClick={() => copy(issue.title, 'Title copied')}
                />
                <Row
                  icon={<Link2 size={14} />}
                  label="Copy title as link"
                  hint="⌘C"
                  onClick={() =>
                    copy(
                      `[${issue.identifier} ${issue.title}](${issueUrl(issue.identifier)})`,
                      'Title copied as link',
                    )
                  }
                />
                <Row
                  icon={<Copy size={14} />}
                  label="Copy description as Markdown"
                  onClick={() => copy(issue.description ?? '', 'Description copied as Markdown')}
                />
                <Row
                  icon={<Copy size={14} />}
                  label="Copy content as Markdown"
                  hint="⌘⌥C"
                  onClick={() =>
                    copy(
                      `# ${issue.identifier} ${issue.title}\n\n${issue.description ?? ''}`.trim(),
                      'Issue copied as Markdown',
                    )
                  }
                />
                <Row
                  icon={<GitBranch size={14} />}
                  label="Copy git branch name"
                  hint="⌘⇧."
                  onClick={() => copy(branchName(issue.identifier, issue.title, me), copyToast.branch())}
                />
                <Row
                  icon={<Copy size={14} />}
                  label="Copy as prompt"
                  hint="⌘⌥P"
                  onClick={() =>
                    copy(
                      [
                        `Work on ${issue.identifier}: ${issue.title}`,
                        '',
                        issue.description ?? '',
                        '',
                        `Link: ${issueUrl(issue.identifier)}`,
                      ]
                        .join('\n')
                        .trim(),
                      'Issue copied as prompt',
                    )
                  }
                />
                <Row
                  icon={<CopyPlus size={14} />}
                  label="Make a copy…"
                  onClick={() => {
                    const dupe = store.duplicateIssue(issue.id)
                    close()
                    if (dupe) onOpenIssue(dupe.identifier)
                  }}
                />
              </SubRow>

              <SubRow id="convert" icon={<FolderPlus size={14} />} label="Convert to">
                <Row
                  icon={<FolderPlus size={14} />}
                  label="Project…"
                  onClick={() => {
                    const project = store.convertIssueToProject(issue.id)
                    close()
                    navigate(`/project/${project.id}`)
                  }}
                />
                <Row
                  icon={<LayoutTemplate size={14} />}
                  label="Template…"
                  onClick={() => {
                    store.createTemplate({
                      name: issue.title,
                      teamId: issue.teamId,
                      title: issue.title,
                      description: issue.description ?? '',
                      priority: issue.priority,
                      labelIds: issue.labelIds,
                    })
                    close()
                    navigate('/settings?page=issue-templates')
                  }}
                />
              </SubRow>

              <SubRow id="template" icon={<LayoutTemplate size={14} />} label="Apply template" hint="⌘⌥T">
                <ApplyTemplateMenu issueId={issue.id} onClose={close} />
              </SubRow>

              <Divider />

              {/* — Favorite / Remind me / Subscribe — */}
              <Row
                icon={<Star size={14} fill={starred ? 'currentColor' : 'none'} className={starred ? 'text-[var(--status-started)]' : ''} />}
                label={starred ? 'Unfavorite' : 'Favorite'}
                hint="⌥F"
                onClick={() => {
                  store.toggleFavorite('issue', issue.id)
                  close()
                }}
              />
              <SubRow id="remind" icon={<Clock size={14} />} label="Remind me" hint="⇧H">
                <DateRow
                  label="An hour from now"
                  at={inHours(1)}
                  onClick={() => remind(inHours(1))}
                />
                <DateRow label="Tomorrow" at={atTime(1, 9)} onClick={() => remind(atTime(1, 9))} />
                <DateRow label="Next week" at={nextMonday()} onClick={() => remind(nextMonday())} />
                <DateRow
                  label="A month from now"
                  at={atTime(30, 9)}
                  onClick={() => remind(atTime(30, 9))}
                />
                {nextCycle && (
                  <DateRow
                    label="Next cycle"
                    at={new Date(nextCycle.startsAt)}
                    onClick={() => remind(new Date(nextCycle.startsAt))}
                  />
                )}
                <SubRow id="remind-custom" depth={1} icon={<Calendar size={14} />} label="Custom…">
                  <CalendarGrid
                    value={issue.remindAt}
                    onChange={(iso) => {
                      store.setIssueReminder(issue.id, iso)
                      close()
                    }}
                    close={close}
                  />
                </SubRow>
                {issue.remindAt && (
                  <>
                    <Divider />
                    <Row
                      icon={<X size={14} />}
                      label="Remove reminder"
                      onClick={() => {
                        store.setIssueReminder(issue.id, undefined)
                        close()
                      }}
                    />
                  </>
                )}
              </SubRow>
              <Row
                icon={subscribed ? <BellOff size={14} /> : <Bell size={14} />}
                label={subscribed ? 'Unsubscribe' : 'Subscribe'}
                hint="⇧S"
                onClick={() => {
                  store.toggleIssueSubscriber(issue.id, store.currentUserId)
                  close()
                }}
              />
              <Row
                icon={<VolumeX size={14} />}
                label={
                  store.mutedIssueIds.includes(issue.id)
                    ? 'Unmute notifications'
                    : 'Mute notifications'
                }
                onClick={() => {
                  store.toggleMuteIssue(issue.id)
                  close()
                }}
              />

              <Divider />

              <SubRow id="history" icon={<History size={14} />} label="Show description history">
                <DescriptionHistoryList issue={issue} onRestore={close} />
              </SubRow>

              <Divider />

              {issue.archivedAt ? (
                <Row
                  icon={<ArchiveRestore size={14} />}
                  label="Restore from archive"
                  onClick={() => {
                    store.unarchiveIssue(issue.id)
                    close()
                  }}
                />
              ) : (
                <Row
                  icon={<Archive size={14} />}
                  label="Archive"
                  hint="⌘⇧⌫"
                  onClick={() => {
                    close()
                    store.archiveIssue(issue.id)
                    onDeleted()
                  }}
                />
              )}
              <Row
                icon={<Trash2 size={14} />}
                label="Delete"
                hint="⌘⌫"
                danger
                onClick={() => {
                  close()
                  setConfirmDelete(true)
                }}
              />
            </div>
          </div>,
          document.body,
        )}
    </SubmenuCtx.Provider>
  )
}

const MARK_ICONS: Record<string, ReactNode> = {
  'Parent of': <CornerLeftUp size={14} />,
  'Sub-issue of': <GitBranch size={14} />,
  'Related to': <Spline size={14} />,
  'Blocked by': <CircleSlash size={14} />,
  Blocking: <Ban size={14} />,
  'Duplicate of': <Copy size={14} />,
}

const MARK_HINTS: Record<string, string> = {
  'Sub-issue of': '⌘⇧P',
  'Related to': 'M R',
  'Blocked by': 'M B',
  Blocking: 'M X',
  'Duplicate of': 'M M',
}

/**
 * How a stored relation reads *from this issue's side*. `blocks` is the only
 * directional one — the same row is "Blocking" to the blocker and "Blocked by"
 * to the blocked issue, which is how Linear names them.
 */
function relationLabel(type: RelationType, outgoing: boolean): string {
  if (type === 'blocks') return outgoing ? 'Blocking' : 'Blocked by'
  return type === 'duplicate' ? 'Duplicate of' : 'Related to'
}
