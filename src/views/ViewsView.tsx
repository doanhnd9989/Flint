import { useNavigate } from 'react-router-dom'
import { useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { Layers } from 'lucide-react'

export function ViewsView() {
  const navigate = useNavigate()
  const { savedViews, teams } = useStoreShallow((s) => ({
    savedViews: s.savedViews,
    teams: s.teams,
  }))
  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Views" />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {savedViews.map((v) => (
            <button
              key={v.id}
              onClick={() => navigate(`/team/${teams[0].key}/active`)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-bg-secondary px-3 py-2.5 text-left hover:border-border-strong"
            >
              <Layers size={16} className="text-faint" />
              <div className="flex-1">
                <div className="text-[13px] font-medium text-fg">{v.name}</div>
                <div className="text-[11px] text-faint capitalize">
                  {v.layout} · grouped by {v.groupBy} · sorted by {v.orderBy}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
