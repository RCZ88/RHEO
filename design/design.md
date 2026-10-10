# RHEO Design Constitution (LAMINAR) — v1.0

> Foundation slice. This document is the **enforceable contract** for the app UI.
> It is grounded in `agent/docs/design_audit.md` (read-only census of the renderer)
> and supersedes `agent/DESIGN.md` and `agent/docs/DESIGN_SYSTEM.md`, which are now
> archived (see §9). Landing-page/website styling is OUT OF SCOPE here — it lives in
> `src/tokens.css` (monochrome law) and is handled separately.

## §1. Source of Truth

The single source of design tokens for the **app** is `src/index.css` (Tailwind v4
`@theme` block). `src/tokens.css` is the *landing-page* monochrome law and is not the
app SSoT. All component color must resolve to a token defined in `src/index.css` or to
pure black/white expressed as rgba. No new ad-hoc hex/rgba is permitted in component files
(see §7 grep gate).

## §2. The Nine Colors

App surfaces render in a monochrome zinc base + a single signal hue per surface.

- **Base (zinc, from `src/index.css`):** `--color-background #09090b`, `--color-card #18181b`,
  `--color-border #27272a`, `--color-muted-foreground #a1a1aa`, `--color-foreground #fafafa`.
  Hairlines are `rgba(255,255,255,0.08)`.
- **One signal hue per surface.** Allowed signal hues (each is a real `src/index.css` token):
  - amber `--color-amber-400 #fbbf24` — **time-domain surfaces** (Gap-Fill modal, AFK prompt).
  - pink `--color-clay-400 #e8866b` brand + `--accent-primary #ec4899` — **Focus / Deep Focus / brand**.
  - cyan `--ws-accent #06b6d4` — workspace/IDE.
  - emerald `#34d399` — **success / filled** state ONLY (semantic, not a surface hue).
  - rose `#ef4444` — **destructive / error** state ONLY.
- **Categorical data-viz** lives in `src/lib/CategoryColors.ts` (single source — see §5).
- Everything else (the ~592 stray hexes in the audit) is debt to be migrated, not a palette.

## §3. Two Fonts

- UI / body: **Inter** (`--font-sans`)
- Display: **Space Grotesk** (`--font-display`)
- Mono / labels / numerics: **JetBrains Mono** (`--font-mono`)
- Serif (`--font-serif` Source Serif 4) and Caslon are retained ONLY for the Resume preview surface.
- Max 2 font families per view. No decorative display fonts in app chrome.

## §4. Three Radii / Three Slots

- Radii: `8px` (sm), `12px` (card, max), `9999px` (pill). `rounded-2xl`/`rounded-3xl` are banned.
- Slots per surface: **background · hairline · one signal hue**. No per-component bespoke
  shadows, radii, or borders.

## §5. Categorical Colors (single source)

`src/lib/CategoryColors.ts` is the ONLY place category→color is defined. It re-exports the
map from `src/components/CategoryColors.tsx` plus a `getCategoryColor(name)` helper. New
charts use it; legacy chart.js palettes are frozen (documented in the audit, not expanded).

## §6. Motion

- Easings: `--ease-out-expo cubic-bezier(0.19,1,0.22,1)` or `cubic-bezier(0.16,1,0.3,1)`.
- Durations: fast 150ms / normal 250ms / slow 400ms. No spring overshoot (no `bounce:`).
- Page entrance: opacity 0→1, y 16→0, 250ms `cubic-bezier(0.16,1,0.3,1)`.
- **No decorative infinite loops** (aurora / mesh / shine / border-beam / glow-breathe).
  Functional loops allowed: recording indicator, voice meter, thinking dots.
- Honor `prefers-reduced-motion`.

## §7. Anti-Slop Blacklist (hard gate — blocks merge)

A component file fails if it contains ANY of:
1. Decorative chrome gradient (`bg-gradient-to-r from-… via-… to-…` as ornament).
2. More than one signal hue on a surface (amber+emerald chrome = fail).
3. `backdrop-blur` glassmorphism on chrome (modals use flat `bg-zinc-900/80` + hairline).
4. `spring` / `bounce` motion.
5. Emoji as icons (use lucide).
6. Neon glow (`drop-shadow` / `text-shadow` colored halo).
7. Raw hex/rgba typed inside a `.tsx`/`.tsx` component (use tokens / `var()`).
8. Mixed icon sets (lucide only).
9. Per-component bespoke shadow/radius/border.

**Grep gate (run before any UI PR):**
```
grep -rEoh "#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)" src/ | sort | uniq -c | sort -rn
```
Every surviving hex/rgba must exist in `src/index.css` tokens OR be pure black/white.

## §8. Per-Page Accent (wired, not dead)

