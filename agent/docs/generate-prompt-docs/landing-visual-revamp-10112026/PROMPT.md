# RHEO landing — VISUAL revamp continuation (round 03)

You are continuing the RHEO landing redesign (`landing/`, Next.js static export, LAMINAR design system, live at https://rheooo.netlify.app). Rounds 1–2 (RESULT.md v3.0 + RESULT-actrecord-rhythm v1.0) are **implemented**. The data layer is honest now — **the visuals have not been redesigned yet.** This round is about the visual/interaction spec.

## WHAT IS ALREADY DONE (do not re-spec these)

1. **`src/lib/day.ts`** — single source of truth. Build-time JSON import of `sample-day.json` (fields: `minute`, `intensity`, `category|null` — 515 recorded minutes, 920 null). Exports:
   - `DERIVED_CARDS`: IDE 187 min, Browser 111, AI Tools 99, QUIET (= longest null run). Uncategorized excluded from ranking.
   - `LINE_PATH` / `AREA_PATH`: derived from 24 hourly means, **viewBox is 400×140** (not 1000×320).
   - `deriveCards` / `deriveLinePath` / `deriveAreaPath`, plus `hasApp` / `rankable` / `hhmm`.
2. **ActRecord.tsx** (941 lines): `BLOCKS`, `BLOCKS_WITH_TEXT`, `activeIndexFromHour` all **deleted**. Scrub mapping is `activeIndex = Math.min(beats-1, Math.floor(progress*beats))` over 4 derived beats (0/0 padding). Counters target `card.minutes`. Section padding is `pt-0 pb-0` (scrub sections carry no padding; flow sections keep tokens 96/128).
3. **Anchor band**: an overlay div on the chart showing the active card's time range via `transform: translateX(anchorStart/14.4%) scaleX(len/1440)`; transition 400ms on the single LAMINAR easing; reduced-motion honored via `.anchor-band`.
4. **Download.tsx (Vault/Explode figure)**: `sweep()` utility dispatches **synthetic PointerEvents on the stage element** (confirmed: no `isTrusted` guard in hairline; `pointer()` handlers attach on the element; hairline `make()` returns `{set, destroy}` only). Tab-switch narrative is wired: VAULT→LAYERS = dial sweep → 200 ms hold → crossfade (AnimatePresence) → layers sweep apart → hold; LAYERS→VAULT = sweep-to-close → crossfade → dial re-open. A user-initiated "run the tour" button replaces auto-play.
5. **SampleDayTimeline**: segments instrument (consecutive same-category runs → rects, 1px gaps), slide-reveal, client-side facts line. Done.
6. **Tokens**: radii are now 8/12/16 in `globals.css` (`--radius-xs:8 / --radius-sm:12 / --radius-md:16`, `--panel-radius:12`). Download stage radius 12.

## CONFIRMED HAIRLINE INTERNALS (from `@lucasmarkes/hairline` dist)

- `RD = 17` (dial radius), `COMBO = 40` (degrees; Vault opens when dial reaches 40° → internal `setOpen(true)`, bolts draw back).
- Vault `set(v)` sets a **coast** value (not opened); Exploded `set(v)` sets **GAP4** separation (rest ≈ 0.18 → fully open ≈ 1.0).
- `LAP=[[128,150],[200,118],[272,150],[200,206],null]` — the pointer lap used during the intro animation.
- Minified; Vault mount `mount33` at dist `index.js:5490`, Exploded `mount7` at `:1660`.

## WHAT IS STILL WRONG — THE ACTUAL ASK

### A. ActRecord visual chrome is stale + fabricated (E8 sweep not clean)

`.tsx` still contains:
- `const CHIPS = ["FOCUS", "MEETINGS", "LEARNING", "REST"]` (≈ line 447) — fabricated labels rendered as chips.
- Two hardcoded `segments` arrays for rails/bands: `{h0:0,h1:6,"REST"}, {h0:9,h1:12,"DEEP WORK"}, {h0:12,h1:14,"MEETINGS"}, {h0:19,h1:21,"LEARNING"}, {h0:23,h1:24,"REST"}` (≈ lines 681 and ~715) — fabricated hour bands on both a horizontal and a vertical track.
- `const [active, setActive] = useState(1)` — starts mid-"DEEP WORK" by index habit, not derived.

The derived cards render as text, but the section still looks like the old design. **Spec the VISUAL redesign of this section** (it is a 300vh scroll-scrubbed section, headline "a day, replayable").

### B. Vault/Explode geometry is guessed

Sweep coordinates are unverified guesses: dial center (200,160), radius 25, on a ~400-wide stage. If the center/radius are wrong the sweep never reaches 40° and the vault never opens. Spec **how to measure them at runtime** (e.g. from `RD=17` plus the known viewBox/knot geometry) or the exact constants once measured.

### C. Tab-transition narrative timing is hand-rolled

400 ms sweeps, 200 ms holds, 150 ms mount wait — not spec'd. Give exact durations per segment of the VAULT⇄LAYERS narrative on the single easing `cubic-bezier(0.16,1,0.3,1)`, transform/opacity only, reduced-motion fallback.

## QUESTIONS — answer with exact numbers/components, numbered V1–V6

**V1 — ActRecord layout.** Full visual spec for the 300vh scrub section: sticky viewport layout, geometry of the chart pane vs. card pane, the display headline-à-card pairing, type sizes (labels stay `mono` 11px `.mono-label`), spacing per the rhythm table (flow sections pt 96/128; scrub pt 0; gap = following section's pt once; margins forbidden). What changes visually vs. today's two-pane layout?

**V2 — Kill the fabricated chrome.** How should CHIPS and the hardcoded hour-band segments be replaced from derived data? Options I see — pick/override:
(a) CHIPS → the 4 derived card labels as a passive index row (highlight the active one);
(b) hour-band rails → render each derived card's `anchorStart→anchorEnd` as a band on the 1440-min axis (horizontal under the chart, and/or as vertical bands on the TimelineTrack), sized from real data;
(c) something better. Include the "no fabrication" proof: after this change `rg -n 'FOCUS|DEEP WORK|MEETINGS|LEARNING' ActRecord.tsx` must be 0 hits.
Also: what should `active` initialize to (`-1` before first progress, or compute from `intensity` at the anchor hour)?

**V3 — Card visuals.** Do the derived cards need more than the anchor band? Spec anything else (e.g. per-category segment rects on the chart like SampleDayTimeline's instrument, a per-card counter with share-of-active, card transition motion during scrub — crossfade beats b±0.03 etc. — currently `duration 0.22`).

**V4 — Vault dial geometry.** Exact method or constants to make the sweep provably hit the 40° combo: derive dial center in stage coordinates (from `RD=17`, `LAP` points, or the mount's knot data), pick a sweep radius inside the dial's hit circle, and give the final `sweepPoints` array spec (center, radius, start/stop angles, steps).

**V5 — Narrative timing.** Exact ms durations + easing per segment for both VAULT→LAYERS and LAYERS→VAULT (grip sweep, hold, crossfade, separation sweep). Note hairline already owns the internal open/close animation — the narrative must only *drive pointer*, not fight it.

**V6 — Anything else.** Any additional visual issues you already know about in ActRecord/Download/SampleDayTimeline that I should fix in the same pass. If none, say "none".

## Constraints (unchanged)

- LAMINAR: monochrome zinc surfaces, ONE signal hue per surface max, radii 8/12/16 only, Inter + JetBrains Mono + Space Grotesk, no glassmorphism on chrome, no glow/gradients, no spring/bounce, single easing, `prefers-reduced-motion` honored.
- Every rendered number derives from `samples[]`. `summary.*` is untrusted and never rendered.
- **Do NOT edit files** — I implement your spec. Answer inline, numbered. Keep it tight: exact values, no prose padding.
- Reference API for your specs — `day.ts` exports: `SAMPLES`, `DERIVED_CARDS` (`{id,label,minutes,shareOfActive,anchorStart,anchorEnd,anchorLabel,runs,detail}`), `LINE_PATH`, `AREA_PATH`, `deriveCards`, `deriveLinePath`, `deriveAreaPath`, `hasApp`, `rankable`, `hhmm`.
