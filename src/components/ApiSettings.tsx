import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Blocks, MoreHorizontal, Plus, Webhook as WebhookIcon } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Avatar } from './Avatar'
import { Popover } from './ui/Popover'
import { SelectMenu } from './ui/SelectMenu'

// Everything on this screen is session-local (component useState): the workspace
// API surface is served by the Node API, but OAuth apps and webhook registrations
// have no store slice yet, so nothing here is persisted.
//
// Structure follows Linear's Settings → API exactly:
//   OAuth applications → Webhooks → Member API keys
// Personal keys are deliberately NOT here — Linear keeps those on
// Settings → Security & access, and links across to them from this page.

type OAuthApp = { id: string; name: string; updated: string }

type Webhook = { id: string; name: string; url: string; events: string[]; active: boolean }

/**
 * A key belonging to some member of the workspace. `permissions` of `null` is
 * Linear's "full access"; a number renders as "N permissions".
 */
type MemberKey = {
  id: string
  name: string
  userId: string
  permissions: number | null
  allTeams: boolean
  created: string
  lastUsed: string | null
  active: boolean
}

const WEBHOOK_EVENTS = ['Issues', 'Comments', 'Projects', 'Cycles', 'Labels']

// Component-local id helper (NOT the store) — fine to use Math.random here.
const genId = () => Math.random().toString(36).slice(2, 10)

const SEED_APPS: OAuthApp[] = [
  { id: genId(), name: 'Deploy bot', updated: 'Updated Jul 1, 2026' },
  { id: genId(), name: 'Standup Agent', updated: 'Updated Jun 26, 2026' },
  { id: genId(), name: 'UAT Reporter', updated: 'Updated Apr 3, 2026' },
]

const SEED_WEBHOOKS: Webhook[] = [
  {
    id: genId(),
    name: 'Pipeline Notifier',
    url: 'https://example.com/webhook/pipeline-status',
    events: ['Issues', 'Comments'],
    active: true,
  },
]

const SEED_KEYS: MemberKey[] = [
  { id: genId(), name: 'Production deploy', userId: '', permissions: null, allTeams: true, created: 'created 2 months ago', lastUsed: 'Aug 7, 2026', active: true },
  { id: genId(), name: 'qa-ready-to-test', userId: '', permissions: 1, allTeams: false, created: 'created 18 days ago', lastUsed: 'Aug 8, 2026', active: true },
  { id: genId(), name: 'Local development', userId: '', permissions: 2, allTeams: false, created: 'created 4 months ago', lastUsed: null, active: true },
  { id: genId(), name: 'KPI Dashboard', userId: '', permissions: null, allTeams: true, created: 'created 3 months ago', lastUsed: 'Aug 7, 2026', active: true },
  { id: genId(), name: 'PMACCESS', userId: '', permissions: null, allTeams: true, created: 'created 3 months ago', lastUsed: 'May 6, 2026', active: false },
]

const rowCls =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover'

/** Section heading + description + docs link, with the action button on the right. */
function SectionHead({
  title,
  description,
  docsHref,
  action,
}: {
  title: string
  description: string
  docsHref: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        <p className="mt-0.5 text-[13px] text-muted">
          {description}{' '}
          <Link to={docsHref} className="text-accent hover:underline">
            Docs
          </Link>
        </p>
      </div>
      {action}
    </div>
  )
}

