import { useState } from 'react'
import { Plus, X, Filter } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import { PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { NotificationRule } from '@/lib/types'

// ── Settings → Notifications → Rules (Linear's advanced if-then rules) ─────────
// A configuration surface only (no live evaluation), mirroring how several other
// settings slices in this clone persist intent without an engine behind them.

const CONDITION_LABELS: Record<NotificationRule['condition'], string> = {
  priority: 'Priority is',
  label: 'Label is',
  assignee: 'Assignee is',
  project: 'In project',
}

const ACTION_LABELS: Record<NotificationRule['action'], string> = {
  notify: 'Notify me',
  mute: 'Mute',
}

/** Reuse of the same toggle pill used across the Notifications settings pages. */
function Switch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-bg-tertiary',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] h-3 w-3 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[15px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  )
}

/** Compact select styled to match the settings house style. */
function Select({
  value,
  onChange,
  children,
  className,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-7 rounded-md border border-border bg-bg px-2 text-[13px] text-fg outline-none hover:bg-bg-hover focus:border-accent',
        className,
      )}
    >
      {children}
    </select>
  )
}

export function NotificationRulesSettings() {
  const { rules, labels, projects, users, addNotificationRule, updateNotificationRule, deleteNotificationRule } =
    useStoreShallow((s) => ({
      rules: s.notificationSettings.rules,
      labels: s.labels,
      projects: s.projects,
      users: s.users,
      addNotificationRule: s.addNotificationRule,
      updateNotificationRule: s.updateNotificationRule,
      deleteNotificationRule: s.deleteNotificationRule,
    }))

  // Draft for the "add rule" composer at the bottom.
  const [condition, setCondition] = useState<NotificationRule['condition']>('priority')
  const [value, setValue] = useState<string>('1')
  const [action, setAction] = useState<NotificationRule['action']>('notify')

  // Non-group labels only (groups aren't directly matchable).
  const realLabels = labels.filter((l) => !l.isGroup)

  // The value options depend on the chosen condition. Switching the condition
  // resets the value to the first valid option.
  function pickCondition(c: NotificationRule['condition']) {
    setCondition(c)
    if (c === 'priority') setValue(String(PRIORITY_ORDER[0]))
    else if (c === 'label') setValue(realLabels[0]?.id ?? '')
    else if (c === 'assignee') setValue(users[0]?.id ?? '')
    else if (c === 'project') setValue(projects[0]?.id ?? '')
  }

  function valueOptions() {
    if (condition === 'priority')
      return PRIORITY_ORDER.map((p) => ({ id: String(p), label: PRIORITY_LABELS[p] }))
    if (condition === 'label') return realLabels.map((l) => ({ id: l.id, label: l.name }))
    if (condition === 'assignee') return users.map((u) => ({ id: u.id, label: u.name }))
    return projects.map((p) => ({ id: p.id, label: p.name }))
  }

  function handleAdd() {
    if (!value) return
    addNotificationRule({ enabled: true, condition, value, action })
  }

  /** Human-readable summary of a saved rule, e.g. "Priority is Urgent → Mute". */
  function describe(rule: NotificationRule): { cond: string; val: string } {
    let val = rule.value
    if (rule.condition === 'priority') val = PRIORITY_LABELS[Number(rule.value) as keyof typeof PRIORITY_LABELS] ?? rule.value
    else if (rule.condition === 'label') val = labels.find((l) => l.id === rule.value)?.name ?? 'Unknown label'
    else if (rule.condition === 'assignee') val = users.find((u) => u.id === rule.value)?.name ?? 'Unknown user'
    else if (rule.condition === 'project') val = projects.find((p) => p.id === rule.value)?.name ?? 'Unknown project'
    return { cond: CONDITION_LABELS[rule.condition], val }
  }

  return (
    <section className="mt-10">
      <h2 className="text-[13px] font-semibold text-fg">Rules</h2>
      <p className="mt-0.5 text-[12px] text-muted">
        Create if-then rules to automatically notify or mute notifications for
        issues that match a condition.
      </p>

      {/* Existing rules / empty state */}
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
            <Filter size={20} className="text-faint" />
            <div className="text-[13px] font-medium text-fg">No rules yet</div>
            <div className="text-[12px] text-muted">
              Add a rule below to start automating your notifications.
            </div>
          </div>
        ) : (
          rules.map((rule, i) => {
            const { cond, val } = describe(rule)
            return (
              <div
                key={rule.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3',
                  i > 0 && 'border-t border-border',
                  !rule.enabled && 'opacity-50',
                )}
              >
                <div className="min-w-0 flex-1 text-[13px] text-fg">
                  <span className="text-muted">If</span>{' '}
                  <span className="font-medium">{cond.toLowerCase()}</span>{' '}
                  <span className="font-medium text-fg">{val}</span>{' '}
                  <span className="text-muted">then</span>{' '}
                  <span className="font-medium">{ACTION_LABELS[rule.action].toLowerCase()}</span>
                </div>
                <Switch
                  checked={rule.enabled}
                  onChange={(v) => updateNotificationRule(rule.id, { enabled: v })}
                />
                <button
                  type="button"
                  onClick={() => deleteNotificationRule(rule.id)}
                  aria-label="Delete rule"
                  className="rounded p-1 text-faint hover:bg-bg-hover hover:text-fg"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Add-rule composer */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-muted">If</span>
        <Select value={condition} onChange={(v) => pickCondition(v as NotificationRule['condition'])}>
          {(Object.keys(CONDITION_LABELS) as NotificationRule['condition'][]).map((c) => (
            <option key={c} value={c}>
              {CONDITION_LABELS[c]}
            </option>
          ))}
        </Select>
        <Select value={value} onChange={setValue} className="max-w-[180px]">
          {valueOptions().map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
        <span className="text-[12px] text-muted">then</span>
        <Select value={action} onChange={(v) => setAction(v as NotificationRule['action'])}>
          {(Object.keys(ACTION_LABELS) as NotificationRule['action'][]).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!value}
          className={cn(
            'flex h-7 items-center gap-1 rounded-md bg-accent px-2.5 text-[13px] font-medium text-white',
            !value ? 'opacity-50' : 'hover:opacity-90',
          )}
        >
          <Plus size={14} />
          Add rule
        </button>
      </div>
    </section>
  )
}
