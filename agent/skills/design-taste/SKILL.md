---
id: design-taste
name: Design Taste System
version: 1.1.0
category: design
tags: [master, aggregator, design-system, configuration]
---

# Design Taste System (Master Skill)

## Purpose

This is the **aggregated master design skill** for the DeskFlow agent workspace. It references all design sub-skills and declares the current active taste configuration. When in doubt about design direction, the agent should consult this skill first.

## Referenced Sub-Skills

1. **frontend-design** (v3.0.0) — Core UI/UX principles, DeskFlow-specific conventions, ALL page layouts (Dashboard, IDE, Terminal, External, Database, Insights, Stats, Browser, Settings, IDE Help), ALL component patterns (GlassCard 3 variants, TabBar, SectionHeader, StatCard, ChartContainer, Modal, StatusBadge, CategoryBadge, EmptyState, LoadingState), ALL architecture blueprints (Cross-Session Sync, Skill DSL, InitializeProgressModal, AnalyticsDashboard 3 variants, Context Management System, Session Categorization, Agent Readiness Protocol)
2. **impeccable** — 7 domain references (typography, color, spatial, motion, interaction, responsive, UX writing), 23 commands, 27 anti-patterns
3. **ui-ux-pro-max** — Industry-specific design rules, style library, color palettes, typography pairings
4. **taste-skill** — Tunable knobs (variance, motion, density), aesthetic matrix, anti-repetition rules
5. **frontend-external-infra** (v1.0.0) — Connected external libraries (shadcn MCP, Magic UI, Lucide, 21st.dev) for real component inventory, source routing table, anti-slop checklist, DeskFlow re-skin rules

## Active Design Configuration

```
SYSTEM: Design Taste System v1.0.0
STATUS: Active

KNOBS:
  DESIGN_VARIANCE:   {{design_variance}}   (1=Conservative, 10=Experimental)
  MOTION_INTENSITY:  {{motion_intensity}}  (1=Static, 10=Cinematic)
  VISUAL_DENSITY:    {{visual_density}}    (1=Airy, 10=Maximal)

REFERENCES:
  Design References: {{include_references ? "ENABLED" : "DISABLED"}}
  Reference Count:   {{reference_count}}

SUB-SKILLS ACTIVE:
  {{#skills}}
  - {{name}} ({{enabled ? "ON" : "OFF"}})
  {{/skills}}
```

## Unified Design Vocabulary

### Spatial Terms
- **Chrome**: The window frame, title bar, controls — non-content UI
- **Canvas**: The main content area where user work happens
- **Palette**: Sidebar, toolbars, floating panels — contextual tools
- **Overlay**: Modals, toasts, dropdowns — temporary layers above canvas
- **Gutter**: Space between major regions (sidebar ↔ canvas)

### Motion Terms
- **Entrance**: Element appearing (fade in, slide up, scale from 0)
- **Exit**: Element disappearing (fade out, slide down, scale to 0)
- **Transition**: State change within an existing element (color, position)
- **Emphasis**: Drawing attention to an element (pulse, shake, glow)
- **Choreography**: Coordinated sequence of multiple elements

### Color Terms
- **Base**: The deepest background color (zinc-950)
- **Surface**: Elevated backgrounds (zinc-900, zinc-800)
- **Accent**: Primary brand color (pink-500)
- **Semantic**: Status colors (emerald=success, amber=warning, red=error)
- **Muted**: Disabled, secondary, placeholder text (zinc-500, zinc-600)

## Decision Tree

When the agent needs to make a design decision:

```
1. What is the product type?
   → Consult ui-ux-pro-max industry rules

2. What is the component purpose?
   → Consult frontend-design component patterns

3. Is this user-facing or internal?
   → User-facing: Apply full design system
   → Internal: Apply minimal chrome, maximum function

4. What are the current knob values?
   → Low variance: Stick to conventions
   → High variance: Introduce one bold element
   → Low motion: Instant or 150ms transitions
   → High motion: Spring physics, staggered sequences
   → Low density: Generous whitespace, single focus
   → High density: Tight packing, information-rich

5. Has this pattern been used recently?
   → Yes: Apply anti-repetition rule (vary color, shape, or animation)
   → No: Use the pattern freely

6. Does this violate any anti-patterns?
   → Yes: Stop and reconsider
   → No: Proceed
```

