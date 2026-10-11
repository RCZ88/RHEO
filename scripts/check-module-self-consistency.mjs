/**
 * Guard against deleting a symbol that is only used INSIDE its own module.
 *
 * I deleted `createId` from src/lib/external/gaps.ts because no other file
 * imported it, and it turned every detectGaps() call into
 * `ReferenceError: createId is not defined`, taking down the External page.
 * An importer audit cannot see that; this walks each module's own body.
 *
 * Usage: node scripts/check-module-self-consistency.mjs [files...]
 * With no arguments it checks the modules this repo has broken before.
 */
import { readFileSync } from 'node:fs';

const DEFAULT_FILES = [
  'src/lib/external/gaps.ts',
  'src/lib/afk.ts',
  'src/lib/sleepWindow.ts',
  'src/shared/sleepWindow.ts',
  'src/lib/dateRange.ts',
];

const BUILTINS = new Set([
  'if','for','while','switch','catch','return','typeof','function','await','async','do','else',
  'Math','Date','JSON','Number','String','Boolean','Array','Object','Set','Map','Promise','Error',
  'parseInt','parseFloat','isFinite','isNaN','setTimeout','clearTimeout','setInterval','clearInterval',
  'console','require','new','super','yield','of','in','void','delete','instanceof','this','case','try','finally','throw','case',
]);

let bad = 0;
for (const file of (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES)) {
  let src;
  try { src = readFileSync(file, 'utf8'); }
  catch { console.log(`  skip (unreadable) ${file}`); continue; }

  // Strip comments first: prose like "loadTime()" inside a comment is not a call.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

  const defined = new Set([
    ...src.matchAll(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/gm),
    ...src.matchAll(/^(?:export\s+)?(?:const|let|var)\s+(\w+)/gm),
    ...src.matchAll(/^(?:export\s+)?type\s+(\w+)/gm),
    ...src.matchAll(/^(?:export\s+)?interface\s+(\w+)/gm),
    ...src.matchAll(/^(?:export\s+)?class\s+(\w+)/gm),
  ].map(m => m[1]));
  defined.add('require');

  // Imports are legitimately used without being declared in the body.
  for (const m of src.matchAll(/import\s+[^;]*?from\s+['"][^'"]+['"]/gs)) {
    for (const n of m[0].matchAll(/(\w+)\s*(?:,|\})/g)) defined.add(n[1]);
    for (const n of m[0].matchAll(/\*\s+as\s+(\w+)/g)) defined.add(n[1]);
    const br = m[0].match(/\{([^}]*)\}/);
    if (br) for (const part of br[1].split(',')) {
      const t = part.trim().split(/\s+as\s+/).pop();
      if (t) defined.add(t.trim());
    }
  }

  const called = new Set([...code.matchAll(/(?<![.\w$])([a-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
  const missing = [...called].filter(c => !defined.has(c) && !BUILTINS.has(c)).sort();

  if (missing.length) {
    bad++;
    console.log(`  FAIL ${file}`);
    for (const m of missing) console.log(`        ${m}() is called but never declared or imported`);
  } else {
    console.log(`  ok   ${file}`);
  }
}

console.log(bad === 0 ? '\nALL MODULES SELF-CONSISTENT' : `\n${bad} MODULE(S) WOULD THROW ReferenceError`);
process.exit(bad === 0 ? 0 : 1);
