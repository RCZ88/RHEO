---
id: paint
name: PAINT — Design Orchestrator
version: 1.0.0
category: design
description: >-
  THE entry point for ALL UI/design work. Conducts 12 design skills + 15 MCP servers in a
  fixed pipeline so they never contradict each other. Load this INSTEAD of loading design
  skills individually. Use whenever the task touches a pixel, component, page, chart, color,
  font, radius, hover state, animation, or even a user-facing string. Not for backend-only work.
metadata:
  role: design
  visibility: computer
  role_note: >-
    PAINT is the conductor. skill-router's DESIGN category points here; the 12 sub-skills are
    loaded BY PAINT, in PAINT's order, because they conflict when loaded in arbitrary order.
requires:
  - frontend-external-infra
  - ui-and-charts
  - ui-ux-pro-max
  - taste-skill
  - design-taste
  - signature-design
  - frontend-design
  - humancentred-UIUX
  - impeccable
  - motion-alive
  - animation-stack
  - beautiful-charts
  - font-selection
---

# PAINT — the conductor for every design task

> **Why this skill exists.** RHEO has 12 design skills and 15 MCP servers. Each is individually
> good and **they contradict each other**: three name different primary accent colors, four name
> different max border radii, two ban `backdrop-blur` while two mandate it, and one skill's
> anti-repetition rule would force font rotation that the design constitution forbids. An agent
> that loads them in an arbitrary order produces incoherent output, gets told "this looks like
> AI slop," reloads in a different order, and gets it *more* wrong.
>
> **PAINT is the one place that knows the whole stack.** It decides when the stack activates,
> what order the skills speak in, which MCP supplies real components, and — the part that
> actually fixes the bug — **who wins when two skills disagree.** You do not have to hold all
> 12 in your head. Hold PAINT, and follow it.

**Load PAINT first. Do not load sub-skills directly** — loading one alone is exactly how
contradictions leak in.

## Reference files (load on demand — progressive disclosure)

| File | Read it when |
|------|--------------|
| `references/conflict-resolution.md` | Any two skills disagree, or you are unsure which value to use. **Read before writing the first line of markup.** |
| `references/skill-playbooks.md` | You need to know what ONE specific skill contributes and its failure mode. |
| `references/mcp-routing.md` | You are about to call an MCP, or choosing which component source to pull from. |

---

# LAYER 0 — THE ENTRY GATE

Answer these four before touching anything.

### 0.1 Is this a design task?

**YES** if the change affects anything a human perceives: markup · page · modal · CSS/Tailwind
class · color token · font/size/weight/spacing · radius/border/shadow · chart type or palette ·
icon · empty/loading/error copy · hover/focus/press/disabled state · any animation or
transition · responsive breakpoint · **or even one user-facing string** (toast, button label,
error message).

**NO** only if it is pure backend/logic with no rendered surface: IPC internals, SQL, a pure
function, a migration, a build script, a test.

> Unsure? It is a design task. Twelve skills cost ~2k tokens. Incoherent UI costs a rewrite.

### 0.2 Which SURFACE? (this changes the token law)

| Surface | Token SSoT | Latitude |
|---------|-----------|----------|
| **App UI** — `src/pages`, `src/components`, renderer chrome | `src/index.css` + `design/design.md` (LAMINAR) | **ZERO.** LAMINAR is a hard contract. |
| **Landing / marketing** | `src/tokens.css` (monochrome law) | Moderate; no app chrome. |
| **Learn content** (lessons, blocks) | `src/index.css` | Zero, plus `visual-grounding-authoring` widget rules. |
| **Browser extension overlay** | `src/index.css`, re-skinned | Zero. |

**Default assumption: App UI.** LAMINAR governs. Never paste a hardcoded palette out of a
skill into code — several skills carry stale palettes (and MEMORY.md has a record of one being
fabricated). **Read live tokens from `src/index.css` every time** (phase P4).

### 0.3 Print the Design Intent Contract — 4 questions, into your reply

