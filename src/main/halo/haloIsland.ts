/**
 * Halo Island — main-process owner.
 *
 * WHY THIS FILE HAS TO EXIST
 * --------------------------
 * The island cannot live inside RHEO's renderer. Anything drawn in the main
 * window is clipped to it and vanishes the moment RHEO is not on top — which
 * defeats the entire purpose of an island that floats above every application.
 * So it is a real BrowserWindow, and this module owns it.
 *
 * Everything about the WINDOW lives here and nowhere else: creation, placement,
 * always-on-top level, click-through, focus policy and hover polling. HALO §25
 * requires exactly one reconciler for placement; no other module may call
 * setPosition/setBounds for the island.
 *
 * THE THREE PLATFORM TRAPS ON THIS MACHINE
 * ----------------------------------------
 * 1. This box runs NATIVE WAYLAND (KDE Plasma / Fedora 44). Electron does not
 *    reliably support programmatic position, always-on-top or cursor position
 *    there, so `main.ts` forces `ELECTRON_OZONE_PLATFORM_HINT=x11` before app
 *    ready and we run against XWayland.
 * 2. `transparent: true` is refused or composited opaque black by some Wayland
 *    compositors. `focusManager.ts:233` already hit this and guards with
 *    `transparent: !isLinux`; the same guard is used here rather than hardcoding
 *    true (the STT panel at main.ts:8831 hardcodes it and is therefore suspect).
 * 3. `powerMonitor.getSystemIdleTime()` returns 0 on Linux, so nothing in the
 *    island may depend on it.
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { appendFileSync } from 'fs';
import { app } from 'electron';
import {
  computeGeometry,
  computeSurfaceRect,
  DEFAULT_CALIBRATION,
  resolveTargetDisplay,
  type DisplayLike,
} from '../../shared/halo/geometry';
import {
  initialHoverState,
  pointInHotZone,
  stepHover,
  type HoverConfig,
  type HoverState,
} from '../../shared/halo/hoverMachine';
import { getLinuxCursorPoint } from '../../linuxForeground';
import type { IslandGeometry, Rect } from '../../shared/halo/types';
import { HALO_DEFAULTS, normalizeHaloPrefs, scaled, HALO_SIZE_TOKENS, resolveHaloSize, type HaloPrefs } from '../../features/halo/HaloPreferences';
import { HaloLayerShellClient, resolveLayerShellBinary } from './layerShellClient';

/**
 * DIAGNOSTIC TRAIL
 * ----------------
 * This module writes every lifecycle step to `<userData>/halo-diagnostic.log`.
 * That exists because the island is created inside `app.whenReady()`, whose
 * console output is only visible in whatever terminal launched the app — which is
 * not where diagnosis happens. Without a file there is no way to distinguish
 * "never created" from "created but not shown" from "shown but positioned
 * off-screen", and those three need three different fixes.
 *
 * It records IDs, geometry and phase only. Never transcript text, window titles
 * or any user content (HALO §112).
 */
function diag(event: string, detail?: Record<string, unknown>): void {
  try {
    const line = JSON.stringify({
      t: new Date().toISOString(),
      event,
      ...(detail ?? {}),
    });
    appendFileSync(path.join(app.getPath('userData'), 'halo-diagnostic.log'), line + '\n');
  } catch {
    /* diagnostics must never throw */
  }
  console.log('[Halo]', event, detail ?? '');
}

/** HALO §47 poll rates. Hover detection is not an animation clock. */
const POLL_COLLAPSED_MS = 120;
const POLL_EXPANDED_MS = 40;

/**
 * Height of the island's interactive tab rail, in CSS px.
 *
 * Must match `.halo-rail { height: 30px }` in halo.css. Duplicated rather than imported
 * because the renderer is a separate bundle with no access to the main process's module
 * graph. A wrong value is not cosmetic: too small and the rail buttons stop responding.
 */
const RAIL_H = 30;

/**
 * Top padding of the expanded shell, in CSS px.
 *
 * `.halo-surface.halo-expanded { padding: var(--halo-gap-block) ... }` and
 * `--halo-gap-block: 16px`, so the rail does NOT start at the surface's top edge — it starts
 * 16px down. This number exists because getting it wrong is invisible in a diff and fatal at
 * runtime: a region of `RAIL_H` (30) taken from y=0 covers the padding plus only the top 14px
 * of the rail, so the rail buttons — which are vertically centred — lose their bottom half to
 * the clip. The pin control is IN that row, so the island would become un-un-pinnable, which
 * is the worst possible failure for this feature: it holds a click region you cannot release.
 */
const SHELL_PAD_TOP = 16;


const isLinux = process.platform === 'linux';
const isMac = process.platform === 'darwin';

export interface HaloSnapshot {
  stopwatch: unknown | null;
  currentApp: unknown | null;
  dictation: unknown | null;
}

export interface HaloDeps {
  /**
   * Supplied by main.ts. Deliberately a callback: the stopwatch lives in a
   * renderer module today, so main cannot read it directly and the island falls
   * back to its fixture until a relay channel exists.
   */
  snapshotProvider: () => HaloSnapshot;
  /**
   * Resolved fresh on every reconcile, not captured once, so toggling the island
   * off in Settings takes effect without a restart.
   */
  prefs: () => HaloPrefs;
  /**
   * Renderers that host a SECOND copy of the island besides the primary one — today the
   * offscreen `halo.html` window (`offscreenRenderer.ts`) whose frames feed the windowless
   * compositor path. It runs the same `OverlayRoot` behind the same preload and reads the
   * same `halo:snapshot`/`halo:prefs` channels, so it must be handed the same stream;
   * without that it renders whatever defaults it booted with (the "No app detected" fixture,
   * a stale enabled state). A CALLBACK, not a list: the offscreen window is created
   * asynchronously AFTER the island starts, so capture-at-create would always be `[]`.
   */
  extraTargets?: () => BrowserWindow[];
}

interface HaloHandle {
  window: BrowserWindow;
  geometry: IslandGeometry;
  hover: HoverState;
  pinned: boolean;
  timer: ReturnType<typeof setInterval> | null;
  /** Current poll rate. Mutated in place; the interval itself is created once. */
  pollMs: number;
  /** The deps this island was created with, so reconcile can re-push a real snapshot. */
  deps: HaloDeps;
  expanded: boolean;
  /**
   * The preferences the island is CURRENTLY running with.
   *
   * Kept so `applyHaloPrefs` can diff against them and honour HALO §11's resize allowlist
   * (only move the native window when edge/scale/display actually changed), and so
   * `applyClickRegion` can shape the window without being handed the whole dependency
   * bundle on every hover transition.
   */
  prefs: HaloPrefs;
  /**
   * TRUE when the island renders inside RHEO's OWN renderer (`HaloInAppMount`) rather than in a
   * second window.
   *
   * This exists because the in-app handle is a PLACEHOLDER with no `webContents` of its own, so
   * every push that reached the renderer previously went into a no-op `send()`. The renderer then
   * never received `halo:prefs`, never learned that the island had been switched off, and kept
   * painting the capsule — the exact "it doesn't hide the capsule when I turn it off" report.
   *
   * With this flag, every push is addressed to `getAllWindows()[0]` (the main window, which is
   * where the in-app island is actually mounted) instead of a window that does not exist.
   */
  inApp: boolean;
}

let handle: HaloHandle | null = null;
let creating: Promise<BrowserWindow | null> | null = null;
/**
 * The deps the island was last created with, retained ACROSS destroy/create cycles.
 *
 * `destroyHaloIsland()` sets `handle = null`, so every per-handle field — including `deps` —
 * is gone once the island is switched off. Without this capture the re-enable path in
 * `applyHaloPrefs` would have nothing to hand `createHaloIsland`, and switching the island
 * back on in Settings would silently do nothing. Same class of bug as the `handle.deps`
 * read that `reconcileHaloGeometry` had to fix, one level up: the provider must outlive the
 * thing it is provided to.
 */
let lastDeps: HaloDeps | null = null;

/**
 * Set once by `configureHaloPrefs` so `reconcileHaloGeometry` can re-read the
 * preference without being handed the whole dependency bundle. Returns defaults
 * until configured, so an early call cannot throw.
 */
let readPrefs: () => unknown = () => HALO_DEFAULTS;

export function configureHaloPrefs(reader: () => unknown): void {
  readPrefs = reader;
}

/**
 * Build the hover config from preferences.
 *
 * WHY THIS IS DERIVED INSTEAD OF PASSING THE PREFERENCE OBJECT
 * The machine takes a `HoverConfig`, the user stores a `HaloTriggerPrefs`. Without this
 * mapping the four timing numbers the user just set in Settings would be stored and then
 * ignored — which is exactly the defect this whole change exists to remove.
 */
function hoverConfigFor(prefs: HaloPrefs): HoverConfig {
  return {
    openDelayMs: prefs.trigger.openDelayMs,
    closeDelayMs: prefs.trigger.closeDelayMs,
    leaveMarginPx: prefs.trigger.leaveMarginPx,
  };
}

/**
 * Every display, shaped for `resolveTargetDisplay`.
 *
 * WHY THE CONNECTION MATTERS
 * `resolveTargetDisplay` was fully written — including HALO §28/§161's rule that a saved
 * display which has since been unplugged must fall back rather than leave the island
 * logically attached to a monitor that no longer exists — and nothing ever called it.
 * `resolveGeometry` hardcoded `screen.getPrimaryDisplay()`. So a user with three monitors
 * had no way to put the island on the second one, and the fallback logic was dead code.
 */
function displayList(): DisplayLike[] {
  try {
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      bounds: { ...d.bounds },
      workArea: { ...d.workArea },
      scaleFactor: d.scaleFactor,
      label: d.label,
    }));
  } catch {
    return [];
  }
}

