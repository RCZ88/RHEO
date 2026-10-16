<!-- AGENT STATE — opencode session (halo windowless) -->
<!-- SESSION: opencode-halo-windowless-20261016 -->
<!-- AGENT: opencode | TERMINAL: (linux session) | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-halo-windowless-20261016

> **STATUS:** working | **UPDATED:** 2026-10-16T13:30+02:00

---

## CURRENT CYCLE (1)
**ROLE:** Halo windowless island — finish cross-app hover path; KWin fallback gate-1 investigation; specialist-loop doc update.
**STATUS:** working
**IN FLIGHT:**
- Rebuild #2 handoff to CZ (close RHEO → `npm run build` → reopen) — lands `halo:hover` routing to the offscreen island + snapshot/prefs to offscreen (`extraTargets`).
- KWin flat-install fix (CZ sudo) + live/rescan decision.
**COMPLETED:**
- Fixed `window()` getter placement (was in KwinBridge; now on OffscreenHaloRenderer) — root cause of dead hover/extras in the user's 12:10 build (`grep dist-electron/main.cjs`: routing markers present + misplacement present).
- Host v2 lifecycle shipped + verified (pid 124734): hidden until first frame → shown on frame → hidden the moment the bridge drops; single-instance flock; app spawns/kills it (`main.ts` spawn + will-quit kill; lands with next build). Dummy-bridge test: full hide/show/hide sequence logged; real-app test: LIVE 680x154 → `surface shown`; second instance exits 0.
- Host heartbeat verified live: no `socket closed by peer` for 129 s+ (was churning every 20 s).
- Protocol probe: `kind` validated (enter accepted, `boop` rejected, bad action/non-int rejected); bridge routes `pointer` → `validatePointerEvent` → main.ts (`halo:hover` for enter/leave; `sendInputEvent` for move/down/up).
- KWin gate-1 root cause found: effect discovery = `KPluginMetaData::findPlugins` under `QCoreApplication::libraryPaths()/kwin/effects`; **FLAT `halo.so`+`halo.json` → 1 entry (id=halo, KWin/Effect); any subdir → 0.** Live KWin: not in listOfEffects, isEffectSupported=false (explained).
- `conversation/round-01.md` addendum written (layer-shell LIVE; layout matrix; live-compositor evidence).
- coord: registered + claimed (7 paths) as opencode-halo-windowless-20261016.
**NEXT ACTION:** After CZ rebuild (#3): verify hover enter/leave opens/closes capsule over Firefox; real data in capsule; click test; off-switch hide. Check `~/.config/RHEO/halo-diagnostic.log` for `extra-target-primed`.
**NOTES:** Bridge wire = 4-byte LE length + JSON; heartbeat 5 s host-side. Offscreen canvas 680×154 (L preset); host window sizes to alpha bbox. Island diagnostics log: `~/.config/RHEO/halo-diagnostic.log`.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 0 — 2026-10-16 (pre-this-session, from checkpoint)
**ROLE:** Diagnose why cross-app capsule dead: offscreen 0 snapshots, dead `halo:pointer`, no host heartbeat.
**COMPLETED:** source fixes written (uncommitted); host rebuilt with heartbeat; Live frames 680×154 verified on screen.
**NEXT ACTION:** verify pointer routing in the app after rebuild.