Non-negotiable. If you cannot answer all four, you are not ready to code. This is the
highest-yield anti-slop gate in the pipeline.

1. **Which skills did you use, and what did each contribute to *this* screen?** If one did
   not apply, say so and why — that is a valid answer, silence is not.
2. **What is the ONE design idea?** Not "clean and modern." An idea is a thesis tied to what
   the screen *means* — e.g. "the Self tab is the user's mind, so identity leads and tools
   follow." If your answer is a vibe word, redo it.
3. **What does every choice MEAN?** For each significant decision give the reason it serves the
   feature's purpose. "Because it's the page accent" is a token, not a meaning.
4. **Does it fit the parent context?** How does this screen belong to the app around it? A
   developer tool gets no bouncy springs in data areas; a finance surface stays composed.

### 0.4 Declare scope

State it: *"Applying to: the Export modal only"* or *"No part specified — applying across
`src/components/dashboard/`."* Never refactor adjacent areas you were not asked to touch —
treat them as fixed context to match, not to change.

---

# LAYER 1 — THE PIPELINE (this exact order)

Each phase has one owner skill group, one required artifact, and one thing it must NOT
decide. The order is what prevents contradiction: **direction before tokens, concept before
flourish, source before markup, structure before state, state before motion, all before audit.**

```
P0  INTENT     humancentred-UIUX · ui-ux-pro-max       -> the 4 answers + industry rules
P1  CHARACTER  taste-skill · design-taste              -> the 3 knob values, written down
P2  CONCEPT    signature-design        (conditional)   -> ONE hero, or explicit "no hero"
P3  SOURCE     frontend-external-infra · ui-and-charts -> real components pulled via MCP
P4  TOKENS     frontend-design · impeccable · font-selection -> the actual class names
P5  STATES     humancentred-UIUX · impeccable         -> empty/loading/error/populated/partial
P6  MOTION     motion-alive · animation-stack         -> liveliness level + motion inventory
P7  AUDIT      impeccable · ui-and-charts · LAMINAR    -> pass/fail per gate
```

### P0 — INTENT · `ui-ux-pro-max` → `humancentred-UIUX`
**Load** in that order. **Use for:** naming the industry this surface belongs to (dev tool /
finance / AI chat / analytics / project mgmt) and inheriting its rules — density, type
pairing, motion speed, banned patterns. Then write the four §0.3 answers.
**Never decide here:** colors, radii, spacing. Those are P4 and come from tokens.
**Must state:** industry · the screen's primary goal in one sentence · the single primary
action. **Prevents:** a finance dashboard in a consumer look; a dev tool with 32px radii.

### P1 — CHARACTER · `taste-skill` → `design-taste`
**Use `taste-skill`** to set and *write down* `DESIGN_VARIANCE` / `MOTION_INTENSITY` /
`VISUAL_DENSITY`. Defaults are **5 / 5 / 7**. **Use `design-taste`** as the aggregator view —
it is a table of contents with the live config, not a rule source.
**Never:** override LAMINAR. On App UI, clamp `DESIGN_VARIANCE` to 1-5.
**⚠ `taste-skill`'s anti-repetition rules are VOID for App UI.** They tell you to rotate
fonts and shift accent colors every few components; LAMINAR §3 caps families at 2 per view
and §2 mandates one signal hue per surface, so rotation produces drift, not variety. Honour
them **only** on the landing surface.
**Must state:** `variance=5, motion=5, density=7 (defaults)`.

### P2 — CONCEPT · `signature-design` *(conditional)*
**Load ONLY if:** the user asked for memorable / redesigned / hero work, said "make it unique,
beautiful, premium", or this is a landing/portfolio surface.
**Skip it if:** dense internal tool, settings page, data table, bug fix. **Skipping is correct
most of the time** — one hero per screen means most screens should have none.
**Use for:** its 9-step pipeline — job+feeling → functional design FIRST → find the focal
point → research the metaphor space → generate 3-6 candidates → fit-test → pick exactly ONE →
engineer the motion → guardrails. Load its `references/pattern-library.md` at step 4-6 and
`tool-selection.md` + `motion-engineering.md` at step 7.
**Never:** start with the effect. The hero comes *after* a working design.
**Must state:** chosen metaphor + fit-rubric scores, **or** the literal sentence
*"No signature element — this surface prioritises density over delight."*

