import { useEffect } from 'react'
import { useStore } from './store'
import type { Preferences } from './types'

/** Applies the persisted theme to <html>, honoring system preference. */
export function useThemeEffect() {
  const theme = useStore((s) => s.theme)
  const lightTheme = useStore((s) => s.preferences.lightTheme)
  const darkTheme = useStore((s) => s.preferences.darkTheme)
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      let dark: boolean
      if (theme === 'system') {
        // System appearance picks which palette to apply. Both default to the
        // matching scheme, so today this simply follows the OS; the mapping
        // stays because named palettes will need it again.
        const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        dark = (sysDark ? darkTheme : lightTheme) === 'dark'
      } else {
        dark = theme === 'dark'
      }
      root.classList.toggle('dark', dark)
    }
    apply()
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme, lightTheme, darkTheme])
}

/**
 * How much each "Font size" step multiplies text by. `--font-scale` drives the
 * px text utilities (see index.css) and the root font-size scales rem-based
 * spacing by the same factor, so rows grow with the type inside them.
 */
const FONT_SCALE: Record<Preferences['fontSize'], number> = {
  smaller: 0.8,
  small: 0.9,
  default: 1,
  large: 1.15,
  larger: 1.3,
}

/**
 * Steps this app used to offer above Linear's `larger`. A value persisted
 * before the list was trimmed still names one of them, so map it onto the
 * nearest surviving step rather than silently falling back to Default.
 */
const RETIRED_STEPS: Record<string, Preferences['fontSize']> = {
  largest: 'larger',
  huge: 'larger',
}

/** The scale for a persisted value, including ones no longer offered. */
function scaleFor(fontSize: string): number {
  return FONT_SCALE[fontSize as Preferences['fontSize']] ?? FONT_SCALE[RETIRED_STEPS[fontSize]] ?? 1
}

/**
 * The current font multiplier, for the few places that must size a box in JS
 * rather than CSS — a virtualized list's row height, a timeline's row pitch.
 * Anything measured in px and computed outside the stylesheet has to go through
 * this, or the text outgrows the box the scroll math reserved for it.
 */
export function useFontScale(): number {
  const fontSize = useStore((s) => s.preferences.fontSize)
  return scaleFor(fontSize)
}

/** Applies font-size and pointer-cursor preferences to <html>. */
export function usePreferenceEffect() {
  const fontSize = useStore((s) => s.preferences.fontSize)
  const pointerCursors = useStore((s) => s.preferences.pointerCursors)
  const reduceMotion = useStore((s) => s.preferences.reduceMotion)
  const underlineLinks = useStore((s) => s.preferences.underlineLinks)
  const accentColor = useStore((s) => s.preferences.accentColor)
  useEffect(() => {
    const root = document.documentElement
    // A persisted preference from an older build may name a step that no longer
    // exists — fall back rather than writing NaN into the scale.
    const scale = scaleFor(fontSize)
    root.style.setProperty('--font-scale', String(scale))
    root.style.fontSize = scale === 1 ? '' : `${(16 * scale).toFixed(2)}px`
    root.classList.toggle('pointer-cursors', pointerCursors)
    root.classList.toggle('reduce-motion', !!reduceMotion)
    root.classList.toggle('underline-links', !!underlineLinks)
    // Accent override: set --accent and derive the hover / subtle variants from
    // it (color-mix) so every accented surface stays consistent. Removing the
    // properties falls back to the themed tokens defined in index.css.
    if (accentColor) {
      root.style.setProperty('--accent', accentColor)
      root.style.setProperty(
        '--accent-hover',
        `color-mix(in srgb, ${accentColor} 88%, black)`,
      )
      root.style.setProperty(
        '--accent-subtle',
        `color-mix(in srgb, ${accentColor} 14%, transparent)`,
      )
    } else {
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-hover')
      root.style.removeProperty('--accent-subtle')
    }
  }, [fontSize, pointerCursors, reduceMotion, underlineLinks, accentColor])
}
