# CONTEXT_BUNDLE — landing visual revamp round 03

## Code excerpts (what GLM needs to see)

### 1. `landing/src/lib/day.ts` — export surface (implemented)
```ts
export const SAMPLES = raw.samples as Sample[]; // {minute:intensity:category|null}
export const DERIVED_CARDS = deriveCards(SAMPLES);
// DerivedCard = { id, label, minutes, shareOfActive, anchorStart, anchorEnd, anchorLabel, runs, detail }
// Live values: IDE 187min, Browser 111, AI Tools 99, QUIET = longest null run; Uncategorized excluded.
export const LINE_PATH = deriveLinePath(SAMPLES, 392, 140);
export const AREA_PATH = deriveAreaPath(SAMPLES, 392, 140);
export { hasApp, rankable, hhmm };
```

### 2. ActRecord.tsx — remaining fabricated chrome (the E8 sweep target)
```tsx
// ~L447
const CHIPS = ["FOCUS", "MEETINGS", "LEARNING", "REST"];
// ~L681 and ~L715 (two copies: horizontal + vertical rails)
const segments = [
  { h0: 0, h1: 6, key: "REST" },
  { h0: 9, h1: 12, key: "DEEP WORK" },
  { h0: 12, h1: 14, key: "MEETINGS" },
  { h0: 19, h1: 21, key: "LEARNING" },
  { h0: 23, h1: 24, key: "REST" },
];
// ~L84
const [active, setActive] = useState(1); // starts mid-"DEEP WORK" by habit
```
Scrub mapping (implemented): `activeIndex = Math.min(beats-1, Math.floor(p.get()*beats))`.
Chart viewBox is **400×140**; x-axis maps minute 0→1439 across 0→400 (anchor band divides by 14.4).

### 3. Download.tsx — Vault/Explode narrative (implemented, geometry guessed)
```tsx
// sweep(): dispatches synthetic PointerEvents('pointermove'/'pointerdown'/'pointerup')
// on stageRef element; hairline confirmed NO isTrusted guard.
// Dial sweep (GUESS): center (200,160), radius 25, 24 steps, 400ms → hope: dial hits COMBO=40°
// Layers sweep (GUESS): x 40→360 at y 160, 32 steps, 640ms → GAP4 0.18→1.0
```
Confirmed hairline internals (minified dist): `RD = 17`, `COMBO = 40`, `LAP=[[128,150],[200,118],[272,150],[200,206],null]`; Vault `mount33` @index.js:5490, Exploded `mount7` @:1660; `pointer()` @:395. Vault `set(v)`=coast, Exploded `set(v)`=GAP4.

### 4. Tokens (globals.css, implemented)
```
--radius-xs: 8px; --radius-sm: 12px; --radius-md: 16px; --panel-radius: 12px;
.instrument:focus-visible { outline: 2px solid #f4f4f5; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .anchor-band { transition: none; } }
```

## Data facts (from verifying sample-day.json directly)
- Fields: `minute` (0..1439), `intensity` (0..1), `category` (string|null). 515 recorded minutes, 920 null.
- `summary.top_category_minutes = 3987` → impossible (>1440). `summary` is untrusted, never rendered.
- Categories: IDE 187 · Browser 111 · AI Tools 99 · Uncategorized 87 · Education 20 · Entertainment 4 · Media 4 · Development 3.

## Commits containing the implemented rounds
`8e052da` (day.ts + ActRecord derivations + tokens) · `be15748` (radius 12) · `be64fd8` (tab narrative) · `dcf39ce` (anchor band) + local uncommitted fixes.
