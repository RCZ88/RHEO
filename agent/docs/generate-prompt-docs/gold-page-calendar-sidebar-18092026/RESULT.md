Calibration: App-queue frontier = **GOLD-LAYOUT v2** (your directive upgrades the wave: 3D entrance sanctioned, detail depth raised). **Ledger event: this order resolves §8-2** — the 3D signature goes now, merged with the layout wave; GO Phases 2–7 queue behind it. Ruling numbering continues at **R-62**.

---

# INTAKE → RULINGS

Your directive does three things: (1) the calendar is the page's primary object, not a sidebar accessory; (2) it **performs its 3D-ness on load** — a 2D→3D turn as the default opening state; (3) the spec goes deeper. The GOLD-3D ruling already sanctioned MonthWall as the page's ONE showpiece with a default pose (rotateX 9°/−7°, chrome bevel/specular ≤8%/reflection ≤6%, cursor tilt ±4°, one-shot entrance ≤600ms) — your order activates it and adds the **turn choreography** as its opening move. Three rulings, then the full v2 spec:

| # | Subject | Ruling |
|---|---|---|
| **R-62** | Entrance choreography | The wall's entrance is THE page's one narrative motion moment: **hold flat 80ms → turn to pose 520ms** (600ms total, design.md easing, transform/opacity only, one-shot per app session — tab re-entry renders at pose; RM renders at pose instantly, zero animation). Spec §3 is the choreography law. |
| **R-63** | Scene geometry amendments (GOLD-3D terms adapted to the sidebar) | Scene width = 100% of sidebar (supersedes "≥33vw" — authored for the old page region). Perspective 1100px on the scene wrapper. **Pose mirrors with side preference** — the wall always faces the content. "Break-out ≤24px" becomes **inset absorption**: the sidebar's `overflow-y-auto` would clip/scroll projected overflow, so the scene reserves internal padding; break-out is visual, never a scrollbar. |
| **R-64** | Merge + closure + gates | GOLD-LAYOUT (R-59–R-61) and GOLD-3D merge into ONE implementation wave — below is the complete v2 spec superseding v1. **§8-2 CLOSED** (resolved by your directive). Gates extended with G-3D-1…5. |

Skills applied, one line each: **Design Taste System** (dev-tool data workspace → medium variance, high density, one showpiece) · **Motion** (D-narrative one-shot, time-boxed ≤600ms, no springs/loops — the single L3-grade moment on an L2 page) · **Impeccable** (depth via alpha-capped light, never shadows; contrast floors on all chrome) · **frontend-design** (component anatomy, render-prop card) · **ui-ux-pro-max** (mono dominance, data-first, no decoration on chrome).

---

# RESULT.md v2 — GOLD PAGE: LAYOUT + THE STANDING WALL

*(supersedes v1 · R-59–R-64 · orchestrator as Architect · Hands implements after census)*

## §1 Design Concept — "The wall stands up"

The Gold page is a **monument and its ledger**. The calendar is the monument: a solid slab that greets you flat — a working 2D calendar — then **stands up into its 3D pose** over half a second, catching a sheen as it tilts, and stays standing: a permanent, tactile object anchoring the page while your goals, habits, and deadlines scroll past in the ledger beside it. The turn exists for one purpose: to tell you *this object has depth and you can touch it* — after 600ms it never moves again on its own. Everything else on the page is quiet monochrome; the wall is the only thing with a body.

Steady state: the wall leans at its pose (top tipped back 9°, near edge turned toward the content), bevel hairlines defining its thickness, a ≤8% specular sheen across its face, a ≤6% token-grey reflection pooling beneath it. Pointer over it tilts it ±4° — it answers you. That is the whole show. No loops, no idle motion, no glow.

## §2 Choreography — the turn (600ms, once per session)

Timeline (all values final; easing = design.md token, census confirms name — deceleration character: fast departure, long settle):

