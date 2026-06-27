import { Archive, ArchiveRestore } from 'lucide-react'
import { useStore } from '@/lib/store'
import { nowIso } from '@/lib/utils'

// Archive / unarchive an initiative, mirroring Linear's initiative archive
// action. Archived initiatives are hidden from the initiatives list; restoring
// clears `archivedAt` to bring them back. Styled as a compact ghost header
// button to sit alongside the Delete action in InitiativeDetail's header.
export function InitiativeArchiveButton({ initiativeId }: { initiativeId: string }) {
  const initiatives = useStore((s) => s.initiatives)
  const updateInitiative = useStore((s) => s.updateInitiative)
  const initiative = initiatives.find((i) => i.id === initiativeId)
  if (!initiative) return null

  const archived = !!initiative.archivedAt

  return (
    <button
      type="button"
      title={archived ? 'Restore initiative' : 'Archive initiative'}
      onClick={() =>
        updateInitiative(initiativeId, {
          archivedAt: archived ? undefined : nowIso(),
        })
      }
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-faint hover:bg-bg-hover hover:text-fg"
    >
      {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
      {archived ? 'Restore' : 'Archive'}
    </button>
  )
}
