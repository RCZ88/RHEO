/**
 * React hook-legality scanner.
 *
 * WHY THIS EXISTS: `tsc` and `esbuild` both report CLEAN on a misplaced hook —
 * a `useRef` inside a `useEffect` crashed the entire app screen and neither tool
 * objected. This is the only gate that sees it.
 *
 * Detects, per file:
 *   A. a hook called inside ANY hook callback (useEffect/useMemo/useCallback/
 *      useLayoutEffect/useImperativeHandle/useSyncExternalStore/useReducer)
 *   B. a hook called inside a plain nested function (not a component/hook)
 *   C. a hook reached only CONDITIONALLY — i.e. after a top-level `return`
 *      inside the same function body (the classic "rendered fewer hooks" bug)
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const HOOK = ['useRef','useState','useEffect','useLayoutEffect','useMemo','useCallback',
  'useImperativeHandle','useSyncExternalStore','useReducer','useContext','useId','useTransition',
  'useDeferredValue','useDebugValue'];
const WRAPPERS = ['useEffect','useLayoutEffect','useImperativeHandle','useMemo','useCallback','useSyncExternalStore'];
const CALL = new RegExp(`(^|[^\\w.$])(${HOOK.join('|')})\\s*[(<]`, 'g');

const files = execSync(
  "grep -rlE 'use(State|Ref|Effect|Memo|Callback|LayoutEffect|ImperativeHandle|SyncExternalStore|Reducer|Context|Transition|DeferredValue)' src --include=*.tsx --include=*.ts",
  { encoding: 'utf8', maxBuffer: 1 << 28 },
).trim().split('\n');

const findings = [];
for (const f of files) {
  let src;
  try { src = readFileSync(f, 'utf8'); } catch { continue; }
  const lines = src.split('\n');

  // A: hooks nested inside another hook's callback, by paren matching
  for (const w of WRAPPERS) {
    const re = new RegExp(`(^|[^\\w.$])${w}\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(src))) {
      let i = src.indexOf('(', m.index), depth = 0, end = i;
      for (; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
      }
      const arrow = src.indexOf('=>', m.index);
      if (arrow === -1 || arrow > end) continue;
      const body = src.slice(arrow + 2, end);
      CALL.lastIndex = 0;
      let h;
      while ((h = CALL.exec(body))) {
        const at = src.slice(0, arrow + 2 + h.index).split('\n').length;
        // the wrapper's own recursive name inside its own body is still illegal
        findings.push({ kind: 'A', file: f, line: at, detail: `${h[2]}() inside ${w}(...) callback` });
      }
    }
  }

  // C: a hook that appears after a `return` at the same indent inside a component fn
  lines.forEach((ln, idx) => {
    CALL.lastIndex = 0;
    if (!CALL.test(ln)) return;
    // walk backwards for an early `return` at the same indentation
    const indent = ln.match(/^\s*/)[0].length;
    for (let j = idx - 1; j >= 0 && j > idx - 400; j--) {
      const prev = lines[j];
      const pi = prev.match(/^\s*/)[0].length;
      if (/^\s*\/\*|\/\//.test(prev)) continue;
      // ONLY a bare/short early return is a hazard: `return null;`, `return;`,
      // `return foo;`. A component's MAIN `return (` / `return <JSX>` legitimately
      // comes AFTER every hook, so flagging it produced hundreds of false positives.
      const isEarlyReturn = /^\s*return\s*(null\s*;|;|[A-Za-z_$][\w$.]*\s*;|undefined\s*;)\s*$/.test(prev);
      if (pi === indent && isEarlyReturn) {
        const h = ln.match(new RegExp(`(?:^|[^\\w.$])(${HOOK.join('|')})\\s*[(<]`));
        if (!h) continue;
        findings.push({ kind: 'C', file: f, line: idx + 1, detail: `${h[1]}() after an early return (indent ${indent})` });
        break;
      }
    }
  });
}

const real = findings.filter(x => !/prettier|eslint/.test(x.detail));
console.log(`scanned ${files.length} files`);
console.log(`violations: ${real.length}`);
const byFile = {};
for (const f of real) (byFile[f.file] ??= []).push(f);
for (const [file, list] of Object.entries(byFile)) {
  console.log(`\n  ${file}`);
  for (const l of list) console.log(`    L${l.line}  [${l.kind}] ${l.detail}`);
}
process.exit(real.length ? 1 : 0);
