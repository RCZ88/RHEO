# Skill Playbooks — what each skill contributes, and how it fails

> Loaded from `PAINT/SKILL.md`. One row per skill: what it owns, what it must produce, and
> the single failure mode it prevents. Consult the phase table in `SKILL.md` for *when*.

---

### `humancentred-UIUX` — comprehension
**Owns:** the 6 pillars (clarity, progressive disclosure, visual hierarchy, state coverage,
feedback, forgiveness) and the 13-item pre-return checklist.
**Must produce:** a stated scope; a named primary action; empty/loading/error for every
data-driven element; a short decision log ("Scope: Export modal. Primary: Confirm. Added
skeleton + retry. Hid format options behind Advanced. Added unsaved-change guard.").
**Never use it for:** visual tokens, motion, or deciding what a screen should *look* like.
**Fails when:** the agent optimizes aesthetics while leaving the happy path only. This is
also the skill that declares scope — loading it late means you already refactored things you
should have left alone.

### `ui-ux-pro-max` — industry direction
**Owns:** which design language the product category demands (dev tool / PM / finance /
AI-ML / analytics), the 67-style library, palette and type-pairing rules, and a 10-item
pre-delivery checklist.
**Must produce:** the named industry + its inherited rules (density, motion speed, banned
patterns) + the style direction.
**Never use it for:** concrete hex values on App UI (use tokens), or as a mandate to
"apply a style by name" when the user already specified a direction.
**Fails when:** a dev tool is styled like a consumer app — big radii, generous whitespace,
decorative gradients on functional elements.

### `taste-skill` — the three knobs
**Owns:** `DESIGN_VARIANCE` / `MOTION_INTENSITY` / `VISUAL_DENSITY` (defaults 5/5/7) and the
aesthetic variant matrix that maps knob combinations to a named result.
**Must produce:** the three values written out in the reply.
**Never use it for:** the anti-repetition rules on App UI (void — see conflict §1.4), or to
justify breaking LAMINAR.
**Fails when:** the agent invents its own aesthetic mid-feature without declaring it, so the
screen drifts from its neighbours. The knobs exist to make the choice *explicit*.

### `design-taste` — the aggregator view
**Owns:** the live config surface — it lists the active knob values and points at the
sub-skills.
**Must produce:** nothing on its own. It is a table of contents.
**Never use it for:** rule lookup; it is not the source of truth for any decision.
**Fails when:** treated as a rule source, which produces a second, drifting set of numbers
next to `taste-skill`.

### `signature-design` — the one hero
**Owns:** the 9-step concept pipeline and the fit rubric (on-concept / complements the
design / usability-safe / data-alive / feasible+optimized). Reject anything failing the first
three regardless of how cool it looks.
**Must produce:** one chosen metaphor with rubric scores, **or** an explicit "no hero".
**Never use it for:** starting from the effect, adding a second hero, or skipping the
empty/milestone states of the hero itself.
**Fails when:** the effect is chosen first and the metaphor bolted on afterwards — the
"pasted-in demo look" that reuses a library's colors and therefore looks foreign.

### `frontend-external-infra` — MCP sourcing + re-skin
**Owns:** the source routing table, the 10-point anti-slop checklist, and the 7 re-skin rules
(tokens, radius, padding, fonts, dark-only, glass, reduced motion).
**Must produce:** which MCP you called, what you pulled, what you changed on re-skin.
**Never use it for:** authorizing a substitute you invented when a source was unavailable.
Say "not available" instead.
**Fails when:** the agent writes markup from training-data memory. That average *is* the
definition of AI slop.

### `ui-and-charts` — registry selection
**Owns:** the KokonutUI (general UI) vs Bklit (charts/data-viz only) split, the install
commands, and the "search the registry before writing custom markup" rule.
**Must produce:** the registry + component name you installed.
**Never use it for:** reaching for Bklit outside chart work, or adding a second animation
engine on top of a KokonutUI component's built-in Motion.
**Fails when:** someone hand-rolls a Recharts area chart while Bklit ships a production one.
Also note: it opens by deferring to any repo `design.md` — which here means **LAMINAR wins**.

### `frontend-design` — RHEO component vocabulary
**Owns:** the component patterns (GlassCard variants, TabBar pills, SectionHeader, StatCard,
Modal, StatusBadge, EmptyState, LoadingState), the four page layout archetypes, the type
scale, and the z-index ladder.
**Must produce:** the concrete class names for the surface you are building.
**Never use it for:** its hardcoded palette and Geist references — LAMINAR §2/§3 supersede
them, and its glass prescription is capped by LAMINAR §7.3.
**Fails when:** the agent reuses a *pattern name* without checking whether the current page
already has a local variant of it.

### `impeccable` — the quality layer
**Owns:** 7 domains (typography, color, spatial, motion, interaction, responsive, UX
writing), 23 commands (`craft`/`audit`/`polish`/`harden`/`animate`/`typeset`/`clarify`/…),
and 27 categorized anti-patterns.
**Must produce:** the specific fixes applied, naming the command used.
**Never use it for:** introducing a font family (→ `font-selection`) or a color that isn't
in the token set.
**Fails when:** the agent reads it as a checklist to admire instead of a defect list to clear.
Its highest-value single use is `audit` before shipping and `harden` on any component that
only handles the happy path.

### `font-selection` — typography provenance
**Owns:** choosing a real, loadable font.
**Must produce:** the family, the weights, and the pairing justification.
**Never use it for:** inventing a font name that "sounds right", or adding a third family to
a view that already has two.
**Fails when:** a font is named in code before anyone checked it exists and is loaded.

### `motion-alive` — the motion layer
**Owns:** the three Liveliness Levels, the A/B/C/D taxonomy, the implementation tokens
(duration/easing/spring/stagger/distance), the recipes, and the reduced-motion contract.
**Must produce:** the level (confirmed, not assumed), the motion inventory by family, and the
reduced-motion fallback.
**Never use it for:** overriding LAMINAR's ban on decorative infinite loops in App UI, or
bypassing STEP 0 (propose + confirm the level before writing a single animation).
**Fails when:** the agent animates everything, uses >400ms fades for routine UI, or ships
motion with no `prefers-reduced-motion` path. It also fails when it is skipped entirely and
the UI "looks fine but feels dead".

### `animation-stack` — engine selection
**Owns:** GSAP vs Anime.js vs Motion vs a registry's built-in animation, and the feel
settings per context (150-300ms quick eases for UI; 500ms+ expressive for hero).
**Must produce:** the chosen engine and the one-line reason.
**Never use it for:** putting two engines on one element, or adding GSAP/Anime.js by default
— **neither is a project dependency and no MCP exists for them.** `motion` (v12) is the
default. Install them only when a task explicitly demands multi-element choreography, and
never on top of a KokonutUI component.
**Fails when:** an agent installs a 70kb animation library to fade in a panel.

### `beautiful-charts` — chart craft
**Owns:** the visual grammar of a good chart (form follows the question, axis/tooltip/legend
discipline, comparison vs composition vs distribution vs correlation).
**Must produce:** a chart type chosen because it answers the question, with the palette
sourced from `src/lib/CategoryColors.ts`.
**Never use it for:** reaching past `@bklit` to a hand-rolled library.
**Fails when:** a pie chart is used for a 12-month trend, or the chart is decorative —
labels/gridlines stripped for "cleanliness" until the value is unreadable.

### `max-security` — the backend crossover
**Owns:** auth, crypto, IPC, DB, input validation.
**Load it when** the UI work also touched those. It is not a design skill; PAINT names it
only as the hand-off point so a security review is never skipped because the task "started as
UI."

### `visual-grounding-authoring` — Learn surfaces only
**Owns:** integrated-widget authoring patterns for lessons (not paired decoration blocks),
`@ref` rules, self-check.
**Load it when** the surface is Learn lesson content, and pair it with `humancentred-UIUX`.
