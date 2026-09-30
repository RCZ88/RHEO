<!-- SESSION: opencode-penguin-real-fix-20260930 -->
<!-- AGENT: opencode | TERMINAL: penguin-console | PROJECT: App Tracker -->

# Agent State — opencode-penguin-real-fix-20260930

> **STATUS:** completed | **UPDATED:** 2026-09-30T13:05:00.000Z

---

## CURRENT CYCLE (3)
**ROLE:** Hands & Eyes — Penguin Console bug round 1 + Frameworks/Guide round 2 + Terminal Handbook HTML re-skin
**STATUS:** completed
**IN FLIGHT:**
- (none — all items fixed, built, and runtime-verified)
**COMPLETED:**
- **Terminal Handbook follows terminal-handbook.html.** Root cause: the live panel (`src/terminal/components/CommandNotesPanel.tsx`, the console's right-panel "Handbook" tab with the Sparkles Generate button + what/when/gotcha/params/safety/related tabs) was 100% `var(--t-*)`, so it inherited the console's default **Tokyo Night** (blue) instead of the HTML's **pink/violet RHEO**. Created `src/styles/terminal-handbook.css` with the HTML's exact `:root` palette (15 tokens) + its component classes (`.hb-cmd` hover left-bar, `.hb-cmd-bar`, `.hb-dollar`, `.hb-row`/`.hb-tag`/`.hb-val`, `.hb-copy`, `.hb-dt`/`.hb-dv`, `.hb-callout`, `.hb-badge`, `.hb-h3`, `.hb-substrate`); remapped 64 token refs to `--hb-*`; wrapped root in `.hb-scope`. Verified rendering exact HTML values: accent `rgb(236,72,153)`, text `rgb(228,228,231)`, bg `rgb(9,9,11)`, panel `rgb(24,24,27)`.
- **Handbook panel horizontal overflow fixed.** Tab row forced 67px overflow in a 295px panel, clipping the Generate button. → flex-wrap + shrink + `overflow-x-hidden`. Now 0px, button fully visible.
- Cycle 2: toggle positive-tag purge (`real: true`); draggable sidebar (rAF-throttled, 208–520 clamp); Frameworks editable + description field + manual create.
- Cycle 1: `execSync`→async `spawn` in `terminal:exec` (crash); scrollback memo + debounced persist + O(n) stats (lag).
- src.zip refreshed (8.9MB).
**NEXT ACTION:** nothing pending. No commit made (never requested).
**NOTES:**
- **The HTML reference lives at the repo root: `terminal-handbook.html`** (72KB, 822 lines, self-contained CSS+JS, tokens at lines 7-30, components 32-244). This is the canonical design for the Terminal Handbook. It is NOT in agent/docs.
- **`src/components/learn/HandbookWorkspace.tsx` (51KB) is DEAD CODE — imported nowhere.** I re-skinned it to the HTML palette too (253 color atoms → `--hb-*`, plus `.hb-cmd`/`.hb-row`/`.hb-copy`/`.hb-dt` etc.) and added `.hb-scope` + `.hb-substrate` + pink/violet substrate + pink progress gradient, but **nothing renders it**. Backup: `agent/backups/HandbookWorkspace.tsx.pre-html-reskin`. If the user wants that full-page handbook actually mounted, that is a separate wiring task.
- **`CommandNotesPanel.tsx` is the LIVE handbook** (wired at `src/terminal/components/Panels.tsx:822`, and also for the "notes" tab at 823).
- **Codemod lessons:** rewriting Tailwind color atoms to arbitrary values must produce `var(--x)_NN` — a naive `_{op}` with op=`/NN` silently emits `_/10` (invalid). Also catches `border-l-` prefixed atoms and `innerHTML` template strings. Always re-parse with the TypeScript compiler (`createSourceFile().parseDiagnostics`) after a codemod.
- **`coord.mjs` CLI crashes under `node -e`**: `main()` does `pathToFileURL(process.argv[1])` and `argv[1]` is undefined for `-e` → ERR_INVALID_ARG_TYPE at import time, so the whole script dies before logging. Drive it from a REAL .mjs file (see `/tmp/opencode/coord-run.mjs` pattern), not `node --input-type=module -e`.
- `scripts/zip-src.mjs` is PowerShell/Windows-only. On Linux: `zip -rq src.zip src scripts -x "*.map" "*/node_modules/*"` then add `agent` excluding `agent/backups` (4.1GB!), `agent/docs`, `agent/*.zip`.
- Pre-existing, NOT mine: ~8.6k `tsc --noEmit` errors; main-process `[Migration] v2 failed` + `[GAS] setBrainDb is not a function`; `build.mjs` intermittently fails on `src/main/gas/client.ts` (passes standalone — re-run).
- Probe uses a throwaway profile (`/tmp/probe-profile-*`): state resets each launch, test rows never touch the real DB.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 2 — 2026-09-30T12:45
**ROLE:** Hands & Eyes — toggle purge v2, draggable sidebar, Frameworks edit/create
**STATUS:** completed
**IN FLIGHT:** (none)
**COMPLETED:** real:true positive-tag purge (legacy untagged rows 18→0); SidebarResizer with clamp + rAF; Frameworks unlocked + description field + create composer (verified in SQLite)
**NEXT ACTION:** user raised the Learn/Guide surface → cycle 3
**NOTES:** I had wrongly assumed `/guide` was the surface; the real target was Content Engine → Frameworks.

### Cycle 1 — 2026-09-30T11:35
**ROLE:** Hands & Eyes — REAL/DEMO switch, CLI crash, terminal input lag
**STATUS:** completed
**IN FLIGHT:** (none)
**COMPLETED:** execSync→spawn; scrollback memo + debounced persist + O(n) stats; demo-aware layoutFor/mkTab; first purge pass
**NEXT ACTION:** user reported toggle still broken → cycle 2
**NOTES:** first purge used a NEGATIVE filter (`!l.demo`) and left legacy untagged rows — the exact reason round 1 looked like a no-op.
