# PROMPT — Halo Island: content fit, layout grouping, and hover that only works in-app

**THIS PROMPT IS SELF-CONTAINED. You do not need any other file to work from.**
Everything you need is inside it. A previous attempt failed because it pointed at a file by a
name that exists 197 times in this repo, so it was never attached. Do not wait for a bundle.

---

## Raw Request (verbatim — the user's own words)

> the pill is being cutoff, teh speech to text deosnt fit the sytle and WHY IS THE NAME OF HTE
> APP AND STUFF BEEING SEPERATED BY THE STOPWATCH?? it should be with the stopwatch? wheres the
> context bundle that i can insert alognsid a new propmt htat epxlains how the previous onehas
> not compelte contexts?

> also, the island thing oesnt work and doesnt open when im not on the app

---

## ⚠️ READ FIRST — what is already DONE. Do not redo it.

The island is **substantial, working, and verified by 255 automated assertions**. It is NOT a
blank slate and it is NOT broken by default. Everything below has already been implemented and
probed. Rewriting any of it will destroy working, tested code.

### Already implemented and green

| Area | State |
|---|---|
| All 5 Figma boards (compact kinds, Focus, Now, Deadlines, Tools) | implemented, 40 board-coverage assertions |
| All 10 board-1 compact pill kinds | implemented in `CompactPill.tsx` |
| S/M/L presets, responsive `fitToCanvas` clamp | implemented, numeric probes |
| Content-fits-window budget at every preset | S +2px, M +2px, L +6px slack |
| Collapsed click region | **fixed this session** — was shaping the whole 480×118 window |
| Wayland cursor detection (`kdotool`/`hyprctl`/`wlrctl`) | working, 6/6 proven |
| `always-on-top` stacking level + re-assert | fixed this session |
| Settings controls (size, shape, radius, margin, resident) | wired |

### Environment (measured, not assumed)

```
XDG_SESSION_TYPE=wayland      XDG_CURRENT_DESKTOP=KDE
electron --ozone-platform=x11  (forced by start-dev.sh:368)
zwlr_layer_shell_v1 available, v5
```

Native Wayland session; the app is an **XWayland client**. `setAlwaysOnTop` maps to
`_NET_WM_STATE_ABOVE`, which is an advisory hint — a native Wayland window that takes focus
wins. This is the environment constraint behind the cross-app hover problem.

### Current geometry (from `src/shared/halo/sizes.ts`)

| preset | expanded | compact pill | fBody | typeScale |
|---|---|---|---|---|
| small | 480×118 | 182×28 | 11 | 0.85 |
| medium | 560×134 | 198×32 | 12 | 1.0 |
| large | 680×154 | 227×40 | 14 | 1.2 |

**These numbers are measured from Figma and are correct. Do not change them.**

---

## The Four Open Problems

### Problem 1 — the pill is cut off

The pill's name was styled `max-width: 140px`, copied from `HALO_STATES.html` board 1's
`.pill .n`. That rule sizes the NAME in isolation; in a single component it never accounts for
the clock, the divider and the gaps. Measured overflow:

```
small   dot 6 + 8 + clock 39 + 8 + div 1 + 8 + name 140 = 210px  vs 182px  → 40px OVER
medium  dot 6 + 8 + clock 42 + 8 + div 1 + 8 + name 140 = 213px  vs 198px  → 31px OVER
large   dot 6 + 8 + clock 49 + 8 + div 1 + 8 + name 140 = 220px  vs 227px  →  9px OVER
```

**Already fixed in source:** the name is now `flex: 0 1 auto; min-width: 0` with the clock,
icon and labels pinned `flex-shrink: 0`, and the row is bounded (`width/max-width: 100%; min-width: 0; overflow: hidden`).
Remaining space for the name is now 100 / 109 / 131px.

**Your task:** verify this is correct and complete. Specifically: `min-width: 0` is what makes
`text-overflow: ellipsis` work on a flex child — confirm it is present on every truncating
child, and confirm no OTHER compact kind (aiUsage, hud, nextDeadline, dictation) overflows its
pill the same way. State the per-kind worst case.

### Problem 2 — speech-to-text does not fit the style

The dictation surface used `--color-clay-400` (`#e8866b`, orange), borrowed from the main app.
`halo.css` declares:

