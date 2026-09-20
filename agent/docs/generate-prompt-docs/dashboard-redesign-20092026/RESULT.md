# RESULT.md — Dashboard Card Primitives & Stopwatch Honesty Fix

> **Ruling basis:** R-16 (reconciliation) · R-17 (activity rings rejected) · R-18 (bento-grid rejected) · R-19 (stopwatch split) · LAMINAR (design/design.md is law) · §15 naming · dependency freeze · empty≠zero
> **Supersedes:** the 2026-09-20 Dashboard Card & Stopwatch PROMPT.md as written
> **Queue position:** Phase 1–2 are renderer-only and may run **in parallel with P0** (no hot-file claims). Phase 3 touches main.ts → **behind LINUX-TRACKING P0 / L-2**.

---

## 8.1 Executive Summary

Two things ship here. First, every dashboard card converges on shared primitives: shadcn `Card` re-skinned to LAMINAR (solid token surface, hairline, radius 10, no border, no shadow) and shadcn `Button`, with `motion/react` as the single motion engine — killing the bespoke borders, MagicCard gradient chrome, and mixed motion imports the audit found. Second, the stopwatch stops lying: the renderer guards on `data.isReal` (never `data.app` truthiness), renders an explicit "no foreground data" state instead of a fabricated zero, and on Linux Wayland surfaces the tracking-degraded reason rather than faking a fix. The rejected half of the source prompt (kokonutui rings/bento) is documented in §8.11 with its disqualifying evidence.

---

## 8.2 Precondition — Token Dump (blocking, STEP-0)

