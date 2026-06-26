import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useStore } from '@/lib/store'
import { ESTIMATION_TYPES, teamEstimationType } from '@/lib/constants'
import type { EstimationType, Team } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Linear-style pill toggle switch. */
function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
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
        disabled && 'opacity-40',
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
}: {
  title: string
  description?: string
  control: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div>
        <div className="text-[13px] font-medium text-fg">{title}</div>
        {description && <div className="mt-0.5 text-[12px] text-muted">{description}</div>}
      </div>
      {control}
    </div>
  )
}

/** Per-team estimate-type selector — a column of selectable rows. */
function EstimateTypeSelect({
  value,
  onChange,
}: {
  value: EstimationType
  onChange: (id: EstimationType) => void
}) {
  return (
    <div className="divide-y divide-border">
      {ESTIMATION_TYPES.map((type) => {
        const active = type.id === value
        return (
          <button
            key={type.id}
            type="button"
            onClick={() => onChange(type.id)}
            className="flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left hover:bg-bg-hover"
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-fg">{type.label}</span>
              {type.example && (
                <span className="text-[12px] text-muted">{type.example}</span>
              )}
            </div>
            {active && <Check size={15} className="text-accent" />}
          </button>
        )
      })}
    </div>
  )
}

/** A single team's estimates card. */
function TeamEstimates({ team }: { team: Team }) {
  const setTeamEstimation = useStore((s) => s.setTeamEstimation)
  const type = teamEstimationType(team)
  const meta = ESTIMATION_TYPES.find((t) => t.id === type)
  const allowZero = team.estimationAllowZero ?? false
  const notUsed = type === 'notUsed'

  // Build the active scale preview, prefixing 0 when allowed.
  const scale = meta?.example
    ? allowZero
      ? meta.example
      : meta.example.replace(/^0,\s*/, '')
    : ''

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[15px] leading-none">{team.icon}</span>
        <h2 className="text-[13px] font-semibold text-fg">{team.name}</h2>
        <span className="text-[12px] text-faint">{team.key}</span>
      </div>
      <Card>
        <div className="px-4 py-3.5">
          <div className="text-[13px] font-medium text-fg">Estimate type</div>
          <div className="mt-0.5 text-[12px] text-muted">
            Choose the scale used to estimate the effort of issues.
          </div>
        </div>
        <EstimateTypeSelect
          value={type}
          onChange={(id) => setTeamEstimation(team.id, { estimationType: id })}
        />
        {!notUsed && (
          <>
            <Row
              title="Allow zero"
              description="Let issues be estimated at 0 points."
              control={
                <Toggle
                  on={allowZero}
                  onChange={(v) => setTeamEstimation(team.id, { estimationAllowZero: v })}
                />
              }
            />
            {scale && (
              <div className="px-4 py-3.5">
                <div className="text-[12px] text-muted">
                  Scale: <span className="text-fg">{scale}</span>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </section>
  )
}

/** Estimates (per-team estimation scale) settings page. */
export function EstimatesSettings() {
  const teams = useStore((s) => s.teams)

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Estimates</h1>
      <p className="mt-1 text-[13px] text-muted">
        Choose how your teams estimate the effort of issues.
      </p>

      <div className="mt-7 space-y-9">
        {teams.map((team) => (
          <TeamEstimates key={team.id} team={team} />
        ))}
      </div>
    </div>
  )
}
