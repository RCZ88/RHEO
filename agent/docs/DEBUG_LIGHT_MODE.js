/* ============================================================================
 * PASTE INTO DEVTOOLS CONSOLE (Cmd/Ctrl+Shift+I -> Console) on the page that
 * "still looks the same". Run it once per page you are unhappy with.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every fix so far has been verified by reading source and by arithmetic. None
 * of it has been verified against a RUNNING app, because an agent cannot build
 * and cannot attach a debugger here. The light-mode safety net is live in the
 * built CSS, unlayered and correctly specific — so wherever it does not change
 * anything, the offending element is simply not using a bg-zinc-* class, and
 * guessing at which class it uses is how the last three passes went wrong.
 *
 * This prints the ACTUAL painted surfaces. No claims, no theory.
 * ========================================================================== */

(() => {
  const PAPER = new Set([
    'rgb(245, 242, 236)',   // --ws-surface        #f5f2ec
    'rgb(252, 251, 248)',   // --ws-surface-raised #fcfbf8
    'rgb(237, 234, 226)',   // --ws-surface-sunken #edeae2
    'rgb(255, 255, 255)',   // --ws-surface-overlay
    'rgba(0, 0, 0, 0)',     // transparent
  ]);

  const cs = (el) => getComputedStyle(el);
  const label = (el) => {
    const cls = (el.className || '').toString().slice(0, 90);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` +
           (cls ? ` .${cls.replace(/\s+/g, '.')}` : '');
  };

  // Anything big enough to be a PAGE-SURFACE rather than a chip or an icon.
  const AREA_MIN = 120 * 80;

  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width * r.height < AREA_MIN) continue;
    const s = cs(el);
    const bg = s.backgroundColor;
    const hasImage = s.backgroundImage && s.backgroundImage !== 'none';
    const isOffender = !PAPER.has(bg) || hasImage;
    if (!isOffender) continue;
    // Ignore the fixed background stack itself — that is the ambient layer.
    if (el.closest('.fixed.inset-0[aria-hidden="true"]')) continue;
    offenders.push({
      el: label(el),
      bg,
      image: hasImage ? s.backgroundImage.slice(0, 70) + '…' : '-',
      opacity: s.opacity,
      size: `${Math.round(r.width)}x${Math.round(r.height)}`,
      // the single most useful field: what authored it
      src: (el.getAttribute('style') || '').slice(0, 80) || '(no inline style)',
    });
  }

  console.log('%c=== SURFACES THAT ARE NOT WARM PAPER ===', 'color:#fbbf24;font-weight:bold');
  console.log('theme on <html>:', document.documentElement.className || '(none)');
  console.log('page:', document.documentElement.getAttribute('data-page'));
  console.log('dash theme:', document.documentElement.getAttribute('data-dash-theme') || '(current)');
  console.log('count:', offenders.length);

  if (!offenders.length) {
    console.log('%cNothing off-contract found at this size threshold.', 'color:#34d399');
    console.log('If it still LOOKS grey, the problem is below this threshold — lower AREA_MIN.');
  }

  const table = offenders.slice(0, 40);
  console.table(table);

  // The one-liner that fixes most of them if they share an author.
  const tally = {};
  for (const o of offenders) {
    const m = /bg-\[?[a-z0-9#/\[\]()._-]+/.exec(o.el);
    const key = m ? m[0] : o.bg;
    tally[key] = (tally[key] || 0) + 1;
  }
  console.log('%c=== MOST COMMON AUTHORING CLASS ===', 'color:#fbbf24;font-weight:bold');
  console.table(Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([cls, n]) => ({ classUsed: cls, elements: n })));

  return {
    theme: document.documentElement.className,
    page: document.documentElement.getAttribute('data-page'),
    offenders: offenders.length,
    hint: 'paste this whole object back to the agent',
  };
})();
