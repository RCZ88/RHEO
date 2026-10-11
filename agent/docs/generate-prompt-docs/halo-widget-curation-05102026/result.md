Below is the complete curation decision, formatted as `RESULT.md` — one design, committed. It makes zero new `ActivityKind` values, honors the two-lane separation as *occlusion-not-eviction*, and treats the 520×300 canvas as the immovable budget it is.

---

# RESULT.md — Halo Island: Widget Curation & Slot Model

**Repo:** App Tracker / RHEO · **Scope:** `src/shared/halo/` + `src/features/halo/` · **Date:** 2026-10-05
**Inputs:** `CONTEXT_BUNDLE.md` (verbatim source), `HALO_ISLAND.md`, `RESULT_widgets.md` (dashboard inventory). No repo access beyond the bundle; every unverified item is flagged, not papered over.

---

## 1. Slot Model

### 1.1 The core decision: one capsule, three lanes, occlusion-not-eviction

The island is **one window, one capsule** on the `top` edge. I am deliberately not using the typed-but-unimplemented `left`/`right` edges in v1: each wing would be a second always-on-top transparent window under Wayland, duplicating the exact compositor and click-through costs that shrank the canvas to 520×300 in the first place (bundle §6.4). Wings are a phase-2 mapping (§1.5), not a v1 dependency.

Everything lives in **three lanes**, and the lanes cannot evict each other:

| Lane | Who | Surface | Evictable? |
|---|---|---|---|
| **A · Resident** | `stopwatch` (by identity, `HERO_KIND`) with `now` composited into it | Compact: left segment. Expanded: hero stage | **Never.** Occluded at most; timer accumulates |
| **B · Live** | `dictation` (750) > `focus` (600) > `afkGap` (450) — states that are *happening* | Compact: right pip segment. Expanded: strip left cell | Yields only to a higher-priority live state or a toast |
| **C · Toast / Strip** | `critical` (900) and any future interruptor; also hosts the ambient rotation when idle | Compact: full-pill occlusion (temporary). Expanded: the strip row | Fully evictable; `minimumDisplayMs` is its floor |

The key move that resolves the `stopwatch`-is-both-hero-and-500 conflict: **the resident is never removed, only covered.** A critical toast *occludes* the compact pill for its `minimumDisplayMs` (6 s floor), then shrinks to a trailing dot; the stopwatch reappears with its elapsed intact, because it never stopped accumulating. Priority orders *attention*, never *existence*. This is the same identity-over-priority lesson the codebase already paid for, applied to the whole surface.

### 1.2 Concurrency compositions — exact

**Compact (232×40, fixed, never rotates its geometry):**

| Concurrent activities | Composition (inner width 208px after 12px side padding) |
|---|---|
| **1** | Hero fills all 208px: `timer` icon 16 · elapsed mono 13px · app label (max 40px, ellipsis) · tracking dot 4px |
| **2** | Hero segment **116px** (icon 16 + elapsed 52px + label max 34px) + 1px `--halo-hairline` divider + pip segment **71px** (icon 16 + value ≤ 50px). Tracking dot drops out at 2-up |
| **3+** | **Compact never renders a third content segment.** 232px cannot hold three legible units and pretending otherwise produces 6px type. The third concurrent activity is represented by a **4px domain-hue dot** in a trailing dot zone (max 3 dots, 20px). A critical toast *replaces* the whole pill temporarily (occlusion), it does not squeeze in |

**Expanded (≤520×296 within the fixed canvas):**

| Concurrent | Composition |
|---|---|
| Hero only | Width class **SM 360** |
| One strip unit | **MD 460** (strip card 238 centered) |
| Two strip units (rotation rail, or live-card + rail-card) | **LG 520**: hero stage 96px + strip 120px (2 × 238px cards + 12px gap = 488 inner) + footer 24px. Total 96+12+120+12+24 + 32 padding = **296 ≤ 300** ✓ |
| Toast live | Strip row becomes a full-width 56px toast; island height shrinks to 232. Rotation pauses |

### 1.3 Strip composition rule (deterministic, no layout guessing)

