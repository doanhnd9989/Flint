import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/** A bordered settings card grouping related rows. */
function Card({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-secondary">
      {children}
    </div>
  )
}

/** A single settings row: title + description on the left, control on the right. */
function Row({
  title,
  desc,
  control,
}: {
  title: string
  desc?: string
  control: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg">{title}</div>
        {desc && <div className="mt-0.5 text-[12px] text-muted">{desc}</div>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

/** Linear-style pill toggle. */
function Toggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-[18px] w-[30px] rounded-full transition-colors',
        on ? 'bg-accent' : 'bg-bg-tertiary',
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 h-[14px] w-[14px] rounded-full bg-white transition-transform',
          on && 'translate-x-[14px]',
        )}
      />
    </button>
  )
}

/** Documents feature settings — Linear's Documents (features) page. */
export function DocumentsSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)
  const documents = useStore((s) => s.documents)

  const get = (key: string, fallback: boolean) =>
    featureSettings[key] ?? fallback

  const enabled = get('documents.enabled', true)

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Documents</h1>
      <p className="mt-1 text-[13px] text-muted">
        Write and share rich-text documents alongside your projects.
      </p>

      <div className="mt-7 space-y-9">
        {/* Master enable */}
        <Card>
          <Row
            title="Enable documents"
            desc="Show Documents in the sidebar."
            control={
              <Toggle
                on={enabled}
                onChange={(on) => setFeatureSetting('documents.enabled', on)}
              />
            }
          />
          {enabled && (
            <div className="px-4 py-2.5 text-[12px] text-muted">
              {documents.length} documents in this workspace
            </div>
          )}
        </Card>

        {enabled ? (
          <>
            {/* Permissions */}
            <Card>
              <Row
                title="Default access"
                control={
                  <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[13px] font-medium text-fg">
                    Workspace
                    <ChevronDown size={14} className="text-faint" />
                  </div>
                }
              />
              <Row
                title="Allow members to create documents"
                control={
                  <Toggle
                    on={get('documents.allowCreate', true)}
                    onChange={(on) => setFeatureSetting('documents.allowCreate', on)}
                  />
                }
              />
              <Row
                title="Allow guests to view shared documents"
                control={
                  <Toggle
                    on={get('documents.guestView', false)}
                    onChange={(on) => setFeatureSetting('documents.guestView', on)}
                  />
                }
              />
            </Card>

            {/* Editing */}
            <Card>
              <Row
                title="Enable comments on documents"
                control={
                  <Toggle
                    on={get('documents.comments', true)}
                    onChange={(on) => setFeatureSetting('documents.comments', on)}
                  />
                }
              />
              <Row
                title="Enable suggestions mode"
                control={
                  <Toggle
                    on={get('documents.suggestions', false)}
                    onChange={(on) => setFeatureSetting('documents.suggestions', on)}
                  />
                }
              />
              <Row
                title="Auto-save drafts"
                control={
                  <Toggle
                    on={get('documents.autosave', true)}
                    onChange={(on) => setFeatureSetting('documents.autosave', on)}
                  />
                }
              />
            </Card>
          </>
        ) : (
          <p className="text-[13px] text-muted">
            Turn on documents to start writing.
          </p>
        )}
      </div>
    </div>
  )
}
