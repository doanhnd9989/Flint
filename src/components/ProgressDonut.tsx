/** Tiny progress donut (Linear shows these next to issues with sub-issues). */
export function ProgressDonut({
  percent,
  size = 13,
  color = 'var(--accent)',
}: {
  percent: number
  size?: number
  color?: string
}) {
  const r = (size - 3) / 2
  const c = size / 2
  const circ = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${c} ${c})`}
      />
    </svg>
  )
}