The expanded strip row shows, in order of precedence, exactly one of:

1. **Toast** (full-width, 56px) — while any toast lane activity is within its display floor;
2. **Live + Rail** (238px live-state card + 238px first rotation card);
3. **Rail** (2 × 238px rotation cards);
4. **Honest empty** (`Nothing to rotate — widgets appear as features publish`) when the ambient roster has zero publishable activities.

### 1.4 Eviction, queueing, and the two hooks that already exist

- **Toasts:** arrive into lane C. If the strip/occlusion is busy and still inside its `minimumDisplayMs`, the newcomer **queues** (depth 3). Queue overflow drops the lowest-priority, oldest item. A dropped item whose `replaceGroup` matches the displaying item is **absorbed, not lost** — that is what `replaceGroup` is for, and every ambient data publisher **must** set `replaceGroup: stableId(kind, discriminator)` so re-publication updates in place instead of stacking. Per-event publishers (none in the promoted roster) would opt out deliberately.
- **Live states:** displace each other strictly by the existing PRIORITY ranks (750 > 600 > 450). The displaced one suspends (it is a state, not a message); when the winner ends, the loser resumes if still true.
- **Resident:** no arrival, at any priority, removes it. Critical occludes compact for 6 s then reduces to a dot; in expanded it occupies the strip, not the hero stage.
- **Never dropped:** anything with `persistent: true`, anything `pinned: true`. Ambient rail cards are never "evicted" at all — they are a fixed roster that rotates.
- **`minimumDisplayMs` gets two jobs**, both first-use: (a) toast floor — a toast cannot be replaced before its minimum; (b) rotation floor — after an interrupt clears, the rail resumes on the card it was showing *if* that card hasn't consumed its minimum. Every promoted ambient publisher sets `minimumDisplayMs: 6000`; critical sets 6000.

### 1.5 Zone assignment (center now, wings mapped for phase 2)

| Kind | v1 zone | Phase-2 wing (only when edge placement ships) |
|---|---|---|
| stopwatch + now | Center — resident segment / hero stage | stays center |
| dictation | Center — pip / strip | **right wing** (detached mic capsule) |
| focus, afkGap | Center — pip / strip | stays center |
| critical | Center — occlusion / strip | stays center |
| all ambient rail cards | Center — strip | stays center |
| queue/pin dots | Center — trailing dot zone | **left wing** (dot column) |

### 1.6 Pinning (deliverable 7)

The envelope already carries `pinned: boolean` — pinning is a **flag, not a kind**, and `pinnedActivity` (300, persistent) is the *slot envelope* the router publishes for the pin position: `stableId('pinnedActivity', sourceKind)`.

- **Meaning:** a pinned ambient card (a) anchors first in the rail, (b) never rotates away, (c) never expires, (d) joins the compact ambient-pip rotation as the **first** turn, (e) shows its domain hue as a permanent trailing dot in compact.
- **Affordance:** each rail card's header has a trailing 14px `pin` icon, visible on hover (hairline brightening only — no scale). Click toggles. Persisted in `HaloPreferences` as `pinnedKind: ActivityKind | null` — **max one pin in v1**; pinning a second unpins the first (it returns to rotation). Pinning is identity-based, consistent with the hero: pinning never boosts priority. A pinned card still yields the strip to toasts.
- **Dismissal:** the dismiss (X) affordance is disabled on a pinned card; unpin first. Pinning a source whose data dies renders `Pinned source unavailable` plus an unpin button — never a silently stale card.
- **`pinnedUserInteraction` (1000)** is redefined as the *engagement guard*: while the pointer is inside the expanded island, nothing swaps under the cursor — toasts wait, rotation pauses. The user's attention outranks every publisher.

---

## 2. Activity Verdicts — all 17

