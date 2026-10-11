# Halo Island — "opens from the side / UI not displayed" regression report

**Author:** opencode-halo-customize-20261006
**Status:** report only — **no code was changed in producing this document.**
**Symptom reported:** the island now opens from the side, and the UI does not display correctly.

---

## 1. Summary

This is **my regression**. It was introduced when I made the island's screen position
configurable ("where it sits"), and it is a **percentage double-count** in one inline style
on the island surface element.

- **Cause:** `marginLeft` / `marginTop` were written as `calc(<fraction>% - <halfSize>px)`.
  The fraction had **already** been resolved by the sibling `left:` / `top:` declaration, so
  the `calc()` subtracted the fraction a **second** time.
- **Effect:** the surface is displaced by roughly half its own size — it renders off toward
  the edge of its window instead of where it belongs, which reads as "opening from the side."
- **Blast radius:** worst on the **left** and **right** edges; harmless on **top** (see §4).

---

## 2. The exact change I made

### 2.1 What was there before (working)

```tsx
// src/features/halo/OverlayRoot.tsx  — the island surface <motion.div>
style={{
  width,
  height,
  top: 0,
  left: '50%',
  marginLeft: -width / 2,          // <-- plain negative half-width. Correct.
  borderTopLeftRadius: radii.topLeft,
  ...
}}
data-edge="top"                     // <-- also hardcoded to "top"
```

### 2.2 What I replaced it with

```tsx
const { xFrac, yFrac } = surfaceAnchorFractions(prefs.edge);

style={{
  width,
  height,
  left: `${xFrac * 100}%`,
  top: `${yFrac * 100}%`,
  marginLeft: `calc(${xFrac * 100}% - ${xFrac === 0.5 ? width / 2 : xFrac === 1 ? width : 0}px)`,
  marginTop: `calc(${yFrac * 100}% - ${yFrac === 0.5 ? height / 2 : yFrac === 1 ? height : 0}px)`,
  transformOrigin: origin,
  ...
}}
```

### 2.3 The arithmetic error

For the default case (`edge: 'top'`, anchor centred, `width = 460`, canvas `520` wide):

| step | value |
|---|---|
| `left: 50%` resolves to | 260px — element's **left edge** now sits at 260 |
| `calc(50% - 230px)` resolves to | 50% of 520 = 260, **minus** 230 = **+30px** |
| element actually starts at | 260 + 30 = **290px** |
| element actually ends at | 290 + 460 = **750px** |
| canvas is | **520px** wide |

**230px of the island hangs off the right edge of its own window.** The correct value is
`marginLeft: -230px`, which puts the element at 30…490 — centred.

The bug in one line: `left: 50%` and `marginLeft: calc(50% - …)` each express *the same
fraction*. Two expressions for one quantity; the fraction is applied twice.

---

## 3. Why it is easy to miss

- **The default case is nearly harmless.** On `edge: 'top'`, `yFrac = 0`, so
  `marginTop: calc(0% - 0px)` = `0`. The top edge looks fine.
- **`esbuild` passes** — this is valid CSS; it parses.
- **`tsc` passes** — `string` interpolation is type-correct.
- **The numeric probe passes** — it tested `computeGeometry` / `computeHotZone`, which are
  main-process functions. This bug is in the **renderer's** inline style, which no probe
  exercised.
- It only becomes visible once the user selects a **side** edge.

This is the same class of failure recorded in MEMORY.md: *a probe that prints numbers finds
what static checks cannot* — except here the probe was pointed at the wrong layer.

---

## 4. Current state of the file — read this before fixing anything

Another agent has already corrected **one half**. As of this report,
`src/features/halo/OverlayRoot.tsx` reads:

- **`marginLeft` — FIXED.** Now:
  ```tsx
  marginLeft: -(xFrac === 0.5 ? width / 2 : xFrac === 1 ? width : 0),
  ```
  with an explanatory comment immediately above it (lines ~666–668) describing exactly the
  double-count described here.

