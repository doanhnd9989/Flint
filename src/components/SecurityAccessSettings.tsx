import type { ReactNode } from 'react'
import { useState } from 'react'
import { Key, Monitor, Smartphone } from 'lucide-react'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api'
import { useToasts } from '@/lib/toast'
import { Toggle as UIToggle } from './ui/Toggle'

const genId = () => Math.random().toString(36).slice(2, 9)

/** Linear-style pill toggle switch. */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <UIToggle checked={on} onChange={onChange} />
}

/** Bordered, divided settings card. */
function Card({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border rounded-xl border border-border">{children}</div>
}

/** A single settings row: leading content on the left, control on the right. */
function Row({ left, control }: { left: ReactNode; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      {left}
      {control}
    </div>
  )
}

/**
 * Changing your own password. The endpoint has existed since the auth work
 * landed but nothing in the app called it, so the only way to rotate a
 * credential was curl.
 */
function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const addToast = useToasts((s) => s.add)

  const submit = async () => {
    setError(null)
    if (next.length < 6) return setError('New password must be at least 6 characters')
    if (next !== confirm) return setError('The two new passwords do not match')
    setBusy(true)
    try {
      await api('/auth/change-password', { method: 'POST', body: { current, next } })
      setCurrent('')
      setNext('')
      setConfirm('')
      addToast({ message: 'Password changed' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the password')
    } finally {
      setBusy(false)
    }
  }

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    autoComplete: string,
  ) => (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-muted">{label}</span>
      <input
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
        className="w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
      />
    </label>
  )

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      {field('Current password', current, setCurrent, 'current-password')}
      {field('New password', next, setNext, 'new-password')}
      {field('Confirm new password', confirm, setConfirm, 'new-password')}
      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-[12px] text-red-500">{error}</p>
      )}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !current || !next}
        className="rounded-md bg-accent px-3 py-1.5 text-[13px] text-accent-text hover:bg-accent-hover disabled:opacity-50"
      >
        {busy ? 'Changing…' : 'Change password'}
      </button>
    </div>
  )
}

type Passkey = { id: string; name: string; added: string }
type Session = { id: string; device: string; location: string; current: boolean }
/** `permissions: null` is Linear's "full access"; a number renders as "N permissions". */
type PersonalKey = {
  id: string
  name: string
  permissions: number | null
  allTeams: boolean
  created: string
  lastUsed: string | null
}
type AuthorizedApp = { id: string; name: string; scopes: string }

