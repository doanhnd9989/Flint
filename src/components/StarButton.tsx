import { Star } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { FavoriteType } from '@/lib/types'
import { cn } from '@/lib/utils'

export function StarButton({
  type,
  id,
  size = 15,
}: {
  type: FavoriteType
  id: string
  size?: number
}) {
  const favorites = useStore((s) => s.favorites)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const starred = favorites.some((f) => f.type === type && f.id === id)

  return (
    <button
      type="button"
      title={starred ? 'Remove from favorites' : 'Add to favorites'}
      onClick={(e) => {
        e.stopPropagation()
        toggleFavorite(type, id)
      }}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded hover:bg-bg-hover',
        starred ? 'text-[var(--status-started)]' : 'text-muted hover:text-fg',
      )}
    >
      <Star size={size} fill={starred ? 'currentColor' : 'none'} />
    </button>
  )
}
