// Issue import / export — CSV + JSON, name-based so both formats round-trip.
//
// Linear's import assistant "creates a copy" of issues rather than overwriting,
// and its export emits readable columns (Team, Status, Assignee names, …) — we
// mirror that: every reference is serialized by its human-readable name and
// resolved back against the workspace on import (see `importIssues` in store).

import { PRIORITY_LABELS } from './constants'
import type { Priority } from './types'
import type { WorkspaceData } from './seed'

/** A normalized, name-based issue record shared by both formats. */
export interface ImportRow {
  id?: string
  team?: string
  title: string
  description?: string
  status?: string
  priority?: string
  assignee?: string
  labels?: string[]
  project?: string
  milestone?: string
  estimate?: string
  dueDate?: string
  createdAt?: string
  updatedAt?: string
  completedAt?: string
}

/** Columns in the exported CSV, in order — matches Linear's readable export. */
const COLUMNS: { header: string; key: keyof ImportRow }[] = [
  { header: 'ID', key: 'id' },
  { header: 'Team', key: 'team' },
  { header: 'Title', key: 'title' },
  { header: 'Description', key: 'description' },
  { header: 'Status', key: 'status' },
  { header: 'Priority', key: 'priority' },
  { header: 'Assignee', key: 'assignee' },
  { header: 'Labels', key: 'labels' },
  { header: 'Project', key: 'project' },
  { header: 'Milestone', key: 'milestone' },
  { header: 'Estimate', key: 'estimate' },
  { header: 'Due Date', key: 'dueDate' },
  { header: 'Created', key: 'createdAt' },
  { header: 'Updated', key: 'updatedAt' },
  { header: 'Completed', key: 'completedAt' },
]

/** Turn the workspace's issues into readable, name-based rows. */
export function toExportRows(s: WorkspaceData): ImportRow[] {
  const team = (id: string) => s.teams.find((t) => t.id === id)
  const state = (id: string) => s.states.find((x) => x.id === id)
  const user = (id?: string) => s.users.find((u) => u.id === id)
  const project = (id?: string) => s.projects.find((p) => p.id === id)
  const milestone = (id?: string) => s.milestones.find((m) => m.id === id)
  const label = (id: string) => s.labels.find((l) => l.id === id)

  return s.issues
    .filter((i) => !i.triage)
    .map((i) => ({
      id: i.identifier,
      team: team(i.teamId)?.name,
      title: i.title,
      description: i.description,
      status: state(i.stateId)?.name,
      priority: PRIORITY_LABELS[i.priority],
      assignee: user(i.assigneeId)?.name,
      labels: i.labelIds.map((id) => label(id)?.name).filter(Boolean) as string[],
      project: project(i.projectId)?.name,
      milestone: milestone(i.milestoneId)?.name,
      estimate: i.estimate != null ? String(i.estimate) : undefined,
      dueDate: i.dueDate,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      completedAt: i.completedAt,
    }))
}

// ── CSV ──────────────────────────────────────────────────────────

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function rowsToCsv(rows: ImportRow[]): string {
  const head = COLUMNS.map((c) => c.header).join(',')
  const body = rows.map((r) =>
    COLUMNS.map((c) => {
      const v = r[c.key]
      const text = Array.isArray(v) ? v.join(', ') : (v ?? '')
      return escapeCsv(String(text))
    }).join(','),
  )
  return [head, ...body].join('\n')
}

/** RFC-4180-ish parser: handles quoted fields, escaped quotes, embedded newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const HEADER_TO_KEY: Record<string, keyof ImportRow> = Object.fromEntries(
  COLUMNS.map((c) => [c.header.toLowerCase(), c.key]),
)

export function csvToRows(text: string): ImportRow[] {
  const table = parseCsv(text)
  if (table.length < 2) return []
  const headers = table[0].map((h) => h.trim().toLowerCase())
  return table.slice(1).map((cells) => {
    const row: Partial<ImportRow> = {}
    headers.forEach((h, idx) => {
      const key = HEADER_TO_KEY[h]
      if (!key) return
      const value = (cells[idx] ?? '').trim()
      if (key === 'labels') {
        row.labels = value
          ? value.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
          : []
      } else if (value) {
        ;(row as Record<string, unknown>)[key] = value
      }
    })
    return { title: row.title ?? 'Untitled', ...row } as ImportRow
  })
}

// ── JSON ─────────────────────────────────────────────────────────

export function rowsToJson(rows: ImportRow[]): string {
  return JSON.stringify(rows, null, 2)
}

export function jsonToRows(text: string): ImportRow[] {
  const data = JSON.parse(text)
  const arr: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { issues?: unknown[] })?.issues)
      ? (data as { issues: unknown[] }).issues
      : []
  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((o) => {
      const labels = o.labels
      return {
        ...o,
        title: typeof o.title === 'string' && o.title.trim() ? o.title : 'Untitled',
        labels: Array.isArray(labels)
          ? labels.map(String)
          : typeof labels === 'string' && labels
            ? labels.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
            : [],
      } as ImportRow
    })
}

/** Parse a file's text by extension; CSV falls back if JSON.parse throws. */
export function parseImportFile(name: string, text: string): ImportRow[] {
  const lower = name.toLowerCase()
  if (lower.endsWith('.json')) return jsonToRows(text)
  if (lower.endsWith('.csv')) return csvToRows(text)
  // Unknown extension: try JSON, then CSV.
  try {
    return jsonToRows(text)
  } catch {
    return csvToRows(text)
  }
}

// ── download ─────────────────────────────────────────────────────

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Map a priority label (or number) back to the numeric scale. */
export function parsePriority(value: string | undefined): Priority {
  if (!value) return 0
  const byNum = Number(value)
  if (Number.isInteger(byNum) && byNum >= 0 && byNum <= 4) return byNum as Priority
  const match = (Object.entries(PRIORITY_LABELS) as [string, string][]).find(
    ([, label]) => label.toLowerCase() === value.trim().toLowerCase(),
  )
  return match ? (Number(match[0]) as Priority) : 0
}
