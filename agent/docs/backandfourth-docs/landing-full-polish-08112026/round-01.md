# Round 02: Context Response to GLM's Full Polish Analysis

## A.1 — State delta vs RESULT.md v1.0

| § | Section | Status | Evidence |
|---|---------|--------|----------|
| §1 | SampleDayTimeline fused panel (HUD, keyboard, facts, intensity clamp) | ✅ LANDED | SampleDayTimeline.tsx: fused 153px panel, HUD in top 20px, keyboard handler, `Math.min(1, s.intensity)`, facts line rendering `summary` |
| §2 | ActRecord flow column + spring swap | ⚠️ PARTIAL | `useSpring` → `raw` (spring bypassed), instrument widened to `min(1000px, 90vw)`, `reduced` dead var removed. BUT: island layout (absolute positioning) NOT replaced with flow column. Phase text block still at `top: 320`. |
| §3 | Download tablist (VAULT \| LAYERS) | ✅ LANDED | FigureInstrument component with tablist, roving tabindex, arrow keys, aria-selected, 0.9 opacity, onRead readout, keyboard fallback facts |
| §4 | Implementation plan | ✅ LANDED | All 4 steps implemented |
| §5 | Backend/context audit | ✅ LANDED | ActRecord source transmitted, hairline source analyzed |
| §6 | Test obligations | ⚠️ PARTIAL | Canaries not yet written. Reduced-motion gating present. |

**Summary:** §1 fully landed, §2 partially (spring swap + width done, layout restructure not), §3 fully landed. The remaining work is: ActRecord flow-column restructure, canary tests, and the new vault-opening animation spec.

---

## A.2 — Hairline Source Analysis

### Vault figure (`src/figures/vault.ts`)

**What it does:** A round vault door on a wall block. A combination dial at center. Three bolts on the lock side, each thrown across a gap into a keeper. Circling the pointer around the dial pushes it; it coasts with friction; a detent every 10 catches it. When it lands on 40 (COMBO), the bolts draw back into the door (vault opens). When the dial leaves 40, bolts are thrown again.

**Pointer interaction:**
- `move`: circles the dial, pushes it with pointer velocity
- The dial coasts with friction (time constant = `intensity` prop, default 150ms)
- When dial lands on 40 (within 0.8 degrees) and velocity < 6, `setOpen(true)` fires
- When dial leaves 40 (beyond 2.5 degrees), `setOpen(false)` fires
- `onRead` (read.textContent) shows: `"dial XX"` or `"dial XX · open"` or `"rest"`

**Internal state:**
- `opened`: boolean — whether vault is open (bolts retracted)
- `spin.a`: current dial angle (0-100)
- `spin.w`: current angular velocity
- `over`: boolean — whether pointer is over the dial
- `from`: which bolt the pointer is nearest to

**What `set()` accepts:** The `set()` function (from `mount()` return) accepts a value and assigns it to `coast` (the friction time constant in ms). It does NOT control the open state — that's driven by the dial position.

**Can we drive the vault open programmatically?** NO. The `opened` state is purely a function of dial position (landing on 40). There's no `setOpen()` exposed. The only way to "open" the vault is to move the pointer in a circle around the dial until it lands on 40.

**Implication for animation:** The vault "opening" is already real behavior — the user just doesn't discover it. The `onRead` text says "dial 40 · open" when it opens. The bolts animate drawing back. This is NOT a fake — it's a real mechanical interaction that's just undiscoverable.

**What GLM can spec:** A discoverability layer — under-stage hint line, visual indicator when dial approaches 40, readout narration during the transition.

### Exploded figure (`src/figures/exploded.ts`)

**What it does:** An app window taken apart into surface, sidebar, card, and popover. The pointer's x scrubs the gap (spring); its y picks a layer (which gets a selection ring).

**Pointer interaction:**
- `move`: `e.t = REST + (1 - REST) * clamp((p[0] - 60) / 280, 0, 1)` — horizontal position controls gap
- `leave`: resets to REST
- `set()`: accepts a value (GAP), updates the spring target

**Internal state:**
- `GAP`: current gap between layers
- `act`: selected layer index (-1 = none)
- `e`: spring (resting at REST, target at GAP)
- `lastP`: last pointer position

**What `set()` accepts:** A number (GAP value). Setting it animates the layers apart via the spring. This is the "exploding" — it's already real, just pointer-driven.

