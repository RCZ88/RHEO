# CONTEXT_BUNDLE — Halo Island

> Self-contained. The receiving AI has **no access to this codebase**. Every claim below is
> quoted from real files with line numbers. Where a value is measured rather than designed, it is
> marked MEASURED.

---

## 0. THE ENVIRONMENT (this is the constraint that breaks everything)

```
XDG_SESSION_TYPE=wayland        ← NATIVE WAYLAND, not X11
WAYLAND_DISPLAY=wayland-0
XDG_CURRENT_DESKTOP=KDE         ← Plasma 6 / KWin, Fedora 44, kernel 6.x
DISPLAY=:0                      ← XWayland IS available (tier B in the spec)
Node v26 · Electron 41.10.7 · Vite 7.3.6 · React 19.2.4 · motion 12.42.2 · Tailwind v4.2.1
```

**Electron on native Wayland does NOT reliably support programmatic window position,
`alwaysOnTop`, or `screen.getCursorScreenPoint()`.** This is why the island opened in the *middle*
of the screen: the `x`/`y` passed to the `BrowserWindow` constructor were silently ignored, which
also dragged the hover hot zone to the middle of the screen.

**MEASURED proof the app runs on native Wayland:**
```
$ wmctrl -l
0x01400007  0 czFedora888  Wayland to X Recording bridge — Xwayland Video Bridge
```
One window. RHEO's own windows are absent → they are not X11 windows.

**MEASURED proof `ELECTRON_OZONE_PLATFORM_HINT` set from JS is too late:**
the hint must be present in the process environment **before Electron bootstraps its Ozone
backend**, which happens during process startup. Assigning `process.env.ELECTRON_OZONE_PLATFORM_HINT`
from a module-scope line in `main.ts` runs *after* that decision and has no effect.

---

## 1. WHAT THE HALO IS (spec: `agent/docs/HALO_ISLAND.md`, 4195 lines)

A macOS Dynamic-Island-style always-on-top surface at the top-centre of the screen, which expands
on hover. Five non-negotiable architectural rules that constrain every design decision:

1. **Never animate by resizing the native window.** The window is a FIXED transparent canvas; React
   + Motion draw and animate inside it. (`RULE_1`, spec §10)
2. **React never touches Electron.** A preload bridge is the only channel. (`RULE_2`, §42)
3. **React state is never the frame clock.** High-frequency visuals use MotionValue / CSS
   animation / rAF. (`RULE_3`, §101)
4. **Linux must be capability-detected.** Native Wayland ≠ X11. (`RULE_4`, §36)
5. **The overlay is optional.** Its failure must never crash or block the app. (`RULE_5`, §145)

Fixed canvas (spec §9): max 760×460, min 360×120, clamped to the display.
Hot zone (spec §49) is the visible compact pill + a ~28px strip — **never the whole canvas**.
Position (spec §16): `y = display.bounds.y`, **not** `workArea.y` — the island intentionally
occupies the menu-bar strip.

---

## 2. FILE MAP — what exists (all verified present unless marked otherwise)

```
halo.html                                  ENTRY HTML (mirrors the deleted stt-panel.html)
src/halo.tsx                               React root for the island window
src/features/halo/OverlayRoot.tsx          the shell; owns compact<->expanded + hover intent
src/features/halo/StopwatchHero.tsx        the hero activity (numeral + split bar)
src/features/halo/DictationIsland.tsx      IMPURE container; owns useSttFloat (the microphone)
src/features/halo/DictationActivity.tsx    PURE component; opens no mic, browser-testable
src/features/halo/halo.css                shell/layout only; colours derived from index.css
src/shared/halo/geometry.ts                PURE display+hot-zone math
src/shared/halo/hoverMachine.ts            PURE hover intent FSM
src/shared/halo/activityRouter.ts          PURE bounded activity queue
src/shared/halo/activityPriority.ts        priority table
src/shared/halo/types.ts                   domain model
src/shared/halo/stopwatchRelay.ts          IPC payload validation (main + renderer share it)
src/main/halo/haloIsland.ts                MAIN-PROCESS OWNER: window, hover polling, IPC
vite.config.ts                             3rd rollup entry: index / halo  (stt-panel REMOVED)
tsconfig.halo.json                         scoped typecheck config ("files", not "include")
```

**`src/shared/halo/` is not cosmetic.** `scripts/build.mjs:158-165` pre-compiles only
`src/{services,domains,lib,shared,main}` for the main process. The renderer reaches `shared/` via
the `@` alias. So **anything the main process and the renderer both need must live in
`src/shared/`.** An earlier attempt put the core in `src/features/halo/core/`, which the main
process physically cannot import.

---

