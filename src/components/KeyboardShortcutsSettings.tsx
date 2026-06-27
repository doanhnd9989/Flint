import type { ReactNode } from 'react'

// ── Settings → Keyboard shortcuts (mirrors Linear's read-only reference page) ──
// A static reference of every shortcut the app actually implements, grouped to
// match the `?` HelpOverlay. Keep these in sync with HelpOverlay.tsx / useShortcuts.ts.

/** Small key chip — token-styled to match HelpOverlay's <Kbd>. */
function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[20px] items-center justify-center rounded border border-border bg-bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted">
      {children}
    </kbd>
  )
}

interface Shortcut {
  keys: ReactNode
  label: string
}

const SECTIONS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'General',
    items: [
      { keys: <Kbd>C</Kbd>, label: 'Create new issue' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>K</Kbd></>, label: 'Open command menu' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>/</Kbd></>, label: 'Toggle sidebar' },
      { keys: <><Kbd>⌘</Kbd> <Kbd>↵</Kbd></>, label: 'Submit (create / comment)' },
      { keys: <Kbd>?</Kbd>, label: 'Open this shortcuts reference' },
      { keys: <Kbd>Esc</Kbd>, label: 'Close dialogs / peek / selection' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { keys: <><Kbd>G</Kbd> <Kbd>I</Kbd></>, label: 'Go to Inbox' },
      { keys: <><Kbd>G</Kbd> <Kbd>M</Kbd></>, label: 'Go to My Issues' },
      { keys: <><Kbd>G</Kbd> <Kbd>B</Kbd></>, label: 'Go to Issues' },
      { keys: <><Kbd>G</Kbd> <Kbd>C</Kbd></>, label: 'Go to Cycles' },
      { keys: <><Kbd>G</Kbd> <Kbd>T</Kbd></>, label: 'Go to Triage' },
      { keys: <><Kbd>G</Kbd> <Kbd>P</Kbd></>, label: 'Go to Projects' },
      { keys: <><Kbd>G</Kbd> <Kbd>R</Kbd></>, label: 'Go to Roadmap' },
      { keys: <><Kbd>G</Kbd> <Kbd>V</Kbd></>, label: 'Go to Views' },
      { keys: <><Kbd>G</Kbd> <Kbd>S</Kbd></>, label: 'Go to Search' },
    ],
  },
  {
    title: 'Issues',
    items: [
      { keys: <><Kbd>↓</Kbd> <Kbd>J</Kbd></>, label: 'Focus next issue' },
      { keys: <><Kbd>↑</Kbd> <Kbd>K</Kbd></>, label: 'Focus previous issue' },
      { keys: <Kbd>↵</Kbd>, label: 'Open focused issue (peek)' },
      { keys: <Kbd>X</Kbd>, label: 'Select / deselect focused issue' },
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
    title: 'Lists & boards',
    items: [
      { keys: <><Kbd>⇧</Kbd> <Kbd>Click</Kbd></>, label: 'Select a range of issues' },
      { keys: <Kbd>Click</Kbd>, label: 'Open issue in the peek panel' },
      { keys: <Kbd>Right-click</Kbd>, label: 'Quick actions menu' },
      { keys: <Kbd>Drag</Kbd>, label: 'Reorder or move across columns' },
    ],
  },
]

export function KeyboardShortcutsSettings() {
  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">
        Keyboard shortcuts
      </h1>
      <p className="mt-0.5 text-[12px] text-muted">
        A reference of the keyboard shortcuts available throughout Flint. Press{' '}
        <Kbd>?</Kbd> anywhere to open the same reference in a searchable overlay.
      </p>

      {SECTIONS.map((section) => (
        <section key={section.title} className="mt-9">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-faint">
            {section.title}
          </h2>
          <div className="mt-2 border-b border-border">
            {section.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-6 border-t border-border py-2.5 first:border-t-0"
              >
                <span className="text-[13px] text-fg">{item.label}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {item.keys}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
