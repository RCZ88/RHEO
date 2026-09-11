<!-- SESSION: opencode-term-1-rdlife -->
<!-- AGENT: opencode | TERMINAL: term-1 | PROJECT: App Tracker -->

# Agent State — opencode-term-1-rdlife

> **STATUS:** completed | **UPDATED:** 2026-08-17T00:05:00Z

---

## CURRENT CYCLE (4)
**ROLE:** Hands & Eyes — generate-prompt package for Life page (Living Substrate full-bleed river + Self tab care redesign) + AGENTS.md §1c router-sync mandate + skill-router v1.1.0 sync
**STATUS:** completed
**IN FLIGHT:**
- (none — waiting on external AI RESULT.md from the new package)
**COMPLETED:**
- Created package agent/docs/generate-prompt-docs/life-page-living-art-self-16082026/: PROMPT.md (11.5KB — verbatim user rage, mandate, Engineering A (substrate→full-bleed river, single-instance, shader evolution, perf) + B (Self tab architecture/card system/accent reconciliation), UX task, skills list, MCP inventory, anti-slop checklist, constraints, RESULT.md format) + CONTEXT_BUNDLE.md (32.6KB — env facts, tokens, 7 design skills, MCP inventory, full verbatim LivingSubstrate.tsx + rd-simulation.glsl + rd-display.glsl + CoreSample stage + LifePage river/self blocks + ProfileTab/ContextGraphView/BrainManagementView heads + clash summary + backend audit = UI-only)
- Root AGENTS.md §1c: added "The Router is a LIVING document — KEEP IT SYNCED (user-mandated)" block
- skill-router SKILL.md v1.0.0 → v1.1.0: added signature-design (DESIGN MANDATORY), font-selection, beautiful-charts, layout-deck-fix (DESIGN REC), backandfourth-skill (PROMPT GEN REC), research-digest-overhaul (RESEARCH REC), context-handoff (AGENT REFLECT REC); repointed dead refs (terminal-agent → AGENTS.md §7b; probe-mcp-testing → Probe MCP server); new §7 Self-Maintenance + sync checklist
- FEATURE_TRACKER.md entry added (top of dated list)
**NEXT ACTION:** CZ sends PROMPT.md + CONTEXT_BUNDLE.md to a smarter external AI → RESULT.md returns → implement (river full-bleed substrate, remove CoreSample's trapped instance, Self tab redesign w/ SectionHeader + unified card system), build, CZ relaunches RHEO to verify
**NOTES:** jasonwebb/reaction-diffusion-playground = REFERENCE ONLY (user clarified this cycle — not a mandated source). No src/ changes this cycle → no re-zip needed. Two AGENTS.md files confirmed: root = binding (edit for router rules), agent/AGENTS.md = auto-generated Tracker Mind file. Running app stays stale until RHEO.exe relaunch.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 3 — 2026-08-17
**ROLE:** Hands & Eyes — Reaction-Diffusion "Living Substrate" final verification round (zero-omission audit vs RESULT.md + re-run build gates + infra sync)
**STATUS:** completed
**COMPLETED:**
- Full RESULT.md audit (reaction-diffusion-life-16082026): hero surface z-0/z-10 hook, ping-pong FloatType/NearestFilter targets 256/384, 2 sim passes/frame, amber premultiplied-alpha ramp, coral preset f=0.0545/k=0.062/dA=1.0/dB=0.5, document.hidden pause, prefers-reduced-motion unmount, error-boundary CSS fallback — ALL implemented, zero omission
- Build gates re-run: vite OK (LifePage.BJRdEuAb.js 898KB), preload.cjs 105449B, main.cjs 1382999B, tsc clean (pre-existing aiAgentService.test.ts errors only)
- dist verified: index.html valid; GLSL markers in the LAZY LifePage chunk, not the main bundle
- Infra sync: FEATURE_TRACKER.md, dictionary.md, MEMORY.md updated
**NEXT ACTION:** CZ to relaunch RHEO and visually confirm Living Substrate grows behind the rings (NOT LAUNCHED — running without --remote-debugging-port)
**NOTES:** Concurrent vite build raced this one (index hash changed mid-check) — always re-verify after build. GLSL1 is correct for THREE.ShaderMaterial.

### Cycle 2 — 2026-08-17
**ROLE:** Hands & Eyes — merge Life page Brain/Profile/Graph tabs into one "Self" page
**STATUS:** completed
**COMPLETED:**
- LifePage.tsx: PAGE_TABS now 5 (covenant/memories/gold/notes/self); one 'self' block stacks ProfileTab → ContextGraphView → BrainManagementView
- Backward compat: tabMaps map profile/graph/brain → 'self'
- Build gates OK; src.zip re-zipped via tar
**NEXT ACTION:** CZ to relaunch and verify Self tab + Living Substrate
**NOTES:** User angry the three tabs existed separately — NEVER re-split them.