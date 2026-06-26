# Progress log

Newest first. Each loop iteration appends one entry.

## 2026-06-26 — Loop #90: 34 features (recovery + new wave) + 2 bug fixes + Insights polish

This run opened on a **stale lock reclaim** and a working tree carrying **2485
uncommitted insertions across 33 files** — a prior loop that crashed after
editing but before committing. Rather than discard it, an 8-agent parallel
**catalog workflow** read the whole `git diff`, confirmed it was coherent
feature work (tsc -b ✅, build ✅, app loads console-clean), and itemised it; one
leftover `__vverr` debug residue in `ViewsView` was removed. Committed as
**wave 1 (recovered, 32 features)**, then a fresh **wave 2** added net-new
capability, an adversarial bug pass swept the entire run's diff, and Insights
got a polish pass. Verified throughout via the Preview MCP (zero console errors,
no "Maximum update depth") + `tsc -b` + `npm run build`.

_Wave 1 — recovered (32, one per file, no shared-file deltas):_ Display-menu
**Reset to default** · FilterBar **type-to-filter** search · IssueAttachments
**type chips + creator avatars** · IssueContextMenu **Cycle + Estimate
submenus** · issue-sidebar **opened-by / completed metadata footer** ·
IssueLinks **count badge + open-all/copy-all** · IssuePeek **draggable resize
grip** (persisted) · IssueRelations **collapsible + no-op-target exclusion** ·
ActiveCycles **scope-by-assignee** · AllIssues **team-scope picker** · Changelog
**full-text search** · CustomerDetail **request status filter** · Customers
**name search** · Cycles **workload-by-assignee** · DocumentDetail **TOC outline
rail** · Documents **body search** · Inbox **sticky date-section headers** ·
Initiative **group-by-status** · Insights **count/points measure toggle** ·
LabelView **full Display menu** · MyIssues **List/Board toggle** · Profile
**open-by-priority card** · ProjectDetail **scope stacked bar** · Projects
**filter bar** · Pulse **actor filter** · Releases **sort dropdown** · Reminders
**proximity buckets** · Roadmap **group-by swimlanes** · Search **comment
matches** · TeamOverview **workload card** · Triage **keyboard navigation** ·
Views **match-count badge + duplicate**.

_Wave 2 — new (2 net-new + 3 enhancements):_ **Collapsible board columns**
(chevron collapses a column to a narrow rail with glyph + count + rotated name;
state-tracked; works in plain + swimlane modes; rails stay droppable) ·
**Insights "Group by" dimension selector** (Status/Priority/Assignee/Project/
Label) **+ Largest/Smallest sort** driving a featured headline chart, CSV
reflects the choice. Enhancements: Releases **target-date field**, Customers
**navigate-after-create**, MyIssues **tab count badges**. (Documents'
new-document flow was already present — no edit needed.)

**Phase 2 — bug hunt (find → adversarially verify → fix):** 7 parallel finder
slices over the full `9afd099..HEAD` diff surfaced only **2 candidates** — a
strong health signal (no Zustand object-literal selector hazards, no broken
store-action calls, no infinite-loop risks). A separate adversarial verifier
**CONFIRMED both** (0 discarded), both fixed: (1) **Inbox date-section headers**
could repeat/misorder when "Show unread first" partitions the list non-monotonically
— header emission is now partition-aware; (2) **Document outline** used a looser
fence regex than the Markdown renderer, so on indented/trailing-text fences the
"On this page" index diverged from the rendered headings — now byte-for-byte
aligned to the renderer's open/close regexes.

