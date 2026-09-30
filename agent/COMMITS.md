# Commit Changelog

## Latest Commit

### Commit Message
```
feat(v7.0): app-review baseline — Chat Library, external-AI transport, dashboard widget registry, find-bar + console fixes

PURPOSE OF THIS COMMIT
This commit is the REVIEW BASELINE. An app-wide quality review (every route, not one
feature) is to be run against this exact tree by Qwen. The full brief — surfaces, how to
verify, and the pre-existing issues already confirmed here so they are not re-reported as
regressions — is in agent/docs/app-review-qwen-20260930/BASELINE.md.

200 files changed, +76,232 / -10,480.

CHAT LIBRARY (new subsystem)
- src/main/ai/chatLibrary.ts (NEW) — main-process persistence + query layer for AI conversations.
- src/components/ai/chat/ChatLibrary.tsx (NEW) — library surface: list, search, pin, group.
- src/components/ai/chat/BrainSurface.tsx (NEW) — knowledge surfaced from stored conversations.
- src/components/ai/chat/ChatExportBridge.tsx (NEW) — export conversations out of the app.
- 11 new IPC channels: chat-library:ingest, :search, :stats, :groups, :group-save,
  :group-delete, :thread-group, :thread-messages, :thread-pin.

EXTERNAL AI TRANSPORT SEAM
- src/services/externalAiTransport.ts (NEW) — one prompt pipeline shared by the app and the
  browser extension, so a prompt built in one place is transportable to the other.
- New channels: aigateway:send-prompt, ollama-chat.
- src/components/ai-bridge/BridgeForm.tsx, FieldAIButton.tsx — bridge UI moved onto the seam.

DASHBOARD — WIDGET REGISTRY + JUMP NAV
- src/components/dashboard/widgetRegistry.tsx (NEW) — widgets register declaratively instead
  of being hard-wired into the page.
- src/components/dashboard/widgetNav.ts (NEW) + WidgetJumpButton.tsx (NEW) — jump-to-widget nav.
- src/hooks/useDashboardLayout.ts (NEW) — layout state + persistence hook.
- src/components/widgets/* (NEW, 11 files) — canonical widget set extracted out of
  src/components/dashboard/ (WidgetCard, WidgetGrid, StatusBand, StreakCard, GoalsCard,
  DeadlinesCard, LongestFocusCard, MomentumSummary, ProductivityChart, index).
- Three visual prototypes shipped side by side (SIGNAL / TERMINAL / NEON): 15 new files.
- DELETED src/components/dashboard/LayoutEditor.tsx and layout-editor.css — superseded by the
  registry + useDashboardLayout. The orphaned 44KB src/components/dashboard/WidgetGrid.tsx still
  imports the deleted ./layout-editor.css (known issue K3). Not a build break because nothing
  imports that file, but it is dead code that must not be revived.

NATIVE FIND BAR
- src/components/NativeFindOverlay.tsx, src/terminal/components/NativeFindOverlay.tsx —
  the previous overlay was a full-screen blurred curtain that only LISTED matching text nodes.
  It now injects real <mark> highlights via a TreeWalker and scrolls the active match into view.

PENGUIN CONSOLE
- src/terminal/hooks/useConsoleStore.ts — real/demo separation now filters on a POSITIVE tag
  (keep only real === true), so simulated rows, MOTD, and untagged legacy rows from older builds
  can no longer leak into REAL mode.
- src/terminal/lib/shell.ts, lib/types.ts, components/CommandNotesPanel.tsx.
- src/styles/terminal-handbook.css (NEW) — Terminal Handbook tokens (--hb-*) ported from
  terminal-handbook.html at the repo root.

LINUX FOREGROUND DETECTION
- src/main/linuxForeground.ts (NEW) + src/linuxForeground.ts, src/gameDetection.ts.
- scripts/diagnose-linux-foreground.mjs (NEW) — standalone diagnostic.

SETTINGS
- src/pages/settings/ColorsSection.tsx (NEW), PromptsSection.tsx (NEW) — new Settings sections.
- src/pages/settings/AdvancedSection.tsx, shared/TierContainer.tsx, shared/index.tsx.
- src/lib/tierColors.ts (NEW) — shared tier colour tokens.

NEW IPC SURFACE — 34 channels added in total
- Chat/AI: chat-library:* (11), aigateway:send-prompt, ollama-chat, add-ai-change-history,
  get-ai-change-history, clear-ai-change-history, redo-ai-change, undo-ai-change.
- Keywords: add-keyword-domain, remove-keyword-domain, get-domain-keyword-rules,
  set-domain-keyword-rules, get-keyword-enabled-domains.
- Locked items / tiers: get-locked-items, set-locked-items, get-unlocked-items,
  set-tier-assignments.
- Reminders/workspace: create-reminder, initialize-workspace.
- Todo popup: todo-popup:close, :focus-main, :get-state, :minimize, :set-pinned, :toggle.
- Terminal: terminal:exec (async spawn with ignored stdin — never execSync on the main thread).

LIFE / WARMTH
- src/features/warmth/LifePage.tsx, schedule/SchedulePage.tsx, habits/HabitsPage.tsx,
  self/SelfOrchestrator.tsx, life-river/PhaseContextExpanded.tsx — add-button and WeekReview
  crash fixes.

CONTENT ENGINE / OVERLAY STUDIO
- src/features/content-engine/components/ExternalAIBridge.tsx, ExternalAIBridgeField.tsx,
  FrameworksView.tsx, ui.tsx.

MULTI-AGENT COORDINATION FIX
- agent/docs/.../agent-coordination/coord.mjs — the CLI was a SILENT NO-OP on Linux: the
  entrypoint guard compared `file://${process.argv[1]}` against import.meta.url, but argv[1] is
  relative, so main() never ran and every command (register/claim/status/wrappers) exited 0
  with no output and no registry write. Now uses pathToFileURL(), which also fixes paths
  containing spaces (this repo lives under "App Tracker"). Added a loud warning when a claim is
  made with no peer agents registered, so a claim cannot be mistaken for exclusive access.

PAINT SKILL (new design orchestrator)
- agent/skills/paint/SKILL.md (NEW) + references/conflict-resolution.md, mcp-routing.md,
  skill-playbooks.md (NEW) — the conductor that sequences all design work.
- agent/skills/skill-router/SKILL.md — routed all design work through paint; version bumped.

VERSION HISTORY UPDATED
- README.md — Version History gains 7.0 (2026-09-30) marked as the app-review baseline, plus a
  matching Development Highlights entry.
- landing/src/components/rheo/Changelog.tsx — ENTRIES gains v0.2.0 (2026-09-30).
- landing/src/components/rheo/Download.tsx — VERSIONS gains the same v0.2.0 row. Both arrays are
  newest-first and rendered generically, so this is a data-only change; no render logic touched.
- NOTE: the website (0.x) and the README (integers) run two independent version schemes that are
  not derived from each other. Recorded as known issue K4 rather than silently unifying them.

