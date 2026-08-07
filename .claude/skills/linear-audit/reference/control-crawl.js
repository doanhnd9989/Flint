// control-crawl.js — press every control on a screen, one at a time, and record
// what each one produced. Paste into `javascript_tool` against OUR dev server.
//
//   window.__ctl.list()        → every interactive control on this screen
//   window.__ctl.press(i)      → press control i, report what it opened, close it
//   window.__ctl.sweep(0, 8)   → press a range, one after another
//   window.__ctl.report()      → everything recorded so far, as JSON
//
// The point is coverage, not speed: a control that opens nothing, or opens a
// menu with fewer items than Linear's, is a finding. Run the same inventory on
// Linear (reference/linear-probe.js, via the Chrome extension) and diff.
;(() => {
  const SEL = [
    'button',
    '[role="button"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[role="switch"]',
    '[role="checkbox"]',
    '[role="combobox"]',
    'a[href]',
    'summary',
    'input:not([type="hidden"])',
    'select',
    'textarea',
  ].join(',')

  // Pressing these in our own dev workspace destroys seed data and tells us
  // nothing about parity. Read their label, don't press them.
  const DESTRUCTIVE =
    /delete|remove|archive|revoke|disable|reset|leave|cancel subscription|sign out|log out|xoá|xóa/i

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
  }

  /** What a human would call this control. */
  const name = (el) =>
    (
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.getAttribute('placeholder') ||
      el.textContent ||
      el.getAttribute('name') ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)

  /** Layered surfaces — the things a control is supposed to summon. */
  const layers = () =>
    [...document.querySelectorAll('[role="dialog"],[role="menu"],[role="listbox"],[data-portal],.fixed')]
      .filter(visible)
      .map((el) => el)

  const layerText = (el) =>
    [...el.querySelectorAll('[role="menuitem"],[role="option"],button,a')]
      .filter(visible)
      .map(name)
      .filter(Boolean)
      .slice(0, 40)

  const state = { controls: [], log: [] }

  const list = () => {
    state.controls = [...document.querySelectorAll(SEL)].filter(visible)
    return state.controls.map((el, i) => ({
      i,
      name: name(el),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || el.type || '',
      // Roughly where it sits, so the diff against Linear can compare position.
      at: (() => {
        const r = el.getBoundingClientRect()
        return `${Math.round(r.left)},${Math.round(r.top)}`
      })(),
      skip: DESTRUCTIVE.test(name(el)) || undefined,
    }))
  }

  const press = async (i) => {
    const el = state.controls[i]
    if (!el) return { i, error: 'no such control — call list() first' }
    const label = name(el)
    if (DESTRUCTIVE.test(label)) return { i, name: label, result: 'skipped (destructive)' }

    const beforeRoute = location.pathname + location.search
    const beforeLayers = new Set(layers())
    const beforeText = (document.querySelector('main') || document.body).innerText.length

    el.click()
    await new Promise((r) => setTimeout(r, 420))

    const opened = layers().filter((l) => !beforeLayers.has(l))
    const afterRoute = location.pathname + location.search
    const afterText = (document.querySelector('main') || document.body).innerText.length

    const out = { i, name: label, result: 'nothing visible changed' }
    if (afterRoute !== beforeRoute) out.result = `navigated → ${afterRoute}`
    else if (opened.length) {
      out.result = 'opened a layer'
      out.items = layerText(opened[opened.length - 1])
    } else if (Math.abs(afterText - beforeText) > 20) out.result = 'content changed in place'

    // Put the screen back the way we found it.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await new Promise((r) => setTimeout(r, 220))
    if (afterRoute !== beforeRoute) {
      history.pushState({}, '', beforeRoute)
      dispatchEvent(new PopStateEvent('popstate'))
      await new Promise((r) => setTimeout(r, 350))
      list()
    }

    state.log.push({ route: beforeRoute, ...out })
    return out
  }

  const sweep = async (from, to) => {
    const out = []
    for (let i = from; i < Math.min(to, state.controls.length); i++) out.push(await press(i))
    return out
  }

  window.__ctl = { list, press, sweep, report: () => state.log, DESTRUCTIVE }
  return `control-crawl ready — ${list().length} controls on ${location.pathname}`
})()
