import { useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'

/**
 * A reusable searchable emoji picker. Designed to live inside a `Popover`
 * panel: a search box, category sections, a scrollable grid, and a
 * recently-used row persisted to localStorage. Calls `onPick(emoji)` when an
 * emoji is chosen — the caller decides what to do (toggle a reaction, etc.).
 *
 * Keep the list reasonable (a few dozen per category) — this is a faithful
 * stand-in for Linear's far larger picker, not a full unicode database.
 */

const RECENTS_KEY = 'flint.emoji.recents'
const MAX_RECENTS = 18

type Category = { name: string; emojis: string[] }

const CATEGORIES: Category[] = [
  {
    name: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊',
      '😇', '🥰', '😍', '😘', '😋', '😜', '🤪', '😎', '🤩', '🥳', '😏', '😴',
      '😌', '😔', '😢', '😭', '😤', '😡', '🤔', '🤨', '😐', '😶', '🙄', '😬',
      '🤯', '😱', '😳', '🥺', '😩', '😞', '😅', '🤗', '🤤', '😷', '🤒', '🤕',
    ],
  },
  {
    name: 'People',
    emojis: [
      '👍', '👎', '👌', '🤌', '✌️', '🤞', '🤟', '🤘', '👏', '🙌', '🙏', '🤝',
      '💪', '👋', '🤙', '👊', '✊', '🫶', '👀', '🧠', '🦾', '👶', '🧑', '👩',
      '👨', '🧑‍💻', '👷', '🕵️', '🦸', '🧙', '🤷', '🤦', '💁', '🙋', '🙆', '🙅',
    ],
  },
  {
    name: 'Nature',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮',
      '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦄', '🐝', '🦋', '🐢', '🐙', '🦀',
      '🌳', '🌲', '🌴', '🌵', '🌷', '🌹', '🌻', '🌸', '🍀', '🍁', '🍄', '⭐',
    ],
  },
  {
    name: 'Food',
    emojis: [
      '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍑', '🍒', '🥝', '🍍',
      '🥑', '🍅', '🥕', '🌽', '🥦', '🍞', '🧀', '🍔', '🍟', '🍕', '🌮', '🌯',
      '🍣', '🍱', '🍜', '🍝', '🍰', '🎂', '🍪', '🍩', '🍫', '🍿', '☕', '🍺',
    ],
  },
  {
    name: 'Activity',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎱', '🏓', '🏸', '🥅', '⛳', '🏆',
      '🥇', '🥈', '🥉', '🎯', '🎮', '🎲', '🎸', '🎹', '🎺', '🎤', '🎧', '🎬',
      '🚀', '🎉', '🎊', '🎈', '🔥', '✨', '💯', '🎁', '🏁', '🚴', '🏊', '🧗',
    ],
  },
  {
    name: 'Objects',
    emojis: [
      '💻', '🖥️', '⌨️', '🖱️', '📱', '🖨️', '💾', '📷', '🎥', '📺', '📦', '📚',
      '✏️', '📝', '📌', '📎', '🔑', '🔒', '🔓', '💡', '🔦', '🔋', '🔌', '⏰',
      '⚙️', '🛠️', '🔧', '🔨', '🧰', '🧪', '🔬', '💰', '💳', '📈', '📊', '📅',
    ],
  },
  {
    name: 'Symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💞',
      '✅', '❌', '⭕', '❓', '❗', '⚠️', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣',
      '➕', '➖', '✖️', '➗', '♾️', '💢', '💥', '💫', '⭐', '🌟', '🔆', '🆗',
    ],
  },
  {
    name: 'Flags',
    emojis: [
      '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏴‍☠️', '🇺🇸', '🇬🇧', '🇨🇦', '🇫🇷', '🇩🇪',
      '🇮🇹', '🇪🇸', '🇯🇵', '🇰🇷', '🇨🇳', '🇮🇳', '🇧🇷', '🇲🇽', '🇦🇺', '🇳🇱', '🇸🇪', '🇻🇳',
    ],
  },
]

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, MAX_RECENTS) : []
  } catch {
    return []
  }
}

function pushRecent(emoji: string): string[] {
  const next = [emoji, ...loadRecents().filter((e) => e !== emoji)].slice(0, MAX_RECENTS)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / privacy-mode failures */
  }
  return next
}

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [query, setQuery] = useState('')
  const [recents, setRecents] = useState<string[]>(loadRecents)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = query.trim().toLowerCase()

  // Filter sections by matching the query against the category name. (We keep
  // the emoji list lean and unannotated, so name-level matching is the most
  // useful filter without a keyword database.)
  const sections = useMemo(() => {
    if (!q) return CATEGORIES
    return CATEGORIES.filter((c) => c.name.toLowerCase().includes(q)).map((c) => c)
  }, [q])

  function choose(emoji: string) {
    setRecents(pushRecent(emoji))
    onPick(emoji)
  }

  return (
    <div className="flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
      <div className="relative mb-1 px-1 pt-1">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji"
          className="w-full rounded-md border border-border bg-bg py-1 pl-7 pr-2 text-[13px] text-fg placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </div>

      <div className="max-h-[240px] overflow-y-auto px-1 pb-1">
        {!q && recents.length > 0 && (
          <Section label="Recently used" emojis={recents} onPick={choose} />
        )}
        {sections.map((c) => (
          <Section key={c.name} label={c.name} emojis={c.emojis} onPick={choose} />
        ))}
        {sections.length === 0 && (
          <div className="px-1 py-6 text-center text-[12px] text-faint">
            No emoji found
          </div>
        )}
      </div>
    </div>
  )
}

function Section({
  label,
  emojis,
  onPick,
}: {
  label: string
  emojis: string[]
  onPick: (emoji: string) => void
}) {
  return (
    <div className="mb-1">
      <div className="px-1 pb-0.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-faint">
        {label}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {emojis.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            onClick={() => onPick(e)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[16px] hover:bg-bg-hover"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