BUILD / CONFIG / DEPS
- vite.config.ts — optimizeDeps.entries pinned to index.html; server.fs allow/deny lists added
  so the dev server stops walking agent/, dist-electron/, graphify-out/, rheo-landing/, etc.
- package.json — added thinking-orbs ^0.3.2. rheo-landing/package.json — added framer-motion.
- .gitignore — ignore .build-lock (a transient PID file written by scripts/build.mjs that was
  about to be committed as a review baseline).
- scripts/zip-src.mjs, scripts/diagnose-linux-foreground.mjs.

AGENT STATE + DOCUMENTATION
- agent/SURFACES.md (NEW) — colloquial-word -> route -> owning-file index, force-loaded so an
  agent stops grepping for words the user already supplied.
- agent/state.md + 6 new spokes; MEMORY.md, agent/MEMORY.md, MEMORY_FULL.md, dictionary.md,
  FEATURE_TRACKER.md, docs/TERMINAL_SYSTEM_FIX_PLAN.md, docs/WORKSPACE_ARCHITECTURE.md.
- New prompt-doc sets: dashboard-cards-redesign-24092026, dashboard-style-redesign-28092026,
  dashboard-widgets, plus agent-animation-context-pack.md and ai-provider-router-plan.md.
- agent/docs/workspace-terminal-qwen-audit/ — the previous Qwen audit (6-phase report); included
  as the precedent format for this review.

VERIFICATION STATUS (stated honestly, not claimed green)
- Build artifacts are FRESH relative to source: dist-electron/main.cjs 22:34, preload.cjs 22:36,
  dist/index.html 22:36, all newer than the last source edit (src/main.ts 20:16).
- npx tsc --noEmit --project tsconfig.app.json FAILS. All failures are PRE-EXISTING and are not
  introduced by this changeset:
  (K1) src/terminal/index.ts imports MCP_RESOURCES, MCP_PERIPHERALS, TOOL_NAMES, DEFAULT_PRESET,
       ANOMALY_LABELS, ANOMALY_ACTIONS from ./lib/data, which exports none of them. Neither file
       is touched by this diff.
  (K2) src/terminal_backup/ is a TRACKED backup directory that the typecheck config compiles,
       producing ~30 further errors from broken imports.
- No Probe MCP runtime verification was performed this cycle (the app was not launched under a
  debug port), so no UI feature in this commit is claimed as runtime-verified.
```

**Date:** 2026-09-30

### Detailed Changes

### Commit Statistics
- **Files Changed:** 201
- **Insertions:** +76,377 lines
- **Deletions:** -10,480 lines
- **Net Change:** +65,897 lines
- **Purpose:** app-review baseline for a Qwen quality pass (see
  `agent/docs/app-review-qwen-20260930/BASELINE.md`)

---

## Previous Commit

### Commit Message
```
feat: wire Content Engine → Overlay Studio handoff (replace Assemble stub) + transcript caption track + episode Assets tab

## Content Engine ↔ Overlay Studio integration (fixes the "unconnected" handoff)
- src/features/content-engine/components/AssembleView.tsx — "Send to Overlay Studio" was a STUB (toast + dead onPhaseChange('studio')). Now fetches cut list + overlay plan + caption track in parallel and emits a real handoff payload (episodeId, title, niche, cutList, overlayPlan, captionTrack, transcriptSegments) into Overlay Studio via studioHandoff bus; also persists the link via content:episodes:link-overlay. Removed unused onPhaseChange/GhostButton.
- src/features/overlay-studio/handoffBus.ts (NEW) — tiny cross-tree event emitter so Content Engine (separate React tree under the 3-mode toggle) can push a handoff payload into Overlay Studio's StudioProvider.
- src/features/overlay-studio/OverlayStudioPage.tsx — StudioPageInner now subscribes to studioHandoff and, on handoff, dispatches LINK_EPISODE and switches mode to 'studio' (the 3-mode toggle shares no state, so this is the bridge).
- src/features/overlay-studio/state/studioReducer.ts — new LINK_EPISODE (creates/updates a StudioSession with episodeId, transcript, cutPlan, captionTrack, status 'linked', activeStage 'visualizer') and SET_CAPTION_TRACK actions. Removed unused AsyncStatus import.

## Backend IPC (new + fixed)
- src/services/contentEngine/index.ts — migration: add overlay_session_id (TEXT) + caption_track (JSON) columns to content_episodes (idempotent ALTER). mapEpisode now returns caption_track. NEW handler content:episodes:link-overlay (persist overlay_session_id). NEW handler content:edit:caption (deterministic transcript→caption track via src/lib/captionBuilder.buildCaptionFromTranscript, SEO-phrase aware, stores caption_track + caption). FIX content:edit:cutlist to resolve the latest evaluated/selected take when takeId omitted (was a latent bug — handler errored without takeId; AssembleView call omitted it).
- src/preload.ts — expose episodeLinkOverlay + editCaption bridges; editCutlist/editOverlayPlan already present.

## Caption + Assets UI
- src/features/content-engine/components/EpisodesView.tsx — Script tab "Post Copy" card now also renders the episode caption_track (timed lines + highlight) with an "Export .srt" button (copies SRT to clipboard). Assets tab replaced the "coming soon" empty state with a real library: caption track card + linked Overlay Studio session chip (or a guided empty state).

## Docs (generate-prompt skill artifacts)
- agent/docs/generate-prompt-docs/content-engine-overlay-handoff-31082026/CONTEXT_BUNDLE.md — code/IPC/DB reference for the handoff.
- agent/docs/generate-prompt-docs/content-engine-overlay-handoff-31082026/MOTION_ASSET_CONTEXT.md — motion-lab HTML primitive + Playwright recorder reference for asset generation.
- agent/docs/generate-prompt-docs/content-engine-overlay-handoff-31082026/PROMPT.md — design spec (handoff + caption + motion asset render) per project generate-prompt skill.

