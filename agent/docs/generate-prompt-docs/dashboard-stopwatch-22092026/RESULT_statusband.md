# RESULT.md — StatusBand Redesign (Stopwatch + Daily Momentum)

> **Ruling basis:** R-28 (reconciliation) · R-29 (sanctioned glow exception — PRE-STAGED, principal rules) · R-30 (queue + R-19 contract preservation) · LAMINAR (design/design.md is law) · §15 naming · W-1–W-10 slop bans · empty≠zero
> **Supersedes:** the 2026-09-22 StatusBand Redesign PROMPT.md as written ("full creative freedom" is bounded by the constitution — skills lose to design.md)
> **Queue position:** Renderer-only — **parallel-to-P0 eligible** (StatusBand.tsx is not a §7 hot file). Rides ON TOP of the R-19 stopwatch honesty contract — this is a visual redesign, not a data-contract change.

---

## 8.1 Executive Summary

One component, three jobs: the live stopwatch (honest about what it knows), the tracking-state readout (Idle / Locked In / Distracting / degraded-on-Wayland), and an always-visible daily momentum block (focus ring vs 240-min target, streak, 7-night... weekly mini-bars). Of the three candidate directions in the source bundle, **Design A "Clean Minimal" is the only constitutional path** — amended: NumberTicker and BlurFade stripped, hairline entrance instead. Designs B (neon) and C (glass) are rejected on standing law. The principal's "luminous hairline" taste is honored through a **pre-staged sanctioned exception (R-29)**: a state-gated, alpha-capped gradient hairline — pending his one-word ruling, the default ships plain-LAMINAR.

---

## 8.2 Direction Ruling (R-28)

| Candidate | Verdict | Reason |
|---|---|---|
| **A — Clean Minimal** (`513db2d`) | **SELECTED, amended** | Only direction compatible with LAMINAR. Amendments: `NumberTicker` → static tabular-nums (R-25 motion ruling); `BlurFade` entrance → opacity/transform one-shot (transform/opacity-only law); accents from CategoryColors, not literal emerald/amber hexes. |
| B — Neon Glow (`e6139aa`) | **REJECTED** | `NeonGradientCard` + `BorderBeam` + `DotPattern` + box-shadow glow = four standing violations (glow ban, MCP slop bans incl. BorderBeam/NeonGradient, no box-shadow elevation, decorative background pattern). **Revivable only through R-29 exception** — see §8.3. |
| C — Glass Surface (current) | **REJECTED as target** | `GlassCard` = backdrop-blur; glass is banned in NEW code (existing instance is M-1 debt). The redesign replaces the surface → new code → solid token surface + hairline. |

---

## 8.3 R-29 — Sanctioned Glow Exception (PRE-STAGED — principal rules, default = OFF)

| Row | Option | Spec |
|---|---|---|
| **Default (OFF)** | Plain LAMINAR | 1px solid hairline token, all states identical chrome. Zero risk, ships immediately. |
| **Exception (ON, if ruled)** | "Locked In" luminous hairline | ONE gradient hairline, full perimeter, **≤8% alpha**, CategoryColors accent, **state-gated to Locked In only** (Idle/Distracting/degraded = plain hairline). Static or single 400ms ignite on state entry. **Alpha is the test, not blur** (same precedent as Meridian LIVE bloom, R-10). RM: renders as plain hairline. Grep gate: effect scoped to one class, one file. |

The executor implements behind a single boolean constant (`LOCKED_IN_LUMEN = false`). Principal says "lumen on" → one-line flip + evidence pass. No law is broken either way.

---

## 8.4 Component Specification — `src/pages/dashboard/StatusBand.tsx`

### Structure

```
<WidgetCard data-section="status-band">            (existing wrapper — untouched)
  <div grid: [timer block | momentum block]>       (split at ≥md; stacked below)
    ├─ Timer block
    │   ├─ row: TrackingStateChip + currentApp (or honest empty string)
    │   ├─ HH:MM:SS  font-display 22px+ bold, tabular-nums
    │   └─ Focus Button (shadcn Button, primary)
    └─ Momentum block (VISUALLY SEPARATED by hairline divider — the legal reading of "glowing borders separate sections")
        ├─ SVG ring: focusMinutes / 240 target, stroke token accent
        ├─ momentum score (tabular-nums) + streak (Flame icon, token color)
        └─ 7 weekly mini-bars: solid token bars, one-shot stagger ≤400ms total (R-9 precedent)
  </div>
</WidgetCard>
```

### Data contract (UNCHANGED from R-19 — this redesign must not touch it)

- `useDashboardDataContext()`: `displayTimeMs`, `focusMinutes`, `currentAppName`, productivity state.
- Honesty guards preserved verbatim: `isReal === true` checks; `isReal:false` → explicit "No foreground data" string, NEVER `0s`, never fabricated app name.
- Wayland degraded (`activeWinAvailable === false`, via existing platform-info channels): degraded-reason row persists through the redesign.
- Momentum empty ≠ zero: no focus data today → ring renders empty state string, NOT a 0% ring; true 0 minutes → ring at 0 with explicit `0`.

