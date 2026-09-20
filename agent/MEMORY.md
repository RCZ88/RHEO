# MEMORY.md — DeskFlow Durable Memory (COMPILED)

> Compiled version — max 10 newest. Overflow in MEMORY_FULL.md.


- [2026-09-20] SKILL ROUTER must be updated when new skills are added to `agent/skills/`. `ui-and-charts` and `animation-stack` were added to disk but NOT in the skill router → AI didn't use them. Make `ui-and-charts` MANDATORY (enforces MCP component browsing via `npx shadcn@latest add @kokonutui/<name>` before writing custom markup). Also update CONTEXT_BUNDLE.md and PROMPT.md in `agent/docs/generate-prompt-docs/` to list all skills verbatim.


- [2026-09-20] Chart.js `Bar` component import must be explicit in the file that uses it, even if `chart.js` is globally registered in `App.tsx`. WidgetSummaries.tsx used `<Bar>` without importing it → missing import error.


- [2026-09-20] `framer-motion` → `motion/react` migration complete for all dashboard files (DashboardPage, StatusBand, ScheduleCard, WidgetSummaries, QuickFocusCard). Exception: `src/components/ui/magic-card.tsx` still uses `framer-motion` because it uses `useMotionTemplate`, `useMotionValue`, `useSpring` — framer-motion-specific APIs that cannot be replaced with `motion/react`.


- [2026-09-20] Generate-prompt skill outputs (`CONTEXT_BUNDLE.md`, `PROMPT.md`) must be updated when the skill list changes. The PROMPT.md must include the `## Frontend Design Skills` section with ALL current skill names verbatim, and must include the `## THE MANDATE: You MUST USE THE MCP` section with step-by-step MCP usage instructions.


- [2026-09-19] DEVTRIGGERPANEL INJECT TAB was a "coming soon" stub — `devSleepInject`, `devPreviewGaps`, `devDetectedGaps`, `devAfkInject`, `devGapsInject` states and `runSleepDetectionInject`, `previewAdjacentGapsInject`, `confirmSleepInject`, `injectAfkEntry`, `detectGapsInject`, `fillSleepGapsInject`, `fillAfkGapsInject`, `dismissAllDev` handlers were planned but never implemented. Fix: added all states/handlers in App.tsx, filled the Inject tab UI in DevTriggerPanel.tsx with Sleep/AFK/Gaps sections, connected `DevTriggerPanel` import and JSX render in App.tsx. Pre/post sleep gaps flow: `detectAdjacentSleepGaps` (main.ts:23933) → `computeAdjacentGaps` IPC → `SleepDetectionModal` 2-step flow (sleep→gaps) → `fillGapWithSegments` + `addExternalTime`. Build passes.


- [2026-09-19] FRAMER-MOTION `motion` component override gotcha (App Tracker): `motion.span` / `motion.button` internally manage `transform`, `scale`, and `opacity` via its animation system, ALWAYS overriding inline `style` values like `transform: 'translateY(-50%)'` and `scale: isActive ? 1 : 0.6` → renders as `transform: none` and `scale: 0.6`. This caused the sidebar icon chip and nav dot to not respond to `isActive`. FIX: replace `motion.span`/`motion.button` with plain HTML elements (`<span>`, `<button>`) + CSS transitions/`:hover` classes. Also `translateY: '-50%'` in inline style is invalid CSS — must use `transform: 'translateY(-50%)'`. Remove `layout` prop from `motion.button` and `LayoutGroup` wrapper when not needed for layout animations.


- [2026-09-18] PENGUIN CONSOLE INTEGRATION MANDATE (user, repeated 5+ hours): "Terminal" in current work means PENGUIN CONSOLE (src/terminal/, route /penguin-console) — NOT the Terminal Handbook (src/components/learn/HandbookWorkspace.tsx/HandbookReference.tsx, which is a separate Learn-page surface). The Handbook's AI flow (explainCommand in src/agents/handbookPromptAgent.ts → generate prompt → copy → "Paste ChatGPT/Claude JSON output here" → parse → save notes + command usage tracking) is SUPPOSED TO BE INTEGRATED INTO PENGUIN CONSOLE ITSELF. Current src/terminal/ has NO AI/notes/usage integration (grep-verified: no explainCommand/aiNotes in src/terminal/). A prior "hermes" pass (.bak-hermes files) already did design polish in src/terminal (gradients removed, rounded-xl, font weights) but the FEATURE integration (Command Notes + AI explain + usage) was never added there. Next session: implement the AI explain/notes/usage flow INSIDE src/terminal/, per agent/docs/penguin-console-revamp-plan.md.


- [2026-09-18] COORD CLI silent-no-op gotcha (App Tracker): `coord.mjs`/`run-exclusive.mjs` CLI main() gate `import.meta.url === 'file://'+process.argv[1]` FAILS silently when the repo path contains spaces ("App Tracker" → `%20` in import.meta.url, raw space in argv[1]), so EVERY CLI command prints nothing and exits 0 (registry never updated, `status` shows empty, `--forbid app` is not enforced). Workaround: drive the library directly via `node --input-type=module -e "import * as c from '.../coord.mjs'; c.register(...); c.claim(...); c.getState(); c.done(...)"`. Also: IDE page redesign revert (commits a43f9e3/d567837/99452f8/735601e, all renderer-only) is fully self-contained `src/pages/IDEProjectsPage.tsx` + `src/components/ide/`; reverting to `dcda481` is byte-safe (old page's deskflowAPI methods all still exist in preload; tsc 6133/2339 excess are pre-existing type-only, build.mjs has no tsc gate).


- [2026-09-17] SST/lecture feature integration: bare `ipcMain` in transcript handlers crashed the app (fixed to `electron_1.ipcMain`). Dead-end hooks wired: `goal:create` (goal save), `learn:lesson-create` (Lyceum lesson), `todo:create` (todo). Per `feature-integration` skill litmus test, all four save targets (Notes/Goals/Lessons/Todos) now connect to real IPC handlers. Services are external requires — learn handlers live in `dist-electron/services/learn/index.js`, not main.cjs.


- [2026-09-17] Dashboard card revamp: Created `src/components/dashboard/DeskFlowCard.tsx` with unified DeskFlow tokens (zinc-950 base, zinc-900/80 elevated, pink-500 accent, rounded-xl, Geist fonts) + L2 Responsive motion (hover lift + glow via motion/react). Created `src/components/ui/card.tsx` — shadcn Card primitives were MISSING locally despite being referenced. Wrapped all 8 dashboard rows in `DeskFlowCardMotion` for consistent hover/layout effects. Added X button + Esc key handler to CardLibrary modal. **CRITICAL FIX**: shadcn Card default `shadow-sm` + white `border` conflicted with DeskFlow glass surface — re-skinned `card.tsx` to use `border-zinc-800/60 bg-zinc-900/80 backdrop-blur-xl` (no shadow-sm, no white). shadcn-ui-mcp works; Magic UI MCP available for BorderBeam/MagicCard/ShineBorder. Build: `npx vite build` + `node scripts/build.mjs` + `npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs`.

