import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, type Store } from './store'
import { useAuth } from './auth'
import type { Issue, RelationPickerKind } from './types'
import { copyToClipboard, copyToast, toast } from './toast'
import { branchName, issueUrl } from './utils'

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable
}

/**
 * The issue keyboard shortcuts act on: the peeked issue, else the issue at the
 * `/issue/:id` route, else the `j`/`k`-focused row.
 */
function currentIssue(s: Store): Issue | undefined {
  if (s.peekIssueId) {
    const peeked = s.issues.find((i) => i.id === s.peekIssueId)
    if (peeked) return peeked
  }
  const m = window.location.pathname.match(/\/issue\/([^/]+)/)
  if (m) {
    const byRoute = s.issues.find(
      (i) => i.identifier.toLowerCase() === m[1].toLowerCase(),
    )
    if (byRoute) return byRoute
  }
  if (s.focusedIssueId)
    return s.issues.find((i) => i.identifier === s.focusedIssueId)
  return undefined
}

/**
 * When the peek panel is open, `j`/`k` should advance the peeked issue to the
 * newly focused row (Linear re-peeks as you walk the list). Reads fresh state
 * after `moveFocus` has updated the focus.
 */
function repeekFocused(prev: Store) {
  if (!prev.peekIssueId) return
  const s = useStore.getState()
  if (!s.focusedIssueId) return
  const focused = s.issues.find((i) => i.identifier === s.focusedIssueId)
  if (focused && focused.id !== s.peekIssueId) s.setPeek(focused.id)
}

const M_CHORD: Record<string, RelationPickerKind> = {
  r: 'related',
  b: 'blockedBy',
  x: 'blocking',
  m: 'duplicateOf',
}