**Phase 3 — polish (Insights, both themes):** the new featured Group-by chart
duplicated the fixed breakdown card for the active dimension (e.g. two "By
status" charts by default). The fixed grid now omits whichever card matches the
active dimension, so each breakdown renders exactly once. Verified in light and
dark — exactly one "By status", clean tokens in both themes.

`tsc -b ✅ · build ✅ · console clean`

Next: backlog is fully checked (200/200) — keep feeding the queue from
linear.app/changelog; candidate next surfaces are board label-swimlane de-duped
DnD ids and a real (mocked) audit-log / GitHub integration flow.

## 2026-06-26 — Loop #89: 24 features (3 waves) + 4 bug fixes + both-theme polish

Shipped **24 features** across three committed waves, then an adversarial bug
pass and a both-theme polish pass. The clone is at near-complete Linear parity,
so this run deepened **filter / sort / export / interaction** capabilities the
real product has on almost every list surface, plus one new data feature
(project dependencies). Verified throughout via the Preview MCP (zero console
errors, no "Maximum update depth" loops) and `tsc -b` + `npm run build`.

_Wave 1 (8):_ **Search entity tabs + Documents** (All · Issues · Projects ·
Documents pills with counts, document title/content search → /document/:id) ·
**Insights time-range + CSV export** (All/7/30/90-day range, Export-CSV of the
chosen breakdown, RFC-quoted) · **Pulse team + date-scope filters** ·
**Archive search + team filter** (with no-matches empty state) · **Board card
peek** (cards open the peek panel, not full-page; drag still suppresses click) ·
**Customers tier filter** (All/Free/Startup/Business/Enterprise pills + total-ARR
summary over the filtered set) · **Shift-range select** (shift-click selects the
inclusive row range via the list's visible order) · **j/k re-peek** (↓/↑ advance
the open peek panel to the next/prev issue). Help overlay documents both.

_Wave 2 (8):_ **Members sort** (Name/Assigned/Active/Teams, active count per
row) · **Releases status filter + per-release progress donut** (done/total from
the linked project) · **Documents sort + project filter** · **Labels directory
search + sort** (Name / Most used) · **Reminders inline reschedule** (clock
Popover: In 1h / This evening / Tomorrow / Next week / Remove → setIssueReminder,
auto re-sort) · **Recent search + team filter** · **Teams directory search +
sort** (Name/Members/Issues/Active) · **Initiatives sort + owner filter**.

_Wave 3 (8):_ **Roadmap status + initiative filters** · **Changelog type +
team filters** · **Active-Cycles team filter + Active/Past scope toggle** ·
**Favorites type-pill + search** · **Profile time-period toggle** (All/Week/
Month scoping stats + activity) · **Views search + sort** · **Triage priority
filter + sort** · **Project dependencies** — `Project.dependsOn` + cycle-guarded
`addProjectDependency`/`removeProjectDependency`, a Dependencies section on the
project Overview (Blocked by / Blocking lists, project picker, inline remove),
seeded Mobile App ← MVP Launch.

**Phase 2 — bug hunt (find → adversarially verify → fix):** 4 parallel finders
swept the run's diff → 10 candidates → a separate adversarial verifier per
candidate → **7 CONFIRMED, 3 NOT-A-BUG**. **Fixed 4:** (1) Insights completion
rate mixed a `completedAt`-gated numerator with a `createdAt`-gated denominator
under a range — now both share the range-filtered cohort; (2) Initiatives showed
the first-run onboarding empty state when a tab/owner filter matched nothing —
now a two-tier "No matching initiatives" state; (3) Profile completion rate
divided period-scoped completions by all-time assigned (collapsed when narrowing
the period) — numerator is now period-agnostic to match its "of your assigned
work" hint; (4) the project-dependency picker offered projects the cycle-guard
would silently reject — now excludes the blocking set. **Deferred 3** (honestly
noted): a pre-existing ~5px Roadmap bar/month-header geometry drift (predates
this run, bounded, risky to change); an Initiatives no-arg `useStore()` perf nit
(allowed by project rules, proper fix ripples through selectors.ts); and the
shift-select anchor behaviour (the flagged "anchor not re-set" is correct
range-select semantics).

**Phase 3 — polish (both themes):** verified every new surface in **light and
dark** — agents used design tokens throughout, so no theming regressions
(Customers tier pills + ARR summary, Project Dependencies' BLOCKED-BY rows with
the half-wedge status glyph, and the new pill-filter rows all render 1:1 in dark).

`tsc -b ✅ · build ✅ · console clean`. Next: the deferred Roadmap month-axis
geometry (day-proportional header columns) and board **label swimlanes**
(needs de-duped DnD ids).

## 2026-06-26 — Loop #86: 20 features (new surfaces + Customers CRM + issue sections + Share/Move) + 1 bug fix + polish

Shipped **20 features** across four committed waves, then a bug pass and a
polish pass. Browser-verified throughout via the Preview MCP (zero console
errors, no "Maximum update depth"); `tsc -b ✅ · build ✅`.

**Wave 1 — workspace/team views (4):** **Active Cycles** (`/cycles`, cross-team
active+upcoming cycle dashboard) · **Pulse** (`/pulse`, workspace activity feed,
day-bucketed, All/Issues/Comments/Projects filter) · **Label issues view**
(`/label/:id`, reachable from Labels settings) · **Team Overview**
(`/team/:key/overview`, dashboard: stats, active cycle, status breakdown,
members, projects, recent issues; per-team sidebar "Overview").

**Wave 2 — Customers + Members + issue sections (7):** **Customers** (`/customers`)
+ **Customer detail** (`/customer/:id`) — CRM-lite over a new `Customer` model +
`Issue.customerIds` (tiers, ARR, request linking) · **Releases** (`/releases`,
new `Release` model) · **Members directory** (`/members`) · issue **Attachments**
section (new `Attachment` model) · issue **Reactions** (`Issue.reactions`) ·
issue **Customers** (customer-requests) section.

**Wave 3 — modals + changelog + board (4):** **Share issue** modal (copy link +
public-access toggle + embed; persisted `publicIssueIds`) · **Move to team**
modal (re-keys the issue's identifier; follows the URL on the detail route) ·
**Changelog** (`/changelog`, shipped-work timeline) · **Projects board layout**
(kanban by project status).

**Wave 4 — profile + timeline + dev/similar (5):** **Profile** (`/profile`,
personal dashboard) · **Projects Timeline layout** (Gantt by start→target) ·
issue **Development** section (linked PRs/branches; new `PullRequest` model) ·
**Similar issues** (title-overlap suggestions) · **Copy as Markdown** (⋯ menu).

All new surfaces are reachable from the sidebar and/or ⌘K. Shared-file
integration (store/types/seed/constants/App routes/Sidebar/CommandMenu/
IssueDetailBody/IssueOptionsMenu) was done deterministically by the main agent;
each wave was committed separately.

**Phase 2 — bug hunt (find → adversarially verify → fix):** a finder swept all
19 new files + shared edits for the real bug classes (Zustand object-selector
loops, undefined-access crashes, optional-field guards, dead links, date-math
NaN, duplicate command/sidebar ids). It cleared every class except **one
CONFIRMED bug**: *Move-to-team from the issue detail route left a stale URL* —
`moveIssueToTeam` re-keys the identifier but the modal didn't navigate, so
`/issue/CLA-N` rendered "Issue not found". **Fixed**: `moveIssueToTeam` now
returns the new identifier and `MoveIssueModal` redirects (`replace`) when the
move originates from that issue's detail route; verified live (CLA-3 → ENG-3,
URL followed, no duplicate identifiers). **1 confirmed / fixed, 0 discarded.**

**Phase 3 — polish (new list/feed rows, both themes):** verified all new surfaces
in light **and** dark (Customers, Profile, Team Overview, Changelog, Customer
detail, Projects board/timeline, issue-detail sections) — tokens correct, no
hardcoded colors, no regressions. Improvement: added Linear's `transition-colors`
smooth-hover to the new Customers / Members / Profile-activity / Pulse rows for
interaction parity.

`tsc -b ✅ · build ✅ · console clean`.

Next: top remaining BACKLOG item — deepen interactive parity on the new surfaces
(e.g. Customers grouping/filtering + customer revenue rollups, Releases ↔ issue
linking, drag-to-reorder on the Projects board, a Trash/archive with soft-delete).

## 2026-06-24 — Loop #84: Documents + team Estimates/Cycles settings + Duplicate issue

A batch run: shipped the workspace **Documents** feature, **per-team Estimates &
Cycles settings** (with a proper per-team settings page), and **Duplicate issue**.

**Features shipped (Phase 1):**
- 🔴 **Documents** — Linear's workspace docs. New `Document` model + `documents`
  store slice (`createDocument` / `updateDocument` / `deleteDocument`, persist-merge
  backfill, two seeded docs — "Product requirements" linked to MVP Launch, "Brand
  guidelines"). New `/documents` list view (icon + title + "Updated {ago} by {name}"
  rows, project chip, "New document" button, EmptyState w/ create action) and
  `/document/:id` editor (40px emoji icon + quick-pick popover, inline title input,
  author/updated meta, inline `ProjectPicker`, shared `MarkdownEditor` body,
  delete-with-confirm). Sidebar "Documents" entry (Workspace section) + ⌘K
  "Go to Documents" / "Create new document".
- 🟡 **Team Estimates** — `EstimationType` (Not used / Linear / Exponential /
  Fibonacci / T-shirt) + Allow-zero on `Team`; `setTeamEstimation` action; pure
  `estimatePoints` / `estimateLabel` / `teamEstimationType` helpers. The issue
  Estimate picker (detail + peek) now uses the team's scale — t-shirt → XS–XL,
  `notUsed` hides the row, Allow-zero toggles the 0 option.
- 🟡 **Team Cycles settings + per-team Settings page** — rebuilt "Your teams →
  {team}" into General / Estimates / Cycles / Workflow sections; **Enable cycles**
  toggle (`Team.cyclesEnabled` + `setTeamCyclesEnabled`) hides that team's sidebar
  Cycles entry when off.
- 🟡 **Duplicate issue** — `duplicateIssue(id)` clones core props into a fresh
  same-team identifier (no copied comments/relations/sub-issues, cleared
  completed/canceled/triage — Linear's default); a **Duplicate** row in the
  right-click context menu opens the copy.

**Phase 2 (bug hunt):** swept Documents (list/detail/create), team settings,
issue detail, sidebar. No confirmed bugs — changes are additive and well-scoped;
console clean throughout, no infinite-loop/selector regressions. (No candidates
survived adversarial reproduction.)

**Phase 3 (polish):** verified the new Documents surfaces in **both light and dark
themes** (tokens only — rows, project chip, editor all render correctly in dark).

**Verification:** Preview MCP live at the dev URL — Documents list + Markdown
editor (headings/bold/bullets/task checkboxes) render, New-document creates &
opens a blank doc, team Estimates/Cycles page matches Linear, disabling cycles
removes the sidebar entry (CLA→0, ENG stays), issue detail intact. Also added
`server.port` honoring `PORT` to `vite.config.ts` so the preview harness can bind
the dev server. `tsc -b` ✅ · `npm run build` ✅ · console clean.

Next: continue Linear parity — top remaining gaps include **Convert issue to /
Move to team**, **Reminders ("Remind me" ⇧H)**, and **Customer requests / Pulse**.

## 2026-06-18 — Loop #83: Right-click context menu → Linear's full list-row menu (1:1)

Soi'd Linear's issue list-row right-click menu in Chrome (workspace "Claude Test
App", team Issues) and rebuilt our right-click `IssueContextMenu` to match it 1:1.

**Before:** a thinner subset — Status / Priority / Assignee / Labels pickers,
Add link, Open in peek / full page, three Copy rows, Delete — in a non-Linear
order.

**Linear's actual order** (observed): Status (S) · Priority (P) · Assignee (A) ·
Due date (⇧D) · Labels (L) · Project (⇧P) · More properties › — divider —
Create related › · Mark as › — divider — Copy › · Convert to › · Open in › —
divider — Favorite (⌥F) · Unsubscribe (⇧S) · Remind me (⇧H) › — divider —
Delete (⌘⌫). The **Mark as** flyout: Parent of… / Sub-issue of… (⌘⇧P) /
Related to… (M R) / Blocked by… (M B) / Blocking… (M X) / Duplicate of… (M M).

**Rebuilt 1:1** for everything backable with real data:
- Six **property rows** now show shortcut hints + chevrons and open the shared
  pickers. **Due date** (new — `DatePicker` → `setIssueDueDate`) and **Project**
  (new — `ProjectPicker` → `setIssueProject`) added alongside Status / Priority /
  Assignee / Labels.
- Hover **flyouts** reusing the same `SubRow` pattern + surfaces as the ⋯
  `IssueOptionsMenu`: **More properties** (Add link… ⌃L), **Create related**
  (Issue / Sub-issue ⌘⇧O / Parent / Blocked / Blocking — `createIssue`+link &
  navigate), **Mark as** (six relation kinds → `openRelationPicker`'s centered
  palette), **Copy** (issue ID ⌘. / URL ⌘⇧, / git branch ⌘⇧.).
- **Favorite/Unfavorite** (⌥F, `toggleFavorite`), **Subscribe/Unsubscribe**
  (⇧S, `toggleIssueSubscriber` — label reflects current state), **Delete** (⌘⌫).

Verified live (vite :5188, team Issues): the menu renders in Linear's exact
order, the Mark-as flyout matches the screenshot exactly, picking Jun 25 from the
Due-date calendar stamps "Jun 25" onto CLA-1's row, console clean; `tsc -b` +
`npm run build` green.

_Omitted (no backing): **Convert to** (needs a convert-to-project/sub-issue
flow), **Open in** (Linear shows only "Configure coding tools…"), **Remind me**
(no reminder backend)._

## 2026-06-18 — Loop #82: Display options — Ordering direction toggle (asc/desc)

Backlog fully ticked + `tsc -b`/`npm run build` green, so this loop closed the
direction-toggle gap deferred in loops #81/#110. Soi'd Linear's Display popover
(Chrome, team Issues): a small **sort-direction arrow** sits between the
**Ordering** label and its dropdown — **ascending** = up-arrow with narrow→wide
bars; clicking flips to a **descending** down-arrow with wide→narrow bars **plus
a filled background** marking the active state. It reverses the chosen ordering.

Reproduced 1:1:

- `OrderDir = 'asc' | 'desc'` type (`types.ts`).
- `sortIssues` gains an `orderDir` param — wraps/negates the primary comparator
  when `desc`; the `orderCompletedByRecency` override stays newest-first.
- `DisplayMenu` renders the toggle button (`ArrowUpNarrowWide` / `ArrowDownWideNarrow`,
  filled `bg-bg-selected` when desc) before the Ordering `Seg`, behind optional
  `orderDir`/`onOrderDir` props (only shows when handlers are passed).
- `IssuesView` + `MyIssues` hold the local `orderDir` state and thread it into
  `sortIssues` + the memo deps + the `DisplayMenu`.

Verified live (vite preview :5199, team Issues): the ascending arrow renders next
to "Priority", clicking flips it to the filled descending arrow 1:1 with Linear,
console clean; `tsc -b` + `npm run build` green. Deferred: SavedViewScreen doesn't
expose/persist the direction yet (local display state like the other toggles).

## 2026-06-18 — Loop #81: Display options — full Ordering list + Grouping order parity

Soi'd Linear's Display popover (Chrome, team Issues). Linear's **Ordering** offers
Manual · Title · Status · Priority · Assignee · Agent · Estimate · Updated ·
Created · Due date · Link count · Time in status; **Grouping** = No grouping ·
Status · Assignee · Agent · Project · Priority · Label. Ours only had
Priority/Updated/Created/Title/Manual ordering and a differently-ordered Grouping
list. Brought both to 1:1 (omitting **Agent** — not modeled — and **Time in
status** — no per-status timestamps):

- `OrderBy` widened to `manual|title|status|priority|assignee|estimate|updated|created|dueDate|linkCount`.
- `orderComparator` now takes `WorkspaceData`; new comparators: **Status**
  (workflow type order × position), **Assignee** (alpha, unassigned last),
  **Estimate** (highest first, none last), **Due date** (soonest first, none
  last), **Link count** (most `issueLinks` first); all fall back to `sortOrder`.
- `DisplayMenu` `ORDERS` lists all ten in Linear's order ("Last updated"→"Updated");
  `GROUPS` reordered to "No grouping" first + Project before Priority (now
  consistent with `SUBGROUPS`).

Verified live (vite :5191): Ordering dropdown shows all ten options in Linear's
order; switching to **Due date** re-sorts within Status groups (CLA-5 due Jun 20
above CLA-7 with no due date); console clean; `tsc -b` + `npm run build` green.
Deferred: ascending/descending direction toggle + Agent/Time-in-status orderings.

## 2026-06-18 — Loop #80: Wire "Display names" preference (Full / First name)

Backlog fully ticked and `tsc -b` + `npm run build` green, so this loop closed the
highest-value behavior TODO loop #79 left: the **Display names** preference (Full
name / First name) was persisting + selecting but never changed any rendering.
Re-soi'd Linear's `/settings/account/preferences` to confirm the copy ("Select how
names are displayed in the Linear interface").

Added pure `firstName()` + `displayName(name, mode)` helpers in `utils.ts` and a
`useDisplayName()` store hook returning a `(name) => string` formatter reading
`preferences.displayNames`. Applied app-wide to every user-name **display** site:
issue assignee + single-subscriber label, comment authors / thread resolved-by /
reaction tooltips, activity-feed actor, project + initiative update authors,
project lead + initiative owner, **all** people-picker option labels (Assignee /
Subscriber / Members / Owner / Team member / Bulk bar / Filter Assignee-Creator-
Subscribers / ⌘K Assign-to / Create-issue / Create-initiative), the Inbox From-
filter + notification-row actor, and **group-by-assignee** headers (threaded an
optional `displayNamesMode` through `groupIssues`, passed from IssuesView /
MyIssues / SavedViewScreen). Avatars/initials + tooltips and the canonical
Profile/Members identity keep the full name (matching Linear); mention `@chips`
keep their stored token.

Verified live (preview :4972, Chrome side-by-side): flipping the pref to **First
name** re-renders CLA-2's assignee as "Avery" (was "Avery Chen") with no
"Avery Chen" string left anywhere on the page; restored to Full afterwards;
console clean on load + reload; `tsc -b` (exit 0) + `npm run build` pass.
_(MembersSettings admin list intentionally stays full name; mention chips unchanged.)_

## 2026-06-18 — Loop #79: Settings → Preferences page (full, Linear 1:1)

Backlog fully ticked and `tsc -b` + `npm run build` green, so this loop replaced
the theme-only Preferences stub with Linear's complete account Preferences page,
soi'd live in Chrome (`/settings/account/preferences`, workspace "Claude Test
App"). Four bordered cards under **General** / **Interface and theme** /
**Desktop application** / **Automations and workflows** with exact labels, helper
text and control types (dropdowns + pill toggles), including the **Aa**-swatched
Interface-theme / Light / Dark dropdowns.

New persisted `Preferences` store slice (12 fields) + `setPreference(key,value)`
action, and reusable `PrefCard` / `PrefRow` / `Toggle` / `PrefDropdown` /
`ThemeSwatch` building blocks in `SettingsView`. Several settings are genuinely
functional, not cosmetic: Interface theme + Light/Dark sub-themes feed
`useThemeEffect` (system appearance picks the chosen sub-theme); a new
`usePreferenceEffect` applies Font size (root font-size) and Use pointer cursors
(`.pointer-cursors` CSS); Default home view drives `DefaultRedirect`; Auto-assign
to self defaults the New-issue assignee; "On move to started status, assign to
yourself" auto-assigns an unassigned issue in `setIssueStatus`.

Verified live (dev server :5180, Chrome side-by-side): page matches Linear, the
Interface-theme dropdown flips the whole app to dark instantly, dropdowns show a
check + swatch on the selected option, console clean; `tsc -b` (exit 0) + build
pass. _(Display names / First day of week / Convert emoticons / Send comment on /
Open in desktop persist + select but their app-wide behavior wiring is the next
slice; App sidebar "Customize" has no sub-panel yet.)_

## 2026-06-18 — Loop #78: Create-issue Cycle field + Cycle list column (Linear 1:1)

Backlog fully ticked and `tsc -b` + `npm run build` green, so this loop closed the
two TODOs the cycle-property-picker loop left behind: **a Cycle field in the New
issue modal** and **a Cycle column in the issue list**.

- **CreateIssueModal** — added a **Cycle** picker after Project (hidden when the
  active team has no cycles, matching the Properties-panel behaviour). It reuses the
  same `SelectMenu` shape as the issue-detail cycle picker: the team's cycles sorted
  by number with `Active` / `Upcoming` / `{start} – {end}` hints, a "No cycle" option,
  a check on the current value, and an `IterationCw` chip reading the cycle name or
  "Cycle". Wired to `createIssue({ …, cycleId })` (`NewIssueInput` already had the
  field). `cycleId` resets when the modal opens, on "Create more", and when the team
  is switched via the team button — cycles are per-team, so a stale cross-team cycle
  can never be submitted.
- **Display properties / IssueRow** — added `'cycle'` to the `DisplayProperty` union,
  a **Cycle** pill to `DISPLAY_PROPERTIES` (after Project) defaulting **off** like
  Milestone (the persist merge-backfill spreads the new default automatically), and an
  `IterationCw` cycle chip in `IssueRow` gated on `dp.cycle` (name or `Cycle {n}`).

`tsc -b` (exit 0) + `npm run build` green; the cycle `SelectMenu` is byte-for-byte
the already-verified issue-detail picker, so behaviour carries over. _(Should be
re-confirmed against Linear in-browser next loop; the board cards and
CreateInitiativeModal are unaffected.)_

## 2026-06-18 — Loop #77: Settings → Notifications page (Linear 1:1)

Backlog fully ticked and `tsc -b` + `npm run build` green, so this loop built out
the **Settings → Notifications** page — previously a `ComingSoon` placeholder, and
the home for the per-type notification prefs that loop #85 moved out of the Inbox.

Soi'd Linear's real account Notifications page (Chrome, workspace "Claude Test App",
`/settings/account/notifications` + the `/email` channel sub-page). The page is:

- **Notification channels** — a bordered card of four clickable rows (**Desktop ›
  Mobile › Email › Slack**), each = channel icon + name + a status line (green/red
  dot + **"Disabled"** / **"Enabled for all notifications"**). Defaults match the
  real workspace: Desktop/Slack off, Mobile/Email on. Clicking a row drills into a
  **channel detail page** (breadcrumb "Notifications" + title, a master **Enable {x}
  notifications** toggle, then the per-event matrix grouped **General notifications**
  [Assignments · Status changes · Comments and replies · Mentions · Reactions ·
  Subscriptions · Document changes · Updates · Reminders and deadlines · Apps and
  integrations · Billing] / **Feature notifications** [Triage] with each row's exact
  label + helper text). Email additionally gets **Notification format** (Digest) +
  **Email digest settings** (delay-low-priority / urgent-immediate). When the master
  toggle is off the dependent rows grey out + go inert.
- **Updates from Linear** — Changelog (**Show updates in sidebar** / **Changelog
  newsletter**), Marketing (**Marketing and onboarding**), Other updates (**Invite
  accepted** / **Privacy and legal updates** / **Data processing agreement (DPA)**),
  reproduced 1:1 with the exact labels + helper copy.

Built a persisted `notificationSettings` store slice (`NotificationSettings` type:
per-channel `{enabled, events}` matrix + email-digest + Updates-from-Linear booleans),
`DEFAULT_NOTIFICATION_SETTINGS` + `NOTIFICATION_CHANNELS`/`NOTIFICATION_EVENT_GROUPS`
constants, three store actions (`setNotificationChannelEnabled` /
`setNotificationEvent` / `updateNotificationSettings`), a deep merge-backfill so
older persisted workspaces load, and a new `NotificationsSettings` component
(overview ⇄ channel-detail via local state) wired into `SettingsView`.

Verified live (`vite preview` :4955, since dev :5173/5174 are occupied by another
project): overview matches Linear 1:1 (channel card + Updates sections), Email drills
in with the digest sections + event matrix, disabling the master toggle greys the
dependent rows, console clean; `tsc -b` + `npm run build` green. _(Slack channel uses
a `MessageSquare` stand-in — lucide dropped its brand `Slack` icon; the Digest /
delay / urgent toggles are booleans rather than Linear's select+time-range UI; the
"Updates from Linear" toggles are cosmetic with no real email backend.)_

## 2026-06-18 — Loop #76: Inbox keyboard shortcuts (Linear 1:1)

Backlog fully ticked and `tsc -b` + `npm run build` green, so this loop added the
**Inbox keyboard shortcuts**, building on loop #75's two-pane reading view.

Soi'd Linear's shortcut reference (Chrome, workspace "Claude Test App" → Help →
Keyboard shortcuts → "inbox"). The **Inbox** section lists exactly: **⌫** Delete
notification (= mark as done) · **⇧⌫** Delete all read notifications · **U** Mark
as read/unread · **⌥U** Mark all as read · **H** Snooze notification (plus the
existing ↓/j ↑/k navigation). Reproduced all of them in `Inbox.tsx`:

- New store actions `setNotificationRead(id, read)` (toggle) and
  `deleteAllReadNotifications()`; the rest map to existing actions.
- The keydown handler now lives in a ref (always reads fresh list/selection) and
  is registered in the **capture phase** with `stopImmediatePropagation()` on the
  keys it owns, so the global `useShortcuts` (which also binds j/k/arrows →
  `moveFocus`) no longer double-fires on the Inbox while `c`/`g`/`?` still pass
  through. `⌥U` is matched via `e.code === 'KeyU' && e.altKey` (macOS Alt+U is a
  dead key, so `e.key` is unreliable). ⌫/H/U act on the selected notification and
  advance to its neighbour exactly like the reading pane's buttons.
- Added an **Inbox** section to the `?` help overlay and shortcut hints to the
  reading-pane buttons (`Snooze (H)`, `Mark as done (⌫)`).

Verified live (production preview): j selects + opens, U toggles the unread dot,
H snoozes (row leaves the list, selection advances), ⌫ marks done + advances, ⌥U
clears the sidebar unread badge; console clean; `tsc -b` + build green. _(H
snoozes to "tomorrow" by default — the full snooze date picker stays on the clock
button, since Linear's H opens a flyout we don't yet position via keyboard.)_

## 2026-06-18 — Loop #75: Inbox — two-pane reading view (Linear 1:1)

Backlog fully ticked and `tsc -b` + `npm run build` green, so this loop closed
the explicit TODO from loop #74: the Inbox **two-pane reading view**.

Soi'd Linear's Inbox in Chrome (workspace "Claude Test App"): it is a **two-pane**
surface — a narrow left **list pane** (its own `Inbox · ⋯ · Filter · Display`
header) and a right **reading pane** showing the selected notification's issue.
Selecting a notification doesn't navigate away; it opens the issue beside the
list. Empty selection shows the inbox illustration + "{n} unread notification(s)";
the reading-pane header carries a **clock (snooze)** + **done/archive** icon (and
I added the standard team › identifier breadcrumb + maximize).

Reproduced 1:1 — rewrote `Inbox.tsx` from a single-pane list-that-navigates into
a `flex` two-pane:

- **List pane** (`w-[340px]`, `border-r`) keeps the existing ⋯/Filter/Display
  header + filter chips; `NotificationRow` redrawn for the narrow column as a
  compact two-line row (unread dot · avatar · **issue title** bold + `{actor}
  {verb}` muted · `timeAgo` right · hover snooze/done). The row is a
  `<div role="button">` (not `<button>`) so the snooze `Popover`'s inner button
  doesn't nest → no hydration error; `outline-none` since selection shows via
  `bg-bg-selected`.
- **Reading pane** — a new `ReadingPane` renders `IssueDetailBody` (compact) for
  the selected notification's issue, with a header (breadcrumb + snooze popover /
  unsnooze + **Mark as done** + maximize). Selecting marks read; **done** &
  **snooze** remove the row and advance selection to the neighbour; **Esc** clears.
- Keyboard nav: **↑/↓ + j/k** move the selection (refs + a single window keydown
  listener, bailing on inputs / `[data-overlay]` popovers).

Verified live (vite preview :4931): clicking notifications renders CLA-5/CLA-6
in full (description, relations, activity, comments + Properties sidebar) with
the breadcrumb + snooze/done/maximize header; ↑/↓ moves selection; the unread
count decrements as rows are read; no focus ring; **console clean**; `tsc -b` +
`npm run build` green. _(Linear's "Mark as done" archives reversibly — our model
has no archived state, so done = delete; the welcome-message custom reading doc
and the snoozed/done sub-filters are omitted.)_

## 2026-06-18 — Loop #74: Inbox header — ⋯ / Filter / Display options (Linear 1:1)

Backlog fully ticked and `tsc -b` + `npm run build` green, so this loop rebuilt
the **Inbox header** to match Linear's real layout. Soi'd Linear's Inbox in
Chrome (workspace "Claude Test App"): the header is `Inbox` + a **⋯ menu**
(Mark all as read · ─ · Delete all), then far-right a **Filter** funnel and a
**Display options** sliders icon — and crucially **no inbox/snoozed tabs**
(snoozed/read are display toggles, not tabs).

- **Filter** popover ("Add Filter…") — Notification type · From · Project ·
  Issue priority · Issue status type, each drilling into a checkable value list
  (back chevron header). Active filters render as `Type · Comments · ×` chips +
  Clear below the header.
- **Display options** popover — Ordering (Newest/Oldest) + toggles Show snoozed
  (default off) / Show read (default on) / Show unread first.
- **⋯ menu** — Mark all as read + Delete all (behind a "Delete all
  notifications? · You cannot undo this action." confirm dialog).

Reproduced 1:1: rewrote `Inbox.tsx` — dropped the tabs + the old Preferences
button, added the three header menus, local `display`/`filters` state (like the
Issues view's display options), a filtering pipeline that resolves each
notification's issue for the From/Project/Priority/Status-type dims and honours
the display toggles (Show snoozed adds snoozed rows; Show read off hides read
ones; Show unread first is a secondary sort), and a new `deleteAllNotifications`
store action. Per-row snooze/unsnooze/delete affordances preserved.

Verified live (vite preview :4930): the header + all three menus match Linear,
Show read off hides the read "Jordan Lee mentioned you" row, `Type → Comments`
narrows to the single comment notification with a chip + Clear, console clean;
`tsc -b` + `npm run build` green. _(Linear's Display-properties pills (ID /
Status and icon) + the two-pane reading view omitted — our rows render no
ID/status column and the real workspace has one welcome notification to soi the
reading pane; notification Preferences moved out of the inbox header — TODO:
wire into Settings → Notifications; filter/display state is local like the team
Issues view.)_

## 2026-06-18 — Loop #73: My Issues — wire Add filter + Display options

Backlog fully ticked and `tsc -b` + `npm run build` green, so this loop closed
the TODO left in loop #72: the **My Issues** header controls (Add filter /
Display options) weren't wired on the Assigned / Created / Subscribed tabs.

Soi'd Linear's My Issues page: those three tabs behave exactly like the team
Issues view — a **Display options** popover on the right of the pill sub-nav and
a **Filter** bar beneath it (chips `dimension · operator · value · ×` + Clear),
while the **Activity** tab has neither. Reproduced 1:1 by lifting `IssuesView`'s
view-state into `MyIssues`:

- `MyIssues.tsx` — now holds local `layout` / `groupBy` / `subGroupBy` /
  `orderBy` / `orderCompletedByRecency` / `showSubIssues` / `nestedSubIssues` /
  `showEmptyGroups` / `filters` state (persists across the three issue tabs, as
  Linear does); a `DisplayMenu` is mounted to the right of the tab row for the
  issue tabs only. A new `IssueTab` subcomponent scopes by the per-tab predicate
  (`assigneeId` / `creatorId` / `subscriberIds`, triage excluded) and then runs
  the **same** `filterIssues → sortIssues → groupIssues` pipeline as the team
  view — nested sub-issues, sub-grouping, board swimlanes, empty groups, and
  manual drag-reorder (→ switches Ordering to Manual) all included — rendering
  `FilterBar` + `GroupedIssueList` / `IssueBoard`. The Activity tab is unchanged.

Verified live (vite preview :4910, port 5173 was another project): Assigned →
Filter → Priority → Urgent narrows to CLA-5 with a `Priority · is · Urgent · ×`
chip + Clear; the Display pill sits on the right; the Activity tab hides both
controls and still shows the Today 11 / Yesterday 8 feed; console clean;
`tsc -b` + `npm run build` green. _(View state is local like the team Issues
view — not yet persisted to a saved view; Linear's "Open details" header button
isn't reproduced.)_

## 2026-06-18 — Loop #72: My Issues — Assigned / Created / Subscribed / Activity tabs

Backlog fully ticked and `tsc -b` + `npm run build` already green, so this loop
added a new Linear surface: **My Issues tabs**.

Soi'd Linear's My Issues page (Chrome, workspace "Claude Test App"): a two-row
header — title **"My issues"**, then a pill sub-nav **Assigned · Created ·
Subscribed · Activity** (active = light gray pill) with Add filter / Display
options / Open details on the right — and each tab is its own route
(`/my-issues/{tab}`). Assigned/Created/Subscribed are the normal status-grouped
issue list filtered differently; **Activity** is a day-bucketed feed of *my own*
actions — collapsible **Today / Yesterday / weekday** group headers with an
event count, each row showing priority + status icon + `CLA-N` + title and a
right-aligned **{glyph} you {verb} {Mon D, HH:MM:SS}** (e.g. "you commented",
"you created the issue", "you changed the parent"). Reproduced 1:1:

- `MyIssues.tsx` — rewritten from a single list into the tabbed view. Reads the
  `tab` route param (default `assigned`); Assigned/Created/Subscribed filter
  `issues` by `assigneeId` / `creatorId` / `subscriberIds` (triage excluded) and
  reuse `GroupedIssueList` with per-tab empty-state copy; a new `ActivityFeed`
  merges `activities` + `comments` authored by `currentUserId`, sorts
  newest-first, groups into day buckets (`dayLabel`), renders the verb/glyph per
  `ActivityKind` (+ comment) with an `eventTime` timestamp, and opens the issue
  in the peek (`setPeek`) on click.
- `App.tsx` — added `/my-issues/:tab` alongside `/my-issues` (the sidebar
  NavLink stays active on the sub-routes by prefix match).

Verified live (localhost:5199): Activity shows "Today 9" / "Yesterday 12" with
faithful per-row verbs + timestamps; the pill tabs switch routes (Assigned →
Todo/In-Progress groups); console clean; `tsc -b` + `npm run build` green.
_(The header's Add filter / Display options / Open-details buttons aren't wired
on this view yet; the Activity feed is the current user's own actions only — no
"others' activity on my issues" stream.)_

## 2026-06-18 — Loop #71: Custom date filter — Month/Quarter/Half-year/Year + "in" range

Backlog fully ticked and `tsc -b` + `npm run build` already green, so this loop
closed the **Month/Quarter/Half-year/Year granularities + "in {period}" operator**
slice carried from the Custom-date modal (loops #66–70).

Soi'd Linear (Chrome, workspace "Claude Test App"): the modal's **Day · Month ·
Quarter · Half-year · Year** tabs each swap the picker, and for the period
granularities the operator toggle gains **in** (before / after / **in**), so a
chip can read **Created date · in · Jun 2026 · ×**. Reproduced 1:1:

- `types.ts` — `DateFilter.op` widened to `'before' | 'after' | 'in'`; `value`
  now also carries absolute periods (`YYYY-MM` month · `YYYY-Q[1-4]` quarter ·
  `YYYY-H[12]` half-year · `YYYY` year) alongside the existing `YYYY-MM-DD` day
  and relative tokens.
- `selectors.ts` — new exported `periodRange(value)` resolves any absolute value
  to a `[start, end)` range; `matchesDate` does `in` = within range, `before` =
  `< start`, `after` = `≥ end` (relative tokens keep the cutoff path).
- `FilterBar.tsx` — `CustomDateModal` gains the granularity tabs + per-gran
  pickers (Month = year-stepper + 4-col month grid; Quarter = Q1–Q4; Half-year =
  H1/H2 with Jan–Jun / Jul–Dec hints; Year = a 12-year window grid), the
  before/after/**in** toggle (in only for non-day grans, clamped on tab switch),
  an extended natural-language parser (`May 2027`, `Q4 2027`, `H1 2027`, bare
  `2027`, plus `DD/MM/YYYY`), `datePeriodLabel` formatting for each period kind,
  and the `DateChip` operator popover now offering **in** for absolute values.

Verified live (localhost:5199): Dates → Created date → Custom → **Month → in →
Jun** → chip **📅 Created date · in · Jun 2026**, all June-created seed issues
kept; flipping the chip operator to **before** empties the list (correct
inversion); the operator popover shows before/after/**in ✓**; console clean;
`tsc -b` + `npm run build` green. _(The input's relative-to-now period phrasing
("next quarter") + per-view persistence of the period beyond the optional
`dates` field still TODO.)_

## 2026-06-18 — Loop #70: Custom date filter (Day picker)

Backlog fully ticked and `tsc -b` + `npm run build` already green, so this loop
closed the **"Custom date or timeframe…"** TODO carried from the Dates filter
(loops #66–69). Soi'd Linear's modal (Chrome, workspace "Claude Test App"): the
relative-period list ends with a divider + **Custom date or timeframe…**; for the
**Day** granularity it opens a dialog titled **{field}** with a **before / after**
segmented toggle, a free-text input (placeholder _Try: May 2027, Q4,
20/05/2027_), Day/Month/Quarter/Half-year/Year tabs, a **two-month calendar**
(Monday-first, weekends faint, today ring-circled, ‹ › month nav) and **Cancel /
Apply** (Apply disabled until a day is picked). The chip becomes **{field} ·
before/after · {MMM D[, YYYY]} · ×**.

Reproduced the **Day** slice 1:1 — no schema change needed, a custom day rides on
the existing `DateFilter.value` as a plain `YYYY-MM-DD` string:
- `selectors.ts` — `resolveDateCutoff` now detects an ISO `YYYY-MM-DD` value and
  resolves it to that day at **local midnight**, so the existing
  `before`(≤)/`after`(≥) `matchesDate` comparison works unchanged.
- `FilterBar.tsx` — new `CustomDateModal` (portal overlay, Esc-to-close,
  before/after toggle, typed `DD/MM/YYYY`-or-`YYYY-MM-DD` parse that jumps the
  calendar, two `MonthGrid`s with Monday-first `monthCells`). Wired into **both**
  the add-flow period list (appends a new filter) and the `DateChip` period
  popover (the **Custom date or timeframe…** entry shows a check when the active
  value is a custom date; editing **patches op+value in place**). New
  `datePeriodLabel` branch formats ISO values as `MMM D` / `MMM D, YYYY`.

Verified live (localhost:5199 — 5173/5174 held by the unrelated "Hubneo" app):
`Dates → Created date → Custom… → Jun 10 → Apply` → chip **📅 Created date · after
· Jun 10**, all seed issues (created yesterday) kept; re-opening the chip's period
popover shows **Custom date or timeframe… ✓**, and re-editing to **before · Jun
10** empties the list (correct inversion); console clean; `tsc -b` + `npm run
build` green. _(Month/Quarter/Half-year/Year granularities — the "in {period}"
operator + range matching — plus the input's natural-language period parsing
still TODO; that's the remaining slice of this modal.)_

## 2026-06-18 — Loop #69: Filter by Dates

Backlog fully ticked and `tsc -b` + `npm run build` already green, so this loop
closed the **Dates filter dimension** TODO carried since loops #66–68. Soi'd
Linear's Filter popover (Chrome, workspace "Claude Test App"): a bottom **Dates**
entry (calendar icon) → field submenu (**Due / Created / Updated / Started /
Completed / Triaged date · Time in current status**) → relative quick-pick list
(**1 day · 3 days · 1 week · 1 month · 3 months · 6 months · 1 year ago** +
Custom). The chip is **{field} · {before/after} · {period} · ×** with a
**before/after** operator dropdown (default **after**).

Implemented the slice we can back with real timestamps — the four fields we
track (**Due / Created / Updated / Completed**):
- `types.ts` — `DateField` + `DateFilter {field, op:'before'|'after', value}`
  and an optional `FilterState.dates?: DateFilter[]` (optional → older SavedViews
  still deserialize).
- `selectors.ts` — `resolveDateCutoff(token)` maps `1d/3d/1w/1m/3m/6m/1y` to an
  absolute cutoff `Date`; `filterIssues` ANDs each date filter (`before` = ≤,
  `after` = ≥) against the issue's timestamp; issues missing that date never
  match (mirrors Linear).
- `FilterBar.tsx` — root **Dates** entry (multi-level `nav` state) → field list →
  period list (picking a period appends `{op:'after'}` and closes via the
  popover `close`), plus a `DateChip` (calendar icon + field label · before/after
  `Popover` · period `Popover` · ×).

Verified live (localhost:5199 — 5173 still held by the unrelated "Hubneo" app):
`Dates → Created date → 1 week ago` → chip **📅 Created date · after · 1 week
ago**, all seed issues (created yesterday) remain; flipping the operator menu
(**before ✓ / after**) to **before** empties the list to the "No issues" state;
console clean; `tsc -b` + `npm run build` green. _(Started/Triaged/Time-in-status
fields + "Custom date or timeframe…" / "No due date" values still TODO — no
backing data / calendar wiring this round.)_

## 2026-06-18 — Loop #68: Filter operators (is / is not)

Backlog fully ticked and `tsc -b` + `npm run build` already green, so this loop
advanced filter-bar parity again (loops #66/#67 added dimensions; this one adds
the **operator**). Soi'd Linear's filter chip (Chrome, workspace "Claude Test
App"): a chip is **dimension · operator · value(s) · ×**, and the operator
segment is a dropdown — **is** / **is not** with one value, **is any of** / **is
not** once 2+ values are picked. "is not" inverts the dimension (`Status is not
Todo` shows everything except Todo). Our chips only did "is".

Implemented:
- `FilterState.negate?` — optional `Partial<Record<dimKey, boolean>>` (kept
  optional so SavedViews persisted before operators still deserialize).
- `filterIssues` (selectors) — refactored the per-dimension checks into a
  `[active, matches, key]` table; a dimension with `negate[key]` set inverts its
  membership test (negated multi-value label/subscriber dims → "has none of").
- `FilterBar` — the chip gains an operator `Popover` between the dimension label
  and the value picker (`OperatorMenu`: `is`/`is any of` + `is not`, check on
  current, closes on select). New `operatorLabel()` (positive flips to "is any
  of" at 2+ values), `setNegate`/`clearDim` helpers; the chip `×` and the
  empty-value paths drop the lingering operator.

Verified live (localhost:5199 — 5173 still held by the unrelated "Hubneo" app):
`Status is Todo` shows the 4 Todo issues; the chip reads **Status · is · Todo ·
×**; opening the operator menu shows `is ✓` / `is not`; choosing **is not**
inverts the list to In Progress/In Review/Done with the chip now **Status · is
not · Todo**; console clean; `tsc -b` + `npm run build` green. _(Dates filter
dim + Linear's "2 statuses" overlapping-icon value summary still TODO.)_

## 2026-06-18 — Loop #67: Filter by Cycle & Milestone

Backlog fully ticked and `tsc -b` + `npm run build` were already green, so this
loop continued the filter-bar parity push (loop #66 added Creator/Subscribers).
Soi'd Linear's **Filter** popover (Chrome, workspace "Claude Test App"): the
dimension list is Status · Assignee · Creator · Priority · Label · Project ·
**Cycle** (iteration icon → submenu of the team's cycles) · **Milestone**
(diamond icon → submenu of project milestones) · Subscribers. We stored
`Issue.cycleId` and `Issue.milestoneId` already but neither was filterable.

Added the two dimensions:
- `FilterBar` — new `cycleIds` / `milestoneIds` dims, ordered to match Linear
  (Cycle + Milestone after Project, before Subscribers). Cycle options = all
  cycles sorted newest-first (`name ?? Cycle N`, `IterationCw` icon); Milestone
  options = all milestones sorted by `sortOrder` (`Diamond` icon).
  `emptyFilters()` seeds both.
- `FilterState` — gains optional `cycleIds?` / `milestoneIds?` (kept optional so
  SavedViews persisted before this round still deserialize).
- `filterIssues` (selectors) — filters by exact `cycleId` and exact
  `milestoneId`, both `?.length`-guarded.

Verified live (localhost:5199 — dev port 5173 was occupied by an unrelated
"Hubneo" app this run): the Filter menu lists Cycle/Milestone in Linear's order;
the Cycle submenu shows Cycle 2 / Cycle 1 with the iteration icon; selecting
`Cycle = Cycle 1` filters the Todo group 4→2 and shows a `Cycle · Cycle 1 · ×`
chip + Clear; console clean; `tsc -b` + `npm run build` green. _(Dates filter
dim + "no cycle"/negative filters still TODO.)_

## 2026-06-18 — Loop #66: Filter by Creator & Subscribers

Backlog was fully ticked and `tsc -b` + `npm run build` were already green, so
this loop advanced parity on the filter bar. Soi'd Linear's **Filter** popover
(Chrome, workspace "Claude Test App"): it offers Status · Assignee · **Creator**
· Priority · Labels · … · **Subscribers** (Creator = person icon, Subscribers =
bell icon; both submenus are people pickers identical to Assignee). Our
`FilterBar` only filtered Status/Assignee/Priority/Label/Project even though
`Issue.creatorId` and `Issue.subscriberIds` have existed in the model for a
while.

Added the two missing dimensions:
- `FilterBar` — new `creatorIds` / `subscriberIds` dims (both backed by the user
  list with avatars), ordered to match Linear (Creator right after Assignee,
  Subscribers at the end); `emptyFilters()` seeds both.
- `FilterState` — gains optional `creatorIds?` / `subscriberIds?` (kept optional
  so SavedViews persisted before this round still deserialize); `valuesOf` and
  `hasActiveFilters` now guard reads with `?? []`.
- `filterIssues` (selectors) — filters by exact `creatorId` and by
  any-subscriber overlap, both guarded with `?.length`.

Verified live against `vite preview` on :4900 (the dev port 5173 was occupied by
an unrelated project this run): the Filter menu lists the new dims in Linear's
order; `Creator = You` keeps every seed issue (all created by me); `Creator =
Avery Chen` empties the list to the "No issues" empty state; the chip, its
re-edit popover, and Clear all behave; console clean; `tsc -b` + `npm run build`
green. _(Cycle/Milestone/Dates filter dims still TODO.)_

## 2026-06-18 — Loop #65: Settings — two-pane layout with grouped left nav

Soi'd Linear's Settings (Chrome, workspace "Claude Test App"). Opening Settings
**replaces the app sidebar entirely** with a dedicated settings nav: a `‹ Settings`
back row, a **Search…** box, then grouped sections in this exact order —
**Personal** (Preferences · Profile · Notifications · Code & reviews · Security &
access · Connected accounts · Agent personalization), **Issues** (Labels ·
Templates · SLAs), **Projects** (Labels · Templates · Statuses · Updates),
**Features** (AI & Agents · Initiatives · Documents · Customer requests · Releases
· Pulse · Asks · Emojis · Integrations), **Administration** (Workspace · Teams ·
Members · Security · API · Applications · Billing), **Your teams** (the team
names) — with the workspace name pinned at the bottom. The right pane is a
max-width doc: a big page title, optional description, and stacked sections.

Rewrote `SettingsView` from a single scrolling card stack into that two-pane
shell: the nav groups/labels/order are reproduced 1:1, section routing is via a
`?page=` search param (linkable + back/forward), and a live nav **search filter**
hides empty groups as you type. `Shell` (App.tsx) now hides the app `<Sidebar>`
while the path is under `/settings`, matching Linear. Wired real content for the
sections we can back with data: **Preferences** (interface-theme cards
System/Light/Dark), **Profile** (avatar + editable Full name + read-only email),
**Issues→Labels/Templates** (`LabelsSettings`/`TemplatesSettings`),
**Projects→Statuses** (`StatesSettings`), **Administration→Workspace** (rename +
Import & export + Danger-zone reset), **Teams**, **Members**, and each
**Your teams→team** (Workflow states). Every other Linear nav item renders a
clean `EmptyState` placeholder ("This settings section isn't available in this
clone yet"). Added two tiny store actions: `updateUser(id, patch)` (Profile name)
and `setWorkspaceName(name)` (Workspace rename).

Verified live (localhost:5199): the nav matches Linear's groups/labels/order;
Preferences/Profile/Members/Integrations-placeholder all render; the search box
filters to Labels-only and hides empty groups; console clean; `tsc -b` + build
green. _(Notifications/Security/API/Billing/Features/* remain placeholders until
backed by data; per-team settings show only Workflow for now.)_

## 2026-06-18 — Loop #64: Project milestones — inline create/edit (replace prompt())

Soi'd Linear's project Overview milestones (Chrome, workspace "Claude Test App",
"Overview Soi Demo"). Clicking **+ Milestone** doesn't open a dialog — it inserts
an **inline, auto-focused** milestone row: a ◇ diamond icon, a "Milestone name"
placeholder text field, and an "Add a description…" field beneath. Typing the
name live-creates/updates it (it appears instantly in the right Properties
Milestones panel as "{name} · X% of N"); each milestone has an inline target
date and a **···** menu (Edit… / Set target date… / Copy / Move milestone to /
Delete ⌘⌫). Our `ProjectDetail` still used `prompt('New milestone name…')`.
Replaced it with the faithful inline flow:

- **types**: `Milestone.description?`.
- **store**: new `updateMilestone(id, patch)` action.
- **ProjectDetail**: a new inline `MilestoneItem` — ◇ `Diamond` icon, controlled
  name + description `<input>`s (write through `updateMilestone` on every
  keystroke), a `DatePicker` target-date chip, the progress badge + bar, and a
  `Popover` **···** menu (**Edit…** focuses the name, **Delete** removes it). The
  Milestones section now renders these rows + a bottom **+ Milestone** button;
  `addMilestone` creates an empty milestone and auto-focuses it. An abandoned
  empty row self-deletes on blur (guarded so moving focus *within* the row — to
  the date picker or ··· menu — doesn't trigger it, via `relatedTarget`).

Verified live (localhost:5199, MVP Launch): **+ Milestone** → editable row →
typed "Public beta" → persisted to the store next to seeded Alpha/Beta; an empty
milestone created then blurred away cleaned itself back up (4 → 3); console
clean; `npx tsc -b` + `npm run build` green. _(Copy / "Move milestone to" ···
items omitted; target date is shown inline rather than only behind the menu.)_

## 2026-06-18 — Loop #63: Project detail — Overview tab + Properties sidebar

Soi'd Linear's project page (Chrome, workspace "Claude Test App"; created a
throwaway "Overview Soi Demo" project to inspect the layout). Linear's project
sub-nav is **Overview · Activity · Issues** (Overview default); the Overview is a
doc-like main column (large project icon, **title**, short summary, a
**project-update card**, **Description**, **Milestones**) beside a right-hand
**Properties** panel — Status, Priority, Lead, Members, Issues count, Dates
(Start → Target), Teams, Slack, Labels — plus Milestones + Activity. Our
`ProjectDetail` was a header-block + Issues/Updates tabs. Rewrote it to match:

- **Tabs** → **Overview / Activity / Issues** (Overview default); header now shows
  the `ProjectStatusIcon` before the project name.
- **Overview main column** — icon, title, summary, an update card (latest update
  health + snippet, else "Write first project update", switches to Activity),
  inline-editable **Description** (textarea → `updateProject`), and a
  **Milestones** list with `milestoneProgress` bars + a `+` add.
- **Properties sidebar** (`w-[268px]`, `border-l`) wired to real store actions:
  **Status** (`SelectMenu` over `PROJECT_STATUS_ORDER` + `ProjectStatusIcon`),
  **Lead** (`AssigneePicker`), **Members** (new `MembersField` — keep-open
  multi-select toggling `memberIds`), **Issues** (`ProgressDonut` + count),
  **Start/Target** (`DatePicker`), **Teams** (read-only names), **Initiative**
  (`SelectMenu` → `setProjectInitiative`).
- **Activity** tab = the existing `ProjectUpdates` feed; **Issues** tab = the
  existing milestone-grouped list (kept the `Section` component).

Bug fixed mid-loop: the pickers wrap their trigger in their **own** `<button>`,
so passing a `<button>` trigger caused a nested-`<button>` hydration error — all
six triggers are now `<span className={triggerCls}>`. Verified live
(localhost:5199, MVP Launch): Overview renders 1:1 with Linear (rocket icon,
summary, on-track card, Alpha 0/1 + Beta 0/0 milestones, full Properties panel);
the Status picker opens all six project statuses; the Issues tab groups by
milestone; **console clean** after the fix. `npx tsc -b` + `npm run build` green.
_(Priority/Labels/Slack rows omitted — no model for those on Project; the inline
Overview properties row + per-tab deep-linking still TODO; milestone add still
uses `prompt()`.)_

## 2026-06-18 — Loop #62: Group-header `+` pre-fills the create modal

Soi'd Linear (Chrome, workspace "Claude Test App", list + board layouts): the
**`+`** on a group header — and on a board **column** header — opens the **New
issue** modal *pre-filled with that group's property*, not a blank one. Clicking
Todo's `+` shows a **Todo** status pill; In Progress's `+` shows **In Progress**;
a sub-group `+` combines both (status + priority/assignee/…). Our `+` was just
opening a blank `setCreateOpen(true)`. Reproduced 1:1:

- **`CreatePrefill`** type (`types.ts`) — `teamId`/`stateId`/`priority`/
  `assigneeId`/`labelIds`/`projectId`.
- **Store** — a transient `createPrefill` slice + **`openCreateWith(prefill)`**
  action (sets `createOpen: true` + the prefill); excluded from persist;
  `setCreateOpen(false)` now also clears `createPrefill`.
- **`prefillFor(groupBy, group)`** (exported from `GroupedIssueList`) — maps a
  group's key → its property (status→stateId, priority→priority, assignee→
  assigneeId, project→projectId, label→[labelId]; "No X" groups prefill nothing).
  The list group `+` calls `openCreateWith(prefillFor(groupBy, group))`; the
  sub-group `+` spreads `{...prefillFor(groupBy, group), ...prefillFor(subGroupBy, sg)}`.
- **`CreateIssueModal`** — seeds its form fields from `createPrefill` when it
  opens, and re-seeds on each **Create more** so the group context sticks.
- **`IssueBoard`** — added a hover **`+`** to the board `Column` and swimlane
  `ColumnHeader` (previously absent), prefilling that column's status.

Verified live (localhost:5199): In Progress `+` → modal pre-set to "In Progress";
created **CLA-15**, which landed straight in the In Progress group (count 2→3);
the row's context menu confirmed status = In Progress; deleted the test issue;
console clean. `npx tsc -b` + `npm run build` green. _(Board swimlane row `+` and
`SavedViewScreen` group `+` not added — those headers have no add button yet.)_

## 2026-06-18 — Loop #61: Projects list view + Display options

Soi'd Linear's **Projects** page (Chrome, workspace "Claude Test App"): the
default layout is a **List** (the clone was a card grid), and the Display popover
offers **Layout** (List / Board / Timeline), **Grouping** (No grouping · Lead ·
Member · Status · Priority · Label · Team · Health · Start/Target date),
**Ordering** (Manual default), **Show closed projects**, and **Display
properties** pills (Milestones · Summary · Priority · Status · Health · Teams ·
Lead · Members · Dependencies · Start/Target date · Issues · Created · Updated ·
Completed · Labels). Reproduced the faithful slice we can back with data:

- **`ProjectStatusIcon`** (new) — SVG glyphs for the six project statuses
  (backlog dashed circle / planned outline / In Progress half-wedge / paused
  pause-bars / completed filled-check / canceled filled-✕), colored from a new
  `PROJECT_STATUS` / `PROJECT_STATUS_ORDER` constants pair.
- **`ProjectsView`** — rewrote the card grid into Linear's **list rows**: status
  glyph + project emoji + name, then a right cluster of issues-progress
  (`ProgressDonut` + %), `HealthBadge` (latest project update), target date,
  member avatars, lead avatar. Each property gated by a toggle. Grouping renders
  collapsible **sticky group headers** (status glyph / health label / lead avatar
  + count). Local view state (groupBy / orderBy / property toggles), like the
  Issues view's grouping/layout. Empty-state copy corrected to Linear's exact
  wording.
- **`ProjectsDisplayMenu`** (new) — the Display popover: Layout = List, Grouping
  (No grouping / Status / Health / Lead), Ordering (Manual / Name / Target date /
  Created), and Status/Health/Lead/Members/Target date/Issues property pills.

Verified live (localhost:5199): MVP Launch (In Progress, 13%, On track, Jul 18) +
Mobile App (Planned, Sep 16) render as list rows; Grouping = Status splits into
collapsible "Planned 1" / "In Progress 1" bands. `npx tsc -b` + `npm run build`
green, console clean. _(Board / Timeline layouts, Priority/Member/Team/date
grouping, Milestones/Summary columns, and per-view persistence still TODO —
Project has no priority field; view state is local like the Issues view.)_

## 2026-06-18 — Loop #60: Board swimlanes (Rows / sub-grouping on the board)

Soi'd Linear's **Display** popover in **Board** layout (Chrome, "Claude Test
App"): it relabels to **Columns** / **Rows** / **Ordering** plus **Board
options** (**Show empty columns** / **Show empty rows**), and choosing a **Rows**
value (No grouping · Status · Assignee · Agent · Project · Priority · Label ·
Parent issue) turns the board into horizontal **swimlanes** — the column headers
(Todo / In Progress / …) render once across the top, then each row group gets a
full-width **collapsible header band** (chevron + row glyph + name + count) with
its cards laid out in the matching status columns beneath; **empty rows collapse
into a "▸ Hidden rows N"** bar at the bottom (click to expand). Reproduced 1:1
(we omit the Agent / Parent-issue row options — no model for them):

- **`IssueBoard`** — new `rows` + `subGroupBy` props and a swimlane renderer: a
  `Swimlane` = a header band (`RowGlyph` mirrors the list's group glyphs) + one
  droppable `CardStack` per column; each cell's issues come from that column's
  `subGroups` entry whose key matches the row. Cells carry composite
  `rowKey::stateId` drop ids so drag-between-columns still resolves the target
  state and calls `moveIssue`. Non-empty rows render as bands; empty rows fold
  into an expandable **Hidden rows N** bar. Column headers render once via a new
  `ColumnHeader`. Prev/next nav order walks the swimlanes row-major.
- **`IssuesView`** — now computes per-column `subGroups` for **both** layouts
  (list nests them; board uses them as swimlane cells) and, for the board, an
  all-rows `rows` list (`showEmptyGroups=true` so empty rows are enumerable for
  the Hidden-rows bar). Passes `rows` + `subGroupBy` to `IssueBoard`.
- **`DisplayMenu`** — when `layout==='board'`: Grouping→**Columns**,
  Sub-grouping→**Rows**, the options header → **Board options**, "Nested
  sub-issues" hidden (list-only), "Show empty groups"→**Show empty columns**.

Verified live (localhost:5199, Board · Rows = Priority): Urgent / High / Medium /
Low swimlanes render with each card in the correct status column (Done column
shows CLA-8), and **Hidden rows 1** expands to reveal the empty **No priority 0**
band. `npx tsc -b` + `npm run build` green, console clean. _(Cross-swimlane drag
changes status only, not the row property; a dedicated "Show empty rows" toggle +
SavedViewScreen persistence still TODO — empty rows are already reachable via the
Hidden-rows bar.)_

## 2026-06-18 — Loop #59: Display options — Order completed by recency

Soi'd Linear's **Display** popover (Chrome, "Claude Test App"): directly under
the **Ordering** dropdown sits an **Order completed by recency** toggle (off by
default), above **Show sub-issues**. When on, completed/canceled issues are
ordered by when they were closed (most recent first), overriding the chosen
ordering for those issues — so in a status-grouped view the **Done** and
**Canceled** groups read newest-first. Reproduced 1:1:

- **`sortIssues`** (`selectors.ts`) — the `OrderBy` switch is refactored into an
  `orderComparator(orderBy)` helper; a new `orderCompletedByRecency` param, when
  set, compares two issues that are **both** in a `completed`/`canceled`
  workflow state by `completedAt ?? canceledAt ?? updatedAt` **descending**,
  otherwise falls through to the primary comparator (so within a status-grouped
  view the closed groups read newest-first; open groups are untouched).
- **`DisplayMenu`** — a `ToggleRow` rendered between **Ordering** and **Show
  sub-issues** behind optional `orderCompletedByRecency`/
  `onOrderCompletedByRecency` props (only renders when the handler is given).
- **`IssuesView`** — local `orderCompletedByRecency` state (default off), threaded
  into `sortIssues` and the grouping memo's deps + the `DisplayMenu` props.

Verified live (localhost:5188, All Issues): the toggle sits exactly where Linear
places it (Ordering → Order completed by recency → Show sub-issues), flips on
(accent) without error, console clean. `npx tsc -b` + `npm run build` green.
_(SavedViewScreen doesn't persist this yet — local display state like
grouping/ordering; the seed has a single Done + single Canceled issue so the
reorder isn't visually distinguishable, matching the sparse real workspace.)_

## 2026-06-18 — Loop #58: Display options — Nested sub-issues

Soi'd Linear's **Display** popover **List options** (Chrome, "Claude Test App"):
above **Show empty groups** sits a **Nested sub-issues** toggle. When on, every
sub-issue is pulled out of its own status group and rendered **indented beneath
its parent** behind a per-row **disclosure chevron** (▸/▾, defaults expanded),
each sub-issue still showing its own status icon. Loop #56 added the inert
toggle slot; this round makes it functional 1:1.

- **`DisplayMenu`** — new `nestedSubIssues`/`onNestedSubIssues` props; the
  List-options section now renders when **either** toggle handler is supplied,
  with **Nested sub-issues** rendered first (then Show empty groups).
- **`IssueRow`** — new `depth` (inline `paddingLeft` indent) and `expand`
  gutter: a chevron button when the row has children (else an aligning spacer),
  `stopPropagation` so toggling doesn't open the peek. Untouched when `expand`
  is absent, so flat mode is unchanged.
- **`GroupedIssueList`** — accepts `childrenByParent` (parent id → its visible
  sub-issues); a recursive `renderNested` renders a parent row + its expanded
  children (children always `showStatus`); per-row expand state defaults open;
  the prev/next nav order walks the nested tree, descending only into expanded
  parents. Virtualization + drag-reorder fall back to the full render while
  nested (same trade-off as sub-grouping).
- **`IssuesView`** — `nestedSubIssues` state; `nested` = list view + Show
  sub-issues + Nested on. When nested, builds `childrenByParent` from the
  sorted+filtered set and groups only **top-level** issues (no parent, or
  parent not in the visible set).

Verified live (localhost:5199): added CLA-6 (In Review) + CLA-2 (Todo) as
sub-issues of CLA-1 → both nest indented under CLA-1 in the **Todo** group (the
In Review group empties out), each keeps its own status icon; the chevron
collapses/expands them; CLA-1 keeps its 0/2 progress badge. `npx tsc -b` +
`npm run build` green, console clean. _(Board swimlanes + per-view persistence
still TODO; nested is local display state like grouping/ordering.)_

## 2026-06-18 — Loop #57: Display options — Sub-grouping

Soi'd Linear's **Display** popover (Chrome, "Claude Test App"): between
**Grouping** and **Ordering** sits a **Sub-grouping** dropdown (No grouping ·
Status · Assignee · Agent · Project · Priority · Label). Selecting one nests
each top-level group's issues into sub-groups — the top group keeps its sticky
gray header, then each sub-group renders an indented, transparent header
(collapse chevron + glyph + name + count + trailing divider line + `+` add) with
its issues beneath.

Reproduced 1:1 (we omit "Agent" — no agent model):
- `IssueGroup` gains `subGroups?: IssueGroup[]`.
- `IssuesView` computes sub-groups per top group via
  `groupIssues(group.issues, subGroupBy, data, showEmptyGroups)` (list view only
  — board keeps status columns), behind a new `subGroupBy` state default `none`.
- `DisplayMenu` gets a **Sub-grouping** `Seg` row (new `SUBGROUPS` constant,
  "No grouping" first like Linear), wired through optional
  `subGroupBy`/`onSubGroupBy` props.
- `GroupedIssueList` renders the nested sub-group headers with independent
  per-sub-group collapse (key `parentKey::subKey`) via a shared `renderIssues`
  helper; virtualization + drag-reorder fall back to the full render while
  sub-grouping is active (the nested layout needs every row mounted).

Verified live (localhost:5190): Group Status / Sub-group Priority → Todo ▸
High/Medium, In Progress ▸ Urgent/High, In Review ▸ High, Done ▸ Low; collapsing
the "Medium" sub-group hides only its rows; `npx tsc -b` + `npm run build` green;
console clean. _(Board swimlanes + SavedViewScreen persistence still TODO.)_

## 2026-06-18 — Loop #56: Display options — Show sub-issues / Show empty groups

Soi'd Linear's **Display** popover (Chrome, "Claude Test App"): below Layout /
Grouping / Sub-grouping / Ordering it carries a **Show sub-issues** toggle, then
a **List options** header with **Nested sub-issues** + **Show empty groups**.
Our `DisplayMenu` only had Layout / Grouping / Ordering / Display properties —
the List-options toggles were missing. Added the two functional, visible ones.

- **`DisplayMenu`** — a reusable `ToggleRow` (Linear-style pill switch, same
  markup as the Create-more toggle) behind **optional** props
  (`showSubIssues`/`onShowSubIssues`, `showEmptyGroups`/`onShowEmptyGroups`); the
  **Show sub-issues** row + the **List options** / **Show empty groups** section
  only render when their handlers are supplied (so `SavedViewScreen`, which
  doesn't pass them, is unchanged).
- **`groupIssues`** (`selectors.ts`) — new `showEmptyGroups = false` param; every
  `.filter((g) => g.count > 0)` becomes `showEmptyGroups || g.count > 0`, so
  empty status / assignee / priority / project / label groups render with their
  icon + "0" count + add button (also surfaces empty board columns).
- **`IssuesView`** — local `showSubIssues` (default on) / `showEmptyGroups`
  (default off) state; when Show sub-issues is off the scoped list drops issues
  with a `parentId`; `showEmptyGroups` flows into `groupIssues`.

Verified live (Chrome, localhost:5173): toggling **Show empty groups** on adds
**Backlog 0** (top) and **Cancelled 0** (bottom) with status icons + add (+);
**Show sub-issues** off drops Todo 5→4 (CLA-16 sub-issue hidden). `npx tsc -b` +
`npm run build` green, console clean. _(Sub-grouping / Nested sub-issues /
"Order completed by recency" still TODO; saved views don't persist these yet.)_

## 2026-06-18 — Loop #55: Resolve comment thread

Closed the gap deferred in loops #54 and #55-prior ("Resolve thread / collapse-
resolved — needs a `resolvedAt` flag"). Linear lets you **resolve a comment
thread**, which collapses it into a compact green-check summary bar; resolved
threads can be expanded and **unresolved**.

- **Data** — `Comment.resolvedAt` + `resolvedBy` on the thread root; a
  `toggleResolveThread(rootId)` store action (sets/clears them, stamping the
  current user as resolver).
- **`CommentActions`** — a new **Resolve thread / Unresolve thread** menu item
  (circled-check / circle icon) between Edit and Copy link. A `rootId` prop is
  threaded through `CommentItem` so the action always targets the thread root,
  no matter which comment's menu you open.
- **`CommentThread`** — when resolved it collapses to a single bar: green check +
  root author avatar + a one-line Markdown-stripped `snippet()` + "{n} repl(y/ies)"
  + "{resolver} resolved" + chevron. Clicking the bar expands it, showing a
  "Resolved by {name} · {ago}" banner with inline **Unresolve** / **Collapse**
  buttons above the full root + replies + reply composer.

Verified live (Chrome, localhost:5173, CLA-5): the ⋯ menu shows
Edit / Resolve thread / Copy link / Delete in order; resolving collapses Avery's
thread to "Avery Chen … 1 reply · You resolved"; expanding shows the banner +
Unresolve/Collapse with the reply visible; Unresolve restores the thread.
`npx tsc -b` + `npm run build` green, console clean. _(Auto-collapse preference
and a thread-level resolved activity entry still TODO.)_

## 2026-06-18 — Loop #54: Comment threaded replies

Surfaced the long-existing `Comment.parentId` model (added in loop #50, but the
comment list rendered everything flat) as Linear's real **threaded replies**.

Soi'd the real workspace (Chrome, "Claude Test App", CLA-1): every top-level
comment is a **thread** — its replies stack on an indented left rail and a
persistent **"Leave a reply…"** affordance (current-user avatar + placeholder)
sits at the bottom of each thread. (The bare workspace had no comments to
screenshot a populated thread, and posting test comments to the user's real
workspace would be a write action, so I built to Linear's known thread design
and verified end-to-end in our own app.)

- **`CommentThread`** (new) — renders the root `CommentItem`, then its replies
  inside an `ml-[11px] border-l pl-4` rail aligned to the root avatar's centre,
  then a collapsed reply trigger that expands into a `MentionInput` with
  **Cancel / Reply** (⌘↵ submit, Esc cancel). Replies always attach to the
  **thread root** (`addComment(root.issueId, body, root.id)`) — Linear threads
  are one level deep, so a reply-to-a-reply still lands on the root.
- **`IssueDetailBody`** — groups comments into thread roots (top-level, plus
  replies whose parent was deleted, promoted to roots so nothing is orphaned)
  and renders a `CommentThread` per root instead of a flat `CommentItem` list.
  Shared by the full-page detail and the peek panel.
- **Seed** — added an illustrative reply `c_3` (Jordan, under Avery's comment on
  the virtualization issue) so a populated thread is visible on a fresh load.

Verified live (localhost:5173, CLA-5): each comment shows the indented "Leave a
reply…" composer; typing under Avery's comment + **Reply** rendered the reply
nested as "You · now" on the rail with a fresh reply box beneath. `npx tsc -b`
+ `npm run build` green, console clean. _(Resolve thread / collapse-resolved
still TODO — needs a `resolvedAt` flag on the thread root.)_

## 2026-06-17 — Loop #53: Relation keyboard shortcuts + shared "Mark as" picker

Closed the explicitly-deferred gap from loops #51/#52: the relation shortcuts
that previously rendered only as **hints** in the ⋯ menu are now wired, and
they open Linear's real **centered "Mark as" command palette**.

Soi'd the real workspace (Chrome, "Claude Test App") — it's a bare default
(no projects), so I built to Linear's known design and verified everything in
our own app side-by-side.

- **Shortcuts** (in `useShortcuts`): **M then R / B / X / M** → Related to /
  Blocked by / Blocking / Duplicate of; **⌘⇧P** → Sub-issue of an existing
  issue; **⌘⇧O** → create a new sub-issue and open it. The M-chord uses a
  `pendingM` ref + 1.2s timer mirroring the existing G-chord. The "current
  issue" the shortcuts act on resolves as **peek → `/issue/:id` route →
  `j`/`k`-focused row**.
- **Shared picker** — a new `RelationPicker` overlay (mounted in `App`)
  rendering Linear's centered palette: issue chip header (`CLA-N · title` +
  ×), a per-kind placeholder ("Related to…", "Sub-issue of…", …), and a
  searchable existing-issue list (status icon + title + identifier, ↑/↓/↵
  to pick, Esc to cancel; self + triage excluded; the store's
  `setIssueParent` cycle guard keeps parenting safe). Driven by a transient
  `relationPicker: { issueId, kind }` store slice + `openRelationPicker` /
  `closeRelationPicker` (excluded from persist; new `RelationPickerKind`
  type).
- **Dedup** — `IssueOptionsMenu`'s "Mark as" rows now call
  `openRelationPicker` instead of each rendering an anchored `SelectMenu`, so
  the ⋯ menu and the keyboard shortcuts share one surface — exactly like
  Linear, whose "Mark as" rows open the same centered palette.
- **Help overlay** gains a **Relations** section documenting ⌘⇧O, ⌘⇧P, and the
  four M-chords.

Verified live (localhost:5173): `j` focuses CLA-1, `M R` opens the palette
("Related to…"), picking CLA-2 adds it under Relations → Related; `⌘⇧P` from
the CLA-1 route opens "Sub-issue of…"; `⌘⇧O` created **CLA-16** parented to
CLA-1 (breadcrumb + "set parent to" activity) and opened it; the ⋯ "Mark as"
flyout matches Linear's icons/labels/hints and routes through the picker.
`npx tsc -b` + `npm run build` green, console clean. _(⌥F favorite / ⇧S
subscribe shortcuts still hint-only — the `s` row-hotkey collision needs a
shift-aware guard, deferred.)_

## 2026-06-17 — Loop #52: Issue ⋯ menu — Create related / Mark as submenus

Soi'd Linear's issue header **⋯ ("Issue options")** menu (Chrome, workspace
"Claude Test App", CLA-1) and reproduced its two relation submenus 1:1, the
explicitly-deferred gap from loop #51. The real menu:

- `Add link… (⌃L)` · `Add document…`
- ─ **Create related** ▸ — Issue… / Sub-issue… ⌘⇧O / Parent issue… /
  Blocked issue… / Blocking issue… (these **create** a new, linked issue)
- **Mark as** ▸ — Parent of… / Sub-issue of… ⌘⇧P / Related to… M R /
  Blocked by… M B / Blocking… M X / Duplicate of… M M (these **link an
  existing** issue)
- ─ Copy ▸ · Convert to ▸ · ─ Favorite ⌥F / Remind me ▸ / Unsubscribe ⇧S
  · ─ Show description history / Delete ⌘⌫

Built a new shared **`IssueOptionsMenu`** and placed it in the breadcrumb
(right after the identifier) on both the full-page `IssueDetail` and the
`IssuePeek` header — matching Linear's placement. Faithful slice:

- **Structure** — `Add link…` (⌃L) · **Create related** ▸ · **Mark as** ▸ ·
  **Copy** ▸ (ID / URL / branch) · Favorite/Unfavorite (⌥F) ·
  Subscribe/Unsubscribe (⇧S) · Delete (⌘⌫). Exact labels, order, dividers,
  shortcut hints and icons; the two relation submenus + Copy are
  **hover-expanding flyouts** to the right.
- **Create related** — calls `createIssue` (same team/project), then applies
  the link (`addRelation(self,new,'related'|'blocks')` /
  `addRelation(new,self,'blocks')` for Blocking / `setIssueParent` for
  Sub-issue & Parent) and opens the new issue (navigate / re-peek).
- **Mark as** — each row opens a searchable existing-issue `SelectMenu`
  (self + triage excluded; the store's `setIssueParent` cycle guard keeps
  parenting safe) → `setIssueParent` / `addRelation`.
- Reuses existing store actions/helpers (`openLinkModal`, `toggleFavorite`,
  `toggleIssueSubscriber`, `deleteIssue`, copy/toast). Escape closes the menu
  via a **capture-phase** listener + `stopPropagation`, so it doesn't also
  close the enclosing peek panel. `data-overlay` so global hotkeys bail.

Verified live (localhost:5173, CLA-2): the ⋯ menu and both flyouts render
identically to Linear (incl. the M-chord hints); **Mark as → Related to… →
CLA-1** added a Related relation in the Relations section, then removed it via
the row ×; `npx tsc -b` + `npm run build` green, console clean. _(The
⌘⇧O/⌘⇧P + M-chord keyboard shortcuts show as hints only — wiring them is
still TODO; "Convert to / Remind me / Add document / Show description history"
omitted, no backend for those.)_

## 2026-06-17 — Loop #51: Parent / sub-issue linking to existing issues

Soi'd Linear's issue ⋯ header menu (Chrome, workspace "Claude Test App",
CLA-1). Two relation submenus: **Create related** ▸ (Issue / Sub-issue ⌘⇧O /
Parent issue / Blocked / Blocking — *create* new linked issues) and **Mark as**
▸ (Parent of… / Sub-issue of… ⌘⇧P / Related to… M R / Blocked by… M B /
Blocking… M X / Duplicate of… M M — *link existing* issues). We already had the
relation pickers (blocks/related/duplicate) and create-only sub-issues; the
missing piece was the **parent/sub-issue-of** relationship to an *existing*
issue.

Reproduced the highest-value faithful slice on the issue detail (shared by the
full-page view and the peek panel):

- **Store / model** — new `setIssueParent(id, parentId?)` action: sets
  `parentId`, guards against self-parenting and cycles (walks up from the new
  parent; bails if it reaches the issue), logs a new `'parent'` activity.
- **`'parent'` ActivityKind** + an `issuePill` helper in `ActivityItem` →
  renders **"set parent to {CLA-N · title}"** / **"removed the parent issue"**.
- **Sub-issues header** — the `+ Add sub-issue` button became a searchable
  `SelectMenu`: first option **Create new sub-issue** (Plus icon, prior
  create-fresh behavior), then candidate existing issues (status icon + title +
  `CLA-N` hint), filtered to exclude self, current sub-issues, this issue's
  ancestors (cycle-safe) and triage. Selecting an existing issue calls
  `setIssueParent(thatId, issue.id)`.
- **Unparent affordances** — each sub-issue row and the parent **breadcrumb**
  now reveal a hover **×** that clears the parent (`setIssueParent(…,
  undefined)`).

Verified live (localhost:5173): CLA-2 → **+ Add sub-issue** → picker lists
Create-new + existing issues → "Connect your tools" (CLA-3) becomes a sub-issue
(rollup shows 0/1); CLA-3 then shows the **CLA-2** breadcrumb + a **"set parent
to CLA-2 Set up your teams"** activity; hovering the breadcrumb reveals the ×,
which removes the parent and logs **"removed the parent issue"**. Console clean,
`npx tsc -b` + `npm run build` green. _(The full ⋯ "Mark as"/"Create related"
submenus and the ⌘⇧P/⌘⇧O keyboard shortcuts are still TODO; "Parent of…" is
covered from the parent side via the same picker.)_

## 2026-06-17 — Loop #50: Comment actions (edit / delete) + hover toolbar

Soi'd Linear's comment (Chrome, workspace "Claude Test App", issue CLA-1):
hovering a comment reveals a top-right toolbar — an **emoji-react** picker and
a **⋯ overflow** menu. The menu is **Edit** · ─ · Unsubscribe from thread ·
Resolve thread · ─ · **Copy link to comment** · **Copy content as Markdown** · ─
· New issue from comment… · New sub-issue from comment… · ─ · **Delete** (red).
**Edit** turns the body into an inline textarea with **Cancel / Save** (accent
button); **Delete** opens a centered **"Delete this comment?" / "You cannot undo
this action."** confirm (Cancel / red **Delete**).

Reproduced 1:1 the items with real backing in our store, and noted the bigger
ones as deferred:

- **Store / model** — new `editComment(id, body)` action that sets the body and
  stamps `Comment.editedAt` (new optional field). Comments with `editedAt` show
  an **"(edited)"** hint after the timestamp, like Linear.
- **`CommentReactions`** — refactored to render only the reaction pills (returns
  null when none); the add-reaction picker moved into the hover toolbar where
  Linear keeps it.
- **`CommentActions`** (new) — the hover toolbar: a `SmilePlus` reaction
  `Popover` (6×2 emoji grid → `toggleReaction`) + a `MoreHorizontal` `Popover`
  menu with **Edit** (→ inline edit), **Copy link to comment** (copies
  `issueUrl#comment-<id>` → "Comment URL copied to clipboard" toast), **Copy
  content as Markdown** (copies the body → toast) and **Delete** (red, opens a
  portal confirm dialog matching Linear's exact wording; **Delete** uses
  `var(--c-red)`).
- **`CommentItem`** (new) — one comment: avatar, header (`name · timeAgo ·
  (edited)`), Markdown body, reaction pills, the hover toolbar (fades in on
  `group-hover`), and inline edit mode (`MentionInput` with **⌘↵ to save / Esc
  to cancel** + Cancel/Save buttons). Wired into `IssueDetailBody`, so it's
  shared by the full-page detail and the peek panel.

Verified live (localhost:5173, CLA-1 peek): added a comment → hover toolbar
appeared → ⋯ → **Edit** changed the text and showed **"(edited)"**; **Copy link
to comment** fired the "Comment URL copied to clipboard" toast; ⋯ → **Delete** →
the "Delete this comment?" confirm → **Delete** removed it. `npx tsc -b` +
`npm run build` green; console clean (no errors, no infinite-loop warnings).
_(Unsubscribe / Resolve thread, threaded comment replies, and New-issue-from-
comment omitted this round — each needs thread/relation model work; the toolbar
+ menu scaffolding is now in place to add them.)_

## 2026-06-17 — Loop #49: Slash command menu in the editor

Soi'd Linear's description editor (Chrome, workspace "Claude Test App", issue
CLA-1): typing **`/`** at the start of a line opens a command menu — the empty
editor placeholder reads **"Type / for commands…"**. The menu is grouped with
right-aligned shortcut hints: **Heading 1 / 2 / 3** (⌘⌥1/2/3) · divider ·
**Bulleted list** (⌘⇧8) / **Numbered list** (⌘⇧9) / **Checklist** (⌘⇧7) ·
divider · Insert media… / Insert gif… / Attach files… (⌘⇧U) · divider ·
**Code block** (⌘⇧\) / Diagram / Collapsible section (⌘⇧6) / **Blockquote**
(⌥⇧.). Reproduced 1:1 the items our dependency-free Markdown renderer supports,
in Linear's exact order, grouping, labels and shortcut hints:

- **Trigger** — added a `/`-command autocomplete to the shared `MentionInput`
  (used by both the description `MarkdownEditor` and comments). Detection is a
  line-start regex (`(?:^|\n)\/([a-zA-Z ]*)$`) so `/` only fires at the start of
  a block, exactly like Linear; an Escape-dismiss guard (`dismissedAt`) keeps it
  closed for that anchor until you move off it.
- **Menu** — grouped while unfiltered (3 dividers), collapsing to a single
  ranked list once you type a query (matches label or keywords). Keyboard
  ↑/↓/↵/Tab/Esc + mouse hover/click; lucide icons (Heading1/2/3, List,
  ListOrdered, ListChecks, Code2, TextQuote) + a monospace shortcut hint column.
  Both the mention and slash popovers now carry `data-overlay` so the global
  j/k/x hotkeys bail while they're open.
- **Insertion** — each command rewrites the current line into markdown our
  renderer understands: `# ` / `## ` / `### `, `- `, `1. `, `- [ ] `, a fenced
  ```` ``` ```` code block, `> ` — with the caret placed inside (e.g. between the
  fences for code). The `MarkdownEditor` textarea shows **"Type / for commands…"**
  when the draft is empty.

Verified live (localhost:5173, CLA-15 peek): the empty description showed the
"Type / for commands…" placeholder; `/` opened the menu (H1/H2/H3 + divider +
Bulleted/Numbered/Checklist + divider + Code block/Blockquote, matching Linear's
layout and hints); selecting **Heading 1** inserted `# ` and "My heading" then
rendered as a real H1 on blur. `npx tsc -b` + `npm run build` green; console
clean (no errors, no infinite-loop warnings). _(Media/gif/attach/diagram/
collapsible omitted — no upload backend / no renderer support for those; the
slash menu is shared into comments too via MentionInput.)_

## 2026-06-17 — Loop #48: Issue links / "Resources" section

Soi'd Linear's issue (Chrome, workspace "Claude Test App"): the ⋯ overflow has
**Add link… (⌃L)** → an **"Add link to CLA-1"** modal (chain-link icon header,
**URL** field placeholder `https://...`, **Title (optional)** field, **Cancel** /
**Add link**). Submitting renders the link in a **Resources** section that sits
between sub-issues and Activity — a `▾ Resources` header with a collapse chevron
and a circular **+** (add another), then rows of **favicon · title** (the site
favicon; falls back to the URL host when no title) · relative time · a `···`
menu (**Open link** / **Copy link** / **Edit…** / **Remove…**). It also logs a
**"{user} linked {favicon} {title}"** activity entry. Reproduced 1:1:

- **Data model** — `IssueLink` (`url`, optional `title`, creator, `createdAt`) +
  an `issueLinks` store slice. Actions `addIssueLink` / `updateIssueLink` /
  `removeIssueLink`; persist-merge backfill for old workspaces; cleaned up on
  `deleteIssue` + `bulkDelete`. New `'link'` `ActivityKind` (`from`=url for the
  favicon, `to`=display text).
- **UI** — a shared `LinkFavicon` (Google s2 favicon service, graceful `Link2`
  fallback on error/unparseable URL) + `linkHost` helper; the `IssueLinks`
  Resources section in `IssueDetailBody` (shared by full-page detail + peek,
  hidden when empty like Linear); an `AddLinkModal` (doubles as edit, ↵ submits,
  Esc/backdrop closes, transient `linkModal` UI state); an **Add link…** row in
  the issue context menu (Linear's ⋯ analog); and the previously-inert **Links**
  display property now renders a link-count pill (`Link2` + N) on issue rows.

Verified live (localhost:5173): the seeded GitHub ("Design spec") + Figma links
render with real favicons; the **+** opened the Add-link modal, added
**"Linear docs"** → a new row (with the Linear favicon) + a "You linked 🔗 Linear
docs · now" activity line; all three persist across a reload (merge backfill OK).
`npx tsc -b` + `npm run build` green; console clean (no errors, no infinite-loop
warnings). _(The ⌃L keyboard shortcut and a styled remove-confirm dialog remain
TODO; the row pill follows Linear's default-off **Links** display toggle, so it's
hidden until enabled — matching Linear.)_

## 2026-06-17 — Loop #47: Create-issue modal "Create more" toggle + header close

Soi'd Linear's real **New issue** modal (Chrome, workspace "Claude Test App")
side-by-side with ours. The real modal: header `[team] CLA › New issue` with an
**expand** icon + **× close** top-right; footer is a paperclip (left) then a
**"Create more"** toggle + **Create issue** (right) — no Cancel button, no "⌘↵"
text; the `…` chip opens an overflow menu (**Set due date** ⇧D, **Make
recurring…**, **Add link…** ⌃L, **Add sub-issue** ⌘⇧O). Also confirmed (relevant
to last loop's leftover) that this workspace has **cycles disabled**, so its
Display-properties popover shows **no Cycle pill** — our list matches Linear
exactly (ID · Status · Assignee · Priority · Project · Due date · Milestone ·
Labels · Links · Time in status · Created · Updated), so a Cycle column would be
*unfaithful* here. Reproduced the two highest-value, fully-verifiable gaps:

- **"Create more" toggle** — a persisted `createMore` store flag (+ `setCreateMore`,
  kept across opens like Linear; left in `partialize` so it survives reloads) and
  a Linear-style switch in the footer. When on, **Create issue** keeps the modal
  open and resets the form (title/description/priority/assignee/labels/project)
  for rapid entry instead of closing + navigating.
- **× close button** in the header (right of the Template picker).

Verified live (localhost:5173): toggled Create more on, typed "First batch issue",
clicked **Create issue** → **CLA-15** appeared in Todo (3→4) and the modal stayed
open with a cleared title field; **×** closes the modal. `npx tsc -b` + `npm run
build` green; console clean (no errors, no infinite-loop warnings). _(Expand-to-
full-page, the paperclip attachment, and the `…` overflow items — Set due date /
Make recurring / Add link / Add sub-issue — remain TODO; the create-modal Cycle
field stays gated on cycles-enabled.)_

## 2026-06-17 — Loop #46: Cycle property picker on issues

The `Issue.cycleId` data model has existed since the Cycles loop, but there was
no way to set a cycle on an individual issue — only the create-modal could pass
one. Soi'd Linear's issue right-hand **Properties** group (workspace "Claude Test
App"): `Status · Priority · Assignee · **Cycle** · Estimate · Due date`. The
Cycle row shows the cycle/iteration glyph + `Cycle N` (or "No cycle"), and its
picker lists the team's cycles with a right-aligned status hint. Reproduced 1:1:

- **Store**: `setIssueCycle(id, cycleId?)` — mirrors `setIssueMilestone`,
  no-ops on unchanged, bumps `updatedAt`, logs a `cycle` activity.
- **Activity**: new `'cycle'` `ActivityKind`; `ActivityItem` renders it as
  "added to cycle {pill}" / "removed from cycle {pill}" with an `IterationCw`
  pill (`cyclePill` resolves `Cycle N` / custom name).
- **`IssueDetailBody`**: a `Cycle` `PropRow` (after Assignee, before Estimate)
  with a `SelectMenu` — options are the team's cycles sorted by number, each
  with a hint of **Active** / **Upcoming** / past date-range (via `cycleState`),
  plus a "No cycle" entry; trigger shows the `IterationCw` icon + label. The row
  is hidden when the team has no cycles (matches Linear hiding it when cycles are
  off). Shared by the full-page detail and the peek panel.
- Verified live (Chrome, localhost:5173): CLA-1's Cycle read "No cycle"; the
  picker listed **Cycle 1 · Active** and **Cycle 2 · Upcoming** with the check on
  "No cycle"; selecting Cycle 1 updated the property to "Cycle 1" and the feed
  logged "You added to cycle 🔄 Cycle 1 · now". `npx tsc -b` + `npm run build`
  green; no console errors. _(CreateIssueModal cycle field + a Cycle column in
  the list display-properties still TODO.)_

## 2026-06-17 — Loop #45: Per-row property hotkeys (s / p / a / l)

Prior loops left "per-row property hotkeys s/p/a/l still TODO — they need an
anchored picker". Soi'd Linear's real list (workspace "Claude Test App"): with a
row focused/hovered, the hotkey doesn't anchor to the row — it opens the **same
centered command-palette-style picker** as the ⌘K issue-context sub-pages, with
the issue chip as a header, a search box, the option list (check on current,
1-6 number hints) and Esc to close. Confirmed `s` → "Change status…", `p` →
"Set priority to…", `a` → "Assign to…", `l` → "Add labels…". Reproduced 1:1 by
**reusing the existing issue-context sub-pages** rather than building anchored
pickers:

- **State**: transient `commandIssueId` / `commandPage` (string) + an
  `openIssuePropertyMenu(issueId, page)` action that seeds them and opens the
  command menu. Both excluded from `persist`; `setCommandOpen(false)` clears them
  so a later plain ⌘K opens clean.
- **`useShortcuts`**: on the focused row (`focusedIssueId`), `s`/`p`/`a`/`l` map
  to status/priority/assignee/label and call `openIssuePropertyMenu`. Guarded by
  the existing overlay/typing checks; falls through to nothing when no row is
  focused (so `c` create etc. are unaffected).
- **`CommandMenu`**: `currentIssue` prefers `commandIssueId`; the open effect
  seeds `page` from `commandPage`; and in this focused-picker mode `back()`/Esc
  **closes** the menu instead of drilling back to the command-palette root
  (Linear's row hotkeys are standalone pickers, not a ⌘K drill-in).
- **Help overlay**: added S/P/A/L row hotkeys to the Issues section.
- Verified live (Chrome, localhost:5173): `s` on focused CLA-2 → status picker →
  "In Progress" moves the row to that group; `l` → label multi-select (check on
  Documentation), `a` → "Assign to…" list; Esc closes cleanly; `npx tsc -b` +
  `npm run build` green; no console errors. _(Due-date `d` / project `⇧P` row
  hotkeys + j/k re-peek while peeking still TODO.)_

## 2026-06-17 — Loop #44: Issue-list keyboard navigation (j/k row focus)

Several prior loops left "keyboard `j`/`k` navigation" and "row-level hotkeys" as
TODO. Soi'd Linear's real list (workspace "Claude Test App"): `j`/`k` (and the
arrow keys) walk a **focused row** — a subtle background plus a thin rounded
inset outline, with the select checkbox revealed exactly like the hover state;
`↵` opens the issue, `x` toggles its selection. Reproduced 1:1:

- **State**: a transient `focusedIssueId` (the focused issue's *identifier*,
  layered over the existing `navIssueIds` list order) + `setFocusedIssue` and
  `moveFocus(±1)` store actions. No-focus + `↓`/`j` focuses the first row,
  `↑`/`k` the last. Excluded from `persist`; cleared on route change next to the
  bulk selection.
- **Handler** (`useShortcuts`): `↓`/`j`, `↑`/`k`, `↵` (open peek), `x` (toggle
  select → feeds the bulk-action bar). Bails when typing **or** any open menu /
  popover / modal owns the keyboard — added a `data-overlay` marker to the
  shared `Popover` and `SelectMenu` portals and check for it (plus the
  command/create/help store flags).
- **`IssueRow`**: renders the focus state (bg + `ring-1 ring-inset
  ring-border-strong` + visible checkbox), scrolls itself into view
  (`block:'nearest'`) as focus moves, and focuses on `mouseenter` too (Linear
  does this). Works in the windowed `VirtualIssueList` since it reuses `IssueRow`.
- **Help overlay**: added ↓/J focus next, ↑/K focus previous, ↵ open, X select.
- Verified live (Chrome, localhost:5173): `j j` focuses CLA-2 with the Linear
  focus ring + checkbox, `x` selects it (accent check + "1 selected" bar), `↵`
  opens the peek ("2 / 8"); console clean, `npx tsc -b` + `npm run build` green.
  _(Per-row property hotkeys s/p/a/l still TODO — anchored pickers; j/k while a
  peek is open don't re-peek the target yet.)_

## 2026-06-17 — Loop #43: Prev/next issue navigation

The backlog was fully checked, so I soi'd Linear's issue header and found a clear
gap: Linear shows a **"n / total"** position counter with **↓ (next)** / **↑
(previous)** chevrons (split by a thin divider) on both the full-page issue and
the side peek, letting you walk the list you came from without going back.

- **`IssueNav`** (new shared component): the counter + ↓/↑ buttons, 1:1 with
  Linear's order (counter, ↓ next, divider, ↑ prev). The edge arrow disables
  (faded) at the first/last issue. Renders nothing when the current issue isn't
  in a known list (e.g. opened from ⌘K).
- **State**: a transient `navIssueIds` slice (ordered issue *identifiers*) +
  `setNavIssueIds(ids)` that no-ops when the order is unchanged (avoids render
  churn) and is excluded from `persist`.
- **Publishers**: `GroupedIssueList` (covers `VirtualIssueList` and every list
  screen that uses it) and `IssueBoard` push their visible order into the slice
  via a `useEffect` keyed on the flattened identifier list.
- **Consumers**: the `IssueDetail` header (navigates `/issue/:id`) and the
  `IssuePeek` header (re-peeks the destination issue).
- Verified live (Chrome, localhost:5173): peek on CLA-1 shows "1 / 8" with the
  up arrow faded (first), ↓ advances to CLA-2 "2 / 8" with both arrows live, and
  maximizing carries the same "2 / 8" into the full-page header. Console clean,
  `npx tsc -b` + `npm run build` green. _(Keyboard `j`/`k` / arrow shortcuts for
  prev/next still TODO — buttons only this round.)_

## 2026-06-17 — Loop #42: Display properties (Display options popover)

The backlog was fully checked, so I soi'd Linear's **Display options** popover
(active-issues view) and found a clear gap: under Layout / Grouping / Ordering,
Linear has a **Display properties** section of toggle pills controlling which
properties render on each issue row. Our `DisplayMenu` had only the first three.

- **Pills, 1:1 with Linear**: ID · Status · Assignee · Priority · Project · Due
  date · Milestone · Labels · Links · Time in status · Created · Updated, in that
  exact order, active = filled (`bg-bg-selected`), inactive = outlined. Defaults
  mirror Linear (Milestone / Links / Time-in-status / Updated start hidden).
- **State**: `DisplayProperty` type + `DISPLAY_PROPERTIES` / `DEFAULT_DISPLAY_PROPERTIES`
  constants; a persisted `displayProperties` store slice with a
  `toggleDisplayProperty(prop)` action and a persist-`merge` backfill that fills
  any missing keys for older workspaces.
- **`IssueRow`** now honours every toggle — gating priority / id / status /
  due-date / labels / created / assignee, and **adding** Project (icon + name
  chip), Milestone (diamond chip) and Updated (date) rendering it lacked before.
- Verified live (Chrome, localhost:5173): the pills section matches Linear,
  toggling Project + Created instantly removes those columns from every row and
  re-enabling restores them, console clean. `npx tsc -b` + `npm run build` green.
  _(Links / Time-in-status pills are present for visual parity but inert — we
  don't track external links or per-status durations; board cards still render a
  fixed property set, a follow-up.)_

## 2026-06-17 — Loop #41: Issue subscribers

The backlog was fully checked, so I closed a real gap: the `Issue.subscriberIds`
field existed in the data model (seeded, maintained on create/comment) but had
**no UI**. Built the Subscribers surface to match Linear.

- **Subscribers section** in the issue's right-hand Properties panel (below
  Project/Milestone): an uppercase "Subscribers" header with stacked subscriber
  avatars (overlapping `-space-x-1`, bg ring) + a "{name}" / "{n} subscribers"
  caption, or an "Add subscribers" placeholder when empty.
- **`SubscriberPicker`** (`pickers.tsx`): a multi-select member dropdown
  (`SelectMenu` with `keepOpen`, checkmarks, "Add subscribers…" placeholder),
  modeled on `LabelPicker`. Clicking the avatars row opens it; toggling a member
  adds/removes them.
- **Subscribe / Unsubscribe toggle** in the Activity section header (bell /
  bell-off icon, Linear's hover copy), flipping the current user's subscription
  via the new `toggleIssueSubscriber(id, userId)` store action.
- Fixed a duplicate-React-key warning: the seed produced `['u_me','u_me']` when
  the assignee was me — deduped both the seed and the render with `new Set`.
- Shared by the full-page `IssueDetail` and the `IssuePeek` panel (both use
  `IssueDetailBody`). Verified live (Chrome): section renders, picker adds Avery
  Chen → "2 subscribers" with YO+AC avatars, console clean. `npx tsc -b` +
  `npm run build` green. _(No auto-subscribe-on-assign / comment-subscribe yet;
  subscribe isn't a logged timeline activity, matching Linear.)_

## 2026-06-17 — Loop #40: Initiative updates / health + project-side Initiative picker

Closed the two TODOs Loop #39 left on the Initiatives feature, as one coherent
slice mirroring Linear's project-update pattern at the initiative level.

- **Initiative updates / health timeline**: `InitiativeUpdate` model (`types.ts`,
  reuses `ProjectHealth`) + `initiativeUpdates` state seeded with one on-track
  update on H2 Product Launch; `createInitiativeUpdate` / `deleteInitiativeUpdate`
  store actions; a persist-`merge` backfill so older workspaces gain the array.
- **`InitiativeUpdates` component**: a 1:1 mirror of `ProjectUpdates` — On track /
  At risk / Off track health pills, an `@`-mention markdown composer ("Write an
  initiative update…" → "Post update"), and a reverse-chronological timeline
  (avatar, `HealthBadge`, `timeAgo`, rendered markdown, hover-delete). Reuses the
  exported `HEALTH` map + `HealthBadge` from `ProjectUpdates`.
- **InitiativeDetail**: added **Overview / Updates** tabs (same style as
  `ProjectDetail`); Overview keeps the Projects rollup, Updates renders the new
  composer/timeline. The header stats row now shows the **latest health badge**.
- **Project-side Initiative picker**: a chip in the `ProjectDetail` header
  (initiative emoji + name, or a Goal icon + "No initiative") backed by a
  `SelectMenu` listing every initiative + "No initiative", wired to
  `setProjectInitiative`. Verified live (Chrome) on the initiative detail
  (badge + tabs + composer + seeded entry) and the MVP project (chip shows "🎯
  H2 Product Launch") with a clean console. `npx tsc -b` + `npm run build` green.

## 2026-06-17 — Loop #39: Initiatives

The backlog was fully checked, so I introduced a new flagship Linear feature:
**Initiatives** (strategic efforts that group projects). Soi'd Linear's real
Initiatives surface first via Chrome (workspace "Claude Test App"): a
workspace-level page with **Active / Planned / Completed** tabs and an empty
state — three-bar line-art illustration, the exact copy "Initiatives are larger,
strategic product efforts that set the direction of your company. They are
comprised of all projects that align with the goals of the initiative and allow
you to monitor their progress at scale.", plus **Create new initiative** (`N`
then `I`) and **Documentation** buttons. (Creating one is plan-gated in real
Linear, so the create modal mirrors Linear's known New-initiative dialog.)

Reproduced as a coherent end-to-end slice:

- **Model**: `Initiative` (`status` backlog/planned/active/completed, `ownerId`,
  `targetDate`, icon/color) in `types.ts`; `Project.initiativeId` links a
  project into one. `INITIATIVE_STATUS` + order in `constants.ts`.
- **Store**: `createInitiative` / `updateInitiative` / `deleteInitiative`
  (keeps the projects, just unlinks) / `setProjectInitiative`, a
  `createInitiativeOpen` UI flag, partialize strip, and a persist-`merge`
  backfill that seeds `initiatives` **and** links the seed projects for
  workspaces persisted before the feature existed.
- **Selector**: `initiativeProgress` rolls up done/total across the union of an
  initiative's projects' issues.
- **Views**: `/initiatives` list (tabs, empty state, rows with icon / status
  ring / project count / progress bar / owner) and `/initiative/:id` detail
  (header with inline status + owner `SelectMenu` pickers, target/issue stats,
  rollup bar; a Projects section listing each project with its own progress and
  add/remove-project controls; delete in the breadcrumb).
- **Create**: `CreateInitiativeModal` — centered, workspace chip, emoji icon
  palette, name, description, status + owner pickers, Cancel / **Create
  initiative**, ⌘↵ to submit, navigates to the new initiative.
- **Wiring**: a new `InitiativeIllustration` in `EmptyState`, a sidebar
  **Initiatives** item (Goal icon) in the Workspace section, ⌘K **Go to
  Initiatives** + **Create new initiative**, and routes in `App.tsx`.
- Seeded an **H2 Product Launch** initiative spanning MVP Launch + Mobile App.
- Verified live (localhost:5173) with Chrome: list (2 projects, 13% rollup),
  detail page, and the New-initiative modal all render correctly; no console
  errors. `npx tsc -b` + `npm run build` green.

Next: Initiative **updates / health** timeline (like project updates), a
project-side **Initiative** property picker, and an Initiatives row on the
**Roadmap**. Keep appending newly-soi'd Linear features (Documents, Customer
requests, Pulse, Asks).

## 2026-06-17 — Loop #38: Async / email-style export

Built the **async / email-style export** flow (🟢, the last unchecked backlog
item). Soi'd Linear's real Settings → Import & export first via Chrome
(workspace "Claude Test App"): the Export section reads "You can export your
issue data in CSV format. Once the export is available, we'll email you the
download link." and clicking **Export…** fires a bottom-right toast titled
**"Check your email"** / "Once the export is ready, it will be emailed to you
(email)." — no immediate download. Reproduced that 1:1, adapted for our
backend-less app:

- `toast.ts`: extended `Toast` with optional **`title`** (bold first line),
  **`action`** (`{label, onClick}` inline button), and **`duration`** (ms
  override). `add` now takes `Omit<Toast,'id'>`; `toast()` accepts a string
  (back-compat for the copy toasts) **or** an options object.
- `Toaster.tsx`: renders the title above the message, an optional action button
  (runs `onClick` then dismisses), and honours per-toast `duration`.
- `ImportExportSettings.tsx`: choosing CSV/JSON now (1) fires the exact
  **"Check your email"** toast with the current user's email, (2) puts the
  Export button into a **spinner + "Exporting…"** pending state (row hint
  "Preparing CSV export…") for a mocked `EXPORT_PREP_MS` (2.5s) prepare delay,
  then (3) fires a second **"Export ready"** toast — "Your CSV export is ready
  to download." — with a **Download** action that performs the real
  CSV/JSON download (our stand-in for the emailed link). Export description
  updated to match Linear's "…we'll email you the download link." wording.
- Verified live (localhost:5173) with Chrome side-by-side vs real Linear:
  "Check your email" toast + pending state appear on click, then the "Export
  ready" toast with Download after the delay. No console errors.
  `npx tsc -b` + `npm run build` green.

Next: BACKLOG is fully checked — append newly-soi'd Linear features as the loop
notices them (e.g. Initiatives, Pulse, Documents, Customer requests, Asks).

## 2026-06-17 — Loop #37: Label groups in settings

Built **label groups** (🟢) — the top remaining Discovered item. Soi'd Linear's
real Settings → Labels page first via Chrome (workspace "Claude Test App"):
the header has **New group** + **New label** buttons; clicking **New group**
drops an inline group row (multi-colored cluster glyph + "Group name" input)
and, on submit, immediately opens an indented "Label name" input nested under
it (with a tree-connector line). A group row has a collapse chevron and a child
count; its "…" menu offers Edit name / Add label to group / Archive / Delete.
Reproduced the structure 1:1 in the compact Labels settings card.

- `types.ts`: `Label` gains `isGroup?` (a container) and `groupId?` (membership).
- `store.ts`: `createLabelGroup(name)` (id `lg_…`, grey, `isGroup`), extended
  `createLabel(name, color, groupId?)`, `updateLabel` patch now allows `groupId`.
  `deleteLabel` on a group **ungroups** its children (sets `groupId: undefined`)
  rather than cascading the delete — keeps the labels, matches Linear leaving
  them behind. Labels still get pulled from issues on delete as before.
- `LabelsSettings.tsx`: rewritten. Renders groups first (chevron-collapsible
  rows: `LabelGroupIcon` cluster tinted from child colors + inline-rename input
  + child count + hover "+" to add a label + delete), each with its children
  nested under a CSS tree connector (`border-b/border-l`), then ungrouped labels,
  then a toolbar: **New group** (inline "Group name…" input → creates group and
  auto-opens its first add-label input, à la Linear) and the existing add-label
  row. Inline color/name editing preserved; per-row usage counts kept.
- Excluded groups from selectable-label lists: issue `LabelPicker` (pickers.tsx),
  `FilterBar`, the ⌘K "Add labels" sub-page, and group-by-label in `selectors.ts`.
- `seed.ts`: wrapped Bug/Feature/Improvement in a seeded **Type** group so the
  feature is visible out of the box (Design/Documentation/Needs triage stay
  ungrouped).
- Verified live (localhost:5173) with Chrome after clearing localStorage:
  Type group shows the cluster glyph + "3 labels" with nested children; collapse
  toggles; created a "Priority" group via the toolbar → it opened the nested
  add-label input → added "Urgent" (0 issues). No console errors.
  `npx tsc -b` + `npm run build` green.

Next (Discovered later): async / email-style export 🟢. Group "…" context menu
(Archive) and dragging labels into groups noted as follow-ups.

## 2026-06-17 — Loop #36: Cycle burndown chart

Built the cycle **burndown chart** (🟡) — the top remaining Discovered item.
Cycles are disabled in the live "Claude Test App" workspace so Linear's real
graph wasn't observable; followed Linear's known burndown design (ideal
guideline vs. actual remaining, today marker, area fill) — flag to re-check
against the original in a browser when a workspace with cycles is available.

- `selectors.ts`: new `cycleBurndown(cycle, issues, nowMs)` → per-day series.
  For each day from cycle start→end it computes `ideal` (straight scope→0 line)
  and actual `remaining` = scope − issues whose `completedAt` falls on/before
  that day; future days get `remaining: null` so the actual line stops at today.
  Day boundaries normalized via local `startOfDay`. Returns `{points, scope, days}`.
- `CycleBurndown.tsx`: dependency-free SVG (viewBox `720×220`, `width=100%`).
  Renders horizontal gridlines + Y ticks (0…scope), a dashed **today** marker
  (interpolated x for `nowMs`), the dashed **Ideal** guideline, the accent
  **Open** remaining line with an `accent-subtle` area fill, start/mid/end X
  date labels, and an Open/Ideal legend. Uses design tokens only.
- `CyclesView.tsx`: renders the chart under the stacked progress bar inside the
  cycle summary header, gated on `scope > 0` (so upcoming/empty cycles fall back
  to the existing "No issues" empty state — verified on Cycle 2).
- `seed.ts`: made the active cycle mid-flight (`cy_1`: −7d…+7d, `cy_2`: +7d…+21d)
  and added `cycleId: 'cy_1'` to the completed "Dark mode polish" issue, then
  spread cy_1's completions across its elapsed days, so the burndown is
  illustrative (scope 6, 1 completed → Open steps 6→5, sits above the ideal line).
- Verified live (localhost:5173) with Chrome after resetting localStorage to
  pick up the seed: active cycle shows the descending Open line + dashed ideal +
  today marker; upcoming cycle hides the chart cleanly; no console errors.
  `npx tsc -b` + `npm run build` green.

Next (Discovered later): label groups 🟢, async/email-style export 🟢. Burndown
"Started" stacked area + points-unit toggle noted as follow-ups.

## 2026-06-17 — Loop #35: "Try" onboarding section in the sidebar

Built the onboarding / first-run experience (🟡). Soi'd Linear first via Chrome:
it's **not** a separate "Get started" widget — it's a **"Try"** section at the
bottom of the sidebar (same uppercase header style as Workspace / Your teams)
with three action rows: **Import issues** (copy icon), **Invite people** (+),
**Connect GitHub** (GitHub octocat). Hovering a row reveals a dismiss **×** on
the right; dismissing/completing a step removes that row, and the section
disappears once empty. Reproduced 1:1.

- `Sidebar.tsx`: new `TryItem` (icon + label, click runs the action, hover-× via
  `group/try` + `opacity-0 group-hover/try:opacity-100`) and a `GithubMark`
  inline SVG (lucide dropped its brand `Github` icon). A `trySteps` array drives
  the rows; each is filtered out when `done` (Invite people → `users.some(pending)`)
  or its key is in `onboardingDismissed`. Section renders only when steps remain,
  after the team sections. Rows route to `/settings` (where import & invite live).
- `store.ts`: persisted `onboardingDismissed: string[]` (UIState) + a
  `dismissOnboardingStep(key)` action. No merge backfill needed — initial state
  already provides `[]`, so older persisted workspaces inherit it.
- Verified live (localhost:5173) with Chrome side-by-side vs Linear: TRY section +
  three rows match, hover-× appears and dismisses individually (Import issues →
  gone), clicking a row navigates to Settings, no console errors. `npx tsc -b` +
  `npm run build` green.

Next (Discovered later): cycle burndown 🟡 (not observable — Cycles disabled in
this workspace; bám known design), label groups 🟢, async/email export 🟢.

## 2026-06-17 — Loop #34: Set due date ⌘K sub-page

Built the command-menu "Set due date" contextual sub-page (the TODO flagged in
Loops #30/#54). Soiled Linear's real flow via Chrome first: from an issue, ⌘K →
"Set due date… (⇧ D)" drills into a page with placeholder `Try: 24h, 7 days,
Feb 9` and the quick options **Custom…**, **Tomorrow**, **End of this week**,
**In one week**, each with its resolved date right-aligned (e.g. Tomorrow →
Thu, 18 Jun). "Custom…" opens a calendar. Reproduced 1:1.

- `CommandMenu.tsx`: new `dueDate` Page. Contextual root gains a **Set due
  date…** command (calendar icon, hint `⇧ D`) after Add labels…. The sub-page
  lists Custom… / Tomorrow / End of this week (Friday of the current week) / In
  one week, with `meta` = `format(d, 'EEE, d MMM')` shown right-aligned (new
  `Command.meta` field rendered as muted text). A **Remove due date** row appears
  when the issue already has one.
- `parseDueInput()`: parses the relative/explicit input — `today`/`tomorrow`,
  `Nh`/`Nd`/`Nw`/`Nmo`, and month/numeric dates (`Feb 9`, `February 9`, `6/20`),
  bumping year-less past dates to next year. A match surfaces a single resolved
  suggestion row (verified: `feb 9` → "Tue, Feb 9, 2027"). Special-cased
  `filtered` so the dueDate page shows its own query-derived list unfiltered, and
  added `query` to the commands memo deps.
- **Custom…** sets `dueCustom` and renders the existing `Calendar` (now exported
  from `DatePicker.tsx`) inline, centered; selecting a day sets the due date and
  closes. Esc/Backspace pops calendar → page → context → close via `back()`.
- Bonus fix: the search input now refocuses across sub-page drill-ins (an
  `inputRef` + effect on `[open, page, dueCustom]`), so typing keeps working
  after a mouse click — previously focus was lost on click-drill.
- Verified live on the dev server with Chrome side-by-side vs Linear: options +
  dates match exactly, parser works, Custom calendar opens with the current date
  highlighted, activity logs "set the due date to …", no console errors.
  `npx tsc -b` + `npm run build` green.

Next (Discovered later): onboarding tour / first-run checklist + cycle burndown
remain 🟡 but aren't observable in this workspace (Cycles disabled / established
workspace) — bám sát known Linear design when revisited. Remaining 🟢: label
groups, async/email export.

## 2026-06-17 — Loop #33: Toast feedback on copy

Built a Linear-faithful toast system for the copy actions. Soiled Linear's real
toasts via Chrome first: triggered Copy URL / Copy ID / Copy git branch name on a
row and captured the exact wording, placement (bottom-right), and chrome (elevated
white card, dark filled info-circle with a white "i", message, × dismiss).

- New `lib/toast.ts`: a **separate, non-persisted** Zustand store (`useToasts`)
  so ephemeral toasts never leak into localStorage or re-render the main store.
  Exposes `toast(message)` (callable from plain handlers), `copyToClipboard(text,
  message)` (writeText + toast in one), and a `copyToast` map holding Linear's
  verbatim strings: `"<id>" copied to clipboard`, `Issue URL copied to clipboard`,
  `Branch name copied to clipboard. Paste it into your favorite git client.`
- New `components/Toaster.tsx`: a portal'd bottom-right stack; each `ToastItem`
  auto-dismisses after 5s (and on × click). Uses design tokens (bg-bg-elevated,
  border-border, shadow-lg) so it themes light/dark. Added a `toast-in` slide-up
  keyframe in `index.css`. Mounted once in the App `Shell`.
- Rewired every copy action to `copyToClipboard(...)`: `IssueContextMenu` (Copy
  ID / URL / branch), `CommandMenu` issue-context commands, and the `IssueDetail`
  + `IssuePeek` header buttons (URL + branch).
- Verified live on the dev server with Chrome: right-click → Copy issue URL shows
  "Issue URL copied to clipboard" bottom-right with the dark info badge, then
  auto-dismisses; matches Linear side-by-side. No console errors. `npx tsc -b` +
  `npm run build` green.

Next (Discovered later, all 🟡/🟢): onboarding tour / first-run checklist and
burndown chart aren't observable in this workspace (Cycles disabled, established
workspace) — revisit when observable. Remaining: set-due-date ⌘K sub-page, label
groups, async/email export.

## 2026-06-17 — Loop #32: Import / export issues (CSV + JSON)

Built the last 🟢 backlog item — issue import/export — as a Linear-faithful
"Import & export" Settings card. Soiled Linear's real `settings/import-export`
page via Chrome first (Import assistant / CLI import / Export sections, exact
copy, bordered rows with right-aligned `Export…` button).

- New `lib/importExport.ts`: a **name-based** serializer so CSV and JSON both
  round-trip. `toExportRows` maps issues → readable rows (Team/Status/Assignee/
  Labels/Project/Milestone by name, Priority as its label, excludes triage).
  `rowsToCsv`/`csvToRows` are RFC-4180 (quoted fields, escaped quotes, embedded
  newlines — issue descriptions contain markdown + newlines). `rowsToJson`/
  `jsonToRows` (accepts a bare array or `{issues:[…]}`). `parseImportFile`
  dispatches by extension, `downloadFile` triggers a Blob download, and
  `parsePriority` maps a label/number back to the 0–4 scale.
- New `importIssues(rows)` store action: "creates a copy" like Linear's import
  assistant — resolves team (by key/name), status, assignee (name/email),
  labels, project, milestone all by name against the workspace; assigns fresh
  per-team identifiers (CLA-15, …), seeds `sortOrder`, logs a `created`
  activity, and never overwrites. Returns the count imported.
- New `ImportExportSettings.tsx` wired into `SettingsView`: an **Import** section
  (hidden file input + `Import…`, accepts `.csv`/`.json`, shows
  "Imported N issues…" feedback) and an **Export** section (`Export…` popover →
  Export as CSV / Export as JSON, downloads `issues-YYYY-MM-DD.{csv,json}`).
- Verified against the running dev server with Chrome: the card matches Linear's
  layout; a full export→parse→import round-trip in the live store produced 14
  rows, parsed back cleanly from both CSV and JSON, and imported 2 new issues
  with status/priority/labels preserved (cleaned up after). No console errors.
  `npx tsc -b` + `npm run build` green.

Next: all listed backlog items are done — the loop should append newly-noticed
Linear features under "Discovered later" (e.g. onboarding tour / first-run
checklist, label groups, burndown chart, async/email export, set-due-date ⌘K
sub-page, toast feedback on copy).

## 2026-06-17 — Loop #31: Empty states polish

Replaced the ad-hoc "No issues" / "Nothing snoozed." text blocks with a
consistent, Linear-faithful empty-state pattern (soiled Linear's real
"My issues" and Inbox screens via Chrome first: centered monochrome line
illustration → muted title → description → optional accent-pill action).

- New `EmptyState.tsx`: an `EmptyState` component (`illustration`, `title`,
  `description?`, `action?`, `hint?`) plus six dependency-free SVG line
  illustrations drawn in `currentColor` at `text-faint` so theme applies —
  `IssuesIllustration` (the isometric ring + chevrons + brackets, matching
  Linear's), `InboxIllustration` (tray), `SearchIllustration` (magnifier),
  `StackIllustration` (cards), `CycleIllustration`, `CheckIllustration`.
- Wired in: `GroupedIssueList` (Issues + My Issues, via a new `empty` prop so
  My Issues reads "No issues assigned to you" like the real app), `Inbox`
  (Inbox + Snoozed tabs), `SearchView` (no-results), `CyclesView`,
  `TriageView`, `ProjectsView` (added — was an empty grid), `ViewsView`.
- Verified against the running dev server with Chrome: search no-results shows
  the magnifier state, the Snoozed tab shows the tray (matches Linear's), no
  console errors. `npx tsc -b` + `npm run build` green.

Next: **Import / export** issues as JSON/CSV. _(Onboarding tour / first-run
checklist noted in the backlog.)_

## 2026-06-17 — Loop #30: Command menu contextual actions

⌘K now acts on the issue you're viewing, matching Linear's command menu
(verified against the real app — opened CLA-1, ⌘K, observed the contextual list
and the "Change status…" sub-page with its checkmark on the current status).

- `CommandMenu.tsx`: detects the **current issue** from `peekIssueId` (peek
  takes precedence) or the `/issue/:identifier` route. When one is in context,
  the search bar shows a Linear-style chip (`CLA-1 · Title ⊗`) and the list is
  led by contextual commands: **Assign to…** (A), **Assign to me** (I),
  **Change status…** (S), **Set priority…** (P), **Add to project…** (⇧P),
  **Add labels…** (L), and **Copy issue ID / URL / git branch name** — same
  order/labels/hints as Linear.
- Sub-pages: the `…` commands drill into a searchable option list (`page` state)
  with the placeholder set to the command name and a check on the current value;
  picking a value calls the matching store action. Labels `keepOpen` so you can
  toggle several. `Escape`/`Backspace`-on-empty pops back to the root, and a
  second pop (or the chip's ⊗) clears the issue context to the global commands.
- Reuses the existing store mutations (`setIssueStatus`/`setIssuePriority`/
  `setIssueAssignee`/`setIssueProject`/`toggleIssueLabel`) and the same
  sort/ordering helpers the property pickers use.

Next: **Empty states & onboarding** polish. _(Set due date sub-page noted in the
backlog — it needs the calendar popover, not a flat list.)_

## 2026-06-17 — Loop #29: Copy git branch name + issue URL

Linear-style "copy" actions on issues:

- `utils.ts`: `slugify()` (kebab, strips quotes, 60-char cap), `branchName()`
  (Linear's `handle/cla-123-title-slug` — handle from the user's email
  local-part, fallback to name slug or `me`), and `issueUrl()` (rooted at the
  running app's `window.location.origin`).
- `IssueContextMenu`: the existing "Copy issue ID" row now joined by "Copy issue
  URL" (Link2) and "Copy git branch name" (GitBranch), via a shared `copy()`
  helper that writes to the clipboard and closes the menu; branch handle taken
  from the current user (`isMe`).
- `IssueDetail` + `IssuePeek` headers: the old "Copy link" button (which copied
  only the bare identifier) is replaced by two buttons — a GitBranch
  "Copy git branch name" and a Link2 "Copy issue URL" (full origin URL).

Verification was run under extreme machine load (load avg ~160, ~30 MB free);
changes are additive + type-safe (3 pure helpers, clipboard calls referencing
existing fields). Next: **Command menu contextual actions** (status/assignee/
label/priority for the issue you're viewing). Toast-on-copy feedback noted in
the backlog.

## 2026-06-17 — Loop #28: Activity types (diffed feed)

The issue activity feed now reads like Linear's — every change with its diff:

- `types.ts`: added `'milestone'` to `ActivityKind`; documented `from`/`to`.
- `store.ts`: every property mutation now logs an activity with the real
  `from`/`to` and skips no-op changes — `setIssuePriority` (numeric from→to),
  `setIssueAssignee` (old→new user), `toggleIssueLabel` (added → `to`, removed →
  `from`), `setIssueProject`, `setIssueMilestone`, `setIssueEstimate`,
  `setIssueDueDate`, `setIssueTitle`. (`status`/`created` already logged.)
- New `components/ActivityItem.tsx`: resolves each kind into a sentence with the
  relevant glyph/chip — status & priority icons with a `→` diff, assignee/label
  /project/milestone chips, estimate "N points", due date as a full date, title
  rename in quotes. Replaces the old `changed ${kind}` stub in `IssueDetailBody`.
- `seed.ts`: a richer history on i_5 (priority/assignee/label/status/estimate) to
  showcase the feed.
- `tsc` ✅ · build ✅ (built in 4.11s).

Next: **Git branch name** copy + "Copy issue URL", more issue context actions.


## 2026-06-17 — Loop #27: Notification detail (snooze + prefs)

A real inbox, Linear-style:

- `types.ts`: `NotificationType`, `Notification.snoozedUntil`, `NotificationPrefs`.
  Store: `snoozeNotification` / `unsnoozeNotification` / `deleteNotification`,
  persisted `notificationPrefs` + `setNotificationPref`.
- `Inbox` rewritten: Inbox/Snoozed tabs; each row has a snooze menu (in 1 hour /
  tomorrow / next week), delete, and mark-read-on-open; a header "Preferences"
  popover toggles notifications per type; the Snoozed tab can unsnooze and shows
  the "snoozed until" time.
- `Sidebar`: the unread badge now excludes snoozed notifications.
- `seed.ts`: two more notifications (assigned / mention).
- Verified live: snoozing the comment notification moved it to Snoozed
  ("snoozed until Jun 17, 11 AM"), emptied the Inbox and cleared the sidebar
  badge; unsnooze restored it. `tsc` ✅ · build ✅ · clean console.

Next: **Activity types** — render every change kind (priority/label/project/estimate/due) with diffs.


## 2026-06-17 — Loop #26: Members & roles + invite

Manage who's in the workspace, Linear-style:

- `types.ts`: `UserRole` + `User.role` / `User.pending`. Store: `setUserRole`,
  `inviteMember` (derives a name from the email, marks Pending), `removeUser`
  (skips yourself; clears the user from assignees and team rosters); the persist
  `merge` now backfills `role` for older workspaces.
- `seed.ts`: roles per user (admins / members / a guest).
- New `components/MembersSettings.tsx`: each member shows a role `<select>`
  (your own disabled), a hover remove, and an invite row (email + role).
- `SettingsView`: the Members card now hosts it.
- Verified live: roles backfilled correctly; inviting dana.scott@acme.io added
  "Dana Scott · Pending · Member" and bumped the member count to 6.
  `tsc` ✅ · build ✅ · clean console.

Next: **Notification detail** — snooze, per-type preferences, mark-read-on-open.


## 2026-06-17 — Loop #25: Multi-team polish

Make the second team a first-class citizen, Linear-style:

- `types.ts`: `Team.memberIds`. Store: `toggleTeamMember`; a persist `merge` that
  backfills `memberIds` from the seed for workspaces saved before this (so no
  reset is needed and nothing crashes on the missing field).
- `seed.ts`: members on both teams, two Engineering issues, and fixed per-team
  issue identifiers (ENG issues were wrongly numbered `CLA-…`).
- New `components/TeamsSettings.tsx` (Settings "Teams" card): each team shows
  icon/key/issue-count/members with an add/remove member picker.
- `Sidebar`: the workspace button is now a switcher dropdown — jump to any team's
  issues or Settings.
- Verified live: Teams card shows CLA (4 members) + Engineering (2 members) via
  the backfill; the switcher navigated to the Engineering team. (A transient
  "Popover is not defined" was an HMR artifact; clean after reload.)
  `tsc` ✅ · build ✅ · clean console.

Next: **Members & roles** management in settings; invite flow (mock).


## 2026-06-17 — Loop #24: List virtualization

Large issue lists stay smooth — the fix the seeded CLA-5 asked for:

- New `components/VirtualIssueList.tsx`: a dependency-free windowed renderer.
  Groups are flattened to fixed-height (36px) header/row items; only the rows in
  the viewport (+overscan) are mounted, sized via a full-height spacer and a
  translateY offset; a ResizeObserver tracks the viewport height.
- `GroupedIssueList`: above 50 flattened rows it delegates to `VirtualIssueList`
  (drag-reorder and collapse drop out at that scale — the right trade-off);
  smaller lists keep the dnd path.
- Verified live: injected 200 issues (Todo = 202) → only 33 IssueRows mounted in
  the DOM with a tall scroll spacer; removed the test data afterward.
  `tsc` ✅ · build ✅ · clean console.

Next: **Multi-team polish** — team switcher, per-team settings, team membership.


## 2026-06-17 — Loop #23: Favorites

Star the things you care about, Linear-style:

- `types.ts`: `Favorite { type: 'issue'|'project'|'view', id }`. Store: persisted
  `favorites` + `toggleFavorite`.
- New `components/StarButton.tsx`: a fill-on-active star, wired into the
  IssueDetail, ProjectDetail and SavedViewScreen headers.
- `Sidebar`: a "Favorites" section (shown when non-empty) resolves each favorite
  to its label/icon and links to it; dead references are skipped.
- Verified live: starring MVP Launch filled the header star and added a
  "Favorites › MVP Launch" entry to the sidebar. `tsc` ✅ · build ✅ · clean console.

Next: **List virtualization** for large lists (fixes the seeded perf issue CLA-5).


## 2026-06-17 — Loop #22: Roadmap / timeline

A bird's-eye timeline of projects, Linear-style:

- New `views/RoadmapView.tsx` at `/roadmap`: a month axis (date-fns) with each
  project drawn as a horizontal bar positioned/sized by its start→target dates,
  colored per project with a progress fill and a "today" marker; bars and names
  link to the project.
- Wired into the sidebar (Workspace section), the command menu, and a `G R` chord.
- Verified live: MVP Launch (Jun→mid-Jul, 33% fill) and Mobile App (Jun→Oct,
  0%) rendered on the Jun–Oct 2026 axis with the today line. `tsc` ✅ · build ✅ ·
  clean console.

Next: **Favorites** — star issues/projects/views; a Favorites section in the sidebar.


## 2026-06-17 — Loop #21: Project updates

Report project health over time, Linear-style:

- `types.ts`: `ProjectHealth` + `ProjectUpdate`. Store: `projectUpdates` slice
  with `createProjectUpdate` / `deleteProjectUpdate`. Seeded one on-track update.
- New `components/ProjectUpdates.tsx`: a `HealthBadge`, a composer (health
  toggle on-track/at-risk/off-track + a `MentionInput` body) and a
  reverse-chronological timeline (avatar, badge, markdown body, hover delete).
- `ProjectDetail`: Issues / Updates tabs; the header shows the latest update's
  health badge.
- Verified live: posted an "At risk" update — it landed atop the timeline and
  flipped the header badge from On track → At risk. `tsc` ✅ · build ✅ · clean console.

Next: **Roadmap / timeline** view of projects across time.


## 2026-06-17 — Loop #20: Project milestones

Plan a project in milestones, Linear-style:

- `selectors.ts`: `milestoneProgress(milestoneId, …)`.
- Store: `createMilestone` / `deleteMilestone` (clears the link on affected
  issues) and `setIssueMilestone`; `setIssueProject` now also clears the
  milestone when the project changes.
- `ProjectDetail`: rewritten to group issues by milestone — each section shows a
  Flag, name, done/total and a progress bar, with a hover delete and a final
  "No milestone" group; "+ Milestone" in the header creates one.
- `IssueDetailBody`: a Milestone picker appears for issues whose project has
  milestones.
- Verified live: MVP Launch showed Alpha/Beta/No-milestone groups; assigning
  CLA-5 to Alpha from the picker moved it (Alpha 0/1 → 0/2). `tsc` ✅ · build ✅ ·
  clean console.

Next: **Project updates** — status posts (on-track / at-risk / off-track) with a timeline.


## 2026-06-17 — Loop #19: Keyboard shortcuts help + G-chords

Discoverable shortcuts, Linear-style:

- New `components/HelpOverlay.tsx`: a `?`-triggered modal listing shortcuts in
  Navigation / General / Issues groups with `<kbd>` styling. Transient `helpOpen`
  state in the store.
- `useShortcuts`: added `?` (help) and `G`-prefixed navigation chords with a
  1.2s window — G→I/M/B/C/T/P/V/S jump to Inbox/My Issues/Issues/Cycles/Triage/
  Projects/Views/Search. ⌘K and C unchanged.
- `CommandMenu`: a "Keyboard shortcuts" command (hint `?`).
- Verified live: `?` opened the help modal; G→P then G→S navigated to Projects
  then Search. (A one-off hooks-order warning was an HMR artifact from adding
  refs to useShortcuts; clean after reload.) `tsc` ✅ · build ✅ · clean console.

Next: **Project milestones** with progress; group project issues by milestone.


## 2026-06-17 — Loop #18: Manual drag-to-reorder in lists

Reorder issues within a status group by dragging, Linear-style:

- `GroupedIssueList`: an optional `onReorder` prop turns rows into dnd-kit
  sortables (DndContext + per-group SortableContext, 6px activation so clicks
  still open the peek). On drop it computes a midpoint `sortOrder` between the
  new neighbors (same-group only) and calls back.
- `IssuesView` passes `onReorder` → `setIssueSortOrder(id, sortOrder)` and
  switches Ordering to Manual so the new order is shown.
- Store: `setIssueSortOrder`.
- Verified: dnd-kit engaged on drag (sortable transform visible); and with
  Manual ordering, lowering CLA-11's sortOrder floated it to the top of
  In Progress — the exact path a drop commits. `tsc` ✅ · build ✅ · clean console.

Next: **Keyboard shortcuts help overlay** (press `?`) + row-level shortcuts.


## 2026-06-17 — Loop #17: Full-text search

A dedicated search page, Linear-style:

- Store: persisted `recentSearches` with `addRecentSearch` (dedup, cap 8) and
  `clearRecentSearches`.
- New `views/SearchView.tsx` at `/search`: substring search over issue
  identifier/title/description and project name/description; results grouped into
  Projects and Issues (rendered with `IssueRow`); the filter bar narrows issue
  results; recent searches show when the query is empty (click to re-run, Clear).
- Sidebar "Search" now navigates to `/search` (⌘K still handles the command menu).
- Verified live: "board" matched CLA-7 "Board view" and CLA-5 (substring of
  "Keyboard"); the query was saved under Recent. `tsc` ✅ · build ✅ · clean console.

Next: **Manual drag-to-reorder** issues within a list group (sortOrder).


## 2026-06-17 — Loop #16: Triage

A queue for incoming issues, Linear-style:

- `types.ts`: `Issue.triage?: boolean`. Store: `acceptTriage(id, stateId?)`
  (clears the flag, keeps it in the workflow) and `declineTriage(id)` (clears
  the flag + moves to a canceled status).
- `seed.ts`: two incoming triage issues for the CLA team.
- New `views/TriageView.tsx` at `/team/:teamKey/triage`: a card per queued issue
  with description, inline status/priority/assignee/label pickers, and Accept /
  Decline buttons; a friendly "Triage is clear" empty state.
- `Sidebar`: a "Triage" entry per team with a live count badge.
- `IssuesView`: triage issues are excluded from the normal lists.
- Verified live: flagged two issues into triage → Accept removed CLA-2 (badge
  2→1), Decline canceled CLA-3 → "Triage is clear". `tsc` ✅ · build ✅ · clean console.

Next: **Full-text search** view (beyond ⌘K), with filters and recent searches.


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


## 2026-06-26 — Loop #85: 22 features (every settings stub → real, + Insights) + bug pass + Insights polish

A high-volume run that closed out Linear's **Settings** surface and added a new
analytics view. Added one tiny persisted store slice up front —
`featureSettings: Record<string, boolean>` + `setFeatureSetting(key,on)`
(auto-persisted; namespaced keys like `integrations.github`, `security.twoFactor`)
— so the new settings pages have real, reloading toggle state without per-page
store churn. Shared-file integration (the `SettingsView` switch, `App` routes,
`Sidebar`, ⌘K) was done in single deterministic passes by the main agent; each
feature lived in its own new component/view file (no write collisions).

**Wave 1 — 8 settings pages** (`SettingsView` switch cases + components):
Integrations, Billing (real seat count), API (keys + webhooks), Security (admin),
Connected accounts, Emojis, SLAs, Applications.

**Wave 2 — 8 feature/personal settings pages:** Code & reviews, Security & access
(personal), Agent personalization, AI & Agents, Customer requests, Releases,
Pulse, Asks.

**Wave 3 — 5 Projects/Features settings pages:** Project templates, Project
updates, Project labels, Initiatives, Documents. The entire Settings nav now
renders real content — no "Coming soon" stubs remain.

**Wave 4 — Insights** (1 substantial interactive view): new `/insights` route +
`InsightsView` computing live from the store — summary stat cards
(total / completed / in-progress / backlog / total points + completion %) and
By-status / By-priority / By-assignee / By-project / By-label breakdown bars,
each colored by its category (status uses the workflow state's own color,
priority uses the priority palette, labels their label color); a team-filter
segmented control (All teams / per-team) recomputes everything. Wired into the
sidebar Workspace section and ⌘K ("Go to Insights"). Total: **22 features**.

**Phase 2 — bug hunt (find → adversarially verify → fix):** swept all 21 settings
pages + Insights + core routes (issues/board/triage/cycles/projects/initiatives/
roadmap/documents/views/my-issues/inbox/search) with live `console.error`
capture, and exercised interactions (SLA master-toggle gating reveals rules,
toggle state persists to localStorage across reload, API "new key" form, emoji
add, Insights team filter 16→14). One candidate — a "<CommandMenu> component
error" warning in the buffer — was **adversarially verified as NOT-A-BUG**: it
was a transient HMR-only artifact from editing CommandMenu (I added the
`go-insights` command one edit before its `BarChart3` import; HMR rendered the
in-between state). The committed code throws nothing — confirmed by a fresh hard
reload + opening ⌘K + navigating with `console.error` capture (zero), plus
`tsc -b` and `npm run build` both green. **0 confirmed bugs.**

**Phase 3 — polish (Insights, both themes):** verified the new settings pages and
Insights render with correct tokens in light **and** dark (Releases card +
status pills, Insights bars/cards all parity-correct). Improvement: added
Linear's small colored category dot before each Insights breakdown-row label
(row label also brightens to `text-fg` on hover). The app is desktop-first (the
240px sidebar never collapses — no view is mobile-responsive), so Insights
matches the rest of the app at narrow widths; not a regression.

Verified in-browser via the Preview MCP at the dev URL throughout: zero console
errors, no "Maximum update depth". `tsc -b ✅ · build ✅ · console clean`.

Next: top remaining BACKLOG item — continue Linear parity on interactive
surfaces (e.g. Insights "completed over time" trend, per-project Insights, or
team-level integration settings).

## 2026-06-26 — Loop #87: 21 features (5 waves) + 2 bug fixes + Archive polish

A high-volume run on an already near-complete clone. Added two tiny persisted
store slices up front so the new surfaces have real, reloading state without
per-feature store churn: `Issue.archivedAt`/`remindAt`, `recentIssueIds` +
`pushRecentIssue`, and a string-valued `featureValues` KV + `setFeatureValue`
(counterpart to the boolean `featureSettings`). All shared-file integration
(App routes, Sidebar, ⌘K, SettingsView switch, detail tabs) was done by the main
agent in deterministic passes; every feature lived in its own new file.

**Wave 1 — workspace nav + issue lifecycle (5):** Archive (`/archive`, grouped by
team, Restore/Delete, `archiveIssue`/`unarchiveIssue`, excluded from all active
lists, archive action in the ⋯ menu) · Recently viewed (`/recent`, tracked on
IssueDetail mount) · Favorites page (`/favorites`) · Teams directory (`/teams`,
member avatars + stats) · All issues (`/all-issues`, workspace-wide list).

**Wave 2 — graphs, reminders, labels (5):** Project progress graph (a "Graph" tab,
burn-up SVG) · Initiative progress graph ("Progress by project" rollup) · Issue
reminders (a Reminder property row with quick presets, `setIssueReminder`) ·
Reminders view (`/reminders`, Overdue/Upcoming) · Labels directory (`/labels`).

**Wave 3 — settings pages (5):** Estimates (per-team scale, real `setTeamEstimation`)
· Cycles (per-team enable + cadence) · Triage (per-team enable + responsibility)
· Import (sources grid, mock toast) · Audit log (real `activities`, actor/type
filters, CSV export).

**Wave 4 — board + issue/project sections (3):** Board group-by (the kanban now
honors the Display "Columns" grouping — Status/Assignee/Priority/Project — with
drag-to-set-the-grouped-property; label falls back to status to avoid duplicate
DnD ids; wired into IssuesView/AllIssuesView/MyIssues/SavedViewScreen) · Activity
feed filter (All/Comments/Updates) · Project resources (a "Resources" links
section on the project Overview, `Project.resources`).

**Wave 5 — lifecycle actions (3):** Bulk archive (bulk-action bar, `bulkArchive`)
· Duplicate issue (⋯ options menu, wiring existing `duplicateIssue`) · Archive
from right-click (context menu).

**Phase 2 — bug hunt (find → adversarially verify → fix):** Three parallel static
finders swept the new code + cross-cutting concerns. **2 bugs CONFIRMED + fixed:**
(1) the archive feature's biggest gap — archived issues were excluded from lists
(`filterIssues`) but still **inflated every count/progress/aggregate** (~30
surfaces). Fixed centrally by baking `!archivedAt` into the 6 progress selectors
(project/initiative/milestone/cycle/cycleBurndown/subIssue — covers Insights,
Roadmap, Projects list/board/timeline, Initiative detail/list/graph, TeamOverview,
Cycles, Search cards) plus per-site fixes for the surfaces that bypass them
(Sidebar triage badge, TriageView, ProjectDetail, sub-issues, Insights memo,
TeamOverview, Profile, Teams/Members directory, CyclesView, ChangelogView,
LabelView, Customers(+Detail), MyIssues activity, RecentView). Verified live:
Insights TOTAL dropped 16→15 when one issue was archived. (2) `duplicateIssue`
leaked `archivedAt`/`remindAt` into the copy → now cleared. Several low-confidence
finder notes (useMemo dep hygiene, CSV BOM, featureSettings merge symmetry) were
adversarially reviewed and **discarded as non-defects**.

**Phase 3 — polish (Archive view, both themes):** added a per-row status glyph
(StatusIcon) and dropped the redundant per-row team name (already grouped under a
team header). Verified in light **and** dark — status colors and rows render
correctly in both.

Verified in-browser via the Preview MCP throughout: every route renders, board
group-by re-columns by assignee/priority with proper header glyphs, console clean
(no "Maximum update depth"), per-wave commits landed. `tsc -b ✅ · build ✅ ·
console clean`.

Next: top remaining BACKLOG item — board group-by could extend to label
swimlanes (needs de-duped DnD ids), and the audit log / import flows are faithful
mocks that could deepen if a backend is ever added.

## 2026-06-26 — Loop #88 (15 features + 1 bug fix + polish)

The clone is at deep Linear parity, so this run filled real cross-cutting gaps
rather than net-new top-level surfaces, in five committed waves.

**Phase 1 — 15 features shipped (verified in-browser via the Preview MCP):**

_Wave 1 — bulk-action bar + grouping:_ six new bulk actions on the floating
selection bar — **Project** (clears the dangling milestone), **Cycle** (hidden
when no cycles), **Due date** (shared `DatePicker`, ISO storage), **Estimate**,
**Subscribe/Unsubscribe** (current user across the selection), **Favorite/
Unfavorite** — each a new `bulk*` store action; plus **Group by Cycle** and
**Group by Milestone** (`groupIssues` branches + glyphs), with a shared
`boardColumnGroupBy` helper so the board falls back to status columns for
label/cycle/milestone groupings, wired through IssuesView / AllIssuesView /
MyIssues / SavedViewScreen (columns + sub-grouping + swimlanes).

_Wave 2 — shell + lifecycle:_ **Collapsible sidebar** (wires the dormant
`sidebarCollapsed`/`toggleSidebar` — header collapse button, floating expand
button, **⌘/** shortcut, help-overlay entry) and **Convert sub-issue to issue**
(in both the ⋯ options menu and the right-click context menu, gated on a parent).

_Wave 3 — roadmap + ⌘K:_ **Roadmap zoom** (Compact/Default/Wide month widths),
**⌘K Switch team** (per-team commands), **⌘K Toggle sidebar** command.

_Waves 4–5 — issue-row display:_ **Comment-count indicator** (always-on when an
issue has comments) and an **Estimate** Display-options property (team-aware
points / t-shirt rendering, default off).

**Phase 2 — bug hunt (find → adversarially verify → fix):** an independent
adversarial reviewer swept the whole `de2d383..HEAD` diff (Zustand v5 selector
hazards, the new bulk actions, grouping/board wiring, sidebar-collapse states,
row rendering). **No release-blockers** — every multi-field component correctly
uses `useStoreShallow`, the board fallback is consistent across all four views,
and dueDate stays ISO end-to-end. **1 bug CONFIRMED + fixed:** `bulkFavorite`
was add-only while the bar rendered a filled "remove" star — made it a real
two-way toggle (`bulkFavorite(ids, on)`).

**Phase 3 — polish (bulk-action bar, both themes):** verified the expanded bar in
light **and** dark; fixed "Due date" wrapping to two lines by adding
`whitespace-nowrap` to the bar's button class.

Verified in-browser throughout: bulk bar renders all 12 actions (light + dark),
group-by-Cycle regroups into "Cycle 1 / No cycle" with the iteration glyph,
board falls back to status columns under cycle grouping (no crash), sidebar
⌘/-collapses with a clean floating toggle, ⌘K shows "Switch to {team}", rows
show comment-count + estimate chips. `tsc -b ✅ · build ✅ · console clean`.

Next: the clone is at near-complete Linear parity — remaining top item is board
**label swimlanes** (needs de-duped DnD ids); otherwise deepen the mocked
audit-log / import flows if a backend is ever added.

## 2026-06-26 — Loop #91 (32 features + 2 bug fixes + polish)

The backlog was fully checked off at the start, so this run replenished it with
real, currently-missing Linear capabilities and shipped them in four parallel
waves (one file per agent → zero write collisions; main agent owned verify +
per-wave commit). Verified in-browser via the Preview MCP (every route renders,
console clean, no "Maximum update depth").

**Phase 1 — 32 features shipped:**

_Wave 1 (analytics/directory views):_ Insights **"Split by" stacked bar**
(secondary-dimension segmentation + legend); **Customer health** filter pills +
badge (Healthy/At risk/Churned from request recency); **Documents list/grid**
toggle; **Reminders search**; **Recently-viewed keyboard nav** (j/k/↑/↓ + Enter/o);
**Releases search**; **Pulse CSV export**; **Archive sort** (Recently/Oldest/Identifier).

_Wave 2 (issue/board/workspace):_ **Board column estimate sum**; **Copy issue as
Markdown**; **Peek expand/restore** (near-full-width toggle); **My Issues "Due
soon"** section; **Triage bulk select** (x toggle + batch Accept/Decline);
**Search keyboard nav**; **Roadmap quarter dividers**; **Project Overview
insights strip** (scope/started/completed + donut).

_Wave 3 (workspace-detail views):_ **Team Members roster card**; **Profile
contribution heatmap** (GitHub-style grid); **Initiative overview stats strip**;
**Customer activity timeline**; **Initiatives board layout** toggle; **Saved view
inline rename**; **Document word-count / reading-time**; **Label stats header**.

_Wave 4 (directory views):_ **Member role-pill counts**; **Changelog month
dividers**; **Cycles directory rail** (Active/Upcoming/Completed + progress);
**Collapsible label groups**; **Teams directory grid layout**; **Cycle velocity**
(rolling avg over last 6 finished cycles); **Favorites grouped/flat toggle**;
**Projects initiative filter** facet.

**Phase 2 — bug hunt (find → adversarial verify → fix):** five parallel finders
swept the loop-91 diff (36c11ec..HEAD); a separate adversarial verifier refuted
or confirmed each. **3 candidates → 2 CONFIRMED + fixed, 1 refuted.** Fixed (both
InsightsView): (1) **split-by-Assignee rendered a monochrome bar** — every
assignee series got `var(--accent)`; now each assignee hashes onto a distinct,
stable palette colour (Unassigned = grey). (2) **Stale "Split by" label** when
Group-by was changed to equal the active split — the chart silently un-stacked
while the control still read e.g. "Split by: Priority"; now changing Group-by
resets a colliding split to None. **Refuted (NOT-A-BUG):** claimed Escape-commits
bug in ViewsView inline rename — React 19 does not fire onBlur when a focused
input is conditionally unmounted, so Escape correctly cancels.

**Phase 3 — polish (Insights stacked bar, both themes):** tightened the new
stacked segments to Linear parity — 1px gaps between adjacent segments (track
shows through), a 3px min-width so tiny non-zero segments stay visible, and a
smooth width transition + hover dim. Verified in light **and** dark: distinct
per-assignee segments, readable legend, separators legible against both tracks.

`tsc -b ✅ · build ✅ · console clean`

Next: top BACKLOG item — the clone is at near-complete Linear parity; remaining
deepenings are mostly backend-dependent (real GitHub/Slack integrations, async
email export, audit-log depth) plus board **label swimlanes** (needs de-duped
DnD ids).

## 2026-06-26 — Loop #92 (30 features + 2 bug fixes + quick-filter polish)

The backlog was fully checked off, so this run scouted real Linear gaps first
(7 parallel auditors over view clusters → 49 candidate single-file gaps), then
shipped 30 of them in four parallel waves (one builder agent per file → zero
write-collisions; main agent owned verify + per-wave commit). Each feature
derives from existing store data or reuses an existing store action — **no
shared-file (store/types/seed/constants/App/Sidebar) changes this run**.
Verified in-browser via the Preview MCP (routes render, console clean, no
"Maximum update depth"; HMR "Failed to reload" lines during the edit window were
transient — `npm run build` compiles every file and all pages render at runtime).

**Phase 1 — 30 features shipped:**

_Wave 1 (issues core + detail, 7):_ **Time-in-status badge** (wires the inert
Display property); **quick-filter preset pills** (Assigned/Created by me · Not
started · Completed); **collapse/expand all groups**; **archived-issue banner +
Restore**; **board card blocked/blocking indicator**; **peek keyboard legend**;
**Projects compare mode** (two-column side-by-side). _(The scouted "History tab"
was dropped — already covered by the existing Activity "Updates" filter.)_

_Wave 2 (projects/cycles/initiatives/team, 7):_ **Initiative health-history
timeline**; **roadmap milestone markers** on bars; **cycle health chip** (On
track / At risk); **cycle velocity sparkline**; **triage cycle picker**; **Team
Overview member activity** (last-7-day completions); **Members directory
Last-active column**.

_Wave 3 (workspace dirs / inbox / recent, 7):_ **Profile keyboard-shortcuts
panel**; **Label page inline rename**; **Labels co-occurrence Details panel**;
**Teams directory most-active popover**; **Inbox bulk select + Mark-read/Snooze/
Delete bar**; **Recent sort menu**; **Archive bulk restore/delete**.

_Wave 4 (search / docs / customers / feeds / insights, 9):_ **Reminders bulk
reschedule overdue**; **Search result count + Esc-clear**; **Changelog copy
version**; **Documents grid hover actions**; **Document outline depth filter**;
**Customers bulk-select toolbar**; **Customer activity feed filter**; **Pulse
event copy**; **Insights bar value labels + hover tooltip**.

**Phase 2 — bug hunt (find → adversarial verify → fix):** 4 parallel finders
swept the loop-92 diff (3ce3365..HEAD); a separate adversarial verifier judged
each. **5 candidates → 3 CONFIRMED, 2 refuted.** Refuted (NOT-A-BUG): IssuePeek
`py-px` (valid Tailwind v4), Inbox no-arg `useStore()` destructuring (explicitly
allowed by CLAUDE.md — not an object-literal selector). Of the 3 confirmed,
**2 fixed**: (1) **CustomersView** nav row `<button>` missing `type="button"`
(defaulted to submit); (2) **CustomerDetail** empty-state read "No all activity."
→ now "No activity." when the filter is All. The 3rd (TeamOverview roster memo
depending on `workload.counts`/`activity.counts`) was **discarded on review** —
those Maps are referentially stable (new identity only when their source memos
recompute on `[issues, members]`, which is exactly when the roster should
recompute), so the proposed dep change is churn, not a fix.

**Phase 3 — polish (quick-filter pills, both themes):** tightened the new
IssuesView quick-filter row to Linear parity — active pill gains a defined
border + `font-medium` + an inline `×` to clear, inactive pills get
`hover:text-fg` with a `transition-colors`, and the row gap widened to gap-1.5.
Verified the active "Not started" pill (filters to the 4 Todo issues) reads
cleanly in **light and dark**.

`tsc -b ✅ · build ✅ · console clean`

Next: top remaining parity is mostly backend-dependent (real GitHub/Slack
integrations, async email export, audit-log depth) plus deeper drag-reorder
surfaces (Releases manual sort, board label swimlanes with de-duped DnD ids).

## 2026-06-26 — Loop #93: 33 features (4 waves) + 1 bug fix + command-menu polish

Backlog was fully checked at the start, so the run opened with a **6-agent
parallel scout workflow** over every surface group, comparing the clone against
real Linear and returning 36 genuinely-missing, single-file-scoped features.
Shipped 33 of them across **four sequential parallel waves** (one subagent per
file, main agent owning all shared-file deltas), each verified (`tsc -b` ✅ +
`npm run build` ✅ + Preview MCP console clean) and committed before the next.
Branch agents were explicitly told NOT to touch the loop-guard (the parent owns
the lock) after wave 1's first attempt aborted four branches on a BUSY check.

_Wave 1 — issue detail (9):_ **inline sub-issue status/priority/assignee
editing** · **activity-feed grouping** (same-actor, ~2-min window) · **comment
⌘↵ hint + author auto-subscribe** · **blocked-by warning banner** · **resolved-
relation strikethrough** · **PR copy-branch + review-state chip** · **attachment
image thumbnails** · **Insights avg cycle time** tile.

_Wave 2 — projects/cycles/initiatives (8):_ **inline initiative description +
DatePicker target date** · **initiative name-search + health facet** · **project
priority property** (added `Project.priority`) · **project header overflow menu**
(copy link/ID + delete; added a real `deleteProject` store action with full
dependent cleanup) · **cycle group-by selector** · **projects-board column
subtotals** · **roadmap today-pill + bar date captions** · **timeline set-dates
affordance**.

_Wave 3 — workspace dirs / inbox / search (8):_ **search People tab + me-scope
pills** · **Team Overview priority breakdown** · **inbox subscribe toggle** ·
**Favorites keyboard nav** · **Archive keyboard nav (+ e to restore)** ·
**searchable shortcuts overlay** · **settings nav keyboard-select**.

_Wave 4 — extras + ⌘K/shortcuts (8):_ **document copy-link** · **release
description** · **reminder description snippet** · **changelog entry permalink** ·
**Pulse load-more pagination** · **command-menu grouped section headers** ·
**copy issue ID/URL (⌘. / ⌘⇧.) + assign-to-me (i) global shortcuts**.

**Phase 2 — bug hunt (find → adversarial verify → fix):** 4 parallel finders
swept the run diff (24a524f..HEAD); a separate adversarial verifier judged each.
**2 candidates → 1 CONFIRMED, 1 refuted.** Fixed: **SearchView People-tab
keyboard highlight** — `commentOffset` double-counted hidden issue results on the
People tab, so no person row ever highlighted; now guarded by `showIssues`.
Refuted (NOT-A-BUG): `deleteProject` leaving dangling doc/release `projectId`s —
every consumer already guards the lookup, so no runtime defect; nonetheless added
the doc/release detach to `deleteProject` for data hygiene.

**Phase 3 — polish (command-menu section headers):** tightened the new ⌘K
section labels to Linear parity — `font-semibold`, `tracking-wider`, `pt-2.5`
separation, `select-none`. Token-based (`text-faint`), verified in light + dark.

`tsc -b ✅ · build ✅ · console clean`

Next: remaining parity is increasingly backend-dependent (live GitHub/Slack
sync, real async email export, audit-log depth) plus deeper DnD surfaces
(board label swimlanes, Releases manual sort) and richer PR review data
(`reviewDecision` field feeding the new review chip).