Build: npm run build green (4/4 steps). Note: repo-wide eslint still flags pre-existing `any` usage in contentEngine/index.ts/preload.ts (baseline, not introduced here).
```

**Date:** 2026-08-31

### Detailed Changes

### Commit Message
```
feat: Lyceum round-02 runtime fixes (CSP unsafe-eval, finchart v5 API, sankey CSV grammar, insertNode upsert) + accumulated multi-session work (life phases overhaul, top-bar smart fill, sleep day-lookup fix)
```

**Hash:** `10dc7a8`
**Date:** 2026-08-09

### Detailed Changes

#### Lyceum Learn — round-02 runtime verification fixes (opencode-term-1-lyc2)
- **`src/main.ts`** — CSP `script-src` now includes `'unsafe-eval'` (onHeadersReceived ~19414): fixes ChartBlock CSP violation — vega-lite compiles spec expressions via `new Function`.
- **`src/components/learn/blocks/FinChartBlock.tsx`** — lightweight-charts v5 API: `chart.addLineSeries()` etc. are REMOVED; series created via `chart.addSeries(lwc.LineSeries/AreaSeries/HistogramSeries/CandlestickSeries, opts)` (named exports). Fixes `addLineSeries is not a function`.
- **`src/components/learn/blocks/FlowBlock.tsx`** — sankey now emits RFC 4180 CSV (`sankey-beta` header + one `source,target,value` row per link, quoted when fields contain `,`/`"`). Mermaid 11.16 sankey grammar is CSV — `A --> B : 10` NEVER parses (`Expecting 'COMMA', got 'NEWLINE'`); empirically verified in node. ⚠ Corrects round-01's wrong `A --> B : 10` claim (also fixed in COMMITS.md 6fc82f3 entry below is superseded by this).
- **`src/services/learn/db/repo.ts`** — `insertNode` now `ON CONFLICT(id) DO UPDATE`: re-importing a CHANGED lesson no longer throws `UNIQUE constraint failed` and rolls back the whole import. Deliberately NOT `INSERT OR REPLACE` (learn_progress FK ON DELETE CASCADE would wipe progress).
- **Docs** — `conversation/round-02.md` (root causes + fixes + verification); `PROBLEMS.md` new R1–R5 section + P5 superseded note (total 145); `MEMORY.md` corrected the 08-08 sankey rule + added CSP / lightweight-charts-v5 / insertNode-upsert / DB-byte-scan lessons.

#### Life Phases Overhaul (opencode-term-1-layo)
- **`RingCanvas.tsx`**, **`TimelineView.tsx`**, **`ConnectionDataStrip.tsx`**, **`CoreSample.tsx`**, **`NotesTab.tsx`** (new) — ring & grain design for life-phase periods; period context split (main returns SQLite aggregates only; memories/covenant filled renderer-side).
- `RiverMap.tsx` / `PhaseCard.tsx` / `phase-form-dialog.tsx` / `reflection-flow.tsx`, `LifePage.tsx`, `useLifePhases.ts`, `riverMath.ts`, `index.css` — visual overhaul per RESULT (10).md.

#### Sleep day-lookup + top-bar Smart Fill (opencode-term-1-mojib)
- `main.ts` — `get-sleep-for-date` rewritten to local grouped-evening window (`started_at ∈ [X 12:00, X+1d 12:00)` ASC, first match) — fixes "popup stuck at 7 / wrong night" in UTC+7.
- `App.tsx` — top-bar Smart Fill button dispatching `open-gap-drawer`; `ExternalPage.tsx`/`GapFillModal.tsx` reorder; `ActivityMosaic.tsx`, `grid.ts`; `preload.ts` + `deskflow-api.d.ts`.

#### Agent state & docs
- Spokes: `opencode-term-1-4de3`, `-hrcx`, `-layo`, `-lyc2`, `-mojib`; `agent/state.md` regenerated; `FEATURE_TRACKER.md`, `agent-reflect/problem.md`, `generate-prompt-docs/lyceum-hierarchy-expansion-08082026/`, `backandfourth-docs/life-phases-overhaul-08082026/conversation/round-02.md`.

### Detailed Changes — 6fc82f3 (2026-08-08, previous commit)

#### Lyceum Learn — 9 renderer bugs fixed (opencode-term-1-lyc2 round-01)
- **`src/components/learn/blocks/mermaidLoader.ts`** (new) — mermaid 11.16 hangs when `initialize()` runs before EVERY render; initialize EXACTLY ONCE per session + 15s render timeout with readable error. Used by MermaidBlock + FlowBlock.
- **`TableBlock.tsx`** (rewritten) — imports `tabulator.min.css` + `tabulator_site_dark.min.css` (Tabulator v6 themes are CSS-only; `theme:'dark'` silently ignored → unstyled stacked text); auto-heal via `isDynamicImportFailure → autoHealDynamicImport`; plain-HTML fallback table inside error `<details>`.
- **`FlowBlock.tsx`** — sankey emits `A --> B : 10` (JSON.stringify quotes + `|value|` labels hang sankey-beta); error panel shows the REAL rendered source (`edgesToMermaid`).
- **`ChartBlock.tsx`** (rewritten) — auto-heal on dynamic-import catch (old `.catch` swallowed errors so global self-heal never fired); container cleared between renders; Retry button + spec display.
- **`FinChartBlock.tsx`** (rewritten) — `extractData()` pulls from vega-lite `spec.data.values` (parser stores FULL spec → old code threw "No data series found"); line/bar/area mark detection; multi-series; tick labels; cleanup fixed (`chart.remove` now runs); auto-heal + Retry.
- **`CodeBlock.tsx`** — single-pass highlight (one regex alternation over escaped source: strings→comments→numbers→keywords); spans can never be re-tokenized (fixes `class="text-emerald-400">400"</span>` corruption).
- **`WidgetHost.tsx`** — per-block remount key + retry button + error reset on content change.
- **`parseLessonMarkdown.ts`** — directive open regex `^:{3,}(?:\s+)?(\w+)`: `:::illustration` without space now parses as a directive (was prose); bare `:::` closes; 4+ colons always close.
- **`PendingIllustrationsPanel.tsx`** — EVERY illustration card (pending AND done) shows prompt + Copy + Upload/Replace; done items show image preview (white bg for `file://`).
- **`resources/learn/author-guide.md` + `prompts/master-prompt.md`** — contract v4.0 (`#` H1 nodes, `::: kind`/bare `:::`, `know:` ends `[source_id]`, block-variety rules).
- **Lyceum services** — `learn:validate`/`generateLdoc`/ImportService pass `publishedIds`; `checkVisual` matches parser's 19-type VISUAL_TYPES; promptLibrary/learnerProfile updates.
- **`HierarchyGuide.tsx`** (new) — hierarchy tree visualization wired into LearnHome + OnboardingPanel; `MASTERY_LABELS`/`MASTERY_SHORT`; Part→Topic + Chapter→Group label renames; `/learn` route ErrorBoundary (App.tsx).

#### Finance Monthly Recap AI-output cleaning (opencode-term-1-layo)
- **`src/shared/recap.ts`** (new) — `cleanRecapSummary` heuristic cleaner + `computeApexInsight`; wired at generate-time (`finance:recap-generate` stores cleaned summary; fallback + status 'failed') AND render-time defensively in **`RecapPanel.tsx`** (new; narrative memo fixes legacy verbatim rows); apex insight from REAL stats in `stats_json`.
- `finance-types.ts` + `FinancePage.tsx` integration; `router.ts` buildChain feature union extended.

#### IDE Analytics + VS Code Extension (opencode-term-1-backf)
- **`vscode-extension/`** (new) — VS Code extension capturing code activity (crypto.randomUUID ids → idempotent INSERT OR IGNORE), posts to `localhost:54321/code-activity`.
- **`main.ts`** — always-on `/code-activity` route on capture server (sibling of `/browser-data`, not gated on browser-tracking pref); `code_activity` table; `get-code-activity-stats` IPC + `codeActivity` on `get-ide-projects-overview`; preload `getCodeActivityStats`.
- `IDEProjectsPage.tsx`/`AnalyticsDashboard.tsx` — Live Pulse grid + Coding Activity chart.

