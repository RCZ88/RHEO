# SPLASH REDESIGN — Integrated Boot Animation System (RHEO/DeskFlow)

**Session banner (carried):** D8 — no repo/filesystem access this session. Code below is written against the bundle's quoted sources, not verified against the live repo; every modification is specified by **grep anchor, not line number** (per the standing distrust-line-numbers law). Identity note: PROMPT.md names "claude" as target AI — executing here regardless; the orchestrator's routing, not the label, governs.

---

## §R — RCA RECONCILIATION (this bundle answers last session's PENDING-GREP splash verdicts)

This bundle quotes the actual splash code, so the freeze RCA must be updated before the design — the redesign and the RCA are the same surface.

| Prior verdict (RCA §2) | New evidence (bundle §1) | Updated verdict |
|---|---|---|
| Splash active at boot? PENDING | Created in `createWindow()` before main window | **CONFIRMED** |
| `transparent: true`? PENDING | Yes, explicit, + `backgroundColor:'#09090b'` (contradictory pair — flag) | **CONFIRMED** — live class-(a) candidate on NVIDIA/KDE at the time of the freeze |
| `setIgnoreMouseEvents(false)`? PENDING | Explicit call | **CONFIRMED** |
| Fullscreen pointer grab (class c)? LIVE suspect | Window is **520×320 centered** — `splash-field` fills only the window, not the screen | **REFUTED-BY-GEOMETRY** — a 520×320 window cannot produce desktop-wide input capture or a desktop-wide crosshair |
| Immortal splash (close path broken)? PENDING | Two main-process timers incl. an **unconditional** `setTimeout(closeSplash, 4000)` hard cap; the 1400ms timer is the only guarded one | **WEAKENED** — close is not solely renderer-dependent. Residual unknown (PENDING-GREP): `closeSplash()` body and any early `splashClosed = true` setter could still defeat both timers |
| Crosshair provenance | Splash design (ticks/numerals/sweep/wordmark) contains **no crosshair** | Splash **eliminated** as crosshair source; `SelectionOverlay.tsx` (gated off at boot) remains the only known provenance — the RCA's crosshair datum is **re-opened**, not explained |
| Bonus finding | `splashWindow.on('keydown', …)` and `webContents.on('mouse-down', …)` are **not valid Electron events** — as written they can never fire | The user's observed "click closes it" cannot come from the quoted handlers — either additional handlers exist (focus/blur — PENDING-GREP) or the report conflates effects. **Moot after this redesign**, but logged |

**Net:** this redesign is not just cosmetic — it **structurally removes the last live splash-class freeze candidate** (a transparent, click-capturing BrowserWindow at boot) by moving the animation into an in-app DOM overlay: no OS window, no compositor-level surface, no possible pointer grab, and its own watchdog cap cannot wedge the desktop. If the freeze persists *after* this redesign, the splash class is retroactively eliminated and RCA attention shifts fully to launch mode/EGL (§3 of the RCA).

## §C — BUNDLE CONFLICT LEDGER (distrust law applied to the spec itself)

1. **Min duration:** CONTEXT_BUNDLE constraint 3 says "2-3 seconds recommended"; PROMPT.md Mandate says "3-4 seconds minimum." → **Resolution:** `MIN_DISPLAY_MS = 3200` (satisfies both), readiness-extended, hard-capped. Tunable in one constant.
2. **Fonts:** anti-slop checklist says "Geist + JetBrains Mono"; tokens + design tasks say **Space Grotesk** (display) + JetBrains Mono. → Repo tokens win. Space Grotesk.
3. **Token names:** anti-slop says re-skin to `--bg-primary`/`--accent-primary`; the repo's real tokens are `--bg-0`, `--ws-accent`, `--hairline`, `--surface-1/2/3`. → Real tokens win; no invented token names.
4. **Constraint 8** ("must not break splash → main → app flow") vs. engineering task ("remove splashWindow") → Interpreted as: `createWindow()` entry point and main-window creation order preserved; the splash *stage* becomes an in-app overlay. Logged as interpretation.
5. **Forced 3-4s delay on every boot** conflicts with the Linear/Raycast/Vercel reference intent → Implemented as **min-display ∧ readiness**: animation always gets its full time; slow boots (e.g., the foreign-DB D4 scenario from the RCA) extend the hold instead of truncating it; nothing forces extra wait past readiness.

