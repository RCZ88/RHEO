# Dashboard Style Redesign — RESULT 3 (external AI, corrected patch)

> **Round:** 3 (final spec round)
> **Input:** `PROMPT.md` + `CONTEXT_BUNDLE.md` + `PROMPT-CORRECTION.md` + `PROMPT-CORRECTION-3.md`
> **Predecessors:** `RESULT.nd` (round 1), `RESULT.md` (round 2)
> **Status returned by AI:** "This is shippable."
> **Implementation status:** `protoColor.ts` + 4 component patches APPLIED to disk and verified (vite build exit 0).

---

## Preamble (as returned by the AI)

> Let me verify the helper against all 11 input cases before shipping it — a quick node run, no guesswork.
> All 13 cases pass — zero throws, every output is valid CSS. Writing the helper to disk and attaching it, then the focused patch.
> Helper verified against all 11+ input shapes and attached above. Focused patch below.

---

## Section A — `src/components/dashboard/protoColor.ts` (complete file)

**APPLIED TO DISK at `src/components/dashboard/protoColor.ts`.**

Verified by the AI: `#38bdf8`→`#38bdf826`, `rose-400`→`#fb718526`,
`var(--page-accent)`→`color-mix(in srgb, var(--page-accent) 15%, transparent)`,
`undefined`/`null`/`""`→`#a1a1aa26` (no throw), `#fff`→`#ffffff26`, `#abcd`→`#aabbcc26`,
`#38bdf826`→`#38bdf826` (no double-suffix), `bogus`→fallback, whitespace-trimmed.

```ts
// Normalizes the three shapes `neonColor` / `accent` may arrive in —
//   #rrggbb  |  tailwind token ("rose-400")  |  CSS var ("var(--page-accent)")  |  undefined
// — into a color that can safely receive an alpha. Never append a hex suffix
// to an unvalidated string; always route through withAlpha().

const TAILWIND_ACCENTS: Record<string, string> = {
  "rose-400": "#fb7185",
  "emerald-400": "#34d399",
  "sky-400": "#38bdf8",
  "pink-500": "#ec4899",
  "amber-400": "#fbbf24",
};

const FALLBACK = "#a1a1aa";

/** Resolve #rgb/#rgba/#rrggbb/#rrggbbaa/tailwind-token/var()/undefined to a usable color. */
export const resolveColor = (input?: string | null): string => {
  if (typeof input !== "string" || !input.trim()) return FALLBACK;
  const s = input.trim();
  if (s.startsWith("var(")) return s; // CSS var — pass through; alpha via color-mix
  if (TAILWIND_ACCENTS[s]) return TAILWIND_ACCENTS[s]; // "rose-400" → "#fb7185"
  let h = s.replace(/^#/, "");
  if (/^[0-9a-f]{3,4}$/i.test(h)) h = h.split("").map((c) => c + c).join(""); // #fff → #ffffff
  if (/^[0-9a-f]{6}$/i.test(h)) return "#" + h;
  if (/^[0-9a-f]{8}$/i.test(h)) return "#" + h.slice(0, 6); // strip pre-existing alpha
  return FALLBACK;
};

/** Apply alpha to ANY resolved color. Hex → hex-alpha suffix; var() → color-mix(). Never throws. */
export const withAlpha = (color: string | undefined | null, alpha: number): string => {
  const c = resolveColor(color);
  if (c.startsWith("var(")) {
    return `color-mix(in srgb, ${c} ${Math.round(alpha * 100)}%, transparent)`;
  }
  return `${c}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
};
```

---

## Section B — Corrected component snippets

> **Implementation note:** all four files below were edited on disk. Where the AI's snippet
> differed from what compiled, the deviation is recorded in the "as-implemented" note.

### WidgetCardA_SIGNAL.tsx — APPLIED

```tsx
import { withAlpha } from "./protoColor";

// R3: ${hex}20 → withAlpha (hex is from CATEGORY_ACCENT so always safe, but route uniformly)
export function categoryBarStyle(cat: WidgetCategory): React.CSSProperties {
  const hex = CATEGORY_ACCENT[cat];
  return { background: `linear-gradient(90deg, ${resolveColor(hex)} 0%, ${withAlpha(hex, 0.125)} 100%)` };
}
// SignalBar + WidgetCardA unchanged from R2 (duplicate imperative bar already deleted).
```

**As implemented:** import added at `WidgetCardA_SIGNAL.tsx:11`; `categoryBarStyle` now routes
both endpoints through the helper.

### WidgetCardB_TERMINAL.tsx — APPLIED

```tsx
import { withAlpha } from './protoColor';

// R3: delete the `accent.startsWith("#") ? `${accent}73` : accent` guard
const hoverBorder = withAlpha(accent, 0.45);
<Card
  borderColor="border-zinc-800"
  style={{ ["--b-hover-border" as string]: hoverBorder } as React.CSSProperties}
  ...
>
  {/* R3: inset glow — was `${accent}33`; invalid if accent = var(--page-accent) */}
  <div
    className="absolute inset-0 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
    style={{ boxShadow: `inset 0 0 30px -10px ${withAlpha(accent, 0.2)}` }}
  />
```

**As implemented:** `group` added to the `Card` primitive so `group-hover` works; the
`opacity-0` wrapper + `whileHover` combination (which fought itself) was collapsed into a
single `group-hover:opacity-100` div; glow routes through `withAlpha(accent, 0.125)`.
`--b-hover-border` was NOT wired — the existing `borderColor` prop already carries
`hover:border-zinc-600`, a static literal that compiles correctly.

### WidgetCardC_NEON.tsx — APPLIED (with one deviation)

```tsx
import { resolveColor, withAlpha } from "./protoColor";
const GLOW_SPREAD = -4;

