import { Pin } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'

// Pin/unpin a saved view to the sidebar.
export function PinViewButton({ viewId }: { viewId: string }) {
  const { savedViews, togglePinView } = useStoreShallow((s) => ({
    savedViews: s.savedViews,
    togglePinView: s.togglePinView,
  }))
  const view = savedViews.find((v) => v.id === viewId)
  if (!view) return null
  const pinned = !!view.pinned
  return (
    <button
      type="button"
      title={pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
      onClick={(e) => {
        e.stopPropagation()
        togglePinView(viewId)
      }}
      className={`h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-bg-hover ${
        pinned ? 'text-accent' : 'text-faint'
      }`}
    >
      <Pin size={14} style={pinned ? { fill: 'currentColor' } : undefined} />
    </button>
  )
}
