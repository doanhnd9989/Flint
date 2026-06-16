# Progress log

Newest first. Each loop iteration appends one entry.

## 2026-06-16 — Loop #1: Filtering bar

Added a Linear-style filter system to the Issues view:

- New `src/components/FilterBar.tsx`: a "Filter" button opens a dimension menu
  (Status / Assignee / Priority / Label / Project); each dimension has a
  multi-select value list. Active filters render as chips (`Priority · Urgent ×`)
  that re-open the value picker; per-chip remove + global "Clear".
- Wired into `IssuesView` via `FilterState` (replacing the hardcoded empty object),
  applied through the existing `filterIssues` selector; added to the memo deps.
- Verified in browser: selecting Priority → Urgent narrows the list to CLA-5.
- `npx tsc -b` ✅ · `npm run build` ✅ · no console errors.

Next: **Issue peek panel** (open issue in a right-side split without leaving the list).


## 2026-06-16 — MVP foundation (initial build)

Scaffolded the Linear clone and shipped a working MVP, verified in the browser:

- Vite + React 19 + TS + Tailwind v4 + Zustand + React Router + dnd-kit.
- Design system modeled on Linear (light/dark tokens, status & priority glyphs).
- Sidebar, issues list grouped by status (Active/Backlog/All tabs), kanban board
  with drag-and-drop, issue detail with property pickers / sub-issues / comments /
  activity, create-issue modal, command menu (⌘K), My Issues, Inbox, Projects,
  Project detail, Views, Settings, theme switching, keyboard shortcuts, persistence.
- Fixed Zustand v5 infinite-loop (object selectors now go through `useStoreShallow`).
- `npx tsc -b` ✅ · `npm run build` ✅ · browser verified (row nav + ⌘K working).

Next: see top of `BACKLOG.md` → **Filtering bar**.