#### AI Tools timeline (opencode-term-1-yzjl)
- `AIToolsTab.tsx` — per-tool "Tool Usage Timeline" (`byTool[toolId].daily`) + dominance "phases" strips (contiguous winner-per-day chips) beside the existing all-time Model Usage Timeline.

#### Life Phases / River + Gold + Memories (opencode-term-1-lriv)
- `PhaseCard`, `RiverMap`, `TodayTributary`, `memory-lightbox`, `phase-drawer`, `river-canvas`, `river`, `riverMath`, `LifePage` — color-customizable phases, no translucent overlays on card content.
- `GoldPage.tsx` gold tab + `MemoryCard.tsx` updates.

#### Canvas drag/group/resize + Focus Groups (opencode-term-1-solar / fgrp / auto)
- `CanvasCard`/`GroupCard`/`canvas.css`/`useCanvasState`/`canvas.ts` — pointer-cancel fallbacks, 2px drag threshold, grid-coord drop targets, group card real-content rendering (`renderChild`).
- Focus: `FocusAppPicker`, `FocusGroupEditor`, `FocusLeaderboard`, `FocusSection`, `shiny-button.tsx` accent/borderClass via `cn()`.

#### Misc fixes + infra
- `ExternalPage.tsx` — sleep excluded everywhere except Sleep Patterns card + Add/Edit flows (user rule); `StatsPage.tsx`, `main.ts` pollForeground tracker-app handling.
- `OrbitSystem`/`AICityscape` solar render fixes; `scripts/build.mjs` now compiles `src/lib` into dist-electron (was missing → runtime "Cannot find module ../lib/mojibake"); `index.html` Source Serif 4 font; `index.css` `--animate-gradient` theme token; preload/main/preload-API types sync.
- Agent infra — PROBLEMS.md P1-P9 section, MEMORY.md durable lessons (mermaid init-once, sankey syntax, tabulator CSS, spec.data.values, directive regex, per-file service compile), state hub + session spokes, `round-01.md`/`errorsfound.md`/`lesson.txt` for lyceum-featurefix-08082026, life-phases overhaul docs, canvas drag/group docs, finance recap RESULT, font-selection skill.

#### Stats/Activity/External/Finance Reorganizations
- **StatsPage.tsx** (~398 changed) — stats rework.
- **ActivityPage.tsx** (~172 changed) — 4th Focus tab + reorganized sections.
- **ExternalPage.tsx**, **FinancePage.tsx**, **DashboardPage.tsx** — layout/ordering updates (Finance Overview de-dup: removed duplicate Net Flow card + awaiting-repayment from SpendingSplitCard; Repaid button per person).
- **`src/components/workspace/CodeStatsTab.tsx`** (new, 429 lines) — code stats workspace tab.
- **Finance number-mask wiring** — `useNumberMask`/`maskNumber` into 7 remaining display components (WalletDetailView, SubscriptionsTab, BudgetExpensesDashboard, SelectionAggregatePanel, CategoriesTab, FixedExpenseModal, BudgetModal); masked display strings only, numeric state untouched.

#### RHEO Rebrand & Build System
- **package.json** — version 1.0.0 → 1.1.0; productName DeskFlow → RHEO; win/mac/linux icon `DeskFlow_AppIcon.png` → `RHEO_AppIcon.png`; added `dist` script (`npm run build && electron-builder --win`); `signAndEditExecutable: false`.
- **`DeskFlow_AppIcon.png` deleted** → `RHEO_AppIcon.png` referenced instead.
- **`scripts/build.mjs`** — pre-compile `src/domains/**` alongside services/main (Composition DSL engine needs runtime-compiled JS).
- **index.html** — enhanced black-screen fallback: Copy Error button, `#df-error-stack` stack trace block, nav buttons (Dashboard/Activity/Terminal/IDE/Settings), `navigateTo()` + `copyError()` helpers, `window.__DESKFLOW_LAST_ERROR` tracking.

#### Docs & Skills
- **`agent/docs/generate-prompt-docs/canvas-grouping-system-30072026/`** — CONTEXT_BUNDLE.md, PROMPT.md, RESULT.md (canvas grouping spec).
- **`agent/docs/generate-prompt-docs/life-gold-tab-integration/`** — CONTEXT_BUNDLE.md, PROMPT.md, RESULT.md (gold tab spec).
- **`agent/docs/generate-prompt-docs/tui-agent-interaction/`** — CONTEXT_BUNDLE.md, CONTEXT_GAPS.md, CONVERSATION_PROTOCOL.md, PROMPT.md (real TUI interaction spec).
- **`agent/docs/backandfourth-docs/dsl-engine-decision/`** — CONTEXT_BUNDLE.md, CONTEXT_GAPS.md, CONVERSATION_PROTOCOL.md, INITIAL_PROMPT.md, conversation/round-01.md, conversation/output_round1.md.
- **`agent/docs/goals-covenant-handoff/`** — HANDOFF.md, PROMPT.md; **`agent/docs/ai-assistant-discussion.md`** (new); **`agent/skills/context-handoff/SKILL.md`** (new); **`agent/page-title-preview.html`** (new).

#### Misc
- **`src/lib/chart-plugins.ts`, `src/index.css`** — chart plugin + CSS updates.
- **`vite.config.ts`** — build output hashed filename tweaks.
- **`src/components/PageTitle.tsx`, `SectionHeader.tsx`, `VoiceInputWrapper.tsx`, `AiProviderSelectModal.tsx`, `TerminalWindow.tsx`, `TerminalPage.tsx`** — UI polish and TUI/agent wiring.
- **`MEMORY.md`, `agent/MEMORY.md`, `agent/state.md`, `agent/state-archive.md`** — memory/state updates.
- **`browser-extension/focusOverlay.js`** — overlay updates.

---

## Previous Commit

### Commit Message
```
feat: massive release — AI system, finance overhaul, learn module, startup fix, workspace redesign (2257 files)
```

**Hash:** `03d56df923a8dcf60b9b88c3dacd2f36944499be`
**Date:** 2026-07-11

### Detailed Changes

#### AI System (`src/services/ai/`, `src/components/AiChat/`)
- **Agent service** — Full LLM agent loop with ~40 tools wrapping ALL IPC methods: goals, projects, external activities, sleep, preferences, categories, IDE/terminal, problems, recording, browser stats. Confirmation flow for destructive actions, conversation history, localStorage persistence.
- **Security guard** — 4-tier permission matrix (read/confirm/admin/blocked), rate limiting (60/min, 500/session), audit logging, input validation.
- **Tool registry** — Complete CRUD coverage on goals, projects, activities, sleep, categories, preferences, problems, recording modes, browser stats, IDE/terminal sessions.
- **AiChat rewrite** — Connects to aiAgentService, real LLM tool calling via providers, confirmation prompts, debug logging, reset button. Replaces 100% rule-based parseIntent + checkAction system.

