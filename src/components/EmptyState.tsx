import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Linear-style empty states: a centered monochrome line illustration, a muted
// title, an optional description, and an optional primary action. Matches the
// real app's "No issues assigned to you" / "Inbox zero" screens.

type Action = { label: string; onClick: () => void }

export function EmptyState({
  illustration,
  title,
  description,
  action,
  hint,
  className,
}: {
  illustration: ReactNode
  title: string
  description?: string
  action?: Action
  hint?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-full flex-1 flex-col items-center justify-center px-6 text-center',
        className,
      )}
    >
      <div className="text-faint">{illustration}</div>
      <div className="mt-5 text-[14px] font-medium text-fg">{title}</div>
      {description && (
        <p className="mt-1.5 max-w-[320px] text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover"
        >
          {action.label}
        </button>
      )}
      {hint && <div className="mt-3 text-[12px] text-faint">{hint}</div>}
    </div>
  )
}

// ── Illustrations ──────────────────────────────────────────────────────────
// Monochrome line art drawn with `currentColor` so the parent's text color (we
// render them at `text-faint`) and theme both apply. Sized ~104px like Linear's.

const SIZE = 104

/** Isometric ring with chevrons + brackets — Linear's "issues" illustration. */
export function IssuesIllustration() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 120 120" fill="none" aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* curved bracket above */}
        <path d="M40 34 Q60 24 80 34" opacity={0.6} />
        {/* curved bracket below */}
        <path d="M40 86 Q60 96 80 86" opacity={0.6} />
        {/* left / right chevrons */}
        <path d="M27 48 L18 60 L27 72" opacity={0.55} />
        <path d="M93 48 L102 60 L93 72" opacity={0.55} />
        {/* dashed orbit under the ring */}
        <ellipse cx="60" cy="68" rx="22" ry="8" strokeDasharray="3 4" opacity={0.4} />
        {/* the ring (isometric cylinder) */}
        <ellipse cx="60" cy="54" rx="22" ry="9" fill="var(--bg-secondary)" />
        <path d="M38 54 L38 60" />
        <path d="M82 54 L82 60" />
        <path d="M38 60 A22 9 0 0 0 82 60" />
      </g>
    </svg>
  )
}

/** Inbox tray — Linear's notifications empty illustration. */
export function InboxIllustration() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 120 120" fill="none" aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M30 46 L30 78 Q30 82 34 82 L86 82 Q90 82 90 78 L90 46"
          fill="var(--bg-secondary)"
        />
        <path d="M30 46 L40 34 L80 34 L90 46" />
        {/* the tray opening */}
        <path d="M30 62 L46 62 Q50 70 60 70 Q70 70 74 62 L90 62" />
      </g>
    </svg>
  )
}

/** Magnifier — search / no-results. */
export function SearchIllustration() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 120 120" fill="none" aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="54" cy="54" r="22" fill="var(--bg-secondary)" />
        <path d="M70 70 L86 86" />
        <path d="M46 54 H62" opacity={0.5} />
        <path d="M46 48 H58" opacity={0.5} />
        <path d="M46 60 H56" opacity={0.5} />
      </g>
    </svg>
  )
}

/** Stacked cards — projects / views illustration. */
export function StackIllustration() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 120 120" fill="none" aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="36" y="40" width="48" height="14" rx="3" opacity={0.45} />
        <rect x="32" y="56" width="56" height="14" rx="3" opacity={0.7} />
        <rect x="36" y="72" width="48" height="14" rx="3" fill="var(--bg-secondary)" />
      </g>
    </svg>
  )
}

/** Three stacked "project" pills with a chevron + dots — Linear's initiatives art. */
export function InitiativeIllustration() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 120 120" fill="none" aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {[40, 56, 72].map((y, idx) => (
          <g key={y} opacity={idx === 1 ? 1 : 0.55}>
            <rect
              x={idx === 1 ? 30 : 36}
              y={y}
              width={idx === 1 ? 54 : 44}
              height="14"
              rx="4"
              fill="var(--bg-secondary)"
            />
            {/* leading chevron glyph */}
            <path
              d={`M${(idx === 1 ? 30 : 36) + 8} ${y + 4} l4 3 l-4 3`}
              opacity={0.8}
            />
            {/* trailing "..." dots */}
            <circle cx={(idx === 1 ? 84 : 80) - 12} cy={y + 7} r="1" fill="currentColor" />
            <circle cx={(idx === 1 ? 84 : 80) - 7} cy={y + 7} r="1" fill="currentColor" />
          </g>
        ))}
      </g>
    </svg>
  )
}

/** Cycle ring — cycles illustration. */
export function CycleIllustration() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 120 120" fill="none" aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M60 32 A28 28 0 1 1 35 47" />
        <path d="M60 24 L60 40 L73 40" opacity={0.6} />
        <circle cx="60" cy="60" r="6" fill="var(--bg-secondary)" opacity={0.6} />
      </g>
    </svg>
  )
}

/** Checkmark in a circle — triage / all-caught-up illustration. */
export function CheckIllustration() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 120 120" fill="none" aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="60" cy="60" r="26" fill="var(--bg-secondary)" />
        <path d="M48 60 L56 68 L73 51" />
      </g>
    </svg>
  )
}
