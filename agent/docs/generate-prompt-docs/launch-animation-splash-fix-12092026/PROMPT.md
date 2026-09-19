# PROMPT — Fix the RHEO launch (boot splash) animation

Target AI: act as the **Lead Designer and Engineer** for this fix. Read `CONTEXT_BUNDLE.md` first — it is the source of truth for code structure. Produce ONE comprehensive solution, not options.

## Raw Request (user's exact words, verbatim)

"HOW IS THE ANIMATION STARTUP OF THE APP IDIOT??"
"WHY IS IT STILL NOT WOKRING"
"the app opening animation doesnt work at fucking all. it only shows the black rectangle and nothing else"
"FIX THE LAUNCH ANIMATION"

## Problem statement

On app launch the R-10 Boot Splash (Meridian Wake, 520x320 frameless overlay) shows as a pure black rectangle. No ticks rise, no numbers fade, no sweep, no RHEO logo — the sequence never plays a single frame.

## The Mandate

Design and specify the complete fix for the launch animation so that on every cold start the user sees the full Meridian Wake sequence (ticks 0-500ms, numbers 350-700ms, NOW marker 700-900ms, sweep + logo 850-1250ms, close on `sendComplete`), with correct behavior for warm start, reduced-motion, disabled-config, and user-skip paths.

## What Hands already proved (use this, do not re-diagnose from zero)

Headless-Chromium execution of the shipped splash file throws on load:

- `Failed to execute 'requestAnimationFrame' on 'Window': parameter 1 is not of type 'Function'`
- After 1600ms: 24 ticks in DOM, logo/sweep/first-tick inline styles all empty — zero frames ran.

Prime root cause (CONTEXT_BUNDLE §1): `var tick` in the tick-builder loop hoists across the IIFE scope and overwrites the `function tick(now)` animation-loop declaration, so `requestAnimationFrame(tick)` receives a DIV. Your spec MUST fix this name collision and audit the same IIFE scope for any other `var`-vs-function collisions.

## Requirement Checklist

### Engineering
1. Fix the `tick` name collision with the smallest correct edit (rename the loop variable, not the loop function — the recursive `requestAnimationFrame(tick)` references must keep working).
2. Full-scope audit: every `var` in the splash IIFE vs every function declaration in the same scope; list each binding and its verdict.
3. Resolve the preload ambiguity (CONTEXT_BUNDLE §1a, §5): either wire the splash window to the dedicated `splashPreload.cjs` (R-10 design) with build step intact, or remove the dead file + build step. No ambiguous dual wiring.
4. Fix or explicitly remove the dead skip handlers (`BrowserWindow.on('keydown')`, `webContents.on('mouse-down')` — neither event exists). If skip-on-input is required, specify the correct mechanism (renderer-side click/keydown → `sendComplete()` honoring the 400ms gate, or `before-input-event`) with exact code.
5. Harden the `splash-complete` / `replay-splash` close path (CONTEXT_BUNDLE §1c): close via the captured window reference / `splashClosed` flag instead of scanning all windows by width+title. Preserve the 1400ms min-display and 4000ms hard cap semantics.
6. Specify the file-sync rule for `public/splash.html` vs `src/splash.html` (identical copies today): single source of truth going forward.
7. Verification plan the Hands agent can execute without seeing images: headless-Chromium load of the fixed file asserting (a) zero pageerrors, (b) logo opacity reaches 1 by ~1400ms, (c) sweep transform reaches scaleX(1), (d) `splash-complete` IPC fires exactly once; plus `node scripts/build.mjs` exit 0 and the black-screen checklist (CONTEXT_BUNDLE §8).

### Visual spec
8. Confirm the shipped visual spec is unchanged (Concept A: transform/opacity only, one-shot, easings, positions, colors in CONTEXT_BUNDLE §2) — or call out any pixel-level correction with before/after values. No redesign; this is a repair.

### UX flow
9. Specify every startup path end-to-end: cold start full sequence, warm start short sequence, `prefers-reduced-motion` static frame + 140ms close, `enabled === false` plain body, user skip after 400ms, main-window `did-finish-load` race in dev mode vs production, load-failure/crash fallback. State the expected visible outcome and close trigger for each.

## Constraints (hard limits)

- The splash page stays dependency-free vanilla HTML/CSS/JS. No component libraries, no build step for the page itself, no network dependency for the animation (Google Fonts may fail offline — the sequence must still play on fallback fonts).
- LAMINAR Concept A: transform/opacity ONLY, one-shot, no loops.
- Timing contract is fixed: sendComplete at 1250ms, loop ends 1500ms, min-display close 1400ms, hard cap 4000ms, skip gate 400ms.
- Zero-destruction rule: no git history rewrites, no `git checkout --` / `restore` / `reset --hard` / `clean`, no wholesale tree copies. Single-file backups as timestamped `.bak` copies before replacement.
- Do NOT propose removing existing features, buttons, or functionality. If your analysis suggests any removal, stop and flag it as a question instead.
- Uncommitted work in flight (CONTEXT_BUNDLE §3): the main.ts splash block already has gated dismiss + `closeSplash` wiring + `!splashClosed`-gated `did-finish-load`. Build on top of it; do not revert it.
- MCP component inventory: not applicable — the splash surface is vanilla HTML with no design-system component surface. Do not pad the spec with shadcn/MagicUI/Lucide tables.

## Output format

Return a single high-level technical brief:

- Context: why the splash is black (root cause + evidence).
- The Mandate: the complete repair.
- Requirement Checklist mapped 1:1 to the checklist above (each item: exact file, exact lines, exact edit).
- Backend verification: confirm each IPC channel in the chain exists with handler + payload (`boot-animation-config`, `splash-complete`, `replay-splash`) — table format with file:line per endpoint.
- Verification: the executable checks from item 7.

## Deliverable from you

A RESULT.md-equivalent: the full fix specification the Hands agent can implement file-by-file. It will be saved raw and implemented after a completeness check — so every checklist item above must have a corresponding section in your output, with exact paths and line numbers from CONTEXT_BUNDLE.md.
