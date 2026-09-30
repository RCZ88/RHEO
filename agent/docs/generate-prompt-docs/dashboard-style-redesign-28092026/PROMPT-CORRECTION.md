# Dashboard Style Redesign — CORRECTION ROUND 2

> **Prompt Type:** design (bug-fix pass on a prior spec)
> **Target AI:** claude
> **Detail Level:** 10
> **Tone:** Direct. The design thinking was right. The code was not. Fix the code, keep the design.

---

## Context

You previously produced a visual redesign spec for the DeskFlow dashboard's 3 prototype directions (SIGNAL / TERMINAL CHIC / NEON GLASS), delivered in `RESULT.md`.

**The design direction is approved and stays.** Your token sets, component structure, typography hierarchy, liveliness-level assignment (A=L1, B=L2, C=L3), hover/state tables, and the overall visual philosophy are all good. Do not redesign anything.

**The code samples are not paste-ready.** Five of them are broken, and the self-audit in your Section 6 marked every item ✅ PASS without catching them. This round fixes only the code.

The full verbatim source for all 19 files is in `CONTEXT_BUNDLE.md` Sections 19 (prototype components) and 20 (reference + primitives). You MUST read the real source before writing any replacement.

---

## MANDATORY FIXES

### FIX 1 — `${var(--c-glow-spread)}` is a JavaScript syntax error (CRASHES THE BUILD)

You wrote this in the `NeonIconBox` spec:

```tsx
// ❌ BROKEN — `var()` is CSS, not JS. This throws:
//    SyntaxError: Unexpected token 'var'
boxShadow: `0 0 16px ${var(--c-glow-spread)} ${color}1a`,
```

You cannot interpolate a CSS `var()` into a JavaScript template literal. The string becomes the literal text `"var(--c-glow-spread)"`, not the value.

**Fix — pick one and commit to it:**

**Option A (recommended):** use a real inline style so the numeric spread is a plain value in JS.

```tsx
const glowSpread = -4; // numeric, declared in JS

<motion.div
  className="rounded-lg flex items-center justify-center shrink-0 group/icon"
  style={{
    width: size,
    height: size,
    backgroundColor: `${color}0f`,
    border: `1px solid ${color}25`,
    boxShadow: `0 0 16px ${glowSpread}px ${color}1a`,
  }}
  whileHover={{ scale: 1.04 }}
  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
/>
```

**Option B:** keep the CSS variable but reference it from a className, never from JS.

```tsx
<div className="rounded-lg shadow-[0_0_16px_-4px_var(--c-glow-color)]" style={{ '--c-glow-color': `${color}1a` } as React.CSSProperties} />
```

Apply the same fix to the two `onMouseEnter`/`onMouseLeave` handlers you wrote — **and see FIX 4: delete those handlers entirely.**

---

### FIX 2 — `hover:border-${accent}/40` can never compile (SILENTLY DOES NOTHING)

You wrote:

```tsx
// ❌ BROKEN — Tailwind's JIT compiler scans source files as text.
// It cannot see a class name built from a runtime variable, so
// `hover:border-#f472b640` is NEVER generated in the CSS bundle.
// The style silently fails to apply. No error, no warning.
borderColor={`border-[var(--b-card-border)] hover:border-${accent}/40`}
```

**Fix:** for a runtime-variable color, use an inline `style` — not a Tailwind class. The existing source already handles this correctly via the `borderColor` prop (see `WidgetCardB_TERMINAL.tsx:16`), so keep the prop and move the hover into CSS:

```tsx
// ✅ FIXED — static class in the className, variable color in a style
<div
  className={`group/card rounded-lg border ${borderColor || 'border-[var(--b-card-border)]'} ${className}`}
  style={{ ['--hover-accent' as string]: accent }}
