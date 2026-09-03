# RHEO Landing — Takeover 1: POLISH-1

## What changed

| Phase | Item | Before | After |
|---|---|---|---|
| 1 | Manifesto word windows | `start=0.05+0.7*(i/N)`, `end=0.05+0.7*((i+1)/N)`, lineDraw `[0.1,0.6]`, section 90vh | `start=end=0.83` window, lineDraw `[0.1,0.8]`, section 100dvh |
| 2 | ActRecord counters | Counters only update on `p.on('change')`; initial render shows `0h 00m` | Sync from `p.get()` on mount; added "SCROLL TO REPLAY THE DAY" resting invitation |
| 3 | Capabilities cards | Uneven heights (291/291/271/271/271) | Uniform `minHeight: 292` on all 5 cards |
| 4 | Hero handshake | H1 turbulence only reacts to scroll velocity; first view is crisp | One 0→10→0 ease-out-expo pulse on load after preloader, then velocity-driven |
| 6 | Hygiene | `.compare-table` CSS stubs (42 lines) + `recharts` in deps | Deleted stubs, `npm uninstall recharts`, zero imports remain |

## Manifesto measurement

- **Section height:** 100dvh (800px at 1280×800)
- **Word reveal window:** `0.05+0.83*(i/N)` → `0.05+0.83*((i+1)/N)`
- **Line draw:** `[0.1, 0.8]` → `["0%", "100%"]`
- **Last-word-full-opacity scrollY:** ~1200
- **Sticky unpin scrollY:** ~1360
- **Dead scroll gap:** ~160px (within target 150–250px ✓)
- **Un-reveal on reverse:** clean — opacity drops from 1.0 → 0.15 when scrolling back up

## Build status

- `npm run build` exits 0
- Static pages: 4 generated (/, _not-found, +dynamic /api)
- Token grep: zero secrets found in `src/`
- Console: zero errors at 1280×800 and 375×800

## Media index

### Screenshots (`design/media/shots/`)
- `shot_1280_full.png` — full page @1280
- `shot_1280_hero.png` through `shot_1280_download.png` — 9 per-section shots @1280
- `shot_375_full.png` — full page @375
- `shot_375_hero.png` through `shot_375_download.png` — 9 per-section shots @375

### Clips (`design/media/clips/`)
- `full_reversibility.webm` — top→bottom→top scroll
- `hero_scroll_burst.webm` — rapid scroll burst then recovery
- `manifesto_reveal.webm` — reveal→settle→unpin
- `dots_hover_desktop.webm` — hover proximity + label fade-in @1280
- `dots_hover_mobile.webm` — hover proximity + label fade-in @375

### OG image
- `public/og.png` — 1200×630 hero frame

## SectionIndex dots live test

- **Pixel delta on hover:** 2.92px (≥2px threshold ✓)
- **Label opacity on hover:** 1.0 (visible ✓)
- **Click-scroll:** smooth scroll to section ✓
- **Result:** No tuning needed; current radius 24px, pull cap 8px, bloom 0.08→0.32 works

## Top defects (from context doc)

1. Manifesto dead scroll — FIXED (gap now 160px, within 150–250 target)
2. ActRecord counters showing 0h 00m — FIXED (sync on mount)
3. Capabilities card heights uneven — FIXED (uniform 292px)
4. Hero H1 turbulence invisible on load — FIXED (one-shot pulse)
5. Compare/Testimonials/Pricing/FAQ/TrustedBy absent — NOTED (spec stubs removed)
