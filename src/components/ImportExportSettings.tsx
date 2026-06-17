import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { Popover } from './ui/Popover'
import {
  toExportRows,
  rowsToCsv,
  rowsToJson,
  parseImportFile,
  downloadFile,
} from '@/lib/importExport'

/** A bordered row inside a settings region: left label, right control. */
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[13px] text-fg">{label}</div>
        {hint && <div className="truncate text-[12px] text-faint">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

const dateStamp = () => new Date().toISOString().slice(0, 10)

/** Mock the time the backend would spend preparing the export file. */
const EXPORT_PREP_MS = 2500

export function ImportExportSettings() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<string | null>(null)
  const [pending, setPending] = useState<'csv' | 'json' | null>(null)
  const myEmail = useStore(
    (s) => s.users.find((u) => u.id === s.currentUserId)?.email ?? '',
  )

  /**
   * Linear's export is async: clicking Export confirms with a "Check your
   * email" toast, the backend prepares the file, then it emails a download
   * link. We have no backend, so we mock the prepare delay and surface the
   * ready file as a "Download" action on a second toast (our stand-in for the
   * emailed link).
   */
  function exportAs(format: 'csv' | 'json') {
    if (pending) return
    setPending(format)
    toast({
      title: 'Check your email',
      message: `Once the export is ready, it will be emailed to you${
        myEmail ? ` (${myEmail})` : ''
      }.`,
    })

    setTimeout(() => {
      const rows = toExportRows(useStore.getState())
      const stamp = dateStamp()
      const name = `issues-${stamp}.${format}`
      const upper = format.toUpperCase()
      setPending(null)
      toast({
        title: 'Export ready',
        message: `Your ${upper} export is ready to download.`,
        duration: 30000,
        action: {
          label: 'Download',
          onClick: () =>
            format === 'csv'
              ? downloadFile(name, rowsToCsv(rows), 'text/csv')
              : downloadFile(name, rowsToJson(rows), 'application/json'),
        },
      })
    }, EXPORT_PREP_MS)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const rows = parseImportFile(file.name, String(reader.result))
        if (!rows.length) {
          setResult('No issues found in that file.')
          return
        }
        const n = useStore.getState().importIssues(rows)
        setResult(`Imported ${n} issue${n === 1 ? '' : 's'} from ${file.name}.`)
      } catch {
        setResult(`Couldn’t parse ${file.name}. Expected CSV or JSON.`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      {/* Import */}
      <div>
        <h3 className="text-[13px] font-semibold text-fg">Import</h3>
        <p className="mt-1 text-[12px] text-muted">
          Import issues from a CSV or JSON file. This tool creates a copy of them
          in your workspace.
        </p>
        <div className="mt-3 rounded-lg border border-border">
          <Row label="Issue data" hint="Accepts .csv and .json files">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={onFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-md border border-border px-2.5 py-1 text-[13px] text-fg hover:bg-bg-hover"
            >
              Import…
            </button>
          </Row>
        </div>
        {result && <p className="mt-2 text-[12px] text-muted">{result}</p>}
      </div>

      {/* Export */}
      <div>
        <h3 className="text-[13px] font-semibold text-fg">Export</h3>
        <p className="mt-1 text-[12px] text-muted">
          You can export your issue data in CSV or JSON format. Once the export
          is available, we’ll email you the download link.
        </p>
        <div className="mt-3 rounded-lg border border-border">
          <Row
            label="Issue data"
            hint={pending ? `Preparing ${pending.toUpperCase()} export…` : undefined}
          >
            {pending ? (
              <span className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[13px] text-muted">
                <Loader2 size={13} className="animate-spin" />
                Exporting…
              </span>
            ) : (
            <Popover
              align="end"
              width={160}
              trigger={
                <span className="rounded-md border border-border px-2.5 py-1 text-[13px] text-fg hover:bg-bg-hover">
                  Export…
                </span>
              }
            >
              {(close) => (
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => {
                      exportAs('csv')
                      close()
                    }}
                    className="rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
                  >
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportAs('json')
                      close()
                    }}
                    className="rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-bg-hover"
                  >
                    Export as JSON
                  </button>
                </div>
              )}
            </Popover>
            )}
          </Row>
        </div>
      </div>
    </div>
  )
}
