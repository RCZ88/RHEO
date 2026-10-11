#!/usr/bin/env node
/**
 * Verification for the Terminal Workspace load + visualization collapse fixes.
 *
 *   node scripts/procmon/test-visualization-perf.cjs
 *
 * These assert the STRUCTURAL properties that caused the lag, because the
 * regressions were structural, not visual:
 *   1. /terminal was a STATIC import -> paid at boot, not at navigation
 *   2. <details> does not unmount -> the scene kept animating while "collapsed"
 *   3. open={...} was controlled -> React undid the user's manual collapse
 *   4. bump() fired every frame -> 60 Hz re-render of the SVG tree even when idle
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
let PASS = 0, FAIL = 0; const fails = [];
const check = (n, c, d) => { if (c) { PASS++; console.log(`  PASS  ${n}`); } else { FAIL++; fails.push(n); console.log(`  FAIL  ${n}${d !== undefined ? '  -> ' + d : ''}`); } };
const sec = (t) => console.log('\n' + '='.repeat(78) + '\n' + t + '\n' + '='.repeat(78));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
/** Strip /* * / comments (and // lines) so explanatory prose about a fixed bug
 *  cannot be misread as the bug itself. Without this, the comment that
 *  DOCUMENTS the old <details> bug reads as the bug still being present. */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const appRaw = read('src/App.tsx');
const tpRaw = read('src/pages/TerminalPage.tsx');
const feedRaw = read('src/components/terminal/workforce/useWorkforceFeed.ts');
const app = appRaw;
const tp = stripComments(tpRaw);
const feed = stripComments(feedRaw);

/* ---------------------------------------------------------------- */
sec('1 — /terminal is lazy-loaded, so the cost moved off app boot');
{
  check('1.1 TerminalPage is NOT a static import', !/^import TerminalPage from/m.test(app),
    (app.match(/import TerminalPage.*/m) || [''])[0]);
  check('1.2 TerminalPage IS a lazy()', /const TerminalPage = lazy\(\(\) => import\('\.\/pages\/TerminalPage'\)\)/.test(app));
  check('1.3 SimpleTerminalPage is lazy too', /const SimpleTerminalPage = lazy/.test(app));

  // The failure mode this introduces: lazy() with no Suspense ancestor throws.
  const routeLine = (app.match(/<Route path="\/terminal".*/) || [''])[0];
  check('1.4 the lazy /terminal route has a <Suspense> ancestor', /<Suspense/.test(routeLine));
  check('1.5 the lazy /terminal route has an <ErrorBoundary>', /<ErrorBoundary>/.test(routeLine));
  check('1.6 the fallback is not a bare spinner', /starting terminal workspace/.test(routeLine));
  check('1.7 <Suspense> is actually imported in App.tsx',
    /import \{[^}]*Suspense[^}]*\} from 'react'/.test(app));
  check('1.8 the page itself is still the same component', /<TerminalPage \/>/.test(routeLine));
  // Guard against the change being reverted into a static import later.
  check('1.9 no leftover duplicate import of TerminalPage',
    (app.match(/import TerminalPage/g) || []).length === 0);
  console.log('  route line:', routeLine.slice(0, 150) + '…');
}

