# AI Surface — Light Mode Handoff

> **Created:** 2026-10-07 | **Owner:** opencode | **Surface:** `src/components/ai/**` (83 `.tsx`)
> **Purpose:** hand the remaining light-mode work to the agent working on light mode,
> with every number already measured so nothing has to be re-derived.

---

## 0. Read this first — two audits in this repo LIE

Both of my first passes on this task produced wildly wrong numbers. Do not repeat them.

| Trap | Why it lies | Correct method |
|---|---|---|
| `grep -E "#[0-9a-f]{3,8}\|rgba\(" src/components/ai` | Counts **`light:bg-white`** — which is the *correct* light-mode class. I reported "34 files / 40% broken, AIToolsTab has 157" from this. Real numbers were **14 files / 46 sites**, AIToolsTab had **3**. | A literal is only a defect if **the same element has no `light:` variant covering it**. |
| "any `text-white` is a bug" | `text-white` on `bg-emerald-600` is **correct in both themes**. White-on-saturated-fill is a fixed convention. | Check whether the element sits on a **saturated** background before flagging. |
| "any `bg-black/60` is a bug" | A dark scrim over paper is deliberate and universal (shadcn does it). | Only flag `bg-black` that is *not* `fixed inset-0`. |
| "any `rgba(255,255,255,·)` is a bug" | Same class of error — a dark card face with white text is fine. | Check what it composites against. |

**A regex cannot tell you whether light mode looks right.** It can only find candidates.
The final judgement needs the running app. That is why §3 below is a shortlist, not a verdict.

---

## 1. What is DONE (do not redo)

### 1.1 The polka-dot spatial field — was 1.05:1, invisible

`DotPattern` paints `fill="currentColor"`, so one `color:` declaration is the dot colour in
both themes. It was hardcoded `rgba(255,255,255,0.16)` — white on paper = **invisible**.

| | field | dot renders | contrast |
|---|---|---|---|
| dark | `#060608` | `rgb(46,46,48)` | 1.494:1 |
| light | `#ffffff` | `rgb(212,211,211)` | **1.494:1** — identical |

```css
/* design-tokens.css */
:root      { --dk-dot: rgba(255, 255, 255, 0.16); }
html.light { --dk-dot: rgba(28, 25, 23, 0.19); }
```

> **The light alpha is 0.19, not 0.16.** Copying the dark number across looks ~7% weaker,
> because white and warm ink are not equiluminant. This is why the value is measured.
> **Generalise this:** any "same in both themes" value must be solved for contrast on that
> theme's actual field, not copied.

### 1.2 In-card chips — 3 canvas cards had inline white

`DeadlineTrackerCard`, `WeeklyScheduleCard`, `DailyPlannerCard` wrote
`style={{ background: 'rgba(255,255,255,0.06)' }}`. **An inline style has no variant
system**, so on the light card face (`#ffffff`) these composited to a flat **1.000:1** —
the chips, their borders and their text did not exist.

| | dark (over `#0e0e11`) | light (over `#ffffff`) |
|---|---|---|
| `--dk-chip` fill | `rgba(255,255,255,0.06)` → 1.134:1 | `rgba(28,25,23,0.06)` → 1.129:1 |
| `--dk-chip-edge` | `rgba(255,255,255,0.10)` → 1.277:1 | `rgba(28,25,23,0.12)` → 1.281:1 |

### 1.3 Five dark-only panels that never flipped

These wrote `bg-[rgba(24,24,27,0.95)]` / `0.60` with **no `light:` variant at all** — a black
box on a paper page. Replaced with `--dk-bg-surface`, which already flips
(`rgba(11,11,13,0.88)` → `rgba(252,251,248,0.92)`), plus token-driven borders and text:

`CompositionEditorModal` · `VisualBuilderModal` · `CompositionHistoryDrawer` ·
`AutomationCard` · `CompositionRuleCard` · `AISuggestionModal`

**137 + 11 replacements.** White text on *saturated buttons* was deliberately preserved
(4 sites) — see §0 row 2.

---

## 2. The token map — use these, they flip by themselves

Prefer a flipping token over adding a `light:` variant. One token is one behaviour; a
variant pair is two things that can drift.

**From `src/components/ai/design-tokens.css`** (dark → light, both declared):

