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
- [ ] 🟡 **Emoji reactions** on comments.
- [ ] 🟡 **Due-date picker** (calendar popover) + overdue / due-soon styling everywhere.
- [ ] 🟡 **Labels management** in settings — create / rename / recolor / delete; label groups.
- [ ] 🟡 **Custom workflow states** in settings — add / rename / recolor / reorder per team.
- [ ] 🟡 **Issue templates** — create issues from a saved template.
- [ ] 🟡 **Saved views** — persist filter+group+sort as a named view; show under "Views".
- [ ] 🟡 **Triage** — inbox of unassigned/incoming issues with accept/decline.
- [ ] 🟡 **Full-text search** view (beyond ⌘K), with filters and recent searches.
- [ ] 🟡 **Manual drag-to-reorder** issues within a list group (sortOrder).
- [ ] 🟡 **Keyboard shortcuts help overlay** (press `?`), plus row-level shortcuts (assign, status, priority on hovered/selected issue).
- [ ] 🟡 **Project milestones** with their own progress; group project issues by milestone.
- [ ] 🟡 **Project updates** — status posts (on-track / at-risk / off-track) with a timeline.
- [ ] 🟢 **Roadmap / timeline** view of projects across time.
- [ ] 🟢 **Favorites** — star issues/projects/views; a Favorites section in the sidebar.
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