>
```

```css
/* add to the terminal direction scope */
.proto-terminal .group\/card:hover {
  border-color: color-mix(in srgb, var(--hover-accent) 40%, transparent);
}
```

**Rule to apply everywhere:** a Tailwind class must be a *static string literal* in the source. If the color depends on a prop, it belongs in `style` or a CSS custom property.

---

### FIX 3 — `transition-all` ×4 (violates your own checklist #11)

You used `transition-all` in four places while your Section 6 row #11 claimed `✅ PASS`.

```tsx
// ❌ line 140 — WidgetCardA
reduce ? "" : "transition-all duration-[var(--dur-fast)] ease-[var(--ease-standard)]"
// ❌ line 239 — WidgetCardC
"transition-all duration-[var(--dur-normal)] ease-[var(--ease-standard)]"
// ❌ line 356 — StopwatchPanelB
"transition-all duration-150"
// ❌ line 391 — StopwatchPanelC
"transition-all duration-200"
```

`transition-all` animates `width`, `height`, `padding`, and `margin` — the exact properties that cause layout jank. Your checklist forbids it.

**Fix — enumerate the exact properties each element actually changes:**

```tsx
// ✅ WidgetCardA — only background, border-color, box-shadow change on hover
hoverable && clsx(
  "hover:bg-[var(--a-card-bg-hover)]",
  "hover:border-[var(--a-card-border-hover)]",
  "hover:shadow-[var(--elev-2)]",
  reduce ? "" : "transition-[background-color,border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-standard)]"
)

// ✅ WidgetCardC
"transition-[background-color,border-color,box-shadow,transform] duration-[300ms] ease-[cubic-bezier(0.16,1,0.3,1)]"

// ✅ StopwatchPanelB — only colors change (no scale on hover, per your L2 spec)
"transition-[background-color,border-color,color] duration-[150ms] ease-[cubic-bezier(0.16,1,0.3,1)]"

