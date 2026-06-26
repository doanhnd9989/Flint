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

/** Triage (team) settings page. */
export function TriageSettings() {
  const teams = useStore((s) => s.teams)
  const users = useStore((s) => s.users)
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)
  const featureValues = useStore((s) => s.featureValues)
  const setFeatureValue = useStore((s) => s.setFeatureValue)

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Triage</h1>
      <p className="mt-1 text-[13px] text-muted">
        Triage lets you review incoming issues before they enter a team's workflow.
      </p>

      <div className="mt-7 space-y-9">
        {teams.map((team) => {
          const enabled = featureSettings[`triage.${team.id}.enabled`] ?? true
          const autoAssign = featureSettings[`triage.${team.id}.autoAssign`] ?? false
          const notify = featureSettings[`triage.${team.id}.notify`] ?? true
          const responsible = featureValues[`triage.${team.id}.responsible`] ?? 'round-robin'

          const members = team.memberIds
            .map((id) => users.find((u) => u.id === id))
            .filter((u): u is (typeof users)[number] => Boolean(u))

          return (
            <section key={team.id}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[15px]">{team.icon}</span>
                <h2 className="text-[13px] font-semibold text-fg">{team.name}</h2>
              </div>
              <Card>
                <Row
                  title="Triage"
                  description="Route new issues into a triage queue for review."
                  control={
                    <Toggle
                      on={enabled}
                      onChange={(next) => setFeatureSetting(`triage.${team.id}.enabled`, next)}
                    />
                  }
                />
                <Row
                  title="Triage responsibility"
                  description="Who is responsible for triaging new issues."
                  muted={!enabled}
                  control={
                    <select
                      value={responsible}
                      disabled={!enabled}
                      onChange={(e) =>
                        setFeatureValue(`triage.${team.id}.responsible`, e.target.value)
                      }
                      className={cn(
                        'rounded-md border border-border bg-bg px-2 py-1 text-[13px] text-fg',
                        !enabled && 'cursor-not-allowed',
                      )}
                    >
                      <option value="round-robin">Round-robin</option>
                      <option value="unassigned">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  }
                />
                <Row
                  title="Auto-assign on accept"
                  description="Assign accepted issues to the person who triaged them."
                  muted={!enabled}
                  control={
                    <Toggle
                      on={autoAssign}
                      disabled={!enabled}
                      onChange={(next) => setFeatureSetting(`triage.${team.id}.autoAssign`, next)}
                    />
                  }
                />
                <Row
                  title="Notify on new triage"
                  description="Send a notification when an issue enters triage."
                  muted={!enabled}
                  control={
                    <Toggle
                      on={notify}
                      disabled={!enabled}
                      onChange={(next) => setFeatureSetting(`triage.${team.id}.notify`, next)}
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