/** Personal Security & access settings page. */
export function SecurityAccessSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)
  const workspaceName = useStore((s) => s.workspaceName)

  const [passkeys, setPasskeys] = useState<Passkey[]>([
    { id: genId(), name: 'MacBook Pro', added: 'Used with current session' },
  ])
  const [sessions, setSessions] = useState<Session[]>([
    {
      id: genId(),
      device: 'Chrome on macOS',
      location: 'Current session · San Francisco, US',
      current: true,
    },
    {
      id: genId(),
      device: 'Safari on iPhone',
      location: 'San Francisco, US · Last seen 2 hours ago',
      current: false,
    },
    {
      id: genId(),
      device: 'Flint Desktop on macOS',
      location: 'San Francisco, US · Last seen 3 days ago',
      current: false,
    },
  ])
  const [keys, setKeys] = useState<PersonalKey[]>([
    { id: genId(), name: 'Production deploy', permissions: null, allTeams: true, created: 'Created 2 months ago', lastUsed: 'Aug 7, 2026' },
    { id: genId(), name: 'Local development', permissions: 2, allTeams: false, created: 'Created 4 months ago', lastUsed: null },
  ])
  const [signingKey, setSigningKey] = useState<string | null>(null)
  const [apps, setApps] = useState<AuthorizedApp[]>([
    { id: genId(), name: 'Raycast', scopes: 'Read, Write' },
    { id: genId(), name: 'Zapier', scopes: 'Read, Write' },
  ])

  const twoFactor = featureSettings['account.twoFactor'] ?? false

  const addPasskey = () =>
    setPasskeys((prev) => [...prev, { id: genId(), name: 'New device', added: 'Added just now' }])
  const removePasskey = (id: string) =>
    setPasskeys((prev) => prev.filter((p) => p.id !== id))
  const revokeSession = (id: string) =>
    setSessions((prev) => prev.filter((s) => s.id !== id))
  const signOutAll = () => setSessions((prev) => prev.filter((s) => s.current))
  const addKey = () =>
    setKeys((prev) => [
      {
        id: genId(),
        name: 'Untitled key',
        permissions: null,
        allTeams: true,
        created: 'Created just now',
        lastUsed: null,
      },
      ...prev,
    ])

  const others = sessions.filter((s) => !s.current)

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Security &amp; access</h1>
      <p className="mt-1 text-[13px] text-muted">
        Manage how you sign in and which devices have access.
      </p>

      {/* Section order is Linear's: Sessions → Passkeys → Personal API keys →
          Commit signing key → Authorized applications. Password and two-factor
          come last and are ours: Linear signs in with SSO/passkeys and has no
          password to change. */}
      <div className="mt-7 space-y-9">
        {/* Sessions */}
        <section>
          <h2 className="text-[13px] font-semibold text-fg">Sessions</h2>
          <p className="mt-0.5 mb-3 text-[12px] text-muted">Devices logged into your account</p>
          <Card>
            {sessions
              .filter((s) => s.current)
              .map((s) => (
                <Row
                  key={s.id}
                  left={
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-tertiary text-muted">
                        <Monitor size={15} />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-fg">{s.device}</div>
                        <div className="mt-0.5 text-[12px] text-muted">{s.location}</div>
                      </div>
                    </div>
                  }
                  control={
                    <button type="button" className="text-[13px] text-muted hover:text-fg">
                      Log out
                    </button>
                  }
                />
              ))}
          </Card>

          {others.length > 0 && (
            <>
              <div className="mt-5 mb-2 flex items-center justify-between">
                <span className="text-[12px] text-muted">
                  {others.length} other session{others.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={signOutAll}
                  className="text-[13px] text-red-500 hover:underline"
                >
                  Revoke all
                </button>
              </div>
              <Card>
                {others.map((s) => (
                  <Row
                    key={s.id}
                    left={
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-tertiary text-muted">
                          {s.device.toLowerCase().includes('iphone') ? (
                            <Smartphone size={15} />
                          ) : (
                            <Monitor size={15} />
                          )}
                        </div>
                        <div>
                          <div className="text-[13px] font-medium text-fg">{s.device}</div>
                          <div className="mt-0.5 text-[12px] text-muted">{s.location}</div>
                        </div>
                      </div>
                    }
                    control={
                      <button
                        type="button"
                        onClick={() => revokeSession(s.id)}
                        className="text-[13px] text-red-500 hover:underline"
                      >
                        Revoke
                      </button>
                    }
                  />
                ))}
              </Card>
            </>
          )}
        </section>

        {/* Passkeys */}
        <section>
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[13px] font-semibold text-fg">Passkeys</h2>
              <p className="mt-0.5 text-[12px] text-muted">
                Passkeys are a secure way to sign in to your {workspaceName} account
              </p>
              <p className="mt-2 text-[12px] text-muted">
                {passkeys.length} passkey{passkeys.length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
              onClick={addPasskey}
              className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
            >
              New passkey
            </button>
          </div>
          <Card>
            {passkeys.map((p) => (
              <Row
                key={p.id}
                left={
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-tertiary text-muted">
                      <Key size={15} />
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-fg">{p.name}</div>
                      <div className="mt-0.5 text-[12px] text-muted">{p.added}</div>
                    </div>
                  </div>
                }
                control={
                  <button
                    type="button"
                    onClick={() => removePasskey(p.id)}
                    className="text-[13px] text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                }
              />
            ))}
          </Card>
        </section>

        {/* Personal API keys — Linear keeps these here, not on Settings → API,
            which only lists everyone else's. */}
        <section>
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[13px] font-semibold text-fg">Personal API keys</h2>
              <p className="mt-0.5 text-[12px] text-muted">
                Use {workspaceName}&rsquo;s GraphQL API to build your own integrations
              </p>
              <p className="mt-2 text-[12px] text-muted">
                {keys.length} API key{keys.length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
              onClick={addKey}
              className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
            >
              New API key
            </button>
          </div>
          <Card>
            {keys.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted">No API keys yet</div>
            ) : (
              keys.map((k) => (
                <Row
                  key={k.id}
                  left={
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-fg">
                        <span className="font-medium">{k.name}</span>
                        <span className="text-muted">
                          {' · '}
                          {k.permissions === null
                            ? 'full access'
                            : `${k.permissions} permission${k.permissions === 1 ? '' : 's'}`}
                          {' · '}
                          {k.allTeams ? 'public teams' : 'selected teams'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted">
                        {k.created} · {k.lastUsed ? `last used on ${k.lastUsed}` : 'never used'}
                      </div>
                    </div>
                  }
                  control={
                    <button
                      type="button"
                      onClick={() => setKeys((prev) => prev.filter((x) => x.id !== k.id))}
                      className="shrink-0 text-[13px] text-red-500 hover:underline"
                    >
                      Revoke
                    </button>
                  }
                />
              ))
            )}
          </Card>
        </section>

        {/* Commit signing key */}
        <section>
          <h2 className="text-[13px] font-semibold text-fg">Commit signing key</h2>
          <p className="mt-0.5 mb-3 text-[12px] text-muted">
            Coding sessions use this key to sign your commits
          </p>
          <Card>
            <Row
              left={
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-fg">
                    {signingKey ?? 'No signing key added'}
                  </div>
                </div>
              }
              control={
                signingKey ? (
                  <button
                    type="button"
                    onClick={() => setSigningKey(null)}
                    className="text-[13px] text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSigningKey(`ssh-ed25519 AAAAC3Nza…${genId()}`)}
                    className="rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
                  >
                    Add key
                  </button>
                )
              }
            />
          </Card>
        </section>

        {/* Authorized applications */}
        <section>
          <h2 className="text-[13px] font-semibold text-fg">Authorized applications</h2>
          <p className="mt-0.5 mb-3 text-[12px] text-muted">
            OAuth applications you&rsquo;ve approved
          </p>
          <Card>
            {apps.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted">
                No authorized applications
              </div>
            ) : (
              apps.map((a) => (
                <Row
                  key={a.id}
                  left={
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-fg">{a.name}</div>
                      <div className="mt-0.5 text-[12px] text-muted">{a.scopes}</div>
                    </div>
                  }
                  control={
                    <button
                      type="button"
                      onClick={() => setApps((prev) => prev.filter((x) => x.id !== a.id))}
                      className="text-[13px] text-red-500 hover:underline"
                    >
                      Revoke
                    </button>
                  }
                />
              ))
            )}
          </Card>
        </section>

        {/* Password — ours, not Linear's: this clone authenticates with a
            password, so the account needs a way to rotate it. */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Password</h2>
          <ChangePassword />
        </section>

        {/* Two-factor */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Two-factor authentication</h2>
          <Card>
            <Row
              left={
                <div>
                  <div className="text-[13px] font-medium text-fg">Two-factor authentication</div>
                  <div className="mt-0.5 text-[12px] text-muted">
                    Require a code from your authenticator app when signing in.
                  </div>
                </div>
              }
              control={
                <Toggle
                  on={twoFactor}
                  onChange={(next) => setFeatureSetting('account.twoFactor', next)}
                />
              }
            />
          </Card>
        </section>
      </div>
    </div>
  )
}