**Can we drive the explosion programmatically?** YES — `set()` accepts a GAP value and animates. But we don't have direct access to `set()` from React (the library's `make()` calls `mount()` internally and doesn't expose `set()`).

**Implication for animation:** The "explosion" is already real behavior — moving the pointer horizontally separates the layers. The spring animates the transition. But we can't trigger it programmatically from React.

---

## A.3 — Gallery Screen Manifest

17 screens in the Gallery (not 26 — 26 is the total media files including videos). The rail count is derived from `SCREENS.length` (array length, not hardcoded).

| # | id | label | still | has recordings? |
|---|-----|-------|-------|-----------------|
| 1 | dashboard | Dashboard | app-dashboard.png | IDLE |
| 2 | console | Penguin Console | app-console.png | TERMINAL, REAL WORK |
| 3 | activity | Activity | app-activity.png | — |
| 4 | insights | Insights | app-insights.png | DETAIL |
| 5 | life | Life | app-life.png | WEEK |
| 6 | ai | AI Assistant | app-ai.png | — |
| 7 | learn | Lyceum | app-learn.png | — |
| 8 | finance | Finance | app-finance.png | — |
| 9 | ide | IDE Projects | app-ide.png | — |
| 10 | database | Database | app-database.png | SCROLL |
| 11 | rankings | Rankings | app-rankings.png | — |
| 12 | labs | Labs | app-labs.png | — |
| 13 | studio | Content Engine | app-studio.png | — (empty state) |
| 14 | guide | Guide | app-guide.png | — |
| 15 | settings | Settings | app-settings.png | — |
| 16 | lecture | Lecture | app-lecture.png | — |
| 17 | profiler | Profiler | app-profiler.png | — (empty state) |

**Failing screens (4):**
- `app-studio.png` — "No active overlay session" + overlapping text in Pipeline Tools cards
- `app-profiler.png` — all tiles read "Not measuring", "Sampling is off", etc.
- `app-data-dir.png` — captured Dolphin file manager (dark, 15.7% bright)
- `app-network-monitor.png` — captured plasma-systemmonitor (dark, 16.4% bright)

**Rail count derivation:** `SCREENS.length` (17). The `index` state tracks the current slide. The `atStart`/`AtEnd` states track scroll position. No hardcoded count.

---

## A.4 — Page Mount Chain + Section Wrappers

### page.tsx (mount chain)
```tsx
export default function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-screen flex-col surface-page">
        <Grain />
        <CursorGlow />
        <Preloader />
        <Nav />
        <DayRuler />
        <SectionIndex />
        <main id="main" className="flex-1">
          <Hero />
          <ActRecord />
          <Gallery />
          <ActUnderstand />
          <Download />
        </main>
        <Footer />
        <CommandPalette />
      </div>
    </MotionConfig>
  );
}
```

### Section wrapper classes (from source)
- **Hero**: `relative surface-page pt-24 sm:pt-32` — `max-w-[1280px] mx-auto px-5 sm:px-10 lg:px-16`
- **ActRecord**: `relative surface-page` with `height: 300vh` (animated) or `auto` (reduced). Inner: `sticky top-0 overflow-hidden` with `height: 100dvh` or `undefined`. Content: `relative h-full max-w-[1280px] mx-auto px-5 sm:px-10 lg:px-16 pt-20 pb-20`
- **Gallery**: `relative surface-page pt-24 sm:pt-32` — `max-w-[1280px] mx-auto px-5 sm:px-10 lg:px-16`
- **ActUnderstand**: `relative surface-page pt-24 sm:pt-32` — `px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto`
- **Download**: `relative surface-page pt-24 sm:pt-32` — `px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto text-center`

### Vertical rhythm inventory
- Section top padding: `pt-24 sm:pt-32` (96px / 128px)
- ActRecord is 300vh — breaks normal flow (intentional scroll-scrub)
- ActRecord content uses `pt-20 pb-20` (80px) inside the sticky container
- Download uses `mt-14` (56px) between Ledger and OS cards
- Download uses `mt-10` (40px) between header and Ledger
- Download uses `gap-8` (32px) between Vault and Exploded (now tabbed)
- Hero uses `mt-4` (16px) between kicker and h1, `mt-16` between h1 and body text

---

## A.5 — Dayfield.tsx
[Full source provided above — 176 lines]

