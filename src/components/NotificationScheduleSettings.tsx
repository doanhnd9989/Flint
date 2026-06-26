import type { ReactNode } from 'react'
import { Moon } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import { cn } from '@/lib/utils'

// ── Settings → Notification schedule (Linear's "Do not disturb" page) ─────────
// All state persists through the store's generic key-value maps:
//   booleans  → featureSettings[key] via setFeatureSetting(key, on)
//   strings   → featureValues[key]   via setFeatureValue(key, value)

const DND_ENABLED = 'dnd.enabled'
const DND_START = 'dnd.start'
const DND_END = 'dnd.end'
const DND_PAUSED_UNTIL = 'dnd.pausedUntil'

/** Weekday columns, in display order, with their featureSettings keys. */
const WEEKDAYS: { key: string; short: string; label: string }[] = [
  { key: 'dnd.day.mon', short: 'M', label: 'Monday' },
  { key: 'dnd.day.tue', short: 'T', label: 'Tuesday' },
  { key: 'dnd.day.wed', short: 'W', label: 'Wednesday' },
  { key: 'dnd.day.thu', short: 'T', label: 'Thursday' },
  { key: 'dnd.day.fri', short: 'F', label: 'Friday' },
  { key: 'dnd.day.sat', short: 'S', label: 'Saturday' },
  { key: 'dnd.day.sun', short: 'S', label: 'Sunday' },
]

/** Half-hour options "00:00" … "23:30" for the work-hours selects. */
const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

/** "09:00" → "9:00 AM" for display. */
function formatTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${ampm}`
}

// ── primitives (mirror the PrefCard/PrefRow look used across settings) ─────────

/** Linear-style pill toggle switch. */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors',
        on ? 'bg-accent' : 'bg-bg-tertiary',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform',
          on ? 'translate-x-[14px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}

/** Bordered, divided settings card. */
function Card({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {children}
    </div>
  )
}

/** A single settings row: title + description on the left, control on the right. */
function Row({
  title,
  description,
  control,
  disabled,
}: {
  title: string
  description?: string
  control: ReactNode
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-3.5',
        disabled && 'opacity-50',
      )}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg">{title}</div>
        {description && (
          <div className="mt-0.5 text-[12px] text-muted">{description}</div>
        )}
      </div>
      {control}
    </div>
  )
}

/** Bare select styled like Linear's compact dropdowns. */
function TimeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'rounded-md border border-border bg-bg px-2 py-1 text-[13px] text-fg',
        'outline-none focus:border-accent disabled:cursor-not-allowed',
      )}
    >
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {formatTime(t)}
        </option>
      ))}
    </select>
  )
}

/** Notification schedule / Do not disturb settings page. */
export function NotificationScheduleSettings() {
  const {
    featureSettings,
    featureValues,
    setFeatureSetting,
    setFeatureValue,
  } = useStoreShallow((s) => ({
    featureSettings: s.featureSettings,
    featureValues: s.featureValues,
    setFeatureSetting: s.setFeatureSetting,
    setFeatureValue: s.setFeatureValue,
  }))

  const enabled = featureSettings[DND_ENABLED] ?? false
  const start = featureValues[DND_START] ?? '09:00'
  const end = featureValues[DND_END] ?? '18:00'

  // Quick-snooze: a future ISO string means notifications are paused.
  const pausedRaw = featureValues[DND_PAUSED_UNTIL] ?? ''
  const pausedDate = pausedRaw ? new Date(pausedRaw) : null
  const isPaused = !!pausedDate && pausedDate.getTime() > Date.now()

  const pauseFor = (ms: number) =>
    setFeatureValue(DND_PAUSED_UNTIL, new Date(Date.now() + ms).toISOString())

  const pauseUntilTomorrow = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    setFeatureValue(DND_PAUSED_UNTIL, d.toISOString())
  }

  const resume = () => setFeatureValue(DND_PAUSED_UNTIL, '')

  const pausedLabel = pausedDate
    ? pausedDate.toLocaleString(undefined, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">
        Notification schedule
      </h1>
      <p className="mt-1 text-[13px] text-muted">
        Silence notifications during focus time and outside your work hours.
      </p>

      <div className="mt-7 space-y-9">
        {/* Master Do not disturb toggle */}
        <Card>
          <Row
            title="Do not disturb"
            description="Pause desktop, mobile and email notifications on a schedule"
            control={
              <Toggle
                on={enabled}
                onChange={(next) => setFeatureSetting(DND_ENABLED, next)}
              />
            }
          />
        </Card>

        {/* Work hours window + weekdays */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">Work hours</h2>
          <Card>
            <Row
              title="Notify only during work hours"
              description="Outside this window, notifications are held until the next work day"
              control={
                <div className="flex items-center gap-2">
                  <TimeSelect
                    value={start}
                    disabled={!enabled}
                    onChange={(v) => setFeatureValue(DND_START, v)}
                  />
                  <span className="text-[13px] text-muted">to</span>
                  <TimeSelect
                    value={end}
                    disabled={!enabled}
                    onChange={(v) => setFeatureValue(DND_END, v)}
                  />
                </div>
              }
            />
            <div className={cn('px-4 py-3.5', !enabled && 'opacity-50')}>
              <div className="text-[13px] font-medium text-fg">Active days</div>
              <div className="mt-0.5 text-[12px] text-muted">
                Choose which days your work hours apply
              </div>
              <div className="mt-3 flex gap-2">
                {WEEKDAYS.map((d) => {
                  const on = featureSettings[d.key] ?? true
                  return (
                    <button
                      key={d.key}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={d.label}
                      title={d.label}
                      disabled={!enabled}
                      onClick={() => setFeatureSetting(d.key, !on)}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-medium transition-colors',
                        on
                          ? 'bg-accent text-white'
                          : 'bg-bg-tertiary text-muted hover:bg-bg-hover',
                        !enabled && 'cursor-not-allowed',
                      )}
                    >
                      {d.short}
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>
        </section>

        {/* Quick-snooze: pause notifications until … */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-fg">
            Pause notifications
          </h2>
          <Card>
            {isPaused ? (
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Moon size={16} className="shrink-0 text-accent" />
                  <div className="text-[13px] font-medium text-fg">
                    Paused until {pausedLabel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resume}
                  className="rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
                >
                  Resume
                </button>
              </div>
            ) : (
              <Row
                title="Pause notifications until"
                description="Temporarily snooze all notifications"
                control={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => pauseFor(30 * 60 * 1000)}
                      className="rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
                    >
                      30 min
                    </button>
                    <button
                      type="button"
                      onClick={() => pauseFor(60 * 60 * 1000)}
                      className="rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
                    >
                      1 hr
                    </button>
                    <button
                      type="button"
                      onClick={pauseUntilTomorrow}
                      className="rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover"
                    >
                      Tomorrow
                    </button>
                  </div>
                }
              />
            )}
          </Card>
        </section>
      </div>
    </div>
  )
}