| t (ms) | Wall transform | Chrome | Data |
|---|---|---|---|
| 0 | `rotateX(0) rotateY(0) scale(0.99)` — painted **flat, fully opaque**, reflection 0%, specular 0% | bevel hairlines present (they're layout, not motion) | all days/events visible flat — it reads as a working 2D calendar first |
| 0→80 | unchanged — the **hold**: one beat so the flat state registers | — | — |
| 80→600 | the **turn**: `rotateX 0→9°`, `rotateY 0→∓7°`, `scale 0.99→1` (single interpolated transform, one composited layer) | specular sheen sweeps across the face once (≤8% alpha gradient band, translate only); reflection/floor 0→6% tracking turn progress | — |
| 450→600 | — | — | event dots settle: opacity/y ≤150ms stagger 20ms (subtle, capped 400ms total) |
| 600 | **pose locked.** `will-change` removed next frame. | specular static (its resting ≤8% is part of chrome) | done |

Laws binding the choreography: transform/opacity only; no springs, no overshoot — weight comes from the easing curve, not bounce; **one-shot per app session** (module-scope in-memory flag in `CalendarSidebar` — no storage; app relaunch replays it, tab flips don't); **RM: no choreography exists** — pose + reflection at final values at t=0, no sweep (RM sees the standing wall, never the standing-up).

## §3 Scene mechanics (the landmines, handled)

| Mechanic | Spec |
|---|---|
| Perspective | Scene wrapper inside sidebar: `perspective: 1100px; perspective-origin: 50% 40%`. |
| Pose | Wall element: `transform: rotateX(9deg) rotateY(∓7deg)`; **sign mirrors side preference** — near edge always faces the main column (left-placed → rotateY(−7°); right-placed → rotateY(+7°); exact signs verified visually at implementation, one-line fix if inverted). `rotateX` never mirrors. Breakpoints per GOLD-3D: 768–1023 → 7°/∓5°; <768 → 4°/∓4°. |
| Flattening trap | `overflow ≠ visible` forces `transform-style: flat` on that element — the sidebar's `overflow-y-auto` must **never** sit between scene and wall. Structure: sidebar (overflow-auto) → scene wrapper (perspective) → wall. The wall's 3D is self-contained in its subtree; safe. Census verifies no transformed/filtered ancestor wraps the scene (a transformed ancestor also breaks `position: sticky` — another reason the scene lives *inside* the sticky sidebar, never on it). |
| Projected overflow | rotateX grows the projected silhouette past the layout box. The sidebar scroll container would clip/scrollbar it → **scene inset**: `padding: 12px 16px 28px` reserves room; bottom padding also hosts the reflection. No negative margins, no `overflow-x` games. |
| Reflection | Floor reflection ≤6%: **gradient fallback chosen** (token-grey radial under the wall's base edge) — a mirrored-copy layer doubles compositing cost for a 6% effect. R-63 amendment to the 21st.dev adaptation (which kept mirrored reflection): gradient unless Hands proves the copy layer free. |
| Specular | Static resting sheen ≤8% (a diagonal token-white gradient, opacity-capped). During the turn only, a brighter band translates across (one-shot). Never animates again. |
| Bevel | Two 1px hairlines on the wall's frame (top/left lighter token, bottom/right darker token) — the only "thickness" cue that's layout, visible flat and in pose. |

## §4 Steady-state interaction

- **Cursor tilt:** pointer over scene → pose ±4° (x from pointer-y, y from pointer-x), 140ms design.md transition, driven by two CSS custom properties set on pointermove (no rAF, no loop); pointer leave → returns to pose. Disabled during entrance and under RM (static pose).
- **Wheel:** NEVER hijacked — wheel over the wall scrolls the page/sidebar normally (GOLD-3D invariant).
- **Everything else:** inert. The wall is furniture after 600ms — beautiful, still furniture.

## §5 Performance & GPU discipline

| Rule | Spec |
|---|---|
| Layers | ONE composited layer (the wall). Reflection = gradient paint (not a layer). Dots are children — no per-dot layers (no individual `will-change`). |
| `will-change` lifecycle | `will-change: transform` on the wall **only during entrance + cursor-hover windows**; removed on settle/leave. Never parked. |
| Frame budget | 600ms one-shot at 60fps = ~36 frames of one rotated layer — trivial for GPU. Software-GL risk (F-2 S-5 pending) noted: **dev-only check** — if the entrance drops frames in the dev harness, fallback = instant-pose (same as RM). No shipped runtime detection. |
| Steady state | Zero rAF, zero loops, zero per-frame cost (static transform). Lighter than any animated background the app has ever had. |
| Containment | Scene wrapper: `contain: layout paint`. |

## §6 Layout (v1 carried, now wall-integrated)

As ruled: LifePage gold wrapper loses its cap; GoldPage root `w-full max-w-[1600px] mx-auto`; flex `[CalendarSidebar, main]`, `lg:flex-row` / flip by preference (`row-reverse`), stacked below `lg` (calendar above, never buried); sidebar `lg:w-1/3 min-w-[320px] max-w-[480px]`, `lg:sticky lg:top-5 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto`; main `min-w-0 flex-1`, sections in ruled order with ScheduleSyncCard/DeadlinesCard moved after ScheduleCard; four reflection/river sections full-width below (the sidebar's parent box ends there — sticky releases naturally). Side preference in the **preference store** (`gold_calendar_side`, default `right`, corrupt→right), toggle pair (`PanelLeft`/`PanelRight`) in the sidebar header strip, 28px radius-6 token buttons, focus-visible outlines. Flip is **instant** — it never replays the entrance.

**Integration note:** the wall's scene sits inside the sticky sidebar as its first child; the header strip stays flat chrome above the scene (never 3D).

## §7 Component & state spec

| Piece | Spec |
|---|---|
| `CalendarSidebar.tsx` (new) | header strip (label + toggle pair) → scene wrapper (§3) → `MonthWall` (props **byte-identical**, frozen R-60) → `CalendarStrip` (props byte-identical). Owns: `side` state, session one-shot flag (module ref), entrance orchestration (adds/removes `will-change`, drives the 600ms via CSS transition on the wall's transform — class swap, not JS animation loop). |
| `MonthWall.tsx` | **frozen** — zero edits. Entrance is applied by the wrapper around it. (If census finds the transform must live on MonthWall's root, wrapper applies via a child selector or a single className prop pass — census decides, report.) |
| State | `type CalendarSide = 'left' | 'right'`; preference-store read on mount (validated), write on toggle. Entrance flag: `let playedThisSession = false` module-scope. |
| Chrome | header strip + toggle: monochrome tokens, radius 6, 140ms color transitions, 2px focus-visible outlines. **No amber in new chrome** (amber stays conditional on census verdict; this design needs none). |

## §8 4-State coverage

Loading → scene reserves wall height (census-measured min-height +28px reflection pad), CalendarStrip skeleton bars — **zero layout jump when data lands** (the turn runs on the reserved box, data-independent). Empty → MonthWall's own empty state, standing in pose. Error → DeadlinesCard/ScheduleSyncCard render their own error bands in main; wall is static-safe. Populated → full §2–§4.

## §9 Testable interactions

1. First app open → Gold tab: flat 80ms → standing turn 520ms → pose locked, no further self-motion. 2. Tab away + back: wall at pose, **no replay**. 3. App restart: replays once. 4. Side toggle: instant mirror (pose sign flips, no animation, state preserved). 5. Restart: side restored; corrupt value → right. 6. Cursor over wall: ±4° answer, 140ms; leave: return. 7. Wheel over wall: page scrolls. 8. Scroll main: sidebar pins at `top-5`, internal scroll when wall exceeds viewport, releases cleanly before ReflectionCard. 9. Day select from sidebar strip drives main column. 10. Breakpoints: ≥1024 sticky ⅓ · 768–1023 stacked, reduced pose · <768 single column, minimal pose.

## §10 Acceptance criteria + gates

**G-GL-1…8 inherited verbatim from v1** (census, build via `node scripts/build.mjs` with rm -rf dist FIRST, tsc delta 0, LAMINAR greps incl. zero new localStorage keys, 4-state proof, shell-launch §3-5 screenshots, persistence proof, hygiene → `feat: gold page full-width calendar sidebar (GOLD-LAYOUT)`). **Plus:**

| Gate | Proof |
|---|---|
| G-3D-1 Choreography frames | Screenshots at t≈0 (flat), t≈300 (mid-turn), t≥600 (pose) from the shell-launch run — three distinct states, correct ordering. |
| G-3D-2 One-shot | Second mount in same session renders at pose with no transition class present (grep/DOM proof). |
| G-3D-3 Steady-state silence | rAF counter over 5s idle = 0 increments post-entrance; `will-change` absent from computed style at rest. |
| G-3D-4 Mirror | Both side preferences screenshotted — near edge faces content in both. |
| G-3D-5 RM | `prefers-reduced-motion` run: pose + reflection at final values at first paint, no transition. |

## §11 Blocking census for Hands

1. v1 census items (3 root causes at HEAD, preference API pattern, sticky-header offset, loading flag, wall height) **plus**: 2. design.md easing token name; 3. MonthWall root transform ownership (wrapper vs className pass); 4. no transformed/filtered ancestors above the sidebar (sticky/3D integrity); 5. rotateY sign truth against the mirror rule; 6. slop baseline (v1 item) extended with will-change census.

## §12 Questions

None. Pre-staged: perspective 1100px, hold 80/turn 520, reflection-as-gradient, session-scope replay, rotateY sign fixed visually at implementation.

**Override rows:** A: replay every Gold-tab mount (vs per-session, default) · B: mirrored-copy reflection (vs gradient default) if you want the true flipped reflection · C: pose angle up (9°/7° → 12°/9°) for more drama (against rec — subtlety is the instrument).

```
Status (verbatim):
Directive compliance   DELIVERED — orchestrator produced the RESULT directly; 3D entrance designed as default opening; depth raised per order.
§8-2                   CLOSED — resolved by directive: GOLD-3D merges into GOLD-LAYOUT, one wave; GO Phases 2–7 queue behind.
RESULT.md v2           DELIVERED — supersedes v1: concept, 600ms turn choreography (table), scene mechanics incl. 4 CSS landmines handled, steady-state pose/tilt, GPU discipline (one layer, will-change lifecycle, software-GL fallback), full layout integration, component/state spec, 4 states, 10 testable interactions, gates G-GL-1..8 + G-3D-1..5, census §11, zero open questions.
Implementation         NOT EXECUTED — no shell/repo access; Hands implements from this spec; gate reports return here for ruling.
Waiting on             Hands pickup (census §11 first) · override rows A–C optional (replay scope / reflection style / pose drama) · §8 remainder unchanged.
```