---

# 1. Summary

The separate 520×320 splash BrowserWindow is deleted entirely and replaced by `BootOverlay`, a React component mounted at the root of the main app (`main.tsx`), rendered as a centered glass card floating above the live app — no black backdrop, no OS-level window, no possible click-to-dismiss, no pointer capture. The "Meridian Wake" language survives intact (24-tick cascade, numerals, now-tick glow, sweep line, RHEO wordmark) but is re-choreographed as a ~2s framer-motion entrance using `--ease-out-expo`, followed by a quiet ambient hold (now-tick pulse + mono status rotation) until the app signals ready or a watchdog cap — so slow boots extend the animation instead of amputating it. The IPC contract is preserved verbatim (`boot-animation-config`, `splash-complete`, `replay-splash`), with `replay` now re-running the in-app animation and `splash-complete` informing a main process that no longer owns any window. Warm starts collapse the sequence to a sub-second identity flash honoring `warmStart`, and the whole system degrades safely: if config IPC fails, the app boots with no overlay at all — the loader can never trap the user.

# 2. Complete React component code

### `src/components/boot/bootTimings.ts` (new)

```ts
/** Single source of truth for boot animation choreography. */
export const BOOT_TIMINGS = {
  MIN_DISPLAY_MS: 3200,   // resolves bundle conflict C1 (2–3s recommended ∧ 3–4s minimum)
  WATCHDOG_CAP_MS: 9000,  // never trap the user, even if 'rheo:boot-ready' never fires
  FADE_OUT_MS: 600,

  WARM_START_MS: 800,     // warmStart=true → identity flash only

  CARD_IN: 500,           // card entrance
  TICKS_AT: 150,          // tick cascade start
  TICK_STAGGER: 12,       // 24 ticks × 12ms ≈ 288ms window (preserves original cadence)
  TICK_DUR: 260,
  NUMERALS_AT: 450,
  NUMERAL_STAGGER: 40,
  NUMERAL_DUR: 250,
  NOW_TICK_AT: 900,
  SWEEP_AT: 1050,
  SWEEP_DUR: 900,         // entrance complete ≈ 1950ms
  STATUS_ROTATE_MS: 900,  // hold-phase status crossfade cadence
} as const;

export type BootAnimationConfig = {
  enabled: boolean;
  variant: 'meridian';
  warmStart: boolean;
};

/** Structural mirror of the splashAPI preload bridge (see §5 — reuse repo's
 *  existing Window augmentation if one is already declared). */
export interface SplashBridge {
  getBootAnimationConfig: () => Promise<BootAnimationConfig>;
  onReplay: (cb: () => void) => void;
  sendComplete: () => Promise<void>;
}

export function getSplashApi(): SplashBridge | undefined {
  return (window as unknown as { splashAPI?: SplashBridge }).splashAPI;
}
```

### `src/components/boot/BootOverlay.tsx` (new)