### Visual tokens

- Surface: solid `--bg-elevated` (dump `src/index.css` STEP-0; pink-amber token conflict — code wins). Hairline 1px token border. **No backdrop-blur, no box-shadow, no dot patterns, no decorative gradients on chrome.**
- Radius **10**. Padding per design.md card pattern.
- Accents: emerald/amber mood → nearest CategoryColors Tableau-10 hues, recorded in report. Zero hex literals.
- Fonts: families/roles from the dump (package's Space Grotesk / JetBrains Mono claims quarantined — M-1 owns the font truth).
- Icons: lucide only (Flame, Target, Activity, Clock). Console stamp per repo convention.

### Motion

- `motion/react` only. Entrances ≤400ms one-shot, opacity/transform only.
- Ring fill: stroke-dashoffset one-shot ≤400ms (R-9 stroke-draw precedent). RM: final state instantly.
- State transitions Idle→Locked In→Distracting: 140ms opacity/color crossfade. No spring. No `whileHover` scale — hover = hairline brightening + pointer.
- No ticker, no blur-entrance, no BorderBeam, no looping anything.

### 4-state matrix

| State | Render |
|---|---|
| Loading | Skeleton matching timer + ring shape |
| Empty (no foreground / no focus yet) | Explicit strings per R-19; momentum empty-state |
| Error | Message + retry Button |
| Populated | Full spec; Wayland degraded variant evidenced in screenshots |

---

## 8.5 Phases

| Phase | Scope | Commit |
|---|---|---|
| **1 — Redesign** | STEP-0 token dump → component rebuild per §8.4 → `LOCKED_IN_LUMEN` constant (false) → registration untouched | `feat: StatusBand LAMINAR redesign with daily momentum` |

Single phase, single commit. If R-29 is ruled ON afterward: one follow-up commit `feat: locked-in lumen exception (R-29)` with evidence pass.

---

## 8.6 Verification Checklist

- **Build:** `node scripts/build.mjs` exits 0. **Typecheck:** zero errors outside docs/debt.md; total + delta reported.
- **Served artifact:** `dist/` verified (never dist-tmp/); stale dist deleted first.
- **Shell-launch:** Playwright `_electron.launch` + bounding-box + screenshots: (1) populated Locked In with momentum, (2) honest empty state "No foreground data" — proving NOT `0s`, (3) Wayland-mock degraded row, (4) RM pass — entrances instant, lumen (if on) renders plain.
- **Grep gates (verbatim in report):** `backdrop-blur` = 0 · `box-shadow` = 0 · `BorderBeam|NeonGradient|DotPattern|NumberTicker|BlurFade|framer-motion` = 0 · hex literals = 0 · `whileHover` = 0 · "DeskFlow" = 0.
- **R-19 regression:** isReal guard tests still pass; empty≠zero screenshots match the R-19 evidence set.
- **Momentum gates:** empty ring ≠ 0% ring (two screenshots); true-zero renders explicit `0`; streak/week bars hidden when empty (not zero-filled).
- **EOL:** match file endings; zero EOL-only diff lines.

---

## 8.7 Risks & Invariants

| Risk | Mitigation |
|---|---|
| "Creative freedom" drifts into glow/beam anyway | Grep gates above are FAIL-closed; report verbatim |
| Redesign accidentally drops R-19 guards | §8.4 contract is copy-preserved; regression gate compares screenshots against R-19 set |
| Principal wants real neon, not the lumen compromise | R-29 exception row exists; if he wants B verbatim, that's a constitution amendment ruling (his word, new R-number) — executor never decides this |
| Momentum target 240 min hardcoded | Read from existing goals/config if present; else constant with report note — never fabricated per-user data |

---

## 8.8 Deferred / Rejected

| Item | Verdict |
|---|---|
| NeonGradientCard / BorderBeam / DotPattern | Rejected (R-28) — slop bans + glow ban; only path back is a principal-granted amendment |
| NumberTicker, BlurFade | Rejected — R-25 + transform/opacity-only law |
| GlassCard surface | Rejected — glass banned in new code |
| Data-contract changes | Out of scope — R-19 owns the stopwatch contract; this is chrome-only |
| VCalendar / other widgets | Untouched |

---

## 8.9 Anti-Regression Checklist

- [ ] Existing dashboard layout unchanged (StatusBand slot + size identical)
- [ ] WidgetCard wrapper + navigation intact
- [ ] Focus button starts a session (Playwright evidence)
- [ ] isReal honesty contract intact (R-19 evidence set re-run)
- [ ] RM pass clean
- [ ] tsc total + delta reported; no new errors

---

*Amendments vs. the 2026-09-22 package: "full creative freedom" bounded by LAMINAR · Design B/C rejected, Design A selected + amended (R-28) · glow request converted to pre-staged sanctioned exception (R-29, default OFF) · NumberTicker/BlurFade/BorderBeam/NeonGradient/DotPattern rejected · glass surface rejected · font/token claims quarantined behind index.css dump · R-19 honesty contract preserved verbatim · renderer-only, parallel-to-P0 (R-30).*
