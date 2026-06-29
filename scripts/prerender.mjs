// Post-build prerender: turns the public SPA routes into static HTML with real
// text + per-page <head> so crawlers (and JS-less AI crawlers) see content.
// Run after `vite build` + `vite build --ssr`. See package.json "build".
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')

const { render, listRoutes } = await import(
  pathToFileURL(join(ROOT, 'dist-ssr', 'entry-prerender.js')).href
)

const template = readFileSync(join(DIST, 'index.html'), 'utf8')
if (!template.includes('<div id="root"></div>')) {
  throw new Error('prerender: cannot find <div id="root"></div> in dist/index.html')
}

function assertSingleCanonical(html, label) {
  const n = (html.match(/rel="canonical"/g) || []).length
  if (n !== 1) throw new Error(`prerender: ${label} has ${n} canonical tags (expected 1)`)
}

// 1) Neutral SPA fallback shell (app.html) — no canonical, noindex. Every route
//    without a static file rewrites here, then the SPA boots normally.
const appHtml = template.replace(
  '</head>',
  '    <meta name="robots" content="noindex" />\n  </head>',
)
writeFileSync(join(DIST, 'app.html'), appHtml)
console.log('• dist/app.html (SPA fallback, noindex)')

// 2) Static page per public route.
let count = 0
for (const path of listRoutes()) {
  const { title, head, html, index } = render(path)
  let page = template
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${html}</div>`)

  if (index) assertSingleCanonical(page, path)

  // Root → dist/index.html; other routes → flat dist/<route>.html so nginx can
  // serve them via `try_files $uri.html` without a trailing-slash 301 redirect.
  const outFile = path === '/' ? join(DIST, 'index.html') : join(DIST, `${path.replace(/^\//, '')}.html`)
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, page)
  console.log(`• ${outFile.replace(DIST, 'dist')} (${index ? 'index' : 'noindex'})`)
  count++
}

// Root index.html is now the prerendered landing; app.html is the fallback the
// nginx rewrite rule serves for every SPA route.
console.log(`Prerendered ${count} route(s).`)
