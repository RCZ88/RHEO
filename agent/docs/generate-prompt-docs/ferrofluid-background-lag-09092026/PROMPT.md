# PROMPT — Fix Ferrofluid background lag (bug-fix)

## Raw Request (user's exact words, verbatim)
> the background makes the app super laggy
> fix it

## Context
- You are the **Lead Designer and Engineer** for the RHEO/App Tracker Electron app (Electron 41, React 19, Vite 7, Tailwind).
- Source of truth: read `CONTEXT_BUNDLE.md` in this same folder FIRST. It contains the full source of `src/components/AppBackground.tsx`, `src/components/Ferrofluid.tsx` (ogl WebGL shader), the `src/App.tsx` mount point, deps/build scripts, runtime facts, and design tokens. Design only from that file — do not invent APIs, files, or components that are not in it.
- History: the previous background (2× Particles + LightRays) did NOT lag. The lag appeared only after swapping in the fullscreen Ferrofluid WebGL canvas. A fix that returns to the old look is a failure — keep the ferrofluid visual identity (white fluid, downward flow, mouse glow, dark overlay).

## The Mandate
Design a comprehensive performance solution for the fullscreen Ferrofluid background that eliminates the lag while preserving its exact visual identity. One single well-reasoned solution — not Options A/B/C.

## Requirement Checklist

### Engineering Task — frame-cost pipeline (the core of this prompt)
1. **Quantify the per-frame cost.** Using the shader source in the bundle, estimate per-pixel ALU (count the ~13 value-noise evals, `exp2`/`log2` smin, `pow`, `exp`) and multiply by fullscreen pixel count at dpr 1/2/3. Show the math. Identify the single most expensive term.
2. **DPR policy.** The renderer currently uses raw `window.devicePixelRatio` uncapped with `antialias: true`. Specify the exact DPR cap + antialias setting, with the reasoning (fill-rate vs. perceptible quality on a blurred background layer).
3. **Shader reduction.** Specify the exact shader simplification that preserves the look: which noise octave(s) to drop, cheaper smooth-min replacement, whether `highp` can drop to `mediump` for this content. Give before/after GLSL for the changed lines only.
4. **Frame scheduling.** The rAF loop currently renders every frame forever (no visibility/occlusion handling; `paused` only covers reduced-motion). Specify: `document.visibilitychange` handling, skip-render when Electron window is minimized/occluded, and frame-throttling policy (e.g. render at 30fps when idle + full rate for N ms after pointer input). Give the exact loop code.
5. **Pointer path.** Every app-wide `pointermove` currently constructs and dispatches a synthetic `PointerEvent` to the canvas. Specify a cheaper path (rAF-throttled uniform write, direct ref call, or removing the forwarder) with code.
6. **Compositing.** Glass panels use `backdrop-filter: blur(20px)` over a constantly repainting canvas. Specify whether the overlay/canvas stacking needs changes (e.g. isolating the canvas layer, reducing blur radius over the canvas region) and why.

### Design Task — visual parity spec
- Exact final prop values for `<Ferrofluid>` (dpr cap, speed, scale, turbulence, fluidity, rimWidth, sharpness, shimmer, glow, opacity, mouseRadius) and the overlay opacity, chosen so the approved look (white fluid, downward flow, mouse glow) is unchanged to the eye.
- State the acceptance threshold: side-by-side screenshot comparison criteria (what may differ, what must not).

### UX Task — interaction flow
- What the user experiences during the fix: background must never flash/disappear on route change, resize, or window restore. Specify loading/fallback states (first-frame behavior, WebGL-unavailable fallback).
- `prefers-reduced-motion` behavior must be preserved (currently pauses rendering).

### Edge cases
- HiDPI (dpr 2–3) vs standard displays; low-end integrated GPUs; window resize / multi-monitor move; app minimized then restored; routes that hide the sidebar (`/terminal`, solar overlay).

## Constraints (hard limits)
1. Touch ONLY: `src/components/AppBackground.tsx`, `src/components/Ferrofluid.tsx` (minimal, clearly-marked edits), and prop values at the existing `<AppBackground />` call site. No new dependencies. No changes to `src/main.ts`, IPC, DB, or any other component.
2. `npm install` of new packages is FORBIDDEN (`ogl` is already installed).
3. Use `patch`-style exact-string edits; do not rewrite whole files.
4. Verify with `node scripts/build.mjs` (exit 0) and confirm the fresh `dist/assets/index.*.js` still contains `uMouseStrength` + `app-ferrofluid`.
5. Do NOT remove any existing feature, element, or behavior to gain speed. If your solution proposes removing anything (overlay, mouse glow, glass blur), stop and flag it for user confirmation instead.

## Required skills (apply all)
1. **Frontend Design** — DeskFlow-specific component patterns, tokens, spacing, typography, glass cards
2. **Human-Centric UX** — empty/loading/error states, progressive disclosure, visual hierarchy, feedback
3. **Impeccable** — 7 design dimensions (typography, color, spatial, motion, interaction, responsive, UX writing), 27 anti-patterns
4. **Motion — Bring the UI Alive** — Liveliness Levels (L1 Composed / L2 Responsive / L3 Expressive), motion taxonomy, recipes
5. **UI UX Pro Max** — industry-specific design rules (dev tools, AI/ML, financial), style library
6. **Design Taste System** — master aggregator, design variance knobs, anti-repetition rules
7. **frontend-external-infra** — source routing, re-skin rules, anti-slop checklist

## MCP inventory (verified against this task)
| Component | Source | Use for |
|-----------|--------|---------|
| (none — fix is vendored code) | — | The lag fix touches only vendored `Ferrofluid.tsx`, the `ogl` npm package, and existing Tailwind classes. No shadcn / Magic UI / React Bits / Lucide / Iconify components are involved, so none are to be introduced. |

## Anti-Slop Checklist (applies to any code touched)
1. Re-skin to DeskFlow tokens (colors → existing palette, `bg-[#121212]`, zinc borders)
2. Max rounded-xl, dark mode only
3. Geist/Inter + JetBrains Mono fonts (already loaded)
4. Glass layer (`bg-zinc-900/80 backdrop-blur-xl`) where panels are touched — minimize blur-over-canvas area per the compositing spec above

## Output format (your RESULT.md)
Return markdown with exactly these sections:
1. **Root cause** — ranked list of lag contributors with the frame-cost math from the Engineering Task.
2. **The fix** — exact code changes per file (before/after snippets, prop table).
3. **Verification** — build command + bundle grep checks + manual test steps (what to observe on HiDPI and low-end GPU).
4. **Risks** — what could regress visually, and the screenshot acceptance check for each.
