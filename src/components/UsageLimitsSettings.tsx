import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Popover } from './ui/Popover'
import { SelectMenu } from './ui/SelectMenu'

// ── Settings → Usage & limits (mirrors Linear's /settings/usage) ─────────────
// Three screens behind one nav item, exactly like Linear: the usage overview,
// `Spend limits` behind its chevron row, and `Overrides` behind that one's.

/** A bordered settings group. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
      {children}
    </div>
  )
}

/** A single labelled row inside a Card: label + hint left, control right. */
function Row({
  label,
  description,
  children,
}: {
  label: string
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13px] text-fg">{label}</div>
        {description ? (
          <div className="mt-0.5 text-[12px] text-muted">{description}</div>
        ) : null}
      </div>
      {children}
    </div>
  )
}

/** Linear's chevron row — the whole row is the control, the `›` is the hint. */
function DrillRow({
  label,
  description,
  onClick,
}: {
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-bg-hover"
    >
      <div className="min-w-0">
        <div className="text-[13px] text-fg">{label}</div>
        <div className="mt-0.5 text-[12px] text-muted">{description}</div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-faint" />
    </button>
  )
}

/** Linear's small bordered button (`Add credits`, `Manage`, `Set limit`). */
function MiniButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-md border border-border bg-bg-elevated px-2.5 py-1 text-[13px] font-medium text-fg hover:bg-bg-hover"
    >
      {children}
    </button>
  )
}

/** The `Weekly ⌄` style select Linear uses on the right of a settings row. */
function InlineSelect({
  value,
  options,
  onSelect,
}: {
  value: string
  options: string[]
  onSelect: (v: string) => void
}) {
  return (
    <SelectMenu
      align="end"
      width={180}
      options={options.map((o) => ({ id: o, label: o, selected: o === value }))}
      onSelect={onSelect}
      trigger={
        <span className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg">
          {value}
          <ChevronDown size={13} className="text-faint" />
        </span>
      }
    />
  )
}

// ── period maths ─────────────────────────────────────────────────────────────

type Period = 'Day' | 'Week' | 'Month'
const PERIODS: Period[] = ['Day', 'Week', 'Month']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/**
 * The bucket the chart draws, `offset` periods back from today. Linear labels a
 * week `Aug 3 – 9` and a month by its name; the axis ticks are `M/D` per day.
 */
function range(period: Period, offset: number): { from: Date; to: Date; label: string } {
  const today = startOfDay(new Date())
  if (period === 'Day') {
    const d = addDays(today, offset)
    return { from: d, to: d, label: `${MONTHS[d.getMonth()]} ${d.getDate()}` }
  }
  if (period === 'Week') {
    // Linear's usage week runs Sunday → Saturday.
    const from = addDays(today, -today.getDay() + offset * 7)
    const to = addDays(from, 6)
    const label =
      from.getMonth() === to.getMonth()
        ? `${MONTHS[from.getMonth()]} ${from.getDate()} – ${to.getDate()}`
        : `${MONTHS[from.getMonth()]} ${from.getDate()} – ${MONTHS[to.getMonth()]} ${to.getDate()}`
    return { from, to, label }
  }
  const anchor = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  return { from: anchor, to, label: `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}` }
}

const money = (n: number) => `$${n.toFixed(2)}`
const tick = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

/** Linear's features that draw on AI credits, in its own order. */
const FEATURES = [
  { id: 'coding-sessions', label: 'Coding sessions', swatch: 'var(--accent)' },
  { id: 'loops', label: 'Loops', swatch: 'color-mix(in srgb, var(--accent) 45%, transparent)' },
]

// ── the spend chart ──────────────────────────────────────────────────────────

/**
 * Linear's dotted-gridline spend chart. The clone consumes no credits, so every
 * bar is zero and the axis pins to Linear's $0–$4 default — the same empty
 * shape a fresh Linear workspace draws.
 */
