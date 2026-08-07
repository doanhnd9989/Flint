import { ArrowUpRight, Check } from 'lucide-react'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { ImportExportSettings } from './ImportExportSettings'

type ImportSource = {
  id: string
  name: string
  /** Single-letter badge glyph (monochrome, token-colored). */
  initial: string
  desc: string
}

// Linear's Import assistant lists Asana, Shortcut, GitHub, Jira, Linear in that
// order; the three after it are ours. Asana used to appear twice under the same
// id, which rendered a duplicate row on a duplicate React key.
const SOURCES: ImportSource[] = [
  {
    id: 'asana',
    name: 'Asana',
    initial: 'A',
    desc: 'Import Asana tasks and projects as Flint issues.',
  },
  {
    id: 'shortcut',
    name: 'Shortcut',
    initial: 'S',
    desc: 'Move your Shortcut stories and epics into Flint.',
  },
  {
    id: 'github',
    name: 'GitHub Issues',
    initial: 'G',
    desc: 'Pull open and closed GitHub issues from your repositories.',
  },
  {
    id: 'jira',
    name: 'Jira',
    initial: 'J',
    desc: 'Bring over Jira issues, statuses and assignees into Flint.',
  },
  {
    id: 'linear',
    name: 'Linear',
    initial: 'L',
    desc: 'Move issues, cycles and projects over from a Linear workspace.',
  },
  {
    id: 'trello',
    name: 'Trello',
    initial: 'T',
    desc: 'Turn Trello cards and lists into issues and workflow states.',
  },
  {
    id: 'csv',
    name: 'CSV',
    initial: 'C',
    desc: 'Comma-separated values — pairs with the CSV importer below.',
  },
  {
    id: 'height',
    name: 'Height',
    initial: 'H',
    desc: 'Migrate Height tasks and their fields into Flint.',
  },
]

/**
 * Settings → Import & export (Linear's `/settings/import-export`). Linear
 * stacks three sections here: `Import assistant` (the source tiles), `CLI
 * import`, then `Export`. Our file-based CSV/JSON import sits between the last
 * two — it has no Linear counterpart, so it does not displace one.
 */
export function ImportSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  const startImport = (source: ImportSource) => {
    setFeatureSetting(`import.${source.id}.done`, true)
    toast({
      title: `${source.name} import started`,
      message: `We'll email you when your ${source.name} issues are ready.`,
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Import &amp; export</h1>

      <div className="mt-7 space-y-9">
        <div>
        <h2 className="text-[13px] font-semibold text-fg">Import assistant</h2>
        <p className="mb-3 mt-0.5 text-[12px] text-muted">
          If you use another service to track issues, this tool will create a copy of
          them in Flint.{' '}
          <a href="/api-docs" className="text-fg underline-offset-2 hover:underline">
            Docs
          </a>
        </p>
        <div className="divide-y divide-border rounded-xl border border-border">
          {SOURCES.map((source) => {
            const done = featureSettings[`import.${source.id}.done`] ?? false
            return (
              <div
                key={source.id}
                className="flex items-center justify-between gap-4 px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-tertiary text-[13px] font-semibold text-muted">
                    {source.initial}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-fg">{source.name}</div>
                    <div className="mt-0.5 text-[12px] text-muted">{source.desc}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startImport(source)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium',
                    done
                      ? 'text-muted hover:text-fg'
                      : 'border border-border bg-bg-elevated text-fg hover:bg-bg-hover',
                  )}
                >
                  {done ? (
                    <>
                      <Check size={13} />
                      Imported
                    </>
                  ) : (
                    'Import'
                  )}
                </button>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[12px] text-muted">
          Imports run in the background and never overwrite existing issues.
        </p>
        </div>

        {/* CLI import — Linear's second section, a single row with an Open link */}
        <div>
          <h2 className="text-[13px] font-semibold text-fg">CLI import</h2>
          <p className="mb-3 mt-0.5 text-[12px] text-muted">
            Import issues using our open-source command line tool. Supports Asana (CSV),
            Jira (CSV), GitHub (API), Pivotal Tracker (CSV), Shortcut (CSV), and Trello
            (JSON).
          </p>
          <div className="rounded-xl border border-border">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="text-[13px] text-fg">CLI Importer</div>
              <a
                href="/api-docs"
                className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-muted hover:bg-bg-hover hover:text-fg"
              >
                Open
                <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
        </div>

        <ImportExportSettings />
      </div>
    </div>
  )
}
