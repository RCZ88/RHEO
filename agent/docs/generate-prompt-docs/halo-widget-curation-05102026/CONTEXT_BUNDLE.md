# CONTEXT BUNDLE — Halo Island Widget Curation

> **Target AI: you have no access to this codebase.** Everything you need to make the
> curation decision is in this file. Source is quoted verbatim with file paths and line
> ranges. Do not ask for files — if something is genuinely missing it is flagged
> `[NEEDS CONFIRMATION]` rather than omitted.

**Generated:** 2026-10-05 · **Repo:** App Tracker / RHEO (Electron + React + better-sqlite3)
**Companion spec:** `agent/docs/HALO_ISLAND.md` (4,195 lines) — the Halo build spec
**This bundle's job:** the spec defines *how* the island behaves. It does **not** define
*which features live on it*. That curation decision is unmade. You are making it.

---

## 1. THE SITUATION, HONESTLY

A Halo/Dynamic-Island surface is built and running. It currently renders **two**
activities: `stopwatch` (the hero) and `dictation` (the mic).

The activity **vocabulary already exists** — 17 `ActivityKind` values, a full priority
table, and a router. They were written for a larger island than the one that shipped.
So this is **not** a greenfield "what should we show" question. It is:

> Of the 15 activities already typed and ranked but never given a slot, which earn one —
> and what is the slot model that lets more than one thing exist at once?

**The reason only two shipped is structural, not aesthetic:** `PRIORITY` selects exactly
**one** winner (`byPriorityThenAge` sorts, the router takes the head). There is no
compositing, no slot assignment, and no carousel. A "widget layer" has nowhere to live
until you specify one. **Specifying that slot model is the single most valuable thing
you can produce.**

---

## 2. WHAT ALREADY EXISTS — THE CANDIDATE MENU

### 2.1 The 17 activity kinds — `src/shared/halo/types.ts` (lines 56–73)

```ts
export type ActivityKind =
  // ── RHEO ────────────────────────────────────────────────────────────────
  | 'stopwatch'
  | 'dictation'
  | 'focus'
  | 'afkGap'
  | 'now'
  | 'tierBreakdown'
  | 'nextDeadline'
  | 'pinnedActivity'
  | 'clock'
  // ── generic HALO §4 ─────────────────────────────────────────────────────
  | 'liveActivity'
  | 'hud'
  | 'critical'
  | 'download'
  | 'battery'
  | 'aiUsage'
  | 'clipboard'
  | 'custom';
```

**9 RHEO-native** (first block) — these are DeskFlow's own vocabulary.
**8 generic** (second block) — HALO §4's portable kinds, kept so a future port does not
re-invent the envelope. Several (`battery`, `download`) are **desktop-OS concerns that do
not apply to a Linux/Wayland Electron app** and are listed here as candidates precisely so
you can reject them with a reason.

### 2.2 The priority table — `src/shared/halo/activityPriority.ts` (lines 11–24)

```ts
export const PRIORITY = {
  pinnedUserInteraction: 1000,
  criticalError: 900,
  directUserFeedback: 800,
  recording: 750,
  focusCountdown: 600,
  stopwatchRunning: 500,
  afkGap: 450,
  nowApp: 350,
  pinnedActivity: 300,
  tierBreakdown: 250,
  nextDeadline: 200,
  clock: 100,
} as const;
```

### 2.3 Hero + persistence — `activityPriority.ts` (lines 26–27, 73–83)

```ts
/** Which activity owns the expanded surface when nothing louder is happening. */
export const HERO_KIND: ActivityKind = 'stopwatch';

export function isPersistentKind(kind: ActivityKind): boolean {
  return (
    kind === 'stopwatch' ||
    kind === 'focus' ||
    kind === 'clock' ||
    kind === 'now' ||
    kind === 'tierBreakdown' ||
    kind === 'pinnedActivity' ||
    kind === 'nextDeadline'
  );
}
```

**Note the latent conflict:** `stopwatch` is BOTH `HERO_KIND` AND ranked `500`. The
comment at lines 65–71 explains why — *"Priority is an interruption policy, and a
stopwatch does not interrupt anything — it accumulates."* So the hero is expressed by
**identity**, not priority. Any slot model you design must respect that separation:
a persistent hero and an interrupting toast are **different lanes**, and priority must
never be allowed to evict the hero.

### 2.4 The activity envelope — `src/shared/halo/types.ts` (lines 136–152)

```ts
export interface IslandActivity<P = unknown> {
  /**
   * Stable identity. HALO §4 is emphatic that a new id must NOT be minted per
   * update — `layoutId` transitions and queue replacement both key off this.
   */
  id: string;
  kind: ActivityKind;
  priority: number;
  /** Persistent activities are never expired and never dropped as a toast. */
  persistent: boolean;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  replaceGroup?: string;
  minimumDisplayMs?: number;
  payload: P;
}
```

