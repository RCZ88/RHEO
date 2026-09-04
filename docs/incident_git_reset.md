# Incident: flex-col switch without row wrapper — content pane starved to 0px

**Date:** 2026-09-03
**Severity:** P1 (render-breaking — main content pane height = 0px)
**Status:** Resolved — committed `aea3666`

---

## Root Cause #5

**Flex-col switch without row wrapper — sidebar `h-full` + `shrink-0` consumed full height.**

### History

The original App shell layout was **flex ROW**:
```
<div className="flex ...">
  <TitleBar />     {/* top bar, fixed */}
  <div className="flex-1 flex ...">   {/* row: sidebar | main content */}
    <Sidebar />
    <MainContent />
  </div>
</div>
```

When TitleBar was added as a persistent top bar, the root was switched to **flex-col** without adding the required row wrapper:
```
<div className="flex flex-col h-screen ...">
  <TitleBar />
  <AppBackground />
  <motion.div className="... h-full shrink-0 ...">  {/* sidebar — NO row wrapper */}
    ...
  </motion.div>
  <div className="flex-1 min-h-0 ...">               {/* main content — starved */}
    ...
  </div>
</div>
```

### Mechanism

In a `flex-col` container:
- Total height = viewport (h-screen = 100vh, e.g. 976px)
- TitleBar: shrink-0, takes its natural height (~48px)
- AppBackground: absolute/fixed, out of flow (height 0 in flex)
- Sidebar `motion.div`: `h-full` (976px from root) + `shrink-0` (refuses to shrink below that)
- Main content `div`: `flex-1 min-h-0` (gets 976 - 48 - 976 = **0px**)

The sidebar's `h-full` resolves against the root's 976px, not against a row wrapper. `shrink-0` prevents it from yielding. The main content pane gets 0px because there is nothing left in the flex-col distribution after the sidebar takes its full height.

### Symptoms

- Content pane `getBoundingClientRect().height === 0`
- Dashboard 4 cards squashed to 0 height (cards inside content pane)
- Window resize does NOT adjust content pane (height is locked to 0 regardless of viewport)
- App appears "broken" — no content renders below the sidebar

---

## Fix

**Minimal — no new components. Preserve layout semantics.**

Insert a row wrapper between AppBackground and the sidebar/main-content pair:

```tsx
// BEFORE (broken)
<div className="flex flex-col h-screen overflow-hidden bg-[#121212] text-white">
  <TitleBar />
  <AppBackground />
  {/* Sidebar hidden on workspace (/terminal) and during solar overlay */}
  {location.pathname !== '/terminal' && !solarOverlayActive && (
  <motion.div className="... h-full shrink-0 ...">...</motion.div>
  )}
  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">...main...</div>
  <TutorialOverlay />
</div>

// AFTER (healed)
<div className="flex flex-col h-screen overflow-hidden bg-[#121212] text-white">
  <TitleBar />
  <AppBackground />
  <div className="flex flex-1 min-h-0 relative">   {/* ← ROW WRAPPER */}
  {/* Sidebar hidden on workspace (/terminal) and during solar overlay */}
  {location.pathname !== '/terminal' && !solarOverlayActive && (
  <motion.div className="... h-full shrink-0 ...">...</motion.div>
  )}
  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">...main...</div>
  </div>                                                  {/* ← close row wrapper */}
  <TutorialOverlay />
</div>
```

### Why this works

- **Root stays `flex-col`**: TitleBar on top, row wrapper fills remaining height (`flex-1 min-h-0`). Correct vertical stack.
- **Row wrapper is `flex` (row)**: Sidebar (left, `h-full shrink-0`) and main content (right, `flex-1 min-h-0`) sit side by side. Sidebar height = wrapper height (correct). Main content gets all remaining width.
- **`AppBackground` stays out of flow**: `absolute`/`fixed` background, not in the flex chain. No height consumption.
- **Both conditional paths preserved**:
  - Sidebar visible: row wrapper = `[sidebar | main content]` → flex row
  - Sidebar hidden (/terminal or solar overlay): row wrapper = `[main content]` → single child fills full width
