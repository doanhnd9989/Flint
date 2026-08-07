// browser-sweep.js — paste into `javascript_tool` against the running dev
// server, then drive it in batches: window.__run(0,12), window.__run(12,24), …
//
// Batching matters: the tool kills a call at 30s and each route needs ~600ms to
// settle, so a single sweep of every route will always time out.
//
// Per route it reports console errors/warnings, horizontal overflow, an empty
// render, and how long the route took to paint something.
(() => {
  // Routes come from src/App.tsx (`bash scripts/audit/collect.sh` prints the
  // current list). Params use ids that exist in the seed workspace.
  window.__routes = [
    '/inbox', '/my-issues', '/my-issues/created', '/my-issues/subscribed',
    '/my-issues/activity', '/all-issues', '/views', '/projects', '/initiatives',
    '/roadmap', '/insights', '/cycles', '/pulse', '/customers', '/releases',
    '/members', '/teams', '/labels', '/documents', '/drafts', '/favorites',
    '/recent', '/reminders', '/archive', '/search', '/changelog', '/profile',
    '/settings', '/api-docs',
    '/team/CLA/overview', '/team/CLA/active', '/team/CLA/triage',
    '/team/CLA/cycles', '/team/CLA/projects', '/team/CLA/views',
    '/team/CLA/documents', '/team/CLA/members',
  ]

  window.__res = []
  window.__errs = []

  // Hook console *once* — re-pasting the harness must not stack wrappers.
  if (!window.__hooked) {
    window.__hooked = true
    for (const level of ['error', 'warn']) {
      const orig = console[level]
      console[level] = (...args) => {
        window.__errs.push({
          route: location.pathname,
          level,
          msg: String(args[0]).slice(0, 200),
        })
        orig(...args)
      }
    }
    window.addEventListener('error', (e) =>
      window.__errs.push({ route: location.pathname, level: 'uncaught', msg: String(e.message).slice(0, 200) }),
    )
    window.addEventListener('unhandledrejection', (e) =>
      window.__errs.push({ route: location.pathname, level: 'rejection', msg: String(e.reason).slice(0, 200) }),
    )
  }

  /** Elements wider than their scroll container — Linear never scrolls sideways. */
  function overflow() {
    const hits = []
    for (const el of document.querySelectorAll('*')) {
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 200) {
        hits.push(String(el.className).slice(0, 60))
      }
    }
    return hits
  }

  // React Router listens on popstate, so pushState + popstate navigates without
  // a reload — which is what keeps the collected console history intact.
  window.__step = (i) =>
    new Promise((resolve) => {
      const route = window.__routes[i]
      const before = window.__errs.length
      const t0 = performance.now()
      history.pushState({}, '', route)
      dispatchEvent(new PopStateEvent('popstate'))
      setTimeout(() => {
        const of = overflow()
        const text = (document.querySelector('main')?.innerText || '').trim()
        window.__res.push({
          route,
          ms: Math.round(performance.now() - t0),
          errors: window.__errs.slice(before).map((e) => `${e.level}: ${e.msg}`),
          overflow: of.length,
          worstOverflow: of[0] || null,
          // A route that renders under ~20 chars is almost certainly blank or
          // stuck, even when nothing threw.
          empty: text.length < 20,
        })
        resolve()
      }, 600)
    })

  window.__run = async (from, to) => {
    for (let i = from; i < Math.min(to, window.__routes.length); i++) await window.__step(i)
    return JSON.stringify(window.__res.slice(from, to))
  }

  /** Only the routes worth acting on. Call after the last batch. */
  window.__bad = () =>
    JSON.stringify(
      window.__res.filter((r) => r.errors.length || r.overflow || r.empty),
      null,
      1,
    )

  return `ready — ${window.__routes.length} routes. run: window.__run(0,12)`
})()
