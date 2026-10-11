<!-- SESSION: opencode-learn-zoompan-20261005 -->
<!-- AGENT: opencode | TERMINAL: local | PROJECT: /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker -->

# Agent State — opencode-learn-zoompan-20261005

> **STATUS:** completed | **UPDATED:** 2026-10-05T11:05:00Z

---

## CURRENT CYCLE (1)
**ROLE:** Fix PROMPT.md — Lyceum (`/learn`) crashes opening any lesson; audit learn module for other bugs; PAINT UI/UX evaluation of Lyceum.
**STATUS:** completed
**IN FLIGHT:**
- nothing — source work complete, awaiting CZ's build for runtime verification
**COMPLETED:**
- `ZoomPan.tsx` — idempotent-fit early return (EPS 0.5px) + `ro.observe(content)` removed; `reset()` invalidates the cache so a real refit still applies.
- `ErrorBoundary.tsx` — new exported `isBenignBrowserError()`; `triggerGlobalError` now swallows benign warnings; also fixed pre-existing TS2741 (`getDerivedStateFromError` omitted `copied`).
- `main.tsx` — `routeToBoundary` returns early on benign errors; the `error` listener skips resource loads (`e.target !== window`).
- `ReaderView.tsx` — **THE REAL CRASH**: removed `return null` before the hook list + render-phase `onSelectNode()`. Replaced with a `useEffect` auto-select. Replaced the "Select a node from the outline" fallback (wrong copy for a transient state) with a shape-matched skeleton + `aria-busy`.
- `CreateLessonDialog.tsx` — "Save for later" no longer sets `saved` on did-not-throw; handler returns `{ok:false}` so the catch could never fire. Added `saveError` state + `role="alert"` copy.
- `learnerProfile.ts` — `resetProfile()` localStorage wrapped in try/catch (§7 rule); previously it could throw and skip the DB delete + `profile-changed` event.
**NEXT ACTION:** CZ builds (`npm run build`, app closed). Then open a lesson on `/learn` and confirm no `FAULT` screen + no `ResizeObserver loop` line. PAINT Gate C/E remediation (below) is a separate, larger cycle if CZ wants it.
**NOTES:**
- **The packet's stated root cause was a hypothesis, not a finding.** A numeric probe of the real ZoomPan geometry reaches a fixed point in 2 passes — the RO loop is not provably unbounded. The ZoomPan hardening is still correct and cheap, but the decisive fix is the error-boundary blast radius, and the actual crash was the ReaderView hook-order violation the packet never mentioned.
- Verification: `esbuild --bundle --outdir` exit 0 on all 6 touched files; scoped `tsc` clean for ZoomPan/ErrorBoundary/main.tsx, and the only remaining hits in ReaderView/CreateLessonDialog/learnerProfile are pre-existing dead code I did not author (verified by reading each reported line). `zoompan-fit-probe.mjs` 8/8. **NO BUILD RUN** (§0-0).

### PAINT audit of Lyceum — gates that FAIL (for a future cycle)
Scope declared: `src/components/learn/**` only. Industry: dev-tool / learning surface, density over delight. **No signature element — correct for this surface.** Liveliness would be L2.
- **Gate C (worst):** **73 distinct raw hex values** hardcoded in `src/components/learn/`, and `--page-accent` is used **once** in the whole module — while `index.css:568` declares `[data-page="learn"] { --page-accent: #34d399 }` (emerald). The surface declares emerald and paints itself in clay/amber/cream (`#d97706` x19, `#f3d9a4` x13, `#faf6ee` x8). Biggest single drift in the app.
- **Gate E:** **zero** `prefers-reduced-motion` in the entire learn module, though 48 files app-wide have one — and learn/ is one of the most animated surfaces (framer-motion throughout).
- **Gate E:** `transition-all` in 10+ learn files (`CreateLessonDialog` x28 alone) — banned; animates layout properties.
- **Typography:** 233 `font-mono` + 42 `font-serif`, **zero `font-sans`**. Long-form lesson prose renders in mono; the app's body face is absent from the whole reading surface.
- **Light theme:** learn is 100/1490 of the app's `light:bg-[var(--ws-surface…)]` adoption (~7%) — mid-migration, uncommitted `light:` hunks already exist in ReaderView.
- Radii: **PASS** — 101 `rounded-full` (pill), zero `rounded-2xl/3xl`.

### Bug backlog found, NOT fixed (out of this cycle's scope)
1. `services/learn/index.ts:680` — `learn_sessions.mastery_gained` is `TEXT DEFAULT '[]'` but the timerStop path writes a **number**; `JSON.parse('0').reduce` throws, handler returns `{ok:false}`, so the **90-day Study Activity heatmap is permanently empty**. HIGH, silent, whole feature dead.
2. `NodeSourcesPanel.tsx:39,49` — calls `learnGetSources`/`learnUpdateSources`, which **exist in neither preload.ts nor the main handlers**. Panel always shows "no sources", every write fails. Needs handlers or deletion.
3. `TutorPanel.tsx:130-143` — `setState` **and a persistent `learnAddMessage` DB write** happen inside a `setV2Answer` updater → StrictMode double-render writes the AI answer twice.
4. `stats/useStudyTimer.ts:91-106` — `stop()` has no try/catch and no `{ok}` check, so a rejection leaves the timer permanently running; `elapsed` is a **tick counter**, not wall-clock, so every heatmap value drifts low.
5. `LearnPage.tsx:164-201` — the `g` chord returns unconditionally, so the documented graph toggle at :197 is **dead code** and each `g` leaks a `{once:true}` listener.
6. `dashboard.service.ts:12,21,30,32` — `avg_confidence` is the literal `0.72`, `streak_days` is always `0`, and a computed `openProposals` is **discarded** for a hardcoded `[]`. The dashboard shows fabricated numbers as measurements.
7. `CreateLessonDialog.tsx:809-821` — dead `handleFileUpload`/`handleClearFile` referencing removed state (`setFileName`, `setContextDoc`, `fileInputRef`); 14 pre-existing tsc errors here. A feature-removal decision, not a bug fix.
8. `HandbookWorkspace.tsx.bak-20260923-100014` — 1062-line stale duplicate shipped in `src/`.
9. `blocks/ProseBlock.tsx:94` — unreachable second `%%CODE(\d+)%%` replace.
10. `blocks/ConceptMapBlock.tsx:15-18` — `max_depth`/`color_by_mastery`/`collapsible`/`layout` declared and never read.

### FALSE POSITIVE (checked and dismissed)
The audit claimed `StudyView.tsx:159` was missing `backfaceVisibility: 'hidden'` on the card back face (answer visible before flip). **Wrong** — lines 151 and 159 both set it, matching `FlashcardBlock.tsx:153,158`. Not changed.

---

## HISTORY (previous 2 cycles, oldest first)

_(first cycle for this session)_