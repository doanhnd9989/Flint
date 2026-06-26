import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { useStore } from '@/lib/store'

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[20px] items-center justify-center rounded border border-border bg-bg-tertiary px-1.5 py-0.5 font-mono text-[11px] text-fg">
      {children}
    </kbd>
  )
}

interface Shortcut {
  keys: ReactNode
  label: string
}

// Flatten a keys ReactNode (nested <Kbd> elements) into plain text for search.
function keysText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(keysText).join(' ')
  if (typeof node === 'object' && 'props' in node) {
    return keysText((node as { props: { children?: ReactNode } }).props.children)
  }
  return ''
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
      { keys: <><Kbd>⌘</Kbd> <Kbd>/</Kbd></>, label: 'Toggle sidebar' },
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
      { keys: <><Kbd>⇧</Kbd> <Kbd>Click</Kbd></>, label: 'Select a range of issues' },
      { keys: <><Kbd>↓</Kbd> <Kbd>↑</Kbd> <Kbd>J</Kbd> <Kbd>K</Kbd></>, label: 'Peek next / previous (while peek open)' },
      { keys: <Kbd>S</Kbd>, label: 'Change status of focused issue' },
      { keys: <Kbd>P</Kbd>, label: 'Set priority of focused issue' },
      { keys: <Kbd>A</Kbd>, label: 'Assign focused issue' },
      { keys: <Kbd>I</Kbd>, label: 'Assign to me' },
      { keys: <Kbd>L</Kbd>, label: 'Add labels to focused issue' },
      { keys: <Kbd>E</Kbd>, label: 'Set estimate of focused issue' },
      { keys: <><Kbd>⇧</Kbd> <Kbd>P</Kbd></>, label: 'Add focused issue to a project' },
      { keys: <><Kbd>⇧</Kbd> <Kbd>C</Kbd></>, label: 'Move focused issue to a cycle' },
      { keys: <><Kbd>⇧</Kbd> <Kbd>M</Kbd></>, label: 'Set milestone of focused issue' },
      { keys: <><Kbd>⇧</Kbd> <Kbd>D</Kbd></>, label: 'Set due date of focused issue' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>⌫</Kbd></>, label: 'Archive focused issue' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>.</Kbd></>, label: 'Copy issue ID' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>.</Kbd></>, label: 'Copy issue URL' },
      { keys: <Kbd>Click</Kbd>, label: 'Open issue in the peek panel' },
      { keys: <Kbd>Right-click</Kbd>, label: 'Quick actions menu' },
      { keys: <Kbd>Drag</Kbd>, label: 'Reorder within a group' },
    ],
  },
  {
    title: 'Relations',
    items: [
      { keys: <><Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>O</Kbd></>, label: 'Create sub-issue' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>P</Kbd></>, label: 'Mark as sub-issue of…' },
      { keys: <><Kbd>M</Kbd> <Kbd>R</Kbd></>, label: 'Mark as related to…' },
      { keys: <><Kbd>M</Kbd> <Kbd>B</Kbd></>, label: 'Mark as blocked by…' },
      { keys: <><Kbd>M</Kbd> <Kbd>X</Kbd></>, label: 'Mark as blocking…' },
      { keys: <><Kbd>M</Kbd> <Kbd>M</Kbd></>, label: 'Mark as duplicate of…' },
    ],
  },
  {
    title: 'Selection',
    items: [
      { keys: <Kbd>X</Kbd>, label: 'Select / deselect focused issue' },
      { keys: <><Kbd>⇧</Kbd> <Kbd>↓</Kbd></>, label: 'Extend selection down' },
      { keys: <><Kbd>⇧</Kbd> <Kbd>↑</Kbd></>, label: 'Extend selection up' },
      { keys: <><Kbd>⇧</Kbd> <Kbd>Click</Kbd></>, label: 'Select a range of issues' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>A</Kbd></>, label: 'Select all issues' },
      { keys: <Kbd>Esc</Kbd>, label: 'Clear selection' },
    ],
  },
  {
    title: 'Board',
    items: [
      { keys: <><Kbd>←</Kbd> <Kbd>→</Kbd></>, label: 'Move focus between columns' },
      { keys: <><Kbd>↑</Kbd> <Kbd>↓</Kbd></>, label: 'Move focus within a column' },
      { keys: <><Kbd>⇧</Kbd> <Kbd>←</Kbd></>, label: 'Move card to previous column' },
      { keys: <><Kbd>⇧</Kbd> <Kbd>→</Kbd></>, label: 'Move card to next column' },
      { keys: <Kbd>Drag</Kbd>, label: 'Move card across columns' },
      { keys: <Kbd>↵</Kbd>, label: 'Open focused card' },
    ],
  },
  {
    title: 'Editor',
    items: [
      { keys: <><Kbd>⌘</Kbd> <Kbd>B</Kbd></>, label: 'Bold' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>I</Kbd></>, label: 'Italic' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>E</Kbd></>, label: 'Inline code' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>X</Kbd></>, label: 'Strikethrough' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>K</Kbd></>, label: 'Insert link' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>⌥</Kbd> <Kbd>1</Kbd></>, label: 'Heading 1' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>⌥</Kbd> <Kbd>2</Kbd></>, label: 'Heading 2' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>⌥</Kbd> <Kbd>3</Kbd></>, label: 'Heading 3' },
      { keys: <Kbd>/</Kbd>, label: 'Open the command menu' },
    ],
  },
  {
    title: 'Display',
    items: [
      { keys: <Kbd>V</Kbd>, label: 'Toggle list / board view' },
      { keys: <Kbd>F</Kbd>, label: 'Open filter menu' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>F</Kbd></>, label: 'Filter issues' },
      { keys: <Kbd>O</Kbd>, label: 'Open display options' },
      { keys: <Kbd>G</Kbd>, label: 'Change grouping' },
      { keys: <Kbd>R</Kbd>, label: 'Change ordering' },
    ],
  },
  {
    title: 'History',
    items: [
      { keys: <><Kbd>⌘</Kbd> <Kbd>[</Kbd></>, label: 'Navigate back' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>]</Kbd></>, label: 'Navigate forward' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>Z</Kbd></>, label: 'Undo last change' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>⇧</Kbd> <Kbd>Z</Kbd></>, label: 'Redo last change' },
    ],
  },
  {
    title: 'Inbox',
    items: [
      { keys: <><Kbd>↓</Kbd> <Kbd>J</Kbd></>, label: 'Next notification' },
      { keys: <><Kbd>↑</Kbd> <Kbd>K</Kbd></>, label: 'Previous notification' },
      { keys: <Kbd>⌫</Kbd>, label: 'Mark as done' },
      { keys: <><Kbd>⇧</Kbd> <Kbd>⌫</Kbd></>, label: 'Delete all read notifications' },
      { keys: <Kbd>U</Kbd>, label: 'Mark as read / unread' },
      { keys: <><Kbd>⌥</Kbd> <Kbd>U</Kbd></>, label: 'Mark all as read' },
      { keys: <Kbd>H</Kbd>, label: 'Snooze notification' },
    ],
  },
]

export function HelpOverlay() {
  const open = useStore((s) => s.helpOpen)
  const setHelpOpen = useStore((s) => s.setHelpOpen)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setHelpOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setHelpOpen])

  // Reset the filter each time the overlay opens.
  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  if (!open) return null

  // Narrow rows by label or keys substring; drop sections left empty.
  const q = query.trim().toLowerCase()
  const sections = q
    ? SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            keysText(item.keys).toLowerCase().includes(q),
        ),
      })).filter((section) => section.items.length > 0)
    : SECTIONS

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
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Search size={14} className="text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter shortcuts…"
            className="w-full bg-transparent text-[13px] text-fg placeholder:text-faint focus:outline-none"
          />
        </div>
        {sections.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-muted">
            No shortcuts match “{query}”
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 p-5">
            {sections.map((section) => (
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
        )}
      </div>
    </div>,
    document.body,
  )
}
