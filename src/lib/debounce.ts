/**
 * debounce / throttle — ONE implementation, extracted.
 *
 * WHY: the repo had SEVEN byte-identical local copies of the same five-line
 * function (TerminalWindow.tsx, SimpleTerminalPage.tsx, GlobalSearch.tsx,
 * SmartSearchOverlay.tsx, PlanBoard.tsx, MoodboardTab.tsx,
 * ComponentBrowserModal.tsx) and NO throttle anywhere. Seven copies means a bug
 * fixed in one is still live in six, and it means nobody can safely add a
 * `cancel()` or a `flush()` because no two copies agree on the signature.
 *
 * This module is additive: every existing call site keeps working unchanged.
 * New code should import from here.
 *
 * The difference that matters, stated once so nobody has to rediscover it:
 *   debounce — fires ONCE, after the caller stops. Use for "save on keystroke
 *              settles". This is what a preferences file wants.
 *   throttle — fires REPEATLY, at most once per interval. Use for "keep this
 *              live while they drag a slider".
 */

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** Drop a pending call. Use on unmount so a late timer cannot touch a dead component. */
  cancel(): void;
  /** Run a pending call immediately. Use on blur/save so the last edit is never lost. */
  flush(): void;
  /** Is a call currently scheduled? */
  pending(): boolean;
}

/**
 * Trailing-edge debounce. The call happens `ms` after the LAST invocation.
 *
 * Deliberately does NOT have a `maxWait`. For file writes the trailing edge is
 * what you want, and a maxWait invites "just add a periodic write to every
 * preference change", which is the failure this replaces.
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;

  const invoke = () => {
    timer = null;
    const args = lastArgs;
    lastArgs = null;
    if (args) fn(...args);
  };

  const debounced = ((...args: A) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(invoke, ms);
  }) as Debounced<A>;

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      invoke();
    }
  };
  debounced.pending = () => timer !== null;

  return debounced;
}

/**
 * Leading-edge throttle: fires immediately, then at most once per `ms`.
 * `trailing` also delivers the final call, so the last value is never dropped.
 */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number, trailing = true): Debounced<A> {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;

  const run = (args: A) => {
    last = Date.now();
    fn(...args);
  };

  const throttled = ((...args: A) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    lastArgs = args;
    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      run(args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        if (trailing && lastArgs) run(lastArgs);
        lastArgs = null;
      }, remaining);
    }
  }) as Debounced<A>;

  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
    last = 0;
  };
  throttled.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      if (trailing && lastArgs) run(lastArgs);
      lastArgs = null;
    }
  };
  throttled.pending = () => timer !== null;

  return throttled;
}