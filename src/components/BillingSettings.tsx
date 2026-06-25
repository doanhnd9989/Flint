import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** Container card — bordered, rounded, padded. */
function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-xl border border-border p-5', className)}>{children}</div>
}

/** Label / value row used in the seats & payment cards. */
function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 text-[13px]">
      <div className="flex items-center gap-2 text-fg">{label}</div>
      <div className="text-muted">{children}</div>
    </div>
  )
}

/** Secondary button — bordered, elevated, hover. */
function SecondaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover">
      {children}
    </button>
  )
}

const INVOICES = [
  { date: 'Jun 1, 2026', amount: '$64.00' },
  { date: 'May 1, 2026', amount: '$64.00' },
  { date: 'Apr 1, 2026', amount: '$64.00' },
]

export function BillingSettings() {
  const users = useStore((s) => s.users)
  const workspaceName = useStore((s) => s.workspaceName)
  const [cycle, setCycle] = useState<'monthly' | 'annually'>('monthly')

  const seats = users.length
  // 70% usage bar — flavour for the current plan card.
  const usedPct = 70

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Billing</h1>
      <p className="mt-1 text-[13px] text-muted">Manage your plan, seats and payment details.</p>

      <div className="mt-7 space-y-9">
        {/* Current plan */}
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-[15px] font-semibold text-fg">Business</span>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                Current plan
              </span>
              <span className="text-[13px] text-muted">$8 / user / month</span>
            </div>
            <SecondaryButton>Change plan</SecondaryButton>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 text-[12px] text-muted">
              {seats} of {seats} seats used
            </div>
            <div className="h-1.5 rounded-full bg-bg-tertiary">
              <div className="h-1.5 rounded-full bg-accent" style={{ width: `${usedPct}%` }} />
            </div>
          </div>
        </Card>

        {/* Billing cycle */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Billing cycle</h2>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg bg-bg-tertiary p-0.5">
              {(['monthly', 'annually'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={cn(
                    'rounded-md px-3 py-1 text-[13px] font-medium capitalize',
                    cycle === c ? 'bg-bg-elevated text-fg shadow-sm' : 'text-muted hover:text-fg',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            {cycle === 'annually' && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                Save 20%
              </span>
            )}
          </div>
        </section>

        {/* Seats */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Seats</h2>
          <Card className="p-2 px-4">
            <div className="divide-y divide-border">
              <Row label="Members">{seats}</Row>
              <Row label="Guests">0</Row>
            </div>
          </Card>
        </section>

        {/* Payment method */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Payment method</h2>
          <Card>
            <Row
              label={
                <>
                  <CreditCard size={16} className="text-muted" />
                  <span>Visa ending in 4242</span>
                </>
              }
            >
              <SecondaryButton>Update</SecondaryButton>
            </Row>
          </Card>
        </section>

        {/* Billing history */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Billing history</h2>
          <Card className="p-0">
            <div className="divide-y divide-border">
              <div className="flex items-center px-4 py-2.5 text-[12px] font-medium text-faint">
                <span className="flex-1">Date</span>
                <span className="w-24">Amount</span>
                <span className="w-20">Status</span>
                <span className="w-20 text-right">Invoice</span>
              </div>
              {INVOICES.map((inv) => (
                <div key={inv.date} className="flex items-center px-4 py-2.5 text-[12px] text-fg">
                  <span className="flex-1">{inv.date}</span>
                  <span className="w-24 text-muted">{inv.amount}</span>
                  <span className="w-20">
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-500">
                      Paid
                    </span>
                  </span>
                  <span className="w-20 text-right">
                    <button className="text-accent hover:underline">Download</button>
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <p className="mt-2 text-[12px] text-faint">Invoices for {workspaceName}.</p>
        </section>
      </div>
    </div>
  )
}