function resolveGeometry(prefs: HaloPrefs = HALO_DEFAULTS): IslandGeometry {
  // Primary display is the default target (HALO §28). y comes from display.bounds,
  // NOT workArea — the island intentionally occupies the menu-bar strip (§16).
  const displays = displayList();
  const primary = screen.getPrimaryDisplay();
  const display =
    resolveTargetDisplay(
      displays,
      primary.id,
      prefs.displayId == null ? { type: 'primary' } : { type: 'display', displayId: prefs.displayId },
      primary.id,
    ) ?? {
      id: primary.id,
      bounds: { ...primary.bounds } as IslandGeometry['displayBounds'],
      workArea: { ...primary.workArea } as IslandGeometry['displayBounds'],
      scaleFactor: primary.scaleFactor,
    };

  return computeGeometry({
    displayId: display.id,
    displayBounds: { ...display.bounds },
    workArea: { ...display.workArea },
    scaleFactor: display.scaleFactor,
    edge: prefs.edge,
    // The notch is measured as absent. HALO §162 bans identifying a display by a
    // hardcoded resolution, and there is no notch probe on this platform yet — the
    // calibration deltas below are the honest escape hatch for a user who needs to
    // compensate for their hardware.
    notch: { hasNotch: false, width: 0, height: 0, source: 'none' },
    /* THE SIZE SETTING NOW DRIVES GEOMETRY.
     *
     * This used to pass `expandedWidth: HALO_SIZE_TOKENS.expandedWidth` — a hardcoded 460.
     * `computeGeometry` treated a non-zero calibration width as an override, so the Figma
     * presets (480 / 560 / 680) could never take effect no matter what the user picked in
     * Settings. The size model is now the ONLY source of the surface, so the honest fix is to
     * pass the resolved preset and drop the constant.
     *
     * `wingWidth` stays: it is a genuine notch calibration knob, unrelated to size. */
    size: resolveHaloSize(prefs.scale),
    calibration: {
      wingWidth: DEFAULT_CALIBRATION.wingWidth,
    },
    hotZone: { padX: prefs.trigger.padX, padY: prefs.trigger.padY },
  });
}
function resolveGeometryForBounds(prefs: HaloPrefs, bounds: Electron.Rectangle): IslandGeometry {
  const display = {
    id: 0,
    bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    workArea: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    scaleFactor: 1,
  };
  return computeGeometry({
    displayId: display.id,
    displayBounds: { ...display.bounds },
    workArea: { ...display.workArea },
    scaleFactor: display.scaleFactor,
    edge: prefs.edge,
    notch: { hasNotch: false, width: 0, height: 0, source: 'none' },
    size: resolveHaloSize(prefs.scale),
    calibration: { wingWidth: DEFAULT_CALIBRATION.wingWidth },
    hotZone: { padX: prefs.trigger.padX, padY: prefs.trigger.padY },
  });
}


async function loadIsland(win: BrowserWindow): Promise<void> {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await win.loadURL(`${devUrl.replace(/\/$/, '')}/halo.html`);
    return;
  }
  // Production is served over HTTP by the app's own static server, NOT loadFile:
  // a `file://` document with a module script is the documented black-screen
  // class in this repo (AGENTS.md §8 root cause 7).
  const base = process.env.RHEO_SERVER_URL || 'http://localhost:38123';
  await win.loadURL(`${base}/halo.html`);
}

/**
 * WHY THE ISLAND VANISHED OVER OTHER APPS, AND WHY `pop-up-menu` WAS THE WRONG LEVEL
 * ---------------------------------------------------------------------------
 * THE REPORT: the island showed while RHEO was focused and disappeared the moment the user
 * switched to any other application. Everything else — sizing, content, settings — was fine.
 *
 * TWO COMPOUNDING CAUSES, both confirmed against this machine rather than guessed:
 *
 * 1. THE WRONG LEVEL FOR THIS COMPOSITOR. The Linux branch was
 *    `setAlwaysOnTop(true, 'pop-up-menu')`. Electron maps those level strings to X11
 *    `_NET_WM_STATE_ABOVE`, which is an ADVISORY HINT: it asks the window manager to keep the
 *    window above others. It is honoured by an X11 WM and is best-effort at best here, because
 *    this session is NATIVE WAYLAND (verified: `XDG_SESSION_TYPE=wayland`, `XDG_CURRENT_DESKTOP=KDE`)
 *    while RHEO is an XWAYLAND CLIENT (verified: the process runs with `--ozone-platform=x11`,
 *    forced by `start-dev.sh:368`). KDE therefore arbitrates between an XWayland client hint and
 *    a real native Wayland surface, and a native window that takes focus wins. Firefox, VS Code
 *    and WebStorm are all native Wayland — which is why the island survived over RHEO (same
 *    XWayland stack, same arbitration) and vanished over everything else.
 *
 *    `'screen-saver'` is the strongest level Electron offers and is what the macOS branch
 *    already used. It maps to `_NET_WM_STATE_ABOVE` plus a raised relative level, which is the
 *    strongest stacking request available WITHOUT layer-shell. That is the correct ask here.
 *
 * 2. IT WAS ASKED FOR EXACTLY ONCE, AT CREATION. `applyAlwaysOnTop` was called a single time
 *    from the constructor, before the window was ever shown. Two things demote a window
 *    afterwards, both of which happen constantly on a live desktop: a workspace change and a
 *    display change. `setVisibleOnAllWorkspaces(true)` covers the first only on X11; and
 *    `reconcileHaloGeometry` — the single function every display-topology event flows through —
 *    never re-asserted the stacking level. So after any monitor or workspace event the island
 *    was left at whatever stacking state it happened to inherit.
 *
 * WHAT THIS DOES NOT FIX, STATED PLAINLY: on XWayland there is no client-side way to guarantee
 * a layer. A true overlay needs `zwlr_layer_shell_v1`, which this compositor DOES advertise
 * (verified, version 5), but Electron exposes no API for it. The robust fix is to run the app
 * as a NATIVE Wayland client — `--ozone-platform=wayland` — or to move the island into a GTK/
 * layer-shell helper. Until that is done, `screen-saver` plus re-assertion is the strongest
 * available request, and it is honest to say it is a request rather than a guarantee.
 */
function applyAlwaysOnTop(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  const attempt = (level?: 'screen-saver' | 'pop-up-menu' | 'floating'): void => {
    if (level) win.setAlwaysOnTop(true, level, 1);
    else win.setAlwaysOnTop(true);
  };
  try {
    if (isMac) attempt('screen-saver');
    /* `screen-saver` is the TOP level in Electron's enum — stronger than `pop-up-menu`.
     * Using it on Linux is the point of this change; see the note above. */
    else if (isLinux) attempt('screen-saver');
    else attempt('floating');
  } catch {
    try {
      attempt();
    } catch {
      /* platform refused; the island still shows in-window */
    }
  }
}

/**
 * RE-ASSERT STACKING. Called from `reconcileHaloGeometry`, so it runs on every display change,
 * workspace change and power event — the three things that demote an always-on-top window on a
 * live desktop.
 *
 * This is deliberately not called from the hover poll: §11 forbids resizing the window from a
 * timer tick, and a stacking re-assert is the same class of compositor poke. Geometry changes
 * are the correct trigger, and they are not per-frame.
 */
function reassertStacking(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  applyAlwaysOnTop(win);
  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch {
    /* not supported on every platform */
  }
}

/**
 * COLLAPSED: clicks fall through to whatever is underneath. EXPANDED: the island is
 * interactive, so it must receive events (HALO §13).
 *
 * THIS FUNCTION ONLY SETS THE PASS-THROUGH FLAG. The click REGION is `applyClickRegion`'s
 * job. They used to be conflated, which is the bug the user reported: turning the island
 * interactive handed the whole 520x300 transparent window to the compositor, so clicks on
 * empty canvas — right next to the user's actual content — were swallowed.
 */
function setClickThrough(win: BrowserWindow, collapsed: boolean): void {
  try {
    win.setIgnoreMouseEvents(collapsed, collapsed ? { forward: true } : undefined);
  } catch {
    /* ignore */
  }
}

/**
 * THE HOVER HITBOX MUST NEVER BLOCK CLICKS.
 * ==========================================
 * This is the single most important invariant in the file, and it is why the hit zone and
 * the click region are two different rectangles derived from the same surface rect.
 *
 * The problem it solves: an always-on-top window sits over the user's real work. If the
 * window's click region is its full canvas, then expanding the island — or just hovering it
 * — can intercept clicks aimed at the app underneath, near where the user is working. The
 * user asked for a bigger hitbox to make hovering reliable; the naive way to deliver that
 * makes the island steal clicks, which is worse than a hitbox that is too small.
 *
 * So the two are separated, and the separation is enforced by the WINDOW SYSTEM rather than
 * by CSS:
 *
 *   collapsed -> `setIgnoreMouseEvents(true, {forward:true})`. The window is transparent to
 *                the mouse entirely; the cursor still reaches the app below, and the island
 *                only learns about the cursor because the main process POLLS
 *                `screen.getCursorScreenPoint()`. A 200px `padY` therefore costs the user
 *                nothing but a slightly earlier open.
 *   expanded  -> `setIgnoreMouseEvents(false)` AND, where the platform supports it,
 *                `setShape([surfaceRect])`. `setShape` is an X11/Win32 SHAPE, so the
 *                compositor routes a click to this window only if it lands inside the
 *                painted surface. The transparent canvas around it belongs to the app
 *                underneath again.
 *
 * WHY `setShape` RATHER THAN CSS `pointer-events`
 * `.halo-root` is already `pointer-events: none` with `.halo-surface { auto }`, and on a
 * normal page that is sufficient. It is NOT sufficient for an always-on-top window: once
 * the OS has delivered the event to this window, whether the click then reaches the window
 * underneath depends on the compositor, and on X11 it does not. Only a real window shape
 * makes it deterministic. That is the difference between "usually does not interfere" and
 * "cannot interfere", and the user asked for the second one.
 *
 * `setShape` is supported on Linux and Windows. It throws elsewhere (notably macOS), which
 * is why `clickShield: 'canvas'` remains selectable and why every call is guarded.
 */