`App.tsx` already sets `document.documentElement[data-page]` on route change. The theme
map in `src/index.css` is re-keyed to LIVE routes:
`dashboard, activity, ai, learn, resume, ide, finance, insights, life, settings,
guide, studio, terminal, external, database`.
Components read `var(--page-accent)` for the surface signal hue.

## §9. Superseded / Archived

- `agent/DESIGN.md` → **deleted** (dead refs to `globals.css`).
- `agent/docs/DESIGN_SYSTEM.md` → archive to `design/archive/` (pink-primary spec, pre-LAMINAR).
- `src/tokens.css` → retained but scoped to landing only.
- ~~`.light` theme block → **deleted** (dark-only for v1)~~ → **REVERTED 2026-10-01.**
  Light mode is a **first-class, supported theme** again. See §11.
- `index.html <title>` → `DeskFlow AI - Elite Productivity Tracker` → **`RHEO`**.

## §11. Light Mode — "Warm Paper" (first-class, not derived)

> **The rule that was broken:** light mode used to be defined TWICE in
> `src/index.css` — a `.light` block of ~85 **cool-zinc** tokens with a **green**
> `#22c55e` accent, and an `html.light` block of ~34 **warm** tokens with a
> **teal** `#0e7490` accent. Both were live simultaneously. `html.light` won on
> specificity for its 34 tokens; the other ~76 kept cool zinc + green. The app
> rendered warm cream cards on cool zinc borders beside teal headers and green
> toggles. **Lesson: a theme is ONE block. Two blocks is not "50% implemented" —
> it is two palettes fighting, and it will never resolve on its own.**

- **Identity: warm paper, not snow.** Base is bone/oat, never `#fff` and never
  cool grey. Surfaces step *S0 paper `#f5f2ec` → S1 card `#fcfbf8` →
  S2 overlay `#ffffff` → S3 sunken `#edeae2` → S4 veil*.
- **Depth comes from hairlines, never shadow.** A light surface has no ambient
  occlusion to sell, so a drop shadow is a lie. `--ws-border` is
  `rgb(28 25 23 / 0.10)` — light needs *more* alpha than dark, because a dark
  hairline vanishes into a bright field where a light one does not.
- **One signal hue: deep teal** `--ws-accent #0e7490`. It is a **FILL** token
  (borders, tracks, slider thumbs) and clears the 3:1 rule on all four
  surfaces. Accent-coloured **text** must use `--ws-accent-text #0b5c73`
  (6.26:1) — `#0e7490` is only 4.46:1 on the sunken surface and fails 4.5:1
  there.
- **Green is SEMANTIC ONLY** (success / filled). It is *never* the accent. This
  is what killed the green-vs-teal clash: every legacy alias
  (`--color-primary`, `--color-ring`, `--toggle-active`, `--slider-thumb`,
  `--chart-line`, `--sidebar-active-fg`, …) now resolves to teal.
- **Contrast is measured, not eyeballed** (`impeccable`: 4.5:1 body, 3:1
  large/UI). Every light *text* token clears 4.5:1 on all four surfaces.
  `--text-disabled #a8a29e` is deliberately 2.26:1 — WCAG exempts disabled
  controls; do not "fix" it. Use `--text-faint #6f665e` (4.67:1 on sunken) for
  de-emphasised text that still gets read.
- **Chrome sits one step off the field.** `--sidebar-bg` is the *raised*
  `#fcfbf8`, not the paper `#f5f2ec` — matching it exactly makes the app edge
  disappear and the chrome read as page content.
- **Per-page accents get their own light ramp.** The `html.light[data-page=…]`
  remaps exist because the dark accents (cyan `#06b6d4`, amber `#fbbf24`) cannot
  pass 4.5:1 on paper. These are *re-chroma'd*, not reused.

## §10. Pre-Task Checklist (run before restyling any page)

- [ ] Tokens present in `src/index.css` (no new hex in component).
- [ ] Single signal hue chosen for the surface.
- [ ] `data-page` key exists in the index.css map.
- [ ] **If the surface renders in light mode too:** its colour resolves to a
      token that has a `html.light` value, and accent-coloured *text* uses
      `--ws-accent-text` (§11), not `--ws-accent`.
- [ ] Single signal hue chosen for the surface.
- [ ] `data-page` key exists in the index.css map.
- [ ] Categorical color sourced from `src/lib/CategoryColors.ts`.
- [ ] Motion uses sanctioned easing/duration, no spring.
- [ ] `prefers-reduced-motion` honored.
- [ ] §7 grep gate passes.
- [ ] §15 Naming Law — DeskFlow → RHEO in user-visible strings.
- [ ] §16 Framer-motion-sanctioned motion — useSpring only, no bare spring().

