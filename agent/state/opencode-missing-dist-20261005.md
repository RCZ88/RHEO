<!-- AGENT STATE -->
<!-- SESSION: opencode-missing-dist-20261005 -->
<!-- AGENT: opencode | TERMINAL: opencode-missing-dist-20261005 | PROJECT: /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker -->

# Agent State — opencode-missing-dist-20261005

> **STATUS:** completed | **UPDATED:** 2026-10-05T00:00:00.000Z

---

## CURRENT CYCLE (1)
**ROLE:** Root-cause + permanently fix CZ's recurring "The application files could not be found. Please rebuild: node scripts/build.mjs" crash (CZ: "can you just make sure that the ai agents have no right to delete those when I'm running the fucking app").
**STATUS:** completed
**IN FLIGHT:**
- none — all three layers shipped, all checks green, guard + swap probe-verified.
**COMPLETED:**
- ROOT CAUSE found: it is **not** a missing build. `vite build` runs `emptyOutDir:true`, so it
  DELETES `dist/` before writing; `public/` is 385 MB (173 MB `cyber_assets.zip`) so dist/ is
  empty/half-written for **2.5–5 min per build**. The Electron main process serves the renderer
  **straight off disk** on `127.0.0.1:38123`, so any request in that window ENOENTs.
- **2 of the last 11 logged builds exited 1** (`agent/logs/build.log`, last failure 13:01:32Z).
  A failed build leaves `dist/` with **no index.html** → bricked for every later launch.
- **`npm run build` built the renderer TWICE**: `build:inner` ran bare `vite build` AND
  `build.mjs` step 1 ran `npx vite build` → dist/ wiped twice, app rendered twice per build.
- LAYER 1 `scripts/build.mjs`: **refuses to start while the app is live** (probes 38123,
  exit 2). Bypass `RHEO_CZ_OVERRIDE=1` is CZ-only.
- LAYER 2 `scripts/build.mjs`: renderer now builds into **`dist-tmp/`** then `rename`s over
  `dist/`; on failure it removes staging and **leaves the good `dist/` untouched**. Post-swap
  it verifies `index.html` > 1 KB. `package.json`: `build:inner` de-duplicated,
  `build:renderer` → `--outDir dist-tmp`. `.gitignore`: `dist-prev`.
- LAYER 3 `src/main.ts` `createWindow()`: missing `index.html` now **polls up to 30 s** and
  serves it the moment it returns; if still gone, serves a page that **reloads itself** via
  `HEAD /index.html` polling. Copy no longer says "Please rebuild" (that was the loop).
- `AGENTS.md` §0-0a added (5 forbidden deletions + why + what is enforced in code), §8
  root cause #9, and 4 NEVER-DO entries.
**NEXT ACTION:** CZ closes RHEO, runs `npm run build` once (now ~half the time, and it will
**refuse** if the app is still open), reopens. After that build lands, the guard + self-heal
page become active for real.
**NOTES:** All edits are **staged in src/ and require CZ's one build** — until he builds, the
running app still has the OLD fatal page. Do not run that build yourself (§0-0).

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 0 — 2026-10-05
**ROLE:** startup / coordination gate
**STATUS:** completed
**IN FLIGHT:**
- register + status + claim `src/main.ts`
**COMPLETED:**
- Coordination gate: `AGENTS(1)`, `LOCKS(0)` — no peers registered.
- Confirmed the app was **live and serving 200** (`curl localhost:38123` → 19073 bytes), so the
  error was transient/persistent-per-launch, not a broken install.
- `coord status` clean exit printed `AGENTS (1)` (verified, not assumed).
**NEXT ACTION:** read the serving code path in `createWindow()`.