#!/usr/bin/env node
/**
 * audit-silent-failures.mjs
 *
 * Detects the SIX failure classes that survived months of review because
 * `tsc`, `esbuild` and a clean `vite build` all pass them:
 *
 *   TDZ      a hook body reads an identifier declared LATER in the same scope
 *   DEAD     a `webContents.send('X')` with no `ipcRenderer.on('X')` anywhere
 *   AWAIT    an `await` NOT in a try/catch, on a line whose function also sets state
 *   BARE     a bare `path` / `BrowserWindow` in main.ts (namespace-only in CJS output)
 *   GATE     `if (api?.f)` guarding a setState — guards absence, never failure
 *   CLAIM    "saved"/"success" state set without checking a success payload
 *
 * Usage:  node scripts/audit-silent-failures.mjs [--json] [paths...]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const TARGETS = argv.filter((a) => !a.startsWith('--'));
const DIRS = TARGETS.length ? TARGETS : ['src', 'resources'];

const EXTS = new Set(['.ts', '.tsx', '.cjs', '.mjs', '.js']);
const findings = [];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'dist-electron', 'backups', '.vite'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.has(extname(e.name))) out.push(p);
  }
  return out;
}

const add = (file, line, cls, msg) =>
  findings.push({ file: relative(ROOT, file), line, cls, msg });

/** Rough brace/paren depth tracker so we know when we leave a function body. */
function findFunctionEnd(lines, start) {
  let depth = 0;
  let started = false;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{' || ch === '(') { depth++; started = true; }
      else if (ch === '}' || ch === ')') depth--;
    }
    if (started && depth <= 0) return i;
  }
  return lines.length - 1;
}

