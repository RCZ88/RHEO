import { build as viteBuild } from 'vite';
import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { connect } from 'net';
import { builtinModules } from 'node:module';


// Externalised non-builtin deps for the Step 4 library build.
const NON_BUILTIN_EXTERNALS = new Set([
  'electron', 'better-sqlite3', 'active-win', 'node-pty', 'dotenv', 'ws',
]);

// Every Node builtin, keyed on the `node:`-prefix-normalised name so the Step 4
// `external` predicate matches both `util` and `node:util`.
const NODE_BUILTINS = new Set(builtinModules.map((m) => m.replace(/^node:/, '')));

// ── LIVE-APP GUARD: never wipe dist/ while the app is running ─────────────
// WHY THIS EXISTS (CZ, 2026-10-05, after the Nth "The application files could
// not be found. Please rebuild: node scripts/build.mjs" crash):
//   The Electron main process serves the renderer STRAIGHT OFF DISK over
//   http://localhost:38123 (see createWindow() in src/main.ts). `vite build`
//   with `emptyOutDir: true` DELETES all of dist/ *before* it writes a single
//   file back. So any build overlapping a running app means the live window
//   requests /index.html, gets ENOENT, and is served the fatal "application
//   files could not be found" page. Worse: if the build then FAILS, dist/ is
//   left permanently empty and the app is bricked for EVERY later launch --
//   and the error page tells you to rebuild, which fails for the same reason.
//   That is the loop. 2 of 11 logged builds failed (agent/logs/build.log).
// THIS GUARD REFUSES TO RUN AT ALL while the app is live. AI agents have no
// right to delete the files out from under a running app (AGENTS.md §0-0).
// CZ-only escape hatch, by name: RHEO_CZ_OVERRIDE=1 (close the app instead).
const RHEO_PROD_PORT = 38123;
function isAppRunning() {
  return new Promise((resolveRunning) => {
    const socket = connect({ host: '127.0.0.1', port: RHEO_PROD_PORT });
    let settled = false;
    const done = (running) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch {}
      resolveRunning(running);
    };
    socket.setTimeout(1500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

// ── Build Mutex (prevent parallel builds) ──────────────────────
const LOCK_FILE = resolve(import.meta.dirname, '..', '.build-lock');
function acquireBuildLock() {
  try {
    const existing = readFileSync(LOCK_FILE, 'utf-8').trim();
    const pid = parseInt(existing);
    if (pid && !isNaN(pid)) {
      try {
        process.kill(pid, 0);
        const stats = statSync(LOCK_FILE);
        if (Date.now() - stats.mtimeMs < 5 * 60 * 1000) {
          console.error(`Build already in progress (PID ${pid}). Wait or kill it.`);
          process.exit(1);
        }
        console.warn(`Stale build lock (PID ${pid}). Removing.`);
        unlinkSync(LOCK_FILE);
      } catch { unlinkSync(LOCK_FILE); }
    }
  } catch {}
  writeFileSync(LOCK_FILE, String(process.pid));
  const cleanup = () => { try { unlinkSync(LOCK_FILE); } catch {} };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });
  process.on('SIGTERM', () => { cleanup(); process.exit(1); });
}
acquireBuildLock();

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'src');
const OUT = resolve(ROOT, 'dist-electron');
const PRELOAD_TEMP = resolve(OUT, 'preload-temp');

function run(desc, cmd) {
  console.log(`\n=== ${desc} ===`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true });
}

function esbuildCompile(tsFile, outFile) {
  const absOut = resolve(OUT, outFile);
  mkdirSync(dirname(absOut), { recursive: true });
  execSync(
    `npx esbuild "${tsFile}" --outfile="${absOut}" --format=cjs --platform=node --target=node22`,
    { cwd: ROOT, stdio: 'inherit', shell: true }
  );
  return absOut;
}

function findAllTs(dir) {
  const result = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = resolve(d, e.name);
      if (e.isDirectory()) {
        if (/\[1\]/.test(e.name) || e.name.startsWith('--')) continue;
        walk(p);
      }
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts') && !e.name.endsWith('.test.ts') && !e.name.endsWith('.spec.ts')) result.push(p);
    }
  }
  walk(dir);
  return result;
}

