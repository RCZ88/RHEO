#!/usr/bin/env node
/**
 * Compile every module that main.cjs REQUIRES AT RUNTIME into dist-electron/.
 *
 * WHY THIS EXISTS
 * ---------------
 * main.ts is bundled to a single dist-electron/main.cjs, but it also contains
 * literal `require('./x')` calls. esbuild leaves those as runtime requires
 * (they are deliberate — dynamic/optional subsystems), so they are NOT inlined
 * and the file must exist next to main.cjs on disk.
 *
 * The build only ever copied src/main/services/*.cjs. So every runtime-required
 * TypeScript module was silently absent from dist-electron, and main.cjs died at
 * startup with `Cannot find module './procmon'` — 46 modules in that state.
 *
 * This was already diagnosed correctly for ONE module (main/migrations/) by an
 * earlier fix in rebuild-main.mjs, with a comment naming this exact failure. It
 * was just never generalised, so the same bug shipped 45 more times.
 *
 * It is derived from main.ts's own require() calls rather than a hand-kept list,
 * so a newly added runtime module cannot regress the boot again.
 */
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { dirname, resolve, relative, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// dist-electron/main.cjs is the bundle of src/main.ts, so dist-electron/ mirrors
// src/: every literal `require('./x')` in main.ts resolves against dist-electron/x
// and is compiled from src/x. ('./main/ai/chatLibrary' -> src/main/ai/chatLibrary.)
const SRC_ROOT = resolve(ROOT, 'src');
const SRC_MAIN = resolve(SRC_ROOT, 'main');
const OUT = resolve(ROOT, 'dist-electron');
const ENTRY = resolve(SRC_ROOT, 'main.ts');

if (!existsSync(ENTRY)) {
  console.error(`build-main-modules: ${relative(ROOT, ENTRY)} not found — nothing to do`);
  process.exit(0);
}

const source = readFileSync(ENTRY, 'utf8');

/** Every literal relative require in main.ts, e.g. "./procmon" -> "procmon". */
const required = new Set();
for (const m of source.matchAll(/require\(\s*['"]\.\/([^'"]+)['"]\s*\)/g)) {
  required.add(m[1].replace(/\.(c?js)$/, ''));
}

/** Resolve a required path to a compilable source file under src/main/. */
function findSource(rel) {
  for (const cand of [`${rel}.ts`, `${rel}.tsx`, join(rel, 'index.ts'), join(rel, 'index.tsx')]) {
    const abs = resolve(SRC_ROOT, cand);
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return null;
}

const compiled = [];
const skipped = [];
const failed = [];

for (const rel of [...required].sort()) {
  const target = resolve(OUT, `${rel}.js`);
  const src = findSource(rel);
  if (!src) {
    // Hand-written .cjs (services/) are copied by build.mjs; note, don't fail.
    skipped.push(rel);
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  try {
    execFileSync('npx', [
      'esbuild', src,
      '--outfile=' + target,
      '--format=cjs',
      '--platform=node',
      '--target=node22',
      '--log-level=error',
    ], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    compiled.push(`${rel} -> ${relative(OUT, target)}`);
  } catch (e) {
    failed.push(`${rel}: ${String(e.stderr || e.message).split('\n')[0]}`);
  }
}

/*
 * SECOND HALF OF THE SHADOW FIX — and the part that actually deletes it.
 *
 * After compiling, any `dist-electron/main/<name>.js` that sits NEXT TO a `dist-electron/main/<name>/`
 * directory is a stale flat leftover from when `<name>` was a single file. Node prefers the file,
 * so it wins resolution and breaks every runtime require under it. Remove those, always.
 */
{
  let removed = 0;
  for (const rel of [...required].sort()) {
    const flat = resolve(OUT, `${rel}.js`);
    const asDir = resolve(OUT, rel);
    if (!existsSync(flat) || !existsSync(asDir)) continue;
    if (!statSync(asDir).isDirectory()) continue;
    if (!statSync(flat).isFile()) continue;
    rmSync(flat, { force: true });
    removed++;
    console.log(`build-main-modules: removed stale flat ${rel}.js shadowing ${rel}/`);
  }
  if (removed) console.log(`build-main-modules: ${removed} stale shadow file(s) removed`);
}

console.log(`build-main-modules: ${compiled.length} runtime module(s) compiled`);
for (const c of compiled) console.log(`  ${c}`);
if (skipped.length) console.log(`  (${skipped.length} not a .ts source, left alone: ${skipped.join(', ')})`);
if (failed.length) {
  console.error(`build-main-modules: ${failed.length} FAILED`);
  for (const f of failed) console.error(`  ${f}`);
  process.exit(1);
}