`minimumDisplayMs` already exists and is **never used by any publisher today** — it is
the hook a carousel needs (a card must not be yanked mid-read). Use it.

### 2.5 ID stability helper — `activityPriority.ts` (lines 91–93)

```ts
export function stableId(kind: ActivityKind, discriminator = 'default'): string {
  return `${kind}:${discriminator}`;
}
```

The comment (lines 85–90) is a scar: *"a random uuid per tick is the single most common
way this subsystem breaks."* Any activity you promote must derive its id here.

---

## 3. THE GEOMETRY BUDGET — the hard constraint

### 3.1 Canvas is fixed and never resizes — `src/shared/halo/geometry.ts` (lines 12–21)

```ts
export const MAX_CANVAS_WIDTH = 520;
export const MAX_CANVAS_HEIGHT = 300;
export const MIN_CANVAS_WIDTH = 360;
export const MIN_CANVAS_HEIGHT = 120;

/** HALO §73 expanded width classes. */
export const EXPANDED_WIDTH_SM = 360;
export const EXPANDED_WIDTH_MD = 460;
export const EXPANDED_WIDTH_LG = 520;
```

The comment (lines 4–11) explains why it is **not** the spec's suggested 760×460:

> *"A 760x460 transparent window is a large always-on-top surface for a small panel,
> which costs compositor resources and enlarges the click-through region if the
> transparent-window guard ever fails."*

**Design consequence:** the OS window is a fixed **520×300** budget. Everything you
design must fit inside it. A "widget grid" cannot exceed that.

### 3.2 Compact size — `geometry.ts` (line 41)

```ts
/** HALO §162: hardcoded resolutions are banned as identification. Nothing here
 * compares a display to a magic number — every value is measured or derived. */
const NOTCHLESS_COMPACT: Size = { width: 232, height: 40 };
```

**Compact is 232×40.** That is roughly **6–8 glyphs plus an icon** at readable size. It
cannot hold a dashboard widget. Compact is a *status pip + label + value*, not a card.

### 3.3 Edges — `src/shared/halo/types.ts` (line 24)

```ts
export type OverlayEdge = 'top' | 'left' | 'right';
```

`'top'` is the implemented anchor. `'left'` and `'right'` are **typed but never
implemented** — no placement code branches on them. Left/right are for the future.

### 3.4 Hover FSM — `src/shared/halo/hoverMachine.ts`

```ts
// line 35
export type HoverIntent = 'open' | 'close' | 'none';
// lines 132-133
export const HOVER_POLL_IDLE_MS = 120;
export const HOVER_POLL_EXPANDED_MS = 40;
```

`stepHover()` (line 67) drives `idle → expanding → expanded → collapsing`. The island
expands on pointer entering a hot zone above the window, and collapses on leave.
**Any carousel must survive pointer-exit mid-rotation** — leave alone means collapse
means the rotation stops.

---

## 4. THE APP'S FEATURE INVENTORY — what could be promoted

DeskFlow has **14 top-level routes**. This is the full menu an activity could summarize.

| Route | Purpose | Halo-promotable? *(your call — justify it)* |
|---|---|---|
| `/` | Dashboard — hero stopwatch, solar-system modal, widget host | already the hero |
| `/activity` | Logs / session timeline | maybe — see `/penguin-console` |
| `/ide` | IDE Projects | no — full-screen work surface |
| `/ai` | AI assistant deck | see `aiUsage` kind |
| `/reports` | Insights / reports | no — retrospective, not ambient |
| `/life` | Life page — 7 tabs incl. **Notes** | **yes — `nextDeadline` lives here** |
| `/finance` | Finance / money | no — sensitive, glanceable elsewhere |
| `/resume` | Resume / CV | no — editing surface |
| `/settings` | Settings / config | no — Halo has its own prefs now |
| `/studio` | Overlay Studio / Content Engine | no — deep modal pipeline |
| `/learn` | Lyceum — lessons, mastery, streaks | maybe — has a due-count + streak |
| `/lecture` | Lecture | no |
| `/penguin-console` | Terminal workspace — sessions, handbook | maybe — active session count |
| `/terminal` | Terminal sub-tabs | maybe — same |

### 4.1 The 8 existing dashboard widgets — real IPC channels

From `agent/docs/generate-prompt-docs/dashboard-widgets-22092026/RESULT_widgets.md`
(lines 23–44). **These are the highest-value candidates** because their data contracts
and IPC channels are already specified and partially verified.