| # | Kind | Verdict | Lane / slot | Domain hue | Icon (lucide) | One-line reason |
|---|---|---|---|---|---|---|
| 1 | `stopwatch` | **keep** | Resident (identity) | amber `--halo-signal` | `timer` | The hero; ranked 500 is its interruption policy only |
| 2 | `dictation` | **keep** | Live pip | clay-400 `--halo-focus` | `mic` | Recording is the definition of live; owns the pip at 750 |
| 3 | `focus` | **promote** (ship-gated) | Live pip #2 | amber | `target` | A countdown is a live state the island exists to show; dormant until session state is wired |
| 4 | `afkGap` | **promote** | Live pip #3 | amber | `coffee` | Explains a stalled hero — "why is the timer not moving" answered inline; heartbeat-fed |
| 5 | `now` | **promote** (composited) | Inside resident | sky-400 | — (no own icon) | Current app is hero metadata, not a competing card; it *is* the resident's label |
| 6 | `tierBreakdown` | **promote** | Rail rotation | sky-400 | `layers` | The day's shape is glanceable and intraday-relevant; ports the StatusBand tier language |
| 7 | `nextDeadline` | **promote** (family) | Rail rotation | amber (life) / sage-400 (lyceum) | `calendar-clock` / `graduation-cap` | "The next thing due" is the island's highest-duty ambient card; two discriminators, one kind |
| 8 | `pinnedActivity` | **promote** | Pin slot envelope | inherits source | `pin` | The pin slot needs an envelope; UX defined in §1.6 |
| 9 | `clock` | **reject** | — | — | — | The Plasma panel clock is 40px away; zero marginal information |
| 10 | `liveActivity` | **keep** (reserved carrier) | none in v1 | — | — | Portable envelope for future long-running jobs; adding slots before publishers exist is speculative |
| 11 | `hud` | **promote** (redefined) | Rail rotation | sky-400 | `terminal` | Redefined as the ambient-instrument family; first occupant is the console widget |
| 12 | `critical` | **promote** | Toast crown | clay-600 | `triangle-alert` | Errors must reach an always-on-top surface; 900 exists for exactly this |
| 13 | `download` | **reject** | — | — | — | Desktop-OS concern; Plasma surfaces downloads; no IPC channel exists here |
| 14 | `battery` | **reject** | — | — | — | Desktop-OS concern; Plasma tray owns it; a Wayland Electron app adds nothing |
| 15 | `aiUsage` | **promote** | Rail + ambient pip | sky-400 | `sparkles` | Tokens accumulate intraday, IPC channels named, compresses to "12.4k" honestly |
| 16 | `clipboard` | **reject** | — | — | — | An always-on-top island rendering clipboard contents is a shoulder-surfing hazard; privacy, not plumbing |
| 17 | `custom` | **keep** (reserved carrier) | none in v1 | — | — | Escape hatch for future user-defined widgets; the envelope prevents an 18th kind later |

**Zero new kinds were added.** The roster above needs none; the reserved carriers absorb the future.

### Per-promoted content spec

| Kind | Compact 232×40 | Expanded | Click |
|---|---|---|---|
| `stopwatch` (+`now`) | `timer` amber · `1:23:45` mono 13px tabular, seconds in `--text-faint` · app label 11px (now payload) · tracking dot | Hero stage: 72px productive-share ring, 28px mono elapsed (seconds 16px faint), app label + category dot, ≤4 tier chips (20px pills: dot + mono label) | Route `/` |
| `dictation` | pip: `mic` clay-400 · 4-bar level meter (2px bars, 4–12px) · `0:42` mono | Strip live card: meter, elapsed 20px, last transcript line (11px, 2-line clamp), stop button | Toggle stop — no route |
| `focus` | pip: `target` amber · `MM:SS` mono | Strip live card: countdown 20px mono, intent label 11px, `End` button | No route (in-place) |
| `afkGap` | pip: `coffee` amber · `12m` mono | Strip live card: "Away 12m", since-time 11px, dismiss X | Route `/activity` |
| `aiUsage` | pip (ambient turn): `sparkles` sky · `12.4k` mono | Rail card "AI TODAY": top model 12px, tokens 20px mono, session count 11px | Route `/ai` |
| `hud` (console) | pip: `terminal` sky · `2 live` mono | Rail card "CONSOLE": active sessions 20px mono, commands today 11px, handbook % as 2px progress hairline | Route `/penguin-console` |
| `nextDeadline` (life) | pip: `calendar-clock` amber · due-in mono | Rail card "NEXT DUE": title 12px 2-line clamp, `in 3h` mono 16px; overdue renders in clay-600 | Route `/life` |
| `nextDeadline` (lyceum) | shares the obligations pip turn | Rail card "LYCEUM": next lesson 12px, due-in mono, streak chip (`flame` 12px + count mono) | Route `/learn` |
| `tierBreakdown` | rail-only (no compact presence unless pinned) | Rail card "TIER MIX": ≤3 rows — 8px swatch + tier 11px + mm mono + share % | Route `/reports` |
| `critical` | full-pill occlusion: `triangle-alert` clay-600 + message 11px, 6 s floor, then trailing dot | Full-strip toast: icon, message 12px, source 10px faint, dismiss X | Payload `route` if present, else dismiss |
| `pinnedActivity` | first ambient pip turn + permanent dot | First rail card, `pin` icon filled, dismiss disabled | Source kind's route |

