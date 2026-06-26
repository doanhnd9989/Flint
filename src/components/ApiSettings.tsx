import { useState } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// API keys here are session-local (kept in component useState) — this clone has
// no backend, so nothing is persisted or sent anywhere.
type ApiScope = 'Read' | 'Write' | 'Admin'
type ApiExpiry = '30 days' | '90 days' | 'Never'
type ApiKey = {
  id: string
  label: string
  prefix: string
  created: string
  lastUsed: string
  scope: ApiScope
  expiry: ApiExpiry
}

// Webhooks are session-local too — same no-backend story as API keys above.
type Webhook = {
  id: string
  url: string
  events: string[]
  active: boolean
}

const SCOPES: ApiScope[] = ['Read', 'Write', 'Admin']
const EXPIRIES: ApiExpiry[] = ['30 days', '90 days', 'Never']
const WEBHOOK_EVENTS = ['Issues', 'Comments', 'Projects', 'Cycles', 'Labels']

// Component-local id helper (NOT the store) — fine to use Math.random here.
const genId = () => Math.random().toString(36).slice(2, 10)

const SEED_KEYS: ApiKey[] = [
  {
    id: genId(),
    label: 'Production deploy',
    prefix: 'lin_api_••••••••',
    created: 'Created Jun 12, 2026',
    lastUsed: '2 days ago',
    scope: 'Write',
    expiry: '90 days',
  },
  {
    id: genId(),
    label: 'Local development',
    prefix: 'lin_api_••••••••',
    created: 'Created Jun 04, 2026',
    lastUsed: 'never',
    scope: 'Read',
    expiry: 'Never',
  },
]

const SEED_WEBHOOKS: Webhook[] = [
  {
    id: genId(),
    url: 'https://example.com/webhook',
    events: ['Issues', 'Comments'],
    active: true,
  },
]

