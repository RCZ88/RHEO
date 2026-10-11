# AI Surface — PAINT Remediation Roadmap

> **Created:** 2026-10-07 | **Owner:** opencode | **Surface:** `src/components/ai/**` (121 `.tsx`)
> **Governing skill:** `agent/skills/paint/SKILL.md` (read it — this is the *plan*, not the *contract*)
> **Precedence:** `design/design.md` (LAMINAR) → `src/index.css` tokens → component conventions → this file

---

## 0. What this document is for

A written plan with measurable gates and an honest status per item. Every claim
below is a count produced by a grep over the surface, not an impression.

**Two rules for anyone continuing this work:**

1. **Never claim PASS without the grep that proves it.** Gate C is checkable in
   one command; Gates D/E are checkable; P5/P6/Gate F are judgement calls and
   must be read, not inferred.
2. **A build is the only proof that shipped.** Everything below is source-only
   until `dist/` contains it. §7 tracks that explicitly, because it has been the
   single most repeated failure of this effort.

---

## 1. Baseline measurement (2026-10-07)

Produced by:

```bash
cd "$(git rev-parse --show-toplevel)"
find src/components/ai -name '*.tsx' | wc -l
```

| Gate | Metric | Baseline | Target |
|------|--------|---------:|-------:|
| **C** | files with `backdrop-blur` / `transition-all` | 48 | 0 |
| **C** | files using emoji as icons | 11 | 0 |
| **C** | raw hex in `.tsx` | 295 | see §4 |
| **D** | files with **no** `focus-visible` | 110 | 0 |
| **E** | files with **no** `prefers-reduced-motion` | 117 | 0 |
| **P5** | files with a loading state | 36 | 121 |
| **P5** | files with an error state | 43 | 121 |
| **P5** | files with an empty state | 33 | 121 |
| **P5** | files with a **retry** affordance | **9** | 121 |
| **F** | bare `"No X yet"` strings | 6 | 0 |

---

## 2. Completed

### Gate C — banned class removal
Files: `AIToolsTab.tsx` (10), `canvas/CardDrawer.tsx` (3). `backdrop-blur-*`
removed, `transition-all` → `transition-colors`, `rounded-2xl` → `rounded-xl`.
`rounded-full` **left alone** — it is LAMINAR-legal (the pill).

### Gate E — global reduced-motion net
One block appended to `src/index.css` rather than 117 edits. 117 missing
handlers is one missing *default*, not 117 bugs; a per-file fix reopens the hole
in the next component written.

### Gate D — global focus-visible
Same reasoning, appended after the Gate E block so it wins specificity.
`:focus-visible` → `--page-accent` ring; `:focus:not(:focus-visible)` → `none`.

### Gate F — empty-state copy
6 strings rewritten to state what *would* be present, not just that nothing is.

---

## 3. Open work, in priority order

### P0 — `retry` affordance (9/121) · **highest value**
An error with no recovery is a dead end. Target the 64 files with no error path
at all first, working outward. Each needs: plain-language cause, one recovery
action, and the user's input preserved.

### P1 — Gate C, emoji as icons (11 files)
Replace with `lucide-react`. Mechanical, low risk, unambiguous.
Known sites: `canvas/CommandPalette.tsx`, `canvas/SaveIndicator.tsx`,
`canvas/GroupCard.tsx`, `canvas/DefaultSetupDialog.tsx`,
`canvas/CanvasManagerPanel.tsx`, `canvas/TranscriptRail.tsx`,
`canvas/CanvasCardFallback.tsx`, `canvas/cards/FocusCard.tsx`,
`canvas/cards/GoalItem.tsx`, `automations/VisualBuilder/VisualBuilderModal.tsx`.

### P2 — Gate C, remaining banned classes (48 files)
Sweep `backdrop-blur` / `transition-all`. Same treatment as the two already done.

### P3 — P5 loading + empty states (36/121, 33/121)
Per-component. Loading skeletons must match the content's shape — a bare
spinner is a Gate D failure, not a P5 pass.

### P4 — P6 motion inventory
Per-surface liveliness level (L2 default for dev tools) declared in writing,
with a `prefers-reduced-motion` fallback. The global net in §2 covers the
*mechanism*; this covers the *inventory*.

### P5 — Gate F copy audit, whole surface
The 6 fixed strings were found by pattern match. The remaining surface has not
been read.

---

## 4. The 295 hex values — why most are NOT to be fixed

`src/lib/CategoryColors.ts` states it plainly:

> *"Legacy chart.js / Tableau-10 palettes are frozen and must not be expanded."*

The large majority of raw hex sits in **JS values**, not CSS:
`ChartJS.defaults.color`, `NEON_CHART_COLORS`, per-card-type colours in
`CanvasMinimap.tsx`. These are consumed by Canvas2D `fillStyle` and Chart.js
series, **neither of which resolves CSS custom properties**. Converting them to
`var(--token)` silently renders black.

Gate C's rule governs **chrome**. Chart data is out of scope. **Do not convert
these.** Only hex in a `style`/`className` context is in scope.

---

## 5. Verification commands

```bash
# Gate C
grep -rlE "backdrop-blur|transition-all" src/components/ai --include='*.tsx' | wc -l

# Gate E
for f in $(find src/components/ai -name '*.tsx'); do
  grep -q "prefers-reduced-motion" "$f" || echo "$f"; done | wc -l   # expect 0
#   (the global net in src/index.css satisfies this at the surface level —
#    confirm the net exists before trusting a zero here)

# Gate D
for f in $(find src/components/ai -name '*.tsx'); do
  grep -q "focus-visible" "$f" || echo "$f"; done | wc -l

# Gate F
grep -rhoE "No [A-Za-z ]+(yet|found)\.?" src/components/ai --include='*.tsx' | sort -u

# compile-safety, every touched file
npx esbuild <file> --bundle --outdir=/tmp/chk --alias:@=./src \
  --external:react --external:react-dom --external:lucide-react \
  --external:motion/react --external:chart.js --log-level=error
```

---

## 6. Coordination

~15 sessions share this repo. Every file gets claimed before editing:

```bash
COORD=agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs
AGENT="opencode-paint-$(date +%s)"
node "$COORD" register --agent "$AGENT" --task "..."
node "$COORD" claim   --agent "$AGENT" --paths <explicit paths>
node "$COORD" done    --agent "$AGENT"
```

A **DENIED** claim is a hard stop, not a prompt to try again.

---

## 7. Build status — read this before claiming anything works

**Nothing in §2–§3 is live.** `dist/` is the running application; source
changes are invisible until a build replaces it.

Current live bundle was built by another agent at **11:32**, which predates all
of the work above. Verified absent from it:

```
dk-rail          right nav rail            ABSENT
inCardScroller   trackpad pan              ABSENT
dk-back          back button               PRESENT (pre-11:32)
dk-tools-panel   dropdown styling          PRESENT (pre-11:32)
```

Consequence: after any build, **confirm the markers are in the bundle** before
reporting. A correct fix inside a stale bundle is a false claim.

---

## 8. Open questions for the user

1. **`retry` at 9/121** — is per-component recovery action copy wanted, or is a
   shared retry pattern acceptable? Affects whether P0 is 64 edits or 1 component.
2. **Light mode** — the §2 gates were verified by grep, which cannot see
   contrast. Is a light/dark contrast pass in scope?
3. **Viewport sweep** — no responsive audit has been done at any width. Is that
   wanted, and at which breakpoints?