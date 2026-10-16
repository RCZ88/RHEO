# Conversation State — halo-kwin-outside-app

## Setup

- **Specialist:** the external AI who authored `agent/docs/halo/HALO_WINDOWLESS_COMPOSITOR_RESEARCH.md`.
- **Project Owner:** opencode, in the RHEO codebase.
- **Human relay:** CZ, copy-paste verbatim.
- **Mode:** Case 2 — continuation.
- **Scope:** fullstack (main process + compositor plugin)
- **Depth:** iterative-until-complete

## Round 2 — CONVERGED

Specialist returned `RESULT_ROUND2.md` (267 lines). **All four questions answered. The architecture
is viable — the stated blocker did not exist.**

### The headline finding

The research doc said (§70) `InputEventFilter` was "not a stable cross-version application API" and
(§21) that the pointer callbacks are `void` and cannot consume a click. **Both were wrong for the
installed build.** Round 2 Q1 found:

- `InputEventFilter` is `KWIN_EXPORT`ed, public ctor, `bool pointerMotion/pointerButton` where
  `true` = consume.
- `InputRedirection::installInputEventFilter()` is public.
- `inline InputRedirection *input()` at `input.h:571` is a public singleton accessor.

**The whole selective-input contract is three lines from a plugin.** The doc's own
§118 falsifier ("can load an external C++ effect and exposes a selective input filter") is SATISFIED.

### Decisions received

| # | Decision |
|---|---|
| Q1 | ✅ **Yes.** Install path is public. Lifecycle: idempotent `ensureInputFilter()` from `reconfigure()`, never from `paintScreen()`. Destructor uninstalls. |
| Q1 | Filter weight `InputFilterOrder::Later` — but **only after a probe proves** it sorts after KWin policy filters and before `Forward`. Never `Effects` (too early). |
| Q2 | Layer-shell is **not** a dead branch — it's an integration gap. Needs a `HaloBridgeV1` WebKit adapter because WebKitGTK runs no `preload.cjs`. Separate Wayland surface, so not the strict answer. |
| Q3 | **Shared memory (b)**, as the spec already said. Socket = control plane only, newline JSON ≤16 KiB. Pixels = POSIX shm, double-buffered slots, writer-bit + reader-count. |
| Q4 | **Mutually exclusive backend selector.** Never two islands. kwin → layer-shell → in-app → off. |
| Gate | Return to §89 step 1: minimal effect that paints a fixed capsule + installs/uninstalls the filter. **Only then** the transport. |

### Rules they imposed

- Do not fake consumption with `Effect::pointerButton()` callbacks.
- `pointerMotion` **always returns false** — motion must never be consumed.
- Press/release as a **pair**; press inside + release outside ≠ action.
- Visual failure must **fail open for input**: no valid frame/layout ⇒ every click passes through.
- Bound the retry loop — an unbounded zero-delay timer in the compositor is a hang.
- Keep all 255 existing assertions; add 10 new probes (listed in RESULT §"Required gates").
- **"Do not autostart-enable a crashing prototype before gate 10 passes."**

### Correction owed to the research doc

§21 and §70 are factually wrong for this build. They asked for a corrected statement — recorded in
RESULT §"Correction to the research doc". Not yet written into the doc itself.

## Round 3 — NEEDED. Round 2 contains an error, and gate 1 hit three real API facts.

### Round 2 error: `InputFilterOrder::Later` does not exist

RESULT_ROUND2 §Executive decisions #2 and §"Filter order" both specify
`InputFilterOrder::Later`. **That enum value does not exist on this build.** The real enum
(`/usr/include/kwin/input.h:355-380`) is:

```
PlaceholderOutput, Dpms, ButtonRebind, SlowKeys, BounceKeys, StickyKeys, MouseKeys,
EisInput, VirtualTerminal, LockScreen, ScreenEdge, DragAndDrop, WindowSelector, TabBox,
GlobalShortcut, Effects, InteractiveMoveResize, Popup, Decoration, WindowAction,
XWayland, InternalWindow, InputMethod, Forward
```

