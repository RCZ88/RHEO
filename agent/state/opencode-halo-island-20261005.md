<!-- AGENT STATE TEMPLATE — Copy this to create your spoke file -->
<!-- Replace ALL {braces} with actual values before writing -->
<!-- SESSION: opencode-halo-island-20261005 -->
<!-- AGENT: opencode | TERMINAL: halo-island | PROJECT: App Tracker -->

# Agent State — opencode-halo-island-20261005

> **STATUS:** completed | **UPDATED:** 2026-10-07T00:10:00Z

---

## CURRENT CYCLE (3)
**ROLE:** Ship the Halo revamp — dual-boot legacy + Figma, fix geometry/motion/producers, PAINT audit, and run CZ's explicitly authorized build.
**STATUS:** completed
**IN FLIGHT:**
- (none — cycle closed with a successful build)
**COMPLETED:**
- Per-phase trigger rects (`hotZoneExpanded` = union of all phases) → replay 4/6-outside became 0/6. 19/19.
- Stopwatch `dayKey` persist + real `activeTier`/`setPaused` → 13/13, 2501ms cross-window round trip.
- `halo:get-next-deadline` end-to-end (main → preload → renderer). Real DB: 6 rows/4 open. 7/7.
- S/M/L presets + `fitToCanvas` uniform scale + click-region decoupled from the shape. 53+12+21+15+14 = 115/115.
- Figma four-page renderer, bottom `HaloTabRail`, restored `LegacyHaloRail`, `uiVersion` pref + Settings toggle. 14/14.
- PAINT Gate D: replaced inline styles with real hover/active/focus-visible/disabled/selected states.
- **BUILD OK** — `npm run build`, exit 0, 207.7s, peak RSS 0.11 GB. `dist/index.html` + `dist/assets/index.BJXudsrJ.js` (16 MB) + `preload.cjs` (148 KB) + `main.cjs` (1.7 MB) all post-date every source file.
**NEXT ACTION:** CZ launches the app and does the human visual pass. Agent must NOT build again unprompted.
**NOTES:** Build #1 failed 13.7s — stray `}` in `halo.css` (mine). Build #2 failed 1.7s — my LF→CRLF conversion of `src/index.css` injected a `\r` into a CSS backslash line-continuation inside a `data:image/svg+xml` string, so Tailwind reported `Unterminated string`. Both were mine; both fixed. `dist/` was untouched by all three attempts (the `dist-tmp` + rename guard worked).

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 2 — 2026-10-06T22:10:00Z
**ROLE:** Rewind month anchoring + Insights repaint.
**STATUS:** completed
**IN FLIGHT:**
- Made "when" a required parameter so every call site became compiler-checked.
**COMPLETED:**
- `metricHistory(db, anchor, ...)`; `determineArchetype` now honours its own `start`/`end`.
- Single local clock for parse *and* format; `toISOString()` banned for day arithmetic.
- Repaint: colour encodes TIER, magnitude is opacity of one hue.
**NEXT ACTION:** —

### Cycle 1 — 2026-10-06T21:00:00Z
**ROLE:** Halo Island hover-hitbox investigation.
**STATUS:** completed
**IN FLIGHT:**
- Separating the hover zone from the click region.
**COMPLETED:**
- Two distinct rects instead of one; `setShape` on expanded.
- Cursor-point polling instead of a synthetic hover event.
**NEXT ACTION:** —

---

## DURABLE LESSON (candidate for MEMORY.md — do NOT append yet)
- **`npx esbuild` parses CSS too leniently to be a build gate.** A stray `}` in
  `halo.css` passed esbuild clean and then killed the whole renderer build 13.7s
  later inside `@tailwindcss/vite` (`Missing opening {`). Worse, my *fix* — a
  byte-level LF→CRLF "restore" on `src/index.css` — inserted a `\r` into a CSS
  **backslash line-continuation** (`\` + LF) inside a `data:image/svg+xml` string,
  producing `Unterminated string` 1.7s into the next build. Two rules: (1) validate
  CSS with the engine that actually fails — `@tailwindcss/node`'s `compile()`, not
  esbuild; (2) **never bulk-convert line endings with a blind byte replace on a file
  containing escaped-newline sequences.** Normalise line endings from HEAD's
  convention *and* re-check for `\`+CRLF and data URIs in the same pass.