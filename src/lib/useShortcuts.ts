import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from './store'

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable
}

/** Global keyboard shortcuts, Linear-style (including `G`-prefixed nav chords). */
export function useShortcuts() {
  const navigate = useNavigate()
  const pendingG = useRef(false)
  const gTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    function clearG() {
      pendingG.current = false
      window.clearTimeout(gTimer.current)
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

      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return

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
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(gTimer.current)
    }
  }, [navigate])
}