```tsx
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BOOT_TIMINGS as T, getSplashApi, type BootAnimationConfig } from './bootTimings';
import '../../styles/boot.css';

const TICK_COUNT = 24;
const NUMERALS = ['00', '06', '12', '18', '24'] as const;
const STATUS_LINES = [
  'opening ledger',
  'aligning meridian',
  'restoring sessions',
  'waking surfaces',
] as const;

const EASE_EXPO = [0.19, 1, 0.22, 1] as const;

export interface BootOverlayProps {
  config: BootAnimationConfig;
  onDone: () => void;
}

export function BootOverlay({ config, onDone }: BootOverlayProps) {
  const reduced = useReducedMotion();
  const warm = config.warmStart;

  const [runId, setRunId] = useState(0);        // bumped by replay-splash
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter');
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  const startedAt = useRef<number>(performance.now());
  const readyRef = useRef(false);
  const exitingRef = useRef(false);
  const minMs = warm ? T.WARM_START_MS : T.MIN_DISPLAY_MS;

  // Readiness: App dispatches window event 'rheo:boot-ready' when initial
  // mount IPC has settled (one-line change, see §4). Best-effort — the
  // watchdog guarantees exit regardless.
  useEffect(() => {
    const onReady = () => { readyRef.current = true; };
    window.addEventListener('rheo:boot-ready', onReady);
    return () => window.removeEventListener('rheo:boot-ready', onReady);
  }, []);

  // Legacy channel preserved: main can trigger a replay in-app.
  useEffect(() => {
    const api = getSplashApi();
    api?.onReplay(() => {
      startedAt.current = performance.now();
      readyRef.current = false;
      exitingRef.current = false;
      setProgress(0);
      setStatusIdx(0);
      setPhase('enter');
      setRunId(r => r + 1);
    });
  }, []);

  // Hold-phase status rotation (skipped on warm start).
  useEffect(() => {
    if (warm) return;
    const id = window.setInterval(
      () => setStatusIdx(i => Math.min(i + 1, STATUS_LINES.length - 1)),
      T.STATUS_ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [warm]);

  // Choreographed progress ramp: 72% at entrance completion, 100% at exit.
  useEffect(() => {
    const id = window.setTimeout(
      () => setProgress(72),
      warm ? 200 : T.SWEEP_AT + T.SWEEP_DUR,
    );
    return () => window.clearTimeout(id);
  }, [warm, runId]);

  // Exit scheduler: full min display ALWAYS; extend until ready; hard cap.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - startedAt.current;
      const readyOrCapped = readyRef.current || elapsed >= T.WATCHDOG_CAP_MS;
      if (!exitingRef.current && elapsed >= minMs && readyOrCapped) {
        exitingRef.current = true;
        setProgress(100);
        void getSplashApi()?.sendComplete();     // legacy flow: main is informed
        setPhase('exit');
        window.setTimeout(onDone, T.FADE_OUT_MS);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [minMs, onDone, runId]);

  return (
    <motion.div
      className="boot-overlay"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: T.FADE_OUT_MS / 1000, ease: 'easeOut' }}
      data-warm={warm || undefined}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <motion.section
        key={runId}
        className="boot-glass"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: T.CARD_IN / 1000, ease: EASE_EXPO }}
      >
        <header className="boot-head">
          <motion.span
            className="boot-wordmark"
            initial={{ opacity: 0, letterSpacing: '0.42em' }}
            animate={{ opacity: 1, letterSpacing: '0.30em' }}
            transition={{
              delay: warm ? 0 : T.SWEEP_AT / 1000 + 0.15,
              duration: 0.55,
              ease: EASE_EXPO,
            }}
          >
            RHEO
          </motion.span>
          <AnimatePresence mode="wait">
            <motion.span
              key={warm ? 'warm' : statusIdx}
              className="boot-status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              {warm ? 'resuming session…' : `${STATUS_LINES[statusIdx]}…`}
            </motion.span>
          </AnimatePresence>
        </header>

        {!warm && (
          <div className="boot-ruler" aria-hidden="true">
            <div className="boot-ticks">
              {Array.from({ length: TICK_COUNT }, (_, i) => (
                <motion.span
                  key={i}
                  className={`boot-tick${i === 12 ? ' boot-tick--now' : ''}`}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={{
                    delay: (T.TICKS_AT + i * T.TICK_STAGGER) / 1000,
                    duration: T.TICK_DUR / 1000,
                    ease: EASE_EXPO,
                  }}
                />
              ))}
            </div>
            {!reduced && (
              <motion.span
                className="boot-sweep"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ delay: T.SWEEP_AT / 1000, duration: T.SWEEP_DUR / 1000, ease: EASE_EXPO }}
              />
            )}
            <div className="boot-numerals">
              {NUMERALS.map((n, i) => (
                <motion.span
                  key={n}
                  className="boot-numeral"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={{
                    delay: (T.NUMERALS_AT + i * T.NUMERAL_STAGGER) / 1000,
                    duration: T.NUMERAL_DUR / 1000,
                    ease: EASE_EXPO,
                  }}
                >
                  {n}
                </motion.span>
              ))}
            </div>
          </div>
        )}

        <div className="boot-progress" aria-hidden="true">
          <motion.span
            className="boot-progress-fill"
            animate={{ width: `${progress}%` }}
            transition={{ duration: progress === 100 ? 0.45 : 1.2, ease: EASE_EXPO }}
          />
        </div>
      </motion.section>
    </motion.div>
  );
}
```