- **`marginTop` — STILL BROKEN.** It retains the faulty form:
  ```tsx
  marginTop: `calc(${yFrac * 100}% - ${yFrac === 0.5 ? height / 2 : yFrac === 1 ? height : 0}px)`,
  ```

### Per-edge consequence of the remaining `marginTop`

| edge | `yFrac` | `marginTop` resolves to | result |
|---|---|---|---|
| `top` | 0 | `calc(0% - 0px)` = 0 | correct |
| `bottom` | 1 | `calc(100% - Hpx)` = **+82px** | pushed 82px past the bottom |
| `left` | 0.5 | `calc(50% - 118px)` = **+32px** | **pushed 32px down** |
| `right` | 0.5 | `calc(50% - 118px)` = **+32px** | **pushed 32px down** |

So after the `marginLeft` fix the island is horizontally correct but **vertically offset by
about half its height on the left, right and bottom edges.** That is the remaining
"opens from the side" behaviour.

---

## 5. The fix (NOT APPLIED — described only)

Make `marginTop` mirror whatever `marginLeft` was corrected to — a plain negative offset,
with **no** percentage term:

```tsx
marginTop: -(yFrac === 0.5 ? height / 2 : yFrac === 1 ? height : 0),
```

Verification after applying:

| edge | expected surface origin in a 520×300 canvas |
|---|---|
| `top`, centred | x = 30, y = 0 |
| `left`, centred | x = 0, y = 32 |
| `right`, centred | x = 60, y = 32 |
| `bottom`, centred | x = 30, y = 64 |

---

## 6. Everything else I changed that touches position or size

For completeness, so the next person does not have to re-derive it. All of these are in
`src/shared/halo/geometry.ts` and `src/features/halo/HaloPreferences.ts`, and **all are
numerically correct** — the numeric probe covered them.

| # | Change | File | Verdict |
|---|---|---|---|
| 1 | `surfaceAnchorFractions(edge)` added — top/left/right, centred on each axis | `shared/halo/geometry.ts` | correct; mirrors §127 |
| 2 | `computeSurfaceRect(canvas, size, edge)` — one shared rect for the surface, hot zone **and** click region | `shared/halo/geometry.ts` | correct; this is what fixed the click-blocking |
| 3 | `computeHotZone(...)` now derives from the surface rect + user padding instead of canvas centre | `shared/halo/geometry.ts` | correct |
| 4 | `computeGeometry` placement rewritten to use `surfaceAnchorFractions` | `shared/halo/geometry.ts` | equivalent to the old maths for all three edges |
| 5 | `OverlayEdge` briefly widened to include `'bottom'`, then **reverted** | `shared/halo/types.ts` | reverted — §127 forbids it |
| 6 | `anchor` / `offsetX` / `offsetY` prefs added, then **removed** | `features/halo/HaloPreferences.ts` | removed — §127 forbids freeform positioning |
| 7 | `transform: translate(offsetX, offsetY)` removed from the surface style | `features/halo/OverlayRoot.tsx` | correct — those prefs no longer exist |
| 8 | `data-edge="top"` hardcode → `data-edge={prefs.edge}` | `features/halo/OverlayRoot.tsx` | correct — this is what made side edges *reachable* at all |

**Items 1–4 and 8 are why the bug could happen at all:** before my change the renderer
hardcoded the top edge, so the side-edge code path had never run. I connected it, and the
bug was in the first version of that connection.

---

## 7. Honest accounting

- I introduced this bug.
- My verification missed it because every check I ran was on the main-process geometry, and
  this defect is a renderer-side inline style.
- I have **still never seen this page or island render** — `probe_open` in `electron-web`
  mode failed to start a browser earlier in the session and I did not get it working. A
  single successful mount would have surfaced this immediately, because a 230px offset is
  impossible to miss visually.
- The lesson is the same one MEMORY.md keeps recording from a different angle: **verify the
  layer you changed.** I changed the renderer and tested the main process.