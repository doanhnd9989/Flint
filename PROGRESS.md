# Progress log

Newest first. Each loop iteration appends one entry.

## 2026-06-17 — Loop #15: Saved views

Persist a configured issue view, Linear-style:

- Store: `createView` / `updateView` / `deleteView` over the existing
  `savedViews` slice.
- `IssuesView`: a "Save view" button captures the current layout + grouping +
  ordering + filters as a named `SavedView` and opens it.
- New `views/SavedViewScreen.tsx` at `/view/:id`: renders the view workspace-wide
  with its grouping/ordering/filters; the Display menu and filter bar are live
  and persist edits back to the view via `updateView`.
- `ViewsView`: lists saved views (open on click, hover-delete) instead of the
  old stub.
- Verified live: "Save view" → "My Saved View" created and opened at
  `/view/v_…` showing all statuses; it appears alongside seed "Active" under
  Views. `tsc` ✅ · build ✅ · clean console.

Next: **Triage** — inbox of unassigned/incoming issues with accept/decline.


## 2026-06-17 — Loop #14: Issue templates

Spin up issues from reusable templates, Linear-style:

- `types.ts`: `IssueTemplate` (name + default title/description/priority/labels/
  state/assignee). Store slice + `createTemplate` / `deleteTemplate`.
- `seed.ts`: two starter templates — "Bug report" (steps/expected/actual,
  High, Bug label, Todo) and "Feature request" (problem/solution, Medium,
  Feature label, Backlog).
- `CreateIssueModal`: a "Template" picker in the header prefills the whole form
  from the chosen template.
- New `components/TemplatesSettings.tsx` (in a Settings "Templates" card): lists
  templates with a usage summary + delete, and a form to author new ones
  (name, title, description, priority, labels).
- Verified live: opening the create modal and picking "Bug report" prefilled
  title "[Bug]", the steps-to-reproduce description, Todo, High, and the Bug
  label. `tsc` ✅ · build ✅ · clean console.

Next: **Saved views** — persist filter+group+sort as a named view under "Views".


## 2026-06-17 — Loop #13: Custom workflow states

Customize a team's statuses, Linear-style:

- Store: `updateState` (name/color/type), `deleteState` (reassigns issues on the
  removed status to a fallback; blocked when only one status remains), and
  `moveState(id, up|down)` (swaps `position` with the adjacent status of the same
  type). Imported `STATUS_TYPE_ORDER` for ordering.
- New `components/StatesSettings.tsx`: each status shows its glyph + a color-swatch
  popover, an inline name, a type `<select>`, a live usage count, and hover
  up/down/delete controls; plus a "new status" row.
- `SettingsView`: a "Workflow states" card hosts it (above Labels).
- Verified live: moved "In Review" above "In Progress" (swap within the Started
  group) and back. `tsc` ✅ · build ✅ · clean console.

Next: **Issue templates** (create issues from a saved template).


## 2026-06-17 — Loop #12: Labels management in Settings

Manage the workspace's labels, Linear-style:

