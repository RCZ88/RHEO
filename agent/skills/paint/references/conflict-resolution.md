# Conflict Resolution — who wins when two skills disagree

> Loaded from `PAINT/SKILL.md`. Read before writing the first line of markup.
> **Precedence, highest first:**
> 1. **`design/design.md` (LAMINAR)** — the enforceable contract for App UI. Overrides everything.
> 2. **Live tokens in `src/index.css`** — ground truth for any concrete color/spacing value.
> 3. **The registry component's own conventions** — for structure, not for color.
> 4. **PAINT's pipeline phase order** — decides *which skill speaks first*, not *what is true*.
> 5. **The sub-skills** — guidance, not law.

---

## 1. THE BIG SIX (the contradictions that actually fire)

### 1.1 Primary accent color — three skills, three answers
- `frontend-design` says **pink-500** is the brand default.
- `ui-ux-pro-max` says pink-500 **or** cyan-400 for dark dev tools.
- `MEMORY.md` (2026-09-20) records a session that declared pink "FABRICATED" and green/amber correct.
- LAMINAR §2 says: **amber for time surfaces, pink/clay for Focus + brand, cyan for
  workspace/IDE, emerald success-only, rose destructive-only.**

**Resolution:** LAMINAR §2 wins, but **do not hardcode any of those hexes from this table.**
Read `src/index.css` for the live value of `--accent-primary`, `--page-accent`, and
`--color-amber-400` etc. The one rule that never changes: **emerald is success-state only,
never a surface hue. Rose is destructive-only. One signal hue per surface.**
`MEMORY.md`'s "green is primary" note predates LAMINAR and is **superseded** — but treat the
*meta-lesson* as live: **verify tokens in `src/index.css`; never trust a palette written in
prose.**

### 1.2 Backdrop-blur / glassmorphism — two mandate it, two ban it
- `frontend-design` §"Glass as Structure": *use `backdrop-blur-xl` for depth.*
- `ui-ux-pro-max` lists "Dark Glass" as a valid dev-tool style.
- LAMINAR §7.3: **"backdrop-blur glassmorphism on chrome" is a hard-gate FAIL.** Modals use
  flat `bg-zinc-900/80` + hairline.

**Resolution:** **LAMINAR wins for App UI chrome** — modals, dropdowns, sticky headers,
toasts, sidebars. Flat surface + hairline, no blur.
*Where blur is still acceptable:* an overlay that sits on top of a canvas/3D scene (it is
separating two rendered layers, not faking depth), and the landing surface under
`src/tokens.css`. Glassmorphism that "adds visual weight without structure" is the failure
mode LAMINAR is banning — honour that reasoning even in the grey zones.

### 1.3 Border radius — four different maximums
| Source | Max radius |
|--------|-----------|
| `frontend-design` | `rounded-xl` (12px) |
| `impeccable` anti-pattern #13 | "not > 24px for small cards" |
| `ui-ux-pro-max` dev tools | "not > 8px on terminal/code elements" |
| **LAMINAR §4** | **`8px` (sm) · `12px` (card, max) · `9999px` (pill). `rounded-2xl`/`rounded-3xl` BANNED.** |

**Resolution:** LAMINAR's three-slot scale is the whole system. The `ui-ux-pro-max` 8px rule
is not discarded — it is the *sm slot*: use `rounded-lg` (8px) on terminal/code/data-dense
elements, `rounded-xl` (12px) on cards/modals, `rounded-full` on pills/avatars/status dots.
That reconciles all three.

### 1.4 Fonts — how many, and which
- `frontend-design` / `impeccable` say **Geist** + JetBrains Mono.
- `ui-ux-pro-max` says **Geist or Inter** + JetBrains Mono.
- `taste-skill` anti-repetition says **rotate fonts** every few components.
- **LAMINAR §3** says **Inter** (`--font-sans`) + Space Grotesk (`--font-display`) +
  JetBrains Mono (`--font-mono`), **max 2 per view**; serif is reserved for the Resume preview.

