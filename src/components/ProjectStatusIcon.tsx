import type { ProjectStatus } from '@/lib/types'
import { PROJECT_STATUS } from '@/lib/constants'

/**
 * Linear's project status glyphs — an outer circle with a progress wedge:
 * Backlog (dashed), Planned (empty outline), In Progress (half wedge),
 * Paused (pause bars), Completed (filled + check), Canceled (filled + ✕).
 */
export function ProjectStatusIcon({
  status,
  size = 14,
}: {
  status: ProjectStatus
  size?: number
}) {
  const color = PROJECT_STATUS[status].color
  const c = size / 2
  const r = (size - 3) / 2
  // Fraction of the ring filled for the in-flight wedge.
  const wedge = status === 'started' ? 0.5 : 0

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden
    >
      {status === 'backlog' ? (
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
      ) : status === 'completed' || status === 'canceled' ? (
        <>
          <circle cx={c} cy={c} r={r + 0.75} fill={color} />
          {status === 'completed' ? (
            <path
              d={`M${c - r * 0.55} ${c} L${c - r * 0.1} ${c + r * 0.45} L${c + r * 0.65} ${c - r * 0.45}`}
              fill="none"
              stroke="var(--bg)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <path
              d={`M${c - r * 0.45} ${c - r * 0.45} L${c + r * 0.45} ${c + r * 0.45} M${c + r * 0.45} ${c - r * 0.45} L${c - r * 0.45} ${c + r * 0.45}`}
              stroke="var(--bg)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}
        </>
      ) : (
        <>
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
          />
          {status === 'paused' ? (
            <>
              <rect x={c - r * 0.5} y={c - r * 0.45} width={r * 0.3} height={r * 0.9} fill={color} />
              <rect x={c + r * 0.2} y={c - r * 0.45} width={r * 0.3} height={r * 0.9} fill={color} />
            </>
          ) : wedge > 0 ? (
            <circle
              cx={c}
              cy={c}
              r={r / 2}
              fill="none"
              stroke={color}
              strokeWidth={r}
              strokeDasharray={`${wedge * (Math.PI * r)} ${Math.PI * r}`}
              transform={`rotate(-90 ${c} ${c})`}
            />
          ) : null}
        </>
      )}
    </svg>
  )
}