## 3. THE FIVE DEFECTS THAT MUST BE FIXED

### 3.1 CRITICAL — React error #321 crashed the entire main app

**MEASURED** user report: `Minified React error #321` → *"Invalid hook call. Hooks can only be
called inside of the body of a function component."* Stack: `useRef` ← `commitHookEffectListMount`.

Root cause, `src/App.tsx` (inside `App.tsx`'s activity-listener effect, previously line 2395):

```tsx
useEffect(() => {
  isMountedRef.current = true;
  /**
   * Mouse MOVEMENT only counts when the pointer genuinely moved. ...
   */
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);   // ← ILLEGAL
  const POINTER_MOVE_MIN_PX = 3;
  const handlePointerMove = (e: MouseEvent) => { ... };
```

`useRef` inside `useEffect` throws. It is also semantically wrong even if tolerated: a fresh ref
per effect run means the stationary-cursor filter resets instead of remembering.

**Fix applied:** hoisted to component scope beside `isMountedRef` (`App.tsx:2178`), keeping the
AFK intent intact. A scanner now reports **0 nested hook calls across 506 files**.

### 3.2 CRITICAL — the window opens in the centre of the screen

Native Wayland ignores the constructor `x`/`y`. Both the window AND its hot zone end up centred,
so hover only responds over the middle of the screen. This single defect explains the user's
"it launches in the centre" and "only reacts when I hover the centre".

**Fixes required:**
- (a) put `ELECTRON_OZONE_PLATFORM_HINT=x11` in the **launch environment**, not in JS:
  `"start": "cross-env ELECTRON_OZONE_PLATFORM_HINT=x11 electron ."` with
  `"start:wayland": "electron ."` as the revert path. (`cross-env` is already a dependency.)
- (b) **verify placement and refuse to show a wrong one** (spec §39: "Do not show: mispositioned
  island, offscreen island"). After creation, read back `win.getBounds()`; if it differs from the
  intended rect by more than ~24px, log it, destroy the window and return `null`.
- (c) if XWayland is unavailable, degrade per spec §37 tier C to an in-app surface or a system
  notification. **Never leave a visibly broken overlay running.**

### 3.3 HIGH — `transparent` is not safe on this box

`src/domains/focus/focusManager.ts:233` already learned this the hard way:
```ts
transparent: !isLinux,   // comment: "Linux/Wayland compositors often render transparent
                         //  fullscreen windows as opaque black or refuse them outright"
```
The deleted STT panel hardcoded `transparent: true` and was therefore suspect. The island adopts
the guard. **Open question for the designer:** on Linux the island window is opaque — what is the
correct surface treatment when there is no transparency?

### 3.4 HIGH — the stopwatch is not connected; the island shows placeholder data

`src/lib/stopwatchStore.ts` is a **renderer-realm singleton** persisted to
`localStorage['rheo-stopwatch-v1']`. The island is a **second BrowserWindow = a second JS realm**
with its own module instance and storage partition. Importing the store into the island would
hydrate a competing copy and overwrite the real window's totals.

Verified: `grep -rn stopwatchStore src/features/halo src/shared/halo src/main/halo` matches **only
`formatStopwatch`** (the single `HH:MM:SS` formatter) — the DATA never crosses. `main.ts` sends
`stopwatch: null`.

**Snapshot shape** (`src/lib/stopwatchStore.ts:76-93`):
```ts
export interface StopwatchSnapshot {
  productiveMs: number;      // MILLISECONDS
  distractingMs: number;
  paused: boolean;           // NOTE: there is no `running` field; paused is the inverse
  activeTier: 'productive' | 'neutral' | 'distracting';
  displayMs: number;         // THE number every surface shows
  displaySource: 'external' | 'productive' | 'distracting' | 'idle';
  resetCount: number;
  externalLabel: string;
}
```

**The non-obvious invariants a designer MUST respect:**
- **ONE field, ONE formatter.** `formatStopwatch(ms)` at `stopwatchStore.ts:58` is the only
  `HH:MM:SS` formatter in the codebase. A second one is how the sidebar and dashboard once
  desynchronised (CZ's literal complaint: *"the sidebar resets the stopwatch for no reason"*).
- **The totals are NOT monotonic.** They can be zeroed by `stopwatch.reset()`,
  `resetAfterAfkFill()`, an AFK policy of `reset-stopwatch`/`reset-both`, day rollover, or
  `neutral` tier + `neutralAction: 'reset'`. `resetCount` is the only reliable "a real reset
  happened" signal.
- **AFK freezes the clock WITHOUT setting `paused`.** `liveSegment()` returns 0 past the idle
  threshold, so a frozen readout is indistinguishable from a broken one unless the UI states it.
- **1Hz republish, module-scope** (`stopwatchStore.ts:486-493`), started once from `App.tsx:477`.
  `getSnapshot()` is wall-clock derived, so it **lags real time by up to ~1s**.
- The relay must preserve all of the above. A snapshot crossing a process boundary needs
  `awaySince` (or an equivalent) so the island can distinguish "frozen by AFK" from "broken".

### 3.5 MEDIUM — dictation: the panel was deleted, the island owns the mic

The standalone bottom-right dictation panel (`createSttPanel`, `stt:panel-*` IPC,
`stt-panel.html`) was **removed** once the island took over. Backup:
`agent/backups/20261005-141013-stt-panel-removal-pre/` (7 files, 1.6 MB).

- `Ctrl/Cmd+Shift+V` → island toggle. `Ctrl/Cmd+Shift+R` → `sendHaloCommand('toggle-record')`.
- `useSttFloat` (`src/hooks/useSttFloat.ts`) has **exactly one consumer**:
  `src/features/halo/DictationIsland.tsx`. One window may own the mic; two `MediaRecorder`s on one
  device break dictation.
- `interim` is **EMPTY on the faster-whisper path** — transcription is batch-on-stop. The only real
  mid-utterance signal is the RMS `level` from an `AnalyserNode`. **So the waveform, not the text,
  is the hero visual.**
- The meter must be driven by a ref → CSS custom property (24 samples/sec must not be 24 React
  commits/sec; spec §101/§102).

---

## 4. DESIGN CONSTRAINTS — `design/design.md` (LAMINAR) OUTRANKS THE HALO SPEC

Read these literally; they are an enforceable contract, not suggestions.

| Rule | Value |
|---|---|
| §2 signal hue | **amber `#fbbf24` for TIME-domain surfaces**; pink/clay for Focus/brand; emerald success-only; rose destructive-only. One hue per surface. |
| §3 fonts | Inter + JetBrains Mono (+ Space Grotesk). **Max 2 families per view.** |
| §4 radii | `8px` · `12px` (card, MAX) · `9999px` (pill). **`rounded-2xl`/`rounded-3xl` BANNED.** |
| §6 motion | Easing `--ease-out-expo cubic-bezier(.19,1,.22,1)` or `cubic-bezier(.16,1,.3,1)`. Durations 150/250/400ms. **No spring overshoot.** No decorative infinite loops (functional loops allowed: recording dot, voice meter). Honour `prefers-reduced-motion`. |
| §7 blacklist | No decorative chrome gradient · no 2 signal hues on a surface · **no `backdrop-blur` glassmorphism on chrome** · no spring/bounce · no emoji as icons · **no neon glow** · **no raw hex/rgba inside a `.tsx`** · no mixed icon sets · no per-component bespoke shadow/radius/border. |

**CONFLICT, already resolved:** the HALO spec §64 mandates springs
(`stiffness: 480, damping: 36`) and §65 targets 280–350ms. LAMINAR §7.4 bans springs and
`design.md` outranks the spec → **duration easing, no springs.** Current open timing:
`{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }`.

**Live tokens** (read from `src/index.css` — never copy a palette from prose):
`--ws-surface #09090b` · `--ws-surface-raised #18181b` · `--ws-border rgb(39 39 42/.6)` ·
`--text-primary #fafafa` · `--text-secondary #a1a1aa` · `--text-muted #71717a` ·
`--text-disabled #52525b` (**`--text-faint` exists ONLY in the light block — do not use it**) ·
`--tier-productive #22c55e` · `--tier-neutral #3b82f6` · `--tier-distracting #ef4444` ·
`--color-clay-400 #e8866b` (speech) · `--color-clay-500 #d96846` · `--color-amber-400 #fbbf24`.

**Grep gate that must pass before any UI PR:**
```
grep -rEoh "#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)" src/features/halo src/shared/halo
```
Every survivor must exist in `src/index.css` or be pure black/white.

---

## 5. VERIFICATION — WHAT IS PROVEN AND HOW

There is **no test runner** in this repo. Verification is: a scoped `tsc`, an `esbuild` parse, a
pure-logic probe that prints numbers, and a real-browser Playwright suite. All four exist and are
reusable.

### 5.1 Pure-logic probe — 33/33 green
`agent/probes/halo-core.probe.mts` → bundle with esbuild → run with node.
Asserts the 12 geometry + 9 hover + 9 router cases the spec lists (§150/§151/§152).
**MEASURED output includes:** canvas centre `1512.0` on a 3024 display · `canvas.y=0` while
`workArea.y=38` · notch split-wings `2*38+244=320` · narrow display clamps to `296` ·
hotzone `232x68` < canvas `760x460` · 4 volume events → 1 activity.

### 5.2 Browser suite — 17/17 green
`agent/probes/halo-verify.mjs` (Playwright). Run against `npm run dev`.
Covers mount, geometry, top-centring (`centre === 640` of 1280), amber accent, hover-open,
grow-downward-only, numeral ticking, collapse, tab switch, 24 waveform bars.

### 5.3 Animation suite — 5/5 green
`agent/probes/halo-anim.mjs`. **The method matters:** an instant snap only ever yields the two
endpoints, so the probe samples width across the transition and counts INTERMEDIATE frames.
**MEASURED:** `232 → 314 → 369 → 404 → 425 → 438 → 446 → 452 → 455 → 457 → 459 → 460`
— 12 distinct widths, 6 intermediate. Numeral 13px → 34px on the same DOM node (`layoutId`).

### 5.4 Scoped typecheck
```bash
npx tsc --noEmit --project tsconfig.halo.json
```
Uses `"files"`, **never** `"include": ["src"]` — the tree has ~7,700 pre-existing errors and
`tsc` suppresses ALL semantic diagnostics when any file has a syntax error.

### 5.5 Diagnostic trail — `<userData>/halo-diagnostic.log`
The island is created inside `app.whenReady()`, whose console is invisible from the developer's
seat. Every lifecycle step is appended as JSON: `loading`, `loaded`, `renderer-loaded`,
`renderer`, `renderer-load-FAILED`, `renderer-gone`, `placement-ok`, `placement-REJECTED`,
`window-created`, `creation-FAILED`, `disabled`. IDs, geometry and phase only — never transcript
text or window titles (spec §112).

---

## 6. THE PROCESS TRAPS THAT WILL BITE AGAIN

These cost real time and are recorded so they are not re-learned:

1. **`tsc` and `esbuild` both report CLEAN on an undefined identifier.** A `useRef` deleted by a
   bad patch passed both and only surfaced as a runtime `ReferenceError` in the browser console.
   **Static checks cannot see missing bindings. Only running it can.**
2. **Never patch with Python slices on source files.** A slice meant to remove a duplicate type
   also deleted a hook and a module-scope const. Assert the POSTCONDITION, not that the script ran.
3. **`pkill -f "<pattern>"` matches its own shell** and will kill the tool call. Parse PIDs with
   `awk`, exclude `$$`, print the list, then act.
4. **Vite binds `[::1]` (IPv6) while Chromium resolves `localhost` to IPv4** → 45s navigation
   timeout that looks like a code failure. Bind `--host 127.0.0.1` and use `127.0.0.1` in probes.
5. **`chrome --dump-dom --virtual-time-budget` HANGS** on a page with a never-ending `setInterval`.
6. **Only ONE debugger client may attach to a page target.** A second page-level CDP websocket
   opens and then silently never replies. Use Playwright's Node API, not hand-rolled CDP.
7. **Editing a source file while a Playwright suite runs triggers an HMR reload mid-assertion** and
   produces phantom failures.
8. **`page.goto(..., { waitUntil: 'load' })` also waits on external font requests**, which can hang
   and masquerade as a broken page. Use `domcontentloaded` + `waitForSelector`.
9. **An agent NEVER runs `npm run build`.** CZ builds. `dist/` and `dist-electron/` ARE the running
   application; emptying them bricks it. Verify with scoped `tsc`, scoped `esbuild`, and probes.
10. **A rebuild does not affect a running app.** The island lives in the MAIN process, so RHEO must
    be fully quit and relaunched or it keeps running last cycle's code.

---

## 7. OPEN QUESTIONS THE DESIGNER MUST ANSWER

1. **Opaque-on-Linux surface.** `transparent: !isLinux` means the island is an opaque rounded rect
   over arbitrary desktop content. Design the Linux surface treatment, or specify the X11 requirement
   as a hard precondition and fail honestly when unmet.
2. **What is the stopwatch's real content?** It must be glanceable in <200ms. Is
   productive-vs-distracting the right split, or is the *current streak* / *longest session* the
   better hero? Specify the exact caption wording.
3. **Which additional activities, if any?** Candidates already priced: Deep Focus countdown (main-owned
   with `endsAt`, cheap), current app + tier (free via `foreground-changed`), pinned external activity
   (cheap), next deadline (cheap), notification badge (`unreadCount()` is a scalar COUNT on a 2-row
   table, already implemented in `src/main/notifications.ts:208` but **never exposed over IPC**).
4. **Compact-state floor.** The idle compact state currently shows the clock. Keep it, or hide the
   surface entirely when nothing is running (spec §39 prefers quiet)?
5. **Is one accent hue enough across three activities** (time / focus / speech) under LAMINAR §2's
   one-hue-per-surface rule and §7.2?
