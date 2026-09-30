# Dashboard Style Improvement Prompt

> **Prompt Type:** design
> **Target AI:** claude
> **Detail Level:** 10
> **Creativity:** 40
> **Tone:** Direct. No fluff. Produce production-ready visual specs.

---

## Raw Request (verbatim — do not paraphrase)

**"generate a FULL DESIGN IMPROVEMENT FOR THE ENTIRE FUCKING DASHBOARD. DO NOT CHANGE THE LAYOUT JUST CHANGE THE STYLE OF EACH SHIT BECAUSE EVERYTHING LOOKS LIKE AI SLOP. DON'T FUCKING FORGET TO INCLUDE THE SKILLS"**

---

## Problem Statement

The dashboard prototype components (WidgetCardA_SIGNAL, WidgetCardB_TERMINAL, WidgetCardC_NEON, StopwatchPanelA, TrackingScorePanel, ProductivityChart) currently render as generic "AI slop" — flat, indistinguishable surfaces with no visual depth, no cohesive design language, and no emotional resonance. The user sees 3 completely different aesthetic directions that look like placeholder components from a tutorial, not a cohesive desktop productivity application.

**What's wrong:**
1. All three prototypes share the same `bg-zinc-900` + `rounded-xl` + `p-5` formula — zero visual differentiation beyond superficial color accents
2. Typography is either monolithic (all 11px mono) or generic (standard text sizes) — no hierarchy
3. Surfaces lack the LAMINAR glass system (`--dk-bg-surface`, `--dk-elev-*`, `--dk-sheen`)
4. Animations feel mechanical — no liveliness level applied
5. No visual depth hierarchy — everything sits at the same z-plane
6. Missing the emotional tone: this is a premium productivity tool, not a CRUD app

**What matters to the user:** The prototypes should feel like they belong in a premium desktop application — Linear.app quality, not a tutorial dashboard. Each prototype direction (SIGNAL, TERMINAL CHIC, NEON GLASS) should have a distinct but cohesive visual identity.

---

## Context Bundle Reference

Read `CONTEXT_BUNDLE.md` first. It is **self-contained** — you do not need access to the repo, any skill files, or any tool. Everything you need is inside it:

- **Sections 1–13** — design tokens (`--dk-*`, `--ws-*`, `--color-*`), typography scale, color rules, motion/liveliness levels, spatial + interaction rules, UX pillars, developer-tool rules, taste knobs, and the glass system.
- **Section 17** — the 12-item anti-slop checklist, written out in full and restated below.
- **Section 19** — **verbatim unedited source for all 15 prototype files** (WidgetCard A/B/C, StopwatchPanel A/B/C, TrackingScorePanel A/B/C, ProductivityChart A/B/C, and the 3 prototype config files). Diff against these real classes.
- **Section 20** — the reference files to diff against: `DeskFlowCard` (the polished quality bar), `PrototypePreview`, and the `blur-fade` / `card` primitives.

**Spec from the real source in Sections 19 and 20. Do not spec from assumptions or "structural hooks" — the source you need is provided, and guessing is a failure.**

You must use ONLY the design tokens and component structures defined in CONTEXT_BUNDLE.md. Do not invent new tokens or change prop interfaces.

---

## Design Philosophy (these 9 bodies of guidance are already inlined in the bundle)

The bundle already encodes the full substance of the project's 9 mandatory design skills. You do not need to load any skill files — the rules are written out in bundle Sections 4–13, and the anti-slop checklist is bundle Section 17. Applying them means:

