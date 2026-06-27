import { Merge } from 'lucide-react';
import { useStoreShallow } from '@/lib/store';
import { Popover } from '@/components/ui/Popover';

// Merge this customer into another (Linear's customer merge).
export function CustomerMergeButton({ customerId }: { customerId: string }) {
  const { customers, mergeCustomers } = useStoreShallow((s) => ({
    customers: s.customers,
    mergeCustomers: s.mergeCustomers,
  }));
  const others = customers.filter((c) => c.id !== customerId);
  if (others.length === 0) return null;
  const thisName = customers.find((c) => c.id === customerId)?.name ?? 'this customer';

  return (
    <Popover
      align="end"
      width={220}
      trigger={
        <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg">
          <Merge size={13} />
          Merge
        </span>
      }
    >
      {(close) => (
        <div>
          <div className="px-2 py-1 text-[11px] uppercase text-faint">Merge into…</div>
          {others.map((c) => (
            <button
              key={c.id}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
              onClick={() => {
                if (
                  window.confirm(
                    `Merge "${thisName}" into "${c.name}"? This deletes "${thisName}".`,
                  )
                ) {
                  mergeCustomers(customerId, c.id);
                  close();
                }
              }}
            >
              <span className="h-4 w-4 rounded" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
