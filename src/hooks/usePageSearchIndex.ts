import { useEffect, useRef } from 'react';
import type { SearchableSegment } from '../services/search/index';

/**
 * Automatic page indexing for the find bar's All / Section scopes.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * The All scope was effectively empty: only DashboardPage ever called
 * `useSmartSearch(pageId, segments)` by hand, so the whole index held ten
 * hand-written blurbs. Asking every page to hand-author segment arrays does not
 * scale and silently rots — the moment a page is refactored its array is stale
 * and nothing tells you.
 *
 * So we index what the user can actually SEE. Headings open a section; the text
 * blocks beneath them fill it in. That makes every route searchable for free,
 * stays correct across refactors, and cannot drift from the UI because it is
 * derived from the UI.
 *
 * Curated segments still win: they carry a high `rank`, and the find bar
 * collapses duplicate (pageId, title) pairs, so a hand-written blurb and its
 * harvested twin never both show up.
 *
 * Segment ids are `auto:<pageId>:<n>` — deterministic for a given DOM, so a
 * revisit upserts the same slots instead of accumulating.
 */

// Chrome, controls and controls-that-look-like-content: never indexed as prose.
const SKIP = [
  'nav', 'aside', 'header', 'footer', 'script', 'style', 'noscript', 'template',
  'svg', 'canvas', 'iframe', 'button', 'select', 'input', 'textarea', 'kbd', 'code', 'pre',
  '[role="button"]', '[role="tab"]', '[role="menu"]', '[role="navigation"]',
  '[data-page-skip]', '[data-df-find-bar]', '[aria-hidden="true"]',
].join(', ');

const BLOCKS = 'h1, h2, h3, h4, h5, p, li, td, th, dd, dt, figcaption, blockquote, label';
const HEADING = /^H[1-5]$/;

/**
 * Most of this app's UI is div-based cards, charts and stat tiles, not
 * semantic <h2>/<p> prose — a prose-only harvest finds ~16 blocks on the
 * dashboard and nothing useful on chart-heavy pages. So we add a second pass
 * over text-bearing CONTAINER elements, keeping only "leaf" cards (a card that
 * does not itself contain another big text block) plus any card that owns a
 * heading. That yields roughly one segment per visible card, which is the unit
 * a person would say out loud when describing where something is.
 */
const CARDS = 'div, section, article, aside, tr';
const CARD_MIN = 60;