**Ambient rotation order (fixed, not priority-shuffled):** pinned → `aiUsage` → `hud`(console) → `nextDeadline`(life) → `nextDeadline`(lyceum) → `tierBreakdown` → wrap. Priority governs interruption; ambient order is a stable, learnable sequence — the same identity-over-priority principle, applied to rotation.

---

## 3. Rotation & Dwell

- **Membership:** the ambient roster (§2) plus the pin. Live states and toasts never rotate — they *occupy*.
- **Compact ambient pip dwell: 15,000 ms.** The pip rotates through pinned-first ambient order only when no live state claims the slot. Advancement is a 160ms opacity crossfade, no movement; `reducedMotion` swaps instantly.
- **Expanded rail dwell: 8,000 ms per page** (2 cards per page), 160ms crossfade between pages.
- **Interrupt precedence:** toast arrival swaps the strip to the toast and freezes the rotation cursor; live-state arrival takes the pip and suspends ambient rotation; pointer engagement (1000) freezes everything. On interrupt clear, the rail resumes at the retained cursor (subject to `minimumDisplayMs`).
- **Collapse mid-rotation (the broken-half-state fix):** rotation state is a *cursor*, not an animation. `stepHover` collapsing on pointer-leave freezes the cursor at the current card; the compact pip then **adopts that card** as its next pip turn — so what the user was reading in expanded is what they glance next in compact, and re-expanding resumes the rail at the pip's card. There is no half-state to break: every transition lands on a fully-composed frame. During the `expanding`/`collapsing` FSM states, all rotation is frozen so no swap occurs mid-transition.
- **Pointer proximity pauses the pip** (idle poll at 120ms means the machine knows the pointer is near before the user does): expansion never catches a content swap in flight.

---

## 4. Click-Through Contract

Compact click anywhere = **expand** (never a route — 232×40 targets are mis-tap magnets). All actions live expanded.

| Kind | Expanded click | Route | Dismiss path |
|---|---|---|---|
| `stopwatch` | hero stage | `/` | n/a (resident) |
| `dictation` | stop button on card | none | stops recording (live state, not dismissible) |
| `focus` | `End` button | none | ends session |
| `afkGap` | card | `/activity` | X, or auto-clears on heartbeat resume |
| `aiUsage` | card | `/ai` | X (returns to rotation) |
| `hud` (console) | card | `/penguin-console` | X |
| `nextDeadline` (life) | card | `/life` | X |
| `nextDeadline` (lyceum) | card | `/learn` | X |
| `tierBreakdown` | card | `/reports` | X |
| `critical` | card if payload route, else nothing | payload `route` | X; auto-reduces to dot after 6 s, persists until dismissed |
| `pinnedActivity` | card | source route | disabled — unpin first |

---

## 5. Honest Empty States

The blood rule, per kind. Zero renders `0`; unknown renders the sentence; error renders message + retry and **never** silently empty.