export function ApiSettings() {
  const [keys, setKeys] = useState<ApiKey[]>(SEED_KEYS)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')
  const [scope, setScope] = useState<ApiScope>('Read')
  const [expiry, setExpiry] = useState<ApiExpiry>('90 days')
  // The freshly-created full token, shown exactly once.
  const [revealed, setRevealed] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Webhooks list + inline create form (mirrors the API-key pattern above).
  const [webhooks, setWebhooks] = useState<Webhook[]>(SEED_WEBHOOKS)
  const [creatingHook, setCreatingHook] = useState(false)
  const [hookUrl, setHookUrl] = useState('')
  const [hookEvents, setHookEvents] = useState<string[]>([])

  function handleCreate() {
    const name = label.trim() || 'Untitled key'
    const token = `lin_api_${genId()}${genId()}${genId()}`
    setKeys((prev) => [
      {
        id: genId(),
        label: name,
        prefix: 'lin_api_••••••••',
        created: 'Created Jun 26, 2026',
        lastUsed: 'never',
        scope,
        expiry,
      },
      ...prev,
    ])
    setRevealed(token)
    setCopied(false)
    setLabel('')
    setScope('Read')
    setExpiry('90 days')
    setCreating(false)
  }

  function handleCancel() {
    setLabel('')
    setScope('Read')
    setExpiry('90 days')
    setCreating(false)
  }

  function toggleHookEvent(ev: string) {
    setHookEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    )
  }

  function handleCreateHook() {
    const url = hookUrl.trim()
    if (!url) return
    setWebhooks((prev) => [
      {
        id: genId(),
        url,
        events: hookEvents.length ? hookEvents : ['Issues'],
        active: true,
      },
      ...prev,
    ])
    setHookUrl('')
    setHookEvents([])
    setCreatingHook(false)
  }

  function handleCancelHook() {
    setHookUrl('')
    setHookEvents([])
    setCreatingHook(false)
  }

  function handleCopy() {
    if (revealed) {
      navigator.clipboard?.writeText(revealed).catch(() => {})
      setCopied(true)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">API</h1>
      <p className="mt-1 text-[13px] text-muted">
        Personal API keys and webhooks for programmatic access.
      </p>

      <div className="mt-7 space-y-9">
        {/* Personal API keys */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-fg">Personal API keys</h2>
            <button
              onClick={() => setCreating((v) => !v)}
              className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
            >
              <Plus size={14} />
              New API key
            </button>
          </div>

          {/* Freshly revealed token — shown once */}
          {revealed && (
            <div className="mb-3 rounded-lg border border-border bg-bg-secondary p-3 text-[12px]">
              <p className="mb-2 text-muted">
                Copy your new API key now. You won’t be able to see it again.
              </p>
              <div className="flex items-center justify-between gap-3">
                <code className="truncate font-mono text-fg">{revealed}</code>
                <button
                  onClick={handleCopy}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-fg hover:bg-bg-hover"
                >
                  <Copy size={12} />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Inline create form */}
          {creating && (
            <div className="mb-3 space-y-2">
              <input
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Key label (e.g. CI pipeline)"
                className="w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[12px] text-muted">
                  Scope
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as ApiScope)}
                    className="rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
                  >
                    {SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-muted">
                  Expires
                  <select
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value as ApiExpiry)}
                    className="rounded-md border border-border bg-bg px-2 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
                  >
                    {EXPIRIES.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={handleCreate}
                    className="rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
                  >
                    Create
                  </button>
                  <button
                    onClick={handleCancel}
                    className="rounded-md border border-border px-2.5 py-1.5 text-[13px] text-fg hover:bg-bg-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="divide-y divide-border rounded-xl border border-border">
            {keys.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted">
                No API keys yet
              </div>
            ) : (
              keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-fg">{k.label}</span>
                      <code className="font-mono text-[12px] text-muted">{k.prefix}</code>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      {k.scope} · Expires {k.expiry} · {k.created} · Last used{' '}
                      {k.lastUsed}
                    </div>
                  </div>
                  <button
                    onClick={() => setKeys((prev) => prev.filter((x) => x.id !== k.id))}
                    className="shrink-0 text-[12px] text-red-500 hover:underline"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Webhooks */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-fg">Webhooks</h2>
              <p className="mt-0.5 text-[13px] text-muted">
                Send HTTP POST requests when issues change.
              </p>
            </div>
            <button
              onClick={() => setCreatingHook((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
            >
              <Plus size={14} />
              New webhook
            </button>
          </div>

          {/* Inline create form — URL + event checklist */}
          {creatingHook && (
            <div className="mb-3 space-y-2.5 rounded-lg border border-border bg-bg-secondary p-3">
              <input
                autoFocus
                value={hookUrl}
                onChange={(e) => setHookUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateHook()}
                placeholder="https://your-app.com/webhook"
                className="w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
              />
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <label
                    key={ev}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-fg hover:bg-bg-hover"
                  >
                    <input
                      type="checkbox"
                      checked={hookEvents.includes(ev)}
                      onChange={() => toggleHookEvent(ev)}
                      className="accent-accent"
                    />
                    {ev}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateHook}
                  className="rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
                >
                  Create
                </button>
                <button
                  onClick={handleCancelHook}
                  className="rounded-md border border-border px-2.5 py-1.5 text-[13px] text-fg hover:bg-bg-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-border rounded-xl border border-border">
            {webhooks.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted">
                No webhooks yet
              </div>
            ) : (
              webhooks.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <code className="block truncate font-mono text-[13px] text-fg">
                      {w.url}
                    </code>
                    <div className="mt-0.5 text-[12px] text-muted">
                      {w.events.join(', ')}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      onClick={() =>
                        setWebhooks((prev) =>
                          prev.map((x) =>
                            x.id === w.id ? { ...x, active: !x.active } : x,
                          ),
                        )
                      }
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        w.active
                          ? 'bg-green-500/15 text-green-500'
                          : 'bg-bg-hover text-muted',
                      )}
                    >
                      {w.active ? 'Active' : 'Paused'}
                    </button>
                    <button
                      onClick={() =>
                        setWebhooks((prev) => prev.filter((x) => x.id !== w.id))
                      }
                      className="text-muted hover:text-red-500"
                      aria-label="Delete webhook"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
