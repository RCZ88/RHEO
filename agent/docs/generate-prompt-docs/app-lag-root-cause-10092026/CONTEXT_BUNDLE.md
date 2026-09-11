# CONTEXT BUNDLE — App lag root-cause research (background vs. something else)

Task: determine whether the persistent lag comes from the Ferrofluid background or from elsewhere.
Docs folder: `agent/docs/generate-prompt-docs/app-lag-root-cause-10092026/`
Codebase root (Windows): `C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\`

## 1. History — what was already tried (all verified in built bundles)

1. Ferrofluid fullscreen WebGL background added as app background → lag appeared. Previous background (2× Particles + LightRays) did NOT lag.
2. PERF-FIX round 1 (`src/components/Ferrofluid.tsx` + `AppBackground.tsx`): DPR capped at 1, antialias off, `sin()` smoothing → hermite curve, noise 5-tap → 4-tap, hidden-tab render shutoff, 30fps idle / 60fps post-input gating, per-move synthetic PointerEvent replaced with O(1) ref-handle pointer write. Verified in bundle (`hermite` + `4-tap` markers present, old shader strings absent). → Still lagged.
3. PERF-FIX round 2 (`Ferrofluid.tsx` only): half-res backing store (CSS upscale), full rAF stop after 8s idle (static frame, resumes on pointer input). Verified in bundle (`RENDER_SCALE`, `IDLE_FREEZE_MS` markers present, build exit 0). → STILL lags.
4. Conclusion so far: two rounds of fill-rate/ALU/scheduling cuts did not fix it. Either the background is innocent, or the cost is somewhere the shader work never touched (compositing, CPU-side churn, software GL).

## 2. Hard measurements (taken on the live machine, not guessed)

- Window: RHEO Electron window open at **2048×1280**, animating (two screenshots 1s apart: **12.9% of pixels changed**, full-window bbox) — the fluid visibly moves, clock ticks.
- Served bundle = latest dist bundle = contains all fixes (markers confirmed post-build).
- Process map for the app: main process + 5 zygotes + 1 network utility. **NO `--type=renderer`, NO `--type=gpu-process`** — while sibling Chromium apps on the same box (Obsidian, VS Code, Discord) all have gpu-process children with `--render-node-override=/dev/dri/renderD128`.
- Main process CPU: **12–15% sustained**. No `/dev/dri` handle anywhere in the app's process tree.
- Hardware exists: Intel Meteor Lake-P Arc iGPU + NVIDIA RTX 4050 Mobile, `/dev/dri` has card0/card1/renderD128/renderD129.
- Launch: `electron --ozone-platform=x11 --user-data-dir=...` — no `--render-node-override`, no GPU flags in `src/main.ts` (grep for appendSwitch/disable-gpu/single-process: zero hits).
- Screenshot anomaly (possibly unrelated): several dashboard cards render as **blank gray boxes** (stat tiles empty, one large panel empty) while "Recent Projects" card has content. Unknown if loading state, data bug, or render thrash.

## 3. Suspect inventory (exact code locations)

### S-1. Background canvas (weakened but not cleared)
- `src/components/AppBackground.tsx`: fixed `inset-0 z-[0]` canvas behind all routes, always mounted, `bg-black/60` overlay above it.
- `src/components/Ferrofluid.tsx`: ogl WebGL, now half-res + idle-frozen + 30fps-gated. If lag persists while the canvas is frozen (no pointer for 8s+), the canvas is NOT the per-frame cost — but its layer may still force full-screen re-composites.
- Untaken lever (flagged, needs user yes): glass `backdrop-filter: blur(20px)` over the repainting canvas (`R-5` in previous RESULT).

### S-2. Per-second full-App re-renders (strong suspect)
`src/App.tsx` (3542 lines) runs ALL of these simultaneously:
- 1s tracking timer (~line 1940–1970): `setElapsedTime(prev => prev + 1)` every second while tracking → re-renders the entire App tree 1×/s.
- 1s localStorage polls with `JSON.stringify` comparisons: `setInterval(reloadOverrides, 1000)` (~line 1158), `setInterval(reloadTiers, 1000)` (~line 1379).
- 5s browser-tracking refresh (~line 813), 30s refresh (~line 735), 60s gap check (~line 839), 2.5s auto-detect poll (~line 1740).
- Heavy providers wrap everything: `<VoiceProvider><TutorialProvider>` + TitleBar + Sidebar + AnimatePresence route transitions + Chart.js canvases + framer-motion throughout.

### S-3. Other rAF loops (12 files besides Ferrofluid)
`grep -rln requestAnimationFrame src/`: `ai/canvas/CanvasGrid.tsx`, `ai/chat/TypewriterText.tsx`, `ai/deck/AiPageDeck.tsx`, `dashboard/MomentumOrb.tsx`, `finance/FinanceLockScreen.tsx`, `finance/FinanceStickyHeader.tsx`, `finance/modals/useFormattedAmount.ts`, `insights/FocusEmber.tsx`, `learn/SelectionActions.tsx`, + 3 more. Any of these mounted on the lagging route adds its own always-on loop.

### S-4. Main-process churn
`src/main.ts` intervals: foreground poll (`trackingInterval = setInterval(pollForeground, pollInterval)` ~line 6627), heartbeat (~5774), sync (~4578), terminal stats every 3s (~13459), backup schedulers, AI contextScheduler workers (60s extraction, 30min embedding catch-up). Main at 12–15% CPU with no window interaction is itself worth explaining.

### S-5. Software rendering (environmental, affects everything)
No gpu-process + no DRI handle + X11 + lag surviving 7–16× shader cuts = WebGL/compositing likely on SwiftShader/llvmpipe CPU. If true, EVERY pixel effect (background, blur, charts) is CPU-bound and no shader tweak fully fixes it — the fix would be enabling the GPU (`--render-node-override=/dev/dri/renderD128`, matching sibling apps) or eliminating per-frame pixels.

## 4. Decisive isolation experiments (already possible, not yet run)
- E1: comment out `<AppBackground />` (one line, `src/App.tsx` ~2663), rebuild, feel-check → background guilty/innocent, binary answer.
- E2: minimize/restore + hidden-tab GPU observation → scheduling honored?
- E3: per-process CPU attribution (main vs renderer/gpu) during lag vs idle.
- E4: route-by-route feel check (`/terminal` hides sidebar; dashboard vs settings) → route-scoped loops?
- E5: DevTools Performance profile 10s → top JS frames (React re-render vs raster vs GPU).
- E6: launch with `--render-node-override=/dev/dri/renderD128` → gpu-process appears? lag changes?

## 5. Build / verify facts
- Build: `node scripts/build.mjs` (exit 0 last two runs). Renderer bundle: `dist/assets/index.*.js` (hash changes per build).
- Typecheck: `npx tsc --noEmit --project tsconfig.app.json` has ~7000 pre-existing errors — NOT a usable gate; esbuild parse + successful build are the gates.
- Never run destructive git commands. Backups live in `agent/backups/<timestamp>-<desc>-pre/`.