/** Linear labels each list with its own size before the rows begin. */
function Count({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[12px] text-muted">{children}</div>
}

/** The `⋯` overflow every row on this screen carries. */
function RowMenu({ items }: { items: { label: string; onClick: () => void }[] }) {
  return (
    <Popover
      label="Open menu"
      align="end"
      width={200}
      trigger={
        <span className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg">
          <MoreHorizontal size={15} />
        </span>
      }
    >
      {(close) => (
        <div role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                it.onClick()
                close()
              }}
              className={rowCls}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}

export function ApiSettings() {
  const users = useStore((s) => s.users)
  const workspaceName = useStore((s) => s.workspaceName)

  const [apps, setApps] = useState<OAuthApp[]>(SEED_APPS)
  const [creatingApp, setCreatingApp] = useState(false)
  const [appName, setAppName] = useState('')

  const [webhooks, setWebhooks] = useState<Webhook[]>(SEED_WEBHOOKS)
  const [creatingHook, setCreatingHook] = useState(false)
  const [hookUrl, setHookUrl] = useState('')
  const [hookEvents, setHookEvents] = useState<string[]>([])

  // Seeded keys carry no author until the workspace is loaded; spread the real
  // members across them so every row has a face, the way Linear's does.
  const [keys, setKeys] = useState<MemberKey[]>(SEED_KEYS)
  const [creation, setCreation] = useState<'all' | 'admins'>('all')

  const owner = (i: number) => users[i % Math.max(users.length, 1)]
  const active = keys.filter((k) => k.active)
  const inactive = keys.filter((k) => !k.active)

  function handleCreateApp() {
    const name = appName.trim()
    if (!name) return
    setApps((prev) => [{ id: genId(), name, updated: 'Updated just now' }, ...prev])
    setAppName('')
    setCreatingApp(false)
  }

  function handleCreateHook() {
    const url = hookUrl.trim()
    if (!url) return
    setWebhooks((prev) => [
      {
        id: genId(),
        name: 'New webhook',
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

  /** Linear's "Download manifest" hands back the app's JSON descriptor. */
  function downloadManifest(app: OAuthApp) {
    const blob = new Blob([JSON.stringify({ name: app.name, id: app.id, scopes: ['read', 'write'] }, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${app.name.toLowerCase().replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">API</h1>
      <p className="mt-1 text-[13px] text-muted">
        {workspaceName}&rsquo;s GraphQL API provides a programmable interface to your data. Use our
        API to build public or private apps, workflows, and integrations for {workspaceName}.{' '}
        <Link to="/api-docs" className="text-accent hover:underline">
          Docs
        </Link>
      </p>

      <div className="mt-7 space-y-9">
        {/* OAuth applications */}
        <section>
          <SectionHead
            title="OAuth applications"
            description="Manage your organization's OAuth applications."
            docsHref="/api-docs#graphql"
            action={
              <button
                type="button"
                onClick={() => setCreatingApp((v) => !v)}
                className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
              >
                <Plus size={14} />
                New OAuth application
              </button>
            }
          />

          {creatingApp && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-bg-secondary p-3">
              <input
                autoFocus
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateApp()}
                placeholder="Application name"
                className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleCreateApp}
                className="rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-accent-text hover:bg-accent-hover"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setCreatingApp(false)}
                className="rounded-md border border-border px-2.5 py-1.5 text-[13px] text-fg hover:bg-bg-hover"
              >
                Cancel
              </button>
            </div>
          )}

          <Count>
            {apps.length} OAuth application{apps.length === 1 ? '' : 's'}
          </Count>
          <div className="divide-y divide-border rounded-xl border border-border">
            {apps.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted">
                No OAuth applications yet
              </div>
            ) : (
              apps.map((app) => (
                <div key={app.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-tertiary text-muted">
                      <Blocks size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-fg">{app.name}</div>
                      <div className="mt-0.5 text-[12px] text-muted">{app.updated}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      to={`/settings?page=api&application=${app.id}`}
                      className="rounded-md border border-border px-2 py-1 text-[12px] text-fg hover:bg-bg-hover"
                    >
                      Edit settings
                    </Link>
                    <RowMenu
                      items={[
                        { label: 'Edit application', onClick: () => setCreatingApp(true) },
                        { label: 'Download manifest', onClick: () => downloadManifest(app) },
                        {
                          label: 'Delete application',
                          onClick: () => setApps((p) => p.filter((x) => x.id !== app.id)),
                        },
                        { label: 'View in workspace', onClick: () => window.open('/settings?page=applications', '_self') },
                      ]}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Webhooks */}
        <section>
          <SectionHead
            title="Webhooks"
            description="Webhooks allow you to receive HTTP requests when an entity is created, updated, or deleted."
            docsHref="/api-docs#webhooks"
            action={
              <button
                type="button"
                onClick={() => setCreatingHook((v) => !v)}
                className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
              >
                <Plus size={14} />
                New webhook
              </button>
            }
          />

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
                      onChange={() =>
                        setHookEvents((prev) =>
                          prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
                        )
                      }
                      className="accent-accent"
                    />
                    {ev}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateHook}
                  className="rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-accent-text hover:bg-accent-hover"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingHook(false)}
                  className="rounded-md border border-border px-2.5 py-1.5 text-[13px] text-fg hover:bg-bg-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <Count>
            {webhooks.length} webhook{webhooks.length === 1 ? '' : 's'}
          </Count>
          <div className="divide-y divide-border rounded-xl border border-border">
            {webhooks.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted">No webhooks yet</div>
            ) : (
              webhooks.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-tertiary text-muted">
                      <WebhookIcon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-fg">{w.name}</span>
                        {!w.active && (
                          <span className="rounded-full bg-bg-hover px-1.5 py-0.5 text-[11px] text-muted">
                            Disabled
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[12px] text-muted">{w.url}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      to={`/settings?page=api&webhook=${w.id}`}
                      className="rounded-md border border-border px-2 py-1 text-[12px] text-fg hover:bg-bg-hover"
                    >
                      Edit settings
                    </Link>
                    <RowMenu
                      items={[
                        {
                          label: w.active ? 'Disable webhook' : 'Enable webhook',
                          onClick: () =>
                            setWebhooks((p) =>
                              p.map((x) => (x.id === w.id ? { ...x, active: !x.active } : x)),
                            ),
                        },
                        { label: 'Edit webhook', onClick: () => setCreatingHook(true) },
                        {
                          label: 'Delete webhook',
                          onClick: () => setWebhooks((p) => p.filter((x) => x.id !== w.id)),
                        },
                      ]}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Member API keys */}
        <section>
          <h2 className="text-[15px] font-semibold text-fg">Member API keys</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Members of your workspace can create API keys to interact with the {workspaceName} API
            on their behalf. View your personal API keys from your{' '}
            <Link to="/settings?page=security-access" className="text-accent hover:underline">
              security &amp; access settings
            </Link>
            .
          </p>

          <div className="mt-3 rounded-xl border border-border">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-fg">API key creation</div>
                <div className="mt-0.5 text-[12px] text-muted">
                  Who can create API keys to interact with the {workspaceName} API on their behalf
                </div>
              </div>
              <SelectMenu
                align="end"
                width={200}
                options={[
                  { id: 'all', label: 'All members', selected: creation === 'all' },
                  { id: 'admins', label: 'Only admins', selected: creation === 'admins' },
                ]}
                onSelect={(id) => setCreation(id as 'all' | 'admins')}
                trigger={
                  <span className="rounded-md border border-border px-2.5 py-1.5 text-[13px] text-fg hover:bg-bg-hover">
                    {creation === 'all' ? 'All members' : 'Only admins'}
                  </span>
                }
              />
            </div>
          </div>

          {[
            { label: 'Active', rows: active },
            { label: 'Inactive', rows: inactive },
          ]
            .filter((g) => g.rows.length > 0)
            .map((group) => (
              <div key={group.label} className="mt-5">
                <Count>
                  {group.label} · {group.rows.length} API key{group.rows.length === 1 ? '' : 's'}
                </Count>
                <div className="divide-y divide-border rounded-xl border border-border">
                  {group.rows.map((k, i) => {
                    const user = owner(i + (group.label === 'Inactive' ? active.length : 0))
                    return (
                      <div
                        key={k.id}
                        className={cn(
                          'flex items-center justify-between gap-4 px-4 py-3.5',
                          !k.active && 'opacity-60',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar user={user} size={28} />
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
                            <div className="mt-0.5 truncate text-[12px] text-muted">
                              {user?.name ?? 'Unknown'} {k.created} ·{' '}
                              {k.lastUsed ? `last used on ${k.lastUsed}` : 'never used'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setKeys((p) => p.filter((x) => x.id !== k.id))}
                          className="shrink-0 text-[12px] text-red-500 hover:underline"
                        >
                          Revoke
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </section>
      </div>
    </div>
  )
}
