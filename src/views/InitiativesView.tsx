import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useStore, useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Avatar } from '@/components/Avatar'
import { EmptyState, InitiativeIllustration } from '@/components/EmptyState'
import { initiativeProgress } from '@/lib/selectors'
import { INITIATIVE_STATUS } from '@/lib/constants'
import type { InitiativeStatus } from '@/lib/types'
import { formatDate, cn } from '@/lib/utils'

type Tab = 'active' | 'planned' | 'completed'

const TABS: { id: Tab; label: string; match: InitiativeStatus[] }[] = [
  { id: 'active', label: 'Active', match: ['active'] },
  { id: 'planned', label: 'Planned', match: ['planned', 'backlog'] },
  { id: 'completed', label: 'Completed', match: ['completed'] },
]

/** Small colored ring matching the initiative's lifecycle status. */
function StatusRing({ status }: { status: InitiativeStatus }) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border-2"
      style={{ borderColor: INITIATIVE_STATUS[status].color }}
    />
  )
}

export function InitiativesView() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const { initiatives, projects, issues, users } = useStoreShallow((s) => ({
    initiatives: s.initiatives,
    projects: s.projects,
    issues: s.issues,
    users: s.users,
  }))
  const data = useStore()
  const setCreateInitiativeOpen = useStore((s) => s.setCreateInitiativeOpen)

  const activeTab = TABS.find((t) => t.id === tab)!
  const shown = initiatives
    .filter((i) => activeTab.match.includes(i.status))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Initiatives"
        right={
          <button
            type="button"
            title="New initiative"
            onClick={() => setCreateInitiativeOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg"
          >
            <Plus size={16} />
          </button>
        }
      />

      {/* Lifecycle tabs */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors',
              tab === t.id
                ? 'bg-bg-tertiary text-fg'
                : 'text-muted hover:text-fg',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <EmptyState
            illustration={<InitiativeIllustration />}
            title="Initiatives"
            description="Initiatives are larger, strategic product efforts that set the direction of your company. They are comprised of all projects that align with the goals of the initiative and allow you to monitor their progress at scale."
            action={{
              label: 'Create new initiative',
              onClick: () => setCreateInitiativeOpen(true),
            }}
          />
        ) : (
          <div>
            {shown.map((i) => {
              const prog = initiativeProgress(i.id, projects, issues, data)
              const owner = users.find((u) => u.id === i.ownerId)
              return (
                <button
                  key={i.id}
                  onClick={() => navigate(`/initiative/${i.id}`)}
                  className="flex w-full items-center gap-3 border-b border-border px-5 py-3 text-left hover:bg-bg-hover"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[15px]"
                    style={{ background: `${i.color}20` }}
                  >
                    {i.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium text-fg">
                        {i.name}
                      </span>
                      <StatusRing status={i.status} />
                      <span className="text-[12px] text-faint">
                        {INITIATIVE_STATUS[i.status].label}
                      </span>
                    </div>
                    {i.description && (
                      <p className="mt-0.5 truncate text-[12px] text-muted">
                        {i.description}
                      </p>
                    )}
                  </div>
                  <span className="hidden text-[12px] text-muted sm:block">
                    {prog.projectCount} project{prog.projectCount === 1 ? '' : 's'}
                  </span>
                  {/* progress bar + percent */}
                  <div className="flex w-32 shrink-0 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${prog.percent}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[11px] text-faint">
                      {prog.percent}%
                    </span>
                  </div>
                  {i.targetDate && (
                    <span className="hidden w-20 shrink-0 text-right text-[12px] text-muted md:block">
                      {formatDate(i.targetDate)}
                    </span>
                  )}
                  <Avatar user={owner} size={20} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