1. **Design-system fidelity** — re-skin everything to `--dk-*` / `--ws-*` tokens, use the glass system correctly (page surfaces only, never chrome), and keep the 8/12/pill radius scale.
2. **Human-centric UX** — every direction covers all 4 states (empty / loading / error / populated) plus disabled; clarity over cleverness; progressive disclosure; one focal point per view.
3. **Typographic & spatial rigor** — the 1.25 modular scale, 3-tier contrast, 8px grid, one accent hue per surface, contrast ratios met.
4. **Motion discipline** — pick a Liveliness Level per direction (L1 Composed / L2 Responsive / L3 Expressive) and honor it; animate only `transform`/`opacity`; `prefers-reduced-motion` fallback on every animation.
5. **Taste knobs** — DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY are set (5 / 5 / 7); each of the 3 directions must occupy a distinct point, with a unique accent channel per direction (anti-repetition).
6. **Developer-tool product context** — DeskFlow is a serious dev tool: dense, precise, monospace-dominant, fast motion, no decorative bounce.
7. **Component reuse** — prefer the components already in `src/components/ui/` and the configured registries over hand-rolling.
8. **Chart discipline** — grids, tooltips, and bar fills styled per direction, no decorative chart gradients.
9. **Taste/anti-slop** — every component passes all 12 checklist items; no repeated look across the 3 directions.

**Non-negotiable: every one of the 12 anti-slop checklist items (Section 17 of the bundle) must PASS. Self-audit in Section 6 of your output.**

---

## Anti-Slop Checklist (MANDATORY — must pass every item)

After ANY design decision, verify against these rules:

1. **Re-skin to DeskFlow tokens** — All colors must use `--dk-*`, `--ws-*`, `--color-*`, or `var(--page-accent)`. NO hardcoded hex except in `CATEGORY_ACCENT` mappings.
2. **Max `rounded-xl`, `p-5` padding** — No `rounded-3xl`, no excessive padding
3. **Dark mode only** — No light mode support needed
4. **Fonts**: `Inter` (body), `Space Grotesk` (display), `JetBrains Mono` (code/numbers). Max 2 per view.
5. **Glass layer**: `bg-zinc-900/80 backdrop-blur-xl` — surfaces must have this glass quality where applicable
6. **No glassmorphism on chrome** — Glass is ONLY for page bg surfaces, never for the app shell/sidebar
7. **One signal hue per surface** — Each widget has ONE accent color from `CATEGORY_ACCENT`
8. **Radii: 8/12/pill only** — No arbitrary border-radius values
9. **`prefers-reduced-motion` honored** — All animations must respect `useReducedMotion()`
10. **No decorative glow/gradients** — Every gradient must serve a functional purpose
11. **No spring/bounce** — Use `ease-[0.16,1,0.3,1]` only
12. **Typography hierarchy** — Display numbers in Space Grotesk/mono, body in Inter, code/data in JetBrains Mono

---

## Context Reference (from CONTEXT_BUNDLE.md)

### Current Visual State

**Prototype A (SIGNAL):** `bg-zinc-900 p-5` slab with 2px `SignalBar`. Functional but completely flat. `hover:border-zinc-700` is the only interaction. `BlurFade` entrance with `delay: 0.05 * index`. The stopwatch has `text-[40px]` timer + 3 stat wells. All text is `text-zinc-400` / `text-zinc-100`.

**Prototype B (TERMINAL CHIC):** `rounded-lg bg-zinc-900 text-zinc-100 border border-zinc-800`. All `text-[11px] font-mono font-semibold uppercase tracking-[0.15em] text-zinc-500`. Dense, technical. `motion(Button)` for actions. `AnimatePresence` for collapse. Skeleton loading states. Error states with `border-rose-500/20`.

**Prototype C (NEON GLASS):** `bg-zinc-900/40 backdrop-blur-sm` with `border border-zinc-800/50`. NeonEdge gradient line. `NeonIconBox` with `backgroundColor: ${color}10`. Ambient glow `radial-gradient(circle, ${neonColor}20 0%, transparent 70%)` with `animate: opacity: [0.2, 0.4, 0.2]`. `AnimatePresence` with `initial: { opacity: 0, y: 6, scale: 0.98 }`.

**DeskFlowCard reference** (already polished, Section 19): Uses `hoverLift` (`whileHover: { y: -2, scale: 1.005 }`), `hoverGlow` (`boxShadow: 0 0 20px rgba(244, 63, 94, 0.12)`), `accentColors` with rail/border/bg variants. This is the standard the prototypes should aspire to.

> These summaries are orientation only. **The verbatim source for every component is in Section 19, and the reference files are in Section 20. Spec from the source, not these summaries.**

### Design Tokens Available

