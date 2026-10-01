<!-- SESSION: opencode-fix-20260930 -->
<!-- AGENT: opencode | TERMINAL: n/a | PROJECT: App Tracker -->

# Agent State — opencode-fix-20260930

> **STATUS:** error | **UPDATED:** 2026-09-30T23:20:00Z

---

## CURRENT CYCLE (1)
**ROLE:** Hands & Eyes — close what was left: export-to-brain, dead brain code, zip-src portability.
**STATUS:** error
**IN FLIGHT:**
- Final build is BLOCKED by machine resource contention (see NOTES). `dist/` is one
  one-line fix behind the source.
**COMPLETED:**
- `src/components/ai/chat/ChatExportBridge.tsx` — the Export button is no longer a dead end.
  Three actions: Save to brain / Download JSON / **Import a chat export**. Mounted in AiPage.
- Fixed a REAL importer bug found only by driving the real file input: ChatGPT's `mapping`
  tree keeps BOTH role and body under `node.message`; I was reading `node.role`, so every
  message was silently dropped. Verified failing first, then fixed.
- Added `EntityDetailPanel` node-click to `BrainSurface` (was only in the never-rendered
  `warmth/ContextGraphView`).
- Removed the dead `ContextGraphView` import from `LifePage.tsx`.
- `scripts/zip-src.mjs` — was Windows-only (`powershell Compress-Archive`, backslash paths,
  wrote to dist/src.zip while every real bundle lives at repo root). Now uses the platform
  zip, writes BOTH paths, excludes the 4GB agent/backups tree.
- Deliberately did NOT delete `components/life/ContextGraphView.tsx` (0 importers, git-tracked).
  Dead-code removal is cosmetic and the zero-destruction rule wins.

**NEXT ACTION:** Re-run `node scripts/build.mjs` once the machine is quiet. Nothing else
is required — all 5 changed files typecheck clean and compile standalone.
**NOTES:** VERIFIED: `npx tsc | grep` scoped to my 5 files = 0 errors; each compiles via
esbuild. NOT VERIFIED: a full green build of the final source. Cause is NOT my code —
another agent was running `NODE_OPTIONS=--max-old-space-size=8192 vite build`; swap sat at
100% (8.2/8.2GB), available memory fell to 848MB, and 4-6 vite processes ran at once. My
builds died right after `transforming...` with no error text = OOM kill. I attempted 9 times
over ~15 min and was refused 3 times with `REFUSED: lock "build" is already held` and once
because another agent had `src/pages/TerminalPage.tsx` mid-edit and broken
(`git status` = `MM`, unbalanced tags at 3123). I waited rather than editing their file.

---

## HISTORY (previous 2 cycles, oldest first)

(none — first cycle)