function applyClickRegion(h: HaloHandle, prefs: HaloPrefs): void {
  const win = h.window;
  if (win.isDestroyed()) return;

  if (!h.expanded) {
    /* COLLAPSED — SHAPE TO THE PILL. NOT `setShape([])`.
     *
     * `setShape([])` was here, commented "no click region at all". That comment was wrong and
     * it is the single reason the user has to steer around the island.
     *
     * Electron documents an empty rect array as RESETTING THE WINDOW TO A RECTANGLE — it is not
     * an empty input region, and it is not pass-through. So every collapsed tick was re-shaping
     * the whole window back to its full native rectangle. With the Small preset that is
     * 480 x 118 = 56,640px2 of clickable area, of which the visible pill is 182 x 28 = 5,096px2.
     * The other ~91% was transparent canvas sitting on top of the user's other applications,
     * swallowing every click in it. That is exactly "it is a separate window I have to avoid to
     * access the app".
     *
     * The shape must be the PAINTED SURFACE, which is the same principle the expanded branch
     * below already follows: a click region equal to the visible rect, and nothing else.
     *
     * `setClickThrough(true, {forward:true})` alone would also pass clicks through, but
     * `forward` is documented for mouse-MOVE events and is only supported on macOS/Windows — on
     * Linux it is ignored. So on this machine the shape is the only thing making the collapsed
     * island honest, which is why it must be correct rather than merely reset.
     *
     * `computeSurfaceRect` is SHARED with the window placement and the hot zone, so the pill
     * painted by the renderer, the rect the hover test uses, and the rect that accepts clicks
     * cannot drift apart. */
    setClickThrough(win, true);
    try {
      const pillRect = computeSurfaceRect(h.geometry.canvas, h.geometry.compactSize, h.geometry.edge);
      win.setShape([
        {
          x: Math.round(pillRect.x - h.geometry.canvas.x),
          y: Math.round(pillRect.y - h.geometry.canvas.y),
          width: Math.round(pillRect.width),
          height: Math.round(pillRect.height),
        },
      ]);
      diag('click-region-shaped', {
        phase: 'compact',
        surface: `${Math.round(pillRect.width)}x${Math.round(pillRect.height)}`,
        canvas: `${Math.round(h.geometry.canvas.width)}x${Math.round(h.geometry.canvas.height)}`,
      });
    } catch {
      /* platform has no window shapes; pass-through still covers this phase */
    }
    return;
  }

  setClickThrough(win, false);

  /* `clickShield: 'canvas'` USED TO RETURN HERE — before `setShape` was ever reached.
   *
   * That made the setting mean "the entire 520x300 transparent window is one big click
   * region", which is exactly the "hitbox blocks my clicks" complaint: the empty canvas
   * around the painted panel became live desktop. HALO §12 says "the invisible canvas must not
   * become an accidental interaction region" and §13 says "do not make the overlay
   * permanently intercept desktop clicks". Neither permits this.
   *
   * The setting is retained for compatibility with stored prefs, but it NO LONGER SKIPS
   * `setShape`: the shape is always applied, so the click region is always the painted
   * surface. A stored `clickShield: 'canvas'` can no longer reproduce the old interception.
   */

  /* THE SIZE MUST COME FROM THE TOKENS THE RENDERER PAINTS WITH.
   *
   * A numeric probe caught this being wrong. `geometry.expandedSize` resolves to
   * `{ width: calibration.expandedWidth, height: calibration.expandedHeight || MAX_CANVAS_HEIGHT }`,
   * and `expandedHeight` is 0 unless a caller sets it — so it silently became 460x300, the
   * whole CANVAS. Shaping the click region to that made the island swallow clicks across the
   * entire transparent window, which is precisely the interference the user reported: a large
   * hitbox appeared to "block clicks near the stuff". The hitbox padding was never the cause;
   * the click region was simply the canvas.
   *
   *
   * ORIGINALLY this came from `scaled(HALO_SIZE_TOKENS, prefs.scale)`, justified by a comment
   * saying it was "the exact call `OverlayRoot` makes to decide what to paint". That was true
   * when both halves used the legacy token bag, and became FALSE the moment the renderer moved
   * to the S/M/L preset — which is how the two halves silently diverged a second time. A
   * numeric probe caught it before it shipped:
   *
   *     surface (painted) 480x116   click region (computed) 391x201
   *       ->  89px of the VISIBLE surface would NOT be clickable
   *       ->  85px of EMPTY CANVAS below the surface WOULD be clickable
   *
   * That is the original interception bug recreated by another route, and it was reachable
   * only because the comment ASSERTED a coupling instead of testing it. A comment claiming two
   * call sites are the same is not evidence that they are.
   *
   * THE FIX IS TO USE THE GEOMETRY, which is now trustworthy. It stopped being trustworthy for
   * exactly one reason — `expandedHeight: 0 || MAX_CANVAS_HEIGHT` substituted the canvas for
   * the content height — and that fallback is gone: the surface comes from the size preset,
   * which states both numbers explicitly. `geometry.expandedSize` is therefore the single
   * source of truth for the surface, shared by the window, the trigger zone and the click
   * region. `scaled()` is no longer used here at all. */
  const surface = computeSurfaceRect(
    h.geometry.canvas,
    h.expanded ? h.geometry.expandedSize : h.geometry.compactSize,
    prefs.edge,
  );

  /* THE PINNED CASE — AND IT IS THE ONE THAT MATTERS.
   *
   * Verified from the diagnostic trail: `setShape` works on this XWayland box (14 recorded
   * `click-region-shaped` events, zero `click-region-UNSUPPORTED`), so the window really is
   * shaped to the painted panel and the surrounding canvas genuinely passes clicks through.
   * That is fixed.
   *
   * What the trail also exposed is a flaw I introduced: `clickOutside` is sent from the
   * island's OWN document listener, so it can only ever fire for clicks that reached the
   * island. Once the window is SHAPED, clicks outside the shape do not reach it — the
   * handler I added for HALO 51 "click outside -> unpin + collapse" is physically incapable
   * of running. The consequence is the exact complaint: a PINNED island never collapses on
   * its own and holds a 460x236 band of the screen against the user's clicks until they
   * press Escape.
   *
   * So a pinned island gets a DIFFERENT, much smaller click region: the 30px tab rail, which
   * is the only part that is genuinely interactive (the rail buttons and the pin). The rest
   * of the panel keeps rendering, keeps showing its data, and stops intercepting anything.
   *
   * Hover-open (unpinned) keeps the FULL surface, because in that state the island appeared
   * because the pointer is already on it and the user is about to interact with it.
   */
  /* PINNED — THE FULL SURFACE, NOT JUST THE RAIL.
   *
   * This previously shrank a pinned island's click region to `PINNED_CLICK_H` (the tab rail),
   * on the reasoning that `clickOutside` is sent from the island's own document listener and so
   * can only fire for clicks that REACHED the island — therefore a pinned island needed a
   * smaller region to avoid holding the screen. But that inverts the requirement: with a 30px
   * shape, clicking anywhere on the visible panel — its data, its buttons, its scroll area —
   * lands OUTSIDE the shape, never reaches the document, and is swallowed by the window
   * manager. The user sees a pinned island they cannot click.
   *
   * HALO §51 requires `click outside -> unpin + collapse`. For that to be possible at all the
   * panel itself must be live, and "outside" must mean outside the SURFACE. So pinned uses the
   * same full surface as hover-open; the difference is only that a pinned island does not close
   * on pointer-leave. */
const region = surface;

  try {
    win.setShape([
      {
        x: Math.round(region.x - h.geometry.canvas.x),
        y: Math.round(region.y - h.geometry.canvas.y),
        width: Math.round(region.width),
        height: Math.round(region.height),
      },
    ]);
    diag('click-region-shaped', {
      w: Math.round(region.width),
      h: Math.round(region.height),
      pinned: h.pinned,
      surfaceH: Math.round(surface.height),
    });
  } catch (e) {
    // macOS and any composited path: fall back to the canvas region rather than leaving a
    // stale shape behind, and record it so the limitation is visible in the trail.
    diag('click-region-UNSUPPORTED', { message: String((e as Error)?.message ?? e).slice(0, 160) });
    try {
      win.setShape([]);
    } catch {
      /* nothing further to try */
    }
  }
}

  /* THE ISLAND NO LONGER LIVES IN ITS OWN WINDOW.
  /* THE ISLAND NO LONGER LIVES IN ITS OWN WINDOW.
   *
   * This sent `halo:hover` to `h.window.webContents`. That window is now never created (see the
   * DELETED block at :781) — the island renders inside RHEO's main renderer via
   * `features/halo/HaloInAppMount.tsx`. Every hover push was therefore delivered to an absent
   * webContents and the island received nothing, which is exactly why it stopped responding to the
   * pointer even while the user was INSIDE RHEO. Pointer detection always worked; only the
   * DELIVERY target was wrong.
   *
   * `getAllWindows()[0]` is the main window: the halo window is never created, so the only other
   * BrowserWindow in the process is RHEO's own. */
  /* THE IN-APP ISLAND HAS NO WINDOW OF ITS OWN.
   *
   * In-app mode (`handle.inApp`) mounts `OverlayRoot` inside RHEO's MAIN renderer via
   * `HaloInAppMount`, so `handle.window` is a placeholder whose `webContents.send` is a no-op.
   * Every push therefore has to be addressed to the main window, or the renderer hears nothing:
   * no `halo:prefs` (so the capsule could not be switched off), no `halo:hover` (so hover never
   * opened anything), no `halo:geometry`, no `halo:snapshot`.
   *
   * PRIMARY ONLY, deliberately: this carries the IN-APP hover FSM's verdict (the cursor polled
   * against the in-app geometry). The offscreen copy receives its hover from the layer host's
   * pointer stream instead (main.ts forwards `enter`/`leave` as `halo:hover`); echoing this one
   * there would open the cross-app capsule whenever the cursor touched the in-app island. */
  function pushHover(h: HaloHandle): void {
    const target = h.inApp ? BrowserWindow.getAllWindows()[0] : h.window;
    if (!target || target.isDestroyed()) return;
    target.webContents.send('halo:hover', { inside: h.hover.hovered, pinned: h.pinned });
  }

/* THE ISLAND CAN BE RENDERED IN TWO PLACES AT ONCE, and both need the same stream.
 *
 * The primary is the in-app copy (the main window) or, in legacy mode, the island's own window.
 * The extras are the offscreen `halo.html` window(s) that produce the frames the windowless
 * compositor paints — same `OverlayRoot`, same preload, same channels, but they were never
 * addressed: the cross-app capsule showed the "No app detected" fixture while the in-app pill
 * showed the real tracked app, because every push stopped at the main window. */
function islandRenderers(h: HaloHandle, deps: HaloDeps): BrowserWindow[] {
  const out: BrowserWindow[] = [];
  const primary = h.inApp ? BrowserWindow.getAllWindows()[0] : h.window;
  if (primary && !primary.isDestroyed()) out.push(primary);
  for (const w of deps.extraTargets?.() ?? []) {
    if (w && !w.isDestroyed() && w !== primary) out.push(w);
  }
  return out;
}

