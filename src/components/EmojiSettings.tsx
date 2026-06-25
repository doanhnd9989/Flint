import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CustomEmoji {
  id: string
  name: string
  char: string
}

const genId = () => Math.random().toString(36).slice(2, 9)

const SEED: CustomEmoji[] = [
  { id: genId(), name: 'shipit', char: '🚀' },
  { id: genId(), name: 'partyparrot', char: '🦜' },
  { id: genId(), name: 'thisisfine', char: '🔥' },
  { id: genId(), name: 'lgtm', char: '👍' },
  { id: genId(), name: 'eyes', char: '👀' },
  { id: genId(), name: 'tada', char: '🎉' },
  { id: genId(), name: 'hugescommit', char: '🐘' },
  { id: genId(), name: 'coffee', char: '☕' },
]

export function EmojiSettings() {
  const [emojis, setEmojis] = useState<CustomEmoji[]>(SEED)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newChar, setNewChar] = useState('')

  const filtered = emojis.filter((e) =>
    e.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  function create() {
    const name = newName.trim()
    const char = newChar.trim()
    if (!name || !char) return
    setEmojis((prev) => [{ id: genId(), name, char }, ...prev])
    setNewName('')
    setNewChar('')
    setAdding(false)
  }

  function cancel() {
    setNewName('')
    setNewChar('')
    setAdding(false)
  }

  function remove(id: string) {
    setEmojis((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Emojis</h1>
      <p className="mt-1 text-[13px] text-muted">
        Add custom emojis to use in comments, reactions and project updates.
      </p>

      <div className="mt-7 space-y-9">
        <div>
          {/* Top row: search + add */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 rounded-md bg-bg-secondary px-2 py-1.5">
              <Search size={13} className="text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search emojis…"
                className="bg-transparent text-[13px] text-fg placeholder:text-faint focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
            >
              Add emoji
            </button>
          </div>

          {/* Inline add form */}
          {adding && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2.5">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="name"
                className="flex-1 rounded-md bg-bg px-2 py-1.5 text-[13px] text-fg placeholder:text-faint focus:outline-none"
              />
              <input
                value={newChar}
                onChange={(e) => setNewChar(e.target.value)}
                placeholder="🙂"
                maxLength={4}
                className="w-14 rounded-md bg-bg px-2 py-1.5 text-center text-[15px] text-fg placeholder:text-faint focus:outline-none"
              />
              <button
                type="button"
                onClick={create}
                className="rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
              >
                Create
              </button>
              <button
                type="button"
                onClick={cancel}
                className="rounded-md bg-bg-tertiary px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="mt-6 py-10 text-center text-[13px] text-muted">
              No emojis match
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {filtered.map((e) => (
                <div
                  key={e.id}
                  className={cn(
                    'group relative flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 hover:bg-bg-hover',
                  )}
                >
                  <span className="text-[20px] leading-none">{e.char}</span>
                  <span className="truncate text-[12px] text-muted">
                    :{e.name}:
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 hover:bg-bg-tertiary hover:text-fg group-hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
