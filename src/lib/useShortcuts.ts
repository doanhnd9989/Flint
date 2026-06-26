import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, type Store } from './store'
import type { Issue, RelationPickerKind } from './types'
import { copyToClipboard, copyToast, toast } from './toast'
import { issueUrl } from './utils'

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

      // ⌘/ — toggle the sidebar (Linear's collapse shortcut)
      if ((e.metaKey || e.ctrlKey) && key === '/') {
        e.preventDefault()
        store.toggleSidebar()
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

      // ⌘. — copy the issue identifier; ⌘⇧. — copy its URL (Linear's copy chords).
      if ((e.metaKey || e.ctrlKey) && key === '.') {
        if (isTyping(e.target)) return
        const cur = currentIssue(store)
        if (!cur) return
        e.preventDefault()
        if (e.shiftKey) {
          copyToClipboard(issueUrl(cur.identifier), copyToast.url())
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
        store.helpOpen ||
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
            if (e.key === 'Enter') {
              e.preventDefault()
              store.setPeek(focused.id)
              return
            }
            // Row property hotkeys — open the command menu at that sub-page
            // (Linear: s status, p priority, a assignee, l label).
            const propPage: Record<string, string> = {
              s: 'status',
              p: 'priority',
              a: 'assignee',
              l: 'label',
            }
            if (propPage[key]) {
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
        const dest: Record<string, string> = {
          i: '/inbox',
          m: '/my-issues',
          p: '/projects',
          r: '/roadmap',
          v: '/views',
          s: '/search',
          t: `/team/${teamKey}/triage`,
          c: `/team/${teamKey}/cycles`,
          b: `/team/${teamKey}/active`,
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
      if (key === 'm' && !overlayOpen && currentIssue(store)) {
        pendingM.current = true
        window.clearTimeout(mTimer.current)
        mTimer.current = window.setTimeout(() => (pendingM.current = false), 1200)
        return
      }

      // Single-key shortcuts
      if (e.key === '?') {
        e.preventDefault()
        store.setHelpOpen(true)
        return
      }
      switch (key) {
        case 'c':
          e.preventDefault()
          store.setCreateOpen(true)
          break
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