function pushSnapshot(h: HaloHandle, deps: HaloDeps): void {
  const snapshot = deps.snapshotProvider();
  for (const target of islandRenderers(h, deps)) {
    target.webContents.send('halo:snapshot', snapshot);
  }
}

/**
 * Push the CURRENT preferences to whichever renderer actually hosts the island.
 *
 * Same reason as `pushSnapshot`/`pushHover`: in-app mode has no window of its own, so the
 * placeholder's no-op `send` swallowed `halo:prefs` — which is why every Settings change in that
 * section (shape, size, resident, enabled) was stored in the database and then ignored.
 */
function pushPrefs(h: HaloHandle, deps: HaloDeps, prefs: HaloPrefs): void {
  for (const target of islandRenderers(h, deps)) {
    try {
      target.webContents.send('halo:prefs', prefs);
    } catch {
      /* the renderer may be mid-reload; the next reconcile resends */
    }
  }
}

/* The offscreen renderer is created asynchronously and loads AFTER the island's construction
 * push, so it can miss `halo:prefs` entirely and render on defaults — including `enabled` and
 * `resident`, the two prefs that decide whether anything is painted at all. The poll tick sends
 * the current prefs the first time a new target is seen AND fully loaded; the `isLoading` gate
 * protects the one shot, because a send before the preload has registered its ipcRenderer
 * listeners is silently dropped. */
const primedExtraTargets = new WeakSet<BrowserWindow>();

function primeExtraTargets(deps: HaloDeps, prefs: HaloPrefs): void {
  for (const w of deps.extraTargets?.() ?? []) {
    if (!w || w.isDestroyed() || primedExtraTargets.has(w)) continue;
    try {
      if (w.webContents.isLoading()) continue;
    } catch {
      continue;
    }
    primedExtraTargets.add(w);
    try {
      w.webContents.send('halo:prefs', prefs);
      diag('extra-target-primed', { wcId: w.webContents.id });
    } catch {
      /* mid-reload; it falls back to defaults instead of crashing the tick */
    }
  }
}

function stopPolling(h: HaloHandle): void {
  if (h.timer) {
    clearInterval(h.timer);
    h.timer = null;
  }
}

/**
 * Hover polling.
 *
 * THIS WAS BROKEN TWO WAYS, and both symptoms the user reported came from here:
 *
 * 1. "sometimes it just doesn't open when hovered". `screen.getCursorScreenPoint()`
 *    THROWS on some compositors. The old `catch { return; }` bailed out of the tick
 *    body without rescheduling, so the interval kept firing but the FSM was starved of
 *    input — and because the return happened before any `intent` was produced, nothing
 *    was ever pushed and the island sat closed forever. We now treat a throw as
 *    "cursor unavailable" and fall through to the intent step with `inside: false`,
 *    so the FSM always advances and the timer is never starved.
 *
 * 2. "sometimes it's stuck open". The old code called `startPolling(h, deps)` from INSIDE
 *    the open/close branches, which does `stopPolling` + a fresh `setInterval`. That is
 *    a reschedule inside the callback of the interval being rescheduled — it works by
 *    accident when the rates are equal and compounds/leaks when they are not, and it
 *    means the poll rate depends on how many transitions happened. The interval is now
 *    created ONCE here; the open/close branches only flip `setClickThrough`, and the
 *    rate is switched by a plain field the tick reads. No reschedule from inside tick.
 */
let lastCursorFallbackAtMs = 0;
let cursorFallbackBroken = false;
/* The last point the NATIVE source confirmed, and when. Reused on rate-limited ticks so a
 * spawn budget never turns into "cursor unavailable" — which is the very failure this whole
 * fallback exists to prevent. A point up to CURSOR_POINT_MAX_AGE_MS old is well inside the
 * FSM's own open delay and leave margin, so staleness here is not observable. */
let lastNativePoint: { x: number; y: number } | null = null;
let lastNativePointAtMs = 0;

const CURSOR_FALLBACK_MIN_INTERVAL_MS = 200;
const CURSOR_POINT_MAX_AGE_MS = 300;

/**
 * Read the pointer, falling back to a native Wayland source.
 *
 * `screen.getCursorScreenPoint()` is free and correct on X11/XWayland, so it stays first. On
 * NATIVE Wayland it cannot see the pointer at all — and the old code treated that failure as
 * "the pointer is elsewhere", which is why the island never opened on hover for anyone on
 * Wayland. A null point is now only produced when BOTH the Electron call and the native source
 * fail, or the cached native point has aged out.
 *
 * The fallback spawns a process (measured 15-21ms for kdotool on this box), so it is
 * rate-limited — and when rate-limited it serves the CACHED point rather than null. `null`
 * means "I do not know where the pointer is", which the FSM reads as "not hovering"; returning
 * it merely to save a spawn would reintroduce the original bug at a slower cadence.
 */
async function readCursorPoint(): Promise<{ x: number; y: number } | null> {
  try {
    return screen.getCursorScreenPoint();
  } catch {
    /* native Wayland — fall through to the compositor-native read */
  }
  if (cursorFallbackBroken) return null;

  const now = Date.now();
  if (lastNativePoint && now - lastNativePointAtMs < CURSOR_POINT_MAX_AGE_MS) {
    return lastNativePoint;
  }
  if (now - lastCursorFallbackAtMs < CURSOR_FALLBACK_MIN_INTERVAL_MS) {
    return lastNativePoint;
  }
  lastCursorFallbackAtMs = now;
  try {
    const p = await getLinuxCursorPoint();
    if (p) {
      lastNativePoint = p;
      lastNativePointAtMs = Date.now();
      return p;
    }
    return null;
  } catch {
    // No native source on this desktop. Stop trying rather than spawning per tick.
    cursorFallbackBroken = true;
    return null;
  }
}

/**
 * How often the island re-publishes its data snapshot while it is alive.
 *
 * 1 Hz. The pill's purpose is to report the CURRENT foreground app, so it must not be pushed
 * only at creation; and the tick itself runs at 40-120ms, which would make a full snapshot pull
 * far too expensive for data that changes at human speed.
 */
const SNAPSHOT_PUSH_INTERVAL_MS = 1000;

/** Timestamp of the last snapshot push, per process. See `SNAPSHOT_PUSH_INTERVAL_MS`. */
let lastSnapshotPushAtMs = 0;

function startPolling(h: HaloHandle, deps: HaloDeps): void {
  stopPolling(h);
  /* `pending` exists because the cursor read is now ASYNC (it may spawn a helper). Two ticks
   * must never be in flight at once, or two reads race and the slower one wins the tick. */
  let pending = false;
  const tick = async () => {
    if (pending) return;
    pending = true;
    try {
    if (h.window.isDestroyed()) {
      stopPolling(h);
      return;
    }
    const point = await readCursorPoint();
    /* Re-read the preferences EVERY TICK rather than capturing them at startPolling().
     * This is what makes a hitbox or timing change in Settings apply to a live island
     * without a restart. It is cheap: `readPrefs` is a property read on an in-memory bag
     * plus `normalizeHaloPrefs`, and the tick runs at most every 40ms. Capturing instead
     * would mean every timing control in Settings only worked after a restart, which is
     * the same stored-but-dead defect as the pin button. */
    const prefs = normalizeHaloPrefs(deps.prefs());
    const hoverConfig = hoverConfigFor(prefs);
    const hoverEnabled = prefs.trigger.mode === 'hover' || prefs.trigger.mode === 'hover-or-click';

    /* WHICH TRIGGER RECT — THIS IS THE WHOLE FIX.
     *
     * The FSM used to test `h.geometry.hotZone` unconditionally, and that rect is the
     * COMPACT 232x40 pill. So the island opened correctly on the pill and then, the moment
     * the cursor moved down onto the 460x236 expanded panel — the single most natural thing
     * to do after opening it — `inside` flipped to false, the close timer started, and the
     * island shut itself under the cursor. A numeric probe measured 4 of 6 sample cursor
     * positions sitting on the island's own painted surface reporting `inside: false`.
     *
     * `inside` must be true for every pixel the user can SEE, in BOTH phases:
     *
     *   collapsed -> `hotZone`         the visible small pill only. Touch it to open; do not
     *                                  wander 200px away and have it grab you.
     *   expanded  -> `hotZoneExpanded` the union of that pill and the expanded panel, so
     *                                  moving anywhere on the island keeps it open and moving
     *                                  off it closes it.
     *
     * Selecting on `h.expanded` (and falling back to the compact rect) keeps the transition
     * monotonic: both rects contain the pill, so there is no frame where the surface being
     * painted is not also a trigger.
     *
     * The `??` is load-bearing, not decoration: an older geometry object without the new
     * field must degrade to the compact pill, never to `undefined` and never to the whole
     * canvas. A size field defaulted with `a || FALLBACK` silently becomes the FALLBACK,
     * and the fallback here must be the smallest sensible rect, not the biggest.
     *
     * With no cursor reading we treat it as OUTSIDE, which drives the FSM toward collapsed —
     * the safe direction for a stuck-open island. */
    const triggerRect =
      (h.expanded ? h.geometry.hotZoneExpanded : undefined) ?? h.geometry.hotZone;
    const inZone =
      hoverEnabled && point !== null
        ? pointInHotZone(triggerRect, point.x, point.y, hoverConfig.leaveMarginPx)
        : false;
    const next = stepHover(
      h.hover,
      { now: Date.now(), inside: inZone, pinned: h.pinned },
      hoverConfig,
      prefs.trigger.mode,
    );

    if (next.intent !== 'none') pushHover(h);

    /* THE SNAPSHOT MUST BE RE-PUSHED, NOT PUSHED ONCE.
     *
     * `pushSnapshot` was only called from `did-finish-load`, `reconcileHaloGeometry` and island
     * creation. None of those fire while the user simply SWITCHES APPS — and the island's whole
     * job is to say which app is in front. So the pill showed whatever was true when the island
     * was created and then never changed again: "No app detected" (or a permanently stale app)
     * for as long as the app stayed open.
     *
     * It is pushed on an interval rather than on every tick, because the tick runs at 40-120ms
     * and a snapshot is a full data pull; 1 Hz is well inside the "not driving an animation"
     * budget and is fast enough that the pill is never meaningfully behind the real foreground
     * app. The digest channel is additive: the renderer merges `halo:snapshot` over whatever it
     * already had, so a partial update cannot blank a field the previous push carried. */
    const nowMs = Date.now();
    if (nowMs - lastSnapshotPushAtMs >= SNAPSHOT_PUSH_INTERVAL_MS) {
      lastSnapshotPushAtMs = nowMs;
      pushSnapshot(h, deps);
      primeExtraTargets(deps, prefs);
    }

    if (next.intent === 'open' && !h.expanded) {
      h.expanded = true;
      h.hover = next.state;
      applyClickRegion(h, prefs);
      h.pollMs = POLL_EXPANDED_MS; // §47 faster poll while open — NO reschedule
    } else if (next.intent === 'close' && h.expanded) {
      h.expanded = false;
      h.hover = next.state;
      applyClickRegion(h, prefs);
      h.pollMs = POLL_COLLAPSED_MS;
    } else {
      h.hover = next.state;
    }
    } finally {
      pending = false;
    }
  };
  h.pollMs = h.expanded ? POLL_EXPANDED_MS : POLL_COLLAPSED_MS;
  h.timer = setInterval(tick, h.pollMs);
}

