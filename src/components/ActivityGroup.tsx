import { useMemo, useState } from 'react'
import type { Activity } from '@/lib/types'
import { useStore, useDisplayName } from '@/lib/store'
import { Avatar } from './Avatar'
import { ActivityItem } from './ActivityItem'
import { ActivityDescriptionDiff } from './ActivityDescriptionDiff'
import { timeAgo } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'

/** Max gap between two activities for them to belong to the same burst. */
const BURST_MS = 2 * 60_000

/** A run of consecutive same-actor activities tightly spaced in time. */
interface Burst {
  userId: string
  items: Activity[]
}

/**
 * Wraps the issue activity feed, collapsing consecutive same-actor changes that
 * land within ~2 minutes into a single "{name} made N changes · {ago}" line —
 * Linear bundles rapid edits this way to keep the feed scannable. A burst of
 * one renders as a plain {@link ActivityItem}; multi-change bursts expand on
 * click. `description` activities additionally expose an inline diff.
 */
export function ActivityGroup({ activities }: { activities: Activity[] }) {
  // Group already-sorted activities into same-actor, time-tight bursts.
  const bursts = useMemo<Burst[]>(() => {
    const out: Burst[] = []
    for (const a of activities) {
      const last = out[out.length - 1]
      const within =
        last &&
        last.userId === a.userId &&
        new Date(a.createdAt).getTime() -
          new Date(last.items[last.items.length - 1].createdAt).getTime() <=
          BURST_MS
      if (within) last.items.push(a)
      else out.push({ userId: a.userId, items: [a] })
    }
    return out
  }, [activities])

  return (
    <>
      {bursts.map((b) =>
        b.items.length === 1 ? (
          <div key={b.items[0].id} className="space-y-1">
            <ActivityItem activity={b.items[0]} />
            {b.items[0].kind === 'description' && (
              <ActivityDescriptionDiff activity={b.items[0]} />
            )}
          </div>
        ) : (
          <BurstRow key={b.items[0].id} burst={b} />
        ),
      )}
    </>
  )
}

/** A collapsed multi-change burst that expands to its constituent activities. */
function BurstRow({ burst }: { burst: Burst }) {
  const [open, setOpen] = useState(false)
  const fmt = useDisplayName()
  const actor = useStore((s) => s.users.find((u) => u.id === burst.userId))
  const last = burst.items[burst.items.length - 1]

  return (
    <div className="space-y-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-[12px] text-muted"
      >
        <Avatar user={actor} size={18} />
        <span className="text-fg">{fmt(actor?.name)}</span>
        <span>
          made {burst.items.length} changes
        </span>
        <span className="text-faint">· {timeAgo(last.createdAt)}</span>
        {open ? (
          <ChevronDown size={12} className="text-faint" />
        ) : (
          <ChevronRight size={12} className="text-faint" />
        )}
      </button>
      {open && (
        <div className="ml-[26px] space-y-1 border-l border-border pl-3">
          {burst.items.map((a) => (
            <div key={a.id} className="space-y-1">
              <ActivityItem activity={a} />
              {a.kind === 'description' && <ActivityDescriptionDiff activity={a} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
