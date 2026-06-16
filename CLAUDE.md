# Linear Clone — Project Guide

A faithful clone of [Linear](https://linear.app) — a keyboard-driven issue
tracker and project-management platform. This file is the source of truth for
the autonomous 5-minute development loop. **Read it at the start of every loop
iteration.**

## Mission

Reproduce Linear's features 1:1. Whatever Linear has, this app should have:
issues, projects, cycles, board/list views, filtering, command menu, keyboard
shortcuts, notifications, sub-issues, relations, rich text — the whole product.
Match Linear's look, feel, speed and interaction model.

## Tech stack

- **Vite + React 19 + TypeScript** (strict, `verbatimModuleSyntax` → use `import type`)
- **Tailwind CSS v4** (tokens in `src/index.css`, utilities like `bg-bg`, `text-muted`)
- **Zustand** (`src/lib/store.ts`) with `persist` to localStorage — single source of state
- **React Router** (`src/App.tsx`) for navigation
- **@dnd-kit** for drag-and-drop
- **lucide-react** for icons
- Path alias: `@/` → `src/`

## Architecture

```
src/
  lib/
    types.ts       domain model (Issue, Project, Team, WorkflowState, …)
    store.ts       Zustand store + all mutations + useStoreShallow()
    seed.ts        initial workspace data
    selectors.ts   filter / sort / group helpers
    constants.ts   priorities, status order, label colors
    utils.ts       cn(), formatDate(), timeAgo(), id helpers
    useTheme.ts    applies light/dark to <html>
    useShortcuts.ts global keyboard shortcuts
  components/      reusable UI (Sidebar, IssueRow, IssueBoard, pickers, ui/*)
  views/           routed screens (IssuesView, IssueDetail, MyIssues, …)
```

### State rules (IMPORTANT — avoids infinite render loops)

- Zustand v5 does **not** shallow-compare. A selector that returns an **object
  literal** MUST use `useStoreShallow((s) => ({...}))`, never `useStore`.
- Single-value selectors (`useStore((s) => s.issues)`) and the no-arg
  `useStore()` are fine.

## Conventions

- Components are small and composable; match the existing comment density and naming.
- Use the design tokens (`text-fg`, `text-muted`, `text-faint`, `bg-bg`,
  `bg-secondary`, `border-border`, `bg-accent`). Don't hardcode hex except in
  `index.css` / icon `color` props.
- Every property mutation goes through a store action; never mutate state directly.
- Keep it keyboard-first: new surfaces should be reachable from ⌘K and/or a shortcut.

## Commands

- `npm run dev`    — dev server (already running on a local port; check the log)
- `npx tsc -b`     — typecheck (MUST pass, exit 0)
- `npm run build`  — full production build (MUST succeed)

## Definition of done for any change

1. `npx tsc -b` passes with no errors.
2. `npm run build` succeeds.
3. No new console errors in the browser (especially no "infinite loop" / "Maximum update depth").
4. The feature actually works and looks like Linear.

## The development loop

See `BACKLOG.md` for the prioritized feature queue and `PROGRESS.md` for the log.
Each iteration: fix any breakage first, then advance the top backlog item.
