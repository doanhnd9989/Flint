# Backlog — Linear feature parity

The 5-minute loop works **top-to-bottom**. Pick the first unchecked item, build
it faithfully to Linear, verify (typecheck + build + browser), then check it off
and log it in `PROGRESS.md`. Add newly discovered Linear features to the bottom.

Priority key: 🔴 core · 🟡 important · 🟢 polish

## ✅ Done (MVP)

- [x] App shell: sidebar, routing, theme (light/dark/system)
- [x] Issues list grouped by status, tabs Active / Backlog / All
- [x] Board (kanban) view with drag-and-drop between columns
- [x] Issue detail: title, description, sub-issues, comments, activity feed
- [x] Right-sidebar property pickers: status, priority, assignee, estimate, labels, project
- [x] Create-issue modal with all properties (⌘↵ to submit)
- [x] Command menu (⌘K): navigate, actions, jump to any issue
- [x] Property pickers as reusable searchable menus
- [x] My Issues, Inbox/notifications, Projects, Project detail, Views, Settings
- [x] Global keyboard shortcuts (⌘K, C, I, M)
- [x] localStorage persistence

## 🔜 To build (in priority order)

- [x] 🔴 **Filtering bar** — add/remove filters (status, assignee, priority, label, project) with active filter chips; wired into `IssuesView`. _(Persist-per-view still TODO.)_
- [x] 🔴 **Issue peek panel** — click a row opens issue in a right-side panel (Linear's split view) without leaving the list; Esc closes. _(Board cards still navigate full-page — could also peek.)_
- [x] 🔴 **Sub-issue progress rollup** — `done/total` + bar on the parent's sub-issue header, a progress-donut badge on parent rows, and a parent breadcrumb on sub-issue detail/peek.
- [x] 🔴 **Bulk selection & actions** — row + group-header checkboxes, floating action bar (status/priority/assignee/label/delete), Esc/Clear/route-change clears. _(Shift-range select and the `X` hotkey still TODO.)_
- [x] 🔴 **Right-click context menu** on issue rows — status, priority, assignee, labels (reusing the property pickers as sub-menus), open in peek / full page, copy id, delete.
- [x] 🔴 **Cycles (sprints)** — cycle view with active/upcoming/past badge, prev/next navigation, scope/started/completed/progress stats + stacked progress bar, and issues-in-cycle grouped by status. Sidebar + ⌘K entry. _(Burndown chart still TODO.)_
- [x] 🟡 **Issue relations** — blocks / blocked-by / related / duplicate-of, stored canonically and shown (with inverses derived) in the issue detail; add via per-kind issue pickers, remove inline.
- [x] 🟡 **Rich-text description editor** — click-to-edit Markdown: headings, bold/italic, inline + fenced code, bullet/ordered/task lists (interactive checkboxes), blockquotes, links, hr. Dependency-free renderer (React nodes, no XSS). _(Full WYSIWYG / slash-commands still TODO.)_
- [x] 🟡 **@mentions** in comments and descriptions — `@`-triggered user autocomplete (arrow/enter/tab/esc), inserts a `@[Name](id)` token rendered as a chip via the Markdown renderer. Comments now render Markdown too.
- [x] 🟡 **Emoji reactions** on comments — reaction pills (emoji + count, highlighted when you reacted, reactor names on hover) and an emoji-picker popover to add; toggling removes your reaction.
- [x] 🟡 **Due-date picker** — month calendar popover (prev/next, Today, Clear) on the issue's Due date property; overdue (red) / due-soon (amber) styling on the property and in issue rows.
- [x] 🟡 **Labels management** in settings — create / rename (inline) / recolor (swatch picker) / delete (with usage count; removes the label from all issues). _(Label groups still TODO.)_
- [x] 🟡 **Custom workflow states** in settings — add / rename / recolor / change type / reorder (within type) / delete (reassigns affected issues). Lives in a "Workflow states" Settings card.
- [x] 🟡 **Issue templates** — a Template picker in the create modal prefills title/description/priority/labels/status; manage templates (create with fields, delete) in a Settings card. Seeded Bug report + Feature request.
- [x] 🟡 **Saved views** — "Save view" in the Issues header captures layout+group+sort+filters as a named view; views open at `/view/:id` (workspace-wide), are editable (edits persist back to the view), and are listed/deletable under "Views".
- [x] 🟡 **Triage** — a per-team queue of incoming issues (`triage` flag) with Accept (into the workflow) / Decline (cancel); inline status/priority/assignee/label pickers, a sidebar entry with a count badge, and an empty state. Triage issues are hidden from the normal issue lists.
- [x] 🟡 **Full-text search** view (`/search`) — substring search across issue id/title/description and project name/description, narrowable with the filter bar, grouped results, and persisted recent searches (click to re-run, Clear). Sidebar "Search" now opens it.
- [x] 🟡 **Manual drag-to-reorder** issues within a list group — dnd-kit sortable rows in `GroupedIssueList`; dropping writes a midpoint `sortOrder` and switches the Issues view to Manual ordering. _(Same-group only; cross-group moves stay on the board / pickers.)_
- [x] 🟡 **Keyboard shortcuts help overlay** (press `?`) — categorized shortcut reference; added `G`-prefixed navigation chords (G I/M/B/C/T/P/V/S) and a ⌘K "Keyboard shortcuts" command. _(Row-level assign/status/priority hotkeys still TODO.)_
- [x] 🟡 **Project milestones** — the project detail groups issues by milestone with per-milestone progress bars (+ "No milestone"); add milestones from the header, delete inline; a Milestone property picker on issues in a milestoned project.
- [x] 🟡 **Project updates** — post health updates (on-track / at-risk / off-track) with a markdown body from an Updates tab; reverse-chronological timeline with delete; the project header shows the latest health badge.
- [x] 🟢 **Roadmap / timeline** view (`/roadmap`) — projects as horizontal bars on a month axis, sized/positioned by start→target dates, colored per project with a progress fill and a "today" marker; click a bar to open the project. Sidebar + ⌘K + `G R`.
- [x] 🟢 **Favorites** — a star button on issue / project / saved-view headers toggles a persisted favorite; starred items appear in a "Favorites" section in the sidebar (click to open).
- [ ] 🟢 **List virtualization** for large lists (fixes the seeded perf issue CLA-5).
- [ ] 🟢 **Multi-team** polish — team switcher, per-team settings, team membership.
- [ ] 🟢 **Members & roles** management in settings; invite flow (mock).
- [ ] 🟢 **Notification detail** — snooze, per-type preferences, mark-read-on-open.
- [ ] 🟢 **Activity types** — render every change kind (priority/label/project/estimate/due) with diffs.
- [ ] 🟢 **Git branch name** copy + "Copy issue URL", more issue context actions.
- [ ] 🟢 **Command menu contextual actions** — when viewing an issue, ⌘K offers status/assignee/label/priority for it.
- [ ] 🟢 **Empty states & onboarding** polish to match Linear.
- [ ] 🟢 **Import / export** issues as JSON/CSV.

## Discovered later

_(loop appends new Linear features it notices here)_
