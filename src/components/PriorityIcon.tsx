import type { Priority } from '@/lib/types'

interface Props {
  priority: Priority
  size?: number
}

/** Linear-style priority glyph: bars for low/med/high, icon for urgent/none. */
export function PriorityIcon({ priority, size = 14 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    xmlns: 'http://www.w3.org/2000/svg',
  }
  const muted = 'var(--text-tertiary)'

  if (priority === 0) {
    // No priority — three faint dashes
    return (
      <svg {...common} fill={muted} aria-hidden>
        <rect x="1.5" y="7" width="3" height="2" rx="1" opacity="0.9" />
        <rect x="6.5" y="7" width="3" height="2" rx="1" opacity="0.9" />
        <rect x="11.5" y="7" width="3" height="2" rx="1" opacity="0.9" />
      </svg>
    )
  }

  if (priority === 1) {
    // Urgent — filled warning box
    return (
      <svg {...common} aria-hidden>
        <rect x="1" y="1" width="14" height="14" rx="3" fill="var(--priority-urgent)" />
        <rect x="7" y="3.5" width="2" height="5.5" rx="1" fill="#fff" />
        <rect x="7" y="11" width="2" height="2" rx="1" fill="#fff" />
      </svg>
    )
  }

  // High = 3 bars, Medium = 2, Low = 1
  const filled = priority === 2 ? 3 : priority === 3 ? 2 : 1
  const heights = [5, 9, 13]
  return (
    <svg {...common} aria-hidden>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2 + i * 5}
          y={15 - heights[i]}
          width="3"
          height={heights[i]}
          rx="1"
          fill={i < filled ? 'var(--text)' : muted}
          opacity={i < filled ? 1 : 0.35}
        />
      ))}
    </svg>
  )
}
