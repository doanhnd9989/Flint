import { Link } from 'react-router-dom'
import { Zap, Lock, Globe, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth'

/**
 * Public API reference for the Flint Task REST API. Documents the public auth
 * endpoints plus the authenticated product API (issues, projects, cycles, …).
 * Workspace administration (/admin/*) is an internal surface and is NOT listed.
 * Pure presentational so it prerenders to static HTML for SEO/GEO.
 */

type Access = 'public' | 'auth'

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  access: Access
  summary: string
}

interface Group {
  id: string
  title: string
  description: string
  endpoints: Endpoint[]
}

const BASE_URL = 'https://flinttask.com/api'
const GRAPHQL_URL = 'https://flinttask.com/graphql'

const GROUPS: Group[] = [
  {
    id: 'auth',
    title: 'Authentication',
    description:
      'Email + password authentication. Login or registration returns a JWT (valid 7 days). Send it as `Authorization: Bearer <token>` on every authenticated request.',
    endpoints: [
      { method: 'POST', path: '/auth/register', access: 'public', summary: 'Create an account (role: member) and return a JWT.' },
      { method: 'POST', path: '/auth/login', access: 'public', summary: 'Exchange email + password for a JWT.' },
      { method: 'GET', path: '/auth/me', access: 'auth', summary: 'Return the authenticated user.' },
      { method: 'POST', path: '/auth/change-password', access: 'auth', summary: 'Change your own password.' },
    ],
  },
  {
    id: 'config',
    title: 'Workspace config',
    description: 'Public, read-only workspace configuration — enabled features and branding.',
    endpoints: [
      { method: 'GET', path: '/config', access: 'public', summary: 'Enabled feature flags + workspace branding.' },
    ],
  },
  {
    id: 'issues',
    title: 'Issues',
    description:
      'The core work items. List supports filtering (teamId, stateId, assigneeId, projectId, cycleId, priority), full-text search (q) and pagination (limit ≤ 250, offset).',
    endpoints: [
      { method: 'GET', path: '/issues', access: 'auth', summary: 'List issues. Returns { issues, pageInfo: { total, limit, offset } }.' },
      { method: 'POST', path: '/issues', access: 'auth', summary: 'Create an issue (auto-assigns identifier, e.g. CLA-42).' },
      { method: 'GET', path: '/issues/:id', access: 'auth', summary: 'Get an issue by id or identifier (e.g. CLA-42).' },
      { method: 'PATCH', path: '/issues/:id', access: 'auth', summary: 'Update title, state, priority, assignee, project, cycle, labels, …' },
      { method: 'DELETE', path: '/issues/:id', access: 'auth', summary: 'Delete an issue and its comments.' },
      { method: 'GET', path: '/issues/:id/comments', access: 'auth', summary: 'List comments on an issue.' },
      { method: 'POST', path: '/issues/:id/comments', access: 'auth', summary: 'Add a comment to an issue.' },
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    description: 'Organizational containers for work, with status, health, lead and target date.',
    endpoints: [
      { method: 'GET', path: '/projects', access: 'auth', summary: 'List projects.' },
      { method: 'POST', path: '/projects', access: 'auth', summary: 'Create a project.' },
      { method: 'GET', path: '/projects/:id', access: 'auth', summary: 'Get a project.' },
      { method: 'PATCH', path: '/projects/:id', access: 'auth', summary: 'Update a project.' },
      { method: 'DELETE', path: '/projects/:id', access: 'auth', summary: 'Delete a project.' },
    ],
  },
  {
    id: 'cycles',
    title: 'Cycles',
    description: 'Time-boxed iterations belonging to a team. Filter the list by teamId.',
    endpoints: [
      { method: 'GET', path: '/cycles', access: 'auth', summary: 'List cycles (optionally ?teamId=).' },
      { method: 'POST', path: '/cycles', access: 'auth', summary: 'Create a cycle (auto-numbers within the team).' },
      { method: 'PATCH', path: '/cycles/:id', access: 'auth', summary: 'Update a cycle.' },
      { method: 'DELETE', path: '/cycles/:id', access: 'auth', summary: 'Delete a cycle.' },
    ],
  },
  {
    id: 'reference',
    title: 'Reference data',
    description: 'Read-only collections used to resolve ids on issues and projects.',
    endpoints: [
      { method: 'GET', path: '/teams', access: 'auth', summary: 'List teams.' },
      { method: 'GET', path: '/workflow-states', access: 'auth', summary: 'List workflow states (optionally ?teamId=).' },
      { method: 'GET', path: '/labels', access: 'auth', summary: 'List labels.' },
      { method: 'GET', path: '/users', access: 'auth', summary: 'List workspace members.' },
    ],
  },
]

const METHOD_COLORS: Record<Endpoint['method'], string> = {
  GET: '#4cb782',
  POST: '#4ea7fc',
  PATCH: '#f2994a',
  DELETE: '#eb5da8',
}

const EXAMPLES: Record<string, { request?: string; response: string }> = {
  'POST /issues': {
    request: `{
  "title": "Fix flaky cycle filter",
  "teamId": "t_cla",          // optional, defaults to first team
  "priority": 1,               // 0 none … 1 urgent … 4 low
  "assigneeId": "<user id>",
  "projectId": "<project id>",
  "labelIds": ["l_bug"]
}`,
    response: `201 Created
{ "issue": { "id", "identifier": "CLA-42", "title", "stateId",
             "priority", "labelIds": [...], "createdAt", … } }`,
  },
  'GET /issues': {
    response: `200 OK
{
  "issues": [ { "id", "identifier", "title", "stateId", "priority", … } ],
  "pageInfo": { "total": 142, "limit": 50, "offset": 0 }
}`,
  },
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

  // w-full, not w-screen: 100vw counts the vertical scrollbar, so a page tall
  // enough to scroll ends up ~10px wider than its own viewport and the whole
  // document picks up a horizontal scrollbar.
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-bg text-fg" style={{ ['--accent' as string]: accent }}>
      <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
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

      <main className="mx-auto flex max-w-5xl gap-10 px-6 py-12">
        {/* TOC */}
        <nav className="sticky top-24 hidden h-fit w-44 shrink-0 lg:block">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">On this page</p>
          <ul className="space-y-1 text-sm">
            {GROUPS.map((g) => (
              <li key={g.id}>
                <a href={`#${g.id}`} className="text-muted hover:text-fg">{g.title}</a>
              </li>
            ))}
            <li><a href="#graphql" className="text-muted hover:text-fg">GraphQL</a></li>
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">API Reference</h1>
          <p className="mt-3 max-w-2xl text-muted">
            {name} exposes two APIs over the same data: a GraphQL endpoint (the richer one, and the one
            most clients should use) and a REST API. The REST endpoints live under{' '}
            <code className="rounded bg-bg-tertiary px-1.5 py-0.5 text-sm">{BASE_URL}</code> and exchange JSON.
          </p>

          <section className="mt-6 rounded-xl border border-border bg-bg-secondary p-5">
            <h2 className="text-base font-semibold">Authentication</h2>
            <p className="mt-1 text-sm text-muted">
              Use a personal API key (create one under{' '}
              <Link to="/api-keys" className="text-accent hover:underline">API keys</Link>) or a token from{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">/auth/login</code>, then send it on each request:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-[13px] leading-relaxed">
{`curl ${BASE_URL}/issues?limit=20 \\
  -H "Authorization: Bearer <token>"`}
            </pre>
          </section>

          {GROUPS.map((g) => (
            <section key={g.id} id={g.id} className="mt-12 scroll-mt-24">
              <h2 className="text-xl font-semibold tracking-tight">{g.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">{g.description}</p>

              <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-bg">
                {g.endpoints.map((e) => {
                  const ex = EXAMPLES[`${e.method} ${e.path}`]
                  return (
                    <div key={e.method + e.path} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-bold text-white" style={{ background: METHOD_COLORS[e.method] }}>
                          {e.method}
                        </span>
                        <code className="text-[13px] font-medium">{e.path}</code>
                        <span className="ml-auto"><AccessBadge access={e.access} /></span>
                      </div>
                      <p className="mt-1.5 pl-[4.5rem] text-sm text-muted">{e.summary}</p>
                      {ex && (
                        <div className="mt-3 grid gap-3 pl-[4.5rem] sm:grid-cols-2">
                          {ex.request && (
                            <div>
                              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">Request</p>
                              <pre className="overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-[12px] leading-relaxed">{ex.request}</pre>
                            </div>
                          )}
                          <div className={ex.request ? '' : 'sm:col-span-2'}>
                            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">Response</p>
                            <pre className="overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-[12px] leading-relaxed">{ex.response}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}

          <section id="graphql" className="mt-12 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">GraphQL</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              The full domain is also served as a GraphQL API at{' '}
              <code className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[13px]">{GRAPHQL_URL}</code>. It is the
              richer of the two — one round trip can fetch an issue with its state, assignee, labels and
              comments — and it is schema-compatible with Linear's, so a client written against their
              reference works here by changing only the host.
            </p>

            <h3 className="mt-6 text-sm font-semibold">Authentication</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Send a personal API key as the bare <code className="rounded bg-bg-tertiary px-1 text-[13px]">Authorization</code>{' '}
              value, or a login token with a <code className="rounded bg-bg-tertiary px-1 text-[13px]">Bearer</code> prefix.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-[12px] leading-relaxed">
{`curl ${GRAPHQL_URL} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: <your API key>" \\
  --data '{"query":"{ viewer { id name email } }"}'`}
            </pre>

            <h3 className="mt-6 text-sm font-semibold">Pagination</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Every list is a connection. Read it as <code className="rounded bg-bg-tertiary px-1 text-[13px]">nodes</code>{' '}
              for the common case, or as <code className="rounded bg-bg-tertiary px-1 text-[13px]">edges</code> when you need
              cursors. Connections accept <code className="rounded bg-bg-tertiary px-1 text-[13px]">first</code>,{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">last</code>,{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">after</code>,{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">before</code>,{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">orderBy</code> (createdAt · updatedAt),{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">includeArchived</code> and{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">filter</code>. The first 50 results come back
              when no arguments are given.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-[12px] leading-relaxed">
{`query {
  issues(first: 50, orderBy: updatedAt) {
    edges { node { id identifier title } cursor }
    pageInfo { hasNextPage endCursor }
  }
}`}
            </pre>

            <h3 className="mt-6 text-sm font-semibold">Filtering</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Filters are comparator objects. Every field takes{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">eq · neq · in · nin</code>; numbers and dates add{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">lt · lte · gt · gte</code>; strings add{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">contains · containsIgnoreCase · startsWith · endsWith</code>{' '}
              and their negations; optional fields add <code className="rounded bg-bg-tertiary px-1 text-[13px]">null</code>.
              Fields combine with AND; use <code className="rounded bg-bg-tertiary px-1 text-[13px]">or</code> for
              alternatives. Relations nest, and many-to-many relations take{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">every</code> /{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">some</code>.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-[12px] leading-relaxed">
{`query {
  issues(filter: {
    state: { type: { eq: "started" } }
    assignee: { email: { eq: "you@workspace.dev" } }
    labels: { name: { eq: "Bug" } }
    or: [{ priority: { eq: 1 } }, { dueDate: { lt: "2026-09-01" } }]
  }) {
    nodes { identifier title priorityLabel state { name } }
  }
}`}
            </pre>

            <h3 className="mt-6 text-sm font-semibold">Mutations</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Each mutation returns a payload carrying{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">success</code>,{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">lastSyncId</code> and the affected record.
              Deletes return <code className="rounded bg-bg-tertiary px-1 text-[13px]">entityId</code>.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-[12px] leading-relaxed">
{`mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    lastSyncId
    success
    issue { id identifier title url branchName }
  }
}

# variables
{ "input": { "title": "Rate-limit the public API", "teamId": "<team id or key>", "priority": 2 } }`}
            </pre>
            <p className="mt-3 max-w-2xl text-sm text-muted">
              Available: <code className="rounded bg-bg-tertiary px-1 text-[13px]">issueCreate · issueUpdate · issueDelete · issueArchive · issueUnarchive · commentCreate · commentUpdate · commentDelete · projectCreate · projectUpdate · projectDelete · cycleCreate · cycleUpdate · issueLabelCreate · issueLabelUpdate · issueLabelDelete · attachmentCreate · attachmentUpdate · attachmentDelete · fileUpload</code>.
              Introspection is enabled, so codegen and GraphQL IDEs work against the endpoint directly.
            </p>

            <h3 className="mt-6 text-sm font-semibold">Uploading files</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Uploads are two steps: ask for a URL, then PUT the bytes to it. The returned{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">assetUrl</code> is what you
              reference from a description, a comment or an attachment. Files are capped at 25 MB.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-[12px] leading-relaxed">
{`mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
  fileUpload(contentType: $contentType, filename: $filename, size: $size) {
    success
    uploadFile { assetUrl uploadUrl headers { key value } }
  }
}

# then, with the headers the payload asked for:
curl -X PUT "<uploadUrl>" \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: image/png" \\
  --data-binary @screenshot.png

# and attach it to an issue:
mutation { attachmentCreate(input: {
  issueId: "<id>", title: "screenshot.png", url: "<assetUrl>"
}) { success attachment { id url } } }`}
            </pre>
            <p className="mt-3 max-w-2xl text-sm text-muted">
              A one-shot REST form exists for clients that would rather not round-trip:{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">POST /api/files</code> with the
              file as the raw body, its name in an{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">x-filename</code> header
              (percent-encoded) and its type in{' '}
              <code className="rounded bg-bg-tertiary px-1 text-[13px]">Content-Type</code>.
            </p>
          </section>

          <section id="webhooks" className="mt-12 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">Webhooks</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              A workspace admin can register endpoints (System administration → Webhooks). When an
              issue or comment changes, {name} POSTs a JSON payload to each endpoint.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-bg-tertiary p-3 text-[12px] leading-relaxed">
{`POST <your endpoint>
X-Flint-Event: issue.create
X-Flint-Signature: sha256=<hex>

{ "type": "issue", "action": "create",
  "data": { "id", "identifier", "title", … },
  "createdAt": "2026-…Z" }`}
            </pre>
            <p className="mt-2 text-sm text-muted">
              Verify authenticity with <code className="rounded bg-bg-tertiary px-1 text-[13px]">HMAC-SHA256(secret, rawBody)</code>{' '}
              and compare to the <code className="rounded bg-bg-tertiary px-1 text-[13px]">X-Flint-Signature</code> header.
            </p>
          </section>

          <footer className="mt-16 border-t border-border pt-8 text-sm text-faint">
            <p>
              Need an account? <Link to="/register" className="text-muted hover:text-fg">Sign up</Link> ·{' '}
              <Link to="/" className="text-muted hover:text-fg">Back to {name}</Link>
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