const MAX_SEGMENTS = 140;
const MAX_TEXT = 1400;
const MIN_TEXT = 12;
const SETTLE_MS = 800;
const MAX_REFRESHES = 6;

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Walk the rendered page once and emit one segment per heading-delimited block. */
export function harvestSegments(root: HTMLElement, pageId: string): SearchableSegment[] {
  const out: SearchableSegment[] = [];
  const seen = new Set<string>();

  let section = '';
  let title = '';
  let buf: string[] = [];

  const flush = () => {
    const text = clean(buf.join(' '));
    buf = [];
    if (text.length < MIN_TEXT) { title = ''; return; }
    const key = `${pageId}|${title}|${text.slice(0, 80)}`;
    if (seen.has(key)) { title = ''; return; }
    seen.add(key);
    out.push({
      id: `auto:${pageId}:${out.length}`,
      pageId,
      title: title || clean(text).slice(0, 60),
      text: text.slice(0, MAX_TEXT),
      // Curated segments use rank 2.0/1.5/1.0; harvested content sits below them.
      section: section || undefined,
      rank: 0.5,
    });
    title = '';
  };

  for (const el of Array.from(root.querySelectorAll<HTMLElement>(BLOCKS))) {
    if (out.length >= MAX_SEGMENTS) break;
    if (el.closest(SKIP)) continue;
    // An element that is not laid out cannot be read, so it is not content.
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;

    const text = clean(el.textContent || '');
    if (!text) continue;

    if (HEADING.test(el.tagName)) {
      flush();
      section = text;
      title = text;
      // A heading is also searchable on its own — it is often the only place a
      // feature is named ("Deadlines", "Tier Breakdown").
      out.push({
        id: `auto:${pageId}:h:${out.length}`,
        pageId,
        title: text,
        text,
        section: text,
        keywords: [text],
        rank: 0.6,
      });
      continue;
    }

    buf.push(text);
    if (clean(buf.join(' ')).length > MAX_TEXT) flush();
  }
  flush();

  // ── Pass 2: div-based cards the prose pass cannot see ──────────────────────
  const emitted = new Set(out.map((s) => s.text.slice(0, 80)));
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(CARDS))) {
    if (out.length >= MAX_SEGMENTS) break;
    if (el.closest(SKIP)) continue;
    const text = clean(el.textContent || '');
    if (text.length < CARD_MIN || text.length > MAX_TEXT * 2) continue;

    const nestedBig = Array.from(el.querySelectorAll<HTMLElement>(CARDS))
      .filter((d) => !d.closest(SKIP))
      .filter((d) => clean(d.textContent || '').length >= CARD_MIN);
    const ownsHeading = !!el.querySelector('h1,h2,h3,h4,h5,[role="heading"]');
    if (nestedBig.length > 0 && !ownsHeading) continue; // a layout container, not a card

    const head = text.slice(0, 80);
    if (emitted.has(head)) continue;
    emitted.add(head);

    // Title: prefer a real label, else the card's own first rendered line.
    // innerText (not textContent) because it respects block boundaries — a card
    // whose label and value sit in sibling spans reads as "CustomCategories" via
    // textContent but "Custom Categories" via innerText.
    const headingText = ownsHeading
      ? clean(el.querySelector('h1,h2,h3,h4,h5,[role="heading"]')!.textContent || '')
      : '';
    const firstLine = clean((el.innerText || '').split('\n').find((l) => l.trim().length > 1) || '');
    const label =
      el.getAttribute('data-section') ||
      el.getAttribute('aria-label') ||
      headingText ||
      (firstLine ? (firstLine.length > 60 ? firstLine.slice(0, 60).replace(/\s+\S*$/, '') : firstLine) : '') ||
      clean(text).slice(0, 60);

    out.push({
      id: `auto:${pageId}:c:${out.length}`,
      pageId,
      title: label,
      text: text.slice(0, MAX_TEXT),
      section: label,
      rank: 0.4,
    });
  }

  return out.slice(0, MAX_SEGMENTS);
}

/**
 * Index the current page. Debounced, re-harvested a bounded number of times
 * while the page fills in, and safe to call on every route.
 *
 * Deliberately NOT unindexed on navigate: the All scope is app-wide, so the
 * index has to accumulate the pages you have actually visited. Segment ids are
 * deterministic (`auto:<pageId>:<n>`), so returning to a page upserts the same
 * slots instead of piling up. The index is in-memory and bounded to
 * MAX_SEGMENTS per visited page.
 */
export function usePageSearchIndex(pageId: string): void {
  const api = typeof window !== 'undefined' ? window.deskflowAPI : undefined;
  const refreshes = useRef(0);

  useEffect(() => {
    if (!api?.smartSearchIndex) return;
    let timer = 0;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      const root = document.querySelector<HTMLElement>('[data-page-root]') ?? document.body;
      if (!root) return;
      const segments = harvestSegments(root, pageId);
      if (segments.length === 0) return;
      api.smartSearchIndex(segments)
        .then((r) => {
          if (cancelled) return;
          if (import.meta.env?.DEV) {
            console.debug('[PageIndex] indexed', r?.indexed, 'auto segments for', pageId);
          }
        })
        .catch(() => { /* index is a convenience, never fatal */ });
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, SETTLE_MS);
    };

    schedule();

    // Pages fill in asynchronously (IPC data, charts, virtualised lists), so
    // re-harvest a bounded number of times rather than never — but do not turn
    // this into a permanent observer on a dashboard that ticks every second.
    let obsTimer = 0;
    const obs = new MutationObserver(() => {
      if (refreshes.current >= MAX_REFRESHES) return;
      window.clearTimeout(obsTimer);
      obsTimer = window.setTimeout(() => { refreshes.current += 1; schedule(); }, 1500);
    });
    obs.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(obsTimer);
      obs.disconnect();
      refreshes.current = 0;
      // Intentionally no unindex-page call here — see the note above.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);
}
