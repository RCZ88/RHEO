// ============================================================================
// AI Gateway — CompletionDetector: 3-tier fallback (spec §3.1, ai-output.md §3)
// Tier 1 primary → Tier 2 fallback → Tier 3 last-resort. Operates on `any`
// page object so this module never hard-depends on playwright at load time.
// ============================================================================
import type { DetectionStrategy, ProviderAdapter } from './types';

// Minimal structural surface we use from a Playwright Page. `any` upstream.
type PageLike = any;

async function countMatches(page: PageLike, selectors?: string[]): Promise<number> {
  if (!selectors || selectors.length === 0) return 0;
  try {
    return await page.evaluate((sels: string[]) => {
      let n = 0;
      for (const s of sels) {
        try { n += document.querySelectorAll(s).length; } catch {}
      }
      return n;
    }, selectors);
  } catch { return 0; }
}

async function runStrategy(
  page: PageLike,
  responseSelector: string[],
  s: DetectionStrategy,
  baselineCount?: number,
): Promise<boolean> {
  switch (s.type) {
    case 'dom_marker':
    case 'button_appearance': {
      const n = await countMatches(page, s.selector);
      if (s.condition === 'count_increased' && baselineCount !== undefined) return n > baselineCount;
      return n > 0;
    }
    case 'button_disappearance': {
      const n = await countMatches(page, s.selector);
      return n === 0;
    }
    case 'text_stability': {
      // Single-shot check; stability-over-time is handled by the poll loop.
      return (await countMatches(page, responseSelector)) > 0;
    }
    case 'network_idle': {
      try {
        await page.waitForLoadState('networkidle', { timeout: 3000 });
        return true;
      } catch { return false; }
    }
    case 'custom_js': {
      if (!s.customScript) return false;
      try { return !!(await page.evaluate(s.customScript)); } catch { return false; }
    }
    default:
      return false;
  }
}

async function responseText(page: PageLike, selectors: string[]): Promise<string> {
  try {
    return await page.evaluate((sels: string[]) => {
      for (const s of sels) {
        try {
          const els = document.querySelectorAll(s);
          if (els.length > 0) {
            const last = els[els.length - 1] as HTMLElement;
            const t = (last.innerText || last.textContent || '').trim();
            if (t) return t;
          }
        } catch {}
      }
      return '';
    }, selectors);
  } catch { return ''; }
}

export interface CompletionOutcome {
  complete: boolean;
  strategy: string; // 'primary' | 'fallback' | 'last_resort' | 'timeout'
  text: string;
}

/**
 * Poll until the provider response is complete or timeoutMs elapses.
 * Text-stability tiers require `stableDurationMs` of unchanged text.
 */
export async function waitForCompletion(
  page: PageLike,
  adapter: ProviderAdapter,
  opts?: { timeoutMs?: number; onTick?: (elapsedMs: number) => void },
): Promise<CompletionOutcome> {
  const cfg = adapter.completionDetection;
  const timeoutMs = opts?.timeoutMs || cfg.timeoutMs;
  const poll = Math.max(250, cfg.pollIntervalMs || 1000);
  const started = Date.now();

  // Baselines for count_increased strategies.
  const primaryBase = await countMatches(page, cfg.primary.selector);
  await new Promise((r) => setTimeout(r, poll));

  let lastText = await responseText(page, adapter.response.containerSelector);
  let stableSince = Date.now();
  let lastResortStableSince: number | null = null;

  for (;;) {
    const elapsed = Date.now() - started;
    if (elapsed >= timeoutMs) {
      const text = await responseText(page, adapter.response.containerSelector);
      return { complete: false, strategy: 'timeout', text };
    }
    opts?.onTick?.(elapsed);

    // Tier 1 — primary.
    try {
      if (await runStrategy(page, adapter.response.containerSelector, cfg.primary, primaryBase)) {
        const text = await responseText(page, adapter.response.containerSelector);
        if (text) return { complete: true, strategy: 'primary', text };
      }
    } catch {}

    // Tier 2 — fallback.
    try {
      if (await runStrategy(page, adapter.response.containerSelector, cfg.fallback)) {
        const text = await responseText(page, adapter.response.containerSelector);
        if (text) return { complete: true, strategy: 'fallback', text };
      }
    } catch {}

    // Tier 3 — last resort (text stability over stableDurationMs).
    try {
      const text = await responseText(page, adapter.response.containerSelector);
      if (text && text === lastText) {
        if (lastResortStableSince === null) lastResortStableSince = Date.now();
        const need = cfg.lastResort.stableDurationMs || 4000;
        if (Date.now() - lastResortStableSince >= need) {
          return { complete: true, strategy: 'last_resort', text };
        }
      } else {
        lastText = text;
        lastResortStableSince = null;
      }
      // Track general stability too (feeds network-idle/custom tiers implicitly).
      if (text !== lastText) { lastText = text; stableSince = Date.now(); }
      void stableSince;
    } catch {}

    await new Promise((r) => setTimeout(r, poll));
  }
}

/** Quick probe: does the chat input exist (logged-in heuristic)? */
export async function probeChatInput(page: PageLike, selectors: string[]): Promise<boolean> {
  return (await countMatches(page, selectors)) > 0;
}

/** Extract the latest assistant response text. */
export async function extractResponse(page: PageLike, selectors: string[]): Promise<string> {
  return responseText(page, selectors);
}
