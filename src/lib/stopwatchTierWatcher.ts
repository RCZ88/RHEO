/**
 * App-lifetime stopwatch tier watchdog.
 *
 * The tier-transition actions — timerBehavior.neutralAction / distractingAction
 * ('pause' | 'reset') — used to live ONLY in DashboardPage's tier-transition
 * effect, so entering a distracting site from any other route (island pill,
 * /activity, /life, …) fired no reset, the store kept accruing under the last
 * tier, and the pause a distracting entry set was a page-local ref that died on
 * navigation. This module owns the transitions for the whole app lifetime,
 * wired once in App.tsx to the SAME IPC events the dashboard listens to.
 *
 * Tier resolution mirrors DashboardPage.getTierFromCategory exactly: the
 * CATEGORY decides; the per-app/domain maps are only a fallback for an app or
 * website with NO category.
 *
 * The logic is pure (no React) so the probe
 * (agent/probes/stopwatch-app-tier-watcher.probe.mjs) can exercise the REAL
 * module against the REAL store without mounting a component.
 */
import { stopwatch } from './stopwatchStore';

export type WatchTier = 'productive' | 'neutral' | 'distracting';

export interface WatchTierAssignments {
  productive: string[];
  neutral: string[];
  distracting: string[];
}

export type WatchTierMap = Record<string, WatchTier>;

export interface WatchTimerBehavior {
  neutralAction: 'pause' | 'reset' | 'ignore';
  distractingAction: 'pause' | 'reset' | 'ignore';
}

export interface WatchForegroundData {
  app?: string;
  category?: string;
  title?: string;
  isReal?: boolean;
}

export interface WatchBrowserData {
  type?: string;
  domain?: string;
  title?: string;
  category?: string;
  url?: string;
  is_browser_focused?: boolean;
}

export interface WatcherSources {
  getTiers(): WatchTierAssignments;
  getAppTierMap(): WatchTierMap;
  getDomainTierMap(): WatchTierMap;
  getTimerBehavior(): WatchTimerBehavior;
  getTrackerAppMode(): 'show-other' | 'pause' | 'track';
  getForegroundApp(): string;
  getTrackingBrowsers(): string[];
  isBrowserApp(app: string, candidates: string[]): boolean;
}

/**
 * The category decides; the per-app/domain map is only a fallback for an
 * app/domain with NO category. A per-app entry must never re-tier a whole
 * category — same rule as DashboardPage.getTierFromCategory.
 */
export function resolveWatchTier(
  category: string | undefined,
  appOrDomain: string | undefined,
  tiers: WatchTierAssignments,
  appTierMap: WatchTierMap,
  domainTierMap: WatchTierMap,
): WatchTier {
  if (category) {
    if (tiers.productive.includes(category)) return 'productive';
    if (tiers.distracting.includes(category)) return 'distracting';
    return 'neutral';
  }
  if (appOrDomain) {
    const o = appTierMap?.[appOrDomain] ?? domainTierMap?.[appOrDomain];
    if (o === 'productive' || o === 'neutral' || o === 'distracting') return o;
  }
  return 'neutral';
}

