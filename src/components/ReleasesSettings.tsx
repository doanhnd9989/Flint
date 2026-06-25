import type { ReactNode } from 'react'
import { useState } from 'react'
import { Plus, Tag, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** Linear-style pill toggle switch. */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-[18px] w-[30px] rounded-full transition-colors',
        on ? 'bg-accent' : 'bg-[var(--border)]',
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

type Release = {
  id: string
  version: string
  date: string
  count: number
  status: 'Released' | 'In progress' | 'Planned'
}

const genId = () => Math.random().toString(36).slice(2, 9)

/** Colored pill classes per release status. */
const STATUS_PILL: Record<Release['status'], string> = {
  Released: 'bg-emerald-500/10 text-emerald-600',
  'In progress': 'bg-accent/10 text-accent',
  Planned: 'bg-bg-tertiary text-muted',
}

/** Releases (features) settings page. */
export function ReleasesSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  const enabled = featureSettings['releases.enabled'] ?? false
  const autoChangelog = featureSettings['releases.autoChangelog'] ?? true
  const isPublic = featureSettings['releases.public'] ?? false

  const [releases, setReleases] = useState<Release[]>([
    { id: genId(), version: 'v2.4.0', date: 'Shipped Jun 10, 2026', count: 24, status: 'Released' },
    { id: genId(), version: 'v2.5.0', date: 'Target Jul 1, 2026', count: 11, status: 'In progress' },
    { id: genId(), version: 'v2.6.0', date: 'Unscheduled', count: 0, status: 'Planned' },
  ])

  const addRelease = () =>
    setReleases((prev) => [
      ...prev,
      { id: genId(), version: 'v0.0.0', date: 'Unscheduled', count: 0, status: 'Planned' },
    ])

  const removeRelease = (id: string) =>
    setReleases((prev) => prev.filter((r) => r.id !== id))

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Releases</h1>
      <p className="mt-1 text-[13px] text-muted">
        Group completed issues into versioned releases and share changelogs.
      </p>

      <div className="mt-7 space-y-9">
        {/* Master enable */}
        <Card>
          <Row
            title="Enable releases"
            description="Version your shipped work and publish changelogs"
            control={
              <Toggle
                on={enabled}
                onChange={(next) => setFeatureSetting('releases.enabled', next)}
              />
            }
          />
        </Card>

        {enabled ? (
          <>
            {/* Releases list */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-fg">Releases</h2>
                <button
                  type="button"
                  onClick={addRelease}
                  className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
                >
                  <Plus size={14} />
                  New release
                </button>
              </div>
              <Card>
                {releases.map((release) => (
                  <div
                    key={release.id}
                    className="flex items-center justify-between gap-4 px-4 py-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-tertiary text-muted">
                        <Tag size={15} />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-fg">{release.version}</div>
                        <div className="mt-0.5 text-[12px] text-muted">
                          {release.count} issues · {release.date}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          STATUS_PILL[release.status],
                        )}
                      >
                        {release.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRelease(release.id)}
                        aria-label="Remove release"
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-bg-hover hover:text-fg"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            </section>

            {/* Changelog */}
            <section>
              <h2 className="mb-3 text-[13px] font-semibold text-fg">Changelog</h2>
              <Card>
                <Row
                  title="Auto-generate changelog from completed issues"
                  description="Compile shipped issues into a release changelog automatically"
                  control={
                    <Toggle
                      on={autoChangelog}
                      onChange={(next) => setFeatureSetting('releases.autoChangelog', next)}
                    />
                  }
                />
                <Row
                  title="Publish changelog publicly"
                  description="Share a public changelog page with your customers"
                  control={
                    <Toggle
                      on={isPublic}
                      onChange={(next) => setFeatureSetting('releases.public', next)}
                    />
                  }
                />
              </Card>
            </section>
          </>
        ) : (
          <p className="text-[13px] text-muted">
            Turn on releases to start versioning your work.
          </p>
        )}
      </div>
    </div>
  )
}