| ID | Source | IPC channel(s) | Renders |
|---|---|---|---|
| `ai-usage` | AiPage | `get-ai-stats` + `get-model-usage` | Top model, tokens today, session count |
| `console-widget` | /penguin-console | `get-terminal-stats`, `get-handbook-progress` | Command count, active sessions, handbook % |
| `finance-widget` | FinancePage | `get-finance-summary`, `get-wallets` | Total balance, txn count, 7-day net |
| `learn-widget` | Lyceum | `get-learn-stats`, `get-mastery-levels` | Due-count, mastery %, streak, next lesson |
| `browser-widget` | BrowserActivityPage | `get-browser-stats`, `get-website-stats` | Top sites, category split, tracking-state dot |
| `brain-widget` | Context Brain | `get-brain-stats`, `get-graph-stats` | Node count, density, retrievals today |
| `covenant-widget` | CovenantPage | `get-covenant-stats`, `get-commitments` | Active count, completion %, next due |
| `health-widget` | External/sleep | `get-sleep-summary`, `get-health-stats` | Last-night hours, consistency %, gap count |

> `[NEEDS CONFIRMATION]` The source table marks these payload shapes
> `FILL FROM DUMP` — i.e. the shapes above are **intended, not verified**. Before you
> design a widget around one, state whether it can be trusted, or require verification.

### 4.2 The mandatory 4-state matrix — verbatim, already litigated

> **Empty ≠ zero everywhere:** "no sessions" renders the explicit string, never `0`
> where the count is unknown; a true zero renders `0`.
> - **Loading:** skeleton matching content shape (shimmer-free; static placeholder blocks).
> - **Empty:** explicit sentence ("No AI sessions yet"), styled as data state, not an error.
> - **Error:** message + retry `Button`; the widget never silently renders empty on failure.
> - **Populated:** full spec.

**This rule has already been paid for in blood this cycle.** The Halo stopwatch shipped a
fixture; the honest version renders `No app detected` and `0:00:00` rather than a
plausible-looking fake. **Every activity you promote inherits this rule.**

### 4.3 Already-rejected — do not re-propose

From `RESULT_widgets.md` lines 130–143:

| Item | Verdict |
|---|---|
| `magic-card`, `particle-button`, `BorderBeam`, `NumberTicker` | **REJECTED** — MCP slop / loop-adjacent motion |
| Glass chrome (`backdrop-blur-xl`) | **REJECTED** — LAMINAR solid-surface law |
| `whileHover={{scale:1.02}}` | **REJECTED** — hover-scale banned; hairline brightening only |
| Animated counters, spring easing, decorative gradients | **REJECTED** — motion law |
| New IPC handlers / `main.ts` edits | **OUT OF SCOPE** — claims the P0 file; report gaps instead |
| localStorage `dashboard_layout` | **VOID** — use the preference store |

---

## 5. DESIGN CONSTRAINTS — LAMINAR (overrides all other styling guidance)

### 5.1 Tokens — `src/index.css` (lines 20–27, 113–176, sampled)

```css
--color-clay-300: #f0a892;   --color-clay-400: #e8866b;
--color-clay-500: #d96846;   --color-clay-600: #c2553a;
--color-sage-400: #6fb38f;   --color-amber-400: #fbbf24;
--color-sky-400:  #5ab0c9;   --color-glow: #f7f3ee;

--text-primary: #1c1917;  --text-secondary: #44403c;
--text-muted:   #57534e;  --text-faint:     #6f665e;

--bg-primary: #f5f2ec;    --bg-secondary: #edeae2;
--accent-primary: #0e7490; --accent-hover:  #155e75;
--border-default: rgb(28 25 23 / 0.10);
--border-strong:  rgb(28 25 23 / 0.20);
```

### 5.2 Island-local tokens — `src/features/halo/halo.css` (lines 29–38)

```css
--halo-surface: color-mix(in srgb, var(--ws-surface) 97%, transparent);
--halo-shadow: 0 12px 36px rgb(0 0 0 / 0.32);
--halo-signal: var(--color-amber-400);   /* TIME domain */
--halo-focus:  var(--color-clay-400);    /* SPEECH domain */
--halo-track:  var(--ws-surface-raised);
--halo-hairline: var(--ws-border);
```

**Domain → colour is already assigned:** amber = time, clay = speech. Any new activity
must either join an existing domain or justify a new hue *within* the token set. One
signal hue per surface.

### 5.3 The binding design laws

- **`design/design.md` (LAMINAR) overrides the HALO spec** where they conflict — notably
  the HALO spec's spring guidance. **No spring. No bounce.** This was resolved in favour
  of LAMINAR and is settled.
