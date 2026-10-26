<!-- AGENT STATE — opencode session (halo windowless) -->
<!-- SESSION: opencode-halo-windowless-20261016 -->
<!-- AGENT: opencode | TERMINAL: (linux session) | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-halo-windowless-20261016

> **STATUS:** Source fixed across cycles 12–18 (OFF lifecycle, double-pill, snapshot pull, last-known-good,
> tier color, host lifecycle). App running. Latest build FAILED (dup `try`) then fixed; source compiles.
> All fixes source-only → CZ must rebuild+relaunch to land. Design untouched. | **UPDATED:** 2026-10-24T21:30Z

---

## CURRENT CYCLE (18)
**ROLE:** User: "it still continuously have this error of like going back to", "tracking system still resets
and still doesnt track website properly", "why is there now only 3 sections on the island?", "why does the
website not showing?".

**FIXES APPLIED THIS CYCLE:** (a) removed the flapping focus-sync host toggle (replaced by in-app pill
hide when host is painter → single painter); (b) added in-app null-return when host-is-painter. Source
transpiles clean (main.ts, OverlayRoot).

**OUTSTANDING (source-only, need CZ build):**
- OFF lifecycle (c12), snapshot pull (c14), last-known-good payload (c15), tier color (c16), host dead-ref +
  1s-sync (c17), single-painter + inApp-hide (c18).

---

## HISTORY

### Cycle 17 — 2026-10-24
**ROLE:** User: "THEY ARE A DUPLICATE ONE OUTSIDE OF THE APP ONE INSIDE OF THE APP" / "AND THERES A DUPLICATE ONE OUTSIDE OF THE APP ONE INSIDE OF THE APP".
**FIXED (source, unbuilt):** focus-based host toggle + dead-ref + 1s sync. Then **replaced** with a cleaner
single-painter design: host stays ON when enabled; in-app pill hides (OverlayRoot). No more host flapping.

### Cycle 16 — 2026-10-24
**ROLE:** User: "WHY IS THE THING NOT SHOWING THE GREEN PROPERLY?" / "and then blue when neutral" / "and then red when distracting".
**FIXED (source, unbuilt):** tier now resolved from `tierAssignments` (green/blue/red) instead of hardcoded 'neutral'.

### Cycle 15 — 2026-10-24
**ROLE:** User: "every like 2-3 turns, it shows the correct time".
**FIXED (source, unbuilt):** keep-last-known-good payload in `halo:report-stream`.

### Cycle 14 — 2026-10-24
**ROLE:** User: "it just glitches sometimes it Glitches to the correct time occasionally".
**FIXED (source, unbuilt):** snapshot pull on mount (`halo:get-snapshot`).

### Cycle 12 — 2026-10-24
**ROLE:** User: "TURN IT OFF IN THE SETTING … THE PILL TOO".
**FIXED (source, unbuilt):** OFF lifecycle.

### Cycle 10 — 2026-10-22
**ROLE:** Boot crash. Fixed build scripts + compiled modules.

### Cycle 8 — 2026-10-21
**ROLE:** Implemented `agent/docs/HALO_RESULT.md` island design.
