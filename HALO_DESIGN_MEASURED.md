# HALO — MEASURED DESIGN SPEC (from Figma exports)

> **Source:** PNG exports in `/home/clementzhao/Downloads/RHEO Halo/`, read 2026-10-06.
> These numbers are **measured off the frames**, not paraphrased from prose. Where the
> handoff prose and the frames disagree, the frames win and the disagreement is noted.
> Authority order: LAMINAR (`design/design.md`) → this file → `HALO_HANDOFF.md` → the
> 1,722-line `RESULT.md`.

---

## 1. WINDOW (board `5 / How it works in Electron`)

Verbatim from the board:

```
Window: one transparent, frameless, always-on-top window, fixed at the Large expanded size.
The shape morphs inside the window with transform and opacity only. The window never resizes,
so no flicker on any OS.
Outside the shape, clicks pass through: setIgnoreMouseEvents(true, { forward: true }).
Hover or Ctrl+Shift+H expands. Never takes keyboard focus (focusable: false).
Size setting (S, M, L) changes type, spacing and width. Touch targets stay 44px.
Linux: needs a compositor for transparency. Fallback is a solid rounded window.
Motion: expand 200ms ease-out, page switch 150ms fade. Reduced motion: no movement, 0ms.
```

### THE ARCHITECTURAL CONSEQUENCE

**The canvas is permanently 680 × 152 (Large). The S/M/L setting changes the SURFACE
painted inside it, never the window.** This is the single biggest change from the current
implementation and it is correct: a resizing always-on-top window flickers on every OS.

| | value |
|---|---|
Window size | **680 × 152, constant** |
Surface width | 480 / 560 / 680 by setting |
Surface height | ~116 / ~132 / ~152 by setting |
Surface position | centred horizontally, top-aligned (top edge) |
Animation | `transform` + `opacity` ONLY — never `width`/`height` |

**Why this matters for the geometry already fixed:** `applyClickRegion` shapes the window to
the painted surface. With a fixed canvas the shape now changes *size* between settings but
never between phases, so the click region must be re-derived from the surface rect each time
the setting changes — not only when the phase changes. The `hotZoneExpanded` union fix from
this cycle still applies unchanged, because it derives from the surface size.

---

## 2. SIZES (board `1 / Sizes`)

Board labels, verbatim: `SMALL  480 wide, type 85%, icon-only tabs` ·
`MEDIUM  560 wide (default)` · `LARGE  680 wide, type 120%`

| | Small | Medium | Large |
|---|---|---|---|
Expanded width | 480 | 560 | 680 |
Type scale | 85% | 100% | 120% |
Tabs | icon only | icon + label | icon + label |
Panel padding | 8 | 12 | 16 |
Content row height | 48 | 56 | 64 |
Compact height | 28 | 32 | 40 |
Touch target | 44 | 44 | 44 |

**Minimum font size 11px at every size** (handoff §4). This is why the type tokens are
`max(11px, calc(Npx * var(--halo-scale)))` — the floor is what lets 85% and "never below 11"
both hold. Already implemented this cycle.

---

## 3. PAGES (board `2 / Pages`) — measured composition

Every page is **two stacked rows**: a content row on `bg/base`, then the tab rail on
`bg/raised`, **inset** from the panel edges (it does not span full width).

### Page 1 — FOCUS
```
● STOPWATCH   HALO REDESIGN │ TODAY            (↺)  (⏸ green filled)
  00:42:18                    3:12:40
──────────────────────────────────────────────────
  ⏱ Focus │ ▭ Now │ ▣ Deadlines │ ⠿ Tools        ← Focus selected
```
- green **status dot** before the `STOPWATCH` eyebrow
- `HALO REDESIGN` is a muted label on the eyebrow line, not the value
- hero numeral `00:42:18` — **JetBrains Mono**, large
- **vertical hairline** divider between the stopwatch group and the TODAY group
- two **round buttons**, 44px: `↺` reset (dark fill + hairline) and `⏸` pause (**green filled**)

