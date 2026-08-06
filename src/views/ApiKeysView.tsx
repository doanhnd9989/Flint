import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ArrowLeft, Plus, Trash2, Copy, Check, Loader2, TriangleAlert } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { DATE_LOCALE } from '@/lib/utils'

interface ApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

/** Personal API key management (Linear-style). Keys authenticate the REST API
 *  as a Bearer token without an interactive login. */
export function ApiKeysView() {
  const workspace = useAuth((s) => s.workspace)
  const accent = workspace.accentColor || '#5e6ad2'
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<string | null>(null) // full key, shown once
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api<{ keys: ApiKey[] }>('/auth/api-keys')
      .then((d) => setKeys(d.keys))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load keys'))
      .finally(() => setLoading(false))
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { key, apiKey } = await api<{ key: string; apiKey: ApiKey }>('/auth/api-keys', {
        method: 'POST',
        body: { name: name.trim() || 'API key' },
      })
      setKeys((prev) => [apiKey, ...prev])
      setCreated(key)
      setCopied(false)
      setName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(k: ApiKey) {
    if (!confirm(`Revoke "${k.name}"? Apps using it will stop working immediately.`)) return
    try {
      await api(`/auth/api-keys/${k.id}`, { method: 'DELETE' })
      setKeys((prev) => prev.filter((x) => x.id !== k.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key')
    }
  }

  return (
    <div className="h-screen w-screen overflow-y-auto bg-bg-secondary text-fg" style={{ ['--accent' as string]: accent }}>
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link to="/" className="text-muted hover:text-fg" title="Back to app">
            <ArrowLeft size={18} />
          </Link>
          <KeyRound size={18} style={{ color: accent }} />
          <h1 className="font-semibold">API keys</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-muted">
          Personal keys authenticate the{' '}
          <Link to="/api-docs" className="text-accent hover:underline">REST API</Link>{' '}
          as <code className="rounded bg-bg-tertiary px-1 text-[13px]">Authorization: Bearer &lt;key&gt;</code>. Treat them like passwords.
        </p>

        {error && <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

        {/* One-time reveal of a freshly created key */}
        {created && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
              <TriangleAlert size={15} /> Copy your new key now — you won’t see it again.
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-bg px-3 py-2 text-[13px]">{created}</code>
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(created); setCopied(true) }}
                className="flex items-center gap-1 rounded-md border border-border bg-bg px-3 py-2 text-sm hover:bg-bg-hover"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <button type="button" onClick={() => setCreated(null)} className="mt-2 text-xs text-muted hover:text-fg">
              Dismiss
            </button>
          </div>
        )}

        {/* Create */}
        <form onSubmit={create} className="mt-5 flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-muted">New key name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CI pipeline, local script"
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: accent }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create key
          </button>
        </form>

        {/* List */}
        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-bg">
          {loading ? (
            <div className="flex justify-center py-10 text-muted"><Loader2 className="animate-spin" /></div>
          ) : keys.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted">No API keys yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Key</th>
                  <th className="px-4 py-2 font-medium">Last used</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="px-4 py-3 font-medium">{k.name}</td>
                    <td className="px-4 py-3"><code className="text-[13px] text-muted">{k.prefix}…</code></td>
                    <td className="px-4 py-3 text-muted">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString(DATE_LOCALE) : 'Never'}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => revoke(k)} className="text-faint hover:text-red-500" title="Revoke">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
