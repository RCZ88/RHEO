<!-- SESSION: opencode-react321-20261005 -->
<!-- AGENT: opencode | TERMINAL: n/a | PROJECT: App Tracker (RHEO) -->

# Agent State — opencode-react321-20261005

> **STATUS:** completed | **UPDATED:** 2026-10-05T15:25:00Z

---

## CURRENT CYCLE (1)
**ROLE:** React #321 "Invalid hook call" — root cause + repo-wide hook-ownership audit
**STATUS:** completed
**IN FLIGHT:**
- none
**COMPLETED:**
- Root-caused the reported #321: `dist/assets/index.bfom9WSt.js:371829` calls `useRef` inside a
  `useEffect`. `src/App.tsx:2189` ALREADY has `lastPointerRef` at component scope, but that fix
  is UNCOMMITTED and the bundle is from 18:49 vs source 19:03 => **stale bundle, not a code bug.**
- Built a TS-AST hook-ownership scanner (`/tmp/opencode/hookast3.cjs`) over all 1596 `src` files.
  Illegal hooks: **57 -> 0** in live code.
- Fixed 8 finance transaction modals: `useEffect` was written inside `TransactionModalShell`'s
  RENDER PROP (`TransactionModalShell.tsx:100` invokes `children()` as a plain function), so the
  hook had no component of its own. New `SubmitGate.tsx` gives it a real boundary; one line per modal.
- Fixed `EasingCurveBrowser.tsx`: `useMemo` inside a `.map()` callback (hook count == array length),
  hoisted to one `CURVES` memo. Caught and fixed my own TDZ bug when I first placed that memo
  above the `renderCurve`/`renderFormula` consts it closes over.
- **ROOT-CAUSED THE BUILD FAILURE (the thing that was actually blocking CZ).** Not code — OOM kill.
- `package.json:15` `--max-old-space-size=8192` -> **2048**.
**NEXT ACTION:** CZ: free RAM, then rebuild. Build should now succeed.

---

## HISTORY (previous 2 cycles, oldest first)

(none — first cycle for this session)