| Kind | Loading | Genuinely zero | Unknown / not loaded | Error |
|---|---|---|---|---|
| `stopwatch` | value-shaped static blocks | `0:00:00` | `No app detected` | `Tracking offline` + retry |
| `dictation` | n/a (renders only active) | — (absence = not rendered) | — | `Microphone unavailable` + retry |
| `focus` | n/a (dormant) | — (absence = not rendered) | — | `Focus state unavailable` |
| `afkGap` | n/a | — | — | `Tracking offline` (heartbeat stale >90s — distinct from honest AFK) |
| `now` | skeleton line | — | `No app detected` · category: `Uncategorized` | `Tracking offline` |
| `aiUsage` | skeleton blocks | `No AI sessions yet` | skeleton until first payload | `AI stats unavailable` + retry |
| `hud` (console) | skeleton blocks | never run: `No terminal sessions yet` · ran, none active: `0 active` | skeleton | `Terminal stats unavailable` + retry |
| `nextDeadline` (life) | skeleton line | `Nothing due` | skeleton | `Deadlines unavailable` + retry |
| `nextDeadline` (lyceum) | skeleton line | `Nothing due` · streak omitted if unknown | skeleton | `Learn stats unavailable` + retry |
| `tierBreakdown` | skeleton rows | `No time tracked today` | skeleton | `Insights unavailable` + retry |
| `critical` | n/a | — | — | is the error |
| `pinnedActivity` | source's loading state | — | `Pinned source unavailable` + unpin | source's error state |

---

## 6. Backend Audit

Trace, don't assume. The bundle's `FILL FROM DUMP` flag is treated as **unverified payload — ship gate**.

| Activity | IPC channel | Real / Stub / Absent | Notes |
|---|---|---|---|
| `stopwatch` | `stopwatchRelay.ts` + `tracking-heartbeat` | **Stub — relay exists, UNWIRED** | The hero still ships a fixture per bundle §4.2. Wiring the relay is the prerequisite for everything else on this island |
| `dictation` | renderer-local (`useSttFloat`) | **Real** (local) | No IPC needed; sole caller is `DictationIsland.tsx` |
| `focus` | — | **Absent** | No session-state channel named in the bundle. Ship-gate: dormant until the owning feature publishes state. No invented handler |
| `afkGap` | `tracking-heartbeat` | **Real** | Platform fact #5 honored — `powerMonitor.getSystemIdleTime()` is dead on Linux; all AFK logic derives from heartbeat gaps |
| `now` | `tracking-heartbeat` | **Real (via heartbeat)** | App/category fields assumed present in heartbeat payload — verify field names at wiring |
| `aiUsage` | `get-ai-stats` + `get-model-usage` | **Real channels, payload unverified** | Shapes marked `FILL FROM DUMP`; verify before the card renders anything but skeletons |
| `hud` (console) | `get-terminal-stats` + `get-handbook-progress` | **Real channels, payload unverified** | Same gate |
| `nextDeadline` (life) | — | **Absent** | No /life deadline channel in the bundle. Report the gap; do not ship the card until wired |
| `nextDeadline` (lyceum) | `get-learn-stats` + `get-mastery-levels` | **Real channels, payload unverified** | Streak/due fields need verification |
| `tierBreakdown` | unnamed in bundle | **Unverified** | The dashboard hero renders tier data, so a channel plausibly exists — name it before wiring; do not assume |
| `critical` | activity publication path unnamed | **Absent (path unnamed)** | The bundle never names the renderer→overlay activity publish channel. This is the single biggest unconfirmed dependency — see Risks #1 |
| `pinnedActivity` | none (renderer + `HaloPreferences`) | **Real** (local) | Persisted via the preference store, per the localStorage ban |

**Constraint compliance:** no new IPC handlers, no `main.ts` edits. The four gaps above are reported, not invented around.

---

## 7. Design Specification (exact px, at size-scale 1.0×; the 0.7×–1.6× pref multiplies uniformly)

### 7.1 Compact — 232×40, radius 20 (pill), padding-x 12, bg `--halo-surface`, border `--halo-hairline`, shadow `--halo-shadow`

