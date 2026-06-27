import { useState } from 'react'
import { Search, Layers, Pin, PinOff } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * Saved-views management settings page — a faithful reproduction of Linear's
 * "Views" administration surface. Lists every SavedView in the workspace with
 * an icon, name, a layout/grouping summary line and its pinned-to-sidebar
 * state. Each row supports inline rename, pin/unpin (→ sidebar "Views"
 * section) and delete. All mutations go through existing store actions
 * (updateView / deleteView / togglePinView).
 */
export function SavedViewsSettings() {
  const { savedViews, updateView, deleteView, togglePinView } = useStoreShallow(
    (s) => ({
      savedViews: s.savedViews,
      updateView: s.updateView,
      deleteView: s.deleteView,
      togglePinView: s.togglePinView,
    }),
  )

  const [query, setQuery] = useState('')
  // Which row is currently being renamed inline, plus the draft text.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? savedViews.filter((v) => v.name.toLowerCase().includes(q))
    : savedViews

  function startRename(id: string, name: string) {
    setEditingId(id)
    setDraft(name)
  }

  function commitRename(id: string) {
    const name = draft.trim()
    if (name) updateView(id, { name })
    setEditingId(null)
    setDraft('')
  }

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Views</h1>
      <p className="mt-1 text-[13px] text-muted">
        Saved views capture a layout, grouping and set of filters you can return
        to. Pin one to show it in the sidebar.
      </p>

      <div className="mt-7 space-y-9">
        <div>
          {/* Filter row */}
          <div className="flex items-center gap-1.5 rounded-md bg-bg-secondary px-2 py-1.5">
            <Search size={13} className="text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter views…"
              className="w-40 bg-transparent text-[13px] text-fg placeholder:text-faint outline-none"
            />
          </div>

          {/* View list */}
          <div className="mt-4 divide-y divide-border rounded-xl border border-border">
            {savedViews.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <Layers size={26} strokeWidth={1.5} className="text-faint" />
                <div className="text-[13px] font-medium text-fg">
                  No saved views yet
                </div>
                <div className="max-w-xs text-[12px] text-muted">
                  Apply filters and grouping on the issues page, then save the
                  result as a view to manage it here.
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-muted">
                No views match
              </div>
            ) : (
              filtered.map((view) => (
                <div
                  key={view.id}
                  className="group flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[15px]">
                      {view.icon}
                    </span>
                    <div className="min-w-0">
                      {editingId === view.id ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => commitRename(view.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(view.id)
                            else if (e.key === 'Escape') {
                              setEditingId(null)
                              setDraft('')
                            }
                          }}
                          className="w-full rounded-md border border-border bg-bg px-2 py-1 text-[13px] text-fg outline-none focus:border-accent"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startRename(view.id, view.name)}
                          className="block truncate text-left text-[13px] font-medium text-fg hover:underline"
                        >
                          {view.name}
                        </button>
                      )}
                      <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                        <span className="capitalize">{view.layout}</span>
                        <span className="text-faint">·</span>
                        <span>
                          Grouped by{' '}
                          <span className="capitalize">{view.groupBy}</span>
                        </span>
                        {view.pinned && (
                          <>
                            <span className="text-faint">·</span>
                            <span className="inline-flex items-center gap-1 text-accent">
                              <Pin size={11} />
                              Pinned
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => togglePinView(view.id)}
                      className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-fg"
                    >
                      {view.pinned ? (
                        <>
                          <PinOff size={12} />
                          Unpin
                        </>
                      ) : (
                        <>
                          <Pin size={12} />
                          Pin
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => startRename(view.id, view.name)}
                      className="text-[12px] text-muted hover:underline"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete the view "${view.name}"?`))
                          deleteView(view.id)
                      }}
                      className={cn('text-[12px] text-red-500 hover:underline')}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