/** Global keyboard shortcuts, Linear-style (including `G`-prefixed nav chords). */
export function useShortcuts() {
  const navigate = useNavigate()
  const pendingG = useRef(false)
  const gTimer = useRef<number | undefined>(undefined)
  const pendingM = useRef(false)
  const mTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    function clearG() {
      pendingG.current = false
      window.clearTimeout(gTimer.current)
    }
    function clearM() {
      pendingM.current = false
      window.clearTimeout(mTimer.current)
    }

    function onKey(e: KeyboardEvent) {
      const store = useStore.getState()
      const key = e.key.toLowerCase()
      const teamKey = store.teams[0].key

      // ⌘K — command menu (works everywhere)
      if ((e.metaKey || e.ctrlKey) && key === 'k') {
        e.preventDefault()
        store.setCommandOpen(!store.commandOpen)
        return
      }

      // ⌥⇧Q — log out, the chord Linear prints next to the menu item. Option
      // rewrites e.key on macOS, so match the physical key instead.
      if (e.altKey && e.shiftKey && e.code === 'KeyQ') {
        e.preventDefault()
        useAuth.getState().logout()
        navigate('/')
        return
      }

      // ⌘/ — view keyboard shortcuts. Linear puts the sidebar on `[`, not here.
      if ((e.metaKey || e.ctrlKey) && key === '/') {
        e.preventDefault()
        store.setHelpMenuOpen(false)
        store.setHelpOpen(!store.helpOpen)
        return
      }

      // ⌘A — select every issue in the list being browsed (Linear's select all);
      // ⌘⌥A narrows that to the focused row's own group. Without the `altKey`
      // guard the group chord fell through to plain select-all and quietly
      // selected the whole list.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && key === 'a') {
        if (isTyping(e.target) || !store.navIssueIds.length) return
        e.preventDefault()
        const idents = e.altKey
          ? (store.navGroups.find((g) => g.identifiers.includes(store.focusedIssueId ?? ''))
              ?.identifiers ?? [])
          : store.navIssueIds
        if (!idents.length) return
        const ids = idents
          .map((ident) => store.issues.find((i) => i.identifier === ident)?.id)
          .filter((id): id is string => !!id)
        store.setSelectedIssues(ids)
        return
      }

      // ⌥T — fold/unfold every group at once. Lives above the blanket altKey
      // bail-out below, which is what made this and its siblings dead keys.
      if (e.altKey && !e.metaKey && !e.ctrlKey && key === 't') {
        if (isTyping(e.target) || !store.navGroups.length) return
        e.preventDefault()
        const keys = store.navGroups.map((g) => g.key)
        const allCollapsed = keys.every((k) => store.collapsedGroups[k])
        store.setGroupsCollapsed(keys, !allCollapsed)
        return
      }

      // ⌘⇧P — mark sub-issue of an existing issue; ⌘⇧O — create a sub-issue.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (key === 'p' || key === 'o')) {
        if (isTyping(e.target)) return
        const cur = currentIssue(store)
        if (!cur) return
        e.preventDefault()
        if (key === 'p') {
          store.openRelationPicker(cur.id, 'subIssueOf')
        } else {
          const created = store.createIssue({
            title: 'New sub-issue',
            teamId: cur.teamId,
            projectId: cur.projectId,
          })
          store.setIssueParent(created.id, cur.id)
          navigate(`/issue/${created.identifier}`)
        }
        return
      }

      // Linear's copy chords: ⌘. id, ⌘⇧. git branch name, ⌘⇧, URL.
      if ((e.metaKey || e.ctrlKey) && (key === '.' || key === ',')) {
        if (isTyping(e.target)) return
        const cur = currentIssue(store)
        if (!cur) return
        if (key === ',') {
          if (!e.shiftKey) return
          e.preventDefault()
          copyToClipboard(issueUrl(cur.identifier), copyToast.url())
          return
        }
        e.preventDefault()
        if (e.shiftKey) {
          const me = store.users.find((u) => u.id === store.currentUserId)
          copyToClipboard(branchName(cur.identifier, cur.title, me), copyToast.branch())
        } else {
          copyToClipboard(cur.identifier, copyToast.id(cur.identifier))
        }
        return
      }

      // ⌘⇧⌫ — archive the current issue (Linear's quick-archive chord).
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Backspace') {
        if (isTyping(e.target)) return
        const cur = currentIssue(store)
        if (!cur) return
        e.preventDefault()
        store.archiveIssue(cur.id)
        toast(`${cur.identifier} archived`)
        return
      }

      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return

      // Any open menu / popover / modal owns the keyboard — don't steal keys.
      const overlayOpen =
        store.commandOpen ||
        store.createOpen ||
        store.createInitiativeOpen ||
        store.createProjectOpen ||
        store.createDocumentOpen ||
        !!store.viewModalConfig ||
        store.helpOpen ||
        store.helpMenuOpen ||
        !!document.querySelector('[data-overlay]')

      // `M` then <key> — relation chords (Mark as …) on the current issue.
      if (pendingM.current) {
        clearM()
        if (!overlayOpen && M_CHORD[key]) {
          const cur = currentIssue(store)
          if (cur) {
            e.preventDefault()
            store.openRelationPicker(cur.id, M_CHORD[key])
          }
        }
        return
      }

      // ── Issue-list keyboard navigation (Linear's `j`/`k` row focus) ──
      if (!overlayOpen && !pendingG.current) {
        if (key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          store.moveFocus(1)
          repeekFocused(store)
          return
        }
        if (key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault()
          store.moveFocus(-1)
          repeekFocused(store)
          return
        }
        if (store.focusedIssueId) {
          const focused = store.issues.find(
            (i) => i.identifier === store.focusedIssueId,
          )
          if (focused) {
            if (key === 'x') {
              e.preventDefault()
              store.toggleSelectIssue(focused.id)
              return
            }
            // `T` folds the group the focused row sits in (Linear's
            // "Collapse/expand row"). Sub-grouped lists publish the sub-group,
            // so this folds the innermost group the row is actually inside.
            if (key === 't') {
              const group = store.navGroups.find((g) =>
                g.identifiers.includes(focused.identifier),
              )
              if (!group) return
              e.preventDefault()
              store.toggleGroupCollapsed(group.key)
              return
            }
            // Linear splits these: Space peeks, Enter opens the issue.
            if (e.key === ' ') {
              e.preventDefault()
              store.setPeek(focused.id)
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              store.setPeek(null)
              navigate(`/issue/${focused.identifier}`)
              return
            }
            // Row property hotkeys — open the command menu at that sub-page
            // (Linear: s status, p priority, a assignee, l label). Estimate is
            // ⇧E in Linear, and the shifted variants (⇧P project, ⇧C cycle,
            // ⇧M milestone) fall through to the switch below.
            const propPage: Record<string, string> = {
              s: 'status',
              p: 'priority',
              a: 'assignee',
              l: 'label',
            }
            if (!e.shiftKey && propPage[key]) {
              e.preventDefault()
              store.openIssuePropertyMenu(focused.id, propPage[key])
              return
            }
          }
        }
      }

      // `G` then <key> — navigation chords
      if (pendingG.current) {
        clearG()
        // Linear's letters exactly — `b` is the backlog (not "issues"), `v`/`w`
        // are the current/upcoming cycle, `s` is settings, `e` is all issues.
        const dest: Record<string, string> = {
          i: '/inbox',
          m: '/my-issues',
          t: `/team/${teamKey}/triage`,
          d: '/drafts',
          a: `/team/${teamKey}/active`,
          b: `/team/${teamKey}/backlog`,
          x: '/archive',
          e: '/all-issues',
          c: `/team/${teamKey}/cycles`,
          v: `/team/${teamKey}/cycle/active`,
          w: `/team/${teamKey}/cycle/upcoming`,
          p: '/projects',
          s: '/settings',
          n: '/initiatives',
          q: '/customers',
        }
        if (dest[key]) {
          e.preventDefault()
          navigate(dest[key])
          return
        }
        return
      }

      if (key === 'g') {
        pendingG.current = true
        window.clearTimeout(gTimer.current)
        gTimer.current = window.setTimeout(() => (pendingG.current = false), 1200)
        return
      }

      // `M` starts a relation chord, but only when an issue is in context.
      // (⇧M is the milestone chord, handled in the switch below — exclude it.)
      if (key === 'm' && !e.shiftKey && !overlayOpen && currentIssue(store)) {
        pendingM.current = true
        window.clearTimeout(mTimer.current)
        mTimer.current = window.setTimeout(() => (pendingM.current = false), 1200)
        return
      }

      // `?` opens the help centre in Linear — the shortcut sheet lives on ⌘/.
      if (e.key === '?') {
        e.preventDefault()
        store.setHelpMenuOpen(!store.helpMenuOpen)
        return
      }
      // `[` / `]` — Linear's sidebar toggles. We have no right sidebar yet.
      if (e.key === '[' && !overlayOpen) {
        e.preventDefault()
        store.toggleSidebar()
        return
      }
      // `/` — open search (Linear's global search key).
      if (e.key === '/' && !overlayOpen) {
        e.preventDefault()
        navigate('/search')
        return
      }
      // An open modal / command menu / popover owns the keyboard — single-key
      // shortcuts (c, plain letters) must not leak through to the page behind it.
      if (overlayOpen) return
      switch (key) {
        case 'c': {
          // ⇧C moves the current issue to a cycle; plain C opens the create modal.
          if (e.shiftKey) {
            if (overlayOpen) break
            const cur = currentIssue(store)
            if (!cur) break
            e.preventDefault()
            store.openIssuePropertyMenu(cur.id, 'cycle')
            break
          }
          e.preventDefault()
          store.setCreateOpen(true)
          break
        }
        // ⇧P — add the current issue to a project (Linear's project chord).
        case 'p': {
          if (!e.shiftKey || overlayOpen) break
          const cur = currentIssue(store)
          if (!cur) break
          e.preventDefault()
          store.openIssuePropertyMenu(cur.id, 'project')
          break
        }
        // ⇧M — set the current issue's milestone.
        case 'm': {
          if (!e.shiftKey || overlayOpen) break
          const cur = currentIssue(store)
          if (!cur) break
          e.preventDefault()
          store.openIssuePropertyMenu(cur.id, 'milestone')
          break
        }
        // ⇧E — change the current issue's estimate (Linear's estimate chord).
        case 'e': {
          if (!e.shiftKey || overlayOpen) break
          const cur = currentIssue(store)
          if (!cur) break
          e.preventDefault()
          store.openIssuePropertyMenu(cur.id, 'estimate')
          break
        }
        // `i` — assign the current issue to me (Linear's quick self-assign).
        case 'i': {
          if (overlayOpen) break
          const cur = currentIssue(store)
          if (!cur) break
          e.preventDefault()
          store.setIssueAssignee(cur.id, store.currentUserId)
          break
        }
        // ⇧D — set the current issue's due date (Linear's due-date chord).
        case 'd': {
          if (!e.shiftKey || overlayOpen) break
          const cur = currentIssue(store)
          if (!cur) break
          e.preventDefault()
          store.openIssuePropertyMenu(cur.id, 'dueDate')
          break
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(gTimer.current)
      window.clearTimeout(mTimer.current)
    }
  }, [navigate])
}
