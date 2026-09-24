import { build as viteBuild } from 'vite';
import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname, relative } from 'path';

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
  // Step 1: Renderer
  run('Step 1/4: Building renderer', 'npx vite build');

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
  const allTsFiles = [gameDetectionFile, linuxForegroundFile, ...serviceFiles, ...domainFiles, ...libFiles, ...sharedFiles, ...mainExtraFiles].filter(f => existsSync(f));

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
        external: [
          'electron',
          'better-sqlite3',
          'active-win',
          'node-pty',
          'dotenv',
          'ws',
          'crypto',
          'os',
          'path',
          'fs',
          'child_process',
          'util',
          'url',
          'stream',
          'events',
          'net',
          'http',
          'https',
          'tls',
          'zlib',
          'assert',
          'querystring',
          'buffer',
        ],
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

  console.log('\n✅ Build complete!');
}

main().catch((e) => {
  console.error('\n❌ Build failed:', e.message);
  process.exit(1);
});
