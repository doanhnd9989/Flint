import { Link } from 'react-router-dom'
import { Zap, Lock, Globe, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth'

/**
 * Public API reference for the Flint Task API. Documents only the public-facing
 * endpoints (authentication + read-only config). Workspace administration is an
 * internal, admin-gated surface and is intentionally NOT documented here.
 * Pure presentational so it prerenders to static HTML for SEO/GEO.
 */

type Access = 'public' | 'auth'

interface Endpoint {
  method: 'GET' | 'POST'
  path: string
  access: Access
  summary: string
  request?: string
  response: string
}

interface Group {
  id: string
  title: string
  description: string
  endpoints: Endpoint[]
}

const BASE_URL = 'https://flinttask.com/api'

const GROUPS: Group[] = [
  {
    id: 'auth',
    title: 'Authentication',
    description:
      'Email + password authentication. A successful login or registration returns a JWT (valid 7 days) — send it as a Bearer token on authenticated requests.',
    endpoints: [
      {
        method: 'POST',
        path: '/auth/register',
        access: 'public',
        summary: 'Create a new account (role: member) and sign in immediately.',
        request: `{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "secret123"   // min 6 chars
}`,
        response: `201 Created
{
  "token": "eyJhbGci…",
  "user": {
    "id": "uuid",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "member",
    "status": "active"
  }
}`,
      },
      {
        method: 'POST',
        path: '/auth/login',
        access: 'public',
        summary: 'Exchange email + password for a JWT.',
        request: `{
  "email": "jane@example.com",
  "password": "secret123"
}`,
        response: `200 OK
{ "token": "eyJhbGci…", "user": { … } }

401 — invalid email or password
403 — account suspended`,
      },
      {
        method: 'GET',
        path: '/auth/me',
        access: 'auth',
        summary: 'Return the currently authenticated user.',
        response: `200 OK
{ "user": { "id", "name", "email", "role", "status" } }`,
      },
      {
        method: 'POST',
        path: '/auth/change-password',
        access: 'auth',
        summary: 'Change your own password.',
        request: `{
  "currentPassword": "secret123",
  "newPassword": "newsecret456"   // min 6 chars
}`,
        response: `200 OK
{ "ok": true }

401 — current password is incorrect`,
      },
    ],
  },
  {
    id: 'config',
    title: 'Workspace config',
    description: 'Public, read-only workspace configuration — enabled features and branding. No authentication required.',
    endpoints: [
      {
        method: 'GET',
        path: '/config',
        access: 'public',
        summary: 'Enabled feature flags + workspace branding (name, tagline, accent color).',
        response: `200 OK
{
  "workspace": { "name", "tagline", "accentColor" },
  "flags": [
    { "key": "projects", "label": "Projects", "enabled": true },
    …
  ]
}`,
      },
    ],
  },
]

const METHOD_COLORS: Record<Endpoint['method'], string> = {
  GET: '#4cb782',
  POST: '#4ea7fc',
}

function AccessBadge({ access }: { access: Access }) {
  const map = {
    public: { icon: Globe, label: 'Public', cls: 'text-green-600 bg-green-500/10' },
    auth: { icon: Lock, label: 'Bearer token', cls: 'text-blue-600 bg-blue-500/10' },
  }[access]
  const Icon = map.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${map.cls}`}>
      <Icon size={11} /> {map.label}
    </span>
  )
}

export function ApiDocs() {
  const workspace = useAuth((s) => s.workspace)
  const accent = workspace.accentColor || '#5e6ad2'
  const name = workspace.name || 'Flint Task'

  return (
    <div className="h-screen w-screen overflow-y-auto bg-bg text-fg" style={{ ['--accent' as string]: accent }}>
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ background: accent }}>
              <Zap size={16} />
            </span>
            <span>{name}</span>
          </Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-muted hover:text-fg">
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">API Reference</h1>
        <p className="mt-3 max-w-2xl text-muted">
          The {name} API lets you authenticate users and read public workspace configuration.
          All endpoints are served under{' '}
          <code className="rounded bg-bg-tertiary px-1.5 py-0.5 text-sm">{BASE_URL}</code> and exchange JSON.
        </p>

        {/* Auth primer */}
        <section className="mt-8 rounded-xl border border-border bg-bg-secondary p-5">
          <h2 className="text-base font-semibold">Authentication</h2>
          <p className="mt-1 text-sm text-muted">
            Obtain a token via <code className="rounded bg-bg-tertiary px-1 text-[13px]">/auth/login</code> or{' '}
            <code className="rounded bg-bg-tertiary px-1 text-[13px]">/auth/register</code>, then send it on each request:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-[13px] leading-relaxed">
{`curl ${BASE_URL}/auth/me \\
  -H "Authorization: Bearer <token>"`}
          </pre>
        </section>

        {/* Endpoint groups */}
        {GROUPS.map((g) => (
          <section key={g.id} className="mt-12">
            <h2 className="text-xl font-semibold tracking-tight">{g.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">{g.description}</p>

            <div className="mt-5 space-y-4">
              {g.endpoints.map((e) => (
                <article key={e.method + e.path} className="overflow-hidden rounded-xl border border-border bg-bg">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-secondary px-4 py-2.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
                      style={{ background: METHOD_COLORS[e.method] }}
                    >
                      {e.method}
                    </span>
                    <code className="text-[13px] font-medium">{e.path}</code>
                    <span className="ml-auto">
                      <AccessBadge access={e.access} />
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-muted">{e.summary}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {e.request && (
                        <div>
                          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">Request body</p>
                          <pre className="overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-[12px] leading-relaxed">{e.request}</pre>
                        </div>
                      )}
                      <div className={e.request ? '' : 'sm:col-span-2'}>
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">Response</p>
                        <pre className="overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-[12px] leading-relaxed">{e.response}</pre>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        <footer className="mt-16 border-t border-border pt-8 text-sm text-faint">
          <p>
            Need an account? <Link to="/register" className="text-muted hover:text-fg">Sign up</Link> ·{' '}
            <Link to="/" className="text-muted hover:text-fg">Back to {name}</Link>
          </p>
        </footer>
      </main>
    </div>
  )
}