#### AI Deck & Plan System (`src/components/ai/`)
- **AiPage** — New deck/plan/reflect UI: DailyPlanCard, TopicDigestCard, GoalHistoryCard, MyPlanCard, LongTermPlanCard, AiChatInterface.
- **AiChatDeck** — Card-based dashboard layout for AI interactions.
- **PlanCard** — Structured goal and plan display with progress tracking.
- **ReflectCard** — Reflection and journaling interface.

#### Finance Overhaul (`src/components/finance/`, `src/pages/FinancePage.tsx`)
- **Transaction modals** — Date field always visible (not behind Advanced toggle), follow-through support, people management, category autocomplete, currency formatting.
- **Crypto features** — Net worth inclusion, live price sync, portfolio tracking, human-centered UX with explanatory tooltips and locale-aware formatting.
- **Subscriptions** — Full subscription management with card grid, search, filters, Record Payment, cancel links, renewal countdown.
- **Finance lock** — Stays locked until explicit unlock; visibilitychange, app switch, and backend state polls never override an explicit lock.
- **Security** — Password changes require current password, scrypt + constant-time compare, no plaintext storage. `app://` production loading for WebAuthn.

#### Learn Module (`src/components/learn/`, `src/services/learn/`)
- **Block-based lesson system** — New learning content renderer with interactive blocks.
- **Content engine** — Service layer for loading and managing lesson content.

#### Startup Performance Fix (`src/main.ts`)
- **IPC storm diagnosis** — Instrumented 31 synchronous IPC calls blocking the Electron main thread. `get-logs` (up to 100K rows) called 3× on mount, `get-external-sessions('all')` 2× — all synchronous.
- **Timing instrumentation** — `[PERF-IPC]` markers on get-logs, get-external-sessions, get-external-stats, detect-ides, get-dashboard-data. Startup now 1.4s total (was reported 40s).
- **Root causes identified** — `detect-ides` uses `execSync('powershell ...')` blocking 5-10s; `backfillStatsTables()` does full DELETE+INSERT on every startup; triggers maintain stats incrementally so backfill only needed when stats_daily is empty.

#### Workspace Redesign
- **Conductor system** — Multi-agent orchestration for swarms of AI agents (director, planner, worker, QA, auditor, resolver). Mission management per project.
- **Terminal workspace** — 5-group sidebar (Setup/Work/Insights/Studio/Context) with subtabs, session management, workspace save/load.
- **Files tab** — File browser within terminal workspace.
- **Skills tab** — Skills management and browsing.

#### Sync Server (`sync-server/`)
- **New Express server** — Cross-device sync capability.

#### UI Components
- **Dashboard** — 3D orbit, heatmap, weekly overview, timer.
- **Stats** — App table, charts, session list.
- **External** — Activity grid, sleep, comparison.
- **Browser activity** — Domain groups, top sites.
- **Insights** — Day/Weekly/Activities tabs.
- **Cityscape** — 3D city visualization component.
- **OrbitSystem** — 3D orbital visualization.

#### Agent Docs & Context (`agent/docs/`)
- **150+ files** — Prompt/context/result documentation covering all features.
- **State tracking** — FEATURE_TRACKER, PROBLEMS, REQUESTS, state.md, dictionary.md.

#### Backup Cleanup
- **~250 backup files removed** — `git rm --cached` + working tree cleanup. `.gitignore` updated with `*.bak`, `*.backup`, `*.old`, `*.zip`, `backup_*/`, `agent.bak*/` patterns.

#### Build System
- **`scripts/rebuild-main.mjs`** — New main process rebuild script.
- **`scripts/build-main.cjs`** — Build pipeline for Electron main process.
- **Preload** — New IPC bridges for AI, finance, learn, conductor features.

---

## Previous Commit

### Commit Message
```
feat: sync finance bundle baseline and workspace revamp snapshot
```

### Detailed Changes

#### Finance bundle sync + security hardening
- **`src/components/finance/`** — synced the refreshed finance bundle baseline into the workspace. `OverviewTab.tsx` and `FinanceStickyHeader.tsx` now use the revamped layout, `QuickAddModal.tsx` uses the base-currency fallback, and `TransactionsTab.tsx` preserves the `baseCurrency` handoff into the modal.
- **`src/pages/FinancePage.tsx`** — kept the finance page wiring aligned with the refreshed components and the lock-screen flow.
- **`src/pages/SettingsPage.tsx`** — password changes now require the current password when one already exists.
- **`src/main.ts` / `src/preload.ts` / `src/App.tsx`** — secure `app://` production loading for WebAuthn, new `finance:change-password` IPC bridge, and hardened password storage/verification (`scrypt` + constant-time compare, no plaintext).

#### Workspace / agent / UI refresh
- **AI and collaboration UI** — staged updates across `src/components/AiChat/`, `src/components/BugReportPanel.tsx`, and related support files for the agent/chat revamp and bug-reporting workflow.
- **Workspace and terminal shell** — staged updates across `src/pages/TerminalPage.tsx`, `src/components/workspace/`, `src/components/FilesTab.tsx`, `src/components/ProblemsTab.tsx`, `src/components/RequestsTab.tsx`, `src/components/SkillsTab.tsx`, and supporting context hooks.
- **Dashboard / Orbit / page polish** — staged updates across `src/pages/DashboardPage.tsx`, `src/components/OrbitSystem.tsx`, `src/pages/StatsPage.tsx`, `src/pages/ExternalPage.tsx`, and related UI helpers.

#### Docs, build, and snapshot artifacts
- **Agent markdown + docs** — `agent/state.md`, `agent/data.md`, `agent/FEATURE_TRACKER.md`, `agent/REQUESTS.md`, `agent/PROBLEMS.md`, `agent/docs/*`, and reflection notes were updated to match the current workspace state.
- **Graph/build outputs and backups** — `graphify-out/*`, `scripts/build.mjs`, `backup_before_finance_revamp/*`, and finance backup artifacts were included as part of the current snapshot.

#### Result
- The repository now reflects the refreshed finance bundle baseline, the finance security improvements, and the wider workspace/UI snapshot that was already present in the working tree.

## Latest Commit

### Commit Message
```
feat(ai): complete AI agent system with real LLM tool calling
```

### Detailed Changes

