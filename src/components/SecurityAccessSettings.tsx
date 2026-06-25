import type { ReactNode } from 'react'
import { useState } from 'react'
import { Key, Monitor, Smartphone } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const genId = () => Math.random().toString(36).slice(2, 9)

/** Linear-style pill toggle switch. */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-[18px] w-[30px] rounded-full transition-colors',
        on ? 'bg-accent' : 'bg-[var(--border)]',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform',
          on ? 'translate-x-[14px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
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

type Passkey = { id: string; name: string; added: string }
type Session = { id: string; device: string; location: string; current: boolean }

/** Personal Security & access settings page. */
export function SecurityAccessSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  const [passkeys, setPasskeys] = useState<Passkey[]>([
    { id: genId(), name: 'MacBook Pro', added: 'Added May 4, 2026' },
  ])
  const [sessions, setSessions] = useState<Session[]>([
    {
      id: genId(),
      device: 'Chrome on macOS',
      location: 'San Francisco, US · Current session',
      current: true,
    },
    {
      id: genId(),
      device: 'Safari on iPhone',
      location: 'San Francisco, US · 2 hours ago',
      current: false,
    },
  ])

  const twoFactor = featureSettings['account.twoFactor'] ?? false

  const addPasskey = () =>
    setPasskeys((prev) => [...prev, { id: genId(), name: 'New device', added: 'Added just now' }])
  const removePasskey = (id: string) =>
    setPasskeys((prev) => prev.filter((p) => p.id !== id))
  const revokeSession = (id: string) =>
    setSessions((prev) => prev.filter((s) => s.id !== id))
  const signOutAll = () => setSessions((prev) => prev.filter((s) => s.current))

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Security &amp; access</h1>
      <p className="mt-1 text-[13px] text-muted">
        Manage how you sign in and which devices have access.
      </p>

      <div className="mt-7 space-y-9">
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

        {/* Passkeys */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-fg">Passkeys</h2>
            <button
              type="button"
              onClick={addPasskey}
              className="rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
            >
              Add passkey
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

        {/* Active sessions */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-fg">Active sessions</h2>
            <button
              type="button"
              onClick={signOutAll}
              className="text-[13px] text-red-500 hover:underline"
            >
              Sign out all
            </button>
          </div>
          <Card>
            {sessions.map((s) => (
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
                  s.current ? (
                    <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[12px] font-medium text-green-500">
                      This device
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => revokeSession(s.id)}
                      className="text-[13px] text-red-500 hover:underline"
                    >
                      Revoke
                    </button>
                  )
                }
              />
            ))}
          </Card>
        </section>

        {/* Password */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Password</h2>
          <Card>
            <Row
              left={
                <div>
                  <div className="text-[13px] font-medium text-fg">Password</div>
                  <div className="mt-0.5 text-[12px] text-muted">Last changed 3 months ago</div>
                </div>
              }
              control={
                <button
                  type="button"
                  className="rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
                >
                  Change password
                </button>
              }
            />
          </Card>
        </section>
      </div>
    </div>
  )
}
