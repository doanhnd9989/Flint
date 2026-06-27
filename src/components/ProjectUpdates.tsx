import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore, useDisplayName } from '@/lib/store'
import type { ProjectHealth } from '@/lib/types'
import { Avatar } from './Avatar'
import { Markdown } from '@/lib/markdown'
import { MentionInput } from './MentionInput'
import { ProjectUpdateReactions } from './ProjectUpdateReactions'
import { timeAgo, cn } from '@/lib/utils'

export const HEALTH: Record<ProjectHealth, { label: string; color: string }> = {
  'on-track': { label: 'On track', color: 'var(--status-review)' },
  'at-risk': { label: 'At risk', color: 'var(--status-started)' },
  'off-track': { label: 'Off track', color: 'var(--priority-urgent)' },
}

const ORDER: ProjectHealth[] = ['on-track', 'at-risk', 'off-track']

export function HealthBadge({ health }: { health: ProjectHealth }) {
  const h = HEALTH[health]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `${h.color}22`, color: h.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: h.color }} />
      {h.label}
    </span>
  )
}

export function ProjectUpdates({ projectId }: { projectId: string }) {
  const store = useStore()
  const fmt = useDisplayName()
  const updates = store.projectUpdates
    .filter((u) => u.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const [health, setHealth] = useState<ProjectHealth>('on-track')
  const [body, setBody] = useState('')

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      {/* Composer */}
      <div className="rounded-xl border border-border bg-bg-secondary p-3">
        <div className="mb-2 flex items-center gap-1.5">
          {ORDER.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHealth(h)}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px]',
                health === h ? 'border-transparent' : 'border-border text-muted hover:bg-bg-hover',
              )}
              style={
                health === h
                  ? { background: `${HEALTH[h].color}22`, color: HEALTH[h].color }
                  : undefined
              }
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: HEALTH[h].color }} />
              {HEALTH[h].label}
            </button>
          ))}
        </div>
        <MentionInput
          value={body}
          onChange={setBody}
          placeholder="Write a project update…"
          minHeight={64}
          className="w-full resize-none bg-transparent text-[13px] text-fg outline-none"
        />
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            disabled={!body.trim()}
            onClick={() => {
              store.createProjectUpdate(projectId, health, body.trim())
              setBody('')
            }}
            className="rounded-md bg-accent px-3 py-1 text-[12px] text-white disabled:opacity-40 hover:bg-accent-hover"
          >
            Post update
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-5 space-y-4">
        {updates.length === 0 && (
          <div className="text-center text-[13px] text-faint">No updates yet.</div>
        )}
        {updates.map((u) => {
          const user = store.users.find((x) => x.id === u.userId)
          return (
            <div key={u.id} className="group flex gap-3">
              <Avatar user={user} size={26} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-fg">{fmt(user?.name)}</span>
                  <HealthBadge health={u.health} />
                  <span className="text-[11px] text-faint">{timeAgo(u.createdAt)}</span>
                  <div className="flex-1" />
                  <button
                    onClick={() => store.deleteProjectUpdate(u.id)}
                    className="text-faint opacity-0 hover:text-[var(--priority-urgent)] group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="mt-1 text-[13px] text-fg">
                  <Markdown source={u.body} />
                </div>
                <ProjectUpdateReactions updateId={u.id} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
