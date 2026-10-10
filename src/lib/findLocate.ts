import type { SearchHit } from '../services/search/index';

/**
 * Getting from a search result back to the thing on screen.
 *
 * The index stores prose, not DOM handles, so a result can only be re-found by
 * matching its own text. The previous attempt used `hit.section` as a
 * `[data-section="…"]` anchor — but auto-indexed segments carry the card's TITLE
 * in `section`, which is not a `data-section` attribute value, so the query
 * never matched and clicking a result silently did nothing.
 *
 * `locateHit` therefore tries, in order:
 *   1. the `data-section` anchor, for curated segments that really have one
 *   2. a text match — the SMALLEST laid-out element whose trimmed text starts
 *      with the stored segment text (smallest = the card, not the whole page)
 *
 * It retries on a short interval because after a route change the target does
 * not exist yet.
 */

export function locateHit(
  hit: Pick<SearchHit, 'text' | 'section' | 'id' | 'locator'>,
  {
    attempts = 40,
    // 40 × 200ms = 8s. A cross-page hit must wait for the route change, the page
    // to mount AND its async data to arrive before the card exists; an 8×150ms
    // budget expired while the target was still loading, so the click navigated
    // but never scrolled. Once the element exists the lookup is instant — the
    // budget only covers the wait, not the work.
    intervalMs = 200,
    onFound,
  }: {
    attempts?: number;
    intervalMs?: number;
    onFound?: (el: HTMLElement) => void;
  } = {},
): void {
  let tries = 0;
  const attempt = () => {
    const el = findTarget(hit);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      flash(el);
      onFound?.(el);
      return;
    }
    if (++tries < attempts) window.setTimeout(attempt, intervalMs);
  };
  attempt();
}

function findTarget(hit: Pick<SearchHit, 'text' | 'section' | 'id' | 'locator'>): HTMLElement | null {
  const visible = (el: HTMLElement | null | undefined) =>
    el && el.getClientRects().length > 0 ? el : null;

  // 0. the exact handle the indexer stamped on the element — most precise
  if (hit.locator && !hit.locator.startsWith('text:')) {
    const byLocator = visible(document.querySelector<HTMLElement>(`[data-df-locator="${CSS.escape(hit.locator)}"]`));
    if (byLocator) return byLocator;
  }

  // 1. a real anchor, if this segment came from a curated page section
  if (hit.section) {
    const anchored = visible(document.querySelector<HTMLElement>(`[data-section="${CSS.escape(hit.section)}"]`));
    if (anchored) return anchored;
  }

  // 2. an explicit text: probe carried on the locator
  const probe = hit.locator?.startsWith('text:')
    ? hit.locator.slice(5)
    : (hit.text || '').replace(/\s+/g, ' ').trim().slice(0, 70);

  const needle = probe.replace(/\s+/g, ' ').trim();
  if (needle.length < 8) return null;

  const root = document.querySelector<HTMLElement>('[data-page-root]') ?? document.body;
  const skip = 'script, style, noscript, nav, aside, [data-df-find-bar], mark, button, input, svg, [aria-hidden="true"]';

  let best: HTMLElement | null = null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const raw = (node as Text).nodeValue || '';
    const text = raw.replace(/\s+/g, ' ').trim();
    if (text.length > 4 && text.startsWith(needle.slice(0, 40))) {
      const parent = (node as Text).parentElement;
      if (parent && !parent.closest(skip)) {
        // Walk up to the nearest card-like container so we scroll a whole
        // section into view rather than a bare <span>.
        let el: HTMLElement = parent;
        while (el.parentElement && el.parentElement !== root && (el.parentElement.textContent || '').length <= text.length * 3) {
          el = el.parentElement;
        }
        if (!best || (el.textContent || '').length < (best.textContent || '').length) best = el;
      }
    }
    node = walker.nextNode();
  }
  const fromWalker = visible(best);
  if (fromWalker) return fromWalker;

  // 3. last resort: any element containing the probe anywhere
  const all = Array.from(root.querySelectorAll<HTMLElement>('div, section, article, li, p, h1, h2, h3, h4'))
    .filter((e) => !e.closest(skip))
    .filter((e) => e.getClientRects().length > 0)
    .filter((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().includes(needle.slice(0, 40)));
  if (all.length === 0) return null;
  return all.reduce((a, b) => ((a.textContent || '').length <= (b.textContent || '').length ? a : b));
}

function flash(el: HTMLElement): void {
  const prev = el.style.transition;
  el.style.transition = 'box-shadow 160ms ease-out, background-color 160ms ease-out';
  el.style.boxShadow = '0 0 0 2px rgba(251,191,36,0.9), 0 0 0 7px rgba(251,191,36,0.22)';
  el.style.backgroundColor = 'rgba(251,191,36,0.10)';
  window.setTimeout(() => {
    el.style.boxShadow = '';
    el.style.backgroundColor = '';
    window.setTimeout(() => { el.style.transition = prev; }, 400);
  }, 900);
}