/** Does the line range [a,b] contain a try/catch guarding the await at `line`? */
function hasTryGuard(lines, fnStart, fnEnd, line) {
  let tryDepth = 0;
  for (let i = fnStart; i <= fnEnd; i++) {
    if (/\btry\s*\{/.test(lines[i])) tryDepth++;
    if (tryDepth > 0 && /catch\b/.test(lines[i])) tryDepth--;
    // an await on the same line as `try {` is guarded
    if (i === line && /\btry\s*\{[^}]*\bawait\b/.test(lines[i])) return true;
  }
  return false;
}

// NOTE: an ORPHAN detector was attempted here and REMOVED. Regex cannot resolve
// module identity: barrels hide imports (`export * from './registry'`), default vs
// named imports differ, and scoping the scan to a subtree silently orphans
// everything consumed from outside it. It produced 260, then 163, then 4028
// false positives. Do not re-add it as a regex — it needs a TS-resolver-based
// implementation, or use `tsc --noUnusedLocals`-style tooling. The one orphan
// fact that matters was verified by hand instead (see reports/settings-orphans.md).

const HOOK_RE = /\b(useEffect|useMemo|useCallback|useLayoutEffect)\s*\(/;

function checkFile(file) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');

  // ---------- TDZ + AWAIT + GATE ----------
  const declLine = new Map();
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/\b(?:const|let|var)\s+\[?\s*([A-Za-z_$][\w$]*)/g)) {
      if (!declLine.has(m[1])) declLine.set(m[1], i + 1);
    }
  });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ln = i + 1;

    if (HOOK_RE.test(line)) {
      const end = findFunctionEnd(lines, i);
      const body = lines.slice(i, end + 1).join('\n');
      // TDZ is intentionally NOT checked here: a regex cannot distinguish a free
      // identifier from a parameter or member property, and it produced 260 false
      // positives. Use the AST-accurate scripts/tdz-audit.mjs for that class.
      // AWAIT: unguarded await inside a hook/handler that also sets state
      if (/\bawait\b/.test(body) && !/\btry\b/.test(body) && /\bset[A-Z]\w*\s*\(/.test(body)) {
        add(file, ln, 'AWAIT', 'unguarded `await` in a function that also calls setState — a rejection skips the setState');
      }
      if (/\bif\s*\(\s*[\w?.]*\s*\?\.\s*\w+\s*\)/.test(body) && /\bset[A-Z]\w*\s*\(/.test(body)) {
        add(file, ln, 'GATE', '`if (api?.fn)` gates a setState — guards absence, never failure');
      }
    }
  }

  // ---------- CLAIM: success state without verifying a payload ----------
  lines.forEach((line, i) => {
    if (/\bset(Saved|SaveNotice|HasChanges)\s*\(\s*(true|false)\s*\)/.test(line)) {
      const near = lines.slice(Math.max(0, i - 6), i).join('\n');
      if (!/\.success\b|\bif\s*\(.*\)\s*\{?\s*$/.test(near) && !/success/.test(near)) {
        add(file, i + 1, 'CLAIM', 'marks saved/changed without checking a success payload');
      }
    }
  });
}

// ---------- BARE identifiers in main.ts ----------
function checkMain(file) {
  const src2 = readFileSync(file, 'utf8');
  const lines = src2.split('\n');
  // A bare identifier is only a defect if it is NOT provided by a function-local
  // `const X = require(...)` / `const { X } = require(...)`. This repo declares
  // Electron bindings that way inside dozens of function bodies, so scanning
  // without this exclusion produced 37 findings of which 4/4 sampled were false
  // positives — and the real bug class (a BARE name at MODULE scope) is rare.
  // A module-scope declaration makes EVERY bare use of that name legal.
  // main.ts:39 has `path_1` but :13565 has a bare module-scope
  // `const path = require('path')`, so all 19 "bare path." hits were false
  // positives — which is exactly why the app boots at all.
  const moduleScopeHas = (name) =>
    new RegExp(`^(?:const|let|var)\\s+(?:\\{[^}]*\\b${name}\\b[^}]*\\}|${name})\\s*=\\s*require\\(`, 'm').test(src2);
  const locallyProvided = (name, at) => {
    if (moduleScopeHas(name)) return true;
    for (let k = at; k >= 0 && at - k < 120; k--) {
      const l = lines[k];
      if (new RegExp(`const\\s+\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=\\s*require\\(`).test(l)) return true;
      if (new RegExp(`const\\s+${name}\\s*=\\s*require\\(`).test(l)) return true;
      // a closing brace at lower indent usually ends the enclosing function
      const ind = l.match(/^\s*/)[0].length;
      if (/^\s*}\s*$/.test(l) && ind < (lines[at].match(/^\s*/)[0].length) - 2) return false;
    }
    return false;
  };
  lines.forEach((line, i) => {
    // bare BrowserWindow / path usage not namespaced and not a local destructure
    if (/[^.\w$]BrowserWindow\./.test(line) && !/electron_1\.|require\('electron'\)/.test(line) && !locallyProvided('BrowserWindow', i)) {
      add(file, i + 1, 'BARE', 'bare `BrowserWindow.` — use electron_1.BrowserWindow (CJS output is namespace-only)');
    }
    if (/[^.\w$'"]path\.(join|resolve|dirname|basename)\b/.test(line) && !/path_1\./.test(line) && !locallyProvided('path', i)) {
      add(file, i + 1, 'BARE', 'bare `path.` — use path_1.default');
    }
  });
}

// ---------- DEAD WIRES ----------
function checkDeadWires(files) {
  const corpus = files.map((f) => ({ f, src: readFileSync(f, 'utf8') }));
  const sends = new Map(); // channel -> [{file,line}]
  const subs = new Set();

  for (const { f, src } of corpus) {
    src.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/(?:webContents|mainWindow|win|w)\.send\(\s*['"`]([\w:-]+)['"`]/g)) {
        if (!sends.has(m[1])) sends.set(m[1], []);
        sends.get(m[1]).push({ file: f, line: i + 1 });
      }
      for (const m of line.matchAll(/ipcRenderer\.on\(\s*['"`]([\w:-]+)['"`]/g)) subs.add(m[1]);
      // a contextBridge subscriber in a hand-written .cjs preload counts too
      for (const m of line.matchAll(/\.on\(\s*['"`]([\w:-]+)['"`]\s*,\s*\(?_?e/g)) subs.add(m[1]);
      for (const m of line.matchAll(/addEventListener\??\.??\(?\s*['"`]([\w:-]+)['"`]/g)) subs.add(m[1]);
    });
  }
  for (const [ch, sites] of sends) {
    if (!subs.has(ch)) {
      for (const s of sites) {
        add(s.file, s.line, 'DEAD', `send('${ch}') has NO subscriber — a dead wire`);
      }
    }
  }
}

const files = DIRS.flatMap((d) => {
  const p = join(ROOT, d);
  try { return statSync(p).isDirectory() ? walk(p) : [p]; } catch { return []; }
});

for (const f of files) {
  checkFile(f);
  if (f.endsWith('main.ts')) checkMain(f);
}
checkDeadWires(files);

// ---------- report ----------
const byClass = {};
for (const f of findings) (byClass[f.cls] ||= []).push(f);

if (AS_JSON) {
  console.log(JSON.stringify({ total: findings.length, byClass: Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, v.length])), findings }, null, 2));
} else {
  console.log(`\naudit-silent-failures — ${files.length} files, ${findings.length} finding(s)\n`);
  const order = ['DEAD', 'AWAIT', 'GATE', 'CLAIM', 'BARE'];
  for (const cls of order) {
    const list = byClass[cls];
    if (!list?.length) continue;
    console.log(`── ${cls} (${list.length})`);
    for (const f of list.slice(0, 40)) console.log(`   ${f.file}:${f.line}  ${f.msg}`);
    if (list.length > 40) console.log(`   … ${list.length - 40} more`);
    console.log('');
  }
  if (!findings.length) console.log('  clean\n');
}
process.exit(0);