#### New AI Agent System (src/services/ai/)
- **types.ts** — Core types: ToolDefinition, ToolCall, AgentMessage, SecurityLevel (read/confirm/admin/blocked), AiAgentConfig, AuditEntry, AgentContext
- **securityGuard.ts** — 4-tier permission matrix (read/confirm/admin/blocked) with rate limiting (60/min, 500/session), audit logging, input validation (string length, number range, array length, object size)
- **toolRegistry.ts** — ~40 tools wrapping ALL IPC methods: goals (getGoals, getGoalsBatch, getLongtermGoals, saveGoal, deleteGoal, saveGoalReview, getGoalContext), projects (getProjects, getAllProjects, getProjectDetails, addProject, updateProject, deleteProject, restoreProject, openProject, calculateProjectHealth, getCommitStats), external activities (getExternalActivities, addExternalActivity, updateExternalActivity, deleteExternalActivity, startExternalSession, stopExternalSession, getExternalSessions, getExternalStats, addExternalTime, getActiveExternalSession), sleep (getSleepForDate, addManualSleep, updateManualSleep, getSleepTrends), preferences (getPreferences, setPreference, getExternalSettings, setExternalSettings), categories (getCategoryConfig, getTierAssignments, setAppCategory, setDomainCategory, setAppTier, setDomainTier, setTierAssignments), IDE/terminal (getIDEProjectsOverview, getTerminalSessions), problems (getProblems, updateProblemStatus, deleteProblem), recording (getRecordingModes, setRecordingMode), browser stats (getBrowserCategoryStats), AI context (getAiContext)
- **aiAgentService.ts** — Full agent loop: LLM → tool calls → execute via toolRegistry → results back to LLM → final response; confirmation flow for confirm/admin tools; conversation history with tool call/result tracking; localStorage persistence per day; debug logging
- **index.ts** — Barrel export

#### AI Chat UI Rewrite (src/components/AiChat/)
- **AiChat.tsx** — Complete rewrite: connects to aiAgentService, real LLM tool calling via providers, confirmation prompts for destructive actions, debug logging, greeting without quick-action suggestions, reset button
- **ChatHeader.tsx** — Added toolsUsed display and onReset callback
- **BlockRenderer.tsx** — Added empty-block fallback
- **ChatInput.tsx** — Uses existing sanitizeInput, MAX_INPUT_LENGTH from chatSafety
- **All block components** — GoalListBlock, GoalCreateBlock, GoalDeleteBlock, NewsItemBlock, DataSummaryBlock, ErrorBlock, NavigationBlock, TextBlock (unchanged, existing)

#### Integration
- **src/App.tsx** — Added getAiProviders to deskflowAPI type definition
- **src/preload.ts** — Already had getAiProviders (ipcRenderer.invoke('get-ai-providers'))

#### Architecture
- No main process IPC changes needed — renderer calls providers directly via fetch using API keys from getAiProviders()
- Uses existing multi-provider system (OpenRouter, CloudFlayer, Olamah, Invilier, Custom)
- Tools cover full CRUD on goals, projects, external activities, sleep, categories, preferences, problems, recording modes, browser stats, IDE/terminal sessions

#### Why
Replaces 100% rule-based AiChat (parseIntent + checkAction) with real LLM agent that can perform ANY action a human can via tools, with strong security (4-tier permissions, confirmations, rate limits, audit log) and efficiency (direct provider calls, smart context).

### Build
✅ npm run build passes (renderer + electron)

## Previous Commit

### Commit Message
```
fix: Compose panel sends full prompts via agentSend with pendingWrites flush
```

### Detailed Changes

#### main.ts
- **pendingWrites flush** — When agent transitions `launching` → `ready` in both `terminal:create` and `spawn-terminal` data handlers, queued prompts (`st.pendingWrites`) are now flushed to the PTY
- **agent:send DB recording** — Added `terminal_messages` DB insertion + `ai-task:updated` broadcast (≥20 char prompts) so compose prompts are tracked like `terminal:write-old-format` did

#### TerminalPage.tsx
- **handleInstructionPanelSend** — Changed from `terminalWrite` to `agentSend(resolvedTargetId, prompt, agentType)`, which correctly queues prompts during `launching` and sets phase to `busy` on send

#### agent/state.md
- Updated to v4.23 with compose panel fix entries

#### Other files
- Bulk of pre-existing uncommitted changes from prior sessions (tracking system overhaul, dashboard features, IDE page, AI systems, terminal features, component library additions, skill definitions, session configs, vault graph updates)

### Previous Commit

### Commit Message
```
feat: Dashboard redesign - stats cards, pinned activities, activity feed
```

### Detailed Changes

#### DashboardPage.tsx
- Add stats cards row: Productive Time, Total Time, % Productive, Longest Focus, Resets Today, External Time
- Stats use selectedPeriod from navigation (today/week/month/all) - scope changes based on timeline
- Longest Focus calculates longest uninterrupted productive session per timeline scope
- Pinned Activities section with edit mode (add/remove activities, max 6)
- Pinned activities persist to localStorage ('dashboard-pinned-activities')
- Activity Feed at bottom showing recent activity changes only (not periodic)
- Activity Feed shows: time, app/website name, category, productive status icon
- Remove reset/pause notifications from timer (logs already show this)
- Add new icons: Edit3, Check, Plus, Minus, TrendingUp, Target, ZapCircle, RefreshCw, Clock3

#### App.tsx
- Pass selectedPeriod prop from App.tsx to DashboardPage

#### New Interfaces
- ActivityFeedItem: id, timestamp, type (app/browser), name, category, tier
- TimerBehavior: neutralAction, distractingAction

#### New State Variables
- pinnedActivitiesEditMode: boolean
- pinnedActivities: ExternalActivity[]
- activityFeed: ActivityFeedItem[]
- resetCount: number

#### LocalStorage
- 'dashboard-pinned-activities': JSON array of pinned activities

### Detailed Changes (ALL PHASES COMPLETE)

#### Phase 1-2: Core Infrastructure & Sleep Tracking (COMPLETE)

**Database Schema:**
- `external_activities` table - Stores activity definitions (name, type, color, icon, default_duration, is_default, is_visible, sort_order)
- `external_sessions` table - Stores completed sessions (activity_id, started_at, ended_at, duration_seconds, notes)
- 8 default activities seeded on first run

**IPC Handlers:**
- `get-external-activities` - Fetch all activities
- `add-external-activity` - Create new activity
- `update-external-activity` - Update activity
- `delete-external-activity` - Delete custom activity
- `start-external-session` - Start tracking session
- `stop-external-session` - Stop session with duration
- `get-external-sessions` - Fetch sessions by period
- `get-external-stats` - Get statistics by period
- `get-sleep-trends` - Get sleep pattern data
- `get-consistency-score` - Calculate consistency metrics

**External Page:**
- Activity grid with 8 default activities
- Stopwatch mode for timed activities
- Sleep mode with wake-up time picker (allows selecting past time)
- Check-in mode for quick activities
- Real-time timer display

#### Phase 3: Statistics & Charts (COMPLETE)

**Charts:**
- Activity breakdown horizontal bar chart (by activity)
- Weekly comparison line chart (multi-week)
- "Charts" toggle button to show/hide
- Chart.js integration

**Consistency Score:**
- 0-100 score based on variance from target
- Trend indicator (↑↓-)
- Color-coded display (green/amber/red)

#### Phase 4: Custom Activities (COMPLETE)

**Custom Activity Modal:**
- Name input field
- Type selector (Stopwatch/Sleep/Check-in)
- Icon picker (10 icons)
- Color picker (15 colors)
- Default duration dropdown (for check-in)
- Save to database

