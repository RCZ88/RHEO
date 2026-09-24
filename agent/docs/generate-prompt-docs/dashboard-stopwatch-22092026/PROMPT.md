# Prompt: StatusBand/Stopwatch Redesign

> **Prompt Type:** design
> **Target AI:** claude
> **Detail Level:** 8
> **Creativity:** 70
> **Max Tokens:** 8000
> **Response Format:** markdown

---

## Raw Request

Redesign the StatusBand (stopwatch) widget on the DeskFlow dashboard. The previous design had an ugly pink accent border on the left side — that's gone now. The user likes clean glowing borders that separate sections nicely. Give the AI full creative freedom to design something beautiful, functional, and custom.

---

## Context

Reference `CONTEXT_BUNDLE.md` in the same directory for all design system details.

**Current state:** `GlassCard variant="elevated" accent="none"` — no pink border, no decoration.

**What the user likes:** Clean glowing borders that separate sections. Think neon light edges, subtle luminous hairlines, gradient accents that define the widget's boundaries without being overwhelming.

**The AI has full creative freedom.** Do NOT force any specific design. Use the existing components as a foundation but feel free to combine them, create new arrangements, add subtle visual effects, and make something that looks premium. The AI should choose its own direction based on what looks best.

**MUST include daily momentum** — always present, always visible.

---

## The Mandate

Design ONE comprehensive StatusBand widget. The AI should decide the best visual direction but should consider:

### Design Direction Guidelines (inspiration, not rules)

The AI can choose from these directions or invent its own:
- **Neon Glow** — `NeonGradientCard` + `BorderBeam` + `DotPattern` for luminous border edges
- **Clean Minimal** — `BlurFade` + `NumberTicker` + `AnimatedCircularProgressBar`, no decoration
- **Glass Surface** — `GlassCard` with subtle hairline borders
- **Something entirely new** — the AI can combine any components, add subtle gradients, ambient glows, or visual effects

The AI should pick what it thinks looks best and justify the choice.

### 1. Data Processing Pipeline
- Data from `useDashboardDataContext()` — display time, focus minutes, productivity state
- `window.deskflowAPI` for IPC calls where needed
- Daily momentum data (focused minutes / target, streak, weekly trend)
- Error/loading/empty/populated states

### 2. Visual Freedom
The AI should use its judgment for the visual design, considering:
- **Glowing borders** as a key aesthetic — subtle luminous edges that separate sections
- Use `NeonGradientCard`, `BorderBeam`, `DotPattern`, or create custom effects
- DeskFlow tokens (`--ws-surface`, `--ws-surface-raised`, etc.)
- `--font-display` ("Space Grotesk") for timer values
- `--font-mono` ("JetBrains Mono") for tabular numbers
- `rounded-[10px]` max
- `p-5` padding
- Dark mode only

**The AI can add:** subtle ambient glows, gradient accents, animated light effects, depth layers — whatever makes it look premium.

**The AI should NOT add:** excessive decoration, spring physics, `whileHover` scale, decorative gradients on chrome surfaces.

### 3. Daily Momentum (ALWAYS included)
- Progress ring: today's focused minutes / 240 min target
- Momentum score
- Streak counter  
- Weekly trend mini-bars
- This section must be visually distinct from the timer — use the glowing borders to separate it

### 4. Interaction Flow
- Click widget → navigate to source page via `useNavigate()`
- Hover → hairline brightening + cursor pointer (NOT scale)
- "Focus" button → start focus session
- Timer in `HH:MM:SS` format
- State: Idle → Locked In → Distracting (smooth transitions)
- Entrance animations ≤400ms, one-shot

### 5. Complete Component Code
Produce the full `StatusBand` component ready to drop into `src/pages/dashboard/StatusBand.tsx`.

---

## Frontend Design Skills (MUST BE LOADED by receiving AI)

1. **Frontend Design** — DeskFlow component patterns, tokens, spacing, typography
2. **Human-Centric UX** — empty/loading/error/populated states
3. **Impeccable** — 7 design domains, 27 anti-patterns
4. **Motion — Bring the UI Alive** — Liveliness Levels
5. **UI UX Pro Max** — developer tools rules
6. **Design Taste System** — aesthetic matrix, anti-repetition
7. **UI and Charts** — MCP component browsing
8. **Animation Stack** — motion engine selection

---

## MCP Inventory

| Component | Source | Use |
|-----------|--------|-----|
| `NeonGradientCard` | Project file | Glowing gradient border |
| `BorderBeam` | Project file | Animated light along border |
| `DotPattern` | Project file | Background pattern |
| `BlurFade` | Project file | Entrance animation |
| `AnimatedCircularProgressBar` | Project file | Progress ring |
| `NumberTicker` | Project file | Animated time display |
| `GlassCard` | Project file | Card wrapper |
| `Card`, `Button`, `Badge`, `progress` | shadcn via MCP | Standard UI |
| `Bot`, `Target`, `Activity`, `Flame`, `Clock`, `Sparkles` | Lucide | Icons |

---

## Anti-Slop Checklist (MANDATORY)

1. DeskFlow tokens only — no hex literals
2. `rounded-[10px]` max
3. `p-5` padding
4. Dark mode only
5. Space Grotesk + JetBrains Mono fonts
6. `motion/react` only — no `framer-motion` direct imports
7. No `whileHover` scale
8. No spring physics
9. All 4 states covered
10. Daily momentum included
11. No `backdrop-blur` unless it's part of the glass design intent
12. The AI must justify every visual choice in the output

---

## Constraints

- Must work with existing `WidgetCard` wrapper in `WidgetGrid.tsx`
- Must use `useDashboardDataContext()` for data
- Must work with `registerWidgets.ts`
- Must not break existing dashboard layout
- `accent="none"` is already applied — no pink borders
- The AI can use `box-shadow` ONLY for neon glow effects (Design B direction)
