# INITIAL PROMPT — Probe MCP Revamp: 100x Better Than Playwright MCP

You are the Architect. I am the Hands (opencode agent). CZ relays between us.

## The problem

Probe MCP is a CDP-based testing tool that is already better than Playwright MCP in
several ways (assertion-first, token-efficient, Electron support, network capture).
But it lacks critical capabilities, especially **screen recording/capture**, and has
gaps in interaction, content capture, performance, and accessibility.

The user wants Probe to be **100x better than Playwright MCP**. Playwright MCP burns
114K tokens per test (streaming full accessibility trees + screenshot bytes). Probe
should stay under 27K tokens while providing MORE capability.

## What I need from you

A design plan for making Probe 100x better than Playwright MCP. Specifically:

1. **Screen recording / capture.** This is the #1 missing feature. Probe has no way
   to capture animated content, scroll sequences, hover states, or multi-viewport
   comparisons. Playwright MCP also lacks this, but it's the most requested feature
   for visual verification. Design a screen recording system that captures video
   (webm/mp4), animated content, scroll sequences, hover states, and multi-viewport
   comparisons — all within Probe's token-efficient, assertion-first philosophy.

2. **Visual diffing.** Compare screenshots over time. Detect visual regressions.
   This should be structural (DOM-based) not pixel-based, to stay token-efficient.

3. **Canvas/WebGL capture.** Extract rendered content from canvas elements. WebGL
   renders are currently invisible to DOM snapshots.

4. **Interaction recording.** Record a sequence of user actions (click, type, scroll)
   and replay them. Generate test code from recorded interactions.

5. **Performance profiling.** FPS measurement, paint timing, memory profiling,
   network waterfall. All within the CDP Network/Performance domains.

6. **Accessibility audit.** WCAG compliance check, focus order verification, ARIA
   validation, color contrast audit. Structural, not visual.

7. **Device emulation.** Full device profiles (user-agent, touch, viewport, etc.).
   Not just viewport resize.

8. **Network throttling.** Simulate slow connections for testing.

9. **Test generation.** Generate test code from recorded interactions.

10. **Parallel execution.** Run multiple tests concurrently.

## Constraints (non-negotiable)

- **Token efficiency.** Probe must stay under 27K tokens per test. Playwright MCP
  burns 114K. Every new feature must be designed to minimize token usage.
- **Assertion-first.** Every new capability should return PASS/FAIL verdicts, not
  raw data. Raw data goes to disk (toFile), returns a path.
- **Zero dependencies.** Node 22+ built-in APIs only. No npm packages.
- **CDP-based.** Everything goes through Chrome DevTools Protocol. No browser
  drivers, no WebDriver.
- **Backward compatible.** Additive only. Old tool names kept as aliases.
- **Electron support.** Everything must work on Electron too.

## What Probe already does well (don't break these)

- Assertion-first with PASS/FAIL verdicts
- Stable @e# refs persisting across re-renders
- CDP-based: network, console, IPC, DOM internals
- Electron: renderer + main process + IPC
- Zero dependencies (Node 22+ built-in)
- Token-efficient: bounded outputs, diff snapshots, toFile artifacts
- Run ledger with `next` step hints
- CI-ready: start_run, report (JSON/JUnit)
- Reduced motion: assert_animating
- Read DB: query SQLite from main process
- Read file: read files from disk
- Read network: network requests with filtering
- Wait for server: poll until dev server ready
- Assert API: verify specific API calls
- Assert no failed requests: catch backend failures
- Assert IPC: verify IPC messages
- Assert expect: in-app expectation checkpoints
- Set viewport: responsive testing
- Query: resolve selectors to refs
- Hover: real CDP mouse move
- Type: native value setter for controlled inputs
- Press: real keyboard events
- Select: set dropdown value
- Eval: escape hatch for JS evaluation
- Read console: renderer or main process
- Read ledger: full run history
- Mark: sequence numbers for scoping
- Discover: find running Electron instances
- Open: launch or attach (with userDataDir for real data)
- Close: close session, kill instance
- Screenshot: PNG capture (vision fallback)
- Browser tabs: list/create/close/select tabs
- Browser run code unsafe: run arbitrary Playwright code
- Snapshot: bounded semantic snapshot

