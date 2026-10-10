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

/** Regions the lerp must never take over: text selection, code, and the xterm
 *  terminal all need the native wheel to reach them untouched. */
function isExcluded(el: Element | null): boolean {
  return !!el?.closest('pre, code, textarea, input, .xterm, [data-no-smooth]');
}

function isScrollable(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el);
  if (overflowY !== 'auto' && overflowY !== 'scroll') return false;
  return el.scrollHeight - el.clientHeight > 2;
}

/** The scroller the POINTER is actually over.
 *
 *  Walks up the ancestor chain from the event target rather than scanning the
 *  document. Depth is bounded by the DOM tree (~15 levels), so this is O(depth)
 *  instead of O(elements) — the difference between a handful of style reads and
 *  the tens of thousands a querySelectorAll('*') sweep costs on a page that is
 *  rendering a few thousand rows.
 */
function scrollerUnderPointer(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  let el: HTMLElement | null = target as HTMLElement;
  while (el && el !== document.body && el !== document.documentElement) {
    if (isScrollable(el)) return el;
    el = el.parentElement;
  }
  return null;
}

/** The app's primary scroller when nothing else is known — e.g. the first
 *  binding right after a route change, before the pointer has moved.
 *
 *  Scoped to the routed content pane and biased to shallow candidates so it
 *  cannot walk thousands of nodes. The previous implementation looked for
 *  `[data-sf-routed-content]`, an attribute that is READ here but WRITTEN
 *  nowhere in the codebase, so it silently fell back to `document.body` and
 *  ran getComputedStyle over every element on every navigation. */
function findPrimaryScroller(): HTMLElement | null {
  const root =
    document.querySelector<HTMLElement>('[data-page-root]') ??
    document.querySelector('main') ??
    document.body;

  let best: HTMLElement | null = null;
  let bestOverflow = 24;

  // Breadth-first from the pane itself: the outermost scroller is almost always
  // the intended one, and stopping early keeps this cheap.
  const queue: Element[] = [root as Element];
  for (let depth = 0; depth < 4 && queue.length; depth++) {
    const next: Element[] = [];
    for (const el of queue) {
      if (el instanceof HTMLElement) {
        if (isExcluded(el)) continue;
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight - el.clientHeight > bestOverflow) {
          bestOverflow = el.scrollHeight - el.clientHeight;
          best = el;
        }
      }
      for (const child of Array.from(el.children)) next.push(child);
    }
    queue.length = 0;
    queue.push(...next);
  }
  return best;
}

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const lenisRef = useRef<Lenis | null>(null);
  const manualRef = useRef<HTMLElement | null>(null);
  const boundRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number>(0);
  const enabledRef = useRef(false);

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const destroyLenis = useCallback(() => {
    stopLoop();
    lenisRef.current?.destroy();
    lenisRef.current = null;
    boundRef.current = null;
  }, [stopLoop]);

  /** (Re)bind the lerp to `wrapper`. Passing null releases the wheel entirely so
   *  the browser scrolls natively — that is what happens over text, code and the
   *  terminal, and over nothing scrollable at all. */
  const mountLenis = useCallback(
    (wrapper: HTMLElement | null) => {
      destroyLenis();

      if (!enabledRef.current || !wrapper) {
        publish(false);
        return;
      }

      const content = wrapper.firstElementChild;
      const lenis = new Lenis({
        ...LENIS_OPTIONS,
        wrapper,
        // Lenis needs the element that actually carries the scrollable content.
        // A nested pane often has no wrapper child, in which case the wrapper
        // itself is the scroller.
        content: (content instanceof HTMLElement ? content : wrapper) as HTMLElement,
      });
      lenisRef.current = lenis;
      boundRef.current = wrapper;

      const raf = (time: number) => {
        lenis.raf(time);
        rafRef.current = requestAnimationFrame(raf);
      };
      rafRef.current = requestAnimationFrame(raf);

      publish(true);
    },
    [destroyLenis],
  );

  const boot = useCallback(() => {
    destroyLenis();
    if (!enabledRef.current) {
      publish(false);
      return;
    }
    const wrapper = manualRef.current ?? findPrimaryScroller();
    mountLenis(wrapper);
  }, [destroyLenis, mountLenis]);

  /** Follow the pointer. Lenis calls preventDefault on wheel to take over
   *  scrolling, so whichever element it is bound to is the ONLY thing that
   *  moves. Binding it once per route meant that hovering a panel and scrolling
   *  scrolled the page behind it — the pointer was ignored entirely.
   *
   *  The rebind is deferred to the next frame and coalesced, so sweeping the
   *  pointer across a page of nested panes costs one remount rather than one per
   *  boundary crossed. */
  useEffect(() => {
    if (!enabled) return;

    let queued: number | null = null;
    let next: HTMLElement | null = null;

    const onWheel = (e: WheelEvent) => {
      const wrapper = isExcluded(e.target as Element | null) ? null : scrollerUnderPointer(e.target);
      if (wrapper === boundRef.current) return;
      next = wrapper;
      if (queued !== null) return;
      queued = requestAnimationFrame(() => {
        queued = null;
        if (next !== boundRef.current) mountLenis(next);
      });
    };

    window.addEventListener('wheel', onWheel, { capture: true, passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel, { capture: true });
      if (queued !== null) cancelAnimationFrame(queued);
    };
  }, [enabled, mountLenis]);

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

  const register = useCallback(
    (el: HTMLElement | null) => {
      manualRef.current = el;
      if (enabledRef.current) boot();
    },
    [boot],
  );

  const scrollTo = useCallback(
    (target: HTMLElement | number, opts?: { offset?: number; immediate?: boolean }) => {
      const lenis = lenisRef.current;
      if (lenis) {
        lenis.scrollTo(target, { offset: opts?.offset ?? 0, immediate: opts?.immediate ?? true });
        return;
      }
      // No Lenis (disabled, or nothing scrollable): fall back to the DOM so
      // every "jump to this" button keeps working. This queried
      // [data-sf-routed-content], which is written nowhere, so the optional
      // chaining swallowed a null and the numeric scroll silently did nothing.
      if (typeof target === 'number') {
        const pane =
          boundRef.current ??
          document.querySelector<HTMLElement>('[data-page-root]') ??
          document.scrollingElement;
        pane?.scrollTo({ top: target, behavior: 'auto' });
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
    return destroyLenis;
  }, [boot, destroyLenis]);

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