All from `src/index.css` `@theme` block and `src/components/ai/design-tokens.css`:
- Surfaces: `--ws-surface: #09090b`, `--ws-surface-raised: #18181b`
- Borders: `--ws-border: rgb(39 39 42 / 0.6)`
- Accent: `--ws-accent: #06b6d4`
- Fonts: `--font-sans: "Inter"`, `--font-display: "Space Grotesk"`, `--font-mono: "JetBrains Mono"`
- Depth: `--dk-elev-1` through `--dk-elev-4`
- Blur: `--dk-blur-sm: blur(12px)`, `--dk-blur-md: blur(24px)`, `--dk-blur-lg: blur(40px)`
- Text hierarchy: `--dk-text-primary: #fafafa`, `--dk-text-secondary: #a1a1aa`, `--dk-text-muted: #71717a`
- Category accents: `--dk-type-focus: #f472b6`, `--dk-type-plan: #a78bfa`, etc.

---

## Engineering Task

**Design the complete visual spec for each of the 3 prototype directions.** For each direction, produce:

### Phase 1: Style Tokens & CSS Variables
- Define the complete token set for each direction (A, B, C)
- Include surface colors, border colors, text colors, shadow values
- Each direction must feel DISTINCT while sharing the same underlying `--dk-*` foundation
- Show the exact CSS custom property values

### Phase 2: Component Visual Specs
For EACH component type across ALL 3 directions:
- WidgetCard (A/B/C variants)
- StopwatchPanel (A/B/C)
- TrackingScorePanel (A/B/C)
- ProductivityChart (A/B/C)
- CardEntrance animation
- Loading/Error/Empty states
- Action buttons (Pause/Resume/Reset, Remove, Collapse)

**Every spec must be written against the verbatim source in CONTEXT_BUNDLE.md Section 19 — quote the actual existing class/prop, then give the exact replacement. Do not describe a component generically or infer its structure.**

For each: provide exact Tailwind classes OR CSS properties, exact border-radius values, exact shadow values, exact color values, exact spacing values, exact font sizes/weights/families.

### Phase 3: Motion & Interaction Specs
- Define the Liveliness Level for each direction (L1 Composed / L2 Responsive / L3 Expressive)
- Hover states: exact transform values, shadow changes, border color transitions
- Focus states: exact outline styles
- Active/pressed states: exact scale values
- Entrance animations: exact duration, delay, easing curve
- Reduced-motion fallbacks: what changes
- The `motion/react` animation configs (ease curves, duration, stagger)

### Phase 4: Visual Depth Hierarchy
- Define the z-plane layering for each direction
- Which elements float, which sit flat
- Shadow elevation system (using `--dk-elev-*` tokens)
- Glass opacity values (`bg-zinc-900/XX`)
- Blur intensities (`backdrop-blur-sm/md/lg`)

---

## Design Task

**Provide pixel-level visual specifications.** The output must be detailed enough to implement directly.

### For each direction (A=SIGNAL, B=TERMINAL CHIC, C=NEON GLASS):

1. **Surface Identity** — What does the background of the card FEEL like?
   - SIGNAL: Solid, stable, signal-like. Think: instrument panel dial.
   - TERMINAL CHIC: Flat, dense, code-like. Think: terminal window in a dark IDE.
   - NEON GLASS: Glassy, glowing, premium. Think: premium audio equipment.

2. **Color Strategy** — How does each direction use the category accent colors?
   - SIGNAL: Top-edge bar is the ONLY color accent. Everything else is zinc. The accent bar should feel like a "signal wire."
   - TERMINAL CHIC: Border color IS the category accent. All text is mono. The accent appears on labels, indicators, and interactive elements.
   - NEON GLASS: Neon edge line + ambient glow + icon box. The glow should feel alive, not static.

3. **Typography Hierarchy** — Exact sizes, weights, families, letter-spacing for:
   - Display numbers (timer: 40px, stats: 13px)
   - Labels (kicker: 10-11px, descriptions: 12px)
   - Titles (13-14px)
   - Category text
   - All must follow Inter/Space Grotesk/JetBrains Mono rules

