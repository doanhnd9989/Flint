import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield,
  Loader2,
  Plus,
  Trash2,
  KeyRound,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  Users as UsersIcon,
  SlidersHorizontal,
  Building2,
  Webhook,
  Copy,
  Check,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth, type AuthUser, type FeatureFlag, type AuthRole } from '@/lib/auth'
import { cn } from '@/lib/utils'

type Tab = 'features' | 'users' | 'workspace' | 'webhooks'

/** Admin-only system console: feature flags, users, workspace config. */
export function AdminView() {
  const [tab, setTab] = useState<Tab>('features')
  const workspace = useAuth((s) => s.workspace)
  const accent = workspace.accentColor || '#5e6ad2'

  return (
    <div className="h-screen w-screen overflow-y-auto bg-bg-secondary text-fg">
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Link to="/" className="text-muted hover:text-fg" title="Back to app">
            <ArrowLeft size={18} />
          </Link>
          <Shield size={18} style={{ color: accent }} />
          <h1 className="font-semibold">System administration</h1>
        </div>
        <div className="mx-auto flex max-w-4xl gap-1 px-6">
          <TabButton active={tab === 'features'} onClick={() => setTab('features')} icon={SlidersHorizontal}>
            Features
          </TabButton>
          <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={UsersIcon}>
            Users
          </TabButton>
          <TabButton active={tab === 'workspace'} onClick={() => setTab('workspace')} icon={Building2}>
            Workspace
          </TabButton>
          <TabButton active={tab === 'webhooks'} onClick={() => setTab('webhooks')} icon={Webhook}>
            Webhooks
          </TabButton>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {tab === 'features' && <FeaturesTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'workspace' && <WorkspaceTab />}
        {tab === 'webhooks' && <WebhooksTab />}
      </main>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Shield
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition',
        active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
      )}
    >
      <Icon size={15} /> {children}
    </button>
  )
}