Before any edit: dump `src/index.css` and grep the font stack. The source package asserts pink-500 as the signal hue and an Inter/Space Grotesk stack; the bundle token conflict (pink #ec4899 vs amber #fbbf24 both claiming `--color-primary`) means at least one bundle fabricated values. **Code wins.** The dump determines: the real accent token, the real font families/roles, and the real radius/spacing tokens. If the dump contradicts this spec's assumptions, STOP and report — do not improvise a third palette.

---

## 8.3 System Architecture

```
Renderer
├── DashboardPage ──▶ shared primitives only (Card / Button / Badge)
│     ├── StatusBand (stopwatch) ──▶ guards data.isReal, 4-state honest render
│     ├── ScheduleCard ──▶ motion/react already migrated; borders purged
│     ├── QuickFocusCard / Deep Focus card ──▶ Card+Button rebuild
│     └── (all other dashboard cards) ──▶ borders/shadows purged to shared primitive
├── src/components/ui/card.tsx   ──▶ LAMINAR re-skin: solid, hairline, radius 10
└── src/components/ui/button.tsx ──▶ cva variants kept; tap feedback via motion/react
Main (Phase 3 only, behind P0/L-2)
└── get-current-foreground ──▶ shape audit: { app, isReal } NEVER null; joins L-2 evidence
```

---

## 8.4 Primitive Specification

### `src/components/ui/card.tsx` (re-skin)

- Surface: solid token background (`--bg-elevated` or index.css equivalent — **from the dump**). NO `border` classes, NO `shadow-*`, NO backdrop-blur.
- Hairline: 1px via token hairline color on one edge or full ring per design.md card pattern — whichever design.md specifies; do not invent.
- Radius: **10** (cards/panels). NOT `rounded-xl`/12, NOT `rounded-3xl`.
- Sub-components kept: `CardHeader`, `CardContent`, `CardFooter`, `CardTitle`, `CardDescription`, `CardAction`.
- Padding: per design.md card pattern (≤ the token scale); source package's `p-5` cap subsumed by design.md.

### `src/components/ui/button.tsx`

- Keep `cva` variants (`default`, `ghost`, `outline`, `secondary`, `destructive`, `link`) and sizes.
- All interactive elements in dashboard cards use this `Button` — no hand-written `<div onClick>`, no `border` classes on buttons.
- Tap feedback: `motion/react` `whileTap={{ scale: 0.97 }}`, **140ms** reactive duration per §2 easing law, transform/opacity only. No spring/bounce. `prefers-reduced-motion` → tap feedback disabled (instant state change only).

### Motion law (dashboard scope)

- Single engine: `motion/react`. Grep gate: `from "framer-motion"` in dashboard files = 0.
- Entrances ≤400ms one-shot; reactive 140ms; transform/opacity only; never `transition: all`; never width/height animation.
- `AnimatePresence` for mode transitions (Timer ↔ Challenge) — opacity/transform only.

### Naming (§15)

- No "DeskFlow"/"App Tracker" strings in any touched file, comments included. `window.deskflowAPI` references stay as-is (sanctioned debt).

---

## 8.5 Stopwatch Data Contract (R-19)

### Current contract

`get-current-foreground` must return `{ app: string, isReal: boolean }` — **never null, never undefined**. `isReal: false` is the honest "no data" signal (empty ≠ zero). Frontend guards MUST check `data.isReal === true`, never `if (data.app)` (an empty-string app is falsy but a *successfully read* empty state; the distinction matters on Wayland).

### Renderer fix (Phase 2 — renderer-only, no main.ts claim)

- StatusBand guards: `const tracking = data?.isReal === true`.
- States:
  - **Populated + real:** app name + elapsed, tabular-nums.
  - **Populated + not real:** explicit "No foreground data" string — NOT `0s`, NOT a blank, NOT a fabricated app name.
  - **Loading:** skeleton matching timer shape.
  - **Error:** message + retry affordance.
- Linux Wayland (via `get-platform-info` + `tracking-status-changed`, per L-1): when `activeWinAvailable === false`, render the degraded reason string ("Tracking degraded — browser-only mode on Wayland") per L-6 effective-mode contract. NEVER synthesize a foreground entry (L-1 ban).

### Handler audit (Phase 3 — behind P0/L-2)

- Grep audit of `get-current-foreground` handler in main.ts: enumerate every return path; each returns the `{ app, isReal }` shape. Null/undefined paths = FAIL, reported verbatim.
- Result joins the L-2 blocking audit evidence (freshForegroundIsBrowser + /browser-data under `activeWinAvailable=false`). No handler rewrite beyond shape normalization without L-2's findings — do not invent a "fix" that fakes foreground on Wayland.

---

## 8.6 UI Specification — Per Component

All components: 4-state matrix (empty/loading/error/populated), console stamp convention, zero hex literals, tokens from §8.2 dump. **No kokonutui imports.**

| Component | Change | States |
|---|---|---|
| `QuickFocusCard` / Deep Focus card | Full rebuild on Card: `CardHeader` (title + Badge), `CardContent` (circular progress + timer), `CardFooter` (disclaimer). Mode toggle = two `Button` (Timer/Challenge) side by side. Presets = three `Button` row. Start/End = primary `Button` with lucide icon + label. `AnimatePresence` mode transition. | populated/timer running/challenge running/error |
| `StatusBand` | `isReal` guards per §8.5; degraded-reason row on Wayland; borders purged to shared primitive | all 4 |
| `ScheduleCard` | Borders purge only (already on motion/react) | unchanged |
| All other dashboard cards | Replace hand-written markup + bespoke `border`/`shadow` classes with shared `Card`; buttons → shared `Button` | all 4 where applicable |

Circular progress in Deep Focus: SVG stroke, token accent color, no gradient stroke, no glow. RM: progress shown as static arc + tabular numerals.

---

## 8.7 Implementation Phases

| Phase | Scope | Hot-file claim | Commit message |
|---|---|---|---|
| **1 — Primitives + borders purge** | §8.2 token dump → card.tsx re-skin → borders/shadow/glass purge across dashboard cards → Button adoption → framer-motion grep = 0 | DashboardPage.tsx, StatusBand, ScheduleCard, QuickFocusCard, ui/card.tsx, ui/button.tsx (none are §7 hot files) | `refactor: dashboard cards to shared LAMINAR primitives` |
| **2 — Stopwatch renderer guard** | §8.5 renderer half: isReal guards, honest empty state, Wayland degraded reason via existing platform-info channels | StatusBand + data hook only | `fix: stopwatch honors isReal foreground contract` |
| **3 — Handler shape audit** (behind P0/L-2) | §8.5 handler half: return-path audit, shape normalization, evidence joins L-2 | main.ts — **file-claim required; queued behind LINUX-TRACKING** | `fix: get-current-foreground shape contract` |

Per-phase gates below. EOL: match each file's existing endings; zero EOL-only diff lines. One commit per phase; nothing unrelated rides.

---

## 8.8 Verification Checklist (per phase)

- **Build:** `node scripts/build.mjs` exits 0 — the repo's build (NOT the package's ad-hoc npx chain).
- **Served artifact:** verify the launcher serves `dist/` (never dist-tmp/); delete stale `dist/` first.
- **Typecheck:** `tsc` — zero errors outside docs/debt.md; report total + delta (sanctioned: RAGService 39-error cascade, pre-existing test/main.ts).
- **Shell-launch (Phases 1–2):** Playwright `_electron.launch` + bounding-box assertions + screenshots: dashboard with cards hairline-only, Deep Focus card structure, stopwatch empty state rendering the explicit string (screenshot proves NOT `0s`), Wayland-mock degraded reason row.
- **Grep gates (verbatim output in report):**
  - `backdrop-blur` in dashboard new/changed lines = 0
  - `framer-motion` imports in dashboard files = 0
  - hex color literals in changed files = 0
  - `border` class on card/button primitives = 0 (hairline token excepted, per design.md)
  - `rounded-3xl` / `rounded-xl` on cards = 0 (radius 10)
  - `apple-activity-card` / `bento-grid` / `BorderBeam` / `MagicCard` imports = 0
  - "DeskFlow" in changed files = 0
