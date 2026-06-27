import { useStore } from '@/lib/store'
import { timeAgo } from '@/lib/utils'
import { HEALTH } from './ProjectUpdates'

// Small health-over-time trend from a project's updates.
export function ProjectHealthTrend({ projectId }: { projectId: string }) {
  const projectUpdates = useStore((s) => s.projectUpdates)
  const updates = projectUpdates
    .filter((u) => u.projectId === projectId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  if (updates.length < 2) return null // no trend with <2 points

  const last = updates[updates.length - 1]

  return (
    <section>
      <div className="text-[11px] font-medium uppercase text-faint mb-2">Health trend</div>
      <div className="flex items-end gap-1">
        {updates.map((u) => (
          <div
            key={u.id}
            className="h-6 w-4 rounded-sm"
            style={{ background: HEALTH[u.health].color }}
            title={`${HEALTH[u.health].label} · ${timeAgo(u.createdAt)}`}
          />
        ))}
      </div>
      <div className="text-[11px] text-faint mt-1">Latest: {HEALTH[last.health].label}</div>
    </section>
  )
}