- Radii: **8 / 12 / pill only.** No larger.
- Fonts: **Inter + JetBrains Mono + Space Grotesk, max 2 per view.**
- Max 2 font families visible in the expanded island.
- No glassmorphism on chrome. No decorative glow or gradient.
- `prefers-reduced-motion` honoured — `IslandState.reducedMotion` already exists in the
  type (types.ts, IslandState).
- Time domain uses a monospaced tabular numeral; seconds are **de-emphasised**, not equal
  weight to hours.
- The expanded stopwatch ports the dashboard's `StatusBand` language: an SVG
  productive-share ring, 28px mono numeral, tier chips, rounded tier swatch.

---

## 6. PLATFORM FACTS THAT KILL NAIVE DESIGNS

This box is **native Wayland (KDE Plasma, Fedora 44)**; `DISPLAY=:0` is XWayland.
Consequences already paid for:

1. **`transparent: true` is required and sufficient** — but an earlier
   `transparent: !isLinux` guard produced an **opaque 760×460 black rectangle** because
   Chromium ignores `#00000000` when `transparent` is false. Both flags are now set:
   `transparent: true` **and** `backgroundColor: '#00000000'`.
2. **Launch must force X11**: `ELECTRON_OZONE_PLATFORM_HINT=x11` is in the npm `start`
   script. Setting it in renderer JS is **too late** — it must be in the environment
   before Electron boots.
3. **Programmatic window position, always-on-top, and cursor position are unreliable
   under native Wayland.** A placement guard now rejects a window displaced >24px from
   its computed rect and logs to `~/.config/RHEO/halo-diagnostic.log`.
4. **A transparent window enlarges the click-through region if the guard ever fails** —
   this is why the canvas was shrunk to 520×300. Do not propose a larger canvas.
5. **`powerMonitor.getSystemIdleTime()` returns 0 on Linux** and is unusable. AFK/idle
   features must consume the `tracking-heartbeat` payload instead. Any "idle detection"
   activity you propose must use the heartbeat path.

---

## 7. THE STOPS — mechanics already built, do not redesign

- **Compact: 232×40.** Expanded: 360 / 460 / 520 wide.
- **Expands on hover** via a hot zone above the window; polls at 120ms idle, 40ms expanded.
- **Persistent hero** vs **interrupting toast** are separate lanes (see §2.3).
- `minimumDisplayMs` is available and unused — the carousel's anti-yank hook.
- `replaceGroup` coalesces bursts of the same logical thing into one activity.
- Settings already exist: enable/disable + size scale `0.7×`–`1.6×`, persisted via a
  preference key. **The Halo has its own settings; it is not part of `/settings` nav.**

---

## 8. WHAT YOU MUST PRODUCE

Ten deliverables. Be decisive — see the mandate in `PROMPT.md`.

1. **Slot model** — how many activities coexist, in which zones, and what evicts what.
2. **Promotion verdict per kind** — all 17, each with keep / promote / reject + one-line reason.
3. **Compact vs expanded spec per promoted kind** — what each shows at 232×40 vs expanded.
4. **Rotation & dwell** — idle carousel membership, dwell times, interrupt precedence.
5. **Zone assignment** — center / left / right per kind, noting left+right are unimplemented.
6. **Click-through contract per kind** — expand / toggle / dismiss / route (to which route).
7. **Pinning UX** — what `pinnedActivity` means and how a user pins.
8. **Honest-empty spec per kind** — the exact string when data is missing.
9. **Backend audit** — for each promoted kind: IPC channel, real or stub or absent.
10. **Reject list with reasons** — including app features kept off the island.

---

## 9. FILE PATHS (for the implementation phase, not for you to read)

```
src/shared/halo/types.ts               activity vocabulary + envelopes
src/shared/halo/activityPriority.ts    PRIORITY, HERO_KIND, isPersistentKind, stableId
src/shared/halo/activityRouter.ts      routing / selection
src/shared/halo/geometry.ts            canvas + compact/expanded sizes
src/shared/halo/hoverMachine.ts        expand/collapse FSM
src/shared/halo/stopwatchRelay.ts      stopwatch payload validation (UNWIRED)
src/features/halo/OverlayRoot.tsx      renderer host
src/features/halo/StopwatchHero.tsx    the hero surface
src/features/halo/DictationIsland.tsx  mic owner (sole useSttFloat caller)
src/features/halo/halo.css             island-local tokens
src/features/halo/HaloPreferences.ts   typed prefs
src/main/halo/haloIsland.ts            window, placement, IPC, diagnostics
agent/docs/HALO_ISLAND.md               the build spec (4195 lines)
agent/docs/generate-prompt-docs/dashboard-widgets-22092026/RESULT_widgets.md   widget inventory
```