- **Stopwatch contract (Phase 2):** with mock `isReal:false` → screenshot shows "No foreground data"; with `isReal:true, app:'Code'` → shows app + timer. Empty ≠ zero verified by screenshot, not self-report.
- **RM pass:** OS reduced-motion on → no animated entrances; tap feedback absent; static states correct. Composition ≠ motion: static frames persist.

---

## 8.9 Known Risks & Invariants

| Risk | Mitigation |
|---|---|
| Dump contradicts package token claims (pink/Inter) | §8.2 STOP-and-report rule; never blend palettes |
| Purging borders orphans a component that visually depended on them | 4-state screenshot diff per card; hairline token restores structure without bespoke chrome |
| `isReal` guard flips a working path to permanent "no data" on Windows | Gate: same Playwright suite must show populated state with real foreground on X11 run — both states evidenced |
| Wayland degraded string reads like an error to users | Copy review: it's an informational state with reason, styled as data row not alert; principal sees RM/degraded states first (his OS animations are off — §0) |
| Phase 3 pressure to "also fix tracking" while in main.ts | Hard scope: shape audit only. Tracking logic changes = L-2 territory; executor STOPs and asks |

---

## 8.10 Deferred / Rejected (with evidence)

| Item | Verdict | Reason |
|---|---|---|
| `@kokonutui/apple-activity-card` | **REJECTED (R-17)** | SVG gradient rings (decorative-gradient ban), `rounded-3xl` 24px (radius set violation), glass chrome, unspecified data source (fabrication risk). What it approximates — daily activity summary — belongs to the Command Deck widget registry (WS-1), built from real stats_hourly/daily data, hairline-LAMINAR, when that queue clears. |
| `@kokonutui/bento-grid` | **REJECTED (R-18)** | Ships AI-brand cards (anthropic/gemini/open-ai/mistral/deepseek) — disqualifying slop. Dashboard grid ownership = WS-1 per W-1–W-10; any layout work waits for that spec. Tailwind grid suffices until then. |
| Activity rings from real data | Deferred to WS-1 widget registry | Requires `stats_hourly` aggregation design + ENTITY_COLORS mapping — separate spec, behind P0. |
| Spring/bounce micro-interactions | Banned | §2 easing law; single easing from design.md only. |

---

## 8.11 Anti-Regression Checklist (Phase 1–2 gate)

- [ ] Dashboard renders all existing cards (no card dropped in purge)
- [ ] Deep Focus timer start/stop/challenge flows work (Playwright evidence)
- [ ] ScheduleCard day navigation intact
- [ ] StatusBand shows real foreground on X11 with real data
- [ ] FocusGoals / tracking integration unaffected (renderer-only changes)
- [ ] LifePage / GoldPage untouched (file-claim audit: no edits outside claimed files)
- [ ] tsc total + delta reported; no new errors
- [ ] EOL audit: zero EOL-only diff lines

---

*Amendments vs. the 2026-09-20 PROMPT.md: DeskFlow→RHEO (§15) · glass layer banned (LAMINAR) · radii {6,10,16} replaces rounded-xl/rounded-3xl · kokonutui rings + bento-grid rejected (R-17/R-18) · pink-500/Inter claims quarantined behind index.css dump (§8.2) · build = node scripts/build.mjs (gov. 4) · stopwatch split into renderer-now / handler-behind-P0 (R-19) · Wayland empty+isReal:false ruled correct behavior, not a bug (L-1/L-2/L-6) · dashboard grid layout deferred to WS-1 (W-1–W-10).*
