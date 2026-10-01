/* ============================================================================
 * smooth-scroll.tsx — THE ONE module that owns scrolling inertia.
 * ============================================================================
 *
 * Companion to styles/surface.css. That file owns what a scrollbar LOOKS like
 * and is unconditional. This module owns how scrolling FEELS, and is opt-in
 * from Settings, because inertia is a preference and a scrollbar is not.
 *
 * The three rules this module will not break:
 *
 *  1. It drives ONE scroller — the app's primary content pane — not every
 *     `overflow` element in the DOM. Attaching a rAF lerp to all ~700
 *     scrollers in this repo would burn a frame budget per element and would
 *     make text selection, drag-resize panels and the xterm terminal feel
 *     like they were made of syrup. Smoothness is the point; this is the
 *     difference between smooth and broken.
 *
 *  2. It never touches a field. Typing in an input, or dragging a slider,
 *     must scroll the caret, not fight a lerp for the scrollTop value.
 *
 *  3. It obeys the OS. If `prefers-reduced-motion: reduce` is set, the module
 *     refuses to start and clears the html flag, so nothing downstream can
 *     read "on" and enable it anyway.
 * ========================================================================== */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import Lenis from 'lenis';

const STORAGE_KEY = 'rheo:smooth-scroll';

/** Lenis defaults that are wrong for an app shell (it is tuned for a landing
 *  page, where hijacking the whole document is correct and expected). */
const LENIS_OPTIONS = {
  /** Feel. A short lerp is enough to remove the "notch" of a mouse wheel
   *  without adding visible lag. Longer feels luxurious on a marketing page
   *  and sluggish when you are reading dense data. */
  duration: 0.85,
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  /** Wheel multipliers, 1:1 with a physical wheel. Anything above 1 means the
   *  user scrolls one notch and travels further than they asked to. */
  wheelMultiplier: 1,
  touchMultiplier: 1.6,
  /** Never smooth programmatic scrollIntoView — that is how anchor jumps and
   *  "scroll to the error" silently take 900ms and feel like a bug. */
  smoothWheel: true,
  syncTouch: false,
  autoRaf: false,
} as const;

function readPreference(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  } catch {
    /* private mode / storage disabled — fall through to the media query */
  }
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function osWantsLessMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** surface.css reads this. It is the single place the two halves of this
 *  feature meet: the flag says "inertia is on", never "style it differently".
 *  The scrollbar's appearance is unconditional and does NOT depend on it. */
function publish(enabled: boolean) {
  const root = document.documentElement;
  if (enabled) root.setAttribute('data-smooth-scroll', 'on');
  else root.removeAttribute('data-smooth-scroll');
  root.style.scrollBehavior = enabled ? 'auto' : '';
}

interface SmoothScrollValue {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  /** Attach a specific pane instead of the auto-detected primary scroller. */
  register: (el: HTMLElement | null) => void;
  scrollTo: (target: HTMLElement | number, opts?: { offset?: number; immediate?: boolean }) => void;
}

const SmoothScrollContext = createContext<SmoothScrollValue>({
  enabled: false,
  setEnabled: () => {},
  register: () => {},
  scrollTo: () => {},
});

export function useSmoothScroll(): SmoothScrollValue {
  return useContext(SmoothScrollContext);
}

/** The app's primary scroller is not a stable class — it is a layout decision
 *  each page makes for itself. Rather than hard-coding one selector (which
 *  breaks the moment a page nests its scroller), pick the LARGEST genuinely
 *  overflowing pane inside the routed content area. It re-picks on route
 *  change, so navigating from a long Settings page to a two-card dashboard
 *  hands the lerp to whatever is actually scrolling. */
