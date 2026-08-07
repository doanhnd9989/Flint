# Parity map — the rotation

One area per audit run, in order. `.audit/last-area` holds the last one done;
take the next. Wrap around at the end.

For each area, compare against the same screen in real Linear and check:
**presence** (does it exist), **position** (which side, which order),
**wording** (Linear's exact label), **density** (row height, gap, font weight),
**behavior** (keyboard, hover, empty, loading, and error states).

---

## 1. `sidebar`
Workspace switcher, section order, badge style, collapse, resize handle,
Favorites / Teams grouping, "More" overflow, the account row at the bottom.

## 2. `issue-list`
Row anatomy left→right, grouping headers and their counts, sub-issue nesting,
hover actions, multi-select + bulk bar, drag-to-reorder, the hidden-count
footer, empty state copy.

## 3. `issue-detail`
Two-column split, property rail order, description editor toolbar, activity vs
comments ordering, reactions, sub-issue block, relations, attachments, links,
the ⌘K-reachable actions in the ⋯ menu.

## 4. `filters-display`
Filter trigger position, chip anatomy, submenu faceted counts, negation, AND/OR
for labels, saved-view flow, Display menu options and their defaults, ordering
and grouping combinations.

## 5. `board-and-layouts`
Column headers and counts, card anatomy, swimlanes, hidden-rows bar, drag
between columns, keyboard drag, list ↔ board ↔ timeline switching.

## 6. `command-menu`
⌘K sections and their order, fuzzy match ranking, contextual actions when an
issue is focused, recent actions, sub-menus, the shortcut hints on each row.

## 7. `keyboard`
Every shortcut in Linear's help overlay (`?`), the overlay layout itself,
focus rings, J/K navigation, X select, and shortcut collisions inside editors.

## 8. `inbox-notifications`
Notification grouping, read/unread affordance, snooze, bulk actions, the
notification rules and schedule settings screens, empty state.

## 9. `projects-initiatives`
Project header and progress donut, updates feed, milestones, key results,
readme, resources, dependencies, initiative rollups, the roadmap timeline.

## 10. `cycles`
Active/upcoming/past tabs, burndown, scope-change chart, carry-over, goals,
retrospective, pause, velocity.

## 11. `triage-and-intake`
Triage queue chrome, accept/decline/snooze, speedrun mode, duplicate
suggestions, SLA display, customer requests.

## 12. `search-and-docs`
Search result grouping and highlighting, filters within search, document
editor, outline/table of contents, document sharing.

## 13. `settings`
Every settings screen against Linear's: section order, row anatomy
(title / description / control on the right), dropdown wording, toggles,
destructive-action confirmation.

## 14. `api-and-data`
GraphQL schema surface vs Linear's public docs — queries, mutations, input
shapes, pagination, error format, webhooks, the `fileUpload` contract, API
keys screen. **Docs only; never call Linear's live API.**

## 15. `theme-and-density`
Light/dark tokens, accent colors, font-size steps (`--font-scale`), reduce
motion, underline links, pointer cursors, and how each behaves at a narrow
viewport.

---

## Standing rule

The brand is the only thing that differs. Everything else — layout, wording,
ordering, keyboard model, API — should match Linear. When our version is
deliberately different, say so in `PROGRESS.md` and why.