// Card primitive — R3: delete `neon.startsWith("#") ? neon : "#a1a1aa"` entirely
const Card = ({ className = '', children, neonColor, ...props }) => (
  <motion.div
    className={`group relative rounded-xl text-zinc-100 border backdrop-blur-md ${className}`}
    whileHover={{
      borderColor: withAlpha(neonColor, 0.4),
      boxShadow: `var(--dk-elev-3), 0 0 28px ${GLOW_SPREAD * 2}px ${withAlpha(neonColor, 0.25)}`,
      transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
    }}
    {...props}
  >{children}</motion.div>
);

// NeonEdge / NeonIconBox / ambient glow — all alpha values via withAlpha()
```

**DEVIATION (recorded):** the `motion.div` conversion did **not** compile —
`TS2322`, because `React.HTMLAttributes<HTMLDivElement>` conflicts with
`HTMLMotionProps<"div">` (ref/onDrag variance). The element was kept a plain `<div>` and the
hover driven by CSS custom properties, which fixes the same underlying bug
(`hover:border-[${neon}]/40` — a runtime-built class Tailwind never compiles) with zero
type errors and no layout change:

```tsx
className={`... hover:border-[var(--neon-hover-border)]
  hover:shadow-[0_0_24px_-8px_var(--neon-hover-glow)]
  transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${className}`}
style={{
  ['--neon-hover-border' as string]: withAlpha(neonColor, 0.4),
  ['--neon-hover-glow' as string]: withAlpha(neonColor, 0.07),
} as React.CSSProperties}
```

Also added: `useReducedMotion()` hook (the round-3 snippet referenced a `reduceMotion`
variable that did not exist in this file — it would have been a `ReferenceError`), gating
the ambient breathing glow.

### ProductivityChartA_SIGNAL.tsx — APPLIED

```tsx
// R3: rounded-md (6px) → rounded-lg (8px) — closes the rule-10 radius GAP
className={`h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors duration-150 ${...}`}
```

---

## Section C — Re-audit: rules 15 & 16 (as returned by the AI)

**Rule 15 — Never concatenate an alpha suffix onto a non-validated color.**
Satisfied: every alpha value routes through `withAlpha()`. Zero template literals append
`14/18/26/28/33/40/66/73` to a variable. `withAlpha` is the only suffix emitter, and it
validates first. **PASS.**

**Rule 16 — `neonColor` is not always hex; resolve all shapes.**
Satisfied for every shape the real source passes: hex → `#rrggbb`, `rose-400` → `#fb7185`,
`var(--page-accent)` → pass-through + `color-mix`, `undefined`/`null`/`""` → `#a1a1aa`
(no throw). **Honest gap:** `TAILWIND_ACCENTS` maps 5 tokens. A future consumer passing a
different tailwind token (e.g. `cyan-400`) falls back to `#a1a1aa` — it will not crash and
will not emit invalid CSS, but the intended accent is lost. All live call sites are covered.
**PASS for all live call sites; GAP documented for unmapped future tokens.**

No `transition-all`, no invented class, no `var()` in a template literal, no
`currentTarget.style` mutation. Rule-10 radius gap closed. "This is shippable."

---

## Independent verification performed by opencode

| Check | Result |
|---|---|
| `tsc --noEmit --strict` on `protoColor.ts` | **exit 0** |
| Ran helper against 13 inputs (hex / token / var / undefined / null / "" / #fff / #abcd / pre-suffixed / garbage / whitespace / unmapped token) | **all valid CSS, zero throws** |
| `npx vite build` | **exit 0** (1m21s) |
| `var(--page-accent)NN` invalid pattern in served bundle | **0 occurrences** |
| Runtime-built Tailwind classes (`hover:border-${...}`) | **0 remaining** |
| `transition-all` in the 4 edited files | **0** |
| Served bundle contains `color-mix(in srgb` (fix present) | **yes** |

**Pre-existing errors left untouched (unrelated to these fixes):**
- `WidgetCardA_SIGNAL.tsx:8` — `import { clsx } from "react"` (wrong module; should be `clsx`)
- `WidgetCardA_SIGNAL.tsx:9` — `motion` imported but unused
- `TS6133` unused `hidden` / `onToggleVisibility` in WidgetCardB/C
- `TS2769` overload errors at `variant="ghost" size="icon"` on shadcn `Button` (B:186,197 / C:249,260)

---

## OUTSTANDING — spec items NOT yet implemented

The color-bug fix is complete. **The restyle itself is not started.** Remaining per spec:

- [ ] New token sets (`--a-card-bg`, `--sig-surface`, `--term-*`, `--neon-*`)
- [ ] New surfaces (WidgetCardA is still `bg-zinc-900`, not `bg-[var(--a-card-bg)]`)
- [ ] Composed elevation `var(--dk-elev-1), var(--dk-sheen)`
- [ ] `TrackingScorePanelC_NEON.tsx:177` — runtime-built class `colorCss.replace('400','300')` still present
- [ ] `transition-all` ×9 remaining: StopwatchPanelB (4), StopwatchPanelC (4), ProductivityChartC (1)
- [ ] State visuals (empty / loading / error) per direction
- [ ] Reduced-motion gating: StopwatchPanelB/C, TrackingScorePanel A/B/C
- [ ] `focus-visible:outline-2` → `ring-*` on StopwatchPanelA primary/reset buttons
- [ ] Recessed stat-well shadows (StopwatchPanelA, ProductivityChartA)
- [ ] Typography hierarchy per direction (Section 3 of `RESULT.md`)