### `src/styles/boot.css` (new)

```css
/* Boot overlay — tokens only; no invented token names; no black backdrop. */

.boot-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: transparent;          /* constraint 4: app shows through */
  cursor: default;                  /* explicit cursor provenance (RCA §6) */
  user-select: none;
  pointer-events: auto;             /* absorbs stray boot clicks; dismisses nothing */
}

/* Glass card: --ws-surface (#09090b) at 80% ≡ zinc-900/80 + backdrop blur. */
.boot-glass {
  width: min(520px, calc(100vw - 48px));
  padding: 26px 24px 20px;
  border-radius: var(--radius-card, 12px);
  border: 1px solid var(--hairline, rgba(255, 255, 255, 0.08));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01)),
    rgba(9, 9, 11, 0.80);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.boot-head { display: flex; flex-direction: column; gap: 6px; }

.boot-wordmark {
  font-family: var(--font-display, 'Space Grotesk'), sans-serif;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-hi, #f4f4f5);
}

.boot-status {
  font-family: var(--font-mono, 'JetBrains Mono'), monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-mid, rgba(244, 244, 245, 0.64));
  min-height: 1em;
}

.boot-ruler { position: relative; height: 44px; }

.boot-ticks {
  position: absolute;
  inset: auto 0 14px 0;
  height: 18px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.boot-tick {
  width: 1px;
  height: 8px;
  background: var(--hairline-strong, rgba(255, 255, 255, 0.14));
}
.boot-tick:nth-child(4n + 1) { height: 14px; } /* quarter markers taller */

.boot-tick--now {
  width: 2px;
  height: 14px;
  background: var(--ws-accent, #06b6d4);
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.55);
  animation: boot-now-pulse 2.2s var(--ease-out-expo, ease-out) 0.9s infinite;
}

.boot-sweep {
  position: absolute;
  left: 0;
  bottom: 14px;
  height: 1px;
  width: 0;
  background: linear-gradient(90deg, transparent, var(--ws-accent, #06b6d4), transparent);
}

.boot-numerals {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono, 'JetBrains Mono'), monospace;
  font-size: 10px;
  color: var(--text-mid, rgba(244, 244, 245, 0.64));
}

.boot-progress {
  height: 2px;
  border-radius: 2px;
  overflow: hidden;
  background: var(--surface-1, rgba(255, 255, 255, 0.03));
}

.boot-progress-fill {
  display: block;
  height: 100%;
  width: 0;
  background: linear-gradient(90deg, var(--ws-accent, #06b6d4), rgba(6, 182, 212, 0.4));
}

@keyframes boot-now-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}

@media (prefers-reduced-motion: reduce) {
  .boot-tick--now { animation: none; }
}
```

# 3. Modified `src/main.ts` (deletions by anchor; nothing depends on stale line numbers)

**DELETE (each located by grep, not by line):**