async function main() {
  // ── GATE: refuse to touch dist/ while the app is running ──────────────
  if (!process.env.RHEO_CZ_OVERRIDE && await isAppRunning()) {
    console.error(
      '\n❌ REFUSING TO BUILD: the app is running (something is listening on 127.0.0.1:' + RHEO_PROD_PORT + ').\n' +
      '   A build DELETES dist/ before writing it back, which would blank the window you\n' +
      '   are using right now, and a failed build would leave the app bricked entirely.\n' +
      '   Close RHEO first, then build. (CZ-only override: RHEO_CZ_OVERRIDE=1)\n'
    );
    process.exit(2);
  }

  // ── Step 1: Renderer — build to a STAGING dir, then swap it in ───────
  // NEVER `vite build` straight into dist/. emptyOutDir deletes dist/ first,
  // so an in-place build means (a) a live app sees an empty dist mid-build and
  // (b) a FAILED build leaves no dist/index.html at all -> every later launch
  // shows "The application files could not be found". Staging + rename makes
  // the swap effectively atomic and leaves the previous good dist/ untouched
  // if the build fails for any reason.
  const DIST = resolve(ROOT, 'dist');
  const STAGING = resolve(ROOT, 'dist-tmp');   // .gitignore'd
  const PREV = resolve(ROOT, 'dist-prev');     // .gitignore'd, removed after swap
  console.log('\n=== Step 1/4: Building renderer (staged -> dist-tmp) ===');
  try {
    execSync(`npx vite build --outDir "${STAGING}"`, { cwd: ROOT, stdio: 'inherit', shell: true });
  } catch (err) {
    rmSync(STAGING, { recursive: true, force: true });
    console.error('\n❌ Renderer build FAILED — the existing dist/ was left UNTOUCHED (app still runs).');
    throw err;
  }
  const stagedIndex = resolve(STAGING, 'index.html');
  if (!existsSync(stagedIndex) || statSync(stagedIndex).size < 1024) {
    rmSync(STAGING, { recursive: true, force: true });
    console.error('\n❌ Renderer build produced no usable index.html — the existing dist/ was left UNTOUCHED.');
    process.exit(1);
  }
  rmSync(PREV, { recursive: true, force: true });
  if (existsSync(DIST)) renameSync(DIST, PREV);
  renameSync(STAGING, DIST);
  rmSync(PREV, { recursive: true, force: true });
  console.log(`  dist/ swapped atomically (index.html ${(statSync(resolve(DIST, 'index.html')).size / 1024).toFixed(0)} KB)`);

  // Step 2: Preload (esbuild for real CJS output — Vite SSR emits ESM which Electron rejects)
  const preloadOut = resolve(OUT, 'preload.cjs');
  console.log('\n=== Step 2/4: Building preload ===');
  execSync(
    `npx esbuild "src/preload.ts" --outfile="${preloadOut}" --bundle --format=cjs --platform=node --target=node22 --external:electron`,
    { cwd: ROOT, stdio: 'inherit', shell: true }
  );
  console.log(`  preload: ${(statSync(preloadOut).size / 1024).toFixed(0)} KB`);

  // Step 3: Pre-compile ALL .ts service + main files to .js (individual files, NOT bundled)
  console.log('\n=== Step 3/4: Pre-compiling services ===');
  const serviceFiles = findAllTs(resolve(SRC, 'services'));
  const domainFiles = findAllTs(resolve(SRC, 'domains'));
  const libFiles = findAllTs(resolve(SRC, 'lib'));
  const sharedFiles = findAllTs(resolve(SRC, 'shared'));
  const mainExtraFiles = findAllTs(resolve(SRC, 'main')).filter(f => !f.endsWith('terminalRelay.ts'));
  const gameDetectionFile = resolve(SRC, 'gameDetection.ts');
  const linuxForegroundFile = resolve(SRC, 'linuxForeground.ts');
  /* `src/systemInputIdle.ts` and `src/infrastructure/**` are required at RUNTIME by
   * main.ts (`require('./systemInputIdle')`, `require('./infrastructure/ipc/goal-handlers')`),
   * and rollup leaves those literal requires in the bundle — so a compiled sibling has to
   * exist next to main.cjs. They were missing from this list, and the 2026-10-21 build
   * shipped a main.cjs that died at boot with "Cannot find module './systemInputIdle'".
   *
   * The list is no longer the only line of defence: step 4b below calls
   * scripts/build-main-modules.mjs, which derives the whole set from main.ts's own
   * require() calls. */
  const systemInputIdleFile = resolve(SRC, 'systemInputIdle.ts');
  const infrastructureFiles = findAllTs(resolve(SRC, 'infrastructure'));
  const allTsFiles = [
    gameDetectionFile, linuxForegroundFile, systemInputIdleFile,
    ...infrastructureFiles,
    ...serviceFiles, ...domainFiles, ...libFiles, ...sharedFiles, ...mainExtraFiles,
  ].filter(f => existsSync(f));

  for (const tsFile of allTsFiles) {
    const rel = relative(SRC, tsFile).replace(/\.ts$/, '.js');
    esbuildCompile(tsFile, rel);
    const absOut = resolve(OUT, rel);
    console.log(`  ${relative(SRC, tsFile)} → ${rel} (${(statSync(absOut).size / 1024).toFixed(0)} KB)`);
  }

  // Copy non-TS runtime files (migrations, resources, etc.)
  const nonTsDirs = [
    { src: resolve(SRC, 'services/learn/db/migrations'), dest: resolve(OUT, 'services/learn/db/migrations') },
    { src: resolve(SRC, 'main/migrations'), dest: resolve(OUT, 'main/migrations') },
    { src: resolve(SRC, 'schemas'), dest: resolve(OUT, 'schemas') },
    { src: resolve(ROOT, 'resources/learn'), dest: resolve(OUT, 'resources/learn') },
    { src: resolve(ROOT, 'resources/focus'), dest: resolve(OUT, 'resources/focus') },
  ];
  for (const dir of nonTsDirs) {
    if (existsSync(dir.src)) {
      mkdirSync(dir.dest, { recursive: true });
      for (const entry of readdirSync(dir.src)) {
        const srcPath = resolve(dir.src, entry);
        if (statSync(srcPath).isFile()) {
          copyFileSync(srcPath, resolve(dir.dest, entry));
          console.log(`  ${entry} → ${relative(OUT, resolve(dir.dest, entry))}`);
        }
      }
    }
  }

  // Copy icon files for window/taskbar/tray icon (platform-appropriate format).
  // main.ts resolveAppIcon() looks these up via path.join(__dirname, '<name>').
  // NOTE: RHEO_AppIcon.icns must exist at repo root for mac builds + darwin runtime.
  for (const icon of ['RHEO_AppIcon.png', 'RHEO_AppIcon.ico', 'RHEO_AppIcon.icns']) {
    const srcPath = resolve(ROOT, icon);
    if (existsSync(srcPath)) {
      copyFileSync(srcPath, resolve(OUT, icon));
      console.log(`  ${icon} → ${icon}`);
    }
  }

  // Copy splash.html to dist/ (splash window loads from here in production)
  const splashHtmlSrc = resolve(SRC, 'splash.html');
  const splashHtmlDest = resolve(ROOT, 'dist', 'splash.html');
  if (existsSync(splashHtmlSrc)) {
    mkdirSync(resolve(ROOT, 'dist'), { recursive: true });
    copyFileSync(splashHtmlSrc, splashHtmlDest);
    console.log(`  splash.html → dist/splash.html`);
  }

  // Copy hand-written .cjs service files (not compiled from .ts)
  const SVC_SRC = resolve(SRC, 'services');
  const SVC_OUT = resolve(OUT, 'services');
  mkdirSync(SVC_OUT, { recursive: true });
  for (const entry of readdirSync(SVC_SRC)) {
    if (entry.endsWith('.cjs')) {
      copyFileSync(resolve(SVC_SRC, entry), resolve(SVC_OUT, entry));
      console.log(`  ${entry} → services/${entry}`);
    }
  }

  // Create .cjs shims for files required as .cjs by main.ts
  const cjsShimTargets = [
    'services/AIService.js',
    'services/SkillDSLParser.js',
    'services/conductor/ConductorService.js',
    'services/ai-gateway/AIGatewayService.js',
    'services/providers/router.js',
    'services/providers/templates.js',
    'services/providers/callProvider.js',
    'services/providers/providerLog.js',
    'services/ProblemsService.js',
    'services/RequestsService.js',
    'services/SkillsService.js',
    'services/AgentHostService.js',
    'gameDetection.js',
  ];
  for (const jsFile of cjsShimTargets) {
    const cjsFile = jsFile.replace(/\.js$/, '.cjs');
    if (existsSync(resolve(OUT, jsFile))) {
      writeFileSync(resolve(OUT, cjsFile), `module.exports = require('./${jsFile.replace(/^.*\//, '')}');\n`);
      console.log(`  ${cjsFile} → shim re-exporting ${jsFile}`);
    }
  }

  // Step 4: Build main process in library mode (services externalized)
  console.log('\n=== Step 4/4: Building main process entry (Vite library mode) ===');
  const mainTemp = resolve(OUT, 'main-temp');
  mkdirSync(mainTemp, { recursive: true });

  await viteBuild({
    root: ROOT,
    configFile: false,
    build: {
      outDir: mainTemp,
      lib: {
        entry: resolve(SRC, 'main.ts'),
        formats: ['cjs'],
        fileName: () => 'main.cjs',
      },
      rollupOptions: {
        // Predicate, not a literal list — `external` strings are matched EXACTLY,
        // and this list was built with bare names ('util', 'os', 'path'). Source
        // files import the `node:`-prefixed spellings, so `node:util` never
        // matched the entry `'util'` and got bundled instead: it resolved to
        // `__vite-browser-external`, which exports no `promisify`, and Step 4
        // died with `"promisify" is not exported by "__vite-browser-external"`.
        // No main bundle was produced at all.
        //
        // Enumerating the names is inherently lossy — any builtin added to Node
        // later would need editing here. Matching on the `node:`-prefix-normalised
        // name covers every builtin, present and future, in either spelling, and
        // keeps the runtime `require()` that Electron main expects.
        external: (id) => {
          if (NON_BUILTIN_EXTERNALS.has(id)) return true;
          const bare = id.startsWith('node:') ? id.slice(5) : id;
          return NODE_BUILTINS.has(bare);
        },
      },
      ssr: undefined,
      minify: false,
      sourcemap: false,
    },
  });

  const mainCjs = resolve(mainTemp, 'main.cjs');
  if (existsSync(mainCjs)) {
    renameSync(mainCjs, resolve(OUT, 'main.cjs'));
    console.log(`  main: ${(statSync(resolve(OUT, 'main.cjs')).size / 1024).toFixed(0)} KB`);
  }
  if (existsSync(mainTemp)) rmSync(mainTemp, { recursive: true, force: true });

  /* ── THE BUNDLE'S INLINED `require()` PATHS ───────────────────────────────────────────
   * main.cjs is ONE file. A literal `require('../lib/x')` that lived in a module rollup
   * INLINED now resolves against dist-electron/ instead of that module's own directory,
   * and dies with "Cannot find module" the moment that code path runs.
   *
   * In main.cjs EVERY relative path is relative to dist-electron/, so collapsing the
   * leading '../' segments to './' is exactly right: `../lib/scheduleParser` and
   * `../../services/connectors/sync-imap` both become `./…`.
   *
   * scripts/rebuild-main.mjs has patched one of these by hand for a long time; this is the
   * same fix, generalised and applied by the FULL build as well. */
  {
    const mainPath = resolve(OUT, 'main.cjs');
    const before = readFileSync(mainPath, 'utf-8');
    const after = before.replace(/require\((['"])(?:\.\.\/)+/g, 'require($1./');
    if (after !== before) {
      writeFileSync(mainPath, after);
      const n = (before.match(/require\((['"])(?:\.\.\/)+/g) || []).length;
      console.log(`  main.cjs: ${n} inlined require() path(s) rewritten to dist-electron-relative`);
    }
  }

  // Create a main.js shim so require('../main') from services resolves
  writeFileSync(resolve(OUT, 'main.js'), 'module.exports = require("./main.cjs");\n');
  console.log(`  main.js shim created`);

  // Create dist-electron/package.json with "type": "commonjs"
  writeFileSync(resolve(OUT, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
  console.log(`  package.json (commonjs) created`);

  // Verify
  const content = readFileSync(resolve(OUT, 'main.cjs'), 'utf-8');
  if (content.includes('./services/') || content.includes('./gameDetection')) {
    console.log('\n  ✅ Services left as external require() (expected)');
  }

  /* ── Step 4b: EVERY runtime module main.cjs requires, derived from main.ts itself ──────
   * Step 3 compiles whole directories; this compiles exactly the modules main.ts pulls in
   * with literal `require('./x')` calls, so a NEW runtime module cannot leave the app
   * unbootable again ("Cannot find module './x'" at launch).
   *
   * scripts/build-main-modules.mjs is the same script scripts/rebuild-main.mjs already
   * calls; the full build simply never did. */
  {
    const modScript = resolve(ROOT, 'scripts', 'build-main-modules.mjs');
    if (existsSync(modScript)) {
      execSync(`"${process.execPath}" "${modScript}"`, { cwd: ROOT, stdio: 'inherit', shell: true });
    }
  }

  console.log('\n✅ Build complete!');
}

main().catch((e) => {
  console.error('\n❌ Build failed:', e.message);
  process.exit(1);
});
