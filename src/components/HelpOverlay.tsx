import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Search, X } from 'lucide-react'
import { useStore } from '@/lib/store'

interface Shortcut {
  label: string
  /**
   * Key glyphs as one string, exactly as Linear prints them. `then` (chords)
   * and `or` (alternates) are rendered as faint connector words, everything
   * else as a key glyph.
   */
  keys: string
}

/**
 * Linear's own "Keyboard Shortcuts" panel, section for section, in its order
 * and with its wording. Rows for Linear-only surfaces we don't have (Agent,
 * Loops, Reviews, Dashboards) are the only omissions — see PROGRESS.md.
 */
const SECTIONS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'General',
    items: [
      { label: 'Open command menu', keys: '⌘ K' },
      { label: 'Save or submit', keys: '⌘ Enter' },
      { label: 'Send comment', keys: '⌘ Enter' },
      { label: 'Back', keys: 'Esc' },
      { label: 'Open search', keys: '/' },
      { label: 'Open help center', keys: '?' },
      { label: 'View keyboard shortcuts', keys: '⌘ /' },
      { label: 'Switch workspace', keys: 'O then W' },
      { label: 'Log out', keys: '⌥ ⇧ Q' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { label: 'Toggle left sidebar', keys: '[' },
      { label: 'Toggle right sidebar', keys: ']' },
      { label: 'Open issue', keys: 'O then I' },
      { label: 'Open parent issue', keys: '⌘ ⇧ ↑' },
      { label: 'Go to team', keys: 'Ctrl ⇧ 1-9' },
      { label: 'Go to inbox', keys: 'G then I' },
      { label: 'Go to my issues', keys: 'G then M' },
      { label: 'Go to triage', keys: 'G then T' },
      { label: 'Go to drafts', keys: 'G then D' },
      { label: 'Go to active issues', keys: 'G then A' },
      { label: 'Go to backlog', keys: 'G then B' },
      { label: 'Open team archive', keys: 'G then X' },
      { label: 'Go to all issues', keys: 'G then E' },
      { label: 'Go to cycles', keys: 'G then C' },
      { label: 'Go to current cycle', keys: 'G then V' },
      { label: 'Go to upcoming cycle', keys: 'G then W' },
      { label: 'Go to projects', keys: 'G then P' },
      { label: 'Go to settings', keys: 'G then S' },
      { label: 'Open a favorite', keys: 'O then F' },
      { label: 'Open a project', keys: 'O then P' },
      { label: 'Open a cycle', keys: 'O then C' },
      { label: 'Open a user', keys: 'O then U' },
      { label: 'Open a team', keys: 'O then T' },
      { label: 'Open view', keys: 'O then V' },
      { label: 'Open a document', keys: 'O then D' },
      { label: 'Go to initiatives', keys: 'G then N' },
      { label: 'Open initiative', keys: 'O then N' },
      { label: 'Go to customers', keys: 'G then Q' },
      { label: 'Open a customer', keys: 'O then Q' },
      { label: 'Open link from last toast', keys: '⌘ ⌥ O' },
      { label: 'Show display options', keys: '⇧ V' },
    ],
  },
  {
    title: 'Issues',
    items: [
      { label: 'New issue', keys: 'C' },
      { label: 'New issue from template', keys: '⌥ C' },
      { label: 'New issue in full screen view', keys: 'V' },
      { label: 'Assign issue to user', keys: 'A' },
      { label: 'Assign to me', keys: 'I' },
      { label: 'Apply template to issue', keys: 'Ctrl ⌥ ⇧ T' },
      { label: 'Change labels', keys: 'L' },
      { label: 'Change issue status', keys: 'S' },
      { label: 'Change priority', keys: 'P' },
      { label: 'Change estimate', keys: '⇧ E' },
      { label: 'Set due date', keys: '⇧ D' },
      { label: 'Remove due date', keys: '⌘ ⇧ D' },
      { label: 'Rename', keys: '⇧ R' },
      { label: 'Focus issue description input', keys: 'Ctrl ⇧ I' },
      { label: 'Mark as favorite', keys: '⌥ F' },
      { label: 'Remind about issue', keys: '⇧ H' },
      { label: 'Move to another team', keys: '⌘ ⇧ M' },
      { label: 'Delete issue', keys: '⌘ ⌫' },
      { label: 'Restore issue', keys: '#' },
      { label: 'Subscribe to issue', keys: '⇧ S' },
      { label: 'Manage issue subscribers', keys: '⌘ ⇧ S' },
      { label: 'Mark as blocked', keys: 'M then B' },
      { label: 'Mark as blocking', keys: 'M then X' },
      { label: 'Reference related issue', keys: 'M then R' },
      { label: 'Mark as duplicate of another issue', keys: 'M then M' },
      { label: 'Link any URL to issue…', keys: 'Ctrl L' },
      { label: 'Copy issue id', keys: '⌘ .' },
      { label: 'Copy git branch name', keys: '⌘ ⇧ .' },
      { label: 'Copy issue URL', keys: '⌘ ⇧ ,' },
      { label: 'Copy issue title', keys: "⌘ ⇧ '" },
      { label: 'Copy issue as Markdown', keys: '⌘ ⌥ C' },
      { label: 'Copy as prompt', keys: '⌘ ⌥ P' },
      { label: 'Create sub-issue', keys: '⌘ ⇧ O' },
      { label: 'Add to cycle', keys: '⇧ C' },
      { label: 'Add to project', keys: '⇧ P' },
      { label: 'Add to project milestone', keys: '⇧ M' },
      { label: 'Set parent issue', keys: '⌘ ⇧ P' },
      { label: 'Open sub-issue', keys: '⌘ ⇧ ↓' },
      { label: 'Toggle links section', keys: 'Ctrl ⇧ L' },
    ],
  },
  {
    title: 'Projects',
    items: [
      { label: 'New project', keys: 'N then P' },
      { label: 'Change project status', keys: 'P then S' },
      { label: 'Change project initiatives', keys: 'P then N' },
      { label: 'Change project lead', keys: 'P then A' },
      { label: 'Change project members', keys: 'P then M' },
      { label: 'Change project teams', keys: 'P then T' },
      { label: 'Change project labels', keys: 'P then L' },
      { label: 'Set start date', keys: 'Ctrl ⌥ S' },
      { label: 'Set target date', keys: 'Ctrl ⌥ D' },
      { label: 'Mark as favorite', keys: '⌥ F' },
      { label: 'Remind about project', keys: '⇧ H' },
      { label: 'Open project updates & activity', keys: '⌘ U' },
      { label: 'Write new project update', keys: '⌘ ⇧ U' },
      { label: 'Copy project URL', keys: '⌘ ⇧ ,' },
      { label: 'Copy project title', keys: "⌘ ⇧ '" },
    ],
  },
  {
    title: 'Initiatives',
    items: [
      { label: 'Change initiative owner', keys: 'N then O' },
      { label: 'Set target date', keys: 'Ctrl ⌥ D' },
      { label: 'Mark as favorite', keys: '⌥ F' },
      { label: 'Remind about initiative', keys: '⇧ H' },
      { label: 'Open initiative updates & activity', keys: '⌘ U' },
      { label: 'Write new initiative update', keys: '⌘ ⇧ U' },
      { label: 'Copy initiative URL', keys: '⌘ ⇧ ,' },
      { label: 'Copy initiative title', keys: "⌘ ⇧ '" },
    ],
  },
  {
    title: 'List / Board',
    items: [
      { label: 'Peek into item', keys: 'Space' },
      { label: 'Open focused item', keys: 'Enter' },
      { label: 'Select item', keys: 'X' },
      { label: 'Select all items in a group', keys: '⌘ ⌥ A' },
      { label: 'Select all items', keys: '⌘ A' },
      { label: 'Clear selection', keys: 'Esc' },
      { label: 'Toggle layout view', keys: '⌘ B' },
      { label: 'Copy page URL', keys: '⌘ ⇧ C' },
      { label: 'Move up', keys: '↑ or K' },
      { label: 'Move down', keys: '↓ or J' },
      { label: 'Move right', keys: '→' },
      { label: 'Move left', keys: '←' },
      { label: 'Select multiple items in a list', keys: '⇧ Click' },
      { label: 'Move to top of the group', keys: '⌥ ⇧ ↑' },
      { label: 'Move one position up', keys: '⌥ ↑' },
      { label: 'Move one position down', keys: '⌥ ↓' },
      { label: 'Move to bottom of the group', keys: '⌥ ⇧ ↓' },
      { label: 'Move to the left column', keys: '⌥ ←' },
      { label: 'Move to the right column', keys: '⌥ →' },
      { label: 'Collapse/expand row', keys: 'T' },
      { label: 'Collapse/expand all rows', keys: '⌥ T' },
    ],
  },
  {
    title: 'Timeline',
    items: [
      { label: 'Toggle timeline project list', keys: '⇧ {' },
      { label: 'Select project / milestone', keys: 'X' },
      { label: 'Select project or next milestone', keys: '→' },
      { label: 'Select previous milestone or project', keys: '←' },
      { label: 'Deselect project or milestone', keys: 'Esc' },
      { label: 'Keep dependencies & milestones in place', keys: '⌘ Drag project' },
      { label: 'Shift dependencies', keys: '⇧ Drag project' },
      { label: 'Shift subsequent milestones', keys: '⇧ Drag milestone' },
      { label: 'Zoom in/out', keys: '⌘ Scroll' },
      { label: 'Zoom out', keys: '-' },
      { label: 'Zoom in', keys: '=' },
      { label: 'Zoom to year', keys: 'Y' },
      { label: 'Zoom to quarter', keys: 'Q' },
      { label: 'Zoom to month', keys: 'M' },
      { label: 'Zoom to week', keys: 'W' },
    ],
  },
  {
    title: 'Comments',
    items: [
      { label: 'Comment on issue', keys: 'Ctrl M' },
      { label: 'Reply to comment', keys: 'R' },
    ],
  },
  {
    title: 'Inbox',
    items: [
      { label: 'Delete notification', keys: 'E or ⌫' },
      { label: 'Delete all read notifications', keys: '⇧ ⌫' },
      { label: 'Mark as read/unread', keys: 'U' },
      { label: 'Mark all as read', keys: '⌥ U' },
      { label: 'Snooze notification', keys: 'H' },
    ],
  },
  {
    title: 'Filters',
    items: [
      { label: 'Add filter', keys: 'F' },
      { label: 'Clear all filters', keys: '⌥ ⇧ F' },
      { label: 'Clear last issue filter', keys: '⇧ F' },
    ],
  },
  {
    title: 'Triage',
    items: [
      { label: 'Snooze issue', keys: 'H' },
      { label: 'Accept issue', keys: '1' },
      { label: 'Decline issue', keys: '2' },
      { label: 'Mark issue as duplicate', keys: '3' },
    ],
  },
  {
    title: 'Editor',
    items: [
      { label: 'Bold', keys: '⌘ B' },
      { label: 'Italic', keys: '⌘ I' },
      { label: 'Underline', keys: '⌘ U' },
      { label: 'Strikethrough', keys: '⌘ ⇧ X' },
      { label: 'Attach image/file', keys: '⌘ ⇧ U' },
      { label: 'Inline code', keys: '⌘ E' },
      { label: 'Turn text into link', keys: '⌘ K' },
      { label: 'Blockquote', keys: '⌥ ⇧ .' },
      { label: 'Regular text', keys: '⌘ ⌥ 0' },
      { label: 'Heading 1', keys: '⌘ ⌥ 1' },
      { label: 'Heading 2', keys: '⌘ ⌥ 2' },
      { label: 'Heading 3', keys: '⌘ ⌥ 3' },
      { label: 'Heading 4', keys: '⌘ ⌥ 4' },
      { label: 'Collapsible section', keys: '⌘ ⇧ 6' },
      { label: 'Checklist', keys: '⌘ ⇧ 7' },
      { label: 'Toggle checklist', keys: '⌘ ↵' },
      { label: 'Toggle nested checklist', keys: '⌘ ⇧ ↵' },
      { label: 'Bulleted list', keys: '⌘ ⇧ 8' },
      { label: 'Numbered list', keys: '⌘ ⇧ 9' },
      { label: 'Code block', keys: '⌘ ⇧ \\' },
      { label: 'New line in document', keys: 'Enter' },
      { label: 'New line in comment', keys: 'Enter' },
      { label: 'Move selection up', keys: '⌥ ↑' },
      { label: 'Move selection down', keys: '⌥ ↓' },
      { label: 'Undo', keys: '⌘ Z' },
      { label: 'Redo', keys: '⌘ ⇧ Z' },
    ],
  },
  {
    title: 'Markdown formatting',
    items: [
      { label: 'Heading 1', keys: '# then Space' },
      { label: 'Heading 2', keys: '## then Space' },
      { label: 'Heading 3', keys: '### then Space' },
      { label: 'Heading 4', keys: '#### then Space' },
      { label: 'Bulleted list', keys: '- then Space' },
      { label: 'Numbered list', keys: '1. then Space' },
      { label: 'Checklist', keys: '[]' },
      { label: 'Blockquote', keys: '> then Space' },
      { label: 'Code block', keys: '```' },
      { label: 'Table', keys: '|--' },
      { label: 'Italic', keys: '_Text_' },
      { label: 'Bold', keys: '**Text**' },
      { label: 'Strikethrough', keys: '~Text~' },
      { label: 'Inline code', keys: '`Code`' },
      { label: 'Horizontal divider', keys: '*** then Space' },
      { label: 'Collapsible section', keys: '>>> then Space' },
    ],
  },
]