| token | dark | light | use for |
|---|---|---|---|
| `--dk-bg-deep` | `#060608` | `#f5f2ec` | page / void |
| `--dk-bg-base` | `#0b0b0d` | `#f5f2ec` | sidebar, panel |
| `--dk-bg-surface` | `rgba(11,11,13,.88)` | `rgba(252,251,248,.92)` | **modals** |
| `--dk-bg-raised` | `rgba(24,24,27,.65)` | `rgba(255,255,255,.85)` | inputs, raised chips |
| `--dk-bg-input` | `rgba(24,24,27,.85)` | `#edeae2` | form fields |
| `--dk-border-subtle` | `rgba(255,255,255,.06)` | `rgba(28,25,23,.08)` | hairline |
| `--dk-border-default` | `rgba(255,255,255,.09)` | `rgba(28,25,23,.12)` | input border |
| `--dk-text-primary` | `#fafafa` | `#1c1917` | headings, body |
| `--dk-text-secondary` | `#a1a1aa` | `#44403c` | secondary text |
| `--dk-text-muted` | `#71717a` | `#57534e` | hints, disabled |
| `--dk-dot` | `rgba(255,255,255,.16)` | `rgba(28,25,23,.19)` | canvas dots |

**From `src/index.css`** (app text scale): `--text-primary`, `--text-secondary`, `--text-muted`.

---

## 3. The shortlist — CHECK THESE IN THE APP, do not trust a grep

Ranked by how likely they are to be visibly wrong. All are *candidates*, not confirmed.

| # | file | why suspect |
|---|---|---|
| 1 | `automations/VisualBuilder/*` (6 files) | `BuilderPreview`, `StepAction`, `StepConditions`, `StepConfigure`, `StepReview`, `StepTrigger` — 0 `light:` classes found in any of them |
| 2 | `plan/PlanBoard.tsx` | ~50 neutral zinc/white literals, heaviest single file after `AIToolsTab` |
| 3 | `chat/MarkdownRenderer.tsx` | ~14 neutral literals — this renders AI output, so it is the most-read text in the surface |
| 4 | `chat/SlashCommandManager.tsx` | ~28 neutral literals |
| 5 | `reminders/GoalsRemindersDrawer.tsx` | ~30 neutral literals |
| 6 | `deck/AiPageDeck.tsx` | ~20 neutral literals |
| 7 | `chat/renderers/CardShell.tsx` | shared card shell — every AI response card inherits it |

---

## 4. Two things deliberately NOT changed

1. **Chart / canvas `fillStyle` literals** (~10 sites). `var()` does not resolve inside
   Canvas2D or a Chart.js dataset. `src/lib/CategoryColors.ts` freezes those palettes on
   purpose. Converting them renders black.
2. **`text-white` on saturated buttons** (13 sites). Correct in both themes.

---

## 5. Two pre-existing bugs found, not fixed, not mine

- `DeadlineTrackerCard.tsx:3` and `WeeklyScheduleCard.tsx:2` import
  `'../../../services/GoalStore'` — **3 levels up, should be 4**. `DailyPlannerCard.tsx:9`
  gets it right with `'../../../../services/GoalStore'`. `tsc` reports `TS2307`;
  esbuild passes. Left alone (out of scope, not introduced by the light-mode work).
- `src/components/dashboard/CardLibrary.tsx:16` imports `'./WidgetRegistry'`; the file is
  `widgetRegistry.tsx`. Case-sensitive filesystem error, breaks the whole `App.tsx` bundle.

---

## 6. Verification commands (no build needed)

```bash
# does it parse + resolve with real imports
npx esbuild src/components/ai/<file>.tsx --bundle --outdir=/tmp/v \
  --alias:@=./src --external:react --external:react-dom \
  --external:lucide-react --external:motion/react --external:chart.js --log-level=error

# scoped type check — the whole-project run has 8,000+ pre-existing errors
npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep "<your paths>"

# tokens actually flip
grep -n -- "--dk-bg-surface:" src/components/ai/design-tokens.css   # expect 2 hits
```

**Runtime check:** close RHEO, `npm run build` (CZ only — `AGENTS.md` §0-0 forbids agents
from building), then toggle light mode on `/ai` and walk the shortlist in §3.