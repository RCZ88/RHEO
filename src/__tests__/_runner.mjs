/**
 * Test runner shim — NOT a `.test.ts`, so the vitest glob will not pick it up.
 *
 * WHY THIS EXISTS. `vitest` is configured in this repo but is NOT INSTALLED and
 * NOT PINNED (`npx vitest` pulls 5.0.3 from the network at run time, which is a
 * version this repo has never committed). So the tests below are written in
 * vitest's own API and will run under the real runner the moment it is added to
 * devDependencies — but until then there is no way to execute them.
 *
 * This shim supplies the four globals vitest injects (`describe`, `it`,
 * `expect`, `beforeEach`), runs the files synchronously, and exits non-zero on
 * any failure. It exists so a test can never be "written but silently never
 * run" — which is worse than having no test at all, because the file looks like
 * coverage.
 *
 *   npx vite-node src/__tests__/_runner.mjs
 *   npx vite-node src/__tests__/_runner.mjs week debounce
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;
const failures = [];
const stack = [];

function describe(name, fn) { stack.push(name); fn(); stack.pop(); }

// vitest exports BOTH `it` and `test` as aliases for the same thing. The shim
// only had `it`, so a test written the (equally idiomatic) `test(...)` threw
// ReferenceError at runtime -- which reads as a broken test rather than a missing
// alias, and costs a debugging round every single time it happens.
const test = it;

function it(name, fn) {
  const label = [...stack, name].join(' › ');
  try {
    fn();
    pass++;
    console.log(`  PASS  ${label}`);
  } catch (e) {
    fail++;
    failures.push(`${label}\n        ${e?.message || e}`);
    console.log(`  FAIL  ${label}`);
  }
}

function expect(actual) {
  const show = (v) => {
    if (typeof v === 'string') return JSON.stringify(v);
    try { return JSON.stringify(v); } catch { return String(v); }
  };
  const matchers = {
    toBe: (want) => { if (actual !== want) throw new Error(`expected ${show(want)}, got ${show(actual)}`); },
    toEqual: (want) => { if (JSON.stringify(actual) !== JSON.stringify(want)) throw new Error(`expected ${show(want)}, got ${show(actual)}`); },
    toBeUndefined: () => { if (actual !== undefined) throw new Error(`expected undefined, got ${show(actual)}`); },
    toBeNull: () => { if (actual !== null) throw new Error(`expected null, got ${show(actual)}`); },
    toBeTruthy: () => { if (!actual) throw new Error(`expected truthy, got ${show(actual)}`); },
    toBeFalsy: () => { if (actual) throw new Error(`expected falsy, got ${show(actual)}`); },
    toBeGreaterThan: (n) => { if (!(actual > n)) throw new Error(`expected > ${n}, got ${show(actual)}`); },
    toBeLessThan: (n) => { if (!(actual < n)) throw new Error(`expected < ${n}, got ${show(actual)}`); },
    toBeLessThanOrEqual: (n) => { if (!(actual <= n)) throw new Error(`expected <= ${n}, got ${show(actual)}`); },
    toBeGreaterThanOrEqual: (n) => { if (!(actual >= n)) throw new Error(`expected >= ${n}, got ${show(actual)}`); },
    toBeCloseTo: (n, dp = 2) => { if (Math.abs(actual - n) > Math.pow(10, -dp) / 2) throw new Error(`expected ~${n}, got ${show(actual)}`); },
    toContain: (n) => { if (!String(actual).includes(n)) throw new Error(`expected ${show(actual)} to contain ${show(n)}`); },
    toMatch: (re) => { if (!re.test(String(actual))) throw new Error(`expected ${show(actual)} to match ${re}`); },
    toHaveLength: (n) => {
      const len = actual?.length;
      if (len !== n) throw new Error(`expected length ${n}, got ${len} (${show(actual)})`);
    },
    toThrow: () => { try { actual(); } catch { return; } throw new Error('expected a throw, got none'); },
  };

  /* `.not` IS CORE VITEST API. Without it every `expect(x).not.toBe(y)` throws
     "Cannot read properties of undefined" — which reads like a broken assertion
     rather than a missing modifier, and quietly pushes you into writing only
     positive assertions. That is a shim bug that silently weakens a whole
     suite, so it is implemented properly: each matcher is wrapped so it passes
     precisely when the positive form FAILS. */
  const negated = {};
  for (const [name, fn] of Object.entries(matchers)) {
    negated[name] = (...args) => {
      let threw = false;
      try { fn(...args); } catch { threw = true; }
      if (!threw) throw new Error(`expected NOT to satisfy .${name}(${args.map(show).join(', ')}), but it did`);
    };
  }
  return { ...matchers, not: negated };
}

function beforeEach(fn) { /* unused in these suites; present for API parity */ }

Object.assign(globalThis, { describe, it, test, expect, beforeEach });

// Only run files that use the injected globals. The pre-existing suites
// (`canvasReducer`, `intentParser`, `ipcAllowlist`, `pollForeground`) do
// `import { describe, it } from 'vitest'`, which cannot resolve until vitest is
// actually installed — so they are excluded here and left to the real runner.
//
//   node/vite-node src/__tests__/_runner.mjs                  -> all shim-compatible
//   vite-node src/__tests__/_runner.mjs week debounce        -> named only
const only = process.argv.slice(2);
let files = readdirSync(HERE).filter((f) => f.endsWith('.test.ts')).sort();
if (only.length) files = files.filter((f) => only.some((n) => f.includes(n)));

console.log(`Running ${files.length} test file(s) with the vitest-API shim\n`);
for (const f of files) {
  console.log(`── ${f} ${'─'.repeat(Math.max(0, 50 - f.length))}`);
  await import(join(HERE, f));
  console.log('');
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  • ${f}`);
}
process.exit(fail ? 1 : 0);