/** Linear prints chords as "G then I" — the connector is faint, the keys are not. */
function Keys({ keys }: { keys: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted">
      {keys.split(' ').map((part, i) =>
        part === 'then' || part === 'or' ? (
          <span key={i} className="text-faint">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  )
}

export function HelpOverlay() {
  const open = useStore((s) => s.helpOpen)
  const setHelpOpen = useStore((s) => s.setHelpOpen)
  const setHelpMenuOpen = useStore((s) => s.setHelpMenuOpen)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setHelpOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setHelpOpen])

  // Reset the filter each time the panel opens.
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
            item.keys.toLowerCase().includes(q),
        ),
      })).filter((section) => section.items.length > 0)
    : SECTIONS

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      data-overlay
      onMouseDown={() => setHelpOpen(false)}
    >
      {/* A right-side sheet inset from the edge, the way Linear anchors it —
          the app behind stays visible and undimmed. */}
      <div
        className="absolute bottom-3 right-3 top-3 flex w-[358px] max-w-[92vw] flex-col rounded-xl border border-border bg-bg-elevated shadow-lg animate-fade"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 px-3 py-2.5">
          <button
            onClick={() => {
              setHelpOpen(false)
              setHelpMenuOpen(true)
            }}
            aria-label="Back to help"
            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-bg-hover"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-[13px] font-medium text-fg">Keyboard Shortcuts</span>
          <button
            onClick={() => setHelpOpen(false)}
            aria-label="Close"
            className="ml-auto flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-bg-hover"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-md border border-accent px-2 py-1.5">
            <Search size={13} className="shrink-0 text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shortcuts"
              className="w-full bg-transparent text-[13px] text-fg placeholder:text-faint focus:outline-none"
            />
          </div>
        </div>
        {sections.length === 0 ? (
          <div className="px-3 py-8 text-center text-[13px] text-muted">
            No shortcuts match “{query}”
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-3 pb-4">
            {sections.map((section) => (
              <section key={section.title} className="mb-4">
                <div className="mb-1 text-[13px] font-medium text-fg">
                  {section.title}
                </div>
                <dl>
                  {section.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-[3px]">
                      <dt className="truncate text-[13px] text-muted">{item.label}</dt>
                      <dd>
                        <Keys keys={item.keys} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
