import { useEffect } from 'react'
import { useStore } from './store'

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

/** Applies font-size and pointer-cursor preferences to <html>. */
export function usePreferenceEffect() {
  const fontSize = useStore((s) => s.preferences.fontSize)
  const pointerCursors = useStore((s) => s.preferences.pointerCursors)
  const reduceMotion = useStore((s) => s.preferences.reduceMotion)
  const underlineLinks = useStore((s) => s.preferences.underlineLinks)
  useEffect(() => {
    const root = document.documentElement
    root.style.fontSize =
      fontSize === 'small' ? '14px' : fontSize === 'large' ? '17px' : ''
    root.classList.toggle('pointer-cursors', pointerCursors)
    root.classList.toggle('reduce-motion', !!reduceMotion)
    root.classList.toggle('underline-links', !!underlineLinks)
  }, [fontSize, pointerCursors, reduceMotion, underlineLinks])
}
