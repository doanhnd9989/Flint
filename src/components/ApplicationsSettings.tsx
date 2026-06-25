import { useState } from 'react'
import { AppWindow } from 'lucide-react'

type AuthorizedApp = {
  id: string
  name: string
  scopes: string
  authorized: string
}

const genId = () => Math.random().toString(36).slice(2, 9)

const SEED_APPS: AuthorizedApp[] = [
  { id: genId(), name: 'Raycast', scopes: 'Read, Write issues', authorized: 'Authorized Jun 2, 2026' },
  { id: genId(), name: 'Figma', scopes: 'Read issues', authorized: 'Authorized May 18, 2026' },
  { id: genId(), name: 'Vercel', scopes: 'Read, Write, Admin', authorized: 'Authorized Apr 30, 2026' },
  { id: genId(), name: 'Sentry', scopes: 'Read issues, Create comments', authorized: 'Authorized Mar 12, 2026' },
]

export function ApplicationsSettings() {
  const [apps, setApps] = useState<AuthorizedApp[]>(SEED_APPS)

  const revoke = (id: string) => setApps((prev) => prev.filter((a) => a.id !== id))

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Applications</h1>
      <p className="mt-1 text-[13px] text-muted">Third-party applications authorized to access your workspace.</p>

      <div className="mt-7 space-y-9">
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Authorized applications</h2>
          <div className="divide-y divide-border rounded-xl border border-border">
            {apps.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted">No applications authorized</div>
            ) : (
              apps.map((app) => (
                <div key={app.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-secondary">
                      <AppWindow size={15} className="text-muted" />
                    </div>
                    <div className="leading-tight">
                      <div className="text-[13px] font-medium text-fg">{app.name}</div>
                      <div className="mt-0.5 text-[12px] text-muted">
                        {app.scopes} · {app.authorized}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => revoke(app.id)}
                    className="text-[13px] text-red-500 hover:underline"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">OAuth applications</h2>
          <p className="text-[13px] text-muted">Build your own integration with the Flint API.</p>
          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              className="rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
            >
              Create new application
            </button>
            <a href="#" className="text-[13px] text-accent hover:underline">
              View API docs →
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
