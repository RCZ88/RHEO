# RHEO Content Engine — Master Feature Checklist & Progress State

> **PURPOSE:** Every feature the user has mentioned for the Content Creation page
> (Overlay Studio, `/studio`), tracked as a checklist with implementation status.
> This is the canonical progress file — updated every cycle.
> **UPDATED:** 2026-08-17 | **STATUS:** RESEARCH PHASE (retention prompt in flight)

## LEGEND
- â¬œ NOT STARTED — not implemented
- ðŸ”„ IN PROGRESS — partially built / being built
- âœ… DONE — implemented, built, verified in the running app
- â›” BLOCKED — blocked by a prerequisite

---

## PART A — PIPELINE FIXES (v3.0 B1—B6, priority order)

| # | Feature | Status | Notes |
|---|---|---|---|
| B1 | **PromptBuilder service** — centralized prompt templates, no raw string concat | â¬œ | Spec: PART 5.1—5.3; all prompts in one `/prompts` dir as `{{placeholders}}` templates |
| B2 | **ResponseParser** — JSON schema validation + retry (max 2) + friendly error fallback | â¬œ | Every AI response must be JSON-only; end prompts with "Respond in JSON only. No markdown." |
| B3 | **UI design tokens overhaul** — Clement Dark Tech (#0a0a0f / #f5c518 / #00d4ff…), reusable Card/Badge/Button/Tabs/Kanban | â¬œ | Spec PART 4.1—4.2; fixes "horrendous" UI |
| B4 | **Brainstorm routing hardening** — strong classification prompt + confirmation loop (âœ…/ðŸ”„ badge) | â¬œ | Never silently drop user thoughts â†’ Unsorted Pool fallback |
| B5 | **Idea retrieval/synthesis** — stored ideas â†’ new ideas (embedding or synthesis engine) | â¬œ | `ideas:synthesize` IPC; `synthesized_from` JSON column |
| B6 | **3-Gate Content Format Validator** — scroll-stop / hard-cut / asset-ready; block "Filming" | â¬œ | `content:validateGates`; `gate_checks` table; user override allowed |

## PART B — NEW FEATURES (v3.0 Part 3)

| # | Feature | Status | Notes |
|---|---|---|---|
| F1 | **Theme System** — `themes` table, generate/save/select/apply, 4 builtin seeds, swatch preview | â¬œ | IPC: `themes:create/generate/getAll/apply/delete`; `episodes.theme_id` |
| F2 | **Idea Synthesis Engine** — combine/extend stored ideas â†’ 3 new concepts, pre-passed through 3 Gates | â¬œ | Prompt skeleton in spec 3.2; frames per concept |
| F3 | **Frame-based script output** — one frame = one visual + one line; kills bullet-point runtime bug | â¬œ | `script_frames` prompt; frames array `{time, visual, line}` |
| F4 | **3-Gate Validator as a service** — per-episode pass/fail + reasons + override | â¬œ | `gate_checks` table; blocks "Mark as Filming" |
| F5 | **Hidden SEO Keyword Injector** — first-3s audio + flash-text + close CTA; poison avoidance | â¬œ | `content:injectSEO`; clusters: "machine learning from scratch", "repo in bio"… |

## PART C — UI OVERHAUL SCREENS (v3.0 Part 4)

| Screen | Status | Required |
|---|---|---|
| Brainstorm — single chat box, NO dropdowns, classification badge + âœ…/ðŸ”„ confirm | â¬œ | |
| Idea Pool — Kanban by status, drag to Episode, search + filter (series/status/priority), priority 1—5 dots | â¬œ | |
| Theme Picker — grid of theme cards, color/font swatch, "Apply" | â¬œ | |
| Episode Detail — tabs Script/Frames/Assets/Metrics/Trials/SEO + theme selector at top | â¬œ | |
| Analytics — Content Equation radar + trend lines + insight cards | â¬œ | Formula: Hook .25 / Visual .20 / Audio .15 / ValueSpeed .20 / Format .20 |
| Frameworks — versioned list + diff + rollback | â¬œ | 2.1 frameworks must be stored in `frameworks` table |
| Wellbeing guard — 10 PM local banner "Sleep > Strategy." | â¬œ | 3 AM Rule |

## PART D — RETENTION PSYCHOLOGY SYSTEM (user-mandated, NEW — not in v3.0 spec)

| # | Concept | User Definition | Status |
|---|---|---|---|
| R1 | **Pattern Interrupt** | Change scenes / use a prop or shock value to break the scroll pattern | â¬œ NOT in system |
| R2 | **Curiosity Gap** | Give info but not too much — keeps people curious about the next part/results. Ex: not "scammers hacked Google" but "and they may have access to your email" | â¬œ NOT in system |
| R3 | **Hook at 3rd—4th second** | NOT at the start — at 3—4s, where viewers actually drop off | â¬œ NOT in system |
| R4 | **Attention Anchor** | Ex: "Over 1 million users already reported their account being hacked. Here's how to check if yours was." | â¬œ NOT in system |
| R5 | **Niche/context adaptation** | All 4 must be adjusted to the niche/topic being done | â¬œ NOT in system |
| R6 | **Evidence criteria on script bullets** | Every script bullet point must carry evidence of HOW it meets the retention criteria | â¬œ NOT in system |
| R7 | **Broader retention research** | Full research on OTHER retention aspects beyond R1—R4 (Architect prompt generated â†’ `agent/docs/generate-prompt-docs/content-retention-research-17082026/`) | ðŸ”„ PROMPT SENT |

## PART E — PROMPT REGISTRY (v3.0 Part 5.3, minimum set)

| Prompt | Purpose | Status |
|---|---|---|
| `classification` | Route brainstorm message | â¬œ |
| `synthesis` | New ideas from stored ideas | â¬œ |
| `script_frames` | Frame-based script output | â¬œ |
| `gate_validator` | 3-Gate check | â¬œ |
| `seo_injector` | Hidden keyword phrases | â¬œ |
| `theme_generator` | Theme from description | â¬œ |
| `analytics_insight` | Patterns/anomalies/recommendation | â¬œ |
| `session_summary` | 15-word brainstorm summary | â¬œ |
| `retention_hook_writer` | **NEW (user):** writes hooks using R1—R4 + evidence lines | â¬œ |
| `retention_evidence_scorer` | **NEW (user):** scores every script bullet against retention criteria with evidence | â¬œ |

## PART F — DATA MODEL (v3.0 Part 6)

| Item | Status |
|---|---|
| `themes` table (schema per spec 3.1) | â¬œ |
| `episodes.theme_id` column | â¬œ |
| `ideas.synthesized_from` JSON column | â¬œ |
| `gate_checks` table | â¬œ |
| `frameworks` table (versioned) | â¬œ |
| IPC: `themes:*`, `ideas:synthesize`, `content:validateGates`, `content:injectSEO` | â¬œ |

## PART G — IMPLEMENTATION PHASES (v3.0 Part 7)

| Phase | Deliverable | Status |
|---|---|---|
| 0 — Plumbing | PromptBuilder + ResponseParser + JSON schemas (B1, B2) | â¬œ |
| 1 — UI Foundation | Design tokens + component library (B3) | â¬œ |
| 2 — Theme System | themes table, generator, picker, apply | â¬œ |
| 3 — Idea Synthesis | ideas:synthesize + frame-based output | â¬œ |
| 4 — Validator + SEO | 3-Gate service + SEO injector | â¬œ |
| 5 — Brainstorm Hardening | Classification + confirmation loop | â¬œ |
| 6 — Analytics Polish | Content Equation radar + insights | â¬œ |
| 7 — **Retention System** | **NEW:** R1—R6 + evidence criteria + niche adaptation | â¬œ |

---

## CURRENT WORK
1. ðŸ”„ Research prompt for retention psychology (R7) â†’ `agent/docs/generate-prompt-docs/content-retention-research-17082026/`
2. â¬œ Master checklist is live; next: Phase 0 (PromptBuilder/ResponseParser) after research returns

## SUCCESS CRITERIA (v3.0 Part 8)
- [ ] Every AI call through PromptBuilder â†’ ResponseParser, zero unhandled JSON errors
- [ ] Generate/save/apply theme; overlays/caption inherit it
- [ ] Synthesize â†’ 3 new episode ideas from stored ideas, pre-validated by 3 Gates
- [ ] Script output is frames (visual + line), not prose bullets
- [ ] Cannot mark "Filming" until all 3 Gates pass (or explicit override)
- [ ] UI consistently uses Clement Dark Tech tokens
- [ ] 10 PM wellbeing banner triggers
- [ ] **NEW:** Hooks land at 3rd—4th second, use Pattern Interrupt / Curiosity Gap / Attention Anchor, adapted per niche
- [ ] **NEW:** Every script bullet carries evidence of which retention criteria it meets

---
## CYCLE LOG
- [2026-08-17] UI SHELL v1 IMPLEMENTED: 7-view Content Engine workspace (src/features/content-engine/) with OverlayStudioPage header toggle (Overlay Studio | Content Engine). Views: Brainstorm, Ideas (4-col funnel), Episodes (Script/SEO/Analytics/Assets/Metrics sub-tabs), Themes, Analytics (videos+retention), Lessons, Frameworks. All IPC calls go through (window as any).deskflowAPI?.contentEngine — backend contract NOT yet implemented (research phase). Verified: tsc clean for new files, vite build OK.