- **Layout 1 (solo hero, inner 208):** `timer` 16px amber · 6px · elapsed JetBrains Mono 13px tabular (seconds `--text-faint`) · 6px · app label Inter 11px `--text-secondary`, max 40px ellipsis · 4px tracking dot (sage = tracking, `--text-faint` = paused).
- **Layout 2 (hero + pip, inner 208):** hero 116px (icon 16 + elapsed 52 + label max 34) · 1px `--halo-hairline` divider, 20px tall · pip 71px (icon 16 + value ≤50px mono 12px; dictation pip = `mic` + 4-bar meter 14px + `0:42`).
- **Dot zone (3+ concurrent, trailing 20px):** up to 3 × 4px dots, 4px gaps — pinned (its domain hue), queued toast (clay-600), critical-after-occlusion (clay-600).
- **Critical occlusion:** full 208px — `triangle-alert` 16px clay-600 · 8px · message 11px single-line ellipsis. 6 s floor, then collapses to the trailing dot.

### 7.2 Expanded — LG 520×296, radius 12, padding 16 (inner 488)

- **Hero stage (96px):** left — 72px SVG productive-share ring (stroke 6, arc `--halo-signal`, track `--halo-track`); 16px gap; elapsed 28px JetBrains Mono tabular (seconds 16px `--text-faint`), app label 12px + 8px category circle below; right — ≤4 tier chips: 20px pill, radius pill, bg `--bg-secondary`, border `--border-default`, 8px dot + 11px mono label.
- **Strip (120px):** per §1.3. Cards 238×120, radius 12, bg `--halo-surface`, border `--border-default`, padding 12 (inner 214×96): header row 16px (icon 16 domain hue + 6px + label 10px mono uppercase letterspaced + spacer + `pin` 14px hover-only); value 20px mono; secondary 11px, 2-line clamp.
- **Toast variant (56px strip):** icon 16 clay-600 · message 12px · source 10px `--text-faint` · `x` 16px button.
- **Footer (24px):** left — page dots 4px (active amber); right — `pin` 12px if pinned + `n queued` 10px mono `--text-faint`.
- **Width classes:** SM 360 (hero only) / MD 460 (one strip unit) / LG 520. Recomputed on expand and on roster change; 180ms ease-out width/height morph, 160ms content crossfade, **no spring, no bounce, no slide**; `reducedMotion` = instant.

### 7.3 Colour and domain discipline (deliverable G)

| Hue | Family | Kinds |
|---|---|---|
| amber `--halo-signal` | TIME | stopwatch, focus, afkGap, nextDeadline(life) |
| clay-400 `--halo-focus` / clay-600 | SPEECH / alarm register of the same warm family | dictation / critical (+ overdue text) |
| sky-400 | WORK DATA | now, tierBreakdown, aiUsage, hud(console) |
| sage-400 | GROWTH | nextDeadline(lyceum), tracking-state dot |

Hues appear **only** as identity dots, swatches, the hero ring, and progress fills. Island chrome — borders, dividers, buttons, text — is monochrome. One hue per activity; the surface never becomes a rainbow. No new tokens were introduced.

### 7.4 Icon & component sourcing — MCP disclosure

**No MCP servers were queried in this session — no tool access; nothing was pulled from `shadcn`, `magicui`, `reactbits`, or `iconify`, and I am not fabricating a component inventory.** The prior verdicts stand binding: `magic-card`, `BorderBeam`, `NumberTicker`, particle motion, glass chrome, hover-scale, animated counters — all already REJECTED, none re-proposed here, and nothing in this design needs them. Icons cited are lucide stable names (`timer`, `mic`, `target`, `coffee`, `sparkles`, `terminal`, `calendar-clock`, `graduation-cap`, `layers`, `triangle-alert`, `pin`, `flame`, `x`) — verify exact names against the installed lucide version at build time (`triangle-alert` vs `alert-triangle` and `chart-pie` renames are the known trap). Slot chrome needs only primitives the codebase already has (buttons, skeleton blocks, progress hairline); if the implementing agent has shadcn access, `popover`/`tooltip`/`progress` are the only plausible pulls, re-skinned to LAMINAR per the anti-slop checklist.

