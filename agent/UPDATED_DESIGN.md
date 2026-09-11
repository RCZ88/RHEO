# RHEO DESIGN CONSTITUTION — "LAMINAR" v0.9

> **TO THE AI AGENT:** This document overrides your aesthetic defaults.
> Read it BEFORE any UI task. If a design need seems impossible within this
> system, STOP: propose a token or theme-slot addition — never inline a
> workaround. One hack becomes the next page's precedent.

## §0 CONCEPT
RHEO is an instrument that records time. The UI reads like a measurement
device: black surfaces, white signal lines, data that glows — never decor
that glows. The landing page performs; the app measures. Same language,
different register. Every screen should feel like the logo: one confident
stroke on black.

## §1 THE LAYER LAW (the anti-slop mechanism)
- **Layer 0 — INVARIANTS.** Never vary across pages: palette structure,
  type families & scale, spacing grid, radii, hairline system, elevation
  rules, motion durations/easings, iconography, state patterns.
- **Layer 1 — THEME SLOTS.** A page may vary EXACTLY THREE things, via
  preset only (§10): `signal` (one licensed hue for emphasis), `texture`
  (one environmental motif), `density` (compact | comfortable).
- **The one-sentence test:** variation lives in signal, texture, and
  density — never in new colors, fonts, shapes, or motion.

## §2 PALETTE
### 2.1 Chrome (monochrome — from design/tokens.css; components NEVER type raw hex)
| Token | Value | Use |
|---|---|---|
| bg-0 | #050506 | window/page base |
| bg-1 | #0A0A0C | panels |
| bg-2 | #101014 | cards, inputs, tooltips |
| hairline / strong | rgba(255,255,255,.08) / .16 | all borders & dividers |
| text-hi/mid/low | #F4F4F5 / #A1A1AA / #63636B | primary/secondary/tertiary |
| white | #FFFFFF | THE accent: primary buttons, active states, focus |
| bloom | white ≤8% | the only permitted glow |

### 2.2 Data palette — the licensed nine (total color budget of the app)
Phases (data encoding only — charts, timeline segments, chips, calendar blocks):
| Key | Hex | Phase |
|---|---|---|
| deepwork | #6E96D9 | focused work |
| meetings | #A79BD8 | calls, collaborative |
| learning | #57B596 | study, lessons |
| health   | #C97F8C | movement, body |
| rest     | #DECBA8 | sleep, breaks |
| untracked| #55555E | no data |
Statuses (toasts, badges, destructive confirms ONLY — never decoration):
| danger #D5484A | warning #BD8F3A | success #3FA47C |

**Color laws:**
1. Hue appears ONLY as data encoding or status. Never on chrome, buttons,
   page backgrounds, headings, or body text.
2. Max ONE signal hue emphasized per view (the theme slot). Others may
   appear in charts at full role but never compete for attention.
3. Area fills: series hue at ≤14% alpha. Strokes: hue at 80–100%.
4. Grayscale check: any two colored elements side by side must remain
   distinguishable with color removed (lightness gap ≥8%).
5. Adding color #10 requires editing THIS document, not a component.

### 2.3 Light theme: out of scope for v1. Dark-only. (Semantic tokens keep the door open.)

## §3 TYPOGRAPHY
- Display/UI: **Space Grotesk** (500/700) · Data/mono: **JetBrains Mono** (400/500).
  Two families. Ever.
- Scale: 11 mono-label · 13 UI · 14 body · 16 emphasized · 20 panel-title ·
  28 page-title. Nothing else without a token.
- Mono labels: 11px, uppercase, tracking +0.14em, text-low.
- **Tabular numerals (`font-variant-numeric: tabular-nums`) on ALL dynamic
  numbers** — timers, counters, tables. Numbers must never jiggle.

## §4 SPACE · SHAPE · ELEVATION
- Spacing: 4px grid — 4/8/12/16/24/32/48. No off-grid values.
- Radii: 6 (controls) / 10 (small cards) / 16 (panels). Ever.
- Elevation = surface step + 1px hairline. Real shadows ONLY on floating
  layers (menus, modals, toasts): `0 8px 32px rgba(0,0,0,.5)` + hairline.
- Focus ring: 1px white@60% + 4px white@10% halo. Keyboard-visible, always.
- Scrollbars: 6px, white@12%, hover 24%. Selection: white@20%.