#### Phase 5: Polish (COMPLETE)

- Framer Motion animations (fade, scale transitions)
- Smooth button hover effects
- Modal animations

**Files:**
| File | Changes |
|------|--------|
| `src/main.ts` | +328 lines - DB tables + IPC handlers |
| `src/preload.ts` | +19 lines - External API bindings |
| `src/App.tsx` | +6 lines - ExternalPage import + route + sidebar |
| `src/pages/ExternalPage.tsx` | +492 lines - Full component |
| `agent/state.md` | Updated |

---

### Previous Commit

### Commit Message
```
feat: External Tracker - non-laptop activity tracking with sleep deficit and consistency metrics
```

### Detailed Changes

#### **New Features**

##### 1. External Tracker Page
- **New "External" page** in sidebar for tracking non-laptop activities
- **Activity button grid** displaying all available activities
- **Stopwatch mode** for timed activities (Studying, Exercise, Gym, Commute, Reading)
- **Sleep mode** with bedtime tracking and wake-up time picker
- **Check-in mode** for quick activities (Eating, Short Break)

##### 2. Default External Activities
- **Pre-loaded activities:**
  - Studying (Paper) - Stopwatch mode
  - Exercise - Stopwatch mode
  - Gym - Stopwatch mode
  - Commute - Stopwatch mode
  - Reading - Stopwatch mode
  - Sleep - Sleep mode (bedtime/wake-up)
  - Eating - Check-in mode (30 min default)
  - Short Break - Check-in mode (15 min default)

##### 3. Sleep Tracking System
- **Sleep session tracking** with bedtime and wake-up timestamps
- **Wake-up time picker** allowing past time selection
- **Sleep deficit calculation** (8 hours - actual sleep)
- **Color-coded deficit display:**
  - Green (+): On target or surplus
  - Red (-): Sleep deficit
- **Average bedtime and wake time** statistics

##### 4. Statistics & Charts
- **Stats cards** showing today/week/month totals
- **Sleep deficit card** with color coding
- **Consistency chart** with multi-week line comparison
- **Activity breakdown** horizontal bar chart
- **Consistency score** (0-100 based on variance from target)

##### 5. Custom Activities
- **Add custom activity** modal form
- **Edit/delete custom activities** functionality
- **Configurable options:**
  - Name and color
  - Timer mode (stopwatch/sleep/check-in)
  - Default duration (for check-in)
  - Icon selection

#### **Backend Changes (Electron Main Process)**

##### New Database Tables
- **external_activities**: Stores activity definitions
  ```sql
  CREATE TABLE external_activities (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    default_duration INTEGER,
    is_default INTEGER DEFAULT 0,
    is_visible INTEGER DEFAULT 1,
    created_at TEXT
  );
  ```

- **external_sessions**: Stores completed sessions
  ```sql
  CREATE TABLE external_sessions (
    id INTEGER PRIMARY KEY,
    activity_id INTEGER,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER,
    notes TEXT,
    FOREIGN KEY (activity_id) REFERENCES external_activities(id)
  );
  ```

##### New IPC Handlers
- `get-external-activities` - Fetch all activities
- `add-external-activity` - Create new activity
- `update-external-activity` - Update activity
- `delete-external-activity` - Delete activity
- `start-external-session` - Start tracking session
- `stop-external-session` - Stop session with duration
- `get-external-sessions` - Fetch sessions by period
- `get-external-stats` - Get statistics by period
- `get-sleep-trends` - Get sleep pattern data
- `get-consistency-score` - Calculate consistency metrics

#### **Component Structure**

| Component | Purpose |
|-----------|--------|
| `ExternalPage.tsx` | Main external tracking page |
| `ExternalButton.tsx` | Activity button card |
| `ExternalActiveTimer.tsx` | Active stopwatch display |
| `SleepSessionModal.tsx` | Wake-up time picker |
| `AddActivityModal.tsx` | Custom activity form |
| `StatsCards.tsx` | Dashboard stats cards |
| `ConsistencyChart.tsx` | Multi-week line chart |
| `SleepTrendChart.tsx` | Sleep trend line chart |
| `ActivityBreakdown.tsx` | Horizontal bar chart |
| `useExternalTimer.ts` | Timer logic hook |

#### **Documentation**

| File | Purpose |
|------|--------|
| `docs/EXTERNAL_TRACKER_PLAN.md` | Full implementation plan |
| `agent/_COMMITS.md` | Updated with commit details |

#### **Implementation Phases**

1. **Phase 1: Core Infrastructure** (HIGH priority)
   - Database schema creation
   - Backend IPC implementation
   - Basic External page with activity grid

2. **Phase 2: Sleep Tracking** (HIGH priority)
   - Sleep mode implementation
   - Wake-up time picker
   - Sleep statistics

3. **Phase 3: Statistics & Charts** (MEDIUM priority)
   - Consistency chart
   - Activity breakdown chart

4. **Phase 4: Customization** (MEDIUM priority)
   - Add/edit/delete activities
   - Activity configuration

5. **Phase 5: Polish** (LOW priority)
   - Animations and transitions
   - Heatmap integration (deferred)
   - Floating widget (optional)

---

### Commit Statistics
- **Files Created:** 9 new components
- **Files Modified:** 5 existing files
- **Database Tables:** 2 new tables
- **IPC Endpoints:** 10 new handlers

### Related Issues
- Implements non-laptop activity tracking feature
- Adds sleep deficit monitoring
- Provides consistency metrics for external activities

---

### Previous Commit

### Commit Message
```
feat: AI-powered categorization, terminal system, IDE enhancements, and UI improvements
```

### Detailed Changes

#### **New Features**

##### 1. AI-Powered Auto-Categorization System
- **Magic Category** button in Settings page (Apps & Websites tabs)
  - Bulk categorize all apps/websites using OpenRouter AI
  - Individual sparkle button per app/website for single-item categorization
  - Requires OpenRouter API Key configuration
  - Loading state shows "Generating..." during AI processing
  - Integrated with `window.deskflowAPI.generateAICategorization()`

- **Magic Color** button in Colors tab
  - Bulk generate AI-powered planet colors for all apps/websites
  - Individual sparkle button per item for single color generation
  - Integrated with `window.deskflowAPI.generateAIColors()`
  - Requires OpenRouter API Key configuration

- **OpenRouter API Key Configuration**
  - New settings field in Settings → General tab
  - Password input with placeholder `sk-or-v1-...`
  - Required for all AI features (Magic Color & Magic Category)

##### 2. Terminal System (Complete Implementation)
- **Terminal Window Management**
  - `createTerminalWindow()` - Create new terminal window
  - `spawnTerminal()` - Spawn terminal with optional working directory
  - `writeTerminal()` - Send input to terminal
  - `resizeTerminal()` - Handle terminal resize events
  - `killTerminal()` - Terminate terminal session

