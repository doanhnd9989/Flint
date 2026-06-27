import { Bell, BellOff } from 'lucide-react';
import { useStoreShallow } from '@/lib/store';
import { cn } from '@/lib/utils';

// Subscribe/unsubscribe to a project's updates (Linear).
export function ProjectSubscribeButton({ projectId }: { projectId: string }) {
  const { projects, currentUserId, toggleProjectSubscriber } = useStoreShallow((s) => ({
    projects: s.projects,
    currentUserId: s.currentUserId,
    toggleProjectSubscriber: s.toggleProjectSubscriber,
  }));

  const project = projects.find((p) => p.id === projectId);
  if (!project) return null;

  const subscribed = (project.subscriberIds ?? []).includes(currentUserId);

  return (
    <button
      onClick={() => toggleProjectSubscriber(projectId, currentUserId)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px]',
        subscribed ? 'text-accent border-accent/40' : 'text-muted hover:bg-bg-hover hover:text-fg',
      )}
    >
      {subscribed ? <BellOff size={13} /> : <Bell size={13} />}
      {subscribed ? 'Subscribed' : 'Subscribe'}
    </button>
  );
}
