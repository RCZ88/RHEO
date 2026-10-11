<!-- SESSION: opencode-halo-hitbox-20261006 -->
<!-- AGENT: opencode | TERMINAL: halo-hitbox | PROJECT: App Tracker -->

# Agent State — opencode-halo-hitbox-20261006

> **STATUS:** completed | **UPDATED:** 2026-10-06T15:40:00Z

---

## CURRENT CYCLE (1)
**ROLE:** Fix the Halo Island's inconsistent hover trigger — the island closed while the cursor sat on its own painted surface.
**STATUS:** completed
**IN FLIGHT:**
- (none — source fixed and proven; waiting on CZ to build)
**COMPLETED:**
- Root-caused it: `computeGeometry` baked `hotZone` from `compactSize` ONLY, so the FSM tested a 232x40 pill against a 460x236 expanded panel forever.
- Proved it numerically against the LIVE window geometry (canvas `764,0 520x300` from xdotool): **4 of 6** cursor positions sitting on the island's own painted surface reported `inside: false`. Moving down onto the opened island started the close timer and it shut under the cursor.
- Added `unionRect()` to `src/shared/halo/geometry.ts` and a second rect `hotZoneExpanded: Rect` to `IslandGeometry` (`src/shared/halo/types.ts`) — the union of the collapsed pill and the expanded surface.
- `src/main/halo/haloIsland.ts:457` now SELECTS THE RECT ON PHASE: `(h.expanded ? h.geometry.hotZoneExpanded : undefined) ?? h.geometry.hotZone`. The `??` is deliberate so an older geometry object degrades to the pill, never to `undefined` and never to the whole canvas.
- Collapsed trigger is still EXACTLY the visible pill (`padX/padY = 0`) per the user's request — it does NOT grab the desktop.
- Diagnostic trail now logs BOTH rects plus `expandedSize` on `window-created` and `prefs-applied`; logging only one rect is what made this invisible before.
- Verification: 19/19 new trigger laws (every painted pixel is a trigger on all 3 edges, 576 samples; no close intent while standing on the island; still closes when the cursor leaves entirely; nothing around it leaks; padding 0/40/120/240 all consistent). Replay old-vs-new: **4/6 -> 0/6**. Pre-existing `halo-core.probe.mts` regression check **33/33**. Scoped esbuild parse clean on all 4 halo files; scoped `tsc` on the halo module graph exit 0.
- Corrected myself twice, both by measurement: (a) my `unionRect` assertion said width 45 when `45-5=40` — the code was right, my arithmetic was wrong, so the probe now asserts the PROPERTY (all 8 corners contained + edges hug inputs); (b) the renderer is NOT the culprit — live DOM shows `pointer-events: none` on root, `auto` on surface.
**NEXT ACTION:** CZ runs `npm run build`, fully quits RHEO, restarts. Then confirm in `~/.config/RHEO/halo-diagnostic.log` that `window-created` shows `hotZoneCompact` and `hotZoneExpanded` as two different rects.
**NOTES:**
- **OPEN, SEPARATE BUG, NOT FIXED — the click-eating half.** `xwininfo -shape` on the live Halo window reports `Window shape extents: 0x0+0+0` / **`No border shape defined`**, i.e. the full 520x300 canvas is potentially an input target. I could NOT determine whether that is CORRECT (island collapsed -> `applyClickRegion` intentionally calls `setShape([])` to clear it, and then `setIgnoreMouseEvents(true,{forward:true})` covers the phase) or a genuine `setShape` failure. `diag()` wrote no `halo-diagnostic.log` at all this run, so the trail cannot settle it — after the rebuild, the new `click-region-shaped` / `click-region-UNSUPPORTED` records answer it in one look.
- The app WAS running the 12:23 build (electron started 13:24:01), so source-vs-artifact staleness was NOT the cause of the trigger bug.
- No debug port available (`DevToolsActivePort` says 46499, connection refused), so I measured the live renderer by loading the app's OWN served bundle over `http://127.0.0.1:38123/halo.html` in a throwaway Chromium. Read-only; CZ's Electron was never touched and is still running.
- Per AGENTS §0-0 I did NOT build. `dist/`/`dist-electron/` untouched.

---

## HISTORY (previous 2 cycles, oldest first)

(none — first cycle for this session)

---

## CYCLE (2) — STOPWATCH
**ROLE:** Fix the stopwatch. Found the real cause, not just the reported symptoms.
**COMPLETED:**
- **ROOT CAUSE (the big one):** `persist()` wrote `{productive, distracting, paused, activeTier}` and NO
  `dayKey`, while `hydrate()` gates the entire restore on `saved.dayKey === localDayKey()` and returns
  `fresh()` otherwise. The persisted payload could therefore NEVER satisfy its own guard. Consequence:
  every load began at 0:00:00, yesterday's totals never returned, and `reloadFromStorage()` — the
  cross-window sync the island depends on — copied zeros. Silent, no error anywhere. Fixed by writing
  `dayKey`, which also RE-ENABLES the stale-day guard that this had made dead code.
- **Defect 2:** `OverlayRoot` read `getSnapshot().tier`; `StopwatchSnapshot` has no such field (it is
  `activeTier`), so the tier control could only ever set `distracting` — productive was unreachable.
- **Defect 3:** `onTogglePause` called `halt()`, which banks the segment but never sets `store.paused`,
  so the glyph never flipped and the next driver tick restarted the clock. `setPaused()` already existed
  and was correct; the island called the wrong function.
- Probe `agent/probes/stopwatch-store.probe.mts` (13 assertions) written. It caught the bug AND two of
  my own probe bugs (guard regex, missing 1s driver) — the driver omission made "did it advance"
  unanswerable, which would have been a false failure.
- Cross-window round-trip proven with two independent module instances against one localStorage:
  totals + tier restore exactly (2501ms -> 2501ms). Stale-day payload correctly REJECTED.
- Gates: stopwatch-store 13/13, halo-slot 63/63, halo-core 33/33, scoped esbuild clean, scoped tsc
  exit 0. No remaining `halt()` callers anywhere.
**STILL NOT DONE:** main pushes `stopwatch: null` on both paths, so the island reads its own
renderer-local copy rather than a relayed truth. Needs `src/main.ts` (P0, heavily shared) — awaiting
CZ's word. Runtime agreement with the dashboard still unverified (no debug port on the running app).
