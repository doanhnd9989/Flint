import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useStore } from '@/lib/store'

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[20px] items-center justify-center rounded border border-border bg-bg-tertiary px-1.5 py-0.5 font-mono text-[11px] text-fg">
      {children}
    </kbd>
  )
}

interface Shortcut {
  keys: React.ReactNode
  label: string
}

const SECTIONS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'Navigation',
    items: [
      { keys: <><Kbd>⌘</Kbd> <Kbd>K</Kbd></>, label: 'Open command menu' },
      { keys: <><Kbd>G</Kbd> <Kbd>I</Kbd></>, label: 'Go to Inbox' },
      { keys: <><Kbd>G</Kbd> <Kbd>M</Kbd></>, label: 'Go to My Issues' },
      { keys: <><Kbd>G</Kbd> <Kbd>B</Kbd></>, label: 'Go to Issues' },
      { keys: <><Kbd>G</Kbd> <Kbd>C</Kbd></>, label: 'Go to Cycles' },
      { keys: <><Kbd>G</Kbd> <Kbd>T</Kbd></>, label: 'Go to Triage' },
      { keys: <><Kbd>G</Kbd> <Kbd>P</Kbd></>, label: 'Go to Projects' },
      { keys: <><Kbd>G</Kbd> <Kbd>V</Kbd></>, label: 'Go to Views' },
      { keys: <><Kbd>G</Kbd> <Kbd>S</Kbd></>, label: 'Go to Search' },
    ],
  },
  {
    title: 'General',
    items: [
      { keys: <Kbd>C</Kbd>, label: 'Create new issue' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>↵</Kbd></>, label: 'Submit (create / comment)' },
      { keys: <Kbd>?</Kbd>, label: 'Open this shortcuts help' },
      { keys: <Kbd>Esc</Kbd>, label: 'Close dialogs / peek / selection' },
    ],
  },
  {
    title: 'Issues',
    items: [
      { keys: <><Kbd>↓</Kbd> <Kbd>J</Kbd></>, label: 'Focus next issue' },
      { keys: <><Kbd>↑</Kbd> <Kbd>K</Kbd></>, label: 'Focus previous issue' },
      { keys: <Kbd>↵</Kbd>, label: 'Open focused issue' },
      { keys: <Kbd>X</Kbd>, label: 'Select focused issue' },
      { keys: <Kbd>Click</Kbd>, label: 'Open issue in the peek panel' },
      { keys: <Kbd>Right-click</Kbd>, label: 'Quick actions menu' },
      { keys: <Kbd>Drag</Kbd>, label: 'Reorder within a group' },
    ],
  },
]

export function HelpOverlay() {
  const open = useStore((s) => s.helpOpen)
  const setHelpOpen = useStore((s) => s.setHelpOpen)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setHelpOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setHelpOpen])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay animate-fade"
      onMouseDown={() => setHelpOpen(false)}
    >
      <div
        className="w-[640px] max-w-[92vw] rounded-xl border border-border bg-bg-elevated shadow-lg animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[14px] font-semibold text-fg">Keyboard shortcuts</span>
          <button
            onClick={() => setHelpOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-bg-hover"
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 p-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                {section.title}
              </div>
              <div className="space-y-1.5">
                {section.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[13px] text-muted">{item.label}</span>
                    <span className="flex items-center gap-1">{item.keys}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