Lower values come first (`input.h:409`). Their stated CONTRACT is *"after WM/system filters, before
the final forwarding filter"*, so I chose **`Decoration`** — the last policy filter before the
cluster of window-forwarding filters. `Forward` is excluded because installing after it means the
filter cannot intercept anything.

**Please confirm `Decoration`, or name the correct value.** Their own §258 falsifier anticipated
exactly this ("if the installed order changes, fail the build/probe"), so this is the probe firing.

### Gate 1 result: COMPILES, LINKS, LOADS

```
native/kwin-halo-effect/libhalo.so    50,608 bytes
dlopen → LOADS OK — all symbols resolved, vtable present
installed → ~/.local/lib/kwin/effects/{libhalo.so,halo.json}
```

Exported overrides confirmed via `nm -D`:
```
HaloEffect::paintScreen(RenderTarget const&, RenderViewport const&, int, Region const&, LogicalOutput*)
HaloEffect::reconfigure(QFlags<KWin::Effect::ReconfigureFlag>)
```

**NOT YET LOADED BY KWIN.** It is installed but the effect is not enabled, and KWin has not been
restarted. Gate 1 is not passed until the capsule is visibly above Firefox.

### Three API facts their Round 2 did not account for

**1. `InputEventFilter` is NOT a QObject.** `input.h:405` declares `class KWIN_EXPORT InputEventFilter`
with **no base class**. Multiple inheritance with QObject is impossible:
```
error: type 'QObject' is not a direct base of 'HaloInputFilter'
```
Their illustrative code implies otherwise. Lifetime must be held by the effect, not by a QObject parent.

**2. `LogicalOutput` has no `repaintRegion()`.** No `repaint` member exists in `core/output.h` at
all. The scheduling entry point is `RenderLoop::scheduleRepaint()` (`core/renderloop.h:79`), and an
effect gets **no public handle** to the render loop — `Compositor::composite(RenderLoop*)` receives
one, does not expose it.

**Consequence I want ruled on:** a STATIC capsule can only be repainted when the compositor repaints
for some other reason. On a busy desktop that is effectively always; on a fully idle desktop the
capsule may never appear. A long-lived overlay needs a self-scheduled repaint, which needs a
render-loop handle this API does not expose to plugins.

**What is the correct KWin-6 pattern here?** Options I can see: a repeating `QTimer` in the effect
that requests repaints while armed; or accepting frame-driven-only repaints because the real island
paints at up to 30fps anyway (RESULT §49). **The second makes this a non-issue for the real island
but leaves gate 1's static capsule unprovable on an idle desktop.**

**3. The link library is `libkwin`, not `libKF6KWin`.** RESULT did not cover the build. Fixed.
Also required and initially missing: `moc` (without it the .so compiles and links cleanly, then
fails at `dlopen` with `undefined symbol: _ZTVN10HaloEffect10HaloEffectE`), and KF6 include paths
for the moc compile.

### Confirmed working, as implemented

- `ensureInputFilter()` idempotent, called from `reconfigure()` only, never `paintScreen()`.
- Bounded retry: `kMaxInstallAttempts = 20`, then give up non-interactively. Their unbounded-loop
  rule honoured.
- `pointerMotion` **always returns false**.
- `pointerButton` fails **open**: empty armed rect ⇒ nothing consumed ⇒ gate 1 is safe to load into a
  live session.
- Press/release pair semantics implemented but inert until a LAYOUT arrives.
- Destructor deletes the filter (auto-uninstall per `input.h:409`).
- Plugin writes `$XDG_STATE_HOME/rheo/halo-kwin-effect.status` — a compositor plugin has no usable
  stdout, so this is the only channel the app can poll.

### Round 3 questions

| # | Question | Blocking |
|---|---|---|
| 1 | Is `InputFilterOrder::Decoration` the correct weight, per your stated contract? | yes |
| 2 | How should a long-lived overlay schedule its own repaints given no public `RenderLoop`? | yes |
| 3 | Gate 1 needs an idle-desktop-reproducible capsule. Accept frame-driven repaints only, or is there a correct pattern I'm missing? | yes |

## Round 3 addendum — 2026-10-16 (evidence pack; answers not yet received)