function findPrimaryScroller(): HTMLElement | null {
  const root =
    document.querySelector('[data-sf-routed-content]') ??
    document.querySelector('main') ??
    document.body;

  let best: HTMLElement | null = null;
  let bestOverflow = 24; // ignore a few stray pixels

  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    if (el.closest('pre, code, .xterm, [data-no-smooth]')) continue;

    const { overflowY } = getComputedStyle(el);
    if (overflowY !== 'auto' && overflowY !== 'scroll') continue;

    const overflow = el.scrollHeight - el.clientHeight;
    if (overflow > bestOverflow) {
      bestOverflow = overflow;
      best = el;
    }
  }
  return best;
}

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const lenisRef = useRef<Lenis | null>(null);
  const manualRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number>(0);
  const enabledRef = useRef(false);

  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    lenisRef.current?.destroy();
    lenisRef.current = null;
    manualRef.current = null;
  }, []);

  const boot = useCallback(() => {
    teardown();

    if (!enabledRef.current) {
      publish(false);
      return;
    }

    const wrapper = manualRef.current ?? findPrimaryScroller();
    if (!wrapper) {
      // Nothing on this page scrolls. That is a valid state, not an error —
      // publish "off" so no downstream CSS assumes a lerp is running.
      publish(false);
      return;
    }

    const lenis = new Lenis({
      ...LENIS_OPTIONS,
      wrapper,
      // Lenis needs the actual scrolling element, not the padded parent.
      content: wrapper.firstElementChild as HTMLElement ?? wrapper,
    });
    lenisRef.current = lenis;

    const raf = (time: number) => {
      lenis.raf(time);
      rafRef.current = requestAnimationFrame(raf);
    };
    rafRef.current = requestAnimationFrame(raf);

    publish(true);
  }, [teardown]);

  const setEnabled = useCallback(
    (next: boolean) => {
      const resolved = next && !osWantsLessMotion();
      enabledRef.current = resolved;
      setEnabledState(resolved);
      try {
        localStorage.setItem(STORAGE_KEY, resolved ? 'on' : 'off');
      } catch {
        /* preference simply will not persist; the session still honours it */
      }
      boot();
    },
    [boot],
  );

  const register = useCallback((el: HTMLElement | null) => {
    manualRef.current = el;
    if (enabledRef.current) boot();
  }, [boot]);

  const scrollTo = useCallback(
    (target: HTMLElement | number, opts?: { offset?: number; immediate?: boolean }) => {
      const lenis = lenisRef.current;
      if (lenis) {
        lenis.scrollTo(target, { offset: opts?.offset ?? 0, immediate: opts?.immediate ?? true });
        return;
      }
      // No Lenis (disabled, or nothing scrollable): fall back to the DOM so
      // every "jump to this" button keeps working.
      if (typeof target === 'number') {
        document.querySelector('[data-sf-routed-content]')?.scrollTo({ top: target, behavior: 'auto' });
      } else {
        target.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
    },
    [],
  );

  /* First mount: read the stored preference, but never enable against the OS. */
  useEffect(() => {
    const resolved = readPreference() && !osWantsLessMotion();
    enabledRef.current = resolved;
    setEnabledState(resolved);
    boot();
    return teardown;
  }, [boot, teardown]);

  /* The primary scroller changes per route. Re-pick on navigation so the lerp
     follows the user, and re-check reduced-motion in case the user flipped the
     OS setting while the app was open. */
  useEffect(() => {
    if (!enabledRef.current) return;
    const onRouteChange = () => window.setTimeout(boot, 60); // let the new page paint first
    window.addEventListener('popstate', onRouteChange);
    window.addEventListener('deskflow:route', onRouteChange);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', onRouteChange);
    return () => {
      window.removeEventListener('popstate', onRouteChange);
      window.removeEventListener('deskflow:route', onRouteChange);
      mq.removeEventListener('change', onRouteChange);
    };
  }, [boot, enabled]);

  const value = useMemo<SmoothScrollValue>(
    () => ({ enabled, setEnabled, register, scrollTo }),
    [enabled, setEnabled, register, scrollTo],
  );

  return <SmoothScrollContext.Provider value={value}>{children}</SmoothScrollContext.Provider>;
}

/** Opt a specific pane in explicitly, instead of letting the provider guess.
 *  Ref-forwarding is intentionally absent: this takes a ref object so the
 *  consumer keeps ownership of the node (it already has the layout). */
export function useSmoothScrollPane(ref: RefObject<HTMLElement | null>) {
  const { register, enabled } = useSmoothScroll();
  useEffect(() => {
    if (!enabled) return;
    register(ref.current);
    return () => register(null);
  }, [ref, register, enabled]);
}
