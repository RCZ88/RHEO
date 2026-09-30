# °Å¸“â¹ Feature Tracker

**Purpose:** Complete inventory of every page and feature in DeskFlow app.

**Last Updated:** 2026-08-22

## 2026-08-23  File Locking & Conflict Prevention System (PLANNED)
- **User demand:** Parallel agents editing same file causes corruption. No pre-edit locking, no persistence, no git protection, no build mutex.
- **Spec:** gent/docs/generate-prompt-docs/file-locking-system-22082026/PROMPT.md
- **Bugs found:** Post-hoc locks (cosmetic), in-memory only (lost on restart), TTL mismatch (3 values), session_context column missing, no pre-edit locking, no git protection, no build mutex, touched_files unbounded
- **Being built:** 8 tasks (A-H)  pre-edit locking, DB persistence, TTL config, session_context column, git auto-commit, build mutex, touched_files cleanup, preload bridges
- **Status:** PLANNED

## 2026-08-22  Context System Full Fix (PLANNED)
- **User demand:** Context system is completely broken. Every subsystem has identifiable bugs.
- **Spec:** gent/docs/generate-prompt-docs/context-system-fix-22082026/PROMPT.md
- **Bugs found:** memoryRetrieval empty threadDate, agent_memories 0 rows, entity extraction 46/47 failed, budget starvation, ContextService.ts dead code, state.md not injected, episode writers skip extraction, brain retrieval returns nothing for generic topics
- **Being built:** 8 tasks (A-H) fixing all broken subsystems
- **Status:** PLANNED

## 2026-08-22  Cross-Session Context Awareness (PLANNED)
- **User demand:** Sessions blind to each other. /sync manual. No auto-injection. No real-time activity stream.
- **Spec:** gent/docs/generate-prompt-docs/cross-session-context-22082026/PROMPT.md
- **What exists:** /sync command, context-changed events, file conflict detection, touched files, crossSessionSyncEnabled toggle
- **Being built:** Auto-injection in assemble-context, real-time activity stream, auto-sync on session start, SessionActivityFeed UI, message history sharing, ContextSidebar toggle
- **Status:** PLANNED

## 2026-08-22  Per-Page Context System (IMPLEMENTED)
- **Spec:** gent/docs/generate-prompt-docs/page-context-system-22082026/PROMPT.md
- **Built:** pageContextRegistry.ts, assemble-context page block, get-page-context + notify-page-change IPC, App.tsx page detection, TerminalPage listener, ContextSidebar page tab, system prompt extension
- **Status:** IMPLEMENTED  all builds pass

## 2026-08-22  Auto-Assign Session Routing (ALREADY EXISTS)
- **Status:** FULLY IMPLEMENTED in codebase (route-prompt, RoutingToast, RoutingDisambiguationDialog, Configs tab)

## 2026-08-18  AI Chat Organizer & Context Loop via extension (PENDING)

## 2026-08-18 — AI Chat Organizer & Context Loop via extension (opencode-term-1-aivault, PENDING external AI RESULT.md)
- **User demand (verbatim transcript, voice):** many AI tools, messy; "can't modify AI tools internally" â build the organization layer in the extension instead; auto-capture has limits â manual capture (paste link / save current chat); sessions taggable by roles/groups with notes/nicknames so chats are findable without memorizing titles/links or scrolling huge prompts; want to see contents (current title-only viewer insufficient); context management + visualization; two-way context transfer: app â extension â external AI — copy captured content back INTO the AI chat itself (e.g. "remember this" / context injection into the chat input)
- **Package (created 2026-08-18):** `agent/docs/generate-prompt-docs/ai-chat-organizer-context-loop-18082026/` — PROMPT.md (mandate: Lead Designer AND Engineer â RESULT.md; Engineering A = extension manual capture: popup "Save this chat" + "Add link" â POST /ai-context source='manual'; Engineering B = org schema: ai_context_captures + nickname/note/tags/group_id/pinned/is_manual + new ai_context_groups table + IPC update/groups + preload + types; Engineering C = Viewer v3 org UI; Engineering D = two-way context loop: viewer "Send to AI" â copy transcript / open chat / extension injects into chat input via chrome.runtime message, extension â app manual capture; Design task = popup org section + viewer v3 glass cards all 4 states; constraints: MV3, MAIN-world capture intact, dedup preserved, no new deps) + CONTEXT_BUNDLE.md (self-contained: full verbatim extension source = manifest.json + popup.html + popup.js + ai-context-content.js 343 lines + focusOverlay.js + background.js ai-context relay + DB schema; main.ts ai-context handlers verbatim main.ts:7642-7710; preload.ts:132-138 bridges + deskflow-api.d.ts:221-227 types; full AiContextPanel.tsx 485 lines; design tokens; RESULT.md format)
- **NOT implemented yet** — implementation begins only after the external AI's RESULT.md arrives

## 2026-08-17 — Content Engine v2.0.0 FULLY IMPLEMENTED (opencode-term-1-ceng): backend + all 5 UI phases
- **Backend:** rubric.ts v2.0.0 (14 criteria, 10 non-negotiable, auto-reject rule), scoringSchemes.ts (3 schemes A/B/C with weights summing to 1.00), prompts.ts (contentEngineSystem + 17 prompts), index.ts (5 new tables, 13+ new IPC handlers, logEvent helper, buildScriptInput, lessonConfirm auto-promotion â¥0.8, process:gallery).
- **Phase 2 UI:** ScriptProofCard (per-bullet retention proof: criteria chips, mechanism, evidence quotes, score bars, accept/reject/regenerate, rejected state with rose border), EpisodeScoreSummary (weighted breakdown per criterion, NN check, scheme info).
- **Phase 3 UI:** ReflectionPanel (human intuition: textarea, AI analysis, characteristics/intuitions/contradictions/format_fit), ProcessTimelineView (chronological events with 14 color-coded types), ProcessGalleryView (growth gallery grid with trend summary), Process tab added to workspace.
- **Phase 4-5 UI:** AnalyticsImportModal (3-step pasteâAI parseâconfirm), CalibrationView (accuracy ring + per-criterion bars + recommendations), ProcessSummaryCard (AI narrative), AnalyticsView updated with dual-layer (objective + human reflection) + import button + calibration section.
- **ContentEngineWorkspace:** 8 tabs (Brainstorm, Ideas, Episodes, Themes, Analytics, Lessons, Frameworks, Process).
- **10 new files created, 3 existing files enhanced. Build gates all pass.**
- **Runtime:** NOT LAUNCHED (no app with debug port). IPC channel names differ slightly from RESULT.md spec but are functionally equivalent.

## 2026-08-16 — Life page: Living Substrate full-bleed in the river system + Self tab care redesign (opencode-term-1-rdlife, PENDING external AI RESULT.md)
- **User demand (verbatim):** "WHERE'S THE ART WHERE'S THE BEAUTY" / "HOW IS IT NOT INCLUDED IN THE RIVER SYSTEM" / "FIX THE FUCKING DESIGN ON THE SELF PAGE FIRST" / "cards fonts and everything not displayed and not made with care and love" — plus the explicit clarification that jasonwebb/reaction-diffusion-playground is REFERENCE ONLY, not a mandated repo
- **Package (created 2026-08-16):** `agent/docs/generate-prompt-docs/life-page-living-art-self-16082026/` — PROMPT.md (mandate + Engineering A/B + Design + UX tasks + MCP inventory + anti-slop + constraints + RESULT.md format) + CONTEXT_BUNDLE.md (self-contained: env facts, tokens, 7 design skills, full verbatim LivingSubstrate.tsx + rd-simulation.glsl + rd-display.glsl + CoreSample stage + LifePage river/self blocks + the three Self-view heads + clash summary; backend audit = UI-only, no IPC changes)
- **Spec asks (once RESULT.md returns):** (A) ONE full-bleed substrate behind the river view (z-map: vital thread z-0, left col z-[5], feed z-10) with legibility vignette; remove CoreSample's trapped instance; optional calmer instance behind pages-mode Self tab; shader evolution allowed (spatial growth modifier, drift, full-bleed ramp ~0.6–0.75 alpha, keep premultiplied+Additive+toneMapped:false, GLSL1 only). (B) Self tab: unified page identity (hero + stats strip via brainStats), ONE card system (glass, rounded-xl, p-5), accent reconciliation (violet #8b5cf6 family; reconcile ProfileTab amber-ish / Graph cyan #06b6d4 / Brain purple #a855f7), SectionHeader usage, all 4 states unified, do NOT rewrite the three views' logic
- **NOT implemented yet** — implementation begins only after the external AI's RESULT.md arrives; then build gates + CZ relaunch of RHEO.exe (stale-app rule applies)