| # | Anchor | Action |
|---|---|---|
| 1 | `splashPreloadPath` (const assignment) | Remove declaration |
| 2 | `splashWindow = new electron_1.BrowserWindow({` … through the object's closing `});` | Remove entire creation block (incl. `transparent: true`, `backgroundColor`, `setIgnoreMouseEvents(false)`) |
| 3 | `splashWindow.on('ready-to-show'` | Remove handler |
| 4 | `splashWindow.on('keydown'` and `splashWindow.webContents.on('mouse-down'` | Remove (they were no-ops anyway — invalid events; see §R) |
| 5 | `setTimeout(closeSplash, 4000)` and `setTimeout(() => { if (!splashClosed) …` | Remove both timers and the `splashStartTime` constant |
| 6 | `function closeSplash(` | **Keep as no-op stub** — paste-safe against unseen call sites: `function closeSplash() { /* splash is in-app now; retained as no-op for legacy references */ }` — then grep all `closeSplash` references and prune those you own |
| 7 | `src/splash.html`, `src/splash.css` | Delete files; then `grep -rn "splash" electron.vite.config.ts vite.config.ts scripts/build.mjs` and remove any `splash.html` entry/copy step so the dist pipeline stays green |

**MODIFY (IPC — channels and payloads unchanged, targets retargeted):**

```ts
// 'replay-splash' — was: splashWindow.webContents.send(...). Now:
electron_1.ipcMain.on('replay-splash', () => {
    mainWindow?.webContents.send('replay-splash');
});

// 'splash-complete' — no window left to close; keep the channel alive:
electron_1.ipcMain.handle('splash-complete', () => {
    // boot animation finished in-app; main no longer owns a splash window
    return { ok: true };
});

// 'boot-animation-config' — unchanged (prefService.getBootAnimation()).
```

**What must NOT change:** `createWindow()` entry point, main-window creation and its `backgroundColor: '#0a0a0a'` (that's the *app's* canvas, not a loader backdrop), `titleBarStyle`, frameless config.

# 4. `src/main.tsx` + `src/App.tsx` integration

### `src/main.tsx` (modified)

```tsx
import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { App } from './App';
import { BootOverlay } from './components/boot/BootOverlay';
import { BOOT_TIMINGS, getSplashApi, type BootAnimationConfig } from './components/boot/bootTimings';

window.__RHEO_LOADED = true;

/** Gate: fetches BootAnimationConfig, floats BootOverlay above the live app.
 *  Degradation law: config fetch fails → no overlay, boot proceeds, never traps. */
function BootGate({ children }: { children: React.ReactNode }) {
  // undefined = config pending · null = no overlay · config = show
  const [cfg, setCfg] = useState<BootAnimationConfig | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getSplashApi()
      ?.getBootAnimationConfig()
      .then(c => {
        if (cancelled) return;
        if (!c.enabled) void getSplashApi()?.sendComplete(); // legacy flow honored
        setCfg(c.enabled ? c : null);
      })
      .catch(() => { if (!cancelled) setCfg(null); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {children /* app mounts + loads data BEHIND the overlay — parallel boot */}
      <AnimatePresence>
        {cfg && (
          <BootOverlay
            config={cfg}
            onDone={() => setCfg(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <HashRouter>
      <NumberMaskProvider>
        <BootGate>
          <App />
        </BootGate>
      </NumberMaskProvider>
    </HashRouter>
  </ErrorBoundary>
);
```

