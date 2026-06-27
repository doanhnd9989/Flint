import { useStore } from '@/lib/store'
import type { Customer } from '@/lib/types'

// Tier order + labels (high → low) and their bar/legend colors.
const TIERS = [
  ['enterprise', 'Enterprise'],
  ['business', 'Business'],
  ['startup', 'Startup'],
  ['free', 'Free'],
] as const

const COLOR: Record<Customer['tier'], string> = {
  enterprise: 'var(--accent)',
  business: 'var(--status-started)',
  startup: 'var(--status-review)',
  free: 'var(--border)',
}

// Compact currency, e.g. $120k.
const k = (n: number) => `$${(n / 1000).toFixed(0)}k`

export function CustomerTierArrBreakdown() {
  const customers = useStore((s) => s.customers)

  const byTier = TIERS.map(([tier, label]) => ({
    tier,
    label,
    arr: customers.filter((c) => c.tier === tier).reduce((s, c) => s + (c.arr ?? 0), 0),
  }))
  const total = byTier.reduce((s, t) => s + t.arr, 0)
  if (total === 0) return null

  const segments = byTier.filter((t) => t.arr > 0)

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase text-faint">ARR by tier</span>
        <span className="text-[11px] font-medium text-muted">{k(total)}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full">
        {segments.map((t) => (
          <span
            key={t.tier}
            style={{ flexGrow: t.arr, background: COLOR[t.tier] }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        {segments.map((t) => (
          <span key={t.tier} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COLOR[t.tier] }} />
            {t.label}
            <span className="text-faint">{k(t.arr)}</span>
          </span>
        ))}
      </div>
    </section>
  )
}