/* ---------------------------------------------------------------- */
sec('2 — the strip really UNMOUNTS when collapsed (the core fix)');
{
  // The root cause: <details> hides children but keeps them mounted.
  check('2.1 the workforce strip no longer uses <details>', !/<details[\s>]/.test(tp),
    (tp.match(/<details[\s>][\s\S]{0,60}/) || [''])[0]);
  check('2.2 no </details> left behind', !/<\/details>/.test(tp));

  // It must be a real conditional render of the panel subtree.
  check('2.3 the panel is behind a workforceExpanded guard',
    /\{workforceExpanded && \(/.test(tp));
  check('2.4 the guard wraps <WorkforcePanel', (() => {
    const i = tp.indexOf('{workforceExpanded && (');
    if (i < 0) return false;
    const seg = tp.slice(i, i + 6000);
    return seg.indexOf('<WorkforcePanel') >= 0;
  })(), 'WorkforcePanel must be inside the guarded region');
  check('2.5 aria-expanded is present (state, not a bare disclosure)',
    /aria-expanded=\{workforceExpanded\}/.test(tp));
  check('2.6 the toggle is a real <button> with a type',
    /<button\s+type="button"[\s\S]{0,200}onClick=\{toggleWorkforceStrip\}/.test(tp));
  check('2.7 aria-controls points at the guarded panel', /aria-controls="workforce-strip-panel"/.test(tp));
  check('2.8 the guarded panel has that id', /id="workforce-strip-panel"/.test(tp));
  check('2.9 the control has a name/title (not icon-only)',
    /title=\{workforceExpanded[\s\S]{0,200}?\}/.test(tp));
}

/* ---------------------------------------------------------------- */
sec('3 — the collapse actually STICKS (the "I closed it and it reopened" bug)');
{
  // open={count <= N} re-applied on every re-render, undoing the manual collapse.
  check('3.1 no count-derived `open=` attribute remains', !/open=\{workforceSummary/.test(tp),
    (tp.match(/open=\{workforceSummary[^}]*\}/) || [''])[0]);
  check('3.2 state is seeded from localStorage', /localStorage\.getItem\(WORKFORCE_STRIP_KEY\)/.test(tp));
  check('3.3 the choice is persisted', /localStorage\.setItem\(WORKFORCE_STRIP_KEY/.test(tp));
  check('3.4 toggling marks the choice as deliberate', /workforceChoiceMade\.current = true/.test(tp));
  check('3.5 the old heuristic now only fires while untouched',
    /if \(workforceChoiceMade\.current\) return;/.test(tp));
  check('3.6 the heuristic can only CLOSE, never force open',
    /workforceSummary\.total > 8\) setWorkforceExpanded\(false\)/.test(tp));
  check('3.7 no heuristic can ever set it back to true',
    !/workforceSummary\.total > 8\) setWorkforceExpanded\(true\)/.test(tp));
  check('3.8 localStorage access is wrapped in try/catch (hard invariant)',
    (() => {
      const i = tp.indexOf('localStorage.getItem(WORKFORCE_STRIP_KEY)');
      return i > 0 && tp.slice(Math.max(0, i - 200), i).includes('try {');
    })(), 'getItem must be inside a try block');
  check('3.9 the setItem is also guarded', (() => {
    const i = tp.indexOf('localStorage.setItem(WORKFORCE_STRIP_KEY');
    return i > 0 && tp.slice(Math.max(0, i - 120), i).includes('try {');
  })());
}

/* ---------------------------------------------------------------- */
sec('4 — no 60 Hz re-render while the scene is static');
{
  check('4.1 the unconditional per-frame bump is gone',
    !/\n\s*bump\(\(n\) => \(n \+ 1\) % 1000000\);\n\s*raf = requestAnimationFrame/.test(feed),
    'a bare bump() immediately before the next rAF is the old unconditional form');
  check('4.2 the bump is now guarded by scene movement',
    /if \(sceneMoved \|\| queuedThisFrame\) bump/.test(feed));
  check('4.3 sceneMoved tests position (walking)', /w\.x !== w\.tx \|\| w\.y !== w\.ty/.test(feed));
  check('4.4 sceneMoved tests action state (acting)', /w\.act !== null/.test(feed));
  check('4.5 a queued event still forces a publish, so a bell cannot go invisible',
    /queuedThisFrame/.test(feed));
  check('4.6 the rAF loop still runs every frame (events stay responsive)',
    /raf = requestAnimationFrame\(loop\);/.test(feed));
  check('4.7 document.hidden still pauses the loop', /document\.addEventListener\('visibilitychange'/.test(feed));
  // Prove the guard is real logic, not a tautology that always publishes.
  const m = feed.match(/let sceneMoved = false;([\s\S]{0,320})if \(sceneMoved \|\| queuedThisFrame\)/);
  check('4.8 the guard can actually evaluate to false', !!m && /sceneMoved = true/.test(m[1]));
}

/* ---------------------------------------------------------------- */
sec('5 — proportions: the strip is bounded, the terminal gets the rest');
{
  const i = tp.indexOf('<div\n              className="shrink-0 border-b');
  const seg = i >= 0 ? tp.slice(i, i + 300) : '';
  check('5.1 the strip still does not grow the page (shrink-0)', /shrink-0/.test(seg), seg.slice(0, 90));
  const j = tp.indexOf('<div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">');
  check('5.2 the column is a flex child that takes remaining height', j > 0);
  check('5.3 it is a min-h-0 flex COLUMN, so children share the height',
    j > 0 && tp.slice(j, j + 120).includes('flex flex-col') && tp.slice(j, j + 120).includes('min-h-0'));
  // The real shape is:
  //   <div class="flex-1 flex flex-col min-h-0">   <- the column
  //     <div class="shrink-0 ...">                  <- the strip: content height only
  //     <div class="flex-1 min-h-0" data-tutorial="term.panes">   <- terminals: the rest
  // So collapsing the strip hands its height back automatically. Assert that
  // ordering, because it is the thing that makes the proportions correct.
  const panes = tp.indexOf('data-tutorial="term.panes"');
  check('5.4 the strip precedes the terminal panes inside the column',
    j > 0 && j < i && i < panes, `column@${j} strip@${i} panes@${panes}`);
  check('5.5 the terminal panes are the flex-1 sibling that absorbs the freed space',
    panes > 0 && tp.slice(panes, panes + 200).includes('flex-1 min-h-0'),
    tp.slice(panes, panes + 160).replace(/\s+/g, ' '));
}

/* ---------------------------------------------------------------- */
sec('6 — the scene still functions when expanded (no regression)');
{
  check('6.1 onFocusTerminal is still wired', /onFocusTerminal=\{/.test(tp));
  check('6.2 onCloseTerminal is still wired', /onCloseTerminal=\{/.test(tp));
  check('6.3 the conductor close path survived the edit', /onCloseConductor=\{/.test(tp));
  check('6.4 onResumeSession survived', /onResumeSession=\{/.test(tp));
  check('6.5 the summary counters are still rendered', /workforceSummary\.open\} open/.test(tp));
  check('6.6 the needsHuman escalation still surfaces',
    /workforceSummary\.needsHuman > 0/.test(tp) && /need you/.test(tp));
  check('6.7 the empty case is still hidden entirely',
    /\{workforceSummary\.total > 0 && \(/.test(tp));
  check('6.8 the chevron rotates rather than swapping glyphs (no reflow)',
    /transition-transform duration-150/.test(tp) && /-rotate-90/.test(tp));
}

/* ---------------------------------------------------------------- */
sec('7 — bundle shape: did the lazy split actually remove boot cost?');
{
  // A static import means TerminalPage lands in the entry chunk. A lazy import
  // means it becomes its own chunk. Verify by checking the import form only;
  // the real proof is the build, which is CZ's job per AGENTS.md 0-0.
  const staticImport = /^import TerminalPage from/m.test(app);
  const lazyImport = /const TerminalPage = lazy\(\(\) => import/.test(app);
  check('7.1 exactly one of static/lazy form is present', staticImport !== lazyImport,
    `static=${staticImport} lazy=${lazyImport}`);
  const bytes = fs.statSync(path.join(ROOT, 'src/pages/TerminalPage.tsx')).size
    + fs.readdirSync(path.join(ROOT, 'src/components/terminal/workforce'))
      .reduce((a, f) => a + fs.statSync(path.join(ROOT, 'src/components/terminal/workforce', f)).size, 0);
  console.log(`  TerminalPage + workforce cluster = ${(bytes / 1024).toFixed(0)} KB of source`);
  console.log(`  that is the payload no longer evaluated at boot, and now fetched only on /terminal navigation`);
}

console.log('\n' + '#'.repeat(78));
console.log(`RESULT: ${PASS} passed, ${FAIL} failed`);
if (FAIL) console.log('FAILED:\n  - ' + fails.join('\n  - '));
console.log('#'.repeat(78));
process.exit(FAIL ? 1 : 0);