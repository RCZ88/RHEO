# CONTEXT BUNDLE — Probe MCP Revamp

## 1. What Probe MCP is

Probe is a CDP (Chrome DevTools Protocol) based testing MCP server. It drives
applications through CDP instead of screenshots: reads the live DOM, computed
styles, geometry, console output, runtime errors, network traffic, and IPC.
It exposes assertion-first tools that return small PASS/FAIL verdicts.

**Location:** `/home/clementzhao/dev/probe/`
**Version:** 0.1.0 (from package.json)
**Dependencies:** zero (Node 22+ built-in WebSocket/fetch/http)
**Dev deps:** typescript, tsx, @types/node
**Transport:** stdio (default) or Streamable HTTP
**Source:** 11 files in `src/` (index.ts, agent.ts, cdp/*, mcp/*, probe/*, tools/*)

## 2. Current tool surface (37 tools)

### Core lifecycle
- `open` — launch or attach to Electron/Chromium
- `close` — close session, kill instance
- `discover` — find running Electron/Chromium instances
- `mark` — return sequence numbers for scoping
- `start_run` — declare test plan checklist
- `report` — emit CI-ready report (JSON/JUnit)
- `read_ledger` — full run history

### Navigation & interaction
- `goto` — navigate to URL
- `snapshot` — bounded semantic snapshot with @e# refs
- `click` — click by ref, hit-tests, auto-diffs
- `hover` — hover by ref, CDP mouse move + synthetic pointerenter
- `type` — type text into input (native value setter for controlled inputs)
- `press` — press keyboard key via CDP
- `select` — set `<select>` dropdown value
- `query` — resolve selector to ref + role/name/box
- `wait_for` — poll until condition (selector/text/ref/expression/console/ipc)
- `wait_for_server` — poll URL until dev server answers

### Assertions
- `assert_visible` — element visible
- `assert_text` — text equals/contains/matches
- `assert_layout` — geometry within tolerance
- `assert_style` — computed CSS property
- `assert_contrast` — WCAG contrast ratio
- `assert_responsive` — re-check across breakpoints
- `assert_animating` — element actively animating
- `assert_expect` — in-app expectation checkpoint
- `assert_ipc` — IPC message fired recently
- `assert_api` — specific API call happened
- `assert_no_errors` — no console/main/network errors
- `assert_no_failed_requests` — no 4xx/5xx/failed requests
- `assert_no_console_errors` — (legacy, replaced by assert_no_errors)

### Reading / diagnosis
- `read_console` — renderer or main process console
- `read_network` — network requests list
- `read_file` — read file from disk
- `read_db` — query SQLite from main process
- `read_expectations` — in-app expectation checkpoints
- `eval` — evaluate JS expression (page or main)

### Other
- `set_viewport` — override viewport size
- `screenshot` — "VISION FALLBACK ONLY" — PNG capture
- `browser_run_code_unsafe` — run arbitrary Playwright code (RCE-equivalent)

## 3. What's missing — the full gap analysis

### A. Screen recording / capture (HIGHEST PRIORITY — user's #1 ask)

Probe has NO screen recording capability. It only takes static screenshots. For a
testing MCP that needs to verify visual behavior, this is a critical gap.

**Missing:**
1. **Video/screen recording** — capture a sequence of frames as video (webm/mp4)
2. **Animated content capture** — record CSS animations, transitions, motion
3. **Scroll sequence capture** — capture the page at multiple scroll positions as a
   single scrollable image or video
4. **Hover state capture** — screenshot with hover active (hover tool auto-diffs but
   doesn't screenshot)
5. **Focus state capture** — screenshot with focus state active
6. **Multi-viewport comparison** — capture at 375px, 768px, 1280px in one call
7. **Dark/light mode side-by-side** — capture both themes in one call
8. **Element screenshot with padding** — capture element + surrounding context
9. **Full page screenshot with scroll position** — capture at specific scroll Y
10. **Screenshot during animation** — capture at a specific animation frame
11. **Screenshot comparison** — diff two screenshots (visual regression)
12. **Canvas/WebGL content extraction** — extract canvas pixels as image
13. **PDF generation** — capture page as PDF
14. **Video playback control** — play/pause/seek video elements and capture frames
15. **Audio capture** — capture audio output
16. **OCR/text extraction from canvas** — read text rendered on canvas
17. **Screenshot with element highlight** — overlay bounding box on screenshot
18. **Screenshot with annotations** — draw arrows/labels on screenshot
19. **Timelapse capture** — capture at intervals over time
20. **Interaction replay** — record a sequence of actions and replay them

### B. Interaction gaps

1. **No drag-and-drop** — only click, type, select, press. No `drag` or `drop`.
2. **No multi-touch/gesture simulation** — no pinch, swipe, pan
3. **No iframe interaction** — can't interact with content inside iframes
4. **No shadow DOM traversal** — shadow roots not traversed in snapshot
5. **No file download verification** — can't verify downloads happened
6. **No clipboard read/write** — can't test copy/paste
7. **No geolocation emulation** — can't test location-based features
8. **No network throttling** — can't simulate slow connections
9. **No device emulation beyond viewport** — no user-agent, no touch emulation
10. **No permission emulation** — can't grant/deny camera, mic, notifications

### C. Content capture gaps

1. **No text extraction from canvas** — canvas text is invisible to DOM snapshots
2. **No WebGL content capture** — WebGL renders are invisible
3. **No SVG content extraction** — SVG internals not captured
4. **No iframe content capture** — iframe content not captured
5. **No shadow DOM content capture** — shadow roots not captured
6. **No web component content capture** — custom elements not expanded

### D. Performance & profiling gaps

1. **No FPS measurement** — can't measure frame rate
2. **No paint timing** — can't measure paint performance
3. **No layout shift measurement** — CLS not measured
4. **No memory profiling** — can't track memory usage
5. **No CPU profiling** — can't profile CPU usage
6. **No network waterfall** — no timing breakdown per request
7. **No render performance** — can't measure render time
8. **No bundle size analysis** — can't analyze bundle

### E. Accessibility gaps

1. **No accessibility audit** — no WCAG compliance check
2. **No screen reader simulation** — can't test screen reader experience
3. **No focus order verification** — can't verify tab order
4. **No ARIA validation** — can't check ARIA correctness
5. **No color blindness simulation** — can't test color accessibility
6. **No reduced motion testing** — can't verify reduced motion behavior

### F. Developer experience gaps

1. **No test recording** — can't record a sequence of actions as a test
2. **No test replay** — can't replay recorded actions
3. **No test generation** — can't generate test code from interactions
4. **No visual regression** — can't compare screenshots over time
5. **No snapshot diffing** — can't diff DOM snapshots over time
6. **No performance baseline** — can't establish performance baselines
7. **No flaky test detection** — can't detect flaky tests
8. **No parallel execution** — can't run multiple tests in parallel

### G. Issues found during use

1. **No screen recording** — the #1 missing feature. Playwright MCP also lacks this,
   but it's the most requested feature for visual verification.
2. **Screenshot is "VISION FALLBACK ONLY"** — discouraged in tool description, but it's
   the only way to see visual output. Should be a first-class tool.
3. **No hover state capture** — `hover` auto-diffs but doesn't screenshot. Can't see
   what the hover revealed.
4. **No full-page screenshot** — only viewport or element. Can't capture the whole page.
5. **No element screenshot with context** — element screenshots are tightly cropped.
6. **No screenshot comparison** — can't diff two screenshots.
7. **No screenshot annotation** — can't draw on screenshots.
8. **No canvas content extraction** — canvas is invisible to DOM snapshots.
9. **No WebGL content capture** — WebGL renders are invisible.
10. **No iframe content capture** — iframe content not captured.
11. **No shadow DOM content capture** — shadow roots not captured.
12. **No network throttling** — can't simulate slow connections.
13. **No device emulation** — no user-agent, no touch emulation.
14. **No permission emulation** — can't grant/deny camera, mic, notifications.
15. **No clipboard** — can't test copy/paste.
16. **No file download verification** — can't verify downloads.
17. **No drag-and-drop** — only click, type, select, press.
18. **No multi-touch** — no pinch, swipe, pan.
19. **No geolocation** — can't test location-based features.
20. **No PDF generation** — can't capture page as PDF.

## 4. What Probe already does well (don't break these)

1. **Assertion-first** — returns PASS/FAIL verdicts, not raw data
2. **Stable @e# refs** — persist across re-renders
3. **CDP-based** — sees network, console, IPC, DOM internals
4. **Electron support** — renderer + main process + IPC
5. **Zero dependencies** — Node 22+ built-in APIs only
6. **Token-efficient** — bounded outputs, diff snapshots, toFile artifacts
7. **Run ledger** — tracks every step, surfaces `next`
8. **CI-ready** — start_run checklist, report (JSON/JUnit)
9. **Reduced motion** — assert_animating checks real animation state
10. **Read DB** — query SQLite from main process
11. **Read file** — read files from disk
12. **Read network** — network requests with filtering
13. **Wait for server** — poll until dev server ready
14. **Assert API** — verify specific API calls
15. **Assert no failed requests** — catch backend failures
16. **Assert IPC** — verify IPC messages
17. **Assert expect** — in-app expectation checkpoints
18. **Set viewport** — responsive testing
19. **Query** — resolve selectors to refs
20. **Hover** — real CDP mouse move + synthetic pointerenter
21. **Type** — native value setter for controlled inputs
22. **Press** — real keyboard events
23. **Select** — set dropdown value
24. **Eval** — escape hatch for JS evaluation
25. **Read console** — renderer or main process
26. **Read ledger** — full run history
27. **Mark** — sequence numbers for scoping
28. **Discover** — find running Electron instances
29. **Open** — launch or attach (with userDataDir for real data)
30. **Close** — close session, kill instance
31. **Screenshot** — PNG capture (vision fallback)
32. **Browser tabs** — list/create/close/select tabs
33. **Browser run code unsafe** — run arbitrary Playwright code
34. **Snapshot** — bounded semantic snapshot
35. **Report** — CI-ready report

## 5. The goal

Make Probe 100x better than Playwright MCP by adding:
1. **Screen recording** — capture animated content as video
2. **Visual diffing** — compare screenshots over time
3. **Canvas/WebGL capture** — extract rendered content from canvas
4. **Interaction recording** — record and replay user actions
5. **Performance profiling** — FPS, paint timing, memory
6. **Accessibility audit** — WCAG compliance check
7. **Device emulation** — full device profiles
8. **Network throttling** — simulate slow connections
9. **Test generation** — generate test code from interactions
10. **Parallel execution** — run multiple tests concurrently

The key differentiator: Probe is CDP-based, assertion-first, and token-efficient.
Playwright MCP streams full accessibility trees + screenshot bytes (114K tokens per test).
Probe should stay under 27K tokens per test while providing MORE capability.

## 6. How to use this bundle

1. Run `prompt-copy get probe-mcp-revamp` to copy the prompt + context to clipboard
2. Paste into the external AI (ChatGPT/Claude)
3. The AI will produce a plan for making Probe 100x better
4. The plan comes back as a RESULT.md
5. Implement the plan in `/home/clementzhao/dev/probe/`
6. Build and test with `npm run selftest` and `npm run build`