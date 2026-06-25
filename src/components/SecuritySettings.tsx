import type { ReactNode } from 'react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

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

/** A single settings row: title + description on the left, control on the right. */
function Row({
  title,
  description,
  control,
}: {
  title: string
  description?: string
  control: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div>
        <div className="text-[13px] font-medium text-fg">{title}</div>
        {description && <div className="mt-0.5 text-[12px] text-muted">{description}</div>}
      </div>
      {control}
    </div>
  )
}

/** Workspace Security (admin) settings page. */
export function SecuritySettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  const get = (key: string) => featureSettings[key] ?? false
  const toggle = (key: string) => (
    <Toggle on={get(key)} onChange={(next) => setFeatureSetting(key, next)} />
  )

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Security</h1>
      <p className="mt-1 text-[13px] text-muted">
        Manage authentication and access controls for the workspace.
      </p>

      <div className="mt-7 space-y-9">
        {/* Authentication */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Authentication</h2>
          <Card>
            <Row title="Require two-factor authentication" control={toggle('security.twoFactor')} />
            <Row title="Enforce SAML SSO" control={toggle('security.saml')} />
            <Row title="Enable SCIM provisioning" control={toggle('security.scim')} />
          </Card>
        </section>

        {/* Access */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Access</h2>
          <Card>
            <Row
              title="Allowed email domains"
              description="Anyone with these domains can join"
              control={
                <button
                  type="button"
                  className="rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
                >
                  Add domain
                </button>
              }
            />
            <Row title="Restrict to allowed domains" control={toggle('security.restrictDomains')} />
            <Row title="Allow public issue sharing" control={toggle('security.publicShare')} />
          </Card>
        </section>

        {/* Session */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Session</h2>
          <Card>
            <Row
              title="Require re-authentication for sensitive actions"
              control={toggle('security.reauth')}
            />
            <Row
              title="Sign out all other sessions"
              control={
                <button
                  type="button"
                  className="rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[13px] font-medium text-red-500 hover:bg-bg-hover"
                >
                  Sign out others
                </button>
              }
            />
          </Card>
        </section>
      </div>
    </div>
  )
}
