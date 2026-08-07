---
name: linear-audit
description: On-demand audit pass over FlintTask — read the logs, pour data in, walk the UI like a real user, fix what breaks, and close the gap against real Linear one area at a time. Use when the user asks to audit, sweep, stress-test, or compare the app to Linear.
---

# Linear parity audit

One run = **one full pass**: read the logs → pour data in → walk the UI → fix
what you find → close one parity gap against real Linear → record it.

Do not ask permission between steps. Fix what you find, in this repo, now.

## 0. Take the lock

**First action, always:**

```bash
bash scripts/loop-guard.sh acquire
```

`BUSY` → stop immediately, change nothing. `ACQUIRED` → continue.
**Last action, always** (every exit path, including errors):

```bash
bash scripts/loop-guard.sh release
```

## 1. Read the logs

```bash
bash scripts/audit/collect.sh
```

Prints git state, the rotation pointer, server health, typecheck, lint, data
volume, and the route inventory. Raw output lands in `.audit/latest/`.

Anything the digest flags as FAIL or new (lint problems outside the two known
`react-refresh` / `exhaustive-deps` families) is a **finding — fix it in this
run** before moving on. A red typecheck is never "pre-existing".

If vite is DOWN, start it with the **preview tool** (`preview_start {name:"dev"}`),
never from Bash. If the API is DOWN: `(cd server && npm start &)`.

## 2. Pour data in

```bash
node scripts/audit/seed-bulk.mjs
```

Creates issues, sub-issues, comments and **real uploaded image/file bytes**
through the same login → GraphQL → `fileUpload` path the app uses. Re-runnable;
each batch is tagged with its timestamp. Scale it up when you want pressure:

```bash
node scripts/audit/seed-bulk.mjs --issues 60 --attachments 20 --comments 40
```

Volume is the point. Empty states hide bugs that only appear at 50+ rows,
long titles, missing assignees, and attachments in the hundreds of KB.

## 3. Walk the UI like a user

Paste `reference/browser-sweep.js` into `javascript_tool`, then drive it in
batches of ~12 (`window.__run(0,12)`, `window.__run(12,24)`, …) — the tool
times out at 30s, so never sweep everything in one call.

It reports, per route: console errors/warnings, horizontal overflow, empty
render, and how long the route took to settle.

Then do what a sweep cannot: **use the app.** At minimum, each run —

- create an issue from ⌘K and from the `+` button, with `⌘Enter` to submit
- open an issue, type a comment, attach a file, open the image lightbox
- apply two filters, save the view, reload, reopen the saved view
- switch list ↔ board, drag a card, change grouping and ordering
- toggle dark mode and one non-default **font size** step
- resize to a narrow window and confirm nothing overflows horizontally

Every console error, mis-rendered row, or dead control is a finding. Fix it.

## 4. Close one parity gap

Open `reference/parity-map.md`, take the area **after** the one printed as
`last audited area`, and compare it against the real Linear tab the user keeps
open — the same screen, side by side.

Rules for that comparison:

- The user's real Linear workspace is **read-only**. Open menus and views to
  look; never create, edit, or delete anything there.
- Never touch a Linear API key. Compare API surface against Linear's **public
  docs**, never by calling their live API.
- Only local dev credentials (`avery@workspace.dev` / `demo1234`), only
  against localhost.

Record differences in *position, order, wording, density, and behavior*, not
just presence. Linear's chrome is opinionated — a control on the wrong side of
a header is a real gap. Fix what you can in the run; log the rest under
"🔍 Noticed while comparing, not yet built" in `BACKLOG.md` with a size.

## 5. Definition of done

1. `npx tsc -b` exits 0
2. `npm run build` succeeds
3. Sweep is console-clean — no new errors, no "Maximum update depth"
4. The thing you changed actually works, and looks like Linear

Then:

```bash
echo "<area you just audited>" > .audit/last-area
```

Append what you found and fixed to `PROGRESS.md`, tick items in `BACKLOG.md`,
and commit with a message naming the area. Release the lock.

## Traps this codebase has already sprung

- **Zustand v5 does not shallow-compare.** A selector returning an object
  literal must use `useStoreShallow`, never `useStore` — otherwise infinite
  render loop.
- **Persisted state is schema-evolved.** Anything reading a `FilterState` (or
  any other persisted shape) must tolerate fields that did not exist when the
  value was saved. Evaluate lazily; never index into an array you have not
  proven is there. This exact bug white-screened `SavedViewScreen`.
- **Don't swallow errors to make a number render.** A `try/catch` around a
  count hid that crash for weeks.
- **Text sizes are literal px** (`text-[13px]`, ~1900 of them). They scale only
  through `--font-scale` in `index.css`; a root font-size alone moves spacing,
  not type.
- **The browser tool halves screenshot coordinates** — it renders 1600×900 and
  reports 800×450. Click at half the pixel you see.
- **dnd-kit drags cannot be simulated** with `left_click_drag` or synthetic
  pointer events. Verify drag by reading state, or by hand.
- **The real DB is `server/data/flint.db`**, not `server/data.db`.
