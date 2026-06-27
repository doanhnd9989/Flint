import { Check, Palette } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ── Settings → Accent color (Linear's "brand color" workspace override) ──────
//
// Picks a single accent hue that drives every `bg-accent` / `text-accent` /
// focus-ring surface across the app. The choice is persisted in
// `preferences.accentColor` (a hex string) and injected as the `--accent` CSS
// variable by usePreferenceEffect; "Default" clears it back to the themed token.
//
// Presets mirror Linear's swatch row — a spread of saturated, theme-agnostic
// hues that read well on both light and dark backgrounds.
const PRESETS: { name: string; value: string }[] = [
  { name: 'Indigo', value: '#5e6ad2' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Green', value: '#22a06b' },
  { name: 'Amber', value: '#f5a623' },
  { name: 'Orange', value: '#f2682e' },
  { name: 'Red', value: '#e5484d' },
  { name: 'Pink', value: '#eb5ca0' },
  { name: 'Purple', value: '#8b5cf6' },
]

export function AccentColorSettings() {
  const accentColor = useStore((s) => s.preferences.accentColor)
  const setPreference = useStore((s) => s.setPreference)

  // No stored value ⇒ the app falls back to the themed `--accent` token.
  const isDefault = !accentColor

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">
        Accent color
      </h1>
      <p className="mt-1 text-[13px] text-muted">
        Override the workspace brand color. It tints buttons, links, focus rings
        and other accented surfaces across Flint.
      </p>

      <div className="mt-7 space-y-9">
        {/* ── Swatches ── */}
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-fg">
            <Palette size={13} className="text-muted" />
            Color
          </h2>
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Default — clears the override back to the theme token. */}
            <button
              type="button"
              onClick={() => setPreference('accentColor', undefined)}
              title="Default"
              aria-label="Default accent"
              aria-pressed={isDefault}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-secondary text-muted transition',
                isDefault
                  ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
                  : 'hover:border-fg/30',
              )}
            >
              {isDefault ? (
                <Check size={15} className="text-fg" />
              ) : (
                // A faint slash conveys "no override" without an extra icon import.
                <span className="text-[11px] font-medium">A</span>
              )}
            </button>

            {PRESETS.map((preset) => {
              const selected = accentColor?.toLowerCase() === preset.value.toLowerCase()
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setPreference('accentColor', preset.value)}
                  title={preset.name}
                  aria-label={preset.name}
                  aria-pressed={selected}
                  style={{ backgroundColor: preset.value }}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full transition',
                    selected
                      ? 'ring-2 ring-offset-2 ring-offset-bg'
                      : 'hover:scale-105',
                  )}
                >
                  {selected && <Check size={15} className="text-white" />}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-[12px] text-muted">
            {isDefault
              ? 'Using the default theme accent.'
              : `Custom accent applied — ${accentColor}.`}
          </p>
        </section>

        {/* ── Live preview ── */}
        <section>
          <h2 className="mb-2 text-[13px] font-semibold text-fg">Preview</h2>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-secondary p-4">
            <button
              type="button"
              className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-text"
            >
              Primary button
            </button>
            <span className="text-[13px] font-medium text-accent">
              Accented link
            </span>
            <input
              type="text"
              placeholder="Focus me"
              className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent placeholder:text-faint"
            />
            <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[12px] font-medium text-accent">
              Subtle
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