function SpendChart({ days, values }: { days: Date[]; values: number[] }) {
  const max = Math.max(4, Math.ceil(Math.max(0, ...values)))
  const lines = [4, 3, 2, 1, 0].map((i) => (max * i) / 4)
  return (
    <div className="px-4 pb-3">
      <div className="relative h-[150px]">
        {lines.map((v, i) => (
          <div
            key={v}
            className="absolute left-0 right-0 flex items-center"
            style={{ top: `${(i / (lines.length - 1)) * 100}%` }}
          >
            <div className="h-px flex-1 border-t border-dashed border-border" />
            <span className="w-8 pl-2 text-right text-[11px] text-faint">
              ${Math.round(v)}
            </span>
          </div>
        ))}
        <div className="absolute inset-y-0 left-0 right-9 flex items-end gap-1">
          {values.map((v, i) => (
            <div key={i} className="flex-1">
              <div
                className="w-full rounded-sm bg-accent"
                style={{ height: `${max ? (v / max) * 100 : 0}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1 pr-9">
        {days.map((d) => (
          <div key={d.toISOString()} className="flex-1 text-center text-[11px] text-faint">
            {tick(d)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── screen 3: per-user overrides ─────────────────────────────────────────────

function OverridesScreen({ onBack }: { onBack: () => void }) {
  const users = useStore((s) => s.users)
  const featureValues = useStore((s) => s.featureValues)
  const setFeatureValue = useStore((s) => s.setFeatureValue)

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <BackLink label="Spend limits" onClick={onBack} />
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Overrides</h1>
      <p className="mt-1 text-[13px] text-muted">
        View and manage per-user limits and usage
      </p>
      <div className="mt-7">
        <Card>
          {users.map((u) => {
            const key = `usage.limit.user.${u.id}`
            const limit = featureValues[key]
            return (
              <Row key={u.id} label={u.name} description={u.email}>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-faint">{money(0)} used</span>
                  <LimitButton
                    value={limit}
                    onChange={(v) => setFeatureValue(key, v)}
                  />
                </div>
              </Row>
            )
          })}
        </Card>
      </div>
    </div>
  )
}

// ── screen 2: spend limits ───────────────────────────────────────────────────

/** `Set limit` / the limit itself — a popover with a dollar input, like Linear. */
function LimitButton({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (v: string) => void
}) {
  const [draft, setDraft] = useState(value ?? '')
  return (
    <Popover
      align="end"
      width={220}
      label={value ? `Limit ${money(Number(value))}` : 'Set limit'}
      trigger={
        <span className="shrink-0 rounded-md border border-border bg-bg-elevated px-2.5 py-1 text-[13px] font-medium text-fg hover:bg-bg-hover">
          {value ? money(Number(value)) : 'Set limit'}
        </span>
      }
    >
      {(close) => (
        <div className="p-2">
          <div className="mb-1.5 text-[12px] text-muted">Monthly spend limit</div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg px-2 py-1.5">
            <span className="text-[13px] text-faint">$</span>
            <input
              autoFocus
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onChange(draft)
                  close()
                }
              }}
              placeholder="No limit set"
              className="w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
            />
          </div>
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setDraft('')
                onChange('')
                close()
              }}
              className="rounded-md px-2 py-1 text-[12px] text-muted hover:bg-bg-hover hover:text-fg"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draft)
                close()
              }}
              className="rounded-md bg-accent px-2 py-1 text-[12px] font-medium text-white"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </Popover>
  )
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function SpendLimitsScreen({
  onBack,
  onOverrides,
}: {
  onBack: () => void
  onOverrides: () => void
}) {
  const featureValues = useStore((s) => s.featureValues)
  const setFeatureValue = useStore((s) => s.setFeatureValue)
  const get = (k: string, fallback: string) => featureValues[k] ?? fallback

  const weekday = get('usage.reset.weekday', 'Saturday')
  const monthDay = get('usage.reset.monthDay', '15')
  const hour = get('usage.reset.hour', '5 PM')
  // The browser's own zone, rendered the way Linear renders it.
  const zone = useMemo(() => {
    const m = -new Date().getTimezoneOffset() / 60
    return `GMT${m >= 0 ? '+' : ''}${m}`
  }, [])

  const wsFreq = get('usage.limit.workspace.freq', 'Weekly')
  const userFreq = get('usage.limit.user.freq', 'Weekly')
  const resets = (freq: string) =>
    freq === 'Daily'
      ? `Resets daily at ${hour} (${zone})`
      : freq === 'Monthly'
        ? `Resets on the ${monthDay}th at ${hour} (${zone})`
        : `Resets ${weekday}s at ${hour} (${zone})`

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <BackLink label="Usage & limits" onClick={onBack} />
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Spend limits</h1>
      <p className="mt-1 text-[13px] text-muted">Manage workspace and user limits</p>

      <div className="mt-7 space-y-9">
        <Card>
          <Row
            label="Reset schedule"
            description={`Daily at ${hour} (${zone}) · Weekly on ${weekday} · Monthly on the ${monthDay}th`}
          >
            <Popover
              align="end"
              width={240}
              label="Edit reset schedule"
              trigger={
                <span className="shrink-0 rounded-md px-1.5 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg">
                  Edit
                </span>
              }
            >
              {() => (
                <div className="p-2">
                  <ScheduleRow label="Daily at">
                    <InlineSelect
                      value={hour}
                      options={['12 AM', '5 AM', '9 AM', '12 PM', '5 PM', '9 PM']}
                      onSelect={(v) => setFeatureValue('usage.reset.hour', v)}
                    />
                  </ScheduleRow>
                  <ScheduleRow label="Weekly on">
                    <InlineSelect
                      value={weekday}
                      options={WEEKDAYS}
                      onSelect={(v) => setFeatureValue('usage.reset.weekday', v)}
                    />
                  </ScheduleRow>
                  <ScheduleRow label="Monthly on the">
                    <InlineSelect
                      value={monthDay}
                      options={['1', '5', '10', '15', '20', '25']}
                      onSelect={(v) => setFeatureValue('usage.reset.monthDay', v)}
                    />
                  </ScheduleRow>
                </div>
              )}
            </Popover>
          </Row>
        </Card>

        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Workspace limit</h2>
          <Card>
            <Row
              label="Default limit"
              description={
                featureValues['usage.limit.workspace']
                  ? `${money(Number(featureValues['usage.limit.workspace']))} per period`
                  : 'No limit set'
              }
            >
              <LimitButton
                value={featureValues['usage.limit.workspace']}
                onChange={(v) => setFeatureValue('usage.limit.workspace', v)}
              />
            </Row>
            <Row label="Reset frequency" description={resets(wsFreq)}>
              <InlineSelect
                value={wsFreq}
                options={['Daily', 'Weekly', 'Monthly']}
                onSelect={(v) => setFeatureValue('usage.limit.workspace.freq', v)}
              />
            </Row>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">User limits</h2>
          <Card>
            <Row
              label="Default limit"
              description={
                featureValues['usage.limit.userDefault']
                  ? `${money(Number(featureValues['usage.limit.userDefault']))} per period`
                  : 'No limit set'
              }
            >
              <LimitButton
                value={featureValues['usage.limit.userDefault']}
                onChange={(v) => setFeatureValue('usage.limit.userDefault', v)}
              />
            </Row>
            <Row label="Reset frequency" description={resets(userFreq)}>
              <InlineSelect
                value={userFreq}
                options={['Daily', 'Weekly', 'Monthly']}
                onSelect={(v) => setFeatureValue('usage.limit.user.freq', v)}
              />
            </Row>
            <DrillRow
              label="Overrides"
              description="View and manage per-user limits and usage"
              onClick={onOverrides}
            />
          </Card>
        </section>
      </div>
    </div>
  )
}

function ScheduleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-1">
      <span className="text-[13px] text-muted">{label}</span>
      {children}
    </div>
  )
}

/** Linear's `‹ Usage & limits` breadcrumb above a settings sub-screen. */
function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1.5 mb-5 flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-muted hover:text-fg"
    >
      <ChevronLeft size={15} />
      {label}
    </button>
  )
}

// ── screen 1: usage overview ─────────────────────────────────────────────────

export function UsageLimitsSettings() {
  // Linear gives each sub-screen its own URL (`/settings/usage/spend-limits`),
  // so a nav click or a reload lands back on the overview and a sub-screen is
  // linkable. Ours does the same through the `section` param rather than
  // component state, which a nav click would not reset.
  const [params, setParams] = useSearchParams()
  const screen = params.get('section') ?? 'usage'
  const setScreen = (next: string) =>
    setParams(next === 'usage' ? { page: 'usage' } : { page: 'usage', section: next })
  const [period, setPeriod] = useState<Period>('Week')
  const [offset, setOffset] = useState(0)
  const featureValues = useStore((s) => s.featureValues)
  const setFeatureValue = useStore((s) => s.setFeatureValue)

  const { from, to, label } = useMemo(() => range(period, offset), [period, offset])
  const days = useMemo(() => {
    const out: Date[] = []
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
    return out
  }, [from, to])
  // No credits are consumed by the clone, so every bucket is zero — the same
  // shape Linear draws for a workspace that has not used Coding sessions.
  const values = days.map(() => 0)
  const total = values.reduce((a, b) => a + b, 0)
  const shortRange = `${tick(from)} – ${tick(to)}`

  const reload = featureValues['usage.autoReload'] === 'on'

  if (screen === 'limits')
    return (
      <SpendLimitsScreen
        onBack={() => setScreen('usage')}
        onOverrides={() => setScreen('overrides')}
      />
    )
  if (screen === 'overrides') return <OverridesScreen onBack={() => setScreen('limits')} />

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Usage &amp; limits</h1>
      <p className="mt-1 text-[13px] text-muted">
        Track usage, manage credits, and set spend limits across your workspace
      </p>

      <div className="mt-7 space-y-9">
        {/* AI credits */}
        <section>
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[13px] font-semibold text-fg">AI credits</h2>
              <p className="mt-0.5 text-[12px] text-muted">
                Credits apply to usage of Coding sessions and Loops.{' '}
                <a href="/api-docs" className="text-fg underline-offset-2 hover:underline">
                  Docs
                </a>
              </p>
            </div>
            <MiniButton
              onClick={() =>
                toast({
                  title: 'Billing is not connected',
                  message: 'This clone has no payment provider, so credits cannot be purchased.',
                })
              }
            >
              Add credits
            </MiniButton>
          </div>
          <Card>
            <Row label="Workspace credits">
              <span className="text-[13px] text-muted">{money(0)} available</span>
            </Row>
            <Row
              label="Automatic reload"
              description={
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      reload ? 'bg-[var(--c-green)]' : 'bg-faint',
                    )}
                  />
                  {reload ? 'Enabled' : 'Disabled'}
                  <span className="text-faint">-</span>
                  Automatically top up credits when your balance runs low
                </span>
              }
            >
              <MiniButton
                onClick={() => setFeatureValue('usage.autoReload', reload ? 'off' : 'on')}
              >
                Manage
              </MiniButton>
            </Row>
            <DrillRow
              label="Spend limits"
              description="Set workspace and user limits"
              onClick={() => setScreen('limits')}
            />
          </Card>
        </section>

        {/* Analytics */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-[13px] font-semibold text-fg">Analytics</h2>
            <div className="flex items-center gap-1">
              <SelectMenu
                align="end"
                width={160}
                options={PERIODS.map((p) => ({ id: p, label: p, selected: p === period }))}
                onSelect={(id) => {
                  setPeriod(id as Period)
                  setOffset(0)
                }}
                trigger={
                  <span className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[13px] text-fg hover:bg-bg-hover">
                    {period}
                    <ChevronDown size={13} className="text-faint" />
                  </span>
                }
              />
              <button
                type="button"
                aria-label="Previous period"
                onClick={() => setOffset((o) => o - 1)}
                className="rounded-md p-1 text-faint hover:bg-bg-hover hover:text-fg"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[92px] text-center text-[13px] text-fg">{label}</span>
              <button
                type="button"
                aria-label="Next period"
                disabled={offset >= 0}
                onClick={() => setOffset((o) => Math.min(0, o + 1))}
                className="rounded-md p-1 text-faint hover:bg-bg-hover hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <Card>
            <div className="flex items-baseline gap-2 px-4 pb-1 pt-3.5">
              <span className="text-[18px] font-semibold text-fg">{money(total)}</span>
              <span className="text-[12px] text-muted">total spend between {label}</span>
            </div>
            <SpendChart days={days} values={values} />
            <div className="flex items-center justify-between border-t border-border px-4 py-2">
              <span className="text-[12px] text-muted">Feature</span>
              <span className="text-[12px] text-muted">Usage ({shortRange})</span>
            </div>
            {FEATURES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() =>
                  toast({
                    title: `No ${f.label.toLowerCase()} usage`,
                    message: `Nothing was billed to ${f.label} between ${label}.`,
                  })
                }
                className="flex w-full items-center justify-between gap-4 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-bg-hover"
              >
                <span className="flex items-center gap-2 text-[13px] text-fg">
                  <span
                    className="h-2 w-2 rounded-[2px]"
                    style={{ background: f.swatch }}
                  />
                  {f.label}
                </span>
                <span className="flex items-center gap-2 text-[13px] text-muted">
                  {money(0)}
                  <ChevronRight size={15} className="text-faint" />
                </span>
              </button>
            ))}
          </Card>
        </section>

        {/* Dashboard */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-[13px] font-semibold text-fg">Dashboard</h2>
            <button
              type="button"
              onClick={() =>
                toast({ title: 'No sessions yet', message: 'Coding sessions will appear here.' })
              }
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg"
            >
              All sessions
              <ChevronRight size={14} className="text-faint" />
            </button>
          </div>
          <Card>
            <div className="px-4 py-12 text-center text-[13px] text-muted">
              No usage this {period.toLowerCase()}
            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}