## §5 COMPONENT RECIPES (the canonical list — build these once, reuse forever)
- **Button** — primary: solid white, black text, h32, r6, hover brightness
  1.08 (no scale — instrument calm); secondary: ghost + hairline; tertiary:
  mono text-only; danger: ghost + danger border/text. ◇ map existing names.
- **Input** — bg-2, hairline; focus: white@40% border + halo. Numeric/mono
  fields in JetBrains Mono.
- **Panel** — bg-1, hairline, r16, top sheen. Header row: mono kicker left,
  title, actions right.
- **Chips/tags** — hairline border, mono 11 uppercase. Phase chips add the
  hue as a 6px dot or 2px left bar — never a filled pill.
- **Tabs** — mono labels; active = text-hi + 2px white underline.
- **Tables/lists** — hairline row separators, 36–44px rows, hover white@4%,
  selected = signal@12% bg + 2px left signal bar. No zebra striping.
- **Tooltips** — bg-2, hairline, mono 11, 250ms delay.
- **Modals** — scrim rgba(0,0,0,.6) (no blur), panel 480–640px, focus trap,
  Esc closes.
- **Toasts** — bottom-right, bg-2 + hairline; destructive success MUST
  offer Undo.
- **Skeletons** — white@6% blocks; no shimmer loops in data views.
- **Empty states** — mono message + one texture flourish (§10) + the single
  primary action. Empty is a designed moment, not a blank panel.

## §6 DATA-VIZ
- Chart chrome monochrome: axes/labels mono 10px text-low, gridlines
  white@4%, no shadows, no 3D, no gradient fills (area fills per §2.2.3).
- Series colors ONLY from the phase palette. Categorical mapping is GLOBAL —
  "deep work" is the same blue in every chart, every page, forever.
- Line strokes 1.5px white for primary series; secondary series use palette
  hues. Playheads/scrubbers: white dot + bloom.

## §7 MOTION
- The app runs all day: **no infinite ambient loops.** Textures are static
  (§10). Boot animation plays once. Battery is a design constraint.
- Durations: 80 (hover) / 140 (micro) / 200 (transition) / 320 (panel) ms.
  Ease: cubic-bezier(0.16,1,0.3,1); exits ease-in (0.7,0,0.84,0).
- Springs ONLY for scrub/scrubbed interactions (timeline playhead):
  stiffness 120, damping 25.
- Everything scroll/scrub-bound is REVERSIBLE (pure function of progress).
- `prefers-reduced-motion`: render final states instantly. Non-negotiable.

## §8 ICONOGRAPHY & IMAGERY
- Icons: lucide only, 1.5px stroke, 16/20px. Filled variants only for
  active state. No emoji as UI. One icon set, ever.
- No illustrations, no stock photos, no 3D clipart, no marketing renders
  inside the product. Surfaces and data ARE the visual interest.

## §9 STATES & FORGIVENESS (per Human-Centric UX law)
- Every data surface defines FOUR states: empty / loading / error /
  populated. Shipping three is a bug.
- Errors: danger left-bar + human sentence + mono error id for support.
- Destructive actions: confirm OR undo — always a path back. (Time can't
  rewind; the UI must.)
- Progressive disclosure: density is a choice; advanced controls collapse.