```
--halo-accent: #6fb38f;   /* the only accent — live, recording, active */
```

and `HALO_STATES.html` board 1 draws the dictation mic with `color:var(--signal)`, where
`--signal` IS `#6fb38f`. So the spec never had a second hue for recording.

**Already fixed:** `DictationActivity` clay→`--halo-accent`/`--halo-dim`; `AmbientCard`'s
`DOMAIN_CLASS` lost `clay`/`clayDeep` (`dictation`→accent, `critical`→signal); `--halo-focus`
deleted as dead; `--halo-signal` made self-contained per theme (light `#a8500a`, 4.6:1).

**Your task:** audit the remaining palette. `AmbientCard` still maps activity kinds to hues
(`sky`, `sage`, `amber`) for **identity**. The project's own design rule is *"on a data surface
colour means TIER, never identity."* Decide whether the remaining domain hues survive that rule,
and specify the reduction if not.

### Problem 3 — the app name is separated from the stopwatch

Current expanded Focus layout (`FocusPageRow.tsx`):

```
[ dot · STOPWATCH ]  |div|  [ TRACKING · Figma ]  |div|  [ PRODUCTIVE · 3:12:40 ]  … [reset][pause]
```

**The user wants the app name grouped WITH the stopwatch, not split off behind a divider.**
The name and the timer are one fact — "I have been in Figma for 42 minutes" — and the current
split reads as two unrelated figures.

`HALO_STATES.html` board 2 specifies three separate blocks (`Stopwatch` / `Tracking` /
`Productive`) with dividers between them. **The user is overriding the file.** Say so explicitly
in your output if your design departs from it, and specify the exact resulting layout: which
elements join the left group, where the single remaining divider falls, and how the row still
fits the 118–154px budget with two 44px controls on the right.

### Problem 4 — the island does not open when the user is not in RHEO

This is the hard one and the reason this prompt exists.

The island is a **separate always-on-top `BrowserWindow`**, mandated by `HALO_ISLAND.md` §8. It
is visible over RHEO but loses stacking to native Wayland apps (Firefox, VS Code) because
always-on-top is an X11 hint on an XWayland client.

A previous design round proposed deleting the window and rendering the island in-app. **That
proposal is REJECTED and must not be resurrected.** It would mean the island is never visible
outside RHEO, which defeats the feature. It also proposed a `360×220` panel, contradicting the
measured 480×118/560×134/680×154.

**Your task — pick the design that keeps cross-application presence AND never intercepts a
click.** Candidates to evaluate, then choose one decisively:

1. **Native Wayland client** — drop `--ozone-platform=x11` so Electron uses the Wayland backend.
   Specify exactly what breaks: global shortcuts move to xdg-desktop-portal, `desktopCapturer`
   depends on PipeWire/portal, `setPosition`/`getCursorScreenPoint` lose X11 semantics, and
   `setShape` availability is uncertain. Give the migration and its rollback.
2. **`zwlr_layer_shell_v1` helper** — a small native process owning a real overlay layer
   (v5 is available here). Specify the IPC boundary, input-region semantics, packaging,
   start/stop lifecycle, and what happens if the helper dies.
3. **Hybrid** — keep the Electron window but move it to a compositor layer another way.

Also specify how the hover FSM behaves when the pointer is over a **different** application:
the island must expand there, and must not steal that application's clicks.

---

## Constraints

- Do not change the S/M/L numbers in §"Current geometry".
- Do not delete `CompactPill`, the board coverage, or the hover state machine.
- `setShape` throws on macOS — every use stays guarded.
- Preserve LAMINAR: no spring/bounce, no decorative gradients or glow, one accent per surface,
  radii 8/12/pill only, Inter + JetBrains Mono, `prefers-reduced-motion` honoured.
- Every fix ships as a probe in `agent/probes/` in the style of the existing seven
  (255 assertions currently green). Specify the assertions.

---

## Output

Markdown: **Diagnosis** (mechanism per problem, with the numbers) → **Decision** (the layout
grouping and the overlay architecture, one each, with rejected alternatives) → **Implementation**
(file-by-file, real code) → **Regression tests** → **Spec deltas** as diffs against
`agent/docs/HALO_ISLAND.md`.

State any assumption you make and what would falsify it.