import { cn } from '@/lib/utils'

/**
 * The switch used everywhere in settings and menus.
 *
 * Every dimension is an explicit px value on purpose. Tailwind's spacing scale
 * is rem-based, so a knob positioned with `left-0.5` / `translate-x-3` grows
 * with the root font-size while a px-sized track does not — the two drift apart
 * as soon as the Font size preference leaves Default. Linear's toggle is a
 * fixed-size control; this one is too.
 *
 * The knob is anchored with an explicit `left`. Without one it falls back to
 * its static position, which inside a `<button>` is the centre of the line box
 * — that shifted every copy of this control half a track to the right.
 */
export function Toggle({
  checked,
  onChange,
  size = 'md',
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  /** `sm` is the menu/inline variant; `md` is the settings-row default. */
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  const md = size === 'md'
  // track 30×18 / knob 14, inset 2 → travel 12.  sm: 28×16 / knob 12 → 12.
  const track = md ? 'h-[18px] w-[30px]' : 'h-[16px] w-[28px]'
  const knob = md ? 'h-[14px] w-[14px]' : 'h-[12px] w-[12px]'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative shrink-0 rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        track,
        checked ? 'bg-accent' : 'bg-bg-tertiary',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'absolute left-[2px] top-[2px] rounded-full bg-white shadow-sm transition-transform',
          knob,
          checked ? 'translate-x-[12px]' : 'translate-x-0',
        )}
      />
    </button>
  )
}
