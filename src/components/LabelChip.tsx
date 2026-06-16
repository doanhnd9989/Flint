import type { Label } from '@/lib/types'

export function LabelDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: size, height: size, background: color }}
    />
  )
}

export function LabelChip({ label }: { label: Label }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg px-1.5 py-0.5 text-[11px] text-muted">
      <LabelDot color={label.color} />
      {label.name}
    </span>
  )
}