4. **Spacing System** — Exact values for:
   - Card padding (base: p-5, can vary)
   - Internal gaps between elements
   - Stat well padding
   - Section spacing on the preview page

5. **Shadow & Elevation** — Exact box-shadow values for:
   - Default state
   - Hover state
   - Pressed state
   - Focus-visible state

6. **Border System** — Exact border values for:
   - Default border color/width
   - Hover border change
   - Accent border variants
   - Inner glow / sheen effects

---

## UX Task

**Define the interaction design for every state:**

1. **Empty state** — What does each direction look like when there's no data? Must feel like an invitation, not a dead end.
2. **Loading state** — Skeleton variants for each direction. How do they shimmer/animate?
3. **Error state** — How does each direction communicate errors? Rose/red accents, icons, messages.
4. **Populated state** — The primary visual state. This is where the design shines.
5. **Hover feedback** — What happens when you hover over a card? A stat well? A button? The whole card?
6. **Click feedback** — What happens on click? Scale? Shadow change? Color shift?
7. **Focus-visible** — Must be clearly visible for keyboard navigation
8. **Drag feedback** — When dragging a widget, what visual cue indicates draggability?

---

## Constraints

1. **DO NOT CHANGE LAYOUT** — Keep the exact same grid structure, component structure, prop interfaces, and file paths. This is PURELY visual.
2. **Keep all existing TypeScript interfaces** — `WidgetCardProps`, `StopwatchPanelProps`, `WidgetCategory`, `CATEGORY_ACCENT`, etc. must remain unchanged
3. **Keep all existing component names** — `WidgetCardA`, `WidgetCardB`, `WidgetCardC`, `StopwatchPanelA`, `CardEntrance`, `SignalBar`, `NeonEdge`, `NeonIconBox`
4. **Keep the `BlurFade` entrance system** — Do not replace it
5. **Keep `motion/react` as the animation engine** — Do not switch to GSAP, Anime.js, or CSS-only animations
6. **Must use `useReducedMotion()`** — All motion components must check for reduced motion
7. **No new npm dependencies** — Only use what's already installed
8. **Dark mode only** — No light mode consideration
9. **Preserve all `aria-label` and `focus-visible` attributes**
10. **Each direction must feel DISTINCT** — Don't make A, B, C look like variations of the same thing

---

## Output Format

Return your response as a structured design specification with these sections:

### Section 1: Design Direction Summary
For each direction (SIGNAL, TERMINAL CHIC, NEON GLASS): 2-3 sentences describing the visual philosophy and what makes it distinct.

### Section 2: Complete Token Sets
For each direction: all CSS custom properties or Tailwind config values needed. Copy-paste ready.

### Section 3: Component Specs
For each component across all 3 directions: exact class names, exact CSS properties, exact dimensions, exact colors. Copy-paste ready.

### Section 4: Motion & Animation Specs
For each direction: exact `motion/react` configs, ease curves, durations, stagger values, hover/active/focus states.

### Section 5: State Visuals
For each direction and each state (empty/loading/error/populated): visual description with exact colors, borders, shadows.

### Section 6: Anti-Slop Verification
Self-audit each component against the 12 anti-slop checklist items above. Mark PASS/FAIL for each.

---

## Inspiration References

- **Linear.app** — Clean glass panels, subtle depth, premium feel
- **Raycast** — Command palette UX, glow effects, precision
- **Figma** — Infinite canvas interaction model
- **Arc Browser** — Playful but precise, spatial navigation
- **OBS Studio** — Dark instrument panel, dense information, clear hierarchy
- **Strava** — Clean data display, bold typography, energetic but restrained
- **1Password** — Premium dark UI, glass surfaces, clear hierarchy

Use these as MOOD references only. Do not copy them wholesale.

---

## Final Mandate

**You are the Lead Designer and Engineer.** Design a comprehensive visual improvement for ALL 3 dashboard prototype directions. Every design decision must pass the Anti-Slop Checklist. Every specification must be pixel-level detailed. Every animation must follow the Motion skill's Liveliness Level system. Every component must honor Human-Centric UX principles (empty/loading/error/populated states). The final output must be implementable directly into the existing codebase without any layout changes.

**The goal: "I can't stop looking at it."**
