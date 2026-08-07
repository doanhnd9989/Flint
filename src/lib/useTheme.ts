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
        // System appearance picks which sub-theme to apply (Light / Dark rows).
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
  small: 0.9,
  default: 1,
  large: 1.15,
  larger: 1.3,
  largest: 1.45,
  huge: 1.6,
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
    const scale = FONT_SCALE[fontSize] ?? 1
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