**Resolution:** LAMINAR wins on the families — read the live `--font-*` vars from
`src/index.css`. **`taste-skill`'s font-rotation rule is VOID for App UI** (it would break the
2-per-view cap and cause drift). Rotation is legal only on the landing surface.
Geist is a legacy reference; if a Geist token still exists, use it only where LAMINAR allows.

### 1.5 Springs, bounce, and overshoot
- `taste-skill` MOTION_INTENSITY 7-10 → "spring physics, staggered entrances, scroll-driven".
- `motion-alive` L3 → "rich spring physics", and maps MOTION_INTENSITY 8-10 to L3.
- `impeccable` #4 motion domain allows spring for "playful interactions".
- `ui-ux-pro-max` dev tools: "no bounces in serious tools".
- **LAMINAR §6:** "**No spring overshoot (no `bounce:`)**" — and §7.4 makes spring/bounce a
  hard-gate FAIL. §16 permits `useSpring` only.

**Resolution:** App UI = **duration easing only** (`--ease-out-expo` or
`cubic-bezier(0.16,1,0.3,1)`; durations 150/250/400ms). `useSpring` is permitted for *value*
animation (a number counting up, a scrubbed progress value) because it is not layout
overshoot. No `type: 'spring'` on entrances, no `bounce:` keyframes, no elastic/back easing
in data areas. Springs and overshoot belong to the landing surface.

### 1.6 Decorative infinite loops
- `motion-alive` L2 allows "one restrained ambient accent"; L3 allows aurora, mesh, particles,
  marquee, animated borders, grain.
- **LAMINAR §6:** "**No decorative infinite loops** (aurora / mesh / shine / border-beam /
  glow-breathe). Functional loops allowed: recording indicator, voice meter, thinking dots."

**Resolution:** App UI = **functional loops only.** A pulsing "recording" dot is legal; a
drifting gradient behind a card is not. `motion-alive`'s whole C taxonomy (ambient) is
**landing-surface-only** here. This also means the common pattern
`<motion.div animate={{opacity:[1,.4,1]}} transition={{repeat:Infinity}}>` on a status pill is
legal (functional), while the same on a decorative orb is not.

---

## 2. SECONDARY CONFLICTS (quick table)

| Question | Wrong answers to ignore | Correct |
|----------|------------------------|---------|
| Card padding | `p-6`, `p-8` (common in registry components) | `p-5` (20px), per LAMINAR slot discipline |
| Elevation | `box-shadow` for depth (frontend-design itself says never in dark; registry components always do it) | Border brightness + flat surface. `shadow-*` only where LAMINAR sanctions it |
| Background | pure `#000` | `zinc-950` / `--color-background` + subtle texture |
| `transition` | `transition-all` (appears in ~every registry component) | name the properties: `transition-colors`, `transition-opacity`, `transition-transform` |
| Focus ring | default browser outline; `ring-pink-500/50` (impeccable) | `var(--page-accent)`-based ring (frontend-external-infra) |
| Animating | `width/height/top/left/margin/padding` (any registry component doing this) | `transform` + `opacity` only |
| Text hierarchy via `opacity-50` | impeccable calls this an anti-pattern; registry code does it constantly | use dedicated text tokens (`--color-muted-foreground`) |
| State meaning by color alone | registry status pills that are only a colored dot | pair color with text or icon |
| `z-index: 9999` | ubiquitous in pulled components | the z-ladder (base 0 / elevated 10 / dropdown 20 / modal 30 / toast 40 / overlay 50) |
| Chart palette | hand-picked Recharts defaults | `src/lib/CategoryColors.ts` (single source) — legacy chart.js palettes are frozen |
| "Every screen needs a hero" | agent over-applying signature-design | `signature-design` is conditional; most dense surfaces correctly have **no** hero |

---

## 3. HOW TO USE THIS FILE

1. Before markup: skim §1. It is ~6 rows and covers 90% of real collisions.
2. When a pulled component violates a row: **fix the component on re-skin.** Do not "keep the
   source's value because it looked good" — the source's values were designed for a different
   token system.
3. When you resolve something **not** in this table, add the row. The table is the deliverable
   of every PAINT run, not a static artifact.
4. If LAMINAR and this file disagree: **LAMINAR wins, and fix this file.**
