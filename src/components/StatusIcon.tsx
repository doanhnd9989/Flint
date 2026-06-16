import type { StatusType } from '@/lib/types'

interface Props {
  type: StatusType
  color: string
  size?: number
  /** For 'started': fraction filled (0..1). Defaults to a quarter pie. */
  progress?: number
}

/** Linear-style workflow status glyphs drawn as SVG. */
export function StatusIcon({ type, color, size = 14, progress = 0.5 }: Props) {
  const r = 7
  const c = 9
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 18 18',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
  }

  if (type === 'backlog') {
    return (
      <svg {...common} aria-hidden>
        <circle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="2.5 2"
        />
      </svg>
    )
  }

  if (type === 'unstarted') {
    return (
      <svg {...common} aria-hidden>
        <circle cx={c} cy={c} r={r} stroke={color} strokeWidth={2} />
      </svg>
    )
  }

  if (type === 'started') {
    const angle = Math.max(0.05, Math.min(0.95, progress)) * 2 * Math.PI
    const innerR = 3.5
    const x = c + innerR * Math.sin(angle)
    const y = c - innerR * Math.cos(angle)
    const large = angle > Math.PI ? 1 : 0
    return (
      <svg {...common} aria-hidden>
        <circle cx={c} cy={c} r={r} stroke={color} strokeWidth={2} />
        <path
          d={`M ${c} ${c} L ${c} ${c - innerR} A ${innerR} ${innerR} 0 ${large} 1 ${x} ${y} Z`}
          fill={color}
        />
      </svg>
    )
  }

  if (type === 'completed') {
    return (
      <svg {...common} aria-hidden>
        <circle cx={c} cy={c} r={r + 1} fill={color} />
        <path
          d="M5.5 9.2l2.2 2.2 4.6-4.6"
          stroke="#fff"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  // canceled
  return (
    <svg {...common} aria-hidden>
      <circle cx={c} cy={c} r={r + 1} fill={color} />
      <path
        d="M6.3 6.3l5.4 5.4M11.7 6.3l-5.4 5.4"
        stroke="#fff"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  )
}