Key facts:
- 81 pillars (buckets of ~17.8 minutes each)
- Height = mean intensity of bucket
- Pointer-reactive: pillars near pointer rise (lift up to 12px)
- Opacity varies by category brightness (0.25-0.9)
- Currently at `opacity: 0.6` in Hero, `absolute inset-0, pointer-events-auto`
- Caption: "TRUE — real day, bucketed into 81 pillars · data/sample-day.json"

---

## A.6 — ActRecord.tsx
[Full source provided in round-01.md — 448 lines]

Key facts:
- 300vh scroll-scrub section, sticky 100dvh
- Contains: header (top-left), phase text block (left, top:320), SampleDayTimeline (center, min(1000px,90vw)), vertical rail (right, 96px wide), scrub hint (bottom)
- `useSpring` bypassed → raw scroll progress
- `showAnimated` = `shouldAnimate` (reduced motion = static layout)
- Reduced motion: stacked column, full width, all content visible
- Vertical rail: 24h timeline with phase segments, hour labels, playhead dot

---

## Additional Context: Hairline Library API

From node_modules/@lucasmarkes/hairline/dist/index.js.map:

**Vault figure** (`src/figures/vault.ts`):
- A round vault door on a wall block
- Combination dial at center, 3 bolts on lock side
- Circling pointer around dial pushes it; coasts with friction; detent every 10 catches
- When dial lands on 40 (COMBO), bolts draw back (vault opens)
- When dial leaves 40, bolts thrown again
- `onRead` (read.textContent) shows: "dial XX" or "dial XX · open" or "rest"
- `set()` accepts a value (coast/friction time constant in ms) — does NOT control open state
- `opened` state is purely a function of dial position (landing on 40)
- **Can we drive vault open programmatically? NO.** The only way to open is to move pointer in a circle until dial lands on 40.

**Exploded figure** (`src/figures/exploded.ts`):
- App window taken apart into surface, sidebar, card, popover
- Pointer's x scrubs the gap (spring); y picks a layer
- `set()` accepts a value (GAP) and animates via spring
- `REST` is resting gap, `GAP` starts at `value` (intensity prop)
- **Can we drive explosion programmatically? YES** — `set()` accepts GAP value and animates
- But we don't have direct access to `set()` from React (library's `make()` calls `mount()` internally)

**Implication for animation:**
- Vault "opening" is already real behavior (dial → 40 → bolts retract) — just undiscoverable
- Exploded "explosion" is already real behavior (pointer x → gap separation) — just pointer-driven
- The `onRead` callback is the only data output — it fires text descriptions
- We can't trigger either animation programmatically from React without forking the library

**What GLM can spec:**
1. Discoverability layer — hint lines, visual indicators, readout narration
2. Container-level choreography — framer-motion animate the figure container (scale, rotate, opacity)
3. Tab transition as two-beat connected sequence (fade-out + fade-in with narrative readout)
4. Reduced-motion: instant swap, no fades

---

## Summary of What Landed vs. What Didn't

| GLM Spec (RESULT.md v1.0) | Status |
|---|---|
| §1 SampleDayTimeline fused panel | ✅ Landed |
| §1 HUD in top 20px | ✅ Landed |
| §1 Keyboard support | ✅ Landed |
| §1 Intensity clamp | ✅ Landed |
| §1 Facts line (summary) | ✅ Landed |
| §2 ActRecord flow column | ❌ NOT landed (island layout remains) |
| §2 Spring → house curve | ✅ Landed (spring bypassed, raw used) |
| §2 Instrument width 1000px | ✅ Landed |
| §3 Download tablist | ✅ Landed |
| §3 Vault/Exploded opacity 0.9 | ✅ Landed |
| §3 onRead readout | ✅ Landed |
| §3 Keyboard fallback facts | ✅ Landed |
| §4 Implementation plan | ✅ Landed |
| §5 Backend audit | ✅ Landed |
| §6 Test obligations | ⚠️ Partial (no canaries written) |

**Remaining work:**
1. ActRecord flow-column restructure (island → flow)
2. Vault opening animation (discoverability + container choreography)
3. Exploded animation (discoverability + container choreography)
4. Vault → Layers connected transition (two-beat sequence)
5. Screen capture fixes (4 failing screens)
6. Layout gap fixes across all sections
7. Hero Dayfield repositioning (bottom band instead of overlay)
8. Canary tests for all new elements