Round 3 questions above remain open. Two developments since; all figures measured, nothing eyeballed.

### A. The layer-shell branch is LIVE — Q2's WebKit premise turned out to be avoidable

`native/halo-layer-host` (GTK4 + gtk4-layer-shell C host — **no WebKitGTK, no `preload.cjs`**) consumes the offscreen renderer's BGRA frames over the bridge socket and paints them in a real layer surface:

- `~/.local/state/rheo/halo-layer-host.log`: `LIVE: first frame 680x154 (seq 0) — placeholder painting is OFF`, stable ≥129 s with the new 5 s heartbeat. The earlier 20 s `socket closed by peer` reconnect loop (bridge reaps clients idle >15 s) is gone.
- Pointer relay: host sends `{type:"pointer",payload:{action,kind,x,y,button,pressed,modifiers}}`, `kind ∈ enter|leave|move|down|up` (validated fail-closed app-side — unknown kinds rejected; coordinates frame-local, bbox origin added host-side). App injects them into the offscreen window with `sendInputEvent` so every React handler runs unchanged.
- Fail-open for input verified by construction and by code: fully transparent frame ⇒ surface shrinks to 2×2 and nothing else; keyboard mode NONE; no consumption outside the island bbox.

### B. Gate 1 (KWin effect) — why it never loaded: wrong plugin LAYOUT. Measured.

- Scan root: `strings /usr/lib64/libkwin.so.6` → `kwin/effects/` + `kwin-wayland/effects/`; per the installed header (`KF6/KCoreAddons/kpluginmetadata.h`, `findPlugins` doc) a relative path resolves under **`QCoreApplication::libraryPaths()`** — for this session `/usr/lib64/qt6/plugins/kwin/effects/`. KWin's own `kf.coreaddons` error on the 15th named exactly that directory.
- Layout probe — the loader's own discovery call (`KPluginMetaData::findPlugins`), four candidate installs:

  | install | result |
  |---|---|
  | FLAT `<dir>/halo.so` + `<dir>/halo.json` | **1 entry — id=halo, `X-KDE-ServiceTypes=[KWin/Effect]`** |
  | `<dir>/halo/halo.so` + `<dir>/halo/halo.json` | 0 |
  | `<dir>/halo/libhalo.so` + `<dir>/halo/halo.json` (current system install) | 0 |
  | `/usr/lib64/qt6/plugins/kwin/effects` as installed on the 15th | 0 |

- The `.so` is already a valid Qt plugin: `nm -D` shows `qt_plugin_instance` + `qt_plugin_query_metadata_v2`; `QPluginLoader::metaData()` = `IID=org.kde.kwin.EffectPluginFactory`, `MetaData.KPlugin.Id=halo`, `className=halo_factory`.
- Live compositor agrees: KWin restarted 10:30 today **with** `effects/halo/libhalo.so` present; `listOfEffects` (54) contains no `halo`; `isEffectSupported halo` = `false`. `kwinrc` has `haloEnabled=true`.
- Fix (needs CZ's sudo — `/usr/lib64` is root-owned), then a KWin rescan/restart:
  `sudo cp native/kwin-halo-effect/libhalo.so /usr/lib64/qt6/plugins/kwin/effects/halo.so`
  `sudo cp native/kwin-halo-effect/halo.json  /usr/lib64/qt6/plugins/kwin/effects/halo.json`
- Inert leftovers (do not confuse with the fix): 15th installs under `effects/halo/` and under `~/.local/lib/kwin/effects/` (that root is not scanned by either loader).

Open: does the running KWin rescan on `org.kde.KWin reconfigure` / `loadEffect`, or does gate 1 need a session restart? A live `loadEffect halo` is deliberately not attempted until CZ accepts the compositor risk.

## Protocol

Per `agent/skills/backandfourth-skill/SKILL.md`. **Project Owner rule: never guess a measurement.**
Every number in a CONTEXT reply is quoted from a command that was actually run, with a line number or
a measured value. An earlier session produced 312 green probe assertions that all tested source
strings while the app was visibly broken three ways; that is the failure mode this round exists to
avoid.