<!-- SESSION: opencode-sandbox-20261001 -->
<!-- AGENT: opencode | TERMINAL: n/a | PROJECT: App Tracker -->

# Agent State — opencode-sandbox-20261001

> **STATUS:** completed | **UPDATED:** 2026-10-01T19:36:00Z

---

## CURRENT CYCLE (1)
**ROLE:** Design + build a Labs hub page (`/labs`) that groups the three externally-built,
badly-integrated surfaces — Content Engine, Resume, Lecture/SlideMind — behind one nav entry
with LAMINAR-legal signature cards.
**STATUS:** completed
**IN FLIGHT:**
- (none)
**COMPLETED:**
- Ran the §0a coordination gate. Claimed 9 paths. Two lease sets were reaped mid-cycle
  (TTL) and had to be re-claimed.
- **Named it "Labs", deliberately against the suggested "Sandbox".** These three hold the
  user's real résumé, decks and video plans; "sandbox" reads "nothing here matters". A lab is
  a permanent place where experimental work happens. Lab ≠ broken.
- **PAINT P0-P7 run.** Intent contract printed; LAMINAR is the authority. Knobs
  variance=4 / motion=3 / density=5. Design idea = **"the round trip"**: every lab runs
  raw input → build a prompt → AI answers → artifact, so each card is a specimen plate with
  IN / FORGE / OUT legs and a mono specimen ID (LB-01…). Differentiator is ID + legs, never
  colour (§7.2 forbids multi-hue on a surface), so `--page-accent` is reserved for
  interaction feedback only.
- **P3 (MCP) was called and every hit rejected.** Registry "card" search → 531 items, all
  marketing-grade (3D flip, disintegrate, sheen-follows-pointer, bento-3D-carousel) =
  §7 items 1/3/6/9. That marketing aesthetic *is* why the three pages look foreign. Correct
  call: the app's own installed shadcn primitives. Rejected explicitly, not silently.
- **NEW** `src/pages/LabsPage.tsx` + `src/components/labs/labRegistry.ts`.
- Wired: `/labs` route (App.tsx), `[data-page="labs"]` accent + light variant + a scoped
  `prefers-reduced-motion` guard (index.css), smart-search entries, nav item.
- Sidebar: removed the 3 scattered entries, added one `Labs`. 13 items, no dupes, `Sparkles`
  + `FileText` imports removed (0 refs left) since only those items used them.
- **Counts are derived, not typed — 2 of 3 for real.** Lecture's 8 tools from
  `SlideSidebar.items`, Resume's 7 phases from `PHASE_NAMES`. Verified by *executing* the
  registry in node, not by grepping strings. This exists because Content Engine's own header
  claims "8-stage pipeline" while its array holds 9 — a caption that drifted and was
  invisible to every type check and the bundler.
- **Fixed a pre-existing broken import** (dead, behaviour-neutral): `ContentEngineWorkspace`
  imported `BlurFade` from `./ui-laminar`, which does not exist (it is at
  `./components/ui-laminar`), and never used it.

**NEXT ACTION:** Real `vite build` + a Probe UI pass once the box has RAM headroom. Then a
re-skin pass on the three labs themselves — that is the actual fix for "doesn't integrate".

**NOTES:**
- **NOT BUILT — deliberate.** `avail=6529MB / swapfree=15MB`, and 3 other agents' real
  `vite build`s running. MEMORY's thresholds are avail>9000 & swapfree>2000. A killed build
  leaves `dist/` EMPTY (`emptyOutDir` wipes before writing) = instant black screen for the
  user, and the app is live off `dist/` right now. Did not gamble it.
- **What I did verify instead:** per-file esbuild on every changed file; LabsPage's *entire
  reachable import graph* bundles clean (255KB); the registry executes and computes
  9/7/8 correctly; LAMINAR §7 grep gates pass on all new code; index.css brace-balanced with
  CRLF preserved; tsc clean on all my files; project-wide 6887 → **6884** errors (net −3).
- **Could NOT derive Content Engine's count, on purpose.** Its graph does not resolve:
  `PromptBuilder.tsx` imports and CALLS `getSectionsForPromptType` from `./PromptSectionToggle`,
  where that function is **neither defined nor exported anywhere in the repo**. That is
  another agent's unfinished work, so per §8 Rule 2 I did not invent it — I decoupled the
  hub from that graph so `/labs` cannot be taken down by it. The count is held in
  `labRegistry.ts` as `CONTENT_ENGINE_STAGES` with the blocker named. **If `/studio` is
  broken for the user, this is why — flag it, do not let it hide behind my page.**
- **A concurrent writer clobbered my first sidebar edit and I did not fight it.** Midway
  through, a process outside the coordination layer rewrote `Sidebar.tsx`, deleted
  `SIDEBAR_ITEMS` from it, and extracted the registry into a NEW file
  `src/components/sidebar/items.ts`. My edit was gone. I waited for the file to stabilise,
  then re-applied the change in the new correct location. Worth knowing: `Sidebar.tsx` is
  now a thin re-export shell — edit `sidebar/items.ts`, not `Sidebar.tsx`.
- Verified `useSidebarConfig` derives `assignments` from the registry with no hardcoded
  paths, so stale persisted keys for the removed routes are harmless.

---

## HISTORY (previous 2 cycles, oldest first)

(none — first cycle for this session)
