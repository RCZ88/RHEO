<!-- SESSION: opencode-profiler-20261004 -->
<!-- AGENT: opencode | TERMINAL: (shell) | PROJECT: /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker -->

# Agent State — opencode-profiler-20261004

> **STATUS:** completed | **UPDATED:** 2026-10-04T16:20:00Z

---

## CURRENT CYCLE (7)
**ROLE:** App performance profiler `/profiler` — layout fixes, capture save/load, Labs card, router sync
**STATUS:** completed
**IN FLIGHT:**
- nothing — cycle closed, all leases released
**COMPLETED:**
- **Persistence verified structurally:** `perfRecorder` is a module-scope singleton and `ProfilerPage` has **ZERO `useEffect`** — nothing can reset on mount/unmount. Verified `useArmWhileMounted` (which *would* `disarm()` on unmount) is deliberately NOT wired up, so arming survives navigation. This is the `<Routes key={location.pathname}>` trap that wiped the stopwatch.
- **Capture save/load:** `exportCapture`/`showCapture`/`dismissCapture` in `perfRecorder`; `validateCapture` + `captureToSnapshot` pure in `shared/perfTypes.ts`. `rebuild()` early-returns while a capture is loaded, so live publishing cannot cross-fade a file into "right now". Save = JSON download (no DB table → no migration/retention for transient data). Load = FileReader → validate → show.
- **Layout root-caused:** the "cut off on the right" was **never overflow** — a bare `max-w-[1400px]` with no `mx-auto` pinned content left and rendered the rest as dead black. Then I misread "centered" and added `mx-auto` (symmetric gutters — still wasted space). Correct fix: **remove the cap**, since `data-page-root` already stretches. `overflow-x-hidden` I added earlier was clipping the ledger and is gone.
- **`agent/probes/probe-perf-layout.mjs`** (22 assertions) written so the width bug cannot silently return.
- **Wrote the Labs procedure prompt** → `agent/docs/LABS-FEATURE-PROCEDURE-PROMPT.md`; the other agent then authored `agent/skills/labs-feature/SKILL.md`.
- **Added `LB-05` Performance** to `labRegistry.ts` per that skill (LB-04 was already Transcripts). Extended the icon union with `'gauge'` + `LAB_ICON` so the map stays a total `Record`. **Removed my sidebar rail entry** — per the skill a diagnostic goes in ⌘K/Labs, not the rail.
- **Fixed a shipped runtime crash:** importing `PAGE_MANIFESTS` into `labRegistry.ts` type-checked and esbuilt clean, then threw `ReferenceError: PAGE_MANIFESTS is not defined` — Vite deconflicted the definition to `PAGE_MANIFESTS$1` and left my template literal dangling. Removed the import and the count expression entirely.
- **Synced `agent/skills/skill-router/SKILL.md`** with a `LABS / EXPERIMENTAL FEATURE` category (§1d mandate).
- **170 probe assertions passing** across 6 probes.
**NEXT ACTION:** CZ builds and does the one verification no static check can do — that recharts renders the scope, and that a saved capture visibly switches the page into "loaded from file" mode.
**NOTES:**
- **Four bugs found by probes, not by reading:** `clampArray` dropped `number[]` trends (every sparkline in a loaded capture would be empty); non-numeric `ipcMedianMs` became `0` not `null` (`0ms` implies instant IPC — a lie); `w-\[\d+px\]` false-matched inside `min-w-[560px]`; `<div[^>]*>` truncates at the `>` inside Tailwind's `[&>*]:min-w-0`, so the layout probe failed on CORRECT code until the matcher made quoted values atomic.
- **Two `src/preload.ts` errors are NOT mine** (duplicate `onSttPanelState` 277/290, unused `validateChannel`) — another agent's uncommitted STT work, pre-existing at HEAD.
- **Runtime verification never achieved:** the app runs but exposes no `--remote-debugging-port`, so Probe cannot attach, and there is no Chromium binary on this box. Layout claims are reasoned + probe-guarded, NOT observed. Say `NOT TESTED`.

---

## HISTORY (previous cycles)

### Cycle 4-6 — 2026-10-04T13:40→15:50
**ROLE:** Fix profiler horizontal overflow; sidebar discoverability; Labs card + crashed import
**STATUS:** completed
**IN FLIGHT:** — none
**COMPLETED:** Removed the sidebar rail entry (wrong placement); traced and killed the `PAGE_MANIFESTS` ReferenceError by reading the shipped bundle; removed `overflow-x-hidden`; re-zipped.
**NEXT ACTION:** verify layout visually (never achieved)
**NOTES:** Three rounds of wrong fixes on the same layout bug before reading the bundle. Cause was my own `max-w` cap, not overflow.

### Cycle 1-3 — 2026-10-04T10:00→13:00
**ROLE:** Plan + build the profiler end to end
**STATUS:** completed
**IN FLIGHT:** — none
**COMPLETED:** Found zero `PerformanceObserver` repo-wide; built `shared/perfTypes.ts` (pure), `lib/perfRecorder.ts` (module singleton, arm-gated), 6 UI components, `ProfilerPage`, manifest + route + page-accent (dark+light); 4 probes.
**NEXT ACTION:** runtime verification
**NOTES:** Verified React strips `onRender` from production builds (0 occurrences in `react-dom-client.production.js`), so component attribution is impossible in the shipped app — the UI states the limitation instead of showing zeros.