*(Adjust import paths to the repo's actual aliases — `@/` alias exists per `vite.config.ts`.)*

### `src/App.tsx` (one-line addition, anchored)

In the **existing mount effect** that issues `getStorageStatus / getLogs / getDashboardData / getExternalActivities / getActiveExternalSession` — after the last of those settles (inside `.finally()` of a `Promise.allSettled`, or after the final `await` if the effect is sequential):

```ts
window.dispatchEvent(new Event('rheo:boot-ready'));
```

This is the readiness signal `BootOverlay` waits on. It is best-effort by design: if any boot IPC hangs (the RCA's D4 foreign-DB scenario), the overlay holds its ambient loop until the 9s watchdog — the user sees a living loader instead of an amputated or frozen one.

### `index.html` (optional hardening, recommended)

A static seed inside `#root` — React 18's first `render()` clears container children, so it self-removes at mount and covers the ms-scale gap between window paint and bundle execution:

```html
<div id="root">
  <div style="position:fixed;inset:0;display:grid;place-items:center;font-family:system-ui;color:#f4f4f5;opacity:.6;letter-spacing:.3em;font-size:14px;">RHEO</div>
</div>
```

# 5. `src/preload.ts` IPC changes

**Verify-then-no-op:** the bundle indicates the `splashAPI` bridge already exists in the main window's preload (`preload.ts`, bundle-cited at lines 1779–1784 — **grep `splashAPI` in `src/preload.ts` to confirm; do not trust the line number**).

- **If present:** zero changes. The three-member surface (`getBootAnimationConfig`, `onReplay`, `sendComplete`) is consumed as-is by `BootOverlay`.
- **If it lives only in `src/preload/splashPreload.ts`:** copy the identical `contextBridge.exposeInMainWorld('splashAPI', {…})` block into `preload.ts` (same channel names, same shapes — the contract is frozen by constraint 7). Then delete `splashPreload.ts` and its loader reference (§3, item 1/2) — it has no other consumer.
- `boot-animation-config` / `splash-complete` / `replay-splash` channel names and payload shapes: **unchanged**. Only the *sender target* of `replay-splash` moved (main window instead of splash window).

# 6. MCP components

| Component | Source | Role | Verdict |
|---|---|---|---|
| `BootOverlay` choreography | **framer-motion** (existing dep) | Stagger orchestration, exit fade, `useReducedMotion` | **Core** — everything else is dressing |
| Card | shadcn | Card semantics/base | **Optional** — `.boot-glass` implements the same role directly in tokens; use shadcn Card only if the team wants Radial primitive consistency |
| Progress | shadcn | Hairline progress | **Rejected in favor of custom** `.boot-progress-fill` — a 2px accent gradient needs exact token control shadcn's default styling fights |
| Badge | shadcn | "resuming" chip on warm start | **Optional enhancement** (warm start currently expresses this via status text — sufficient) |
| Border Beam | Magic UI | Edge shimmer around the glass card during long holds (>4s) — a "still alive" cue for slow boots | **Recommended enhancement, phase 2** — not in base code to keep the diff reviewable |
| `Activity` / `Sunrise` | Lucide | Tiny glyph beside status line | **Optional** — mono-aesthetic argues for none; do not import in base |
| Animated Beam | Magic UI | — | Rejected (decorative noise against the meridian concept) |
| Bot | Lucide | — | Rejected (AI-slop signal) |
| Dialog | shadcn | — | Rejected (this is not a modal; it must not trap focus semantics) |

**Anti-slop checklist compliance:** DeskFlow tokens only (§C-3: real names, not the generic ones) · `rounded-[var(--radius-card)]` = 12px ≤ rounded-xl ✓ · padding 24–26px ≈ p-5/p-6 ✓ · dark-only ✓ · Space Grotesk + JetBrains Mono (§C-2) ✓ · glass = `rgba(9,9,11,.80)` + `backdrop-blur(24px)` — the exact `bg-zinc-900/80 backdrop-blur-xl` recipe rendered in repo tokens ✓ · no black backdrop behind the card ✓.

# 7. New CSS classes introduced

| Class | Purpose |
|---|---|
| `.boot-overlay` | Fixed, transparent, full-viewport grid container; `cursor: default` (explicit crosshair-provenance kill); absorbs boot clicks, dismisses nothing |
| `.boot-glass` | The card: token glass surface, 12px radius, hairline border, blur |
| `.boot-head` / `.boot-wordmark` / `.boot-status` | Header stack; Space Grotesk wordmark with animated tracking; JetBrains Mono status line |
| `.boot-ruler` / `.boot-ticks` / `.boot-tick` / `.boot-tick--now` | Meridian geometry; quarter-marker sizing; accent now-tick with pulse (CSS-delayed to `NOW_TICK_AT`) |
| `.boot-sweep` | Accent gradient sweep line (width-animated by framer-motion) |
| `.boot-numerals` / `.boot-numeral` | 00/06/12/18/24 mono row |
| `.boot-progress` / `.boot-progress-fill` | 2px hairline track + accent gradient fill |
| `@keyframes boot-now-pulse` | Hold-phase ambient pulse |
| `prefers-reduced-motion` block | Kills pulse; component additionally strips transforms |

# 8. Animation timing specification

**Entrance (cold start — deterministic, ~1950ms):**

| t (ms) | Element | Motion | Duration | Easing |
|---|---|---|---|---|
| 0 | Card | opacity 0→1, y +14→0, scale .985→1 | 500 | `--ease-out-expo` |
| 150 → 438 | 24 ticks | y −6→0 + fade, staggered 12ms | 260 each | `--ease-out-expo` |
| 450 → 610 | Numerals ×5 | y +6→0 + fade, staggered 40ms | 250 each | `--ease-out-expo` |
| 900 | Now-tick | accent glow on, then `boot-now-pulse` ∞ | — | CSS keyframe |
| 1050 → 1950 | Sweep line | width 0%→100% | 900 | `--ease-out-expo` |
| 1200 → 1750 | Wordmark | fade + letter-spacing .42em→.30em | 550 | `--ease-out-expo` |
| 1950 | Progress | ramps to 72% | 1200 (started ~1050) | `--ease-out-expo` |

**Hold & exit (state-driven, not clock-blind):**

| Phase | Rule |
|---|---|
| Status rotation | every 900ms crossfade through the 4 lines (hold only) |
| Minimum display | **3200ms** always elapsed (§C-1 resolution) — the user always sees the full entrance + ≥1.2s ambient hold |
| Extension | exit waits for `rheo:boot-ready` from App (slow DB ⇒ living loader, not truncation) |
| Watchdog | **9000ms** hard cap regardless of readiness — the loader can never trap (direct lesson from the splash RCA: this design's own close path cannot be orphaned) |
| Exit | progress →100% (450ms), `sendComplete()` fired at exit start, overlay fades 600ms + unmount via `AnimatePresence` |
| Warm start (`warmStart: true`) | no ruler/numerals; wordmark immediate; progress to 72% at 200ms; min display **800ms**; status fixed "resuming session…" |
| `enabled: false` | overlay never mounts; `sendComplete()` still fires for flow compatibility |
| Reduced motion | all transforms stripped (opacity-only crossfades); pulse disabled via media query; **durations preserved** (less motion ≠ less time) |

Progress disclosure: the bar is **choreographed time-plus-readiness**, not fake byte-progress — entrance carries it to 72%, readiness completes it. Stated here so nobody later "fixes" it to read real progress and couples loader exit to IPC internals twice.

---

## Implementer verification anchors (run before applying — D8 closeout)

```bash
cd ~/dev/rheo
rg -n "closeSplash|splashClosed|splashStartTime" src/main.ts        # all stub call-sites (§3-6)
rg -n "splashAPI" src/preload.ts                                     # bridge present? (§5)
rg -n "splash" electron.vite.config.ts vite.config.ts scripts/build.mjs  # dist pipeline refs (§3-7)
rg -n "crosshair" src/splash.css src/splash.html 2>/dev/null         # RCA crosshair provenance, final closure
rg -n "blur|focus" src/main.ts | rg -i splash                        # was there a REAL click-dismiss handler? (§R open item)
rg -n "closeSplash" src/main.ts                                      # confirm 4000ms cap + guards removed cleanly post-edit
```

**Standing deviations:** D8 (no tool access — all anchors unverified until Hermes runs the block above) · D9 (verdict vocabulary) · D10 (line numbers treated as stale everywhere, including this bundle's). New flag **D11**: the "click closes splash" mechanism remains unexplained statically (quoted handlers are invalid Electron events) — moot post-redesign, logged for the RCA ledger.
