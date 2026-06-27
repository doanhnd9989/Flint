import { Pause, Play } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// Pause / Resume control for a cycle (Linear-style soft-delete: a paused cycle
// is set aside without losing its issues). Renders a small icon button and,
// when paused, a muted "Paused" badge so the cycle header reads as inactive.
// Toggles Cycle.pausedAt via the pauseCycle / resumeCycle store actions.
export function CyclePauseButton({ cycleId }: { cycleId: string }) {
  const cycle = useStore((s) => s.cycles.find((c) => c.id === cycleId))
  const pauseCycle = useStore((s) => s.pauseCycle)
  const resumeCycle = useStore((s) => s.resumeCycle)

  if (!cycle) return null
  const paused = cycle.pausedAt != null

  return (
    <div className="flex items-center gap-2">
      {paused && (
        <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-[11px] font-medium text-faint">
          Paused
        </span>
      )}
      <button
        onClick={() => (paused ? resumeCycle(cycleId) : pauseCycle(cycleId))}
        title={paused ? 'Resume cycle' : 'Pause cycle'}
        className={cn(
          'flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px]',
          paused
            ? 'bg-bg-secondary text-fg hover:bg-bg-hover'
            : 'bg-bg-secondary text-muted hover:bg-bg-hover hover:text-fg',
        )}
      >
        {paused ? <Play size={13} /> : <Pause size={13} />}
        {paused ? 'Resume' : 'Pause'}
      </button>
    </div>
  )
}
