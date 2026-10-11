<!-- SESSION: opencode-halo-customize-20261006 -->
<!-- AGENT: opencode | TERMINAL: (unreported) | PROJECT: App Tracker -->

# Agent State — opencode-halo-customize-20261006

> **STATUS:** completed | **UPDATED:** 2026-10-06T00:00:00.000Z

---

## CURRENT CYCLE (1)
**ROLE:** Make the Halo Island fully user-customizable from Settings, in the user's stated
priority order: hitbox/trigger -> shape -> location -> widgets, then pin button + animation.
**STATUS:** completed
**IN FLIGHT:**
- (none — released all leases and all files verified)
**COMPLETED:**
- **P1 hitbox/trigger** — `HaloTriggerPrefs { mode, padX, padY, openDelayMs, closeDelayMs,
  leaveMarginPx }`. `mode` is enforced INSIDE `stepHover` (hover/hover-or-click/click/hotkey), and
  the poll loop now re-reads prefs every tick so changes apply live. Defaults match §48 exactly
  (110/280/24).
- **P1b THE BIG ONE — hover zone and click region are now separate rects.** `applyClickRegion`
  in `haloIsland.ts`: collapsed = `setIgnoreMouseEvents(true,{forward:true})`; expanded =
  `setIgnoreMouseEvents(false)` + `win.setShape([surfaceRect])`. A probe proved the previous
  click region was the whole 460x300 canvas (see HISTORY note) — that was the "it interferes with
  my clicks" bug, and the hitbox padding was innocent.
- **P2 shape** — added `'custom'` + `radius`; `notch` now rotates its rounding with the edge
  (was hardcoded to the top corners, so a left-edge island looked detached from its own edge).
- **P3 location** — left/right edges now actually WORK. `OverlayRoot` hardcoded
  `data-edge="top"` + `top:0;left:50%`, so choosing left/right moved the window and changed
  nothing visible. Added `displayId` + `listHaloDisplays`, which connects the already-written-but-
  dead `resolveTargetDisplay`.
- **P4 widgets** — new per-widget `compact` axis (visible in expanded, excluded from the
  collapsed pill). Implemented by making `hidden` phase-dependent in `OverlayRoot`.
- **P5 pin** — was `onClick={() => setPinned(p=>!p)}`, a LOCAL flag main never heard; the next
  40ms poll collapsed it. Now a real labelled `Pin`/`Unpin open` RailButton calling
  `halo:set-pinned`, plus HALO §51 `click outside -> unpin + collapse` via `halo:click-outside`.
- **P6 animation** — one clock. CSS said 250ms, the `motion` transition said 280ms, and
  `OverlayRoot` held a third copy of the two delays. All read `prefs.motion` /
  `prefs.trigger` via `motionDurationMs`/`motionEasing`/`motionEaseTuple`.
- **Live-apply path (was entirely missing)** — new `halo:apply-prefs` -> `applyHaloPrefs()`;
  all 6 pre-existing Halo write sites in SettingsPage now call it.
- **Spec conformance** — reverted my own §127 violations (`bottom` edge, `anchor`, `offsetX/Y`)
  and gated `setBounds` behind §11's allowlist.
**NEXT ACTION:** CZ builds (`npm run build`) and passes the cursor over the island to confirm
the four §0 runtime things a probe cannot reach: `setShape` support on this XWayland box, the
§51 click-outside collapse, the pin latching, and live shape/edge changes without a relaunch.
**NOTES:**
- 77/77 numeric probe checks pass (`/tmp/opencode/probe/probe.mjs`).
- **Another agent is live-editing `src/features/halo/`** — `shellRadii` gained a `phase`
  param and the rail markup changed between two of my reads. I extended rather than
  overwrote. Someone owns that file; do not assume my edits are the last word.
- `/agentic has no manifest` (validate:pages) is NOT mine — untouched route/registry.
- `phase: expanded ? 'expanded' : 'idle'` in OverlayRoot is a pre-existing type error
  (`'idle'` is not in `IslandPhase`); `stopwatch.halt/setTier/getSnapshot` are a type-vs-impl
  mismatch in another agent's work. Reported, not touched.
- Settings is a **7334-line file with 110 pre-existing tsc errors** — scope every check.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 0 — 2026-10-06 (pre-session)
**ROLE:** inherited `opencode-halo-island-20261005` "working" state from the Hub; read
`HALO_ISLAND.md` §9/§11/§12/§13/§48/§49/§51/§127 to establish the hard rules before coding.
**STATUS:** completed
**IN FLIGHT:**
- reconciling the user's request against the spec
**COMPLETED:**
- coordination gate; leak census baseline 46
**NEXT ACTION:** implement within §127/§11/§12/§13