- Store: `updateLabel(id, {name?, color?})` and `deleteLabel(id)` (the latter
  also strips the label from every issue's `labelIds`).
- New `components/LabelsSettings.tsx`: a list of labels each with a color-swatch
  popover (recolor), an inline-editable name, a live usage count, and a
  hover delete; plus a "new label" row (name + color, Enter or Add to create).
- `SettingsView`: a new "Labels" card hosts it.
- Verified live: created a "Backend" label which appeared with "0 issues".
  `tsc` ✅ · build ✅ · clean console.

Next: **Custom workflow states** in settings (add / rename / recolor / reorder per team).


## 2026-06-17 — Loop #11: Due-date picker + overdue styling

Issues can be scheduled with a real calendar, Linear-style:

- New `components/DatePicker.tsx`: a month-grid calendar popover (date-fns based)
  with prev/next month, a Today shortcut and Clear; built on the `Popover` primitive.
- `IssueDetailBody`: the Properties sidebar gained a "Due date" row using the
  picker; the value is colored red when overdue and amber when due soon
  (≤3 days). Removed the old read-only due-date line.
- `IssueRow`: due dates now show a calendar-clock icon and the same
  overdue/due-soon/normal coloring.
- `seed.ts`: CLA-5 now has a due date in 2 days to showcase the styling.
- Verified live: "Set due date" opened the calendar, picking the 20th set
  "June 20, 2026" shown in amber (due soon). `tsc` ✅ · build ✅ · clean console.

Next: **Labels management** in settings (create / rename / recolor / delete).


## 2026-06-17 — Loop #10: Emoji reactions on comments

React to comments with emoji, Linear-style:

- `types.ts`: `Comment.reactions?: Record<emoji, userIds>`.
- Store: `toggleReaction(commentId, emoji)` adds/removes the current user and
  drops the emoji key when it hits zero.
- New `components/CommentReactions.tsx`: reaction pills (emoji + count,
  accent-highlighted when you've reacted, reactor names in the title) plus a
  smiley button opening a 12-emoji picker popover. Rendered under each comment
  body in `IssueDetailBody`.
- `seed.ts`: a sample comment carries 👍 / 🎉 reactions.
- Verified live: added 🚀 (pill showed "1", highlighted), clicked it to toggle
  off (pill removed). `tsc` ✅ · build ✅ · clean console.
- Note: this slice was interrupted mid-way and resumed; the routine cron was
  re-armed (job 4e1c0057).

Next: **Due-date picker** (calendar popover) + overdue / due-soon styling.


## 2026-06-16 — Loop #9: @mentions

Mention teammates in comments and descriptions:

- New `components/MentionInput.tsx`: a textarea with an inline `@` autocomplete
  over workspace users — detects `@query` at the caret, shows a filtered user
  dropdown (↑/↓/Enter/Tab to pick, Esc to dismiss), and inserts a
  `@[Name](userId)` token at the right spot.
- `lib/markdown.tsx`: renders the `@[Name](userId)` token as an accent-colored
  mention chip (added as the first inline rule).
- `IssueDetailBody`: comment box now uses `MentionInput` (⌘↵ to submit) and
  comment bodies render through `<Markdown>` (so mentions + markdown show).
- `MarkdownEditor`: its edit textarea is now a `MentionInput`, so descriptions
  also get `@` autocomplete.
- `seed.ts`: a sample comment mentions Avery Chen.
- Verified live: typing `@av` showed Avery in the dropdown, selecting inserted
  the token, posting rendered "Thanks @Avery Chen" as a chip. `tsc` ✅ · build ✅ ·
  clean console.

Next: **Emoji reactions** on comments.


## 2026-06-16 — Loop #8: Rich-text (Markdown) description editor

The issue description is now a click-to-edit Markdown field:

- New `lib/markdown.tsx`: a dependency-free Markdown renderer returning React
  nodes (no `dangerouslySetInnerHTML` → no XSS). Supports headings, bold/italic,
  inline + fenced code, bullet/ordered/task lists, blockquotes, links, hr.
- New `components/MarkdownEditor.tsx`: renders Markdown, click to edit raw text,
  save on blur, Esc to cancel; task checkboxes toggle `[ ]`↔`[x]` in place
  without entering edit mode. Wired into `IssueDetailBody`.
- `seed.ts`: CLA-1 description showcases the formats.
- Verified: a description with `## heading`, task list, inline `code` and
  **bold** renders as h2 + 2 checkboxes (1 checked, struck through) + code + bold,
  and persists. `tsc` ✅ · `build` ✅ (EXIT=0) · no console errors.
- Infra note: the dev server's file watcher had silently died (HMR stopped
  logging after loop #1); restarted it with a cleared `.vite` cache. Future loops
  should serve fresh. The long "Markdown renders raw" investigation was a test
  artifact — programmatic `.blur()` doesn't fire React's onBlur, so the raw
  textarea was being observed, not the rendered output.

Next: **@mentions** in comments and descriptions, with a user autocomplete.


## 2026-06-16 — Loop #7: Issue relations

Issues can now reference each other, Linear-style:

- `types.ts`: `Relation { type: 'blocks'|'related'|'duplicate', fromIssueId,
  toIssueId }`, stored canonically once; inverses (blocked-by, duplicated-by)
  derived in the UI.
- Store: `relations` slice + `addRelation` (dedups, ignores self) / `removeRelation`;
  `deleteIssue` and `bulkDelete` now also prune relations.
- `seed.ts`: two sample relations (CLA-5 blocks CLA-7, CLA-6 related CLA-9).
- New `components/IssueRelations.tsx`: groups Blocking / Blocked by / Related /
  Duplicate of / Duplicated by, each row links to the issue with inline remove;
  add via four per-kind issue pickers. Rendered in `IssueDetailBody`.
- Verified: CLA-5 shows "Blocking → CLA-7" and CLA-7 shows the derived
  "Blocked by → CLA-5"; added a Related relation live. `tsc` ✅ · build ✅ · clean console.

Next: **Rich-text description editor** (markdown shortcuts, headings, checklists, code blocks).


## 2026-06-16 — Loop #6: Cycles (sprints)

Added a Cycles view, Linear's time-boxed sprint planning:

- New `views/CyclesView.tsx` at `/team/:teamKey/cycles`: a cycle header with an
  active/upcoming/past badge, date range + days-left, prev/next navigation across
  the team's cycles, Scope/Started/Completed/Progress stats, and a stacked
  progress bar (completed / started / remaining). Issues in the cycle are grouped
  by status (reusing GroupedIssueList).
- `selectors.ts`: `cycleProgress(cycleId, …)` (total/done/started/percent) and
  `cycleState(start, end, now)` (status + daysLeft).
- `seed.ts`: added an upcoming Cycle 2 so prev/next has range.
- Sidebar: a "Cycles" item under each team; "Go to Cycles" added to ⌘K.
- Verified: Cycle 1 shows Active, Scope 5 / Started 4 / Completed 1 / 20%, with
  the stacked bar and grouped issues. `tsc` ✅ · build ✅ · clean console.

Next: **Issue relations** (blocks / blocked-by / related / duplicate-of in the issue detail).


## 2026-06-16 — Loop #5: Right-click context menu

Right-clicking an issue row opens a Linear-style context menu:

- New `components/IssueContextMenu.tsx`: a portal panel at the cursor with
  Status / Priority / Assignee / Labels rows (each reuses the existing property
  picker as a sub-menu, showing the current value + chevron), plus Open in peek,
  Open full page, Copy issue ID, and Delete. Backdrop + Esc close it; picking a
  value applies it and closes.
- Store: transient `contextMenu {issueId,x,y}` + `openContextMenu` /
  `closeContextMenu` (excluded from persistence).
- `IssueRow`: `onContextMenu` opens the menu at the click position; mounted the
  menu in the app shell.
- Verified: right-click showed all 8 items; Status→In Progress moved CLA-11
  (In Progress 2→3) and closed the menu. `tsc` ✅ · build pending→green · clean console.

Next: **Cycles (sprints)** — cycle list, active/upcoming cycle, issues-in-cycle view, velocity.


## 2026-06-16 — Loop #4: Bulk selection & actions

Multi-select issues and act on them at once, Linear-style:

- Store: transient `selectedIssueIds` + `toggleSelectIssue` / `setSelectedIssues`
  / `clearSelection`, and batched `bulkSetStatus` / `bulkSetPriority` /
  `bulkSetAssignee` / `bulkAddLabel` / `bulkDelete` (excluded from persistence).
- `IssueRow`: hover-reveal checkbox, selected-row highlight; checkboxes stay
  visible while any selection is active.
- `GroupedIssueList`: group-header checkbox selects/clears the whole group.
- New `components/BulkActionBar.tsx`: floating bottom bar with count + Clear and
  Status / Priority / Assignee / Label / Delete pickers; Esc clears.
- `App` shell: mounted the bar; selection auto-clears on route change.
- Verified: selected 2 issues → bar showed "2 selected" → bulk Status→Done moved
  both (Todo 5→3, Done 1→3) → Clear hid the bar. `tsc` ✅ · `build` ✅ · clean console.

Next: **Right-click context menu** on issue rows (status/priority/assignee/labels/copy id/delete).


## 2026-06-16 — Loop #3: Sub-issue progress rollup

Parent ↔ sub-issue relationships are now visible end-to-end:

- `selectors.ts`: added `subIssueProgress(parentId, …)` → `{ total, done, percent }`.
- `IssueDetailBody`: the Sub-issues header shows `done/total` + a progress bar;
  a parent breadcrumb (`⌐ PARENT-ID title`) appears above the title on any issue
  that has a parent, and clicking it opens the parent (re-targets the peek).
- New `components/ProgressDonut.tsx`: a tiny SVG ring.
- `IssueRow`: parent issues show a `◔ done/total` donut badge.
- Verified in browser: added a sub-issue to CLA-1 → header showed `0/1` + bar,
  the parent row showed the `0/1` donut, and the sub-issue showed the CLA-1
  breadcrumb. `npx tsc -b` ✅ · `npm run build` ✅ · no console errors.

Next: **Bulk selection & actions** (X to select rows, shift-range, floating action bar).


## 2026-06-16 — Loop #2: Issue peek panel (split view)

Clicking an issue row now opens it in a right-side peek panel without leaving
the list — Linear's split view.

- Extracted the issue body + property sidebar into a shared
  `components/IssueDetailBody.tsx` (a `compact` prop tightens padding for the
  panel). The routed `IssueDetail` keeps its full-page header and reuses it.
- New `components/IssuePeek.tsx`: a right drawer (760px) with backdrop, header
  (copy / delete / open-full / close), Esc-to-close; reuses `IssueDetailBody`.
  Sub-issue clicks re-target the peek; "open full" navigates to the page.
- Store: transient `peekIssueId` + `setPeek` (excluded from persistence).
- `IssueRow` click now opens the peek instead of navigating; mounted `IssuePeek`
  in the app shell.
- Verified: URL stays on the list, panel shows the issue, Esc closes it, no
  console errors. `npx tsc -b` ✅ · `npm run build` ✅.

Next: **Sub-issue progress rollup** (done/total + bar on parent; parent breadcrumb).


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
