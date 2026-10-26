<!-- SESSION: opencode-lightmode-20261016 -->
<!-- AGENT: opencode | TERMINAL: lightmode | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-lightmode-20261016

> **STATUS:** active | **UPDATED:** 2026-10-23T00:20Z

---

## CURRENT CYCLE (14)
**ROLE:** CZ: "WHY IS THE CALENDAR SQUASHED IN HEIGHT NOW??" / "the ui is stil lretarded" / "the
date and time sleetion doenst FUCKINH OWRK" / "IT JUST FUCKING GLITCHES OEN AND CLOSE".

**CAUSE (all three) — found and fixed this cycle:**
1. **Calendar squashed in height:** the month grid was wrapped in two plain `div.relative`
   wrappers, so its `flex-1` had no flex parent to act on → rows resolved to the
   `minmax(24px, …)` floor (≈31px rows) instead of sharing the panel height. Wrappers are now
   `min-h-0 flex-1 flex-col`. Fixed by commit **1746dd6**.
2. **Date/time picker glitches open and closes:** the outside-click listener checked only the
   popover ref, so the opening trigger itself counted as "outside" → mousedown closed, click
   toggled back open. Fixed with a rootRef wrapping trigger + popover. Commit **d81bea9**.
3. **Date/time picker cut off:** popover was `absolute` inside the trigger wrapper → clipped by
   the reminder sheet's overflow / card; also near the window edge. Now `createPortal` →
   `position:fixed`, measured per open, flips above when no room below, scrolls within maxHeight.
   Also: picking a day now PRESERVES the chosen time (was resetting to 00:00); hour/min are now
   native selects (the padded number input mangled typing and step-5 minutes).

**VERIFIED:** esbuild parse + resolve clean on both files; scoped tsc shows no new errors from my
edits (only pre-existing unused-import / module-path drift).

**STILL OPEN (needs CZ's word):**
- Day / Week / Month toggle still INERT (building three views = a feature).
- Schedule-block alarms: `remind_min` column + form + ticker. Needs permission.
- Light mode: 128 hardcoded `zinc-*`.

**NEXT:** **CZ BUILDS and reopens.** Still not in the running bundle (last build 2026-10-21 14:10).

---

## HISTORY
- **Cycle 13 — alarm due-instant fix (COMMITTED `4668225`).** Tiers + relative-lead now share one
  helper (`deadlineDueMs`): date-only → local wall clock + due_time; legacy `…Z` → instant.
  Probe: 14:00 + 30m → 13:30 (was 08:30).
- **Cycle 12 — month fits + picker + span + goal link (COMMITTED `413ce43`).**

## GOTCHA (still true)
Harness must link BOTH `app.css` and esbuild's `appN.css`; select picker days by `aria-label`.
`/tmp/opencode/sched-layout` was cleared overnight.
