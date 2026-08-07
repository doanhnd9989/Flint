// linear-probe.js — the same control inventory, run against REAL Linear through
// the Chrome extension (`mcp__claude-in-chrome__javascript_tool`) so the two
// lists diff line for line.
//
//   window.__lin.list()   → every interactive control on Linear's current screen
//   window.__lin.open()   → whatever menu/dialog is currently on top, itemised
//
// READ-ONLY. This file deliberately has no click function. On Linear you may
// open a menu (click the trigger, read it, press Escape) and nothing else:
// never choose an item, never submit, never confirm, never type into a field.
// The workspace belongs to the user and this is their real data.
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
    'input:not([type="hidden"])',
    'select',
    'textarea',
  ].join(',')

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
  }

  const name = (el) =>
    (
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.getAttribute('placeholder') ||
      el.textContent ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)

  window.__lin = {
    list: () =>
      [...document.querySelectorAll(SEL)].filter(visible).map((el, i) => ({
        i,
        name: name(el),
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || el.type || '',
        at: (() => {
          const r = el.getBoundingClientRect()
          return `${Math.round(r.left)},${Math.round(r.top)}`
        })(),
        // Linear puts its shortcut on the row; that's part of parity too.
        hint: (el.querySelector('kbd')?.textContent || '').trim() || undefined,
      })),

    open: () => {
      const top = [...document.querySelectorAll('[role="dialog"],[role="menu"],[role="listbox"]')]
        .filter(visible)
        .pop()
      if (!top) return null
      return {
        role: top.getAttribute('role'),
        items: [...top.querySelectorAll('[role="menuitem"],[role="option"],button,a')]
          .filter(visible)
          .map((el) => ({ label: name(el), hint: (el.querySelector('kbd')?.textContent || '').trim() || undefined }))
          .filter((x) => x.label)
          .slice(0, 60),
      }
    },
  }

  return `linear-probe ready — ${window.__lin.list().length} controls on ${location.pathname}`
})()