### 7.5 Where the logic lives

The lane/strip/rotation selector is a **pure function** — `composeIsland(activities, islandState)` — in `src/shared/halo/slotModel.ts` (pure logic belongs in `shared/`; this adds no IPC and touches no P0 file). The renderer (`OverlayRoot.tsx`) consumes its output; `DictationIsland.tsx` is retained as the pip/strip renderer for `dictation` to minimize regression on the one shipped live surface.

---

## 8. Rejections

| Rejected | Stood in for | Why the island is the wrong surface |
|---|---|---|
| `clock` | — | Plasma panel clock adjacent to the anchor; duplicating it wastes the one durable slot on zero information |
| `battery` | — | Desktop-OS concern; Plasma tray owns it; no app IPC exists; an Electron app polling battery adds failure modes, not awareness |
| `download` | — | Desktop-OS concern; browser/OS surfaces progress; no channel; transient progress belongs in transient OS UI |
| `clipboard` | — | Privacy: an always-on-top island echoing clipboard contents (including passwords) to the screen is a shoulder-surfing hazard regardless of data availability |
| `/finance` (finance-widget) | money on the island | Sensitive by the bundle's own verdict; balances on an always-on-top overlay is a disclosure risk; glanceable elsewhere |
| `brain-widget` | — | Node counts and density are structural vanity metrics, retrospective, and never urgent *now* |
| `health-widget` | — | Daily-resolution data (last night's sleep) on an intraday glance surface; changes once a day, so rotation dwell would show a frozen card |
| `covenant-widget` | — | A third obligations card would let the obligations family dominate the rail; life-deadline + lyceum-due already serve the need; revisit if users ask to pin it |
| `browser-widget` (card) | — | Top-sites/category split is retrospective — reports territory. Its one live signal (tracking state) survives as the 4px dot on the resident segment |
| `/ide`, `/resume`, `/studio`, `/lecture`, `/reports` (as ambient content), `/settings` | — | Full-screen work surfaces and retrospectives; the island summarizes state, it never hosts or previews editing pipelines |
| Left/right `OverlayEdge` wings (v1) | multi-capsule layouts | Each wing is another transparent always-on-top window on Wayland — the exact cost that shrank the canvas; vocabulary stays reserved (§1.5) |

---

## 9. Risks — ranked

1. **The activity publish channel is unnamed in the bundle.** Every lane routes through it; the toast lane cannot ship until the renderer→overlay path (or its absence) is confirmed. If it doesn't exist, this design still holds — but `critical` and everything in lane C is blocked on it, and it is the one thing I could not verify from here.
2. **Widget payload shapes are `FILL FROM DUMP`.** `aiUsage`, `hud`(console), `nextDeadline`(lyceum) may not match the real IPC payloads. Mitigation is structural: cards render skeletons until verification, so a shape mismatch costs a wiring fix, not a redesign.
3. **The hero itself is still a fixture** (`stopwatchRelay.ts` unwired). This slot model multiplies surfaces that would render fixture data. The honest-stopwatch work is the prerequisite, not a parallel track.
4. **Compact pip rotation may read as churn.** 15s dwell and pointer-proximity pausing are the guardrails; if telemetry shows misreads, freeze the pip to pinned-only — a one-line roster change, not a model change.
5. **Expanded height is spent: 296 of 300px.** The strip is the only growth valve; any future fourth row breaks the budget and must displace something, not stack.
6. **Absorbing dictation into the pip touches a shipped surface.** Keeping `DictationIsland.tsx` as the slot renderer contains the regression blast radius, but the host change is real and needs a manual pass on KDE.
7. **Width-class morphing vs the placement guard.** The OS window is fixed 520×300 so the guard sees no movement — but if anyone later binds window size to island size, the >24px displacement guard will log false positives on every width-class change. The fixed-canvas invariant is what protects this design; do not break it.
8. **`focus` ships-gated on an absent channel.** If the focus-session state never gets a publish path, the pip slot silently never fills — honest, but a dead lane; revisit at the next planning cycle rather than inventing state.