// ---------- Features ----------
function FeaturesTab() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const applyFlag = useAuth((s) => s.applyFlag)

  useEffect(() => {
    api<{ flags: FeatureFlag[] }>('/admin/flags')
      .then((d) => setFlags(d.flags))
      .finally(() => setLoading(false))
  }, [])

  async function toggle(f: FeatureFlag) {
    const next = !f.enabled
    setFlags((prev) => prev.map((x) => (x.key === f.key ? { ...x, enabled: next } : x)))
    applyFlag(f.key, next) // reflect immediately in the live sidebar
    try {
      await api(`/admin/flags/${f.key}`, { method: 'PATCH', body: { enabled: next } })
    } catch {
      setFlags((prev) => prev.map((x) => (x.key === f.key ? { ...x, enabled: f.enabled } : x)))
      applyFlag(f.key, f.enabled)
    }
  }

  if (loading) return <Spinner />
  return (
    <section>
      <SectionHead title="Feature flags" subtitle="Enable or disable areas of the product for everyone." />
      <div className="divide-y divide-border rounded-lg border border-border bg-bg">
        {flags.map((f) => (
          <div key={f.key} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{f.label}</p>
              <p className="text-xs text-muted">{f.description}</p>
            </div>
            <button
              type="button"
              onClick={() => toggle(f)}
              className={cn('transition', f.enabled ? 'text-accent' : 'text-faint')}
              title={f.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
            >
              {f.enabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------- Users ----------
const ROLES: AuthRole[] = ['admin', 'member', 'guest']

function UsersTab() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const me = useAuth((s) => s.user)

  function load() {
    api<{ users: AuthUser[] }>('/admin/users')
      .then((d) => setUsers(d.users))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function patch(id: string, body: Partial<{ role: AuthRole; status: string }>) {
    setError(null)
    try {
      const { user } = await api<{ user: AuthUser }>(`/admin/users/${id}`, { method: 'PATCH', body })
      setUsers((prev) => prev.map((u) => (u.id === id ? user : u)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  /** Set someone else's password — the only way to close out an account that was
   *  seeded with a shared or default credential. */
  async function resetPassword(u: AuthUser) {
    const next = prompt(`New password for ${u.email} (at least 6 characters):`)
    if (next === null) return
    setError(null)
    try {
      await api(`/admin/users/${u.id}/password`, { method: 'POST', body: { password: next } })
      alert(`Password updated for ${u.email}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Password reset failed')
    }
  }

  async function remove(u: AuthUser) {
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return
    setError(null)
    try {
      await api(`/admin/users/${u.id}`, { method: 'DELETE' })
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (loading) return <Spinner />
  return (
    <section>
      <SectionHead title="Users" subtitle="Manage login accounts, roles and access." />
      {error && <p className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

      <CreateUserForm onCreated={(u) => setUsers((prev) => [...prev, u])} onError={setError} />

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-bg">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-faint">
            <tr>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ background: u.avatarColor }}
                    >
                      {u.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-medium">
                        {u.name} {u.id === me?.id && <span className="text-xs text-faint">(you)</span>}
                      </p>
                      <p className="text-xs text-muted">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => patch(u.id, { role: e.target.value as AuthRole })}
                    className="rounded-md border border-border bg-bg px-2 py-1 text-sm capitalize outline-none focus:border-accent"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => patch(u.id, { status: u.status === 'active' ? 'suspended' : 'active' })}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      u.status === 'active'
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-amber-500/10 text-amber-600',
                    )}
                  >
                    {u.status === 'active' ? 'Active' : 'Suspended'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => resetPassword(u)}
                      className="text-faint hover:text-fg"
                      title="Reset password"
                    >
                      <KeyRound size={15} />
                    </button>
                    {u.id !== me?.id && (
                      <button
                        type="button"
                        onClick={() => remove(u)}
                        className="text-faint hover:text-red-500"
                        title="Delete user"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CreateUserForm({
  onCreated,
  onError,
}: {
  onCreated: (u: AuthUser) => void
  onError: (e: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AuthRole>('member')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const { user } = await api<{ user: AuthUser }>('/admin/users', {
        method: 'POST',
        body: { name, email, password, role },
      })
      onCreated(user)
      setName('')
      setEmail('')
      setPassword('')
      setRole('member')
      setOpen(false)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not create user')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-1.5 text-sm font-medium hover:bg-bg-hover"
      >
        <Plus size={15} /> Add user
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-bg p-3">
      <Field label="Name">
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Email">
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Password">
        <input required type="text" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Role">
        <select value={role} onChange={(e) => setRole(e.target.value as AuthRole)} className={inputCls}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <button
        type="submit"
        disabled={busy}
        className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy && <Loader2 size={14} className="animate-spin" />} Create
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-2 py-1.5 text-sm text-muted hover:text-fg">
        Cancel
      </button>
    </form>
  )
}

// ---------- Workspace ----------
function WorkspaceTab() {
  const workspace = useAuth((s) => s.workspace)
  const setWorkspace = useAuth((s) => s.setWorkspace)
  const [name, setName] = useState(workspace.name || '')
  const [tagline, setTagline] = useState(workspace.tagline || '')
  const [accentColor, setAccentColor] = useState(workspace.accentColor || '#5e6ad2')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setSaved(false)
    try {
      const { workspace: ws } = await api<{ workspace: typeof workspace }>('/admin/workspace', {
        method: 'PATCH',
        body: { name, tagline, accentColor },
      })
      setWorkspace(ws)
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <SectionHead title="Workspace" subtitle="Branding shown on the landing page and sign-in." />
      <form onSubmit={save} className="max-w-md space-y-4 rounded-lg border border-border bg-bg p-5">
        <Field label="Workspace name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Tagline">
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Accent color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-bg"
            />
            <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className={inputCls} />
          </div>
        </Field>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Save changes
          </button>
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </form>
    </section>
  )
}

// ---------- Webhooks ----------
interface Webhook {
  id: string
  url: string
  events: string
  enabled: boolean
  secretHint: string
  createdAt: string
  lastStatus: string | null
  lastAt: string | null
}

function WebhooksTab() {
  const [hooks, setHooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api<{ webhooks: Webhook[] }>('/admin/webhooks')
      .then((d) => setHooks(d.webhooks))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { webhook, secret: s } = await api<{ webhook: Webhook; secret: string }>('/admin/webhooks', {
        method: 'POST',
        body: { url: url.trim() },
      })
      setHooks((prev) => [{ ...webhook, secretHint: '', lastStatus: null, lastAt: null }, ...prev])
      setSecret(s)
      setCopied(false)
      setUrl('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(h: Webhook) {
    const next = !h.enabled
    setHooks((prev) => prev.map((x) => (x.id === h.id ? { ...x, enabled: next } : x)))
    await api(`/admin/webhooks/${h.id}`, { method: 'PATCH', body: { enabled: next } }).catch(() => {})
  }
  async function remove(h: Webhook) {
    if (!confirm(`Delete webhook for ${h.url}?`)) return
    await api(`/admin/webhooks/${h.id}`, { method: 'DELETE' }).catch(() => {})
    setHooks((prev) => prev.filter((x) => x.id !== h.id))
  }

  if (loading) return <Spinner />
  return (
    <section>
      <SectionHead title="Webhooks" subtitle="POST a signed event to your endpoint when issues or comments change." />
      {error && <p className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

      {secret && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-700">Signing secret — copy it now, shown once.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-bg px-3 py-2 text-[13px]">{secret}</code>
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(secret); setCopied(true) }}
              className="flex items-center gap-1 rounded-md border border-border bg-bg px-3 py-2 text-sm hover:bg-bg-hover"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Verify deliveries with <code>HMAC-SHA256(secret, body)</code> against the <code>X-Flint-Signature</code> header.
          </p>
        </div>
      )}

      <form onSubmit={create} className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted">Endpoint URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/flint"
            className={inputCls}
          />
        </label>
        <button type="submit" disabled={busy} className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add webhook
        </button>
      </form>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-bg">
        {hooks.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted">No webhooks yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-2 font-medium">Endpoint</th>
                <th className="px-4 py-2 font-medium">Last delivery</th>
                <th className="px-4 py-2 font-medium">Enabled</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {hooks.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3"><code className="text-[13px]">{h.url}</code></td>
                  <td className="px-4 py-3 text-muted">{h.lastStatus ? `${h.lastStatus}` : '—'}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => toggle(h)} className={cn('transition', h.enabled ? 'text-accent' : 'text-faint')}>
                      {h.enabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => remove(h)} className="text-faint hover:text-red-500" title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

// ---------- shared bits ----------
const inputCls =
  'rounded-md border border-border bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted">{subtitle}</p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-12 text-muted">
      <Loader2 className="animate-spin" />
    </div>
  )
}