// ✅ StopwatchPanelC
"transition-[background-color,border-color,color,transform,box-shadow] duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
```

---

### FIX 4 — Delete the `onMouseEnter`/`onMouseLeave` handlers on `NeonIconBox`

You hand-wrote three handlers to brighten a decorative icon box on hover. This is wrong for three reasons:

1. The icon box is **not an interactive element** — a pointer cursor on it is misleading (Human-Centric UX: clarity over cleverness).
2. Inline `onMouseEnter` + `onMouseLeave` cannot be composed with `motion`'s `whileHover`, so the two will fight.
3. Imperative DOM mutation (`e.currentTarget.style.boxShadow = ...`) bypasses React and causes flicker on re-render.

**Fix — use a parent `group` and a pure-CSS hover, or drop the interaction entirely:**

```tsx
// ✅ the card already has `group`; scope the child hover to it
<motion.div
  className="rounded-lg flex items-center justify-center shrink-0
             transition-[box-shadow,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
             group-hover/card:shadow-[0_0_24px_-4px_var(--c-glow-strong)]"
  style={{
    width: size,
    height: size,
    backgroundColor: `${color}0f`,
    border: `1px solid ${color}25`,
    boxShadow: `0 0 16px -4px ${color}1a`,
    ['--c-glow-strong' as string]: `${color}26`,
  } as React.CSSProperties}
/>
```

The same applies to the duplicate hover-bar `div` you wrote in `WidgetCardA` (your lines 158–167) — replace its handlers with `group-hover/bar:opacity-100`.

---

### FIX 5 — `"inset-sheen"` and `shadow-[var(--elev-1)]` are not real styles

```tsx
// ❌ "inset-sheen" is not a Tailwind class. It renders NOTHING.
"shadow-[var(--elev-1)]",
"inset-sheen", // = inset 0 1px 0 rgba(255,255,255,0.05)
```

The `--elev-*` tokens already contain the ring (`0 0 0 1px rgba(255,255,255,.04)`), and `--sheen` (`inset 0 1px 0 rgba(255,255,255,.05)`) is a *separate* shadow layer. You cannot express two shadow layers with `shadow-[...]` plus an invented class.

**Fix — compose both into one `box-shadow` inline style:**

```tsx
// ✅
style={{
  boxShadow: `var(--elev-1), var(--sheen)`,
  backgroundColor: 'var(--a-card-bg)',
  borderColor: 'var(--a-card-border)',
}}
```

If you prefer a class, write the whole thing as a single arbitrary value:

```
shadow-[var(--elev-1),var(--sheen)]
```

Same for hover: `hover:shadow-[var(--elev-2),inset_0_1px_0_rgba(255,255,255,0.07)]`.

---

## ALSO CORRECT (lower severity)

**A. `focus-visible:outline-2` is not a valid Tailwind class.** Use the `ring` system, which is what the rest of the project uses:

```tsx
// ❌ focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500/50
// ✅
focus-visible:ring-2 focus-visible:ring-pink-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
```

**B. Do not re-spec `borderColor` on `WidgetCardB`.** It is already a real prop on the `Card` component (`WidgetCardB_TERMINAL.tsx:16`) and already passed at the call site (line 163). Only the *value* needs to change, not the wiring.

**C. `color-mix()` for the neon border.** If you keep it, it must be used consistently and the result must meet 3:1 contrast for UI boundaries. Otherwise fall back to the hex-alpha pattern the source already uses (`${neonColor}25`).

**D. You re-specified properties the source already handles correctly** — `NumberTicker` is already imported and used in both `StopwatchPanelB_TERMINAL` and `StopwatchPanelC_NEON`. Don't rewrite it; only restyle its container.

---

## HARD RULES (unchanged, still binding)

These were violated by the broken code above. Re-verify every line you emit:

1. **A Tailwind class must be a static string literal.** Runtime-variable colors go in `style` or a CSS custom property. `hover:border-${x}` never compiles.
2. **`var()` is CSS, never JavaScript.** Never interpolate it into a template literal. Use a plain number in JS, or a className/attribute.
3. **Never `transition-all`.** Enumerate properties: `transition-[background-color,border-color,box-shadow,transform]`.
4. **Never invent a class name.** If it isn't in Tailwind, it doesn't exist — use an inline style or a real arbitrary value.
5. **Two shadow layers = one `box-shadow` value.** `boxShadow: 'var(--elev-1), var(--sheen)'`.
6. **No imperative DOM mutation.** No `e.currentTarget.style.x = ...`. Use CSS `:hover` / `group-hover:` or motion's `whileHover`.
7. **Non-interactive elements get no pointer handlers.**
8. **`prefers-reduced-motion` honored on every animation** via `useReducedMotion()`.
9. **No spring/bounce** — `cubic-bezier(0.16, 1, 0.3, 1)` only.
10. **Radius ∈ {8, 12, pill}.** No arbitrary values.
11. **Dark mode only.** No light-mode variants.
12. **Max 2 font families per view.**
13. **Tokens only** (`--dk-*`, `--ws-*`, `--color-*`) except inside `CATEGORY_ACCENT` and hex-alpha suffixes derived from the category color (`${cat}14`, `${cat}40`).
14. **Zero layout changes.** Same grid, same element order, same prop interfaces, same file paths.

---

## OUTPUT FORMAT

Re-emit the **complete corrected spec** in the same 6-section structure as before. Full replacement, not a diff — this must be paste-ready top to bottom.

1. **Design Direction Summary** — unchanged (copy from your prior output)
2. **Complete Token Sets** — unchanged, plus any numeric JS constants you now need (e.g. `glowSpread`)
3. **Component Specs** — **CORRECTED.** All 12 components. Every code block must compile as-is. Where you fixed something, add a one-line `// FIX n:` comment naming the bug.
4. **Motion & Interaction Specs** — updated transition-property lists
5. **State Visuals** — unchanged
6. **Anti-Slop Verification** — **re-audited.** This time, for each of the 14 hard rules, state the rule and cite the specific line(s) that satisfy it. If any rule cannot be satisfied, say so explicitly rather than marking it PASS.

> **Do not mark anything ✅ unless you can point at the line that proves it.** A false PASS is a worse failure than an honest gap.

---

## BEFORE YOU ANSWER — SELF-TEST

Run this mentally against every code block you are about to emit. Any "no" means rewrite that block:

- Would this **compile** in a `.tsx` file? (no `var()` in a template literal)
- Would the **Tailwind compiler generate** this class? (no runtime-interpolated class names)
- Does it animate only **`transform`/`opacity`/paint properties**, not layout?
- Is **every** animation gated on `useReducedMotion()`?
- Does it **mutate the DOM imperatively**? (it must not)
- Are all **radii** in {8, 12, pill}?
- Are all **colors** token-derived or category-alpha?
- Would this change the **layout**? (it must not)

If a code block fails any check, fix it before emitting.

**The goal is the same as last time: "I can't stop looking at it" — but this time it has to actually run.**
