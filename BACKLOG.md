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
- [x] 🟢 **List virtualization** — `GroupedIssueList` switches to a windowed renderer (`VirtualIssueList`) above 50 rows: only the rows in the viewport are mounted (verified: 202 issues → 33 DOM rows). Reorder/collapse drop out at that size by design. _(Closes seed issue CLA-5.)_
- [x] 🟢 **Multi-team** polish — a workspace/team switcher dropdown (jump between teams), a "Teams" settings card with per-team membership (add/remove via picker), `Team.memberIds` with a persist `merge` that backfills old workspaces, and seeded Engineering issues + correct per-team issue identifiers.
- [x] 🟢 **Members & roles** — the Settings Members card has a per-member role selector (admin/member/guest, your own locked), remove (not yourself), and a mock invite form that derives a name from the email and adds a Pending member. `User.role` backfilled via the persist merge.
- [x] 🟢 **Notification detail** — Inbox/Snoozed tabs, per-notification snooze (1h / tomorrow / next week) + unsnooze, delete, mark-read-on-open, and a per-type preferences popover; the sidebar badge excludes snoozed.
- [x] 🟢 **Activity types** — every change kind (status/priority/assignee/label/project/milestone/estimate/due/title) is logged with `from`/`to` and rendered as a Linear-style sentence with glyph/chip diffs in a new `ActivityItem` component.
- [x] 🟢 **Git branch name** copy + "Copy issue URL", more issue context actions — `branchName()` (Linear's `handle/cla-123-title-slug`, handle from email local-part) + `issueUrl()` helpers; context-menu rows (Copy issue ID / URL / git branch name) and header buttons on the issue detail + peek. _(Toast feedback on copy still TODO.)_
- [x] 🟢 **Command menu contextual actions** — when viewing an issue (detail route or peek), ⌘K shows an issue-context chip + contextual commands (Assign to…, Assign to me, Change status…, Set priority…, Add to project…, Add labels…, Copy ID/URL/branch) that drill into searchable sub-pages with a check on the current value; Esc/Backspace pops back. _(Set due date sub-page still TODO — it needs the calendar UI.)_
- [x] 🟢 **Empty states & onboarding** polish to match Linear — a reusable `EmptyState` component (centered line-art illustration + muted title + description + optional accent-pill action) with six monochrome SVG illustrations (issues ring, inbox tray, magnifier, card stack, cycle, checkmark), wired into the issue list / My Issues / Inbox (inbox + snoozed) / Search no-results / Cycles / Triage / Projects / Views. _(Onboarding tour / first-run checklist still TODO.)_
- [x] 🟢 **Import / export** issues as JSON/CSV — a Linear-faithful "Import & export" Settings card: **Import** (file picker for `.csv`/`.json`, "creates a copy"), **Export** (Export… → CSV / JSON, downloads immediately). Name-based serializer (`importExport.ts`) so both formats round-trip; CSV is RFC-4180 (quoted fields, embedded newlines). `importIssues` store action resolves team/status/assignee/labels/project/milestone by name, assigns fresh per-team identifiers, logs `created` activity, never overwrites. _(No email-delivered async export — direct download instead, since there's no backend.)_

## Discovered later

_(loop appends new Linear features it notices here)_

- [ ] 🟡 **Onboarding tour / first-run checklist** — Linear's "Get started" widget with a checklist of setup steps + dismiss.
- [ ] 🟡 **Burndown chart** for cycles — scope vs. completed line over the cycle's days.
- [x] 🟢 **Toast feedback on copy** — a bottom-right toast stack (`Toaster` + `lib/toast.ts` non-persisted store) with Linear's exact copy wording (`"CLA-1" copied to clipboard` / `Issue URL copied to clipboard` / `Branch name copied to clipboard. Paste it into your favorite git client.`), dark info-circle icon, × dismiss, 5s auto-dismiss; wired into all copy actions (context menu, ⌘K issue-context, issue detail + peek headers). _(Reusable `toast()` helper available for future actions.)_
- [ ] 🟢 **Set due date ⌘K sub-page** — the calendar UI as a command-menu contextual action (noted in Loop #30).
- [ ] 🟢 **Label groups** in settings — group labels under a parent (noted in the Labels item).
- [ ] 🟢 **Async / email-style export** — match Linear's "we'll email you the download link" flow with a mock pending state + ready notification.