export function createStopwatchTierWatcher(sources: WatcherSources) {
  let prevTier: WatchTier | null = null;
  // The foreground app is tracked INTERNALLY from onForeground events: the
  // watcher must be self-contained (probeable, and immune to the cold-start
  // race where the host ref has not been updated yet). The getter stays as a
  // fallback only.
  let currentApp = '';
  let foregroundCategory = '';
  let websiteCategory = '';
  let websiteDomain = '';
  let lastNonBrowserCategory = '';

  const log = (msg: string) =>
    console.log('%c[StopwatchWatchdog] ' + msg, 'color: #fbbf24; font-weight: bold');

  // ── Confirmed-entry guard (the CZ "stopwatch zeroes itself" fix) ─────────
  // A tier-ENTRY action (reset/pause) is destructive enough that firing it on
  // the first evaluation claiming the tier is how the stopwatch learned to zero
  // itself with no user action: the tier can FLAP without any app switch. Main
  // emits 'clear' (and keeps accepting extension payloads) off Wayland
  // false-negative foreground reads and cached-poll gaps — main.ts's own
  // comments document both — so a user sitting on one distracting site could
  // oscillate productive↔distracting, and the default distractingAction:'reset'
  // zeroed the store on every re-entry. An action now fires only after the new
  // tier has HELD for ACTION_CONFIRM_MS; any tier change in between (the flap
  // reversing) cancels it. A real app/site change holds far longer than the
  // window, so real behaviour is unchanged to the eye.
  const ACTION_CONFIRM_MS = 2500;
  let pendingAction: {
    tier: 'neutral' | 'distracting';
    kind: 'pause' | 'reset';
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  const cancelPendingAction = (): void => {
    if (!pendingAction) return;
    clearTimeout(pendingAction.timer);
    pendingAction = null;
  };

  function armAction(tier: 'neutral' | 'distracting', kind: 'pause' | 'reset'): void {
    cancelPendingAction();
    pendingAction = {
      tier,
      kind,
      timer: setTimeout(() => {
        pendingAction = null;
        if (kind === 'reset') {
          log(`${tier.toUpperCase()} -> RESET (confirmed after ${ACTION_CONFIRM_MS}ms)`);
          stopwatch.reset();
          return;
        }
        if (tier === 'distracting') {
          // A watchdog pause, not a user pause: the store absorbs external
          // unpauses (browser payloads say "user is actively browsing" on every
          // event) while this is in force.
          stopwatch.setDistractingPause(true);
        } else {
          stopwatch.setPaused(true);
        }
        log(`${tier.toUpperCase()} -> PAUSE (confirmed after ${ACTION_CONFIRM_MS}ms)`);
      }, ACTION_CONFIRM_MS),
    };
  }

  /**
   * Apply timerBehavior on a tier CHANGE. Fires once per entry (prevTier guard),
   * never while already sitting on the same tier. Mirrors DashboardPage's
   * shipped branches exactly — the difference is that this runs on every route.
   * The destructive actions arm a confirmed-entry timer instead of firing
   * immediately; see the guard comment above.
   */
  function applyTransitions(tier: WatchTier): void {
    const prev = prevTier;
    const behavior = sources.getTimerBehavior();
    // The tier moved again — a pending confirmation is no longer a confirmed
    // entry. Same-tier re-evaluations (repeat payloads, settings refresh) must
    // NOT cancel what is already armed.
    if (prev && prev !== tier) cancelPendingAction();
    if (tier === 'neutral' && prev && prev !== 'neutral') {
      const action = behavior.neutralAction;
      if (action === 'pause') armAction('neutral', 'pause');
      else if (action === 'reset') armAction('neutral', 'reset');
    }
    if (tier === 'distracting' && prev && prev !== 'distracting') {
      const action = behavior.distractingAction;
      if (action === 'pause' || action === 'reset') armAction('distracting', action);
    }
    // Leaving distracting releases a pause THIS watcher set — never a user,
    // tracker-app or AFK pause. setDistractingPause(false) is a no-op when
    // nothing was self-set, so this cannot clear someone else's state.
    if (tier !== 'distracting' && prev === 'distracting') {
      stopwatch.setDistractingPause(false);
    }
    if (prev && prev !== tier) log(`tier ${prev} → ${tier} (totals kept)`);
    prevTier = tier;
  }

  /** Recompute the tier from the current inputs, apply transitions, hand off. */
  function evaluate(): WatchTier {
    const app = currentApp || sources.getForegroundApp();
    const candidates = sources.getTrackingBrowsers();
    const inBrowser = !!app && candidates.length > 0 && sources.isBrowserApp(app, candidates);
    const category = inBrowser
      ? websiteCategory || lastNonBrowserCategory
      : foregroundCategory;
    const appOrDomain = inBrowser ? websiteDomain || app : app || undefined;
    const tier = resolveWatchTier(
      category || undefined,
      appOrDomain,
      sources.getTiers(),
      sources.getAppTierMap(),
      sources.getDomainTierMap(),
    );
    applyTransitions(tier);
    // Same handoff DashboardPage performs — the store banks the outgoing
    // segment under the old tier. Idempotent when both are mounted.
    stopwatch.setTier(tier === 'distracting' ? 'distracting' : 'productive');
    return tier;
  }

  return {
    /** Real foreground-window change (same event DashboardPage listens to). */
    onForeground(data: WatchForegroundData): void {
      const app = data.app || '';
      if (!app || data.isReal === false) return; // no real app — keep last tier
      currentApp = app;
      foregroundCategory = data.category || '';

      // Tracker app (RHEO itself) in show-other/pause mode: keep the currently
      // displayed tier — never jump to the tracker's own category. Mirrors the
      // dashboard's foreground branch. The tracker app also never becomes the
      // "last non-browser app" fallback.
      const lower = app.toLowerCase();
      if (
        (lower === 'deskflow' || lower === 'electron' || lower === 'rheo') &&
        sources.getTrackerAppMode() !== 'track'
      ) {
        if (sources.getTrackerAppMode() === 'pause') stopwatch.setPaused(true);
        return;
      }

      const candidates = sources.getTrackingBrowsers();
      const isBrowser = candidates.length > 0 && sources.isBrowserApp(app, candidates);

      if (isBrowser) {
        // Entering the tracking browser: the website — or, until an extension
        // payload arrives, the last non-browser app — governs.
        evaluate();
        return;
      }

      // Real non-browser app: it becomes the fallback for browser sessions
      // without extension data, and its category governs right now. Clearing
      // the website mirrors the dashboard's clearWebsiteUnlessLive().
      lastNonBrowserCategory = foregroundCategory;
      websiteCategory = '';
      websiteDomain = '';
      // A real app is foreground again — release a tracker-app pause. The store
      // absorbs this while a distracting self-pause is in force.
      stopwatch.setPaused(false);
      evaluate();
    },

    /** Website event from the browser extension (same event DashboardPage listens to). */
    onBrowserEvent(data: WatchBrowserData): void {
      if (data.type === 'clear') {
        // A 'clear' only means "site gone" when the browser has ACTUALLY lost
        // the foreground. Main also emits it on a Wayland false-negative OS
        // read while the user is still browsing (its own comments document the
        // false negatives and the cached-poll gaps), and the extension keeps
        // pushing background payloads — honouring such a clear zeroed the site
        // state and flipped the tier to the last non-browser app with no user
        // action; the next accepted payload flipped back, and with the default
        // distractingAction:'reset' the stopwatch zeroed on every oscillation.
        // A REAL browser exit is handled authoritatively by onForeground below,
        // which clears site state itself — so ignoring the clear here loses
        // nothing.
        // Internally-tracked foreground (same source the payloads are gated
        // on) with the getter as fallback — a getter-only read here failed the
        // guard whenever the host ref had not synced, which is precisely the
        // cold-start/stale-ref window the spurious clear exploits.
        const app = currentApp || sources.getForegroundApp();
        const candidates = sources.getTrackingBrowsers();
        if (app && candidates.length > 0 && sources.isBrowserApp(app, candidates)) {
          log('clear ignored — browser still confirmed foreground (no app switch)');
          return;
        }
        // Browser no longer foreground — the real app governs again.
        websiteCategory = '';
        websiteDomain = '';
        evaluate();
        return;
      }
      if (data.type !== 'browser-data' && data.type !== 'live-log') return;

      // Only while the foreground app IS the tracking browser (the same guard
      // App.tsx applies to the log feed), and only when the extension confirms
      // the browser is focused — mirrors the dashboard's race guard.
      const app = currentApp || sources.getForegroundApp();
      const candidates = sources.getTrackingBrowsers();
      if (!app || !candidates.length || !sources.isBrowserApp(app, candidates)) return;
      if (data.is_browser_focused === false) return;

      websiteCategory = data.category || '';
      websiteDomain = data.domain || '';
      evaluate();
    },

    /** Tier assignments / timer behavior / tracker mode changed. */
    onSettingsChanged(): void {
      // The armed action captured its kind at arm time; a behaviour change
      // mid-window must not fire the stale one. If the tier still qualifies
      // for an action, that is a transition decision, not a settings echo.
      cancelPendingAction();
      evaluate();
    },

    /** Diagnostics only — never used for control flow. */
    _debug: {
      get tier() {
        return prevTier;
      },
      get websiteCategory() {
        return websiteCategory;
      },
      get lastNonBrowserCategory() {
        return lastNonBrowserCategory;
      },
    },
  };
}