## 2026-08-16 - Reaction-Diffusion "Living Substrate" on Life page (opencode-term-1-rdlife, RESULT.md reaction-diffusion-life-16082026)
- **Feature:** Gray-Scott reaction-diffusion ambient "living substrate" backdrop inside the CoreSample ring stage on the Life page — deep amber organic coral glow behind the RingCanvas rings (petri-dish metaphor)
- **Surface map (from RESULT.md):** HERO = CoreSample stage backdrop at z-0 (RingCanvas bumped to z-10); full-page background SKIPPED; PhaseCards/RiverMap REJECTED (GPU contexts + readability)
- **Architecture:** R3F `<Canvas orthographic gl={{alpha:true, antialias:false}}>`, ping-pong pair of `WebGLRenderTarget` (FloatType, NearestFilter), 256x256 buffer (384 when devicePixelRatio > 1.5), 2 simulation passes per display frame, display pass maps B-chemical through a hardcoded premultiplied-alpha amber ramp (B=0 â #09090b/a0, B=0.5 â #b45309/a0.15, B=1 â #fbbf24/a0.40), coral preset f=0.0545/k=0.062/dA=1.0/dB=0.5, 14 random circular B-gradient seeds
- **Perf/a11y:** paused on `document.hidden`, unmounts entirely on `prefers-reduced-motion`, wrapped in error boundary â renders null â existing radial-gradient amber glow in CoreSample stays as graceful fallback
- **Files:** NEW `src/shaders/rd-simulation.glsl` (stripped of mousePosition/brushRadius/styleMap*, 5-point Laplacian setWeights(2)), NEW `src/shaders/rd-display.glsl` (no renderingStyle branches), NEW `src/shaders/glsl.d.ts` (`?raw` types), NEW `src/components/life-river/LivingSubstrate.tsx` (v1.0 console stamp), MODIFIED `src/components/life-river/CoreSample.tsx` (LivingSubstrate at z-0, RingCanvas wrapper z-10)
- **Build:** vite OK (LifePage.BJRdEuAb.js 898KB; shader/component markers present in chunk), preload.cjs 105KB, main.cjs 1.38MB, tsc clean (only pre-existing aiAgentService.test.ts errors); audit vs RESULT.md = zero omission; NOT LAUNCHED (RHEO running since ~22:26 WITHOUT --remote-debugging-port — CZ must relaunch to see it)

## 2026-08-16 - AFK popup shows all of today's unfilled gaps (MissedTimePanel)
- **Feature:** When the AFK detection popup appears, it now also shows ALL unfilled gaps for that day (not just the AFK span): a "Missed time today" panel with a day-strip hero (00:00 â now) where tracked time is a subtle gradient bar and each unfilled gap is an eroding "void" segment (dark + amber edges + slow marching stripes, transform-only animation, 10s linear), with mono time ticks and "now" at the right edge
- **Focal stat:** count-up % tracked (useSpring, reduced-motion aware, gradient amberârose text) + "X gaps missed" chip (CalendarX2) + total missing duration chip (Hourglass) + "Y% of your day is unaccounted for" subline
- **Actions:** "Fill gaps now" (indigo â clears AFK entry + opens the app-wide smart GapFillDrawer via open-gap-drawer event) and "Later" (collapses panel; slim amber reminder bar with Show). Loading = pulse skeleton; zero gaps = emerald "Nothing missed today"
- **Files:** new `src/components/MissedTimePanel.tsx` (v1.0, fetches `detectUsageGaps({period:'today', minGapMinutes:5})`, refreshes on external-data-changed + 60s interval); `AfkPromptModal` gained `children?: React.ReactNode` slot rendered before the Action Bar; App.tsx passes the panel into the AFK modal (~line 3355)
- **Metric:** % computed against the ELAPSED day (00:00 â now), never full 24h — future time isn't "missing". Backend already treats logs + external sessions + manual_time_assignments as coverage (detect-usage-gaps, main.ts ~20972)
- **Build:** vite OK (entry index.DXNM5nU5.js), preload.cjs 105KB, main.cjs 1.38MB, tsc clean (only pre-existing aiAgentService.test.ts errors); markers in compiled bundle; NOT LAUNCHED (no CDP port on running instance)

## 2026-08-16 — Manual time-assignment (External page) + hardening round (opencode-term-1-manual)

- **Feature:** User selects time spans on the External page timeline and assigns recorded durations to specific hours (random scatter OR custom painted blocks), so the timeline looks realistic. Entry points: ExternalPage header "Manual time" button (opens ManualAssignModal, resets manualAssignGap/date) and GapsListModal "Time" button per gap (`onAssignTime(gap)`).
- **Backend:** `manual_time_assignments` table (main.ts ~2810, index ~2820); IPC `manual-assign:list` (21110) / `day-context` (21124, returns `{tracked, manual}` with local-midnight day window) / `create` (21156, validates overlap against tracked logs AND existing manual rows; stores local date in `date`, ISO in `started_at`) / `delete` (~21187+); `syncManualStats` (21068) mirrors totals into daily aggregates (pseudo-app "Manual time"); `detect-usage-gaps` includes manual rows (20986, 21050) so assigned time never becomes a gap.
- **Preload/types:** `manualAssignList`/`manualAssignDayContext`/`manualAssignCreate`/`manualAssignDelete` (preload.ts 654–657); `ManualAssignment` interface + 4 API methods (deskflow-api.d.ts 481–484, 515).
- **Lib:** `src/lib/external/manualTime.ts` — `freeSpans` (min 30 min), `scatterChunks` (capacity clamp to max free fill, min 15 min/chunk, exact-remainder path, [] when nothing fits), `splitDurations`, `intervalsOverlap`.
- **Hardening round (this cycle):** (1) scatterChunks round-overflow bug — real log timestamps are SECOND-aligned so `Math.round(maxStart/MS_MIN)` could overshoot the slot by ~1 min â backend overlap rejection; fixed with floor-based whole-minute pick. (2) modal `free`/`isCellFree`/`runPreview` now treat existing MANUAL assignments as occupied (custom paint could overlap manual â partial save). (3) capacity warning + "No free space" empty-state messages (`previewNotice`). (4) stale preview cleared on input change. (5) Escape-to-close (deferred while delete-confirm dialog open). (6) "Today" shortcut in day picker. (7) delete now confirms via CustomConfirmDialog (danger variant; no one-click destructive; tracked time untouched). (8) fixed partial-failure bug — success message no longer overwrites real errors; day context refreshes, preview clears, failing block shown in error. (9) copy fixed ("of your recorded duration" â user-typed total).
- **Verified:** precision harness (second-level slots: 3000 trials 0 overlaps; capacity clamp; exact remainder; fully-occupied â []) + 500-trial loop all pass. Build: vite OK (bundle index.BzCOLPW5.js), preload.cjs 103 KB, main.cjs 1.38 MB; markers confirmed in compiled bundle; dist/index.html valid; NOT LAUNCHED (DeskFlow not running; only YAP-A-TrON electron processes present — not ours, untouched).

## 2026-08-16 - Sleep Adjacent Gap Fill (untracked time around sleep)
- **Feature:** After confirming sleep, the sleep modal offers to fill untracked device time right before falling asleep / after waking (2-step flow: sleep -> gaps)
- **Backend:** `detectAdjacentSleepGaps` (main.ts ~21327) merges logs + external_sessions over 48h lookback, finds the merged gap overlapping the sleep window, splits pre-sleep (`relation: 'before'`) and post-sleep (`relation: 'after'`) portions >= 5 min; returned as `adjacentGaps` in the `check-sleep-detection` IPC response
- **SleepDetectionModal:** new optional props `adjacentGaps` / `step: 'sleep' | 'gaps'` / `onOpenGapFill` / `onDone`; early-return `step === 'gaps'` view (emerald "Sleep saved" header, gap rows with Sunset/Sunrise icons, Fill gaps / Done buttons); amber info banner in sleep step listing adjacent gaps; version stamp v1.1
- **GapFillModal:** new optional `zClass` prop (default "z-50") so the sleep flow can layer it above other modals (App.tsx renders it at z-[10000])
- **App.tsx wiring:** `sleepModalStep` state, `sleepGapFill` (Gap[]) + activities/sessions states, confirm handler switches to gaps step (returns early, no dismiss — sleep already saved), `handleOpenSleepGapFill` builds Gap[] via `createId`, fill via `fillGapWithSegments` + `addExternalTime`, dispatches external-data-changed
- **Build:** vite build OK, preload.cjs + main.cjs rebuilt, tsc clean (only pre-existing aiAgentService.test.ts errors); NOT LAUNCHED (no CDP port on running instance)

## 2026-08-12 — Clement Overlay Studio (Video Intelligence)
- **Route:** /studio (Sparkles icon, 'Overlay Studio')
- **Full spec:** agent/docs/clement-overlay-studio-context.md (all3 versions)
- **Pipeline:** video â ffmpeg â faster-whisper â transcript.json â Ollama â cut_plan.json â human approve â ffmpeg lossless cut â kept segments â Ollama â scene_dsl.json â renderer dispatch â cards/diagrams/timeline.json
- **Built:** overlayStudio.ts (types/tokens), overlayPrompts.ts (3 prompts), overlayParser.ts (parse pipeline), IPC handler, preload wrapper
- **Not built:** 4-tab page rewrite, transcript upload UI, cut plan timeline, scene DSL preview, Manual Bridge wizard, Python backend, renderer registry
- **Manual Bridge:** copy prompt â paste into any web AI â paste back â app validates + repairs

## 2026-08-12 — Feature Studio AI Director Pipeline
- **Route:** /studio (App.tsx sidebar, Sparkles icon)
- **Prompt Engine:** Director system prompt constrains AI to DynamicUIComponent JSON schema (7 renderable types: card/chart/list/form/stat/table/timeline)
- **AI Provider Chain:** feature-studio:compile IPC handler runs buildChain + runWithFallback in main process; renderer calls via featureStudioCompile(script)
- **JSON Extraction:** extractJsonFromAIResponse handles direct parse + \\\json fences + brace-matching fallback
- **Validation:** validateDirectorOutput checks type/title/data.kind/accent/size per component with strict error messages
- **Rendering:** DynamicCardRenderer handles all 7 types with charts, sparklines, tables, timelines, lists, forms, stats
- **Modes:** AI Generate (script â IPC â parse â render) and Manual JSON (paste â validate â render)
- **Export:** JSON file download + save to AI canvas component library

## 2026-08-12 — AI Canvas Setup Context System (RESULT.md R1–R5, opencode-term-1-setup cycle 3)
- **R1 Default Canvas Setup:** DefaultSetupConfig in types/canvas.ts, DefaultSetupDialog (LayoutTemplate, z-220), clearAll seeds from setup + canvasEpoch; New Canvas blank bug FIXED
- **R2/R4 Card UX:** shared CardFrame + StateView (4 states each), 8 cards migrated + ReflectCard/AnnotationCard/DynamicCard states; digest error wiring (R3)
- **R5 Knowledge Base:** knowledge-store.ts (deskflow-kb.json + BM25), kb:ingest/query/list/remove IPC, Settings import UI + test retrieval, AiPage KB context injection

**Maintainer:** AI Development Team

---

## NEW: Code Architecture Map — interactive project structure visualization — 2026-08-13

| # | Feature | Status | Where |
|---|---------|--------|-------|
| CAM1 | CodeArchitectureMap component: two-panel layout (file tree + cytoscape/dagre graph), nodes colored by file type, edges from parent relationships, zoom/pan/search/filter by type, node detail panel with dependents/dependencies | Implemented (build OK, NOT LAUNCHED) | `src/components/workspace/CodeArchitectureMap.tsx` |
| CAM2 | Replaced WorkspaceMindMap in Context â Architecture Map subtab; renamed tab from "Context Map" to "Architecture Map" | Implemented (build OK, NOT LAUNCHED) | `src/pages/TerminalPage.tsx` |
| CAM3 | Fallback tree with 200+ known project paths when file listing API unavailable | Implemented | `src/components/workspace/CodeArchitectureMap.tsx` (buildFallbackTree) |
| CAM4 | In-app file viewer: click node â "View" button â reads file via `readProjectFile` IPC â shows content with line numbers, copy button, simple syntax highlighting (TS/TSX/CSS/JSON/MD keywords) | Implemented (build OK, NOT LAUNCHED) | `src/components/workspace/CodeArchitectureMap.tsx` (FileViewerPanel + CodeLine) |

---

## NEW: Workspace New Session trigger hardening — 2026-08-12

| # | Feature | Status | Where |
|---|---|---|---|
| WS1 | Revamped workspace New Agent event accepts the embedded workspace's `propProjectId`; dialog receives the effective project ID/path | AI Attempted Fix (build OK, runtime NOT LAUNCHED) | `src/pages/TerminalPage.tsx` |
| WS2 | Work â Sessions â New Session explicitly resets create mode before opening the shared dialog | AI Attempted Fix (build OK, runtime NOT LAUNCHED) | `src/pages/TerminalPage.tsx` |

---

## NEW: Default Canvas Setup + Card UX state pass — 2026-08-12 (session opencode-term-1-setup)

| # | Feature | Status | Where |
|---|---------|--------|-------|
| DC1 | Default Canvas Setup dialog: 4-category card toggles (Core/Content/Tools/Special), smart layout (builtin pos/size else 4-col grid), Save/Reset-to-builtin, Esc/Enter, custom-styled (no browser dialogs), "Setup saved" feedback | Implemented (build OK, NOT LAUNCHED) | `src/components/ai/canvas/CanvasSetupDialog.tsx` |
| DC2 | Persistence: saveDefaultSetup/loadDefaultSetup/clearDefaultSetup + CanvasSetupEntry {type,position,size,pinned} in localStorage `df-canvas-default-setup`; AiPage seeding prefers user setup over builtin layout; CanvasContainer toolbar Sliders button opens dialog | Implemented (build OK, NOT LAUNCHED) | `src/services/canvasPersistence.ts`, `src/pages/AiPage.tsx:752`, `src/components/ai/canvas/CanvasContainer.tsx:297` |
| DC3 | Shared card state views: CardEmptyState/CardErrorState/CardLoadingState; FocusCard/PlanCard/FinanceCard/DigestCard upgraded to 4-state UX (empty icon+message, error, shimmer loading) | Implemented (build OK, NOT LAUNCHED) | `src/components/ai/canvas/cards/CardStates.tsx` + `cards.css` |

## NEW: Lyceum visuals upgrade — MermaidBlock ZoomPan + PendingIllustrationsPanel checklist — 2026-08-11 (session opencode-term-1-gaia)

| # | Feature | Status | Where |
|---|---------|--------|-------|
| F1 | ZoomPan.tsx rewritten: auto-fit-to-square on mount + ResizeObserver (content + container) resets fit unless user interacted; arrow buttons (ââââ) + arrow-key panning; wheel zoom (native passive:false); drag pan (5px threshold); +/-/fit/fullscreen toolbar | Implemented (build OK, NOT LAUNCHED) | `src/components/learn/blocks/ZoomPan.tsx` |
| F2 | MermaidBlock wrapped in ZoomPan; SVG max-width stripped (`removeProperty('max-width')` + `maxWidth='none'`); `preserveAspectRatio` preserved | Implemented (build OK, NOT LAUNCHED) | `src/components/learn/blocks/MermaidBlock.tsx` |
| F3 | mermaidLoader: `flowchart.useMaxWidth: false`, `sequence.useMaxWidth: false` — diagrams render at natural pixel width instead of locking to container | Implemented (build OK, NOT LAUNCHED) | `src/components/learn/blocks/mermaidLoader.ts` |
| F4 | PendingIllustrationsPanel: checklist UI — `CheckSquare`/`Square` icons per card (emerald checked = inserted, grey unchecked = pending); progress bar (amber pending, emerald when done); header shows "X/Y inserted" | Implemented (build OK, NOT LAUNCHED) | `src/components/learn/blocks/PendingIllustrationsPanel.tsx` |
| F5 | User request tracked: illustration workflow = show prompt with copy button + manual image insert + list of not-yet-inserted images + checklist of inserted vs not | Feature spec (tracked) | User request 2026-08-11 |

## NEW: Life River Feature Overhaul — back-and-forth collaboration started 2026-08-11

| # | Feature | Status | Where |
|---|---------|--------|-------|
| LR1 | VoiceInputWrapper not connected to PhaseFormDialog text inputs — used in 25+ other places but zero in life-river | Bug / missing feature | `src/components/life-river/phase-form-dialog.tsx` |
| LR2 | "Save as draft" button saves to DB immediately — no draft status column, no draft list UI, no resume flow | Missing feature | `src/components/life-river/phase-form-dialog.tsx` + DB schema |
| LR3 | Lens switcher (Phases/Covenant/Gold/Memories) is LOCAL state in CoreSample — does not propagate to LifePage, so changing lens only affects RingCanvas | Architecture gap | `src/components/life-river/CoreSample.tsx` |
| LR4 | No way to add memories/covenant/gold from River mode — must switch to Pages mode | Missing feature | `src/features/warmth/LifePage.tsx` |
| LR5 | Lens switching should affect the entire page UI, not just the ring visualization | Design gap | CoreSample + LifePage |
| LR6 | RiverCanvas visualization too small — needs to be bigger/more prominent | UI polish | `src/components/life-river/river-canvas.tsx` |
| LR7 | No edit button on visualization elements — clicking rings scrolls to PhaseCard but no direct edit | UX gap | RingCanvas, RiverMap |
| LR8 | Need unified add button that adapts based on active lens (phase/covenant/gold/memories) | New feature | LifePage + CoreSample |
| — | Collaboration package created | In progress | `agent/docs/backandfourth-docs/life-river-overhaul/` |

---

## NEW: TUI prompt-insertion fix (Idle-Settle heuristic + verified writes) — 2026-08-10 (session opencode-term-1-nsdlg) — from RESULT.md tui-prompt-insertion-10082026

| # | Feature | Status | Where |
|---|---------|--------|-------|
| F1 | `isTuiSettled` replaces `hasEnoughAgentOutputToAcceptInput`: â¥150 bytes buffer + last line not shell + PTY idle â¥500ms (lastOutputAt reset on every chunk) — readiness no longer depends on fragile `>` regex or bracketed-paste config | Implemented (build OK, NOT LAUNCHED) | src/main.ts — `isTuiSettled` (~L11183) |
| F2 | Write verification: `agent:send` starts 2.5s timer after direct write; new PTY output while `busy` â `[AGENT-VERIFY] Write confirmed`, broadcast `agent:write-verified` + agent:idle + ai-task:updated, phaseâready; timeout â retry `\r`+payload once, then `[AGENT-VERIFY] Retry failed` â phase=error + `agent:write-failed` broadcast | Implemented (build OK, NOT LAUNCHED) | src/main.ts — `agent:send` handler + both PTY data callbacks |
| F3 | Launching transition = `detectAgentPrompt(...) \|\| isTuiSettled(st)` with `[AGENT-SETTLE]` log; handshake-based `isAgentReady`/`handshakeSeen` removed from callbacks | Implemented (build OK, NOT LAUNCHED) | src/main.ts — terminal:create + spawn-terminal data handlers |
| F4 | Blind 5s force-ready REMOVED from `startAgentTimeout`; hard error timeout 30sâ15s | Implemented (build OK, NOT LAUNCHED) | src/main.ts — `startAgentTimeout` |
| F5 | AgentState gains `lastOutputAt` + `verifyTimeout`; `agent:send` returns `{success, queued, written, verified, error?}` | Implemented (build OK, NOT LAUNCHED) | src/main.ts — AgentState, agent:send |
| F6 | Renderer: DUMMY ENTER fallback removed from `initializeTerminal` (now 300ms settle only); init-prompt send no longer logs mode; waits on backend broadcast | Implemented (build OK, NOT LAUNCHED) | src/pages/TerminalPage.tsx (~L1130) |
| F7 | `agentSend` declared in `src/types/deskflow-api.d.ts` with expanded return type (was missing entirely) | Implemented (build OK) | src/types/deskflow-api.d.ts |

---

## NEW: NewSessionDialog — 3-step wizard rebuild (name/agent â context map â review) — 2026-08-10 (session opencode-term-1-nsdlg)

| # | Feature | Status | Where |
|---|---------|--------|-------|
| F1 | 3-step wizard: Step 0 name/agent/terminal + "System prompt" collapsible (LayerBar + PromptPreview of effectivePrompt); Step 1 ContextMapVisualization + system toggles with live health (system.status/verify IPC, 30s polling, applyIfLatest flash); Step 2 session review with prompt preview + session additions feeding getPromptParts | Implemented (build OK, NOT LAUNCHED) | `src/components/NewSessionDialog.tsx` |
| F2 | Backend contract preserved: system.status/verify, listInitFiles, getAgentsContext, assemble, `deskflow:context-update` listener, advanced config toggles; SessionConfig.customSystemPrompt carries assembled prompt (`prompt \|\| undefined`) | Implemented (build OK, NOT LAUNCHED) | `src/components/NewSessionDialog.tsx` |
| F3 | Named export `export function NewSessionDialog` + `export interface SessionConfig` — TerminalPage.tsx:10 imports `{ NewSessionDialog, type SessionConfig }` (default export breaks vite build) | Implemented (build OK) | `src/components/NewSessionDialog.tsx`, `src/pages/TerminalPage.tsx` |
| F4 | Visual layer: base-ui Dialog shell, NSD_ACCENT (`--page-accent`) override, sr-only title/description, staggered nsd-* entrance animations (slideUp/slideInRight/Left/fadein/beam-flow) with prefers-reduced-motion guard; VoiceInputWrapper used as direct child (no render-prop) | Implemented (build OK, NOT LAUNCHED) | `src/components/NewSessionDialog.tsx` |
| F5 | Step 1 systems list honors `showAll` (slice(0,4) unless expanded); tier row onMouseEnter â tierHint; workspaceConfig seeds enabledNodes from WORKSPACE_CONFIG_PREF_KEY | Implemented (build OK, NOT LAUNCHED) | `src/components/NewSessionDialog.tsx` |

---

## NEW: Multi-gap fill — select multiple gaps, fill with one composition scaled per gap — 2026-08-10 (session opencode-term-1-mojib)

| # | Feature | Status | Where |
|---|---------|--------|-------|
| F1 | Gaps list multi-select: per-row checkbox (aria-pressed, only when `onFillGaps` provided), sticky footer bar "N selected â¢ Xm" with Select all / Clear / "Fill N gaps" (opens the composition editor once) | Implemented (build OK, NOT LAUNCHED) | `src/components/external/GapsListModal.tsx` — `selected` Map state, `toggleGap`, footer bar |
| F2 | GapFillModal multi-gaps mode (`multiGaps` prop): header "Fill N Gaps" + untracked total + "Same composition, scaled to each gap's length" hint; reference gap = `multiGaps[0]` for the editor; sequential submit with "Filling X/N…" progress; partial failures keep the modal open and RETRY targets only the failed gaps (no double-fill) | Implemented (build OK, NOT LAUNCHED) | `src/components/external/GapFillModal.tsx` — `referenceGap`/`isMulti`, `fillProgress`, `failedGaps` retry list |
| F3 | `scaleSegmentsToGap(segments, targetSeconds)` pure helper: drops null-activity segments, proportional scaling (floor â¥1 min, rounding remainder to LAST segment), never renormalizes; fillGapWithSegments clips overshoot | Implemented (build OK, node harness 10/10 PASS) | `src/lib/external/gaps.ts` |
| F4 | ExternalPage wiring: `gapTargets` state, GapsListModal `onFillGaps` â close list â open GapFillModal with `multiGaps`; single-gap "Fill" flow unchanged | Implemented (build OK, NOT LAUNCHED) | `src/pages/ExternalPage.tsx` (~L3140-3180) |

---

## NEW: Finance Monthly Recap — Spending by Category section — 2026-08-09 (session opencode-term-1-hmap)

| # | Feature | Status | Where |
|---|---------|--------|-------|
| F1 | `computeRecapStats` (main.ts:25810) now returns `spendingByCategory` — ALL categories (no LIMIT) via LEFT JOIN with `'Uncategorized'`/`'#888888'` fallbacks, alongside `topCategories`; AI prompt (`buildRecapUserMessage` ~25898) uses the full list when present, falls back to `topCategories` | Implemented (build OK, NOT LAUNCHED) | src/main.ts — spendingByCategory query + prompt injection |
| F2 | RecapPanel "Spending by Category" section: doughnut (cutout 72%, hoverOffset 6) with center total overlay + "spent", animated horizontal bars (motion width, stagger 0.05*i, ease [0.16,1,0.3,1], h-1.5 tracks), top 6 + "Other" lump (#71717a), glass tooltip; legacy recaps fall back to `stats.topCategories`; empty â null | Implemented (build OK, NOT LAUNCHED) | src/components/finance/RecapPanel.tsx — `renderSpendingByCategory()` after `renderStatsGrid()`, before `renderOnBehalf()`; ArcElement + ChartTooltip registered locally |

---

## NEW: App-sidebar (navigation rail) config persistence hardening — 2026-08-08 (session opencode-term-1-4de3)

| # | Feature | Status | Where |
|---|---------|--------|-------|
| F1 | Sidebar page-order persistence verified end-to-end: `df-sidebar-order` (JSON array of paths) load/persist/reset + new-item merge; `df-sidebar-collapsed` (expanded/collapsed "orientation") init/toggle — both already try/catch-wrapped | Verified (build OK, NOT LAUNCHED) | `src/App.tsx` — `loadSidebarOrder`/`persistSidebarOrder`/`clearSidebarOrder` (L87-107), `sidebarCollapsed` state (L423-433) |
| F2 | Harden reorder save path: `persistSidebarOrder` moved OUT of the `setSidebarOrder` updater into a `useEffect([sidebarOrder])` (skip first render) — one write per committed change, immune to StrictMode/concurrent updater replay | Implemented (build OK, NOT LAUNCHED) | `src/App.tsx` — `handleSidebarDragEnd` (L2511) + persist effect after `handleResetSidebarOrder` (L2531) |

Note: Terminal workspace sidebar has a SEPARATE gap (not in this scope): `handleSaveWorkspace` never sends `sidebarWidth` (DB always writes 400 default) and `sidebarOpen` (collapsed) is not persisted at all — pending user request.

---

## NEW: Life Phases Overhaul (RESULT (10).md) - full-stack implement - 2026-08-09 (session opencode-term-1-layo)

| # | Feature | Status | Where |
|---|---------|--------|-------|
| F1 | Ring & Grain hero (Apex Map): concentric life-rings (oldest to center), thickness proportional to magnitude, feTurbulence grain filter, seeded flecks, 4 lenses (Phases/Covenant/Gold/Memories) with layoutId pill, LTG branches + progress buds, Today's Edge breathing dashed ring (df-edge-breath keyframes), reduced-motion guard | Implemented (build OK, NOT LAUNCHED) | `src/components/life-river/RingCanvas.tsx` + `CoreSample.tsx` (new); LifePage Apex Map hero stack: CoreSample -> TimelineView -> RiverMap |
| F2 | TimelineView: proportional phase blocks, All time/By year zoom with year gridlines, pulsing now marker, dashed gap segments, click -> onJump | Implemented (build OK, NOT LAUNCHED) | `src/components/life-river/TimelineView.tsx` (new) |
| F3 | ConnectionDataStrip on PhaseCard: collapsed header, lazy-loads `lifePhaseGetPeriodContext` on expand, merges renderer-side memories + covenant rate (useCovenant: completions/(commitments x days) capped 1); Goals chips / Focus bars / External chips / Memories thumbnails / App bars / Covenant rate with empty states | Implemented (build OK, NOT LAUNCHED) | `src/components/life-river/ConnectionDataStrip.tsx` (new) |
| F4 | 9-step PhaseFormDialog stepper: basics/story/moments/people/feelings/lessons/color/connections/review; useReducer draft, live PhaseCardPreview (scale-0.62), aiAssist questions, generate-reflection, Save as draft, per-step validation | Implemented (build OK, NOT LAUNCHED) | `src/components/life-river/phase-form-dialog.tsx` (rewritten) |
| F5 | AI reflection contract: `onSubmit(phase, answers, variation?) -> {text, confidence: grounded\|sparse}`; sparse inline note; "Try again" regenerates with variation; tone-contract system prompt; legacy `{phase, answers}` compat | Implemented (build OK, NOT LAUNCHED) | `reflection-flow.tsx` (rewritten), `useLifePhases.ts` reflect(), main.ts `lifePhase:aiReflect` |
| F6 | PhaseCard header band: pinned memory image (mix-blend-luminosity + duotone overlay + lighten(20%)); connection chips resolve titles via `allPhases` + `onJump` + hover ring; edit dialog gets allPhases | Implemented (build OK, NOT LAUNCHED) | `src/components/life-river/PhaseCard.tsx` |
| F7 | Backend: `lifePhase:aiAssist` (lessons questions), `lifePhase:getPeriodContext` (SQLite aggregates - goals/focus/external/logs; sleep + is_browser_tracking excluded; memories/covenant filled renderer-side), `lifePhase:aiReflect` extended | Implemented (build OK, NOT LAUNCHED) | src/main.ts (~L16945+), preload.ts (~934), deskflow-api.d.ts (~201) |
| F8 | Shared helpers: `lighten(hex, pct)` (HSL) + `memoryUrl(memories, id)` + `MemoryRef` in riverMath.ts | Implemented (build OK, NOT LAUNCHED) | `src/lib/riverMath.ts` |

Deviation notes: ring "unroll" implemented as click -> smooth-scroll + 900ms amber highlight (not a true framer layoutId shared element); PeriodContext memories[]/covenantCompletionRate are filled renderer-side (main returns empty/null - memories are IndexedDB, covenant is localStorage).

---

## NEW: External page round — gap-fill top-bar entry + beautiful-charts Overview + segment reorder — 2026-08-09 (session opencode-term-1-mojib)

| # | Feature | Status | Where |
|---|---------|--------|-------|
| F1 | Smart Fill button in the GLOBAL top bar (app-wide gap-fill drawer entry, was External-page-only) | Implemented (build OK, NOT LAUNCHED) | App.tsx top bar (line ~2813) — dispatches same `open-gap-drawer` event; ExternalPage header button kept |
| F2 | beautiful-charts (Dribbble/Hyper Charts) restyle of External Overview tab: gradient bar fills + neon caps, glass tooltips, donut glow + legend dot glows | Implemented (build OK, NOT LAUNCHED) | ExternalPage.tsx `vizTab === 'grid'` — `barGradient`/`hexWithAlpha`/`glassTooltip` helpers (~899), all 3 Overview cards |
| F3 | Drag-to-reorder of segments in the External Fill Gap popup (dnd-kit, grip handle) | Implemented (build OK, NOT LAUNCHED) | `src/components/external/GapFillModal.tsx` — SortableSegmentRow + sensors + arrayMove |
| F4 | Sleep popup day-lookup rewrite: matches the LOCAL grouped evening date (startH<12 â previous day) instead of UTC date() + '+1 day' + ORDER BY DESC (which returned the NEXT night's sleep) | Implemented (build OK, NOT LAUNCHED) | main.ts `get-sleep-for-date` — window query `[dateStr 12:00 local, +24h)`, ASC, first match |

---

## NEW: Finance Monthly Recap — AI-output cleaning + live progress stages + APEX card — 2026-08-08 (session opencode-term-1-layo)

| # | Feature | Status | Where |
|---|---------|--------|-------|
| F1 | Shared heuristic cleaner for AI recap output: strips "Financial Biographer"-style briefs, data bullet echoes (category: amount (n txns), wallet/net lines, "X on YYYY-MM-DD"), "Thought:" blocks, preambles ("This is a narrative summary… Please read the data below…") — narrative-only output | Implemented (build OK, parser verified via fixture, NOT LAUNCHED) | `src/shared/recap.ts` `cleanRecapSummary` — BRIEF_PATTERNS/DATA_PATTERNS; consumed by main.ts `finance:recap-generate` AND defensively in RecapPanel.tsx narrative memo (legacy rows fixed without regen) |
| F2 | APEX insight card derived from REAL stats instead of AI-invented: dominant category (â¥30% of spending) â net swing vs prev month â wallet delta â¥5000 â biggest expense | Implemented (build OK, NOT LAUNCHED) | `computeApexInsight(stats)` in `src/shared/recap.ts`; stored inside stats_json (no schema change); rendered in RecapPanel when present |
| F3 | Live generation progress: reading â analyzing â writing â saving â done over `finance:recap-progress` IPC with animated stage bar + stage-labeled buttons; stronger system prompt (strict OUTPUT FORMAT) + maxTokens 500â700 | Implemented (build OK, NOT LAUNCHED) | main.ts generateRecapInternal + RECAP_SYSTEM_PROMPT; preload `onRecapProgress`; deskflow-api.d.ts; RecapPanel genStage/STAGE_LABEL/STAGE_DESC/STAGE_WIDTH |

---

## NEW: Lyceum Learn refinement round — 2026-08-08 (session opencode-term-1-kbse)

| # | Feature | Status | Where |
|---|---------|--------|-------|
| F1 | Rename "Rerun setup" â "Adjust setup answers" + confirm dialog; strengthen reset-profile confirm | Implemented (build OK, NOT LAUNCHED) | LearnerProfilePanel.tsx (onRerunSetup prop) — button renamed + `confirm()` dialog; LearnerSetup pre-fills from `loadProfile()` (line 19) |
| F2 | Knowledge Base form chips = user's OWN lesson topics (loadUserLessons), not CURRICULUM_BLUEPRINT chips | Implemented (build OK, NOT LAUNCHED) | LearnerProfilePanel.tsx KB editor + LearnerSetup.tsx Q9 — chips show lesson titles, `linkedLessons: string[]`, empty state |
| F3 | Prior Knowledge section shows ONLY curriculum parts the user has lessons in | Implemented (build OK, NOT LAUNCHED) | LearnerProfilePanel.tsx + LearnerSetup.tsx Q8 — filtered by `userLessons.parts`, empty state |
| F4 | Remove redundant duplicate chapter/topic list in reader (node outline + TableOfContents + ChecklistProgress all list the same titles) | Implemented (build OK, NOT LAUNCHED) | ReaderView.tsx — compact ChecklistProgress removed from sidebar; outline is the single listing; full checklist remains at node bottom |
| F5 | Image generation respects profile setting (ImageGenSettings.enabled): when disabled â placeholder + notification, offer prompt-based setup UI | Implemented (build OK, NOT LAUNCHED) | IllustrationBlock.tsx — `aiEnabled` from `learnGetImageGenSettings`; disabled â "AI generation is off" hint button; upload still available |
| F6 | CodeBlock Run/execute button (bash/python) via electron:execute-command (runnable flag already in data model) | Implemented (build OK, NOT LAUNCHED) | CodeBlock.tsx + new `learn:runCode` IPC (services/learn/index.ts) + preload `learnRunCode` — language-keyed (runnable flag is hardcoded false by parser), 15s timeout, scratch dir |
| F7 | Learn keyboard shortcuts on/off toggle — NO preference exists today (hardcoded keydown LearnPage.tsx ~134-193); add toggle in the '?' shortcuts modal | Implemented (build OK, NOT LAUNCHED) | LearnPage.tsx — `lyceum.shortcutsEnabled` (localStorage, default true), guard keeps only Esc + '?' when off, Switch in '?' modal |
| F8 | LDOC viewer toggle per node: button in reader shows raw .ldoc source for the current section (debug + modify) | Implemented (build OK, NOT LAUNCHED) | ReaderView.tsx — "Source" tab-bar button, `learnGetLessonSource({lessonId})`, pretty-printed JSON pane |
| L3 | Quiz/Assessment styling pass | Implemented (build OK, NOT LAUNCHED) | QuizBlock.tsx — lucide ClipboardList icon, Enter-to-submit, open-format "awaiting coach review" state, MCQ try-again; AssessmentCard.tsx — ClipboardCheck icon, "x/y answered" hint |

---

## NEW: AI Tools - all-time Tool Usage Timeline + dominance phases - 2026-08-08 (session opencode-term-1-yzjl)

| # | Feature | Status | Where |
|---|---------|--------|-------|
| F1 | Tool Usage Timeline (per-tool stacked daily chart - the per-tool counterpart of the existing all-time Model Usage Timeline) | Implemented (build OK, NOT LAUNCHED) | AIToolsTab.tsx - new "Tool Usage Timeline" GlassCard right after "Model Usage Timeline"; aggregates overview.aiUsage.byTool[toolId].daily (fields identical to modelDaily: tokens/tokens_in/tokens_out/messageCount/sessions/cost), AGENT_CONFIG display names, honors aiChartMode + tokenDisplayMode + cost + messages modes, all-time anchoring via timeLock |
| F2 | Dominance "phases" strips on both timelines - "which model/tool roughly, and how it changes" | Implemented (build OK, NOT LAUNCHED) | AIToolsTab.tsx - contiguous winner-per-day runs rendered as chips (date range - label - % of period total) under each timeline header; hidden when >6 runs or no data |

Note: the all-time Model Usage Timeline already existed (timeLock -> effectiveAiPeriod 'all', minDate-anchored); this round added the phases strip to it plus the new Tool timeline. Renderer-only, no new IPC.
---

## °Å¸“Å Page Index

| Route | Page Component | Description |
|-------|----------------|-------------|
| `/` | `DashboardPage` | Main dashboard with 3D orbit, heatmap, weekly overview |
| `/stats` | `StatsPage` | App statistics, live tracking indicator, session edit/delete |
| `/productivity` | `ProductivityPage` | Productivity score, focus sessions, trends |
| `/browser` | `BrowserActivityPage` | Browser usage tracking with timeline nav |
| `/ide` | `IDEProjectsPage` | IDE projects, workspace, Initialize/Setup, analytics |
| `/terminal` | `TerminalPage` | ~4823-line terminal workspace with 5-group sidebar |
| `/external` | `ExternalPage` | External activity tracking, sleep, comparison card |
| `/reports` | `InsightsPage` | 3-tab insights (Day/Weekly/Activities), heatmap, stats |
| `/database` | `DatabasePage` | Database viewer + analytics dashboard |
| `/settings` | `SettingsPage` | 5-tab settings (Category/Colors/General/Tracking/Prompts) |
| `/ide-help` | `IDEHelpPage` | IDE setup help documentation |
| `/features` | `FeatureSpecViewer` | Hierarchical feature specs browser with sidebar + markdown copy |
| `/learn` | `LearnPage` | Lyceum "Learn" module — living-textbook with AI tutor, mastery tracking, .ldoc import |

---

## °Å¸ÅÅ 1. Dashboard Page (`/`)

**Component:** `src/pages/DashboardPage.tsx` (~2400 lines)

### Core Features:

#### 1.1 3D Orbit System
- **Feature:** Interactive 3D solar system visualization
- **Technology:** React Three Fiber, Three.js
- **Details:**
 - Planets represent apps with size = usage time

 - Orbits based on usage (most used = furthest)

 - Logarithmic orbit spacing (inner planets close, outer planets spread)

 - Visual balance factor (0.65) for engaging angular speeds

 - Procedural textures generated via Canvas API

 - Category-based color schemes and patterns

 - Click planets to see app details with camera tracking

 - Hover for tooltips with usage stats

 - Period selector inside OrbitSystem UI (Today/Week/Month/All)

 - Category dropdown animates camera to solar system

 - Planet click locks camera to follow orbiting planet

 - Tracking cleared on zoom out, reset, galaxy switch

#### 1.2 Category System
- **Productive:** IDE, AI Tools, Developer Tools, Education, Productivity, Tools
- **Neutral:** Browser, Communication, Design, News, Uncategorized, Other
- **Distracting:** Entertainment, Social Media, Shopping
- **Custom overrides:** User can reassign categories in Settings
- **Custom categories:** Add/remove custom categories (persist in deskflow-categories.json)

#### 1.3 Heatmap
- **Feature:** Hourly activity heatmap (7 days ×— 24 hours)
- **Modes:**
 - `external` - External activity only (AI tools, websites)

 - `device` - Device activity only (local apps)

 - `combined` - Both with color blending

- **Interactions:**
 - **Hover:** Tooltip shows device + external time per hour
 - **Click hour:** Detail panel below heatmap with per-app device breakdown, colored dots, durations
 - **Click day label:** DayDetailPopup modal with timeline items (app=blue, browser=green, external=purple)
 - Hour-splitting uses calendar hour boundaries (no cross-hour leakage)

 - 12-hour format labels (12a, 1a...12p, 1p)

- **Color coding:**
 - External-only: Purple scheme

 - Device-only: Red-green productivity colors

 - Combined: Max duration with blended colors

#### 1.4 Weekly Overview (Activity Charts)
- **Feature:** Bar chart showing period activity summary with stacked bars
- **Details:**
 - Rounded bar corners

 - Total hours displayed below chart

 - Device breakdown bar (colored segments per app)

 - External activity stacked on top (purple)

 - Period navigation (prev/next buttons + "Today" reset)

 - Respects period selector + dateOffset

 - Dynamic labels: hourly for today, daily for week, 30-day for month, monthly for all

 - Horizontal scroll for overflow

 - Dedicated "View Heatmap" button (no click-on-chart)

#### 1.5 Activity Stats
- **Total time today/week/all**
- **Most used app**
- **Productive time percentage**
- **Current streak**

#### 1.6 Recent Sessions
- **Feature:** List of recent app usage sessions
- **Details:**
 - Shows "App" or "Website" based on type

 - Duration, start time, category

 - Click to view session details

#### 1.7 Quick Stats Cards
- **Active time today**
- **Productive apps count**
- **Distracting apps count**
- **Neutral apps count**

#### 1.8 Period Selector
- **Options:** Today, This Week, This Month, All Time
- **Affects:** All dashboard charts and stats
- **Default:** Week (changed from Today on 2026-05-06)

#### 1.9 Time Mode Toggle
- **Options:** Hours, Seconds
- **Affects:** All time displays

#### 1.10 Activity Type Toggle
- **Options:** Apps, Websites, Combined
- **Affects:** Which activities show in orbit/heatmap

#### 1.11 Dashboard Optimization (v3.58)
- **Feature:** Major performance overhaul —” replaced 6 redundant useMemos with single `getDashboardAggregates` IPC call
- **Chart bars:** Computed from backend `weeklyHeatmap`
- **Hourly heatmap:** From backend grid data
- **Solar data:** From backend `appStats`/`websiteStats`
- **Overview stats:** From backend `overview`
- Dashboard no longer receives raw `allLogs` prop

#### 1.12 Focus Sessions
- **Feature:** Track uninterrupted productive sessions with minimum duration filter
- **Min duration:** Default 60s (configurable slider)
- **Idle detection:** Uses `lastInteractionRef` + 5min clamp —” idle periods don't inflate durations
- **Stopwatch pauses:** Skip accumulation during idle (>5min no interaction)
- **Old data cleared:** `clear-productivity-sessions` IPC on mount
- **Refresh:** 5s auto-refresh interval

#### 1.13 Stopwatch (Productive Timer)
- **Feature:** Always-visible timer tracking current productive streak
- **Accumulated delta pattern:** Timer accumulates across app switches (only resets on explicit pause/clear)
- **Live tracking:** Adds live `currentProductiveMs` on top of DB stats
- **Tier fallback:** Shows tier name + "Session" when app is null but tier is known

#### 1.14 Card Library Layout Persistence (fix)
- **Feature:** Card library toggles + grid saves now update the live dashboard and persist
- **Stale closure fixed:** `addWidget`/`removeWidget` in `CardLibrary.tsx` now compute `next` inside the `setLayout(prev => …)` updater and call `onChanged?.(next!)` (deps `[onChanged]`, no `layout` dep)
- **Save sync:** New `onSaved` prop on `CardLibrary` + `WidgetGrid`, fired only after `persistLayout(layout)` (Save/Apply, Close & Save, WidgetGrid `saveEdit`)
- **Dashboard reload:** `DashboardPage` bumps `layoutSyncKey` (`bumpLayoutSync`) so the storage-reload effect (deps `[showCardLibrary, layoutSyncKey]`) re-reads `loadCardLayout()` from `dashboard_layout` after saves
- **Note:** Two layout systems share one `LAYOUT_KEY` (`dashboard_layout`); toggles alone don't persist until an explicit save (by design)

---

## °Å¸“Å  2. Stats Page (`/stats`)

**Component:** `src/pages/StatsPage.tsx`

### Core Features:

#### 2.1 App Statistics Table
- **Feature:** Detailed table of all tracked apps
- **Columns:** App name, Category, Total time, Sessions, Avg duration
- **Sorting:** Click column headers to sort
- **Filtering:** Search by app name
- **Performance:** Optimized via useMemo + single-pass date map (removed O(n) redundancies)

#### 2.2 Time Distribution Charts
- **Pie Chart:** Category distribution (productive/neutral/distracting)
- **Bar Chart:** Top apps by usage time
- **Line Chart:** Usage over time
- **Period-aware:** 24h bars for today, daily for week, 30-day for month, 90-day for all

#### 2.3 Category Breakdown
- **Feature:** Per-category stats and charts
- **Details:** Time per category, apps in category, percentage of total

#### 2.4 Full Sessions List with Edit/Delete
- **Feature:** Complete session list per app in detail modal
- **IPC:** `update-app-log`, `delete-app-log` handlers
- **Inline edit:** datetime-local inputs for start/end time
- **Delete:** With confirmation dialog
- **Matches External page sessions UX**

#### 2.5 Live Tracking Indicator
- **Feature:** Real-time tracking bar at top of page
- **Pulsing green dot** when app is actively tracked
- **Current app name + category badge**
- **Live elapsed timer**
- Disappears when no app active

- Listens to `onForegroundChange` event

#### 2.6 Live Detection Panel
- **Feature:** Real-time event log (terminal-style dark panel)
- **Shows:** timestamp, INFO badge, app name, category
- **50-event ring buffer**
- **Global persistence:** App.tsx `liveActivityLogs` prop (survives page navigation)
- Matches Browser Activity page Live Detection UX

#### 2.7 Export Functionality
- **Export to CSV:** Download stats as spreadsheet
- **Export to JSON:** Download raw data

#### 2.8 Period Selector
- Same as Dashboard (Today/Week/Month/All)

#### 2.9 Time Mode Toggle
- Hours/Seconds display

#### 2.10 Timeline Navigation
- **Forward/backward** arrow buttons in header
- **Dynamic period label** (e.g., "Wed, Jun 2", "Week of May 24")
- **filteredLogs** computed from `selectedPeriod` + `dateOffset`
- **All memos** use filtered data (sortedApps, totals, categoryBreakdown, dailyUsage, hourlyDistribution)

---

## °Å¸“Ë 3. Productivity Page (`/productivity`)

**Component:** `src/pages/ProductivityPage.tsx`

### Core Features:

#### 3.1 Productivity Score
- **Feature:** Overall productivity percentage
- **Calculation:** (Productive time / Total time) ×— 100
- **Visual:** Large score display with color coding

#### 3.2 Focus Time Tracking
- **Feature:** Tracks uninterrupted productive sessions
- **Details:** Start/end times, duration, apps used

#### 3.3 Productivity Trends
- **Line Chart:** Productivity score over time
- **Comparison:** vs previous periods

#### 3.4 App Productivity Classification
- **Productive Apps:** IDE, AI Tools, Education, etc.
- **Neutral Apps:** Browser, Communication, etc.
- **Distracting Apps:** Entertainment, Social Media, etc.

#### 3.5 Browser Productivity
- **Feature:** Track productive vs distracting websites
- **Domain Rules:** Custom rules in Settings
- **Domain Keyword Rules:** Auto-classify by keywords

#### 3.6 Period Selector
- Today/Week/Month/All

#### 3.7 Score & Trend Fixes
- **score-trend connection fix:** `trendAverageScore` useMemo computes from daily trend averages instead of raw data
- **browser category remapping fix:** `WEBSITE_CATEGORY_MAP` applied correctly —’ Search Engine —’ Productivity, Developer Tools —’ Tools

#### 3.8 Focus Sessions
- **Feature:** Track uninterrupted productive sessions with idle detection
- **Idle detection:** Uses `lastInteractionRef` + 5min clamp —” idle periods don't inflate durations
- **Stopwatch pauses:** Skip accumulation during idle (>5min no interaction)
- **Min duration:** Default 60s (configurable slider)

#### 3.9 Chart & Display Fixes
- **chart height fix:** Chart height changed from `h-40` to `h-72` (288px)
- **hour overflow fix:** Stacked hour totals capped at 3600s per hour to prevent overflow
- **unknown websites score fix:** `categorizeDomain` last resort changed from 'Uncategorized' (50%) to 'Entertainment' (0%)

#### 3.10 Timeline & Session Navigation
- **timeline navigation:** `dateOffset` with chevron forward/backward navigation
- **session detail view:** Per-session message viewer with expandable details

---

## °Å¸ÅÂ 4. Browser Activity Page (`/browser`)

**Component:** `src/pages/BrowserActivityPage.tsx`

### Core Features:

#### 4.1 Website Tracking
- **Feature:** List all visited websites with time spent
- **Details:** URL, domain, title, duration, visits count

#### 4.2 Domain Grouping
- **Feature:** Group by domain (e.g., all github.com pages)
- **Shows:** Total domain time, pages visited

#### 4.3 Category Assignment
- **Auto-categorization:** Based on domain rules
- **Manual override:** Reassign in Settings

#### 4.4 Top Sites Chart
- **Bar Chart:** Most visited sites
- **Pie Chart:** Category distribution

#### 4.5 Search & Filter
- **Search:** By URL or title
- **Filter:** By category, date range

#### 4.6 Period Selector
- Today/Week/Month/All

#### 4.7 Timeline Navigation
- **Feature:** Forward/backward arrow buttons, `dateOffset` state
- **Dynamic period label:** Updates based on selected range + offset

#### 4.8 Chart Period Awareness
- **Feature:** `hourlyDistribution` produces period-appropriate data
- **24h bars for today**, 7 daily bars for week, 30 for month, 90 for all

#### 4.9 Live Detection Panel
- **Feature:** Real-time event log (terminal-style dark panel)
- **Shows:** timestamp, INFO badge, app name, category
- **50-event ring buffer**
- **Global persistence:** Survives page navigation via `liveActivityLogs` prop
- Matches Stats page Live Detection UX

#### 4.10 Tab Bar
- **Feature:** 7 content tabs —” Overview / IDEs / Tools / Projects / AI / Git / Trash
- Each tab shows filtered subset of browser activity

#### 4.11 Live-Log Race Condition Fix
- **Feature:** Browser focus check prevents stale live-logs from updating `currentWebsite` when non-browser app is focused
- Ensures accuracy of currently displayed website data

---

## °Å¸âºÂ ïÂ¸Â 5. IDE Projects Page (`/ide`)

**Component:** ``src/pages/IDEProjectsPage.tsx` (~3271 lines)`

### Core Features:

#### 5.1 IDE Detection
- **Auto-detect installed IDEs:**
 - VS Code / VSCode Insiders
 - Cursor
 - IntelliJ IDEA (Community + Ultimate)
 - PyCharm (Community + Professional)
 - WebStorm, PhpStorm, RubyMine, GoLand, CLion, Rider, DataGrip
 - Android Studio
 - Xcode (macOS)
 - Google Antigravity
- **Detection methods:**
 - Command existence (`where code`, `where idea64`)
 - JetBrains Toolbox config (`.toolbox.xml`)
 - Directory scanning (`%LOCALAPPDATA%/JetBrains`)
 - Environment variables (`IDE_INSTALL_LOCATION`)

#### 5.2 Project Management
- **Add Project:** Manual add with name, path, default IDE
- **Detect Projects:** Scan directories for project files
- **Project Grid:** Visual grid of all projects with IDE icons
- **Project Details:** Click to view project info, extensions, stats

#### 5.3 Extension Tracking
- **Per-IDE extension list**
- **Version tracking**
- **Enabled/disabled status**

#### 5.4 Open Project in IDE
- **Feature:** Launch project directly in selected IDE
- **IPC:** `open-project` ? launches IDE with project path

#### 5.5 Workspace Launch
- **Feature:** Open integrated terminal workspace for project
- **Navigates to:** `/terminal` with `projectId` + `projectPath` props
- **Opens:** `TerminalPage` component with full workspace UI

#### 5.6 AI Usage Overview
- **Feature:** Aggregate AI tool usage stats
- **Shows:** Total tokens, total cost, by tool breakdown
- **IPC:** `getIDEProjectsOverview()`

#### 5.7 Project Analytics
- **Charts:** Commits, additions, deletions (if git repo)
- **Stats:** File count, language breakdown
- **Time tracking:** Total time spent on project

#### 5.8 IDE Tools Detection
- **Version Control:** Git, SVN, etc.
- **Runtimes:** Node.js, Python, Java, etc.
- **Package Managers:** npm, yarn, pip, etc.
- **Databases:** MySQL, PostgreSQL, MongoDB, etc.
- **Cloud Tools:** AWS, Azure, GCP CLIs

#### 5.9 Project Search & Filter
- **Search:** By name or path
- **Filter:** By IDE, category

#### 5.10 Project Categories
- **Web Development**
- **Mobile Development**
- **Data Science**
- **DevOps**
- **Other**

#### 5.11 Analytics Tab
- **Feature:** Workspace-wide AI usage, problems, and requests dashboard
- **Component:** `AnalyticsDashboard` with `variant="workspace"`
- **Shows:** Token usage, cost, problem counts, request stats

#### 5.12 Initialize Button
- **Feature:** Green `FolderTree` button in project header
- **Opens:** `InitializeProgressModal` with 16-step grouped progress display
- **Groups:** Organized by directory (agent/, agent/skills/, graphify-out/)
- **Per-group counters** with expandable file previews
- **Workspace Ready** summary card on completion
- **Error retry** support with restart capability

#### 5.13 Setup Button
- **Feature:** Amber `Settings2` button in project header
- **Opens:** `WorkspaceSettingsDialog` for workspace configuration
- **Settings:** System toggles, slider adjustments, save persistence

#### 5.14 New Agent Button
- **Feature:** Dispatches `open-new-agent` event
- **Opens:** `NewSessionDialog` pre-populated from workspace settings

#### 5.15 Workspace Minimize
- **Feature:** Hides terminal layout + sidebar while keeping PTY processes alive
- **UI:** Centered restore card to bring workspace back
- **Toggle:** Minimize/Restore cycle

#### 5.16 Close Workspace with Save Prompt
- **Feature:** Save & Close / Discard / Cancel dialog
- **Options:** Save workspace state before close, discard changes, or cancel

#### 5.17 Health Score Fix
- **Feature:** Path-based matching for AI usage queries
- **Fix:** Corrects health score calculation by matching project paths accurately

#### 5.18 Consolidated getProjectDetails
- **Feature:** Single IPC call instead of 4 parallel calls
- **Optimization:** Reduces network/process overhead for project detail loading

#### 5.19 Setup vs Initialize Separation
- **Feature:** Clear separation of concerns
- **Initialize:** Creates agent directory structure and scaffolding files
- **Setup:** Configures workspace settings (systems, toggles, sliders)

#### 5.20 AI Usage Cityscape (AI Tools subpage)
- **Feature:** 3D skyline visualization of AI agent usage
- **Technology:** React Three Fiber, Three.js InstancedMesh, custom ShaderMaterial
- **Components:**
 - `AICityscape.tsx` — main visualization component (873 lines)
 - `cityscape.utils.ts` — data transforms, spiral layout, window atlas (300 lines)
- **Visual features:**
 - Window atlas with per-building lit density (5-step bucket from `getWindowTexture` pool)
 - Patched `MeshStandardMaterial` via `onBeforeCompile`: emissive windows + neon edge trim + state glow
 - Per-instance attributes: `aWin` (atlas column), `aTile` (window tiling), `aState` (hover/select), `aEmis` (base emissive)
 - `NeonGround` procedural shader: cyan square grid + violet radial streets + pink travelling data pulses
 - `Atmosphere` GPU-animated `Points` system: rain fall + ember rise (1400 particles, no per-frame JS writes)
 - Post-processing: selective Bloom (threshold 0.95), ChromaticAberration, Noise (film grain), Vignette, SMAA
 - Fog `exp2(#0a0c18, 0.025)`
 - `RooftopSigns` — canvas-generated sprite textures on top 8 buildings, additive blending, neon agent-name labels
 - `SmogClouds` — drei Cloud instances at opacity 0.04–0.06, color #1a2444, slow drift (Cinematic only)
 - `MeshReflectorMaterial` — wet reflective ground plane, 512px resolution (Cinematic only)
- **Interaction:**
 - Hover â emissive bloom lerp (aState.x driven by useFrame)
 - Click â selection pulse (aState.y `sin(uTime*4.0)`) + DetailPanel slide-in
 - Morph transitions: height/footprint lerp on mode switch and time-lapse
- **Draw calls:** 4 total (body + roof glow + ground + particles) regardless of city size
- **View modes:** By Agent, By Model, Time-lapse (play/pause scrubber)
- **Graphics quality:** Cinematic (full effects) / Balanced (no CA/no smog/no wet) / Performance (600 particles + stripped effects), persisted in localStorage `ai-city-quality`
- **Cleanup:** `disposeWindowPool()` + `disposeWindowAtlas()` on unmount

---

## °Å¸’Â» 6. Terminal Page / Workspace (`/terminal`)

**Component:** `src/pages/TerminalPage.tsx` (~4900 lines)
**Terminal Component:** `src/components/TerminalWindow.tsx` (607 lines)
**Hook:** `src/hooks/useTerminalLayout.ts`

### Core Features:

#### 6.1 Multi-Pane Terminal
- **Technology:** `@xterm/xterm` terminal emulator with node-pty backend
- **Multi-pane support:** Split panes horizontally/vertically via N-ary tree (PaneNode.children refactored from binary tuple to array)
- **3-terminal grouping fix:** Each new terminal gets its own group with equal screen space
- **Layout Groups:** Terminals organized into groups based on their split parent in the tree
- **Active terminal tracking:** Tracks which pane is active via `activeTerminalId` state
- **Terminal spawn:** `terminal:create` IPC with CWD = project path
- **Resize handling:** `terminal:resize` IPC for dimension changes
- **Agent integration:** Supports OpenCode, Claude Code, Codex, Aider, Cursor agents
- **Agent readiness state machine:** `spawning` ? `waiting` ? `ready`|`timeout` with cyan/amber status overlays
- **Agent signatures:** Pattern matching for opencode/claude/aider/codex/generic agent detection
- **Message queue:** Instructions sent before agent is ready are queued and flushed after system prompt
- **Input buffer:** Keystrokes before PTY is ready are buffered and flushed on `terminal:ready` event
- **Double-spawn fix:** Removed `spawnTerminal` from `onCreate` handler to prevent duplicate terminals
- **System prompt queuing:** Merged prompt + init content as queue items with `[SYSTEM CONTEXT]` markers
- **Terminal:write-raw:** Dedicated channel for system writes (no prompt history pollution)
- **Startup delay guard:** 3s startup delay before agent signature checking (prevents shell prompt false-positive)
- **Auto-recovery:** `retry-agent-init` handler for failed agent initialization

#### 6.2 Sidebar Groups (5 groups, 12 sub-tabs):

Restructured from 12 flat tabs into 5 group buttons with browser-tab-style nav (active tab flush with border, rounded-t-lg, bg-zinc-800/80) and accent connectivity strip (2px colored bar). Each group renders a `<WorkspaceShell>` with chip-style sub-tab bar (rounded-full pill, no border). Sub-tab selection uses `usePersistentSubTab` (URL query + localStorage). Sub-tab accent color maps: setup=orange, work=green, insights=purple, studio=indigo, context=amber.

**Group 1 — Setup (orange, Settings icon):**
- **Sub-tabs:** Presets, Configs

##### 6.2.1 Presets Tab
- **Sub-tab of:** Setup group
- **Icon:** `Zap` (green accent)
- **Feature:** Save/reuse common terminal commands
- **DB Table:** `terminal_presets`
- **Fields:** id, name, command, category
- **Execute:** Writes command to active terminal
- **Grouping:** By category (general, build, test, deploy, etc.)
- **Operations:** Add preset via inline form, execute with one click

##### 6.2.2 Configs Tab
- **Sub-tab of:** Setup group
- **Icon:** `Settings` (orange accent)
- **Feature:** Manage project-specific configurations
- **Model config controls:** Threshold slider (3-30), Tier selector, Debug toggle
- **Cross-session sync config:** Master toggle, TTL slider (30-600s), Context broadcast toggle, Conflict mode dropdown, `/sync` toggle
- **Thought-process toggle:** Inject `## Thought Process` instruction after system prompt

**Group 2 — Work (green, Monitor icon):**
- **Sub-tabs:** Sessions, Map, Files

##### 6.2.3 Sessions Tab
- **Sub-tab of:** Work group
- **Icon:** `Clock` (green accent)
- **Feature:** View AI agent chat history and session management
- **DB Table:** `terminal_sessions`
- **Fields:** id, agent, topic, resume_id, created_at, total_cost, total_tokens, status, category, product_area, description, auto_tags
- **Subpage grouping:** Sessions organized under sub-headers (Top Pinned, Recent, This Month, Older) with collapsible sections
- **Filter pills:** Category filter pills below sub-tab bar using SESSION_CATEGORIES
- **Status tracking:** StatusDot indicator (active/idle/completed/error/cancelled)
- **Session cards:** Show status dot, category badge, agent badge, topic, terminal status (Running/Closed), description, date, tags, cost
- **Session edit dialog:** Two-column form for editing session metadata
- **Import opencode sessions:** Dialog for importing external session data
- **Detail view:** Click a session â full detail panel with metadata grid, Focus/Open in Terminal buttons, Message viewer with role coloring
- **Search & filter:** Filter sessions by text, status, category, agent
- **Actions:** Focus terminal, Open in terminal (resume), View messages, Delete

##### 6.2.4 Map Tab
- **Sub-tab of:** Work group
- **Icon:** `Monitor` (green accent)
- **Feature:** Terminal layout visualization + group-managed terminal list
- **Components:** `TerminalMiniMap` — draggable pane layout visualization using `@dnd-kit`
- **Mini Map:** Shows all terminal panes as draggable rectangles, click to focus, drag to rearrange
- **Quadrant detection:** Drop zones detect quadrant position for split direction
- **Running Terminals (grouped):** Below the map, terminals organized by layout groups with Focus/New Session buttons

##### 6.2.5 Files Tab
- **Sub-tab of:** Work group
- **Icon:** `Folder` (yellow accent)
- **Component:** `FilesTab` (imported component)
- **Feature:** Browse `agent/` directory markdown files
- **IPC:** `read-agent-file`, `list-agent-files`
- **Read-only:** Navigate subdirectories, view markdown with syntax highlighting
- **Pulse notification:** Green ping dot on Work group button when agent files change

**Group 3 — Insights (purple, PieChart icon):**
- **Sub-tabs:** Analytics, Issues

##### 6.2.6 Analytics Tab
- **Sub-tab of:** Insights group
- **Icon:** `PieChart` (green accent)
- **Component:** `AnalyticsDashboard` (shared, `variant="full"`)
- **Feature:** AI usage analytics with period selection
- **Period selector:** 7 Days / 30 Days / All Time pill toggle
- **Overview cards:** Total tokens, Total cost ($), Session count
- **By Agent breakdown:** Visual bar chart showing token usage per agent
- **Top Sessions by Cost:** Sortable list of most expensive sessions
- **Data source:** `getAIUsageSummary(period)` IPC + sessions data

##### 6.2.7 Issues Tab (combined Problems + Requests)
- **Sub-tab of:** Insights group
- **Icon:** `ListChecks` (emerald accent)
- **Component:** `IssuesWorkspace` (imported component)
- **Feature:** Combined problem and request tracking
- **Problem tracking:** Status filter (NEW, Not Started, In Progress, AI Attempted Fix, User Testing, Fixed, Irrelevant), group by status with color-coded headers, priority glow dots
- **Request tracking:** Status filter (All / Pending / In Progress / Completed / Cancelled), link/unlink problems
- **ProblemDetailModal / RequestDetailModal:** Dedicated detail views with inline editing
- **Link problems to requests:** Associate problems with related requests
- **Auto-refresh:** Polls every 5 seconds

**Group 4 — Studio (indigo, Sparkles icon):**
- **Sub-tabs:** Skills, Design

##### 6.2.8 Skills Tab
- **Sub-tab of:** Studio group
- **Icon:** `Sparkles` (indigo accent)
- **Component:** `SkillsTab` (imported component, ~400 lines)
- **Feature:** Manage AI agent skills and capabilities
- **IPC:** `getSkills(projectPath)`, `createSkill()`, `updateSkill()`
- **Skill source:** Parses from `agent/skills/` directory (subdirs with SKILL.md + standalone .md files) + legacy `agent/skills.md`
- **Skill DSL integration:** Dynamic forms generated from YAML frontmatter metadata (10 widget types)
- **GeneralistDialog:** Dialog with search + category filter for browsing all skills
- **Inline CRUD:** Create, read, update, delete skills with inline forms
- **Use Skill modal:** View skill content, select target terminal, enter prompt, send to terminal
- **Auto-refresh:** Polls every 10 seconds

##### 6.2.9 Design Tab
- **Sub-tab of:** Studio group
- **Icon:** `Palette` (accent)
- **Feature:** Design taste knobs + style references
- **Component:** Design workspace panel (taste config, style reference viewer)
- **Integration:** Previously a standalone route (`/design-workspace`), now embedded as a Studio group sub-tab

**Group 5 — Context (amber, Settings2 icon):**
- **Sub-tabs:** Context, Maintenance, Page Context

##### 6.2.10 Context Tab
- **Sub-tab of:** Context group
- **Icon:** `Settings2` (amber accent)
- **Component:** `ContextSidebar` (imported component)
- **Feature:** Toggle context sources (LLM Wiki, Obsidian Skills, Graphify, PARA, QMD, Automations, Design Skills)
- **Context Map:** Visual map showing active context systems and token budget
- **Context Assembly:** Build and preview assembled context before starting a session

##### 6.2.11 Maintenance Tab (was Context Maintenance)
- **Sub-tab of:** Context group
- **Icon:** `Database` (violet accent)
- **Component:** `ContextMaintenanceTab` (382 lines)
- **Feature:** Persistent AI memory management across sessions
- **6 sub-components:** MemoryStatusCard, ActiveContextsList, RecentChatHistory, CompactionsPanel, ContextSearchBar, SettingsPanel
- **4 dedicated IPC endpoints:** Context maintenance operations

##### 6.2.12 Page Context Tab
- **Sub-tab of:** Context group
- **Icon:** `FileText` (accent)
- **Component:** `PageContextPanel` (imported component)
- **Feature:** Structured page context metadata display
- **Displays:** Page identity, component tree, IPC endpoints, data flow, connections to other pages

#### 6.3 Layout & Group System
- **N-ary tree layout:** `PaneNode.children` refactored from binary tuple to array for flexible splits
- **Group extraction:** `extractGroups()` helper collects terminals into top-level split groups with equal screen space
- **Layout persistence:** Save/load via `workspace:save` / `workspace:load` IPC
- **Persistent save indicator:** Workspace name shown with green dot in sidebar header, clickable to save
- **Saved Workspaces inline list:** Always-visible list in Configs tab with Load/Delete per workspace
- **Auto-session creation:** Toggle in Configs tab to auto-create sessions when model is active
- **Layout auto-sync:** Panes auto-populate `terminalTabs` state on layout changes
- **MapEditor:** Drag-to-rearrange + drag-to-split with `@dnd-kit` library
- **Split handle drag resize:** Mouse-based divider dragging for pane resizing
- **TerminalPane hover controls:** Split/close buttons appear on hover
- **Workspace state:** Saved to `workspace_state` DB table (sidebarWidth, activeGroup, terminalTabs)

#### 6.4 AI Agent Integration
- **Supported Agents:**
 - OpenCode (`opencode`)
 - Claude Code (`claude`)
 - Codex (`codex`)
 - Aider (`aider`)
 - Cursor (`cursor`)
- **Agent switching:** Agent can be changed via session edit dialog
- **Session Management:**
 - NewSessionDialog with `mode` prop (create | initialize)
 - Resume sessions via `resume_id`
 - Session categorization (category, product_area, description, auto_tags, category_confirmed)
- **Init content:** Auto-load INITIALIZE.md, custom init files, problem/request context
- **Thought Process toggle:** Injects `## Thought Process` instruction after system prompt
- **Skill DSL:** 10 widget types (select, radio, switch, slider, text, textarea, code, file, checkbox, tags) from YAML frontmatter

#### 6.5 Instruction Panel
- **Feature:** Full instruction composer with problem/request checkboxes, skill dropdown, prompt preview, and send
- **Markdown preview:** Amber headers, green checkboxes, cyan code blocks
- **Copy button:** Copies instruction text with 1.5s feedback animation
- **Persistence:** Saves to `localStorage` per sessionId, survives close/reopen
- **Cancel/Clear buttons:** Discard or clear instruction content
- **Use Skill button:** Routes skill selection through Skill DSL widget flow
- **storageKey:** Included in `useEffect` deps for reliable persistence
- **System prompt layers:** Collapsible include/exclude toggles for each layer
- **Target terminal indicator:** Shows agent readiness for target terminal
- **Escape key:** Closes the instruction panel

#### 6.6 Session Categorization
- **Feature:** Auto-categorize and manually categorize sessions
- **Categories:** feature, bug-fix, research, code-review, refactor, devops, docs, other
- **Fields:** category, product_area, description, status, auto_tags, category_confirmed
- **Category auto-analysis:** Keyword scoring fallback for automatic categorization
- **IPC:** `updateSessionCategory`, `getParsedSessionItems`, `analyzeSessionCategory`
- **Display:** CategoryBadge and StatusDot components throughout all terminal views
- **Statuses:** active, idle, completed, error, cancelled
- **@mention routing:** Dropdown appears when typing `@` in Send bar, filters by query, arrow key navigation
- **AI Metadata Contract:** AGENTS.md template with Session Metadata Requirements section
- **Session metadata auto-parsed:** Automatically parsed on each assistant message insert

#### 6.7 File Change Detection
- **Feature:** Visual pulse notification when agent files change
- **Mechanism:** `onAgentFileChanged` IPC event
- **Files affected:** AGENTS.md, PROBLEMS.md, etc. in `agent/` dir
- **Visual:** Green ping animation on Files tab icon

#### 6.8 Project Integration
- **Receives props:** `projectId`, `projectPath` from IDEProjectsPage
- **CWD:** Terminal working directory = `projectPath`
- **Scoped data:** Problems, requests, todos, presets can be project-specific
- **Project switching:** Dropdown in sidebar, persists in localStorage

#### 6.9 Workspace Save/Load
- **Save:** `workspace:save` IPC ? saves layout + activeTab + terminalTabs to `workspace_state` table
- **Load:** `workspace:load` IPC ? restores workspace state on mount
- **Auto-save:** Debounced 2s on layout/state changes
- **Minimize/Restore toggle:** Hides terminal layout + sidebar but keeps PTY processes alive

#### 6.10 Compose & Prompt Systems
- **Short compose:** Quick prompt input for active terminal
- **Long compose:** Full InstructionPanel with skills dropdown, problem/request linking
- **PromptDesignDialog:** For `generate-prompt` skill workflow (read-only prompt.md + RESULT.md textarea)
- **SkillsTab:** Use Skill button routes `generate-prompt` to PromptDesignDialog
- **System prompt layers:** Default + general additions + project additions + optional session additions
- **@mention routing:** Resolve @mentions to terminal names and session topics

#### 6.11 Terminal Management
- **New Terminal:** Spawn new terminal pane via IPC
- **Close Terminal:** Destroy terminal process via `terminal:destroy`, remove pane from layout
- **Split Pane:** Horizontal/vertical split of current pane
- **Resize:** Drag pane dividers to resize
- **Project Switcher:** ? ? arrows in header
- **Sidebar toggle:** Collapse/expand sidebar
- **Error toast bar:** Visible above terminal layout with 8s auto-clear
- **Input buffer:** Buffers keystrokes before PTY is ready, flushes on terminal:ready
- **Workspace close dialog:** Save & Close / Discard & Close / Cancel
- **Context-changed UI refresh:** Writes delta messages to active terminal on context changes

#### 6.12 Cross-Session Sync
- **touched_files DB table:** Tracks file edits per terminal for conflict detection
- **File Lock Manager:** In-memory lock registry with 60s TTL sweep for automatic lock cleanup
- **Conflict detection:** `detectEditsInOutput()` scans agent output for file write patterns in both `terminal:create` and `spawn-terminal` handlers
- **Lock cleanup:** Automatic on terminal kill (process destroyed ? locks released)
- **7 IPC handlers:** `lock-file`, `release-file-lock`, `get-file-locks`, `get-locks-for-terminal`, `get-touched-files`, `compile-sync-summary`, `broadcast-context-delta`
- **UI integration:** Conflict toast notifications, `/sync` command interception, lock indicators in tab bar, periodic lock refresh
- **Context broadcast:** Enhanced `context-changed` batch event with `source`/`actionCount`/`failCount` metadata
- **Configs tab controls:** Master toggle, TTL slider (30-600s), context broadcast toggle, conflict mode dropdown, `/sync` toggle

---

## °Å¸”Å 7. External Page (`/external`)

**Component:** `src/pages/ExternalPage.tsx`

### Core Features:

#### 7.1 External Activity Tracking
- **Feature:** Track AI tools, websites, and external activities
- **Data Source:** get-external-activities, `get-external-sessions` IPC
- **Shows:** Activity name, duration, category, sessions count
- **get-external-activities type fix:** type field properly persisted

#### 7.2 Time Audit Comparison Card
- **Feature:** Amber (external) vs emerald (internal) hero numbers with side-by-side comparison
- **Progress bars:** Visual comparison of external vs internal time
- **Gradient orbs:** Decorative gradient orbs on each side

#### 7.3 Consistency Score
- **Feature:** Measures consistency of external tool usage
- **Calculation:** Based on daily usage patterns
- **Display:** Score with emoji indicator

#### 7.4 Sleep Tracking
- **Feature:** Manual sleep session tracking with PastSleepModal
- **Add Sleep:** `add-manual-sleep` IPC
- **Wake Up:** `confirm-wake-up` IPC
- **PastSleepModal:** Date picker, edit mode, day arrows for navigation
- **Sleep Trends Chart:** Floating range bars crossing midnight axis
 - Pre-sleep segment (amber)

 - Sleep segment (indigo)

 - Post-wake segment (rose)

- **Sleep chart respects period:** Shows correct number of days (1/7/30/90)
- **Sleep chart click:** Each day bar is clickable ïÂ¿Â½ opens date-prefilled modal
- **Sleep date advancement fix:** 10-hour heuristic for fell-asleep date
- **Sleep detection redesign:** Window focus/blur tracking, sleep pattern recognition (14 sessions), edit mode
- **Sleep stats removed:** Table removed in favor of floating range chart

#### 7.5 Activity Detail Panel
- **Feature:** Click activity to see detailed stats
- **Shows:** Total time, sessions, daily breakdown chart
- **Drill-down:** View individual sessions
- **Inline activity detail view:** Below grid, stats+charts+sessions, respects period

#### 7.6 Activity Charts
- **3 glass-styled charts:** Daily Usage Trend (vertical bar), Activity Distribution (doughnut), Weekly Trend (vertical bar)
- **Chart respects period selector**

#### 7.7 Period Selector
- **Feature:** Uses top nav period selector (removed duplicate from page)
- **Options:** Today, Week, Month, All
- **Affects:** All charts and stats

#### 7.8 Always-Visible Timer
- **Feature:** Persistent stopwatch at top of external page
- **When idle:** Shows "00:00:00" with "Click to start tracking"
- **Enhanced stopwatch:** Pulsing status dot, 6xl monospace gradient timer, pill-shaped action buttons
- **Pause/Stop controls:** Pause uses pausedAtRef + pausedDuration accumulators, stop passes adjusted end time

#### 7.9 Start/Stop Tracking
- **Start:** `start-external-activity` IPC
- **Stop:** `stop-external-activity` IPC
- **Add Manual Session button:** For past sessions without live timer
- **`remove-activity` handler:** Added for deleting activities
- **AFK session external save fix:** `stop-afk-session` falls back to ANY running session

#### 7.10 Activity Sessions Management
- **Activity sessions edit/delete:** Hover-revealed Pencil/Trash buttons on session items
- **Uniform activity button height:** h-[140px] with always-visible duration

#### 7.11 Gaps (unused time in period)
- **Gaps button (header):** Opens `GapsListModal` (`src/components/external/GapsListModal.tsx`) listing ALL gaps in the current period — time range, day label, top suggested activity, duration badge, per-row Fill button
- **Fill:** Per-gap Fill opens the existing single-gap `GapFillModal` (drag reorder, suggestGapActivities auto-fill, used/remaining, Remove)
- **Gap detection:** `detectGaps(allSessions, periodStart, periodEnd, 5)` in `src/lib/external/gaps.ts`; empty state "No gaps in this period"
- **Legacy GapFillDrawer** in App.tsx (`open-gap-panel`) still reachable via global banner — distinct from page-level list

---

## °Å¸“Å  8. Insights / Reports Page (`/reports`)

**Component:** `src/pages/InsightsPage.tsx`

### Core Features:

#### 8.1 Tab Navigation
- **Feature:** Three-tab interface for different insights views
- **Tabs:** Day / Weekly / Activities

#### 8.2 Typical Day Heatmap
- **Feature:** Color-coded 7ïÂ¿Â½24 grid with intensity-based coloring
- **Shows:** Activity intensity across days of week and hours of day

#### 8.3 Stat Cards
- **Feature:** 5 stats row with trend indicators
- **Details:** Gradient backgrounds, hover animations, trend arrows

#### 8.4 Day of Week Bar Chart
- **Feature:** Productivity per day of week
- **Details:** Color-coded bars with productivity percentage

#### 8.5 Sleep & Recovery Chart
- **Feature:** Grouped bar chart comparing sleep hours vs deficit over time
- **Visual:** Side-by-side bars for each day

#### 8.6 Activity Breakdown
- **Feature:** Animated horizontal bar chart
- **Details:** Progress bars with % labels, session counts per activity

#### 8.7 Daily Activity Trend (Activities tab)
- **Feature:** Bar chart showing daily activity duration over time

#### 8.8 Activity by Category (Activities tab)
- **Feature:** Doughnut chart showing category distribution

#### 8.9 Chart.js Tooltips
- **Feature:** Dark theme styling for all chart tooltips

#### 8.10 Period Selector
- **Feature:** Respects selectedPeriod from top nav
- **Note:** Period selector removed from page (uses top nav only)

---

## °Å¸—âïÂ¸Â 9. Database Page (`/database`)

**Component:** `src/pages/DatabasePage.tsx` (~2000 lines, rewritten)

### Core Features:

#### 9.1 Analytics Dashboard (Default View)
- **Feature:** Data analytics overview with stat cards and charts
- **5 stat cards:** Total tokens, total cost, session count, etc.
- **8 charts:**
 - Token distribution

 - Cost distribution

 - Session count by agent

 - Category distribution

 - Problem distribution

 - Request distribution

 - Response timing (paired sequential user?assistant messages per session)

 - Daily trend

- **AI usage summary:** Aggregate stats about AI agent usage
- **Problems/Requests progress bars:** Visual completion tracking
- **Promise.allSettled:** Each data source fetched independently (no cascade failures)

#### 9.2 View Toggle
- **Feature:** Switch between Analytics and Tables views
- **UI:** Analytics/Tables tabs in header

#### 9.3 Table Search
- **Feature:** Filter tables by name
- **UI:** `tableNameFilter` search input, case-insensitive substring match

#### 9.4 Tables View
- **Feature:** Browse SQLite database tables
- **Shows:** filterable table list ? table content with schema + paginated data + CSV export

#### 9.5 JSON Mode Support
- **Feature:** Shows JSON data when SQLite fails
- **Virtual table:** "logs" table from deskflow-data.json
- **Auto-fallback:** Switches to JSON when SQLite unavailable
- **Self-heal:** Attempts to reconnect to SQLite on each API call

#### 9.6 Schema Viewer
- **Feature:** View table schema (columns, types, constraints)
- **Shows:** Column name, type, nullable, default

#### 9.7 Database Stats
- **Feature:** Database file size, table count, row counts
- **Shows:** Storage usage, fragmentation

---

## ¢Å¡â¢ïÂ¸Â 10. Settings Page (`/settings`)

**Component:** `src/pages/SettingsPage.tsx`
**Reference:** `agent/docs/SETTINGS_PAGE_FEATURES.md` (full details)

### Core Features:

#### 10.1 Category Management
- **Feature:** Reassign app categories
- **UI:** Carousel with search, visual indicators
- **Operations:** Drag-drop, bulk assign, reset to defaults
- **Persistence:** Saved to database, applied across app
- **Custom Categories UI:** Input + Add button, category pills with delete, auto-assigned to Neutral tier
- **ALL category selection panels** use allCategories (defaults + custom)

#### 10.2 Color Customization
- **Feature:** Customize app colors
- **Color picker:** Per-app color selection
- **Reset:** Revert to default colors

#### 10.3 Tracking Settings
- **Timer Behavior:** Start/stop/pause behavior
- **Tracker App Mode:** (setting details in Settings page)
- **Auto-start:** Start tracking on app launch
- **App Switch Debounce:** Configurable delay (Off/1s/2s/3s/5s) before confirming app switches
- **Sleep Gap Detection:** Time before app is considered "sleep" (presets: 5s/10s/15s/30s)
- **Max Session Duration:** Maximum app session length (presets: 1m/3m/5m/10m)
- **Transient app filter toggle:** Filter out short-lived background apps
- **Model config section removed** (belongs in terminal settings)

#### 10.4 Browser Rules
- **Domain Rules:** Auto-categorize websites
- **Keyword Rules:** Classify by URL keywords
- **Add/Edit/Delete rules**

#### 10.5 General Settings
- **Launch on startup**
- **Minimize to tray**
- **Theme selection** (light/dark/system)
- **Language selection**
- **Prompt History section:** Preset limit buttons (3/5/10/20/50/100) + custom input for history display count

#### 10.6 System Prompts Tab (Tab 5)
- **Feature:** Per-agent prompt editors
- **Agents:** claude, opencode, custom
- **4-level system prompt merge:** default + general additions + project additions + optional session additions
- **DEFAULT_SYSTEM_PROMPT in `defaults.ts`:** Comprehensive ~280-line version

#### 10.7 Data Management
- **Export data:** JSON, CSV formats
- **Import data:** Restore from backup
- **Reset data:** Clear all tracking data
- **Database location:** View/change DB path

#### 10.8 Save/Reset
- **Save Changes:** Persist all settings to database
- **Reset to Defaults:** Revert all settings
- **Unsaved Changes Warning:** Modal prompts if navigating away

---

## ¢Â“ 11. IDE Help Page (`/ide-help`)

**Component:** `src/pages/IDEHelpPage.tsx`

### Core Features:

#### 11.1 Setup Instructions
- **Feature:** Step-by-step guide to configure IDE detection
- **Covers:** VS Code, JetBrains IDEs, Cursor, etc.

#### 11.2 Troubleshooting
- **Feature:** Common issues and solutions
- **Covers:** IDE not detected, wrong path, etc.

#### 11.3 FAQ
- **Feature:** Frequently asked questions
- **Topics:** Project detection, workspace usage, etc.

---

## °Å¸”Â§ App-Wide Features

### A.1 Period Selector (Top Nav)
- **Options:** Today, This Week, This Month, All Time
- **Affects:** All pages that show time-based data
- **State:** Managed in `App.tsx`, passed via props

### A.2 Time Mode Toggle (Top Nav)
- **Options:** Hours, Seconds
- **Affects:** All time displays across app
- **State:** Managed in `App.tsx`, passed via props

### A.3 Activity Type Toggle (Top Nav)
- **Options:** Apps, Websites, Combined
- **Affects:** Dashboard orbit, heatmap, etc.
- **State:** Managed in `App.tsx`, passed via props

### A.4 Navigation
- **Sidebar:** Glass-morphism sidebar with page links
- **Active indicator:** Highlights current page
- **Icons:** Lucide React icons

### A.5 Notifications
- **Toast notifications:** Success/error messages
- **Sound:** Optional notification sound
- **complete.py:** External notification script (beep + speech)

### A.6 Cross-Session Context Sync
- **Feature:** File lock manager, conflict detection, context broadcast, /sync command
- **Components:** 7 IPC handlers, file lock manager, context broadcast system
- **Conflict resolution:** 12-step resolution protocol, auto-merge on compatible changes

### A.7 Skill DSL
- **Feature:** Dynamic UI generation from SKILL.md frontmatter
- **Widget types:** 10 widget types (text, select, slider, toggle, button, etc.)
- **Validation:** Schema validation for skill frontmatter
- **Groups:** Hierarchical widget grouping with layout directives

### A.8 Context Management System
- **Feature:** 6 knowledge system toggles (Graphify, LLM Wiki, Obsidian, PARA, QMD, Skills)
- **SVG context map:** Visual representation of active knowledge sources
- **Token budget:** Configurable token allocation per system

### A.9 Session Categorization
- **CategoryBadge:** Visual badge component with color-coded categories
- **StatusDot:** Status indicator (active/idle/completed/error/cancelled)
- **@mention routing:** Resolve @mentions to terminal names and session topics
- **AI metadata contract:** Structured session metadata (title, description, category, product_area)

### A.10 Terminal Agent Readiness
- **Feature:** State machine for agent lifecycle management
- **Agent signatures:** Unique agent identification protocol
- **Message queuing:** Ordered message delivery with backlog recovery

---

## Feature Status Summary

| Page | Status | Completion |
|------|--------|------------|
| Dashboard | ¢Å… Complete | 98% |
| Stats | ¢Å… Complete | 95% |
| Productivity | ¢Å… Complete | 95% |
| Browser Activity | ¢Å… Complete | 95% |
| IDE Projects | ¢Å… Complete | 98% |
| Terminal/Workspace | ¢Å… Complete | 98% |
| External | ¢Å… Complete | 98% |
| Insights/Reports | ¢Å… Complete | 90% |
| Database | ¢Å… Complete | 95% |
| Settings | ¢Å… Complete | 98% |
| IDE Help | ¢Å… Complete | 100% |

---

## Recent Feature Additions

### 2026-09-20: IDE Projects Page — Language Detection Fix + Stats Bar + Expand/Collapse All
- Fixed `detect-project-language` (single) in main.ts: added `CODING_EXCLUDE` set (JSON, Markdown, YAML, TOML, XML) so Markdown/docs don't win over actual coding languages. Falls back to overall top if only non-coding files exist.
- Added `showLanguageStats` state (default true) + toggle button in Projects tab toolbar.
- Language stats now render on card headers by default: top 2 languages with percentages, `+N` for remaining. Falls back to `primary_language` if no scan data.
- Added Expand All / Collapse All button pair in Projects tab toolbar.
- Fixed topbar overlap: added `pt-6` to PageShell container.

### 2026-08-07:
- Life Interconnected River round-03 close-out (back-and-forth collaboration, specialist answers): (1) TodayTributary creation UI — Plus button per column: Covenant â NewCommitmentModal (covenant.addCommitment), Gold â inline CriteriaBuilder reusing GoldPage's exported defaultCriteria/criteriaToGoal, Vault & Memories â inline LTG form (title/category/priority/deadline/description) via onAddLTG + Upload for memory files; LifePage owns persistence (handleAddGoal â api.saveGoal(today); handleAddLTG â api.saveGoalsBatch with period:'longterm', date:'2000-01-01', id:ltg_<ts>_<rand>). GoldPage now exports CAT_META/catDot/defaultCriteria/criteriaToGoal/LTGForm/emptyLTGForm/PRIORITY_OPTIONS. (2) Dead code deleted: river.tsx (LifeRiver) + phase-drawer.tsx (zero importers). (3) MemoryCard idPrefix prop â layoutId per-grid (`tributary`/`phase-${id}`, bare `memory-${id}` default).
- Finance Monthly Recap typography (user: "recap has ridiculously ugly fonts"): font-selection skill round — USER-PICKED classic-authority pairing = Libre Caslon Text 700 headings + Source Serif 4 narrative body + JetBrains Mono numbers, applied to RecapPanel (hero + empty-state AnimatedGradientText titles `font-caslon`, "Follow Through" / "The Month's Story" h3s `font-caslon`, narrative paragraphs `font-serif`, NumberTicker stat values `font-mono`). New `--font-caslon` token in index.css @theme; Libre Caslon Text added to Google Fonts in index.html. GOTCHA: AnimatedGradientText doesn't forward `style` â font via className utility.

### 2026-08-06:
- Life Phases "River of Years" (Gold warmth page â LifeRiver section): proportional SVG river timeline (reach width = on-canvas date span, height â magnitude 0–100 â 10–116px), dashed open-water future with shimmering plus-signs, golden now marker, tributary curves, adaptive zoom (5 levels) + minimap + year ruler, prefers-reduced-motion respected
- Phase drawer (right sheet): 8 categories, 6-color palette + auto, magnitude slider with words, start/end year+month, in-canvas title rename, delete arm (3s), milestones, phase-to-phase connections, impact notes; ReflectionFlow 3-question wizard â AI serif reflection; Era Trends chips (World/Culture/My field, sky/violet/amber); Journey Summary blockquote via backend AI; empty state with 3-card example plan
- Backend: `life_phases` + `life_timeline_meta` tables (guarded migration), 7 IPC `lifePhase:*` handlers (get/getSummary/save/delete/saveAll/aiReflect/aiEraTrends/aiSummarize), preload `lifePhase*` (8 methods), starter phase seeded
- New base-ui primitives: `src/components/ui/{sheet,slider,textarea,alert,label}.tsx`; Source Serif 4 added to Google Fonts in index.html

### 2026-06-23:
- AI Usage Cityscape visual overhaul: window atlas shader, neon edge trim, procedural NeonGround, GPU Atmosphere particles, morph transitions, chromatic aberration + noise + SMAA post-processing, hover/select pulse
- Cityscape rooftop agent-name sprites, smog clouds, wet reflective ground, graphics quality toggle (Cinematic/Balanced/Performance)

### 2026-06-19:
- Navigation redesign: browser-tab-style group tabs (rounded-t-lg, bg-zinc-800/80, -mb-px), chip-style sub-tabs (rounded-full pill, no border), accent connectivity strip between nav and content
- SubTabBar redesigned: border-pill style â rounded-full chips, accent prop with static color map
- WorkspaceShell passes accent prop to SubTabBar for per-group coloring
- Session subpage grouping: collapsible sub-headers (Top Pinned, Recent, This Month, Older)
- Session filter pills: category pills below sub-tab bar
- Analytics tab: wiring for issues and bugs sub-tabs
- FEATURE_TRACKER.md updated with all recent changes
- SubTabBar accent wire: setup=orange, work=green, insights=purple, studio=indigo, context=amber

### 2026-06-02:
- Skill DSL: dynamic UI from SKILL.md frontmatter (10 widgets, validation, groups, file picker)
- AFK session duration fix (re-idle race —” computes real elapsed from started_at)
- Terminal analytics wiring (variant='full', data fetching for problems/requests/promptHistory/dailyStats)
- TerminalMiniMap height clamp fix (h-36 —’ h-full)
- Empty terminal tab agent name fix
- Dashboard TDZ crash fix
- 3 productivity data bugs (browser re-fetch, score-trend connection, unknown websites)
- Prompt entry/sending/session UID fix (RESULT.md alignment)
- Cross-session sync config IPC (5 state vars, Configs tab card)

### 2026-06-01:
- InitializeProgressModal redesign: grouped directory views, expandable previews, retry
- Cross-session conflict detection + context sync (12 steps, file locks, 7 IPC handlers)
- Thought-process toggle in workspace Configs tab
- Session init order fix (agent first, 500ms pause, then system prompt)
- AnalyticsDashboard variant prop (project/workspace/full) across 3 pages
- Import opencode sessions dialog (shift-click range)
- Problems/Requests date parsing fix ("16d ago" for all items)
- 3-terminal grouping fix (PaneNode.children binary tuple —’ array)
- Prompt entry fix: system prompt layers, real session UID via opencode session list
- Dashboard stats 0m fix (live currentProductiveMs on top of DB)
- Focus Sessions 0s fix (minDuration slider default 300—’60)
- StatsPage optimization (3 redundant O(n) computations removed)
- Activity feed stopwatch fix (always-isActive for new feed items)
- Productivity chart category mapping fix (WEBSITE_CATEGORY_MAP priority)

### 2026-05-29/30:
- Dashboard optimization: getDashboardAggregates IPC (6—’1 useMemo)
- Full sessions list with edit/delete on StatsPage
- Live tracking indicator on StatsPage
- Live Detection panel on StatsPage (50-event ring buffer, global persistence)
- TutorialPage redesign (15 page-accurate feature entries)
- Database page analytics dashboard (5 stat cards, 8 charts)
- Design Workspace tab in TerminalPage (pink Palette tab)
- GeneralistDialog: filterable grid dialog with search + category filter
- SKILL.md inputs/outputs/components frontmatter (6 files updated)

### 2026-05-25/27:
- Context Maintenance tab wired: 6 sub-components, 4 IPC endpoints
- Design skills integration: 5 skills, 8 references, 3 taste knobs
- Setup vs Initialize redesign: InitializeProgressModal, WorkspaceSettingsDialog
- IDE workspace buttons: Minimize (Minimize2), Provision (FolderTree), New Agent (Bot)
- Sleep detection redesign: window focus/blur tracking, pattern recognition (14 sessions)
- PastSleepModal: date picker, edit mode, day arrows, clickable chart bars
- Sleep chart: per-bar latency labels (3-segment bars: amber/indigo/rose)
- External vs Internal comparison card: Time Audit with gradient orbs
- Add Manual Session button for past durations
- Custom categories: add/remove persistent UI
- Prompt history: limit + delete (Settings > General)
- Agent readiness protocol: state machine (spawning—’waiting—’ready|timeout), 5 agent signatures
- Terminal:write-raw: system writes no longer pollute prompt history
- Sleep detail: floating range chart (bedtime—’wake crossing midnight axis)

### 2026-05-18/22:
- Context Management System: 6 knowledge system toggles, SVG context map, token budget bar
- Session categorization: category/status/area/tags fields, auto-parse from AI metadata
- @mention routing: dropdown on @ in Send bar, arrow key nav, Enter to send
- CategoryBadge + StatusDot components
- System prompt overhaul: 4-level merge (default + general + project + session)
- PromptHistoryTab: search/filter, delete, limit (3-100), agent filter
- PromptDesignDialog: generate-prompt skill workflow (read-only input + RESULT.md output)
- InstructionPanel + TerminalMiniMap
- Problems/Requests JSON-only data layer (MD is sole source of truth)
- Recursive split pane rendering (PaneNode tree properly interprets children)
- Save button dialog: modal for workspace name
- Terminal context system: 10+ fixes (missing imports, dead events, race conditions)
- Productive timer redesign: accumulated delta pattern (no reset on app switch)
- Activity log + AI-driven actions: 9 features (Enter sends, map split, session dropdown, etc.)

### 2026-05-12/17:
- Agent readiness protocol: Phase 1 complete (spawn-terminal handler, agent signatures, retry)
- Timeline navigation: dateOffset for Productivity, External, Stats, Browser pages
- Sleep detail table + floating range chart
- Productivity chart height/overflow fix (h-40—’h-72, hourly cap 3600s)
- Solar system 3-in-1 fix: category nav—’camera, planet tracking, timeline selector in UI
- Terminal workspace Phases 1-6 complete (split pane, presets, sessions, map, persistence)
- Data layer consolidation: Problems/Requests JSON-only (no DB sync)
- Recursive split pane rendering
- Knowledge infrastructure: PARA (6 dirs), QMD (2 templates), LLM Wiki (3 files), Obsidian frontmatter (13 files)
- README update to v2.4
- External page: 3 glass-styled charts refactor
- Auto-start registry fix: dev mode app path
- Browser extension: background tab phantom tracking fix
- Initialize system: 9 fixes (idempotent init, insertIntoLayout, NewSessionDialog mode)
- Initialize.md restructured as checklist
- Session categorization + @mention routing (Phase 1-4 complete)
- Transient app filter toggle (Settings > Tracking)
- Solar system 3-in-1: category dropdown, planet click tracking, timeline selector

### 2026-05-06/10:
- Periodic checkpointing: every 5min, long-running sessions checkpointed
- Sleep gap raised: 10s—’30s, null poll threshold 3—’30
- OS-level idle detection via powerMonitor.getSystemIdleTime()
- External page: uniform buttons, pause/stop controls, enhanced stopwatch
- External activity type fix + session editing
- AI sync efficiency: file mtime tracking, last sync display
- IDE health: fixed "unknown" crash, vcs_branch, sessions query
- Terminal workspace revamp: P0-P5 all complete
- Heatmap fix: hour-splitting algorithm, detail panel day lookup
- DayDetailPopup: click day header for timeline view
- Tracker Mind: full implementation (Problems tab, setup modal, markdown service)
- Database connection hardening: 5 critical functions use getDb()
- JSON fallback: virtual "logs" table when SQLite fails
- Default period: changed from 'today' to 'week'
- Solar system week sync with heatmap
- 12-hour format heatmap labels
- TDZ fix: useMemo—’useState+useEffect for complex objects


## Recent Feature Additions

### 2026-08-07 — Finance Monthly Recap
- **Where:** Finance page â Recap tab (FinanceTabKey 'recap'), `src/components/finance/RecapPanel.tsx`
- **Backend:** `finance_monthly_recaps` table (month UNIQUE), 5 IPC `finance:recap-{list,get,generate,delete,months-with-data}`, auto-gen `checkMonthlyRecaps` (prev calendar month, whenReady + every 6h)
- **AI:** narrative via provider chain (`buildChain` feature 'monthlyRecap') or OpenRouter fallback (`ai_briefModel`); stats frozen in `stats_json` with generation-time display currency, converted live in UI
- **Docs:** spec at `agent/docs/generate-prompt-docs/finance-monthly-recap-07082026/RESULT.md`

## NEW: Speech-to-text engine fallback chain - 2026-08-10 (session opencode-term-1-stt1)

| # | Feature | Status | Where |
|---|---------|--------|-------|
| F1 | Engine chain: Cloud API (when ` sttApiKey ` pref set) -> Windows native (System.Speech via powershell.exe) -> browser webkit; resolved via one ` stt:get-status ` call | Implemented (build OK, NOT LAUNCHED) | src/main.ts ~L5580 (STT block), src/lib/stt.ts (new), src/hooks/useVoiceInput.ts, src/components/VoiceInputWrapper.tsx |
| F2 | IPC: ` stt:get-status ` (engine/apiConfigured/nativeAvailable/label), ` stt:transcribe ` (FormData multipart to Groq-style endpoint, Bearer auth, min 512-byte audio = 'No speech detected'), ` stt:native-start `/` stt:native-stop ` (PS1 written to userData/stt-native.ps1, parsed JSON forwarded as ` stt-native-event `) | Implemented (build OK) | src/main.ts 5624-5714, src/preload.ts 97-101, src/types/deskflow-api.d.ts |
| F3 | New free-form prefs ` sttApiKey `/` sttBaseUrl ` (default https://api.groq.com/openai/v1/audio/transcriptions)/` sttModel ` (default whisper-large-v3-turbo); Settings -> General -> Voice & Speech card (password eye-toggle, immediate save, fallback-chain explainer) | Implemented (build OK) | src/pages/SettingsPage.tsx (General tab, end of section) |

## Foundation Slice (LAMINAR v1.0) - 2026-08-31

### Gates completed (design/design.md v1.0 foundation slice)
| Gate | Status | What |
|------|--------|------|
| G1 Token Collapse | DONE | Stripped Geist from body font-family; deleted .light theme block (dark-only per §5.2); removed obsolete [data-page=] keys (productivity, stats, browser, tutorial); added rankings + documentation to map; index.css @theme confirmed app SSoT (tokens.css is landing-only) |
| G2 Fonts | DONE | index.html keeps only Inter/Space Grotesk/JetBrains Mono; Geist stripped from body; @fontsource self-host deferred (not installed); Google Fonts link retained as fallback |
| G3 Name/RHEO | DONE | index.html <title> DeskFlow→RHEO; window title already RHEO; 2,521 internal DeskFlow identifiers deferred |
| G4 Data-Page | DONE | 18-route registry covered (added rankings + documentation); obsolete keys removed |
| G5 Loop Purge | DONE | Named decorative loops (aurora, mesh, shine, border-beam, df-edge-breath, scorePulse, sidebarShine, tapestry-breathe) confirmed gone; 50 infinite hits are functional (ai canvas, recording indicator, voice meter) |
| G6 CategoryColors | DONE | src/lib/CategoryColors.ts exists as single categorical source |

### TESTING probe census (18 routes)
- Build: npm run build → exit 0 (main 1,412 KB)
- Electron launched on port 38123, remote debug on 9222
- All 18 routes screenshoted → design/audit/shots/*.png (dashboard, activity, ai, learn, resume, ide, finance, insights, life, settings, guide, studio, agentic, terminal, external, database, rankings, documentation)
- Census findings:
  1. Token winner: pink --accent-primary #ec4899 (active nav tabs, TOTAL card). Amber --color-primary #fbbf24 retained for NEUTRAL status + Focus timer ring only. White is body text/state indicator only.
  2. Spring call sites: 11 useSpring (framer-motion, §16 sanctioned). 0 bare spring(). Landing/ + educational MotionPresets excluded per scope.
  3. .light reachable: NO — block deleted; dark-only enforced.
  4. Visual states missed by static audit: none — all 18 routes render LAMINAR dark mode correctly per findings.

### design/design.md reconciled with audit v1.0 (paste #4)
- §9 updated: agent/DESIGN.md → deleted; .light block → deleted; index.html title → RHEO
- Added §11 Token Collapse, §12 Fonts, §13 Name/RHEO Sweep, §14 Data-Page Registry
- Added §15 Naming Law, §16 Framer-Motion-Sanctioned Motion
- §10 Pre-Task Checklist expanded (3 new items)

## 2026-09-24  Dashboard Layout Editor (IMPLEMENTED)
- **Feature name:** Dashboard Layout Editor
- **Spec:** User-provided RESULT specification (Part 0-7 audit + implementation)
- **Files touched:** `src/components/dashboard/widgetRegistry.tsx`, `src/hooks/useDashboardLayout.ts`, `src/components/dashboard/WidgetLibraryPopup.tsx`, `src/pages/DashboardPage.tsx`, `src/components/dashboard/CardLibrary.tsx`, `src/components/dashboard/ScheduleSyncCard.tsx`
- **Decision:** Renderer localStorage (`deskflow-dashboard-layout-v1`), no IPC/backend needed
- **Known limitation:** Partial-row hide in row 4 leaves empty grid tracks in v1; 4-quarter grid collapses to fewer columns when widgets are hidden
- **What was built:** Single source of truth registry (`widgetRegistry.tsx`) with 12 widgets and ROW_TEMPLATES geometry, `useDashboardLayout.ts` hook for persistence (sanitized, self-healing), `WidgetLibraryPopup.tsx` editor with live proportional preview and grouped toggles, full integration into `DashboardPage.tsx` replacing `isCardVisible` stub with `useDashboardLayout`
- **Defects fixed:** D1 spacing drift (mb-4→mb-2), D2 trend keys verified (up/down/stable correct), D3 framer-motion→motion/react (already fixed), D4 transition-all→transition-colors, D6 removed margin-top hack
- **Status:** IMPLEMENTED
