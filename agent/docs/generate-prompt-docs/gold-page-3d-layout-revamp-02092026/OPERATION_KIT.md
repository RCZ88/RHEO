# MonthWall LAMINAR Fix — Operation Kit

## Role
Patch MonthWall for LAMINAR conformance.

## Target
`src/components/MonthWall/MonthWall.tsx` mounted at `src/features/warmth/gold/GoldPage.tsx`.

## Crimes (from debt ledger)
1. wheel-hijack month navigation
2. non-flat rest state
3. colors outside phase palette

## STEP-0 Commands
```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" src/components/MonthWall
grep -rn "onWheel" src/components/MonthWall
grep -rnE "addEventListener\(['\"]wheel" src/components/MonthWall
grep -rnE "perspective|rotate[XYZ]?\(|skew" src/components/MonthWall
grep -rnE "box-shadow|shadow-(sm|md|lg|xl|2xl)" src/components/MonthWall
grep -rnE "rounded-(sm|md|lg|xl|2xl|3xl)|rounded-\[" src/components/MonthWall
grep -rnE "transition|cubic-bezier|duration-" src/components/MonthWall
grep -rnE "animation.*infinite|@keyframes|setInterval|requestAnimationFrame" src/components/MonthWall
```

## Default Rulings
| STEP-0 outcome | Ruling |
|---|---|
| All violations map to P1-P9, data wiring untouched | PATCH — approved |
| Fixes require touching store/data layer | REBUILD — approved, conditional on STEP-0 dump |
| Zero violations found (ledger says guilty) | SUSPECT STALE PATH — demand audited file list |
| Dead code / zero usages discovered | STOP + report |

## Edit Patterns
P1 — WHEEL HIJACK: DELETE. No `onWheel`, no `addEventListener('wheel', ...)`. Wheel passes through.
P2 — FLAT DEFAULT: rest state `transform: none`. No `perspective(1200px) rotateX(...)` at rest.
P3 — PHASE COLORS ONLY: no raw `#[0-9a-f]{3,8}` / `rgba(...)` / `hsl(...)` in JSX. Use `getCategoryColor(category)` from `src/lib/CategoryColors.ts`.
P4 — HAIRLINES, NOT SHADOWS: no `box-shadow` / `shadow-*` classes. Use `border` only.
P5 — RADII CLAMP {6,10,16}: day cells 6, panels/popovers 10, outer container 10 max.
P6 — TRANSITIONS 140ms + `cubic-bezier(0.16,1,0.3,1)` or LAMINAR alternate `cubic-bezier(0.19,1,0.22,1)`. Animate `transform`/`opacity` only.
P7 — REDUCED MOTION: `prefers-reduced-motion: reduce` disables tilt + hover effects.
P8 — KEYBOARD: `PageUp`/`PageDown` on focused grid. `Escape` closes popover.
P9 — EMPTY/LOADING/ERROR: every data-driven card has all 4 states.

## LAMINAR Gates
1. STEP-0 table with file:line + disposition
2. Re-run greps WITH match counts
3. `tsc` total + delta numbers
4. Rebuild log showing `dist/` deleted first + explicit `dist/` artifact path
5. Runtime assertions: bbox numbers, month label before/after, 3 screenshots in `evidence/`
6. `docs/debt.md` diff line visible in commit
7. Commit hash + exact message

## Acceptance Bar
- Wall sits flat at rest (no tilt/perspective)
- Colors match phase palette
- Chevron pair visible
- No glow/shadow bloom
- No shimmer
- Looks like it belongs on Gold page per LAMINAR

## Commit Message
fix(monthwall): enforce LAMINAR conformance — wheel hijack, flat rest, phase palette

Closes debt ledger MonthWall conformance items:
- remove wheel-hijack month navigation
- enforce flat rest state
- restrict colors to phase palette via getCategoryColor
- clamp radii to {6,10,16}
- unify transitions to 140ms + cubic-bezier(0.16,1,0.3,1)
- add prefers-reduced-motion guard
- replace decorative shadows with hairline borders
