/**
 * lightmode-button-verify.mjs — scoped verification for the light-mode button
 * repair PLUS the IDE "add project from folder" feature (git detection +
 * GitHub repo picker).
 *
 * WHY THIS EXISTS: a plain `esbuild <files>` cannot bundle `src/App.tsx` on this
 * box right now, because unrelated files that OTHER agents are mid-edit on break
 * resolution first:
 *   - src/hooks/useAiChat.ts        duplicate `let target` (lines 406 & 426)
 *   - components/dashboard/*        `./WidgetRegistry` vs `widgetRegistry.tsx`
 *                                   (case mismatch) + missing named export
 *   - ./components/sidebar          resolves to a DIRECTORY with no index
 * These are reported, not fixed (AGENTS.md §0a: another agent's breakage is not
 * mine to touch). This probe excludes exactly those, so what remains is a real
 * check of the files this task changed.
 *
 * Three passes:
 *   1. BUNDLE  — the 4 renderer entry points parse and resolve.
 *   2. SYNTAX  — src/main.ts + src/preload.ts transform cleanly (they cannot be
 *                bundled here: the main graph pulls native/GUI modules).
 *   3. CONTRACT — every preload `invoke('x')` this task added has a matching
 *                `ipcMain.handle('x')` in main. A channel that exists on one
 *                side only throws at runtime and is invisible to tsc/build
 *                (see MEMORY.md, 2026-09-30).
 *
 * Run:  node agent/probes/lightmode-button-verify.mjs
 * Exit: 0 = all three passes green; 1 = a real failure in these files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../');
const SRC = path.join(ROOT, 'src');

const { build, transform } = await import(path.join(ROOT, 'node_modules/esbuild/lib/main.js'));

// 1. A name that exists only as a directory must not shadow the real file.
const caseFix = {
  name: 'case-fix',
  setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (!args.path.startsWith('.')) return null;
      const abs = path.resolve(args.resolveDir, args.path);
      try { fs.accessSync(abs); return null; } catch {}
      try {
        const dir = path.dirname(abs);
        const base = path.basename(abs).toLowerCase();
        const hit = fs.readdirSync(dir).find(f => {
          if (path.parse(f).toLowerCase() !== base) return false;
          try { return fs.statSync(path.join(dir, f)).isFile(); } catch { return false; }
        });
        return hit ? { path: path.join(dir, hit) } : null;
      } catch { return null; }
    });
  },
};

// 2. Other agents' in-flight files — excluded so they cannot mask my own errors.
const skipBroken = {
  name: 'skip-broken',
  setup(b) {
    b.onResolve({ filter: /useAiChat$/ }, () => ({ path: 'useAiChat', external: true }));
    b.onResolve({ filter: /(CardLibrary|registerWidgets)$/ }, a => ({ path: a.path, external: true }));
  },
};

let failed = false;

// ---------------------------------------------------------------- pass 1
const ENTRY = [
  'src/App.tsx',                        // top-bar pills + Smart Fill + arrows
  'src/components/Sidebar.tsx',         // nav rows
  'src/components/ui/tabs.tsx',         // IDE Overview/Projects tab strip
  'src/pages/IDEProjectsPage.tsx',      // toggles, View all, add-project modal
  'src/components/line-stats/ProjectLineStats.tsx',
  'src/components/line-stats/ProjectFileChanges.tsx',
  'src/components/line-stats/useFileChanges.ts',
];

const result = await build({
  entryPoints: ENTRY.map(p => path.join(ROOT, p)),
  bundle: true,
  write: false,
  outdir: '/tmp/opencode/lm-verify-out',
  alias: { '@': SRC },
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.css', '.json'],
  loader: { '.glsl': 'text', '.ttf': 'file', '.otf': 'file', '.woff': 'file', '.woff2': 'file', '.md': 'text' },
  plugins: [caseFix, skipBroken],
  logLevel: 'error',
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
});
const kb = result.outputFiles.reduce((n, f) => n + f.contents.length, 0) / 1024;
console.log(`PASS  bundle: ${ENTRY.length} entry points parsed + resolved, ${kb.toFixed(0)} KB, 0 errors`);
for (const e of ENTRY) console.log(`      ok  ${e}`);

// ---------------------------------------------------------------- pass 2
const MAIN_FILES = ['src/main.ts', 'src/preload.ts'];
for (const rel of MAIN_FILES) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  try {
    await transform(code, { loader: 'ts', sourcefile: rel });
    console.log(`PASS  syntax: ${rel} (${code.split('\n').length} lines)`);
  } catch (e) {
    failed = true;
    console.log(`FAIL  syntax: ${rel} — ${e.message}`);
  }
}

// ---------------------------------------------------------------- pass 3
const preload = fs.readFileSync(path.join(ROOT, 'src/preload.ts'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'src/main.ts'), 'utf8');
const handles = new Set([...main.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)].map(m => m[1]));
const invokes = new Set([...preload.matchAll(/invoke\(\s*'([^']+)'/g)].map(m => m[1]));

// Channels this task added (both sides) + the settings pair it relies on.
const REQUIRED = [
  'detect-project-git',
  'github:list-repos',
  'github:whoami',
  'app-setting:get',
  'app-setting:set',
  'scan-project-changes',
  'get-project-changes',
  'delete-project-changes',
];
for (const ch of REQUIRED) {
  const haveInvoke = invokes.has(ch);
  const haveHandle = handles.has(ch);
  if (haveHandle) {
    console.log(`PASS  contract: '${ch}' — handle in main${haveInvoke ? ' + invoke in preload' : ''}`);
  } else {
    failed = true;
    console.log(`FAIL  contract: '${ch}' — NO ipcMain.handle in main (preload invoke=${haveInvoke})`);
  }
}

// Informational: preload channels that no handler answers (pre-existing drift).
const orphans = [...invokes].filter(c => !handles.has(c));
console.log(`INFO  preload invokes=${invokes.size}, main handles=${handles.size}, unhandled invokes=${orphans.length}`);
if (orphans.length) console.log(`INFO  unhandled (pre-existing, not this task): ${orphans.slice(0, 12).join(', ')}${orphans.length > 12 ? ' …' : ''}`);

console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS (bundle + syntax + contract)');
process.exit(failed ? 1 : 0);