- **Terminal Presets**
  - `getTerminalPresets()` - Fetch presets (project-scoped or global)
  - `addTerminalPreset()` - Create new preset with command, working directory, category
  - `removeTerminalPreset()` - Delete preset
  - `executeTerminalPreset()` - Run preset in existing or new terminal

- **Terminal Layouts**
  - `saveTerminalLayout()` - Save multi-terminal layout configurations
  - `getTerminalLayouts()` - Fetch saved layouts
  - `deleteTerminalLayout()` - Remove layout
  - `setActiveTerminalLayout()` - Activate layout

- **Terminal Sessions (Resume Feature)**
  - `saveTerminalSession()` - Save session with resume ID, topic, token/cost tracking
  - `getTerminalSessions()` - Fetch session history (project-scoped, with limit)
  - `getTerminalSessionResumeId()` - Retrieve resume ID for session continuation

- **IPC Event Listeners**
  - `onTerminalData` - Listen for terminal output streaming
  - `onTerminalExit` - Handle terminal process exit with exit code and signal

##### 3. IDE Projects Page Enhancements
- **AI Agent Debug Panel**
  - Shows per-agent detection status, paths, and sample files
  - "Show Details" toggle button for visibility
  - Displays sync result with per-agent record counts
  - Enhanced "Not detected" message showing scanned path

- **Project Health Metrics**
  - `calculateProjectHealth()` - Compute project health score
  - Integrated with IDE projects dashboard

##### 4. UI/UX Improvements

**Settings Page:**
- **Apps/Websites Toggle** in Colors tab
  - Tab switcher to toggle between app colors and website colors
  - Separate search filters for each type
  - Responsive grid layout (2/3/4 columns based on screen size)

- **Show More/Less Buttons**
  - Expandable carousels in Apps and Websites sections
  - Shows 5 items initially, expands to 15 items
  - Chevron up/down icons with smooth transitions

- **Discord-Style Save Bar**
  - Fixed bottom bar appears when changes detected
  - Animated slide-in/out with spring physics
  - "Reset" button to discard all changes
  - "Save Changes" button with checkmark icon
  - Amber pulse indicator showing unsaved state

**Browser Activity Page:**
- **Pie Chart Text Color Fix**
  - Legend text color set to `#d4d4d8` (light gray)
  - Tooltip body and title colors set to `#d4d4d8`
  - Ensures visibility on dark background

**Productivity Page:**
- Updated to use new AI categorization system
- Integrated with Magic Category features

#### **Backend Changes (Electron Main Process)**

##### New IPC Handlers
- `generate-ai-colors` - AI-powered color generation for apps/websites
- `generate-ai-categorization` - AI-powered category assignment
- `create-terminal-window` - Terminal window creation
- `spawn-terminal` - Terminal process spawning
- `write-terminal` - Terminal input handling
- `resize-terminal` - Terminal resize handling
- `kill-terminal` - Terminal process termination
- `get-terminal-presets` - Fetch terminal presets
- `add-terminal-preset` - Create terminal preset
- `remove-terminal-preset` - Delete terminal preset
- `execute-terminal-preset` - Execute preset command
- `save-terminal-layout` - Save terminal layout
- `get-terminal-layouts` - Fetch terminal layouts
- `delete-terminal-layout` - Delete terminal layout
- `set-active-terminal-layout` - Activate layout
- `save-terminal-session` - Save terminal session
- `get-terminal-sessions` - Fetch terminal sessions
- `get-terminal-session-resume-id` - Get resume ID
- `calculate-project-health` - Calculate project health metrics

##### New IPC Event Listeners
- `browser-tracking-event` - Live browser tracking events
- `terminal-data` - Terminal output streaming
- `terminal-exit` - Terminal process exit events

#### **Schema & Data Structure Changes**

**Terminal Preset Schema:**
```typescript
{
  id: string;
  projectId?: string;
  name: string;
  command: string;
  workingDirectory?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}
```

**Terminal Layout Schema:**
```typescript
{
  id: string;
  projectId?: string;
  name: string;
  layoutData: string; // JSON string of terminal positions/sizes
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Terminal Session Schema:**
```typescript
{
  id: string;
  projectId?: string;
  agent: string;
  resumeId?: string;
  topic?: string;
  workingDirectory?: string;
  totalTokens?: number;
  totalCost?: number;
  createdAt: string;
  completedAt?: string;
}
```

#### **Files Modified**

| File | Changes | Description |
|------|---------|-------------|
| `src/App.tsx` | +194 lines | Added AI categorization UI, save bar, tier assignments |
| `src/preload.ts` | +45 lines | Exposed terminal, AI, and project health APIs |
| `src/main.ts` | +520 lines | Implemented terminal system, AI handlers, project health |
| `src/components/OrbitSystem.tsx` | +673 lines | Galaxy camera fixes, visualization debugging |
| `src/pages/SettingsPage.tsx` | +836 lines | AI features, save bar, expandable grids, toggle tabs |
| `src/pages/BrowserActivityPage.tsx` | +212 lines | Pie chart text color fix, responsive layouts |
| `src/pages/IDEProjectsPage.tsx` | +1715 lines | AI agent debug panel, project health integration |
| `src/pages/ProductivityPage.tsx` | +209 lines | AI categorization integration |
| `src/pages/DatabasePage.tsx` | +20 lines | Minor fixes |
| `browser-extension/background.js` | +6 lines | Browser tracking event emission |
| `package.json` | +12 lines | New dependencies for terminal and AI features |
| `package-lock.json` | +87 lines | Dependency lock updates |

#### **Documentation Updates**

| File | Changes |
|------|---------|
| `AGENTS.md` | Updated with graphify skill instructions, critical rules, file maintenance guidelines |
| `agent/state.md` | Version tracking, IPC endpoints, recent changes log |
| `agent/PROBLEMS.md` | Issue tracker with 305 lines of known issues and patterns |
| `agent/debugging.md` | New error patterns and solutions |
| `agent/agents.md` | Agent configuration updates |
| `graphify-out/GRAPH_REPORT.md` | Updated architecture graph with new nodes |
| `graphify-out/graph.json` | Knowledge graph with 1312 lines of node relationships |
| `graphify-out/analysis.json` | Community structure analysis |

#### **Deleted Files**
- `agent/skills/agent-reflect/README.md` (51 lines)
- `agent/skills/agent-reflect/research-prompt.md` (102 lines)
- `agent/skills/agent-reflect/result.md` (731 lines)

#### **Dependencies**
- Added terminal-related packages
- Added AI integration packages (OpenRouter SDK)
- Updated chart.js and react-chartjs-2 for visualization fixes

---

### Commit Statistics
- **Files Changed:** 25
- **Insertions:** +5,332 lines
- **Deletions:** -2,586 lines
- **Net Change:** +2,746 lines

### Related Issues
- Fixes pie chart text visibility on dark theme
- Implements terminal system with presets, layouts, and session resume
- Adds AI-powered auto-categorization for apps and websites
- Enhances IDE projects page with agent debugging and health metrics

---

*Generated: 2026-04-21*
