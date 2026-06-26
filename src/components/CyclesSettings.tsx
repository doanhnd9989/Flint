import type { ReactNode } from 'react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** Linear-style pill toggle switch. */
function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-[18px] w-[30px] rounded-full transition-colors',
        on ? 'bg-accent' : 'bg-[var(--border)]',
        disabled && 'cursor-not-allowed opacity-50',
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
  return <div className="divide-y divide-border rounded-xl border border-border">{children}</div>
}

/** A single settings row: title + description on the left, control on the right. */
function Row({
  title,
  description,
  control,
  muted,
}: {
  title: string
  description?: string
  control: ReactNode
  muted?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 px-4 py-3.5', muted && 'opacity-50')}>
      <div>
        <div className="text-[13px] font-medium text-fg">{title}</div>
        {description && <div className="mt-0.5 text-[12px] text-muted">{description}</div>}
      </div>
      {control}
    </div>
  )
}

/** Token-styled native select used for the cycle cadence options. */
function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'rounded-md border border-border bg-bg px-2 py-1 text-[13px] text-fg',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

const LENGTH_OPTIONS = [
  { value: '1', label: '1 week' },
  { value: '2', label: '2 weeks' },
  { value: '3', label: '3 weeks' },
  { value: '4', label: '4 weeks' },
]

const COOLDOWN_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1d', label: '1 day' },
  { value: '2d', label: '2 days' },
  { value: '3d', label: '3 days' },
  { value: '1w', label: '1 week' },
]

const START_DAY_OPTIONS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

const UPCOMING_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '4', label: '4' },
  { value: '6', label: '6' },
]

/** Per-team Cycles settings page. */
export function CyclesSettings() {
  const teams = useStore((s) => s.teams)
  const setTeamCyclesEnabled = useStore((s) => s.setTeamCyclesEnabled)
  const featureValues = useStore((s) => s.featureValues)
  const setFeatureValue = useStore((s) => s.setFeatureValue)
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Cycles</h1>
      <p className="mt-1 text-[13px] text-muted">
        Cycles are time-boxed periods (like sprints) for planning a team's work.
      </p>

      <div className="mt-7 space-y-9">
        {teams.map((team) => {
          const enabled = team.cyclesEnabled ?? true
          const length = featureValues[`cycles.${team.id}.length`] ?? '2'
          const cooldown = featureValues[`cycles.${team.id}.cooldown`] ?? '0'
          const startDay = featureValues[`cycles.${team.id}.startDay`] ?? 'monday'
          const upcoming = featureValues[`cycles.${team.id}.upcoming`] ?? '2'
          const autoAddStarted = featureSettings[`cycles.${team.id}.autoAddStarted`] ?? false
          const autoRoll = featureSettings[`cycles.${team.id}.autoRoll`] ?? true

          return (
            <section key={team.id}>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded text-[13px]"
                  style={{ color: team.color }}
                >
                  {team.icon}
                </span>
                <h2 className="text-[13px] font-semibold text-fg">{team.name}</h2>
              </div>
              <Card>
                <Row
                  title="Enable cycles"
                  description="Turn on time-boxed cycles for this team."
                  control={
                    <Toggle on={enabled} onChange={(v) => setTeamCyclesEnabled(team.id, v)} />
                  }
                />
                <Row
                  title="Cycle length"
                  description="How long each cycle runs."
                  muted={!enabled}
                  control={
                    <Select
                      value={length}
                      disabled={!enabled}
                      onChange={(v) => setFeatureValue(`cycles.${team.id}.length`, v)}
                      options={LENGTH_OPTIONS}
                    />
                  }
                />
                <Row
                  title="Cooldown"
                  description="A break between consecutive cycles."
                  muted={!enabled}
                  control={
                    <Select
                      value={cooldown}
                      disabled={!enabled}
                      onChange={(v) => setFeatureValue(`cycles.${team.id}.cooldown`, v)}
                      options={COOLDOWN_OPTIONS}
                    />
                  }
                />
                <Row
                  title="Start day"
                  description="The day of the week cycles begin on."
                  muted={!enabled}
                  control={
                    <Select
                      value={startDay}
                      disabled={!enabled}
                      onChange={(v) => setFeatureValue(`cycles.${team.id}.startDay`, v)}
                      options={START_DAY_OPTIONS}
                    />
                  }
                />
                <Row
                  title="Upcoming cycles"
                  description="How many future cycles to create in advance."
                  muted={!enabled}
                  control={
                    <Select
                      value={upcoming}
                      disabled={!enabled}
                      onChange={(v) => setFeatureValue(`cycles.${team.id}.upcoming`, v)}
                      options={UPCOMING_OPTIONS}
                    />
                  }
                />
                <Row
                  title="Auto-add started issues"
                  description="Automatically add started issues to the current cycle."
                  muted={!enabled}
                  control={
                    <Toggle
                      on={autoAddStarted}
                      disabled={!enabled}
                      onChange={(v) => setFeatureSetting(`cycles.${team.id}.autoAddStarted`, v)}
                    />
                  }
                />
                <Row
                  title="Auto-roll unfinished issues"
                  description="Move unfinished issues to the next cycle when a cycle ends."
                  muted={!enabled}
                  control={
                    <Toggle
                      on={autoRoll}
                      disabled={!enabled}
                      onChange={(v) => setFeatureSetting(`cycles.${team.id}.autoRoll`, v)}
                    />
                  }
                />
              </Card>
            </section>
          )
        })}
      </div>
    </div>
  )
}
