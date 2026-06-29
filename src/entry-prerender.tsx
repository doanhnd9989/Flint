// Server entry used only at build time to prerender the public pages to static
// HTML (SEO/GEO). Built via `vite build --ssr` and driven by scripts/prerender.mjs.
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import type { ReactElement } from 'react'
import { Landing } from './views/Landing'
import { ApiDocs } from './views/ApiDocs'
import { useAuth } from './lib/auth'

export const SITE = 'https://flinttask.com'
const WORKSPACE = {
  name: 'Flint Task',
  tagline: 'The issue tracker built for speed.',
  accentColor: '#5e6ad2',
}
// All features on by default in the public/marketing render.
const FLAG_KEYS = [
  'initiatives', 'projects', 'cycles', 'roadmap', 'insights', 'customers',
  'releases', 'documents', 'pulse', 'changelog', 'members', 'labels', 'views',
]
const FLAGS = Object.fromEntries(FLAG_KEYS.map((k) => [k, true]))

interface RouteDef {
  element: ReactElement
  title: string
  description: string
  /** Extra JSON-LD objects for this page. */
  jsonld: object[]
  index: boolean
}

const ORG = {
  '@type': 'Organization',
  '@id': `${SITE}/#org`,
  name: WORKSPACE.name,
  url: `${SITE}/`,
  description: 'Keyboard-first issue tracker and project-management platform.',
}
const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  name: WORKSPACE.name,
  url: `${SITE}/`,
  publisher: { '@id': `${SITE}/#org` },
}

const ROUTES: Record<string, RouteDef> = {
  '/': {
    element: <Landing />,
    title: 'Flint Task — The issue tracker built for speed',
    description:
      'Flint Task is a keyboard-first issue tracker and project-management platform. Plan cycles, track projects, and ship faster.',
    index: true,
    jsonld: [
      ORG,
      WEBSITE,
      {
        '@type': 'SoftwareApplication',
        name: WORKSPACE.name,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: `${SITE}/`,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description:
          'Keyboard-first issue tracker with projects, cycles, initiatives, insights and a fast command menu.',
      },
    ],
  },
  '/api-docs': {
    element: <ApiDocs />,
    title: 'API Reference — Flint Task',
    description:
      'REST API reference for Flint Task: authentication (login, register, JWT) and workspace administration (users, feature flags, config).',
    index: true,
    jsonld: [
      ORG,
      {
        '@type': 'TechArticle',
        headline: 'Flint Task API Reference',
        description:
          'REST API for authenticating users and administering a Flint Task workspace.',
        url: `${SITE}/api-docs`,
        author: { '@id': `${SITE}/#org` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'API Reference', item: `${SITE}/api-docs` },
        ],
      },
    ],
  },
}

export function listRoutes(): string[] {
  return Object.keys(ROUTES)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildHead(path: string, r: RouteDef): string {
  const canonical = `${SITE}${path === '/' ? '/' : path}`
  const image = `${SITE}/favicon.svg`
  const graph = { '@context': 'https://schema.org', '@graph': r.jsonld }
  const tags = [
    `<meta name="description" content="${escapeHtml(r.description)}" />`,
    r.index
      ? `<meta name="robots" content="index,follow" />`
      : `<meta name="robots" content="noindex,follow" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(WORKSPACE.name)}" />`,
    `<meta property="og:title" content="${escapeHtml(r.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(r.description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(r.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(r.description)}" />`,
    `<script type="application/ld+json">${JSON.stringify(graph)}</script>`,
  ]
  return tags.join('\n    ')
}

export function render(path: string): { title: string; head: string; html: string; index: boolean } {
  const r = ROUTES[path]
  if (!r) throw new Error(`No prerender route for ${path}`)
  // Seed the auth store so the public render shows the right branding/flags
  // without a backend (no token → logged-out marketing view).
  useAuth.setState({ workspace: WORKSPACE, flags: FLAGS, ready: true, user: null, token: null })
  const html = renderToString(<StaticRouter location={path}>{r.element}</StaticRouter>)
  return { title: r.title, head: buildHead(path, r), html, index: r.index }
}