## Worked Example — why "C · DEPARTURES" landed (boot UI, 2026-11-14)

CZ picked this design out of three candidates with "so fkn cool". Reproduce the
method, not the pixels:

1. **De-generify the brief by naming a physical object.** "Make a cool loading
   screen" produces spinner + gradient + glass. Name a real artifact instead —
   a meridian line, a precision dial, a departures board — and you inherit its
   materials, physics, and behaviors. You do not invent a style; you **obey the
   object**. If an element cannot name its job inside that world ("just
   decoration"), it gets cut.
2. **Pull mechanics from source, never looks from screenshots.** The split-flap
   tiles came from the real registry component's source: drum charset
   `" ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/&!?"`, `FLIP=56ms` per flap,
   `STAGGER=40ms` per tile, **forward-only stepping**. The lattice wave came
   from `LatticeLoader`'s source: `864ms` sweep, `cubic-bezier(0.77,0,0.175,1)`.
   Real constants are why it feels machined rather than "animated like" a flap.
3. **One metaphor owns every element.** Flap tiles = destination sign; live
   clock = the board's clock; four rows = the departure list with right-aligned
   tabular metas; canvas = the lamp field; bottom track = the board edge.
4. **Motion is a state machine, not a vibe.** Three event classes only —
   entrance (rows slide in on stage change), progress (ONE wave per stage),
   completion (everything rests; the only surviving loop is the ticking clock,
   because a clock is functional, not decorative). "No decorative infinite
   loops" is what makes it feel alive AND honest.
5. **Constraints manufactured the uniqueness.** JetBrains Mono only, ONE hue on
   near-black, no springs, no glass, tabular-nums everywhere, text typeset as a
   table (left ledger + right metas). Generic output says yes to everything and
   centers everything; specificity came from saying no.
6. **Evidence, not vibes.** Headless Chromium + raw CDP: mid-boot and ready
   screenshots, DOM assertions proving the drum literally stepped (`QEDK`→`RFEL`
   →`RHEO`), zero console errors, reduced-motion = static final state. The
   screenshots caught two real bugs a code review missed: a wrong function name
   that killed the boot, and an unseeded canvas `globalAlpha` array painting the
   lattice full-bright.
7. **Preserve the plumbing when porting.** The shipped variant id stayed
   `'meridian'` everywhere (hard-typed in three files + the IPC handler);
   DEPARTURES is what `'meridian'` renders. Renaming ids cascades into files the
   task never named.

## Design Reference Index

When `include_references` is enabled, the following DESIGN.md templates are available:

| Reference | Style | Best For |
|-----------|-------|----------|
| Claude | Warm terracotta, editorial | AI agent interfaces, chat UIs |
| Linear | Ultra-minimal, purple accent | Project management, task lists |
| Vercel | Black/white precision, Geist | Dashboards, developer tools |
| Stripe | Purple gradients, weight-300 | Financial data, tables, charts |
| Supabase | Dark emerald, code-first | Developer tools, API docs |
| Sentry | Dark dashboard, data-dense | Error tracking, monitoring |
| PostHog | Playful dark, colorful charts | Analytics, funnels, graphs |
| Raycast | Sleek dark chrome, vibrant | Command palettes, quick actions |

To use a reference: "Apply [Reference] style to this component" — the agent will read the DESIGN.md and extract relevant patterns.

## Pre-Generation Checklist

Before generating any UI component:

- [ ] Read current knob values from context
- [ ] Identify product type and consult industry rules
- [ ] Check anti-repetition rules against recent history
- [ ] Verify no anti-patterns will be violated
- [ ] Select appropriate component pattern from frontend-design
- [ ] Determine if design reference should be applied
- [ ] Log design decisions for future anti-repetition checks

## Activation Criteria

**This skill is ALWAYS active when the Design Skills system is enabled.** It serves as the central dispatcher for all design decisions.

**The agent should:**
1. Read this skill FIRST when design questions arise
2. Follow the decision tree for systematic choices
3. Delegate to sub-skills for domain-specific knowledge
4. Report the active configuration at the start of design tasks
