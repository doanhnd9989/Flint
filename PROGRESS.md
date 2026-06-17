# Progress log

Newest first. Each loop iteration appends one entry.

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