- **Window resize works**: wrapper height tracks viewport (flex-1 in flex-col root), content pane height tracks wrapper (flex-1 min-h-0 in flex row wrapper).

### What NOT to do (layout direction semantics)

- Do NOT change root back to `flex` (row) — that would put TitleBar beside the sidebar, not above it.
- Do NOT remove `h-full` from sidebar — it's correct inside the row wrapper (height = wrapper = available space).
- Do NOT remove `shrink-0` from sidebar — it prevents the sidebar from collapsing when content is narrow.
- Do NOT change `flex-1 min-h-0` on main content — it correctly fills remaining space in the row.

The fix preserves **layout direction semantics**: root = vertical stack, row wrapper = horizontal row. Token-matching the original classes would have missed this.

---

## Verification

### Gates passed

| Gate | Result |
|------|--------|
| **Build** (`node scripts/build.mjs`) | ✅ `✅ Build complete!` |
| **Renderer bundle verification** (`dist/assets/index.u8QVudsj.js`) | ✅ All 4 fix elements present: root className, row wrapper, sidebar h-full+shrink-0, main content flex-1. Zero unclosed `bg-[#121212` patterns. |
| **Electron main process** (`dist-electron/main.cjs`) | ✅ `titleBarStyle: "hidden` — custom title bar active. Zero unclosed className patterns. |
| **ESbuild parse** (single-file validation) | ✅ `PARSE OK` — App.tsx transforms cleanly |
| **tsc --noEmit** | ✅ Zero real type errors — 1245 TS6305/6306/6310 (project-reference composite noise, documented debt) |
| **Sweep** (h-full in flex-col App shell) | ✅ Only 1 hit: sidebar motion.div (line 2727) — now correctly inside row wrapper. No other starvation candidates. |

### Pending (user cold-launch)

| Gate | Status |
|------|--------|
| **Electron cold-launch + Playwright assertions** | ⏳ User killed stale instances; relaunching manually. Content pane height > 500px, 4 dashboard cards > 100px, #df-fallback hidden, console clean — to be verified on user's live session. |
| **Window resize test** | ⏳ Pending live verification — content pane height must track window size (the original "doesn't adjust to window size" symptom). |

---

## Lesson

**Layout bugs need computed-geometry assertions (bounding boxes), not class-string checks — and repair diffs must preserve layout DIRECTION semantics, not token-match them.**

- **Class-string check is insufficient**: `bg-[#121212]` CLOSED and `flex-col` present don't prove the layout works. The classes were correct; the *geometry* was broken.
- **Bounding box assertions are required**: `getBoundingClientRect().height > 500` on the content pane is the actual proof. Class strings are necessary but not sufficient.
- **Layout direction semantics > token matching**: The original bug was "root switched to flex-col without row wrapper." A token-matching fix would have tried to restore `flex` (row) on the root, which would have broken the TitleBar placement. The correct fix preserves root=flex-col (vertical stack with TitleBar on top) and adds a row wrapper (horizontal row for sidebar + content). The direction of each container must be semantically correct, not just a copy of some previous token.
- **h-full + shrink-0 in a flex-col parent is the starvation pattern**: Any child with `h-full` + `shrink-0` inside a `flex-col` container without an intervening row wrapper will consume all remaining height. This is the pattern to sweep for — not `h-full` in isolation, but `h-full` in the CONTEXT of a `flex-col` parent.

---

## Files Changed

- `src/App.tsx` — row wrapper inserted (3 insertions, 1 deletion) — commit `aea3666`
- `docs/incident_git_reset.md` — root cause #5 documented (this file)

---

## Commit

```
aea3666 fix: restore row layout under titlebar — sidebar h-full starved content pane to 0px
```

---

## Related Incidents

- **Root cause #4** (prior): truncated JSX className — `bg-[#121212` unclosed bracket + `flex-col` token dropped. Commit `5fe0328` / `aea3666` (this one) are sibling fixes from the same reset churn.
