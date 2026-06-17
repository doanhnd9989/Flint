import { useNavigate } from 'react-router-dom'
import { Layers, Trash2 } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import { ViewHeader } from '@/components/ViewHeader'
import { EmptyState, StackIllustration } from '@/components/EmptyState'

export function ViewsView() {
  const navigate = useNavigate()
  const { savedViews, deleteView } = useStoreShallow((s) => ({
    savedViews: s.savedViews,
    deleteView: s.deleteView,
  }))
  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Views" />
      <div className="flex-1 overflow-y-auto p-4">
        {savedViews.length === 0 ? (
          <EmptyState
            illustration={<StackIllustration />}
            title="No saved views yet"
            description="Save a custom set of filters and grouping from the Issues view to reuse it here."
          />
        ) : (
          <div className="space-y-1">
            {savedViews.map((v) => (
              <div
                key={v.id}
                className="group flex items-center gap-3 rounded-lg border border-border bg-bg-secondary px-3 py-2.5 hover:border-border-strong"
              >
                <button
                  onClick={() => navigate(`/view/${v.id}`)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <Layers size={16} className="text-faint" />
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-fg">{v.name}</div>
                    <div className="text-[11px] text-faint capitalize">
                      {v.layout} · grouped by {v.groupBy} · sorted by {v.orderBy}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete view "${v.name}"?`)) deleteView(v.id)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded text-faint opacity-0 hover:text-[var(--priority-urgent)] group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
