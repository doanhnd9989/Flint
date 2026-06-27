import { useState } from 'react'
import { Users as UsersIcon } from 'lucide-react'
import { useStore } from '@/lib/store'

/**
 * Editable "Company size" property row for the CustomerDetail Properties
 * sidebar — mirrors the ARR row (label on the left via the parent PropRow,
 * inline value/editor on the right). Click the value to reveal a number
 * input; commits on blur/Enter via updateCustomer, Escape cancels.
 *
 * Real Linear customer records carry an approximate employee headcount, so
 * we show e.g. "120 employees" or a muted "Add size" placeholder when unset.
 */
export function CustomerCompanySize({ customerId }: { customerId: string }) {
  // Single-value selectors — no object literal, so plain useStore is safe.
  const customer = useStore((s) => s.customers.find((c) => c.id === customerId))
  const updateCustomer = useStore((s) => s.updateCustomer)

  // Click-to-edit: idle shows the formatted value, editing shows the input.
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!customer) return null

  // Persist the draft. Empty / zero / NaN clears the field back to undefined,
  // matching how the ARR row treats an empty input.
  function commit() {
    const n = Number(draft)
    updateCustomer(customerId, { size: draft.trim() === '' || !n || n < 0 ? undefined : Math.round(n) })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 px-1.5 py-1 text-[13px] text-fg">
        <UsersIcon size={14} className="text-faint" />
        <input
          autoFocus
          type="number"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setEditing(false) // cancel — leave the stored value untouched
            }
          }}
          placeholder="0"
          className="w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
        />
        <span className="shrink-0 text-faint">employees</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(customer.size != null ? String(customer.size) : '')
        setEditing(true)
      }}
      className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[13px] text-fg hover:bg-bg-hover"
    >
      <UsersIcon size={14} className="text-faint" />
      {customer.size != null ? (
        <span>
          {customer.size.toLocaleString()} <span className="text-faint">employees</span>
        </span>
      ) : (
        <span className="text-faint">Add size</span>
      )}
    </button>
  )
}
