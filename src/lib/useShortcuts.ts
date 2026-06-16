import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from './store'

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable
}

/** Global keyboard shortcuts, Linear-style. */
export function useShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const store = useStore.getState()

      // ⌘K — command menu (works everywhere)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        store.setCommandOpen(!store.commandOpen)
        return
      }

      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key.toLowerCase()) {
        case 'c':
          e.preventDefault()
          store.setCreateOpen(true)
          break
        case 'i':
          navigate('/inbox')
          break
        case 'm':
          navigate('/my-issues')
          break
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate])
}