### P3 — SOURCE · `frontend-external-infra` → `ui-and-charts`  *(MANDATORY MCP PHASE)*
**This is the phase people skip, and skipping it is what produces "AI slop".** You must pull
real, production-grade components through MCP **before** writing custom markup.
**Use for:** routing the need to the right registry/MCP (full table in
`references/mcp-routing.md`), reading the component's real source, then re-skinning it to
RHEO tokens.
**The 3-registries law:** general app UI → `@kokonutui` then `@shadcn` core. **Charts and
data-viz → `@bklit` ONLY** (never hand-rolled Recharts; KokonutUI has no charts). Animated
effects → `magicui` / `@react-bits`. Icons → `lucide` (never emoji).
**Never:** hand-write a card/button/chart when a registry already has one. Never install a
second animation engine on top of a KokonutUI component's built-in Motion.
**Must state:** which MCP you called, which component you pulled, what you changed on
re-skin. **A phase where you called zero MCPs is a failed phase** — say so out loud if you
genuinely had nothing to pull.

### P4 — TOKENS · `frontend-design` → `impeccable` → `font-selection`
**Use `frontend-design`** for DeskFlow component patterns, page layout archetypes, the type
scale, z-index ladder. **Use `impeccable`** for the 7 domains (typography, color, spatial,
motion, interaction, responsive, UX writing), the 23 commands, and the 27 anti-patterns.
**Use `font-selection`** whenever a font is being chosen — never invent a font name.
**Never:** copy a hardcoded palette or radius from any skill. **Open `src/index.css` and read
the live tokens.** Then apply LAMINAR: one signal hue per surface, radii 8/12/pill only,
Inter + JetBrains Mono + Space Grotesk with max 2 per view, no glassmorphism on chrome, no
spring/bounce, no raw hex in a component.
**Must state:** the exact token names / class names you will use for background, hairline,
signal hue, radius, and type.

### P5 — STATES · `humancentred-UIUX` → `impeccable`
**Every data-driven element gets all five:** empty (icon + one-line why + a CTA) · loading
(skeleton matching content shape, not a bare spinner) · error (plain cause + a recovery
action) · populated · partial/overflow (truncation, virtualization, big-number formatting).
**Also from `impeccable`:** hover + active + focus-visible + disabled on every interactive
element; inline validation; confirmation or undo for destructive actions; `scale-[0.98]` press
feedback; never a disabled button that looks enabled.
**Never:** expose raw system tokens, enum codes, or stack traces to the user.
**Must state:** which state each new element shows, and how the error state recovers.

### P6 — MOTION · `motion-alive` → `animation-stack`
**`motion-alive` STEP 0 is mandatory:** infer product type, propose a **Liveliness Level**
with a one-line reason, confirm with the user, then lock and state it.
L1 Composed (finance/admin/healthcare) · L2 Responsive (SaaS, dashboards, dev tools —
**the default**) · L3 Expressive (marketing, portfolio, data-art — **mostly landing-only here**).
Then inventory the screen's motion needs by family — A reactive, B transitional, C ambient,
D scroll — and **drop anything above the level's budget.**
**Engine routing (`animation-stack`):** GSAP = real multi-element choreography · Anime.js =
one element moving once · Motion/`motion/react` = the project default · KokonutUI built-in
Motion = already there, add nothing. **One engine per element, never two.**
> **Note:** GSAP and Anime.js are **not** project dependencies and no MCP exists for them. Use
> `motion` (v12). Only add them if a task explicitly demands choreographed timelines, and never
> wire two engines to the same element.
**Never:** animate `width/height/top/left/margin`; use `transition-all`; ship without a
`prefers-reduced-motion` fallback; put ambient loops next to text being read.
**LAMINAR §6 override:** decorative infinite loops (aurora, mesh, shine, border-beam,
glow-breathe) are **banned in App UI.** Functional loops are fine (recording dot, thinking
dots, voice meter). L3 ambient survives only on the landing surface.
**Must state:** the level you built at, the motion inventory, and the reduced-motion fallback.