### Page 2 — NOW
```
NOW          │ AI USAGE
Figma  18 min│ 62%  ▬▬▬▬▬▬░░░░
──────────────────────────────────────────────────
  ⏱ Focus │ ▭ Now │ ▣ Deadlines │ ⠿ Tools        ← Now selected
```
- app name in **Inter, large**; `18 min` secondary/dimmer beside it
- `62%` mono, followed by a **4px bar**: green fill on a dark track

### Page 3 — DEADLINES
```
NEXT DEADLINE │ STATUS      │ OPEN              (→)
IT DIV Test   │ 34 days overdue │ 4
──────────────────────────────────────────────────
  ...                                          ← Deadlines selected
```
- **two** vertical hairline dividers (three groups)
- one round `→` arrow button, navigates to the route

### Page 4 — TOOLS
```
(🎤) Dictation │ (>_) Console
     ▁▃▅▇▅▃▁   penguin-console, 3 sessions
──────────────────────────────────────────────────
  ...                                          ← Tools selected
```
- two round buttons (mic, terminal glyph)
- **id**e waveform under Dictation; secondary context line under Console

### Shared visual rules, measured
- **Eyebrow**: small, uppercase, letter-spaced, `text/muted`
- **Big values**: Inter for names (`Figma`, `IT DIV Test`, `Dictation`), **mono for numbers**
  (`00:42:18`, `3:12:40`, `62%`, `4`)
- **Hairline dividers**: 1px vertical, between groups only — never horizontal
- **Round buttons**: 44px circle; primary = green fill + `signal/on` icon; secondary =
  dark fill + hairline border

---

## 4. STATES (board `4 / States`)

| State | Tab | Pause button |
|---|---|---|
default | transparent bg, `text/muted` icon+label | green fill |
hover | `bg/raised`, primary text | lighter/brighter green |
pressed | `bg/raised`, primary, **slight shrink** | slight shrink |
selected | `bg/raised`, **primary text + weight 500** | n/a |
focus-visible | **2px ring in `signal`**, raised bg | **2px ring in `text/primary`** |
disabled | muted, transparent, labelled `(n/a)` | dark fill, muted icon |

**Never colour alone** — hover/selected are paired with weight and a ring. Disabled never
uses `opacity` on text (handoff §9); it uses `text/muted` + a text hint.

---

## 5. COMPACT (board `1`, above each expanded panel)

```
● 00:42:18 │ Halo redesign
```
- green status dot, mono time, hairline divider, muted label
- one kind at a time; hero is the stopwatch; choice comes from the existing promotion logic

---

## 6. MOTION

| | duration | easing | properties |
|---|---|---|---|
expand / collapse | **200ms** | ease-out | transform, opacity |
page change | **150ms** | — | opacity + **8px slide** |
reduced motion | **0ms** | — | none, one global check |

Current implementation uses 250/150/120ms — **200ms must replace 250ms**.

---

## 7. CONFLICTS RESOLVED AGAINST THE FRAMES

| Handoff prose | Frames show | Action |
|---|---|---|
selected tab = `bg/hover` | `bg/raised` reads closer; `bg/hover` and `bg/raised` are indistinguishable at this size | use `bg/hover` per prose, it is the documented token |
expanded 560 × **132** | panel incl. tab rail measures ~145 | **152** is the Large canvas; Medium surface ~145 incl. rail |
`text/muted` fails on **both** themes | Dark 4.12:1 FAILS ✓ · Warm Paper measured **6.94:1 PASSES** | applied Dark `#8b8b94`; **rejected** the Paper replacement (would drop to 4.95:1) |
Linux = **GNOME**, 32px top bar | this box is **KDE Plasma on native Wayland** | keep `top｜left｜right` edge model; do not hardcode a GNOME bar height |

---

## 8. NOT IN THE EXPORTS (handoff §12 open items)

- placeholder values only — every number above is a **placeholder**, not real data
- no empty / loading / error states designed for any page
- no transition prototype measurements beyond the durations in §6
- no settings screen for size / page order / page visibility