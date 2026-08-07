/**
 * Places a fixed-position panel (menu, popover) against the control that opened
 * it. Linear's menus never run off the screen: they open downwards when there
 * is room, flip above the trigger when there isn't, and scroll inside
 * themselves when neither side fits. Ours used to place everything downwards
 * unconditionally, so a control near the bottom of the viewport opened a menu
 * whose last items were unreachable — worse at every font-size step above
 * Default, since the same menu grows with `--font-scale` while the viewport
 * does not.
 *
 * Written imperatively rather than as positioning state so the panel lands in
 * the right place in the same commit it mounts. Measuring needs the panel in
 * the DOM, and a second render pass to correct the position would flash.
 */

/** Distance between the trigger and the panel. */
const GAP = 4
/** Distance the panel keeps from the viewport edge. */
const EDGE = 8

export interface PlaceOptions {
  align?: 'start' | 'end'
  width: number
}

export function placePanel(
  anchor: HTMLElement,
  panel: HTMLElement,
  { align = 'start', width }: PlaceOptions,
) {
  const a = anchor.getBoundingClientRect()
  const { innerWidth: vw, innerHeight: vh } = window

  const left = align === 'end' ? a.right - width : a.left
  panel.style.left = `${Math.max(EDGE, Math.min(left, vw - width - EDGE))}px`

  // Measure unconstrained — a panel clamped the last time it opened has to be
  // able to grow back now that it may fit.
  panel.style.maxHeight = ''
  const height = panel.offsetHeight

  const below = vh - a.bottom - GAP - EDGE
  const above = a.top - GAP - EDGE

  if (height <= below) {
    panel.style.top = `${a.bottom + GAP}px`
  } else if (height <= above) {
    panel.style.top = `${a.top - GAP - height}px`
  } else {
    // Neither side fits: take the roomier one and let the panel scroll.
    const room = Math.max(below, above)
    panel.style.maxHeight = `${Math.max(room, 0)}px`
    panel.style.top = below >= above ? `${a.bottom + GAP}px` : `${EDGE}px`
  }
}