## §10 THEME SYSTEM (the licensed variation)
Schema — themes may ONLY set these keys:
```json
{ "signal": "deepwork|learning|neutral|…", "texture": "ruler|grid|ascii|ridgeline|none",
  "textureOpacity": 0.02–0.04, "density": "compact|comfortable" }
- **Textures (static, pre-rendered, never animated in-app):**
  `ruler` vertical tick hairlines · `grid` 24px dot grid white@4% ·
  `ascii` sparse glyph field @2–3% · `ridgeline` bottom-edge waves @8% ·
  `none`.
- **Registry (◇ provisional — finalize after design_audit):**
  | Surface | signal | texture | density |
  |---|---|---|---|
  | Record/Dashboard | deepwork | ruler | compact |
  | Learn | learning | grid | comfortable |
  | Workspace/Agent | neutral | ascii | compact |
  | Phases/Life view | neutral | ridgeline | comfortable |
  | Settings/Onboarding | neutral | none | comfortable |

## §11 DNA ELEMENTS (what makes every screen unmistakably RHEO)
- Mono kickers on every panel (`SECTION / NAME` pattern, from the landing).
- The rho-mark: About page + boot screen. **Boot = the mark draws itself
  once (900ms)** — "recording begins."
- The day-ruler motif from the landing IS the app's timeline scrubber.
- Phase chips, hairlines, tabular numerals everywhere. ◇ Insert the real
  feature vocabulary from the audit here.

## §12 ANTI-SLOP BLACKLIST (instant rejection)
Decorative hue · chrome gradients · >2 font families · display font for
body copy · per-page bespoke shadows/radii/borders · glassmorphism/blur
panels · emoji icons · colored full-width sidebars/headers · neon glow
text · zebra stripes · bouncy overshoot on data elements · illustrations ·
any hex typed inside a component file · off-grid spacing · mixed icon sets.

## §13 ENFORCEMENT
1. Components consume semantic tokens only. Raw color literals appear in
   `design/tokens.css` and NOWHERE else.
2. Gate before merge:
   `grep -rEoh "#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)" src/ | sort | uniq -c | sort -rn`
   → every value must exist in tokens.css or be pure black/white.
3. Precedence: this doc > your habits > tutorials > component-library
   defaults. Fetched components get the LAMINAR pass before commit.
4. Migration: ◇ order from audit's top-5. One page per session. Each page
   passes §13.2 + the checklist below before the next begins.

## §14 PRE-TASK CHECKLIST (run before marking ANY UI task done)
☐ no raw hex/rgba outside tokens (grep clean) ☐ hues ⊆ licensed nine, data/
status roles only ☐ ≤1 signal hue in view ☐ two families only, tabular-nums
on dynamic numbers ☐ radii ∈{6,10,16}, spacing on 4pt grid ☐ elevation via
hairline+surface; shadow only floating ☐ 4 states defined ☐ destructive →
undo/confirm ☐ reduced-motion safe, no infinite loops ☐ theme slots only ☐
survives the grayscale toggle


---

## 3. The handoff plan — GLM website → your local agent

The flow is a **one-way pipeline of artifacts**, each with a home in the repo — the agent never "remembers" the style, it *reads* it:

| Artifact | From | Lands at | Consumed by |
|---|---|---|---|
| GLM exported code | you export from GLM | `landing/` (own Vite app in the repo) | P-PORT session |
| LANDING_DESIGN_SPEC.md | **this chat — you must save it; it exists nowhere on disk yet** | `design/LANDING_DESIGN_SPEC.md` | P-PORT |
| tokens.css | 1C run (or paste from two messages ago) | `design/tokens.css` | landing **and** app — one source, two consumers |
| styleframes I-1→I-11 | your image gen | `design/styleframes/` | P-PORT (art direction) |
| motion-lab + frozen params | M-0 run | `motion-lab/` | P-PORT (feel values) |
| motion_patterns.md / perf_playbook.md | R-1/R-2 ✅ already on disk | `docs/` | P-PORT |
| design_audit.md | A-1 (§1 above) | `docs/` | → me, for design.md v1.0 + migration order |
| design.md | this message | `design/design.md` | every future UI session |

**Enforcement wiring (do once, ~10 min):**
1. Paste design.md and tokens.css into `design/`.
2. Update the **frontend-design skill** (the one your Router maps to "DeskFlow design system") to point at `design/design.md` as its content — that's the cheapest, cleanest replacement, and the Router's own §7 self-maintenance rule demands the sync. This way the constitution loads automatically on every DESIGN-category task without bloating every session's context.
3. Add one line to **AGENTS.md**: *"All UI work obeys design/design.md (LAMINAR). Themes via presets only; colors via tokens only."*
4. Bump the Router version per its own rule.

**Sequence (important):** tokens land **before** both the landing port and any app restyle, because they're shared. And don't run the landing port and an app-restyle page in the same agent session — separate sessions, separate concerns, tokens as the common ground.

---

## This week's order

1. **Send A-1** (§1) and **G-0 + the three patches** in parallel — they don't touch each other.
2. Generate **I-2/I-3/I-4** icon sheets → pick a direction → I write the SVG geometry.
3. Save `LANDING_DESIGN_SPEC.md` + design.md + tokens.css into `design/` and do the enforcement wiring.
4. Do the reality harvest from last message — it feeds **both** tracks (real screenshots for the landing's Act II/III, real terminology for design.md §11).
5. When `design_audit.md` comes back, bring it to me — I'll return **design.md v1.0** (real page registry, real component names, real migration order) and you start app restyle slices, one page per session, checklist-gated.

The end state you're describing — "same app on every page, but each page has a soul" — is exactly what falls out of this: **nine colors, two fonts, three radii, three slots.** Everything else is invariant, so everything else feels inevitable instead of arbitrary.