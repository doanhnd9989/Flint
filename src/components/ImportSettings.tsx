import { Check } from 'lucide-react'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

type ImportSource = {
  id: string
  name: string
  /** Single-letter badge glyph (monochrome, token-colored). */
  initial: string
  desc: string
}

const SOURCES: ImportSource[] = [
  {
    id: 'jira',
    name: 'Jira',
    initial: 'J',
    desc: 'Bring over Jira issues, statuses and assignees into Flint.',
  },
  {
    id: 'asana',
    name: 'Asana',
    initial: 'A',
    desc: 'Import Asana tasks and projects as Flint issues.',
  },
  {
    id: 'github',
    name: 'GitHub Issues',
    initial: 'G',
    desc: 'Pull open and closed GitHub issues from your repositories.',
  },
  {
    id: 'shortcut',
    name: 'Shortcut',
    initial: 'S',
    desc: 'Move your Shortcut stories and epics into Flint.',
  },
  {
    id: 'trello',
    name: 'Trello',
    initial: 'T',
    desc: 'Turn Trello cards and lists into issues and workflow states.',
  },
  {
    id: 'linear',
    name: 'Linear',
    initial: 'L',
    desc: 'Import an existing Linear export to migrate your workspace.',
  },
  {
    id: 'csv',
    name: 'CSV',
    initial: 'C',
    desc: 'Comma-separated values — pairs with the CSV importer in Import & export.',
  },
  {
    id: 'height',
    name: 'Height',
    initial: 'H',
    desc: 'Migrate Height tasks and their fields into Flint.',
  },
]

/** Linear's Import admin page — choose a source to import issues from. */
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
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Import</h1>
      <p className="mt-1 text-[13px] text-muted">
        Move your issues into Flint from another tool.
      </p>

      <div className="mt-7 space-y-9">
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

        <p className="text-[12px] text-muted">
          Imports run in the background and never overwrite existing issues.
        </p>
      </div>
    </div>
  )
}
