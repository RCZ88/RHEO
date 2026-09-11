# PROMPT — Lag root-cause research: background vs. something else (research)

## Raw Request (user's exact words, verbatim)
> still lags like crazy. i need you to generate another prompt. ask it to do a research ro like find out. no i need you to find out if its the problem from the background or something else

## Context
- You are the **Lead Performance Investigator** for the RHEO/App Tracker Electron app (Electron 41, React 19, Vite 7, Tailwind, 3542-line `src/App.tsx`).
- Source of truth: read `CONTEXT_BUNDLE.md` in this same folder FIRST. It contains the full history (two failed background-perf rounds with bundle proof), hard live measurements (process map, CPU, screenshots, GPU hardware), a suspect inventory with exact file/line locations, and six decisive isolation experiments. Reason only from that file — do not invent measurements, files, or components.
- Situation: two rounds of background optimization (DPR cap, shader cuts, frame gating, half-res, idle freeze — all verified in built bundles) did NOT fix the lag. The previous hypothesis (fill-rate-bound fragment shader) is now weak. The question is binary: **is the background the problem, or is it something else?**

## The Mandate
Produce a single, well-reasoned root-cause finding: a ranked suspect list grounded in the bundle's code evidence, a decision tree that isolates background vs. non-background causes, and an experiment protocol that yields a binary answer per suspect. Not Options A/B/C — one verdict with the evidence chain behind it.

## Requirement Checklist

### Research Task — suspect analysis (the core of this prompt)
1. **Rank all five suspect groups** (S-1 background canvas, S-2 per-second App re-renders, S-3 other rAF loops, S-4 main-process churn, S-5 software rendering) by likelihood, using ONLY the bundle's measurements. For each: the specific code mechanism, why the existing evidence supports or weakens it, and what single measurement would confirm or kill it.
2. **Resolve the process-map mystery.** The app has no renderer and no gpu-process yet paints an animating 2048×1280 window. Explain what Chromium/Electron configurations produce this shape (in-process rendering paths, ozone X11 fallbacks, zygote behavior) and what it implies for where pixels are actually rasterized. State how to confirm (which `/proc` entries, which log lines, which launch flags).
3. **Software-GL verdict.** Given sibling apps carry gpu-processes with a render-node override and this app has none, assess: is WebGL/compositing on CPU here? What is the expected lag signature of SwiftShader fullscreen canvas + backdrop-blur vs. the observed "lags like crazy"? If software rendering is confirmed, state plainly that no shader optimization can fully fix it and name the real fix.
4. **React churn audit.** From the bundle's timer inventory (1s elapsed-time setState, 1s JSON.stringify localStorage polls, 5/30/60s refreshers, provider-wrapped tree, AnimatePresence, Chart.js, framer-motion): estimate re-render scope per tick and identify which ticks force full-tree vs. subtree renders. Name the single worst offender with reasoning.
5. **Blank-cards anomaly.** The screenshot shows empty stat tiles beside a populated card. Assess whether this smells like render thrash, a data-loading bug, or an unrelated issue — and which experiment distinguishes them.

### Experiment Task — isolation protocol
- Formalize experiments E1–E6 from the bundle into a runbook: exact command/edit per experiment, what to observe, the expected outcome under each hypothesis (background-guilty vs. background-innocent), and approximate time cost. Order them cheapest-first so the binary answer arrives as fast as possible.
- E1 (comment out one line, rebuild, feel-check) must be experiment #1 — it alone answers the user's question.

### Instrumentation Task — measure, don't guess
- Specify the minimal instrumentation to add if experiments are inconclusive: FPS meter approach for this stack, React profiler marks around the 1s ticks, per-process CPU sampling commands for this Linux box, and how to read chrome GPU status from the running app without relaunching it.
- All instrumentation must be removable in one patch and must not ship in production builds.

### Edge cases
- HiDPI vs standard displays; NVIDIA vs Intel node selection for the render-node experiment; minimized vs occluded vs visible window states; `/terminal` route (different shell) as a control; reduced-motion users (frozen frame — if THEY lag, background is innocent).

## Constraints (hard limits)
1. This round is RESEARCH ONLY: findings, decision tree, runbook, instrumentation spec. No implementation edits proposed beyond the one-line E1 toggle and instrumentation snippets.
2. Every claim must cite bundle evidence (measurement, code location, or log line). Flag speculation as speculation.
3. The verdict must be binary-first: "background" or "not background," then the ranked detail.
4. If the evidence is insufficient for a verdict, say so and name the exact missing measurement — do not fill the gap with plausibility.
5. No new dependencies. No git operations of any kind.

## Required skills (apply all)
1. **Frontend Design** — DeskFlow-specific component patterns, tokens, spacing, typography, glass cards
2. **Human-Centric UX** — empty/loading/error states, progressive disclosure, visual hierarchy, feedback
3. **Impeccable** — 7 design dimensions, 27 anti-patterns
4. **Motion — Bring the UI Alive** — Liveliness Levels (L1 Composed / L2 Responsive / L3 Expressive), motion taxonomy, recipes
5. **UI UX Pro Max** — industry-specific design rules, style library
6. **Design Taste System** — master aggregator, design variance knobs, anti-repetition rules
7. **frontend-external-infra** — source routing, re-skin rules, anti-slop checklist

## MCP inventory (verified against this task)
| Component | Source | Use for |
|-----------|--------|---------|
| (none) | — | This is a diagnosis task over vendored code and live measurements. No shadcn / Magic UI / React Bits / Lucide / Iconify components are involved; none are to be introduced. Any instrumentation snippet must use existing Tailwind classes and DeskFlow tokens only. |

## Anti-Slop Checklist (applies to any snippet proposed)
1. DeskFlow tokens, dark mode only, max rounded-xl
2. Inter + JetBrains Mono (already loaded)
3. Instrumentation must be one-patch removable, never shipped

## Output format (your RESULT.md)
Return markdown with exactly these sections:
1. **Verdict** — background or not-background, one paragraph, then the ranked suspect table (| Suspect | Likelihood | Code evidence | Killer measurement |).
2. **Process-map explanation** — what the missing renderer/gpu-process means and how to confirm.
3. **Runbook** — experiments cheapest-first with exact steps and per-hypothesis expected outcomes.
4. **Instrumentation spec** — removable snippets + sampling commands.
5. **Gaps** — anything unanswerable from current evidence and the exact measurement needed.