## What Probe is missing (from the gap analysis)

### A. Screen recording / capture (HIGHEST PRIORITY)
1. Video/screen recording — capture frames as video (webm/mp4)
2. Animated content capture — record CSS animations, transitions
3. Scroll sequence capture — capture at multiple scroll positions
4. Hover state capture — screenshot with hover active
5. Multi-viewport comparison — capture at 375px, 768px, 1280px in one call
6. Dark/light mode side-by-side
7. Element screenshot with padding
8. Full page screenshot with scroll position
9. Screenshot during animation — capture at specific animation frame
10. Screenshot comparison — visual regression diff
11. Canvas/WebGL content extraction
12. PDF generation
13. Video playback control
14. Audio capture
15. OCR/text extraction from canvas
16. Screenshot with element highlight
17. Screenshot with annotations
18. Timelapse capture
19. Interaction replay
20. Drag-and-drop capture

### B. Interaction gaps
1. No drag-and-drop (only click, type, select, press)
2. No multi-touch/gesture simulation
3. No iframe interaction
4. No shadow DOM traversal
5. No file download verification
6. No clipboard read/write
7. No geolocation emulation
8. No network throttling
9. No device emulation beyond viewport
10. No permission emulation

### C. Content capture gaps
1. No text extraction from canvas
2. No WebGL content capture
3. No SVG content extraction
4. No iframe content capture
5. No shadow DOM content capture
6. No web component content capture

### D. Performance & profiling gaps
1. No FPS measurement
2. No paint timing
3. No layout shift measurement (CLS)
4. No memory profiling
5. No CPU profiling
6. No network waterfall
7. No render performance
8. No bundle size analysis

### E. Accessibility gaps
1. No accessibility audit (WCAG)
2. No screen reader simulation
3. No focus order verification
4. No ARIA validation
5. No color blindness simulation
6. No reduced motion testing

### F. Developer experience gaps
1. No test recording
2. No test replay
3. No test generation
4. No visual regression
5. No snapshot diffing over time
6. No performance baseline
7. No flaky test detection
8. No parallel execution

## What Probe already does well (don't break these)

(See CONTEXT_BUNDLE.md section 4 for the full list of 35 capabilities.)

## Issues found during use

1. No screen recording — the #1 missing feature
2. Screenshot is "VISION FALLBACK ONLY" — discouraged but it's the only way to see visual output
3. No hover state capture — hover auto-diffs but doesn't screenshot
4. No full-page screenshot — only viewport or element
5. No element screenshot with context
6. No screenshot comparison
7. No screenshot annotation
8. No canvas content extraction
9. No WebGL content capture
10. No iframe content capture
11. No shadow DOM content capture
12. No network throttling
13. No device emulation
14. No permission emulation
15. No clipboard
16. No file download verification
17. No drag-and-drop
18. No multi-touch
19. No geolocation
20. No PDF generation

## The goal

Make Probe 100x better than Playwright MCP by adding:
1. Screen recording — capture animated content as video
2. Visual diffing — compare screenshots over time
3. Canvas/WebGL capture — extract rendered content
4. Interaction recording — record and replay user actions
5. Performance profiling — FPS, paint timing, memory
6. Accessibility audit — WCAG compliance check
7. Device emulation — full device profiles
8. Network throttling — simulate slow connections
9. Test generation — generate test code from interactions
10. Parallel execution — run multiple tests concurrently

The key differentiator: Probe is CDP-based, assertion-first, and token-efficient.
Playwright MCP streams full accessibility trees + screenshot bytes (114K tokens per test).
Probe should stay under 27K tokens per test while providing MORE capability.

## Context

The full context bundle is in `CONTEXT_BUNDLE.md` in this same folder. Read it
before answering. It contains the complete tool surface, gap analysis, what Probe
already does well, and the constraints.<|end|>