/**
 * Creates the island exactly once and keeps it alive (HALO §115). Destroying and
 * recreating per notification is what makes overlays feel broken.
 */
export async function createHaloIsland(deps: HaloDeps): Promise<BrowserWindow | null> {
  if (handle && !handle.window.isDestroyed()) return handle.window;
  if (creating) return creating;

  creating = (async () => {
    const prefs = normalizeHaloPrefs(deps.prefs());
    if (!prefs.enabled) {
      return null;
    }
      /* GEOMETRY FOR IN-APP ISLAND.
       *
       * The original code used display bounds (screen coordinates) for the canvas and hot zone.
       * The island now renders inside RHEO's main renderer via CSS at top-center of the viewport.
       * If the main window is not at screen (0,0), screen-space hot zone != in-app island position.
       *
       * Fix: use the MAIN WINDOW's screen bounds as the geometry reference when the halo window
       * is disabled. This makes the hot zone track the in-app island's actual screen position. */
      let geometry = resolveGeometry(prefs);
      const mainWin = BrowserWindow.getAllWindows()[0];
      if (!mainWin || mainWin.isDestroyed()) {
        // No main window -- keep display bounds (legacy path).
      } else {
        const mb = mainWin.getBounds();
        geometry = resolveGeometryForBounds(prefs, mb);
      }
      // The canvas is ALREADY clamped to the display inside `computeGeometry` -- it is
      // `min(HALO_CANVAS_WIDTH, safeW)` there. Re-clamping it here against the stale
      // `MAX_CANVAS_WIDTH = 520` / `MAX_CANVAS_HEIGHT = 300` produced a 520x300 window while
      // the renderer laid out into a 680-wide canvas, so the surface was clipped by 160px on the
      // right and the compact pill's height disagreed with main's geometry (the source of the
      // open/close flicker). The window IS the canvas: take it verbatim.
      const canvasW = geometry.canvas.width;
      const canvasH = geometry.canvas.height;

      /* ═══ DELETED PER ARCHITECT DECISION ══════════════════════════════════════
       * `generate-prompt-docs/halo-window-architecture-12102026/RESULT.md`:
       *
       *   "Delete the Halo `BrowserWindow` and all Halo-specific native-window
       *    hit-testing/stacking code."
       *
       * The island now renders inside RHEO's own renderer via
       * `features/halo/HaloInAppMount.tsx`, so there is nothing left for a second
       * toplevel to do. On XWayland that toplevel could never rise above a native
       * Wayland window, which is why the island never appeared over other apps; and
       * `setShape([])` resets a window to a full RECTANGLE rather than making it
       * click-through, which is why it ate clicks far outside the visible pill.
       *
       * Both failures are properties of BEING A WINDOW, not bugs to repair in it.
       * Everything below this point — `new BrowserWindow`, `setShape`,
       * `setIgnoreMouseEvents`, `showInactive`, the screen-saver stacking logic and
       * `applyClickRegion` — is deliberately unreachable and slated for removal.
       *
       * Consequences, stated plainly rather than discovered later:
       *   - The island is NOT visible over other applications. That is the ruling, not a
       *     regression: "no separate window" and "cross-app visible" are mutually
       *     exclusive on Wayland.
       *   - The compact-pill crop ("clipped by 160px on the right", documented in the
       *     comment below) came from this window being narrower than the canvas the
       *     renderer laid out into. With no second window there is no such mismatch.
       */
      /* LAYER-SHELL PATH: cross-app visibility via compositor layer surface.
       *
       * This uses the GTK4 layer-shell helper (native/halo-layer-shell/) which creates a
       * zwlr_layer_shell_v1 surface. The compositor places it in the overlay layer above
       * all normal windows, so the island is visible over Firefox, VS Code, etc.
       *
       * Research: agent/docs/halo/HALO_WINDOWLESS_COMPOSITOR_RESEARCH.md §82 "Best fallback
       * if a layer surface is acceptable" - strong input-region semantics, no app-owned
       * top-level window, works on KDE Wayland.
       *
       * ⚠ IT MUST NOT `return` FROM HERE — AND UNTIL THIS COMMENT IT DID, WHICH WAS FATAL.
       *
       * The branch below used to end in `return <fake window>`. Three things broke at once:
       *
       *   1. `handle` was never assigned, so `startPolling` never ran and NO `halo:hover` was
       *      ever sent. The renderer waits for hover (`if (!bridge?.onHover) return` — and
       *      preload always exposes it), so it never opened. This is "hovering does nothing".
       *   2. `applyHaloPrefs` opened with `if (!handle) return null`, so every Settings change —
       *      including switching the island OFF — returned before it could push anything. This
       *      is "the capsule does not hide when I turn it off".
       *   3. `await layerShellClient.start()` REJECTS when the helper is present but does not
       *      report ready, and that rejection propagated out of `createHaloIsland` into main.ts's
       *      catch, which then skipped `createHaloIsland` entirely. One failed helper launch
       *      disabled the whole island.
       *
       * The helper is also a WEBKIT view, not an Electron renderer: it has no `preload.cjs`, so
       * `window.haloBridge` does not exist inside it and the island renders with no data at all.
       *
       * So the layer shell is started as a BEST-EFFORT EXTRA and the in-app island — the one
       * that actually has a bridge, a React tree and the hover FSM — always comes up. The
       * cross-app path continues on the offscreen + KWin effect route
       * (`offscreenRenderer.ts`), which is the architecture the research actually selected.
       */
      const layerShellBinary = resolveLayerShellBinary(app.getAppPath());
      const layerShellClient = new HaloLayerShellClient(layerShellBinary);
      if (layerShellClient.isAvailable()) {
        try {
          await layerShellClient.start();
          const { canvas, compactSize, edge } = geometry;
          const pillRect = computeSurfaceRect(canvas, compactSize, edge);
          const url = process.env.VITE_DEV_SERVER_URL
            ? process.env.VITE_DEV_SERVER_URL.replace(/\/$/, '') + '/halo.html'
            : (process.env.RHEO_SERVER_URL || 'http://localhost:38123') + '/halo.html';
          layerShellClient.show(url, {
            x: Math.round(pillRect.x),
            y: Math.round(pillRect.y),
            w: Math.round(pillRect.width),
            h: Math.round(pillRect.height),
          });
          diag('layer-shell-shown', { w: Math.round(pillRect.width), h: Math.round(pillRect.height) });
        } catch (e) {
          /* LOUD but NON-FATAL. The in-app island is the primary surface; a helper that will not
           * start costs cross-app presence, not the island itself. */
          diag('layer-shell-FAILED', { message: String((e as Error)?.message ?? e).slice(0, 200) });
        }
      }

      // The in-app island is authoritative and ALWAYS comes up.
      console.log('[halo] in-app island active');
      /* IN-APP ISLAND: NO WINDOW, BUT POLLING MUST STILL RUN.
       *
       * `return null` here killed the BrowserWindow -- but it ALSO killed the hover polling,
       * because the timer, the handle and `pushHover` all live in this same function after the
       * window creation. The result was a double failure:
       *   - main: no `h.timer`, so no `halo:hover` was ever sent
       *   - renderer: `OverlayRoot` sees `bridge.onHover` exists (preload always exposes it),
       *     so it waits for `halo:hover` that never arrives -- and the local pointer fallback is
       *     skipped because of that same guard.
       * The island was dead on arrival, in-app AND cross-app.
       *
       * The fix: build the handle and start polling with a MINIMAL window placeholder, so the
       * hover FSM runs and `pushHover` (now targeting `getAllWindows()[0]` = the main window)
       * actually delivers. The placeholder is never shown and never loaded into. */
      const placeholder = {
        isDestroyed: () => false,
        webContents: { send: () => {}, on: () => {}, once: () => {} },
        on: () => placeholder,
        once: () => placeholder,
        show: () => {},
        hide: () => {},
        setShape: () => {},
        setIgnoreMouseEvents: () => {},
        isVisible: () => false,
        getBounds: () => geometry.canvas,
        setBounds: () => {},
        focus: () => {},
        blur: () => {},
        destroy: () => {},
      } as unknown as BrowserWindow;
      const placeholderHandle: HaloHandle = {
        window: placeholder,
        geometry,
        hover: initialHoverState(),
        pinned: false,
        timer: null,
        pollMs: POLL_COLLAPSED_MS,
        deps,
        expanded: false,
        prefs,
        /* THE FLAG THAT MAKES THE IPC WORK. Every push addresses `getAllWindows()[0]`
         * instead of this placeholder's no-op `webContents`. Without it the renderer receives
         * nothing at all — no prefs, no geometry, no snapshot, no hover. */
        inApp: true,
      };
      handle = placeholderHandle;
      lastDeps = deps;

      // Start the hover polling loop. This is what was missing.
      // BOTH arguments. `startPolling(h, deps)` takes two: the handle AND the deps object, which
      // `tick` closes over and re-reads every 40ms via `deps.prefs()`. Calling it with only the
      // handle left `deps` undefined and produced an unhandled rejection per tick:
      //   TypeError: Cannot read properties of undefined (reading 'prefs')
      // That is also why it was UNHANDLED rather than caught: `tick` is async and nothing awaits
      // it inside the interval, so a throw became a rejected promise, and a rejected promise every
      // 40ms is a log flood plus a dead hover loop.
      startPolling(placeholderHandle, deps);
      pushHover(placeholderHandle);
      /* THE RENDERER'S THREE STARTERS, all of which it never received before.
       *
       * `HaloInAppMount` mounts `OverlayRoot` into the MAIN renderer, whose document may already
       * be loaded by the time this runs — there is no `did-finish-load` for an in-app island to
       * hang these off, because there is no second document. So they are pushed here, once, and
       * again by `applyHaloPrefs` / `reconcileHaloGeometry` on every change.
       *
       * Order matters: geometry and prefs decide the SIZE and the LAYOUT, so they arrive before
       * the snapshot that fills them. */
      pushGeometry(placeholderHandle);
      pushPrefs(placeholderHandle, deps, prefs);
      pushSnapshot(placeholderHandle, deps);
      diag('in-app-island-live', {
        edge: prefs.edge,
        scale: prefs.scale,
        resident: prefs.resident,
        uiVersion: prefs.uiVersion,
        hotZone: `${Math.round(placeholderHandle.geometry.hotZone.width)}x${Math.round(placeholderHandle.geometry.hotZone.height)}@${Math.round(placeholderHandle.geometry.hotZone.x)},${Math.round(placeholderHandle.geometry.hotZone.y)}`,
      });

      return null;

    const win = new BrowserWindow({
      width: canvasW,
      height: canvasH,
      x: Math.round(geometry.canvas.x),
      y: Math.round(geometry.canvas.y),
      frame: false,
      // TRANSPARENCY. An earlier version used `transparent: !isLinux`, reasoning
      // from `focusManager.ts:233` (a FULLSCREEN overlay that some Wayland
      // compositors render opaque). That was the wrong precedent for a small
      // surface, and the visible result was exactly what it looks like: a huge
      // OPAQUE BLACK RECTANGLE covering the top of the screen, because with
      // `transparent: false` Chromium ignores `#00000000` entirely and paints the
      // whole canvas. The dictation panel this island replaced used
      // `transparent: true` at 340x92 and worked on this machine, so that is the
      // precedent that applies to a small island.
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      hasShadow: false,
      skipTaskbar: true,
      show: false,
      // Collapsed it must never steal focus from whatever the user is typing in
      // (HALO §14). It only becomes focusable if keyboard input is genuinely
      // required, which the current surface never is.
      /* `focusable: false` WAS HERE, AND IT IS PART OF WHY THE ISLAND VANISHED OVER OTHER APPS.
       *
       * §14 requires the island never to STEAL focus, and `focusable: false` was the blunt way
       * to honour that. But it also means the window never participates in focus at all, and on
       * this machine (native Wayland session, XWayland client — verified via
       * `XDG_SESSION_TYPE=wayland` and the process's `--ozone-platform=x11`) KWin does not
       * reliably raise a non-focusable window above a focused native client. The island then
       * existed, was sized and shaped correctly, and sat behind Firefox/VS Code — which is
       * exactly the symptom, because every other layer was already correct.
       *
       * `focusable: true` makes the window ABLE to take focus, which is not the same as TAKING
       * it. §14 is still honoured where it actually matters:
       *   - the window is created `show: false` and shown with `showInactive()`, never `focus()`,
       *   - `win.focus()` is not called anywhere in this file,
       *   - the collapsed surface is `setIgnoreMouseEvents(true, {forward: true })`, so a click
       *     anywhere on it reaches the application underneath rather than focusing the island.
       * So the user can still never be interrupted mid-sentence by the island grabbing the
       * keyboard, while the compositor is now willing to raise it.
       */
      focusable: true,
      webPreferences: {
          /* `__dirname` is `dist-electron/`, so this MUST be './preload.cjs'.
           *
           * It was '../../preload.cjs', which resolved to the REPO ROOT — one level above
           * `dist-electron/` — where no such file exists. Every launch printed:
           *   Unable to load preload script: .../COMPUTAH_SAYENCE/preload.cjs
           *   Error: ENOENT: no such file or directory
           * and the island ran with NO preload at all.
           *
           * The failure was SILENT because every consumer of the bridge is optional-chained in
           * OverlayRoot.tsx (`if (!bridge?.onHover) return`, `if (!bridge?.onPrefs) return`,
           * `if (!bridge?.onSnapshot) return`). So main expanded the click region — the
           * `click-region-shaped w:560 h:134` line in halo-diagnostic.log proves it — while the
           * renderer received nothing: no hover (so the island never opened), no prefs (so the
           * `uiVersion: 'figma'` layout could never be selected), no snapshot.
           *
           * That is the whole "the Figma design doesn't apply and it doesn't open" report, and
           * why every Figma-layout change appeared to do nothing.
           *
           * Every OTHER window in the repo resolves this same file from `__dirname` directly:
           *   src/main.ts:18849  path.join(__dirname, 'preload.cjs')
           *   src/main.ts:30735  path.join(__dirname, 'preload.cjs')
           *   src/main/splash.ts:30  path.join(__dirname, 'preload.cjs')
           * (`focusManager.ts:227` legitimately uses '../../resources/...' — that file lives in
           * the repo, so two levels up is correct THERE.) Match the majority: one directory. */
          preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
nodeIntegration: false,
          // HALO §8 requires `sandbox: true`. It was `false`, which leaves the island's
          // renderer unsandboxed for no benefit: it loads a local document, talks only to the
          // preload bridge, and needs no Node.
          sandbox: true,
      },
    });

    applyAlwaysOnTop(win);
    try {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch {
      /* ignore */
    }

    const h: HaloHandle = {
      window: win,
      geometry,
      hover: initialHoverState(),
      pinned: false,
      timer: null,
      pollMs: POLL_COLLAPSED_MS,
      deps,
      expanded: false,
      prefs,
      /* UNREACHABLE legacy path (the in-app island returns long before this). Kept
       * type-correct so a future re-enable cannot silently address the wrong renderer. */
      inApp: false,
    };
    handle = h;
    lastDeps = deps;

    applyClickRegion(h, prefs);

    win.on('closed', () => {
      stopPolling(h);
      handle = null;
    });

    // A renderer reload must not require replaying history: resend the snapshot
    // and paint the current phase directly (HALO §44/§45).
    // Renderer console + load failures are the only evidence of what the island
    // surface actually did, and the renderer's console is not visible from the
    // terminal either. Mirror both into the same trail.
    win.webContents.on('console-message', (_e, level, message) => {
      if (level >= 2) diag('renderer', { level, message: String(message).slice(0, 300) });
    });
    win.webContents.on('did-fail-load', (_e, code, desc, url) => {
      diag('renderer-load-FAILED', { code, desc, url });
    });
    win.webContents.on('render-process-gone', (_e, details) => {
      diag('renderer-gone', { reason: details?.reason });
    });
    win.webContents.on('did-finish-load', () => {
      diag('renderer-loaded');
      pushSnapshot(h, deps);
      pushHover(h);
      // The renderer sizes its own surface, so it needs the scale factor; the
      // canvas itself is always the clamped maximum regardless of preference.
      win.webContents.send('halo:prefs', prefs);
      /* AND the fitted size, on the SAME event that `loadIsland` returns from. Without it the
       * renderer's first paint uses the un-fitted preset, so on a display narrow enough to
       * clamp, the island visibly overflows for one frame and then corrects — or, if the
       * push never arrives at all, keeps overflowing. Geometry must precede first paint. */
      pushGeometry(h);
    });

    diag('loading', { url: process.env.VITE_DEV_SERVER_URL ? 'dev' : 'prod' });
    await loadIsland(win);
    diag('loaded');

    // HALO §14: showInactive, never focus(). A HUD must never steal focus.
    // HALO §39: a MISPLACED island is worse than no island. Under native Wayland
    // Electron ignores the constructor's x/y, so the window can open in the middle
    // of the screen — which also drags the hot zone to the middle, so hover only
    // works over the centre. Verify the placement we actually got and refuse to
    // show a window that is not where it belongs.
    let actual: { x: number; y: number; width: number; height: number } | null = null;
    try {
      actual = win.getBounds();
    } catch {
      /* ignore */
    }
    if (actual) {
      const dx = Math.abs(actual.x - geometry.canvas.x);
      const dy = Math.abs(actual.y - geometry.canvas.y);
      // A few px of compositor rounding is fine; anything more means the compositor ignored
      // the constructor's x/y — which native Wayland does by design (HALO §36).
      //
      // THIS USED TO DESTROY THE WINDOW. That made the entire island vanish at startup on any
      // Wayland session where placement was refused: no window, no hover, no error, and
      // `createHaloIsland` returned null so nothing upstream complained. HALO §39 says a
      // MISPLACED island is worse than none — but "none" delivered by silently deleting the
      // window is not a fallback, it is the bug. §37 tier-C requires an EXPLICIT, quiet
      // fallback (system notification or in-app surface), never an invisible hitbox.
      //
      // So: re-assert the placement with `setBounds` (compositors that ignore the constructor
      // usually honour an explicit move — §27's async-generation pattern), verify again, and
      // ONLY then consider hiding. The window is always shown, because an island you can see
      // in the wrong place is recoverable and an island that never appears is not.
      if (dx > 24 || dy > 24) {
        diag('placement-off-RETRYING', {
          wanted: { x: geometry.canvas.x, y: geometry.canvas.y },
          got: actual,
          drift: { dx, dy },
          ozone: process.env.ELECTRON_OZONE_PLATFORM_HINT ?? '(unset)',
        });
        try {
          win.setBounds({
            x: Math.round(geometry.canvas.x),
            y: Math.round(geometry.canvas.y),
            width: canvasW,
            height: canvasH,
          });
        } catch (e) {
          diag('placement-retry-threw', {
            message: String((e as Error)?.message ?? e).slice(0, 200),
          });
        }
        let after: { x: number; y: number; width: number; height: number } | null = null;
        try {
          after = win.getBounds();
        } catch {
          /* ignore */
        }
        if (after) {
          const adx = Math.abs(after.x - geometry.canvas.x);
          const ady = Math.abs(after.y - geometry.canvas.y);
          if (adx <= 24 && ady <= 24) {
            diag('placement-RECOVERED-by-setBounds', {
              wanted: { x: geometry.canvas.x, y: geometry.canvas.y },
              got: after,
            });
          } else {
            // STILL misplaced after an explicit move. Show it anyway and say so, rather than
            // destroying it: the user can see it is in the wrong place, which is honest, and a
            // visible-but-misplaced island is still operable.
            diag('placement-STILL-OFF-after-retry', {
              wanted: { x: geometry.canvas.x, y: geometry.canvas.y },
              got: after,
              drift: { dx: adx, dy: ady },
              action: 'showing anyway — HALO §39 forbids an invisible hitbox',
            });
          }
        }
      } else {
        diag('placement-ok', { got: actual });
      }
    }

    let shownVia = 'showInactive';
    try {
      /* `showInactive` first, per §14 — a HUD must never steal focus. But on THIS machine
       * (native Wayland session, XWayland client) a `focusable: false` window is skipped by
       * the compositor for focus AND is not reliably raised, so `showInactive` on its own
       * produced a window that existed, was sized correctly, and still sat behind other
       * applications. `show()` is the fallback that guarantees the map+raise. */
      win.showInactive();
      /* THE STACKING ASSERT MUST FOLLOW THE MAP. Before the window is shown, an
       * always-on-top request has nothing to attach to — the compositor applies it when the
       * surface is mapped. Asking first and showing second is why a single call at
       * construction time was not enough. */
      reassertStacking(win);
    } catch (e) {
      shownVia = 'show';
      try {
        win.show();
        reassertStacking(win);
      } catch {
        shownVia = 'FAILED';
      }
      diag('showInactive-threw', { message: String((e as Error)?.message ?? e).slice(0, 200) });
    }

    startPolling(h, deps);
    diag('window-created', {
      display: geometry.displayId,
      x: geometry.canvas.x,
      y: geometry.canvas.y,
      canvas: `${canvasW}x${canvasH}`,
      hotZone: `${geometry.hotZone.width}x${geometry.hotZone.height}`,
      // BOTH trigger rects, always. The collapsed pill and the expanded union are different
      // rectangles, and a trail that only showed one of them is exactly what let a mismatched
      // trigger ship unnoticed: the log read a correct-looking 232x40 while the FSM was really
      // testing that same pill against a 460x236 panel.
      hotZoneCompact: `${geometry.hotZone.width}x${geometry.hotZone.height}@${geometry.hotZone.x},${geometry.hotZone.y}`,
      hotZoneExpanded: `${geometry.hotZoneExpanded.width}x${geometry.hotZoneExpanded.height}@${geometry.hotZoneExpanded.x},${geometry.hotZoneExpanded.y}`,
      expandedSize: `${geometry.expandedSize.width}x${geometry.expandedSize.height}`,
      transparent: true,
      shownVia,
      visible: win.isVisible(),
      ozone: process.env.ELECTRON_OZONE_PLATFORM_HINT ?? '(unset)',
    });
    return win;
  })();

  try {
    return await creating;
  } finally {
    creating = null;
  }
}

export function destroyHaloIsland(): void {
  if (!handle) return;
  stopPolling(handle);
  if (!handle.window.isDestroyed()) handle.window.destroy();
  handle = null;
}

export function isHaloIslandOpen(): boolean {
  return !!handle && !handle.window.isDestroyed();
}

/** Keyboard path for the island: raise it if it is collapsed, hide it if open. */
export function toggleHaloIsland(): void {
  if (!handle || handle.window.isDestroyed()) return;
  if (handle.pinned || handle.expanded) {
    handle.pinned = false;
    handle.expanded = false;
    handle.hover = initialHoverState();
    applyClickRegion(handle, handle.prefs);
  } else {
    handle.pinned = true;
    handle.expanded = true;
    applyClickRegion(handle, handle.prefs);
  }
  pushHover(handle);
}

/**
 * Sends a command to the island renderer.
 *
 * Replaces the old `requestSttRecordToggle()`, which used to `webContents.send`
 * the standalone dictation panel. Ctrl/Cmd+Shift+R is a GLOBAL shortcut, so it is
 * handled in the main process and has to be forwarded rather than handled in the
 * renderer — the island must be raised first, or the keystroke lands in whatever
 * application currently has focus and the island never sees it.
 */
export function sendHaloCommand(command: 'toggle-record' | 'show-dictation'): boolean {
  if (!handle || handle.window.isDestroyed()) return false;
  handle.pinned = true;
  handle.expanded = true;
  applyClickRegion(handle, handle.prefs);
  pushHover(handle);
  handle.window.webContents.send('halo:command', { command });
  return true;
}

/**
 * Move the native window to match a geometry. The ONLY place `setBounds` is called.
 *
 * HALO §11's allowlist means this is reached from exactly two kinds of event: a display
 * topology change, and an explicit user geometry change (`applyHaloPrefs` when edge, scale
 * or target display moved). It is never reached from a timer tick, a pointer move or an
 * animation frame.
 */
function moveWindowToGeometry(h: HaloHandle): void {
  if (h.window.isDestroyed()) return;
  // Same reasoning as `createHaloWindow`: the canvas is already display-clamped by
  // `computeGeometry`, so `setBounds` moves the existing canvas rather than resizing to a
  // second, smaller one. This is a MOVE, on the §11 allowlist — never an animation frame.
  const canvasW = h.geometry.canvas.width;
  const canvasH = h.geometry.canvas.height;
  try {
    h.window.setBounds({
      x: Math.round(h.geometry.canvas.x),
      y: Math.round(h.geometry.canvas.y),
      width: canvasW,
      height: canvasH,
    });
    // The window shape must follow the move, or the click region is left pointing at
    // stale coordinates.
    applyClickRegion(h, h.prefs);
  } catch {
    /* ignore */
  }
}

/** HALO §24/§25: one reconciler for every display topology event. */
export function reconcileHaloGeometry(): void {
  if (!handle || handle.window.isDestroyed()) return;
  // The provider captured at create time. reconcileHaloGeometry() takes no deps, so
  // without this the reconcile path could only push hardcoded nulls — the bug above.
  const deps: HaloDeps = handle.deps;
  handle.prefs = normalizeHaloPrefs(readPrefs());
  handle.geometry = resolveGeometry(handle.prefs);
  moveWindowToGeometry(handle);
  /* THE ONE PLACE THE FITTED SIZE CROSSES TO THE RENDERER.
   *
   * `moveWindowToGeometry` resizes the native window; the renderer lays itself out from its
   * own preset. On any display where `fitToCanvas` shrank the surface (Large 680x154 becomes
   * 380x86 at 380px of available width) those two disagreed and the content overflowed its own
   * window — 62px of it, measured. Neither side was wrong about its own half; the renderer
   * simply never learned the box had changed.
   *
   * Sent from here because this is the function every display-topology and prefs change flows
   * through, so there is one push, not one per call site. */
  pushGeometry(handle);
  /* RE-ASSERT STACKING HERE, NOT ONLY AT CONSTRUCTION.
   *
   * `applyAlwaysOnTop` ran once, in the constructor, before the window was shown. Everything
   * that demotes an always-on-top window afterwards — a workspace change, a monitor change, a
   * resume — flows through THIS function, so this is the one place a re-assert can live. Without
   * it the island kept whatever stacking state it inherited, which is how it ended up behind
   * other applications while everything about its content and size was correct. */
  reassertStacking(handle.window);
  try {
    /* BUG: this pushed a hardcoded `currentApp: null`, so on every display change
     * (add/remove/resize a monitor, or a scale-factor change) the island was told no app
     * was detected — which is why the user saw "No app detected" persist and never
     * recover. It must use the SAME provider the island was created with, so a
     * reconciliation re-sends real data instead of blanking it. */
    pushSnapshot(handle, deps);
  } catch {
    /* ignore */
  }
}

/** Tell the renderer the size main actually gave the window. See `reconcileHaloGeometry`. */
function pushGeometry(h: HaloHandle): void {
  const target = h.inApp ? BrowserWindow.getAllWindows()[0] : h.window;
  if (!target || target.isDestroyed()) return;
  const g = h.geometry;
  target.webContents.send('halo:geometry', {
    expanded: { width: g.expandedSize.width, height: g.expandedSize.height },
    compact: { width: g.compactSize.width, height: g.compactSize.height },
    /* How much `fitToCanvas` clamped the preset (`squeeze`, 1 = untouched). The renderer uses
     * this to scale its type and rhythm WITH the box instead of overflowing it — the same
     * rule §175's density principle states, applied on the responsive axis. */
    squeeze: g.fit?.squeeze ?? 1,
    tight: g.fit?.tight ?? false,
  });
}

/**
 * Re-read every preference and push it to a LIVE island.
 *
 * WHY THIS HAD TO BE WRITTEN
 * --------------------------
 * `halo:prefs` was sent from exactly one place — `did-finish-load`. So the renderer had
 * its preferences from the moment it loaded and never again, and the only way to see a
 * change was to destroy and recreate the window. The Settings copy claimed "applies on next
 * launch or immediately via ⌘⇧H", but `toggleHaloIsland()` only flips the pin flag; it does
 * not re-read or re-push anything. So EVERY setting in that section — shape, scale, edge,
 * maxVisible, order, visibility — was stored, written to the database, and ignored until a
 * relaunch. That is the same defect as the pin button at a larger scale, and it is why a
 * customization feature built on top of it would have shipped entirely dead.
 *
 * Reconciliation of position lives in `reconcileHaloGeometry` (HALO §25's single
 * reconciler) and is deliberately NOT duplicated here; this function owns the renderer
 * push, then asks the reconciler to move the window.
 *
 * Returns the applied prefs so a caller (or a probe) can assert what the island now
 * believes rather than what was requested.
 */
export function applyHaloPrefs(): HaloPrefs | null {
  const prefs = normalizeHaloPrefs(readPrefs());

  /* ═══ THE ENABLED GATE — this is the kill switch, and it used to not exist here. ═══
   *
   * THE BUG: this function opened with `if (!handle || handle.window.isDestroyed()) return null`
   * and then NEVER looked at `prefs.enabled`. So flipping the "island" toggle in Settings did
   * exactly this: wrote `enabled: false` to the prefs store, called `halo:apply-prefs`, and
   * main happily re-read the prefs, PUSHED THEM TO THE RENDERER and recomputed geometry —
   * with the window still on screen, fully interactive. The island could not be turned off.
   *
   * It could not be turned back ON either, for the mirror-image reason: with no `handle` the
   * very first line returned `null`, so the create path was unreachable from Settings. And
   * `setHaloIslandEnabled` — the one function whose whole job was this pair of transitions —
   * was not called from ANYWHERE in the codebase (verified by grep across `src/`).
   *
   * So `enabled` was a stored preference that nothing ever read at the moment it mattered.
   * It is still read at CREATE time (line ~598: `if (!prefs.enabled) return null`), which is
   * why a disabled island stays gone across a restart — the bug was purely that turning it
   * off while running did nothing.
   *
   * `resident === 'off'` is folded into the SAME gate rather than given its own, for the reason
   * above: a flag that is only consulted at construction cannot turn anything off at runtime, so
   * a second flag with a different name would inherit exactly that bug.
   *
   * NOTE ON WHAT `resident` DOES *NOT* DO HERE. `always` does not mean "the window follows the
   * cursor" and it does not mean "show the window on top of fullscreen apps" — the window is
   * ALREADY created once, kept alive, `alwaysOnTop` and never hidden (§115 keep-alive, §13
   * click-through). `always` vs `hover` is a RENDERER question about whether the compact pill
   * paints before it is hovered; see `resident` in `HaloPreferences`. The main-process half of
   * this pref is only the kill switch, because that is the only part main owns.
   *
   * THE RULE THIS ENFORCES: the authoritative read of `enabled` belongs on the ONE path
   * every preference change flows through. A flag that is only consulted at construction is
   * a flag that cannot turn anything off. */
  if (!prefs.enabled || prefs.resident === 'off') {
    const liveDeps: HaloDeps | null = handle?.deps ?? lastDeps;
    if (handle && !handle.window.isDestroyed()) {
      diag('disabled-at-runtime', { resident: prefs.resident });
      destroyHaloIsland();
    }
    /* THE KILL SWITCH MUST REACH THE OFFSCREEN ISLAND TOO. It is a separate window with its
     * own `OverlayRoot`, which renders `null` for `enabled:false`/`resident:'off'` — but only
     * once it HEARS the pref. Without this push the layer-shell capsule stays painted after
     * the user switches the island off (the frames go fully transparent instead, and the host
     * collapses the surface to nothing). */
    for (const w of liveDeps?.extraTargets?.() ?? []) {
      if (!w || w.isDestroyed()) continue;
      try {
        w.webContents.send('halo:prefs', prefs);
      } catch {
        /* the window may be mid-teardown; nothing further to do */
      }
    }
    return prefs;
  }
  /* RE-ENABLE. Reaching here with no window means the user just switched the island back on,
   * so the window must be CREATED — not left absent because a previous disable nulled the
   * handle. `deps` is the provider captured at construction (the same fix `reconcileHaloGeometry`
   * needed), so the island comes back reading real data rather than pushing nulls. */
  if (!handle || handle.window.isDestroyed()) {
    const deps: HaloDeps = (handle?.deps ?? lastDeps) as HaloDeps;
    if (deps) {
      diag('re-enable');
      void createHaloIsland(deps);
    }
    return prefs;
  }
  /* Routed through `pushPrefs`, which addresses the MAIN window in in-app mode. Sending on
   * `handle.window` here reached the placeholder's no-op `webContents` and stopped, so the
   * renderer kept the prefs it had at mount — which is why switching the island OFF in Settings
   * left the capsule sitting on screen. */
  pushPrefs(handle, handle.deps, prefs);

  /* HALO §11 — THE NATIVE RESIZE ALLOWLIST.
   *
   * `setBounds`/`setSize` may happen ONLY for: display added/removed/metrics-changed, a
   * resolution or scale-factor change, `canvas_configuration_change`, or
   * `user_changed_overlay_size_setting`. It is FORBIDDEN for animation_frame, pointermove,
   * hover_frame and timer_tick.
   *
   * Most of what this function applies is not on that list — hitbox padding, hover delays,
   * easing, widget visibility, order, shape, the pin toggle — and none of it changes where
   * the window sits. Calling `setBounds` for those would mutate the native window for a
   * change that cannot possibly need it, which is the habit §11 exists to break. So the
   * reconciler is invoked ONLY when a geometry input actually changed: edge, scale, or the
   * target display. `resolveGeometry` is still called unconditionally because the hot zone
   * depends on hitbox padding, which changes every tick of user intent and needs no
   * `setBounds` at all. */
  const geoChanged =
    handle.prefs.edge !== prefs.edge ||
    handle.prefs.scale !== prefs.scale ||
    handle.prefs.displayId !== prefs.displayId;
  handle.prefs = prefs;
  // The hit zone is recomputed either way, but the WINDOW only moves when it must.
  handle.geometry = resolveGeometry(prefs);
  if (geoChanged) moveWindowToGeometry(handle);

  pushHover(handle);
  diag('prefs-applied', {
    edge: prefs.edge,
    shape: prefs.shape,
    scale: prefs.scale,
    mode: prefs.trigger.mode,
    windowMoved: geoChanged,
    hotZone: `${handle.geometry.hotZone.width}x${handle.geometry.hotZone.height}`,
    hotZoneCompact: `${handle.geometry.hotZone.width}x${handle.geometry.hotZone.height}`,
    hotZoneExpanded: `${handle.geometry.hotZoneExpanded.width}x${handle.geometry.hotZoneExpanded.height}`,
  });
  return prefs;
}

/**
 * Lists displays for the monitor picker.
 *
 * Without this the user cannot choose a monitor from anywhere: `resolveTargetDisplay`
 * could honour a `displayId` preference, but nothing could ever write one, so the field
 * would have been unreachable. Sizes are reported in CSS pixels; a caller wanting physical
 * pixels multiplies by `scaleFactor`.
 */
export function listHaloDisplays(): { id: number; label: string; bounds: Rect; scaleFactor: number; primary: boolean }[] {
  const primary = screen.getPrimaryDisplay();
  return displayList().map((d) => ({
    id: d.id,
    label: d.label || `Display ${d.id}`,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor,
    primary: d.id === primary.id,
  }));
}

/**
 * REMOVED: `setHaloIslandEnabled`.
 *
 * It was exported, documented as the live-preview control, and called from NOWHERE in
 * `src/` (verified by grep). Its half that mattered was `destroyHaloIsland()`, and its other
 * half was unreachable: with no `handle` it fell off the end and did nothing, so it could
 * only ever turn the island OFF — and even that was never wired.
 *
 * Both directions now live in `applyHaloPrefs`, which is the single path every preference
 * change flows through, so `enabled` has exactly one authority. Keeping a second exported
 * function that performs the same transition — and whose enable branch is a silent no-op —
 * is how this bug stayed invisible in the first place. Deleting it is the fix; leaving a
 * broken twin next to the working one is not.
 */

let registered = false;

/** Validated IPC surface (HALO §43). The renderer is not authoritative. */
export function registerHaloIpc(deps: HaloDeps): void {
  if (registered) return;
  registered = true;

  ipcMain.handle('halo:get-snapshot', () => deps.snapshotProvider());

  /**
   * Apply preferences to the live island. Returns the prefs the island actually adopted,
   * not the ones requested — a caller can therefore assert the round trip instead of
   * assuming the write landed. HALO §43: the renderer is not authoritative, and neither is
   * this return value; `applyHaloPrefs` normalises, so a corrupt stored bag comes back as
   * defaults and the caller sees that.
   */
  ipcMain.handle('halo:apply-prefs', () => applyHaloPrefs() ?? { ok: false, error: 'island closed' });

  /** Monitor list for the picker. See listHaloDisplays for why this had to be added. */
  ipcMain.handle('halo:list-displays', () => listHaloDisplays());

  ipcMain.handle('halo:set-pinned', (_e, pinned: unknown) => {
    if (typeof pinned !== 'boolean') return { ok: false, error: 'pinned must be a boolean' };
    if (!handle || handle.window.isDestroyed()) return { ok: false, error: 'island closed' };
    handle.pinned = pinned;
    if (pinned) {
      handle.expanded = true;
    } else {
      handle.expanded = false;
      handle.hover = initialHoverState();
    }
    applyClickRegion(handle, handle.prefs);
    pushHover(handle);
    return { ok: true };
  });

ipcMain.handle('halo:open', () => {
      if (!handle || handle.window.isDestroyed()) return { ok: false, error: 'island closed' };
      /* EXPAND WITHOUT PINNING.
       *
       * This handler set `pinned = true`, so every renderer-driven hover-open PINNED the
       * island: the panel expanded, but `stepHover` then refused to close it because a pinned
       * island ignores pointer-leave. The island would then stick open until Escape.
       *
       * `pinned` is only ever set by the pin BUTTON (`togglePin` -> `halo:set-pinned`) or the
       * global shortcut (`toggleHaloIsland`). A hover-open must leave it alone — the renderer
       * already has its own pin state and sends that separately.
       *
       * The point of this handler is the CLICK REGION: main must stop being click-through and
       * shape the window to the now-full-size surface. That is `applyClickRegion` below, and it
       * is the whole reason the renderer tells main it opened. */
      handle.expanded = true;
      applyClickRegion(handle, handle.prefs);
      pushHover(handle);
      return { ok: true };
    });

  ipcMain.handle('halo:close', () => {
    if (!handle || handle.window.isDestroyed()) return { ok: false, error: 'island closed' };
    handle.pinned = false;
    handle.expanded = false;
    handle.hover = initialHoverState();
    applyClickRegion(handle, handle.prefs);
    pushHover(handle);
    return { ok: true };
  });

  /**
   * HALO §51: "click outside -> unpin + collapse".
   *
   * This is the interaction that makes pinning safe to offer at all, and it is also the
   * user's answer to "the island must not interfere with what I am clicking". A pinned
   * island that could only be dismissed by its own button would sit over the desktop
   * holding a click region; a click anywhere outside it releases both. The renderer sends
   * this from its own document-level pointer listener, so it needs no hit-testing of its own
   * — by construction the island only sees the clicks that reached it.
   */
  ipcMain.handle('halo:click-outside', () => {
    if (!handle || handle.window.isDestroyed()) return { ok: false, error: 'island closed' };
    if (!handle.pinned && !handle.expanded) return { ok: true, changed: false };
    handle.pinned = false;
    handle.expanded = false;
    handle.hover = initialHoverState();
    applyClickRegion(handle, handle.prefs);
    pushHover(handle);
    diag('click-outside-collapsed');
    return { ok: true, changed: true };
  });
}