### P7 — AUDIT · `impeccable` + `ui-and-charts` + the gates below
Run every gate in LAYER 2. Fix failures. Do not declare PASS on a partial audit.

---

# LAYER 2 — THE GATES

### Gate A — Intent
- [ ] Scope declared (specific part, or explicitly project-wide)
- [ ] All 4 Design Intent questions answered in the reply
- [ ] Industry named, primary action of the screen obvious in <1s

### Gate B — Source
- [ ] At least one MCP was called to source real components (or you stated why none was needed)
- [ ] No component was hand-invented when a registry has one
- [ ] Charts came from `@bklit`, not hand-rolled

### Gate C — Tokens (LAMINAR hard gate)
- [ ] Colors read live from `src/index.css` — no palette copied from a skill
- [ ] One signal hue per surface (no amber+emerald chrome)
- [ ] Radii ∈ {8px, 12px, pill}; no `rounded-2xl` / `rounded-3xl`
- [ ] Max 2 font families per view
- [ ] No `backdrop-blur` glassmorphism on chrome
- [ ] No spring / bounce motion
- [ ] No raw hex/rgba inside a `.tsx` (use tokens or `var()`)
- [ ] No emoji as icons — lucide only
- [ ] Categorical data-viz colors from `src/lib/CategoryColors.ts`
- [ ] `data-page` key exists in the index.css map; accent read via `var(--page-accent)`
- [ ] Grep gate passes:
  `grep -rEoh "#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)" src/ | sort | uniq -c | sort -rn`
  — every survivor must exist in `src/index.css` or be pure black/white.

### Gate D — States
- [ ] Empty · loading · error · populated · partial exist for every data-driven element
- [ ] hover / focus-visible / active / disabled on every interactive element
- [ ] Focus rings use `--page-accent`, not the browser default
- [ ] Touch/click targets ≥ 44px; keyboard nav works; nothing is mouse-only
- [ ] Destructive actions confirm or offer undo; user input is never wiped on error
- [ ] Meaning is never carried by color alone

### Gate E — Motion
- [ ] Liveliness level stated and confirmed
- [ ] Motion inventory is inside the level's budget
- [ ] Only `transform` / `opacity` animated; no `transition-all`
- [ ] `prefers-reduced-motion` fallback present
- [ ] No decorative infinite loop in App UI; no motion gating user input
- [ ] Motion reuses existing page accent tokens — no new hue invented for an effect

### Gate F — Copy
- [ ] No raw tokens, enums, or stack traces in user-visible text
- [ ] Buttons are verb + noun ("Save workspace", not "Save")
- [ ] Error format: "[Thing] [verb] because [reason]. [Action to fix]."
- [ ] Empty states explain what *would* be there, not "No data"

---

# LAYER 3 — SELF-MAINTENANCE

PAINT is a **living** document. Same rule as the Router: a stale orchestrator is worse than
none, because every agent trusts it.

1. **Same-cycle sync:** when a design skill is added, removed, or materially changed, update
   PAINT's `requires:` list, the pipeline table, and the phase that owns it — in the SAME
   cycle. Then update `agent/skills/skill-router/SKILL.md` if the DESIGN category changed.
2. **Token drift:** LAMINAR is versioned in `design/design.md`. When it bumps, re-verify
   Gate C against the new §-sections and update the override notes in
   `references/conflict-resolution.md`.
3. **MCP drift:** when `components.json` registries or the `opencode.json` `mcp` block change,
   update `references/mcp-routing.md`.
4. **Conflict log:** every time you resolve a conflict by *your own* judgment rather than by
   a table row, add the row. The next agent needs it.
5. **Bump `version:`** on every sync.
6. **Dead-reference check:** never leave a phase pointing at a skill that was deleted —
   repoint it or delete the phase.
