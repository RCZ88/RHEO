#!/usr/bin/env node
/**
 * Bundles the daemon into ONE self-contained ESM file on the Linux partition.
 *
 * Two things this deliberately does NOT do:
 *   1. No npm install. The daemon uses node:sqlite (built into Node 22+) and
 *      nothing else outside the standard library, so there is no node_modules
 *      and no native module to rebuild when Node is upgraded.
 *   2. No copy of src/linuxForeground.ts. It is imported from its real location
 *      in the repo and bundled in. The repo already contained two hand-written
 *      re-implementations of that algorithm (scripts/test-pollForeground.js and
 *      scripts/diagnose-linux-foreground.mjs); a third copy would guarantee they
 *      drift. Now the daemon and the app run the SAME detector by construction.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const dest = process.argv[2] || path.join(process.env.HOME, '.local/share/rheo-tracker');
const outFile = path.join(dest, 'daemon.mjs');

fs.mkdirSync(dest, { recursive: true });

const entry = path.join(here, 'src', 'index.ts');
const external = new Set(['electron', 'better-sqlite3', 'active-win']);

console.log(`bundling ${path.relative(repo, entry)} -> ${outFile}`);

const args = [
  'esbuild',
  entry,
  '--bundle',
  '--platform=node',
  '--target=node22',
  '--format=esm',
  '--banner:js=import{createRequire as __cr}from"node:module";const require=__cr(import.meta.url);',
  `--outfile=${outFile}`,
  `--external:${[...external].join(',')}`,
  '--log-level=warning',
];

execFileSync('npx', args, { cwd: repo, stdio: 'inherit' });

// Syntax gate only. `node --check` does NOT resolve imports and does NOT run the
// module, so this cannot start a tracker or leave a process behind — which is why
// it is used instead of importing the bundle as a smoke test.
execFileSync(process.execPath, ['--check', outFile], { stdio: 'inherit' });

console.log(`ok — ${(fs.statSync(outFile).size / 1024).toFixed(1)} KB at ${outFile}`);