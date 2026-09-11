import { build as viteBuild } from 'vite';
import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'src');
const OUT = resolve(ROOT, 'dist-electron');

async function main() {
  console.log('=== Rebuilding main.cjs (Vite library mode) ===');
  
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
          'electron', 'better-sqlite3', 'active-win', 'node-pty',
          'dotenv', 'ws', 'crypto', 'os', 'path', 'fs',
          'child_process', 'util', 'url', 'stream', 'events',
          'net', 'http', 'https', 'tls', 'zlib', 'assert',
          'querystring', 'buffer',
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
    console.log(`  main.cjs: ${((await import('fs')).statSync(resolve(OUT, 'main.cjs')).size / 1024).toFixed(0)} KB`);
  }
  if (existsSync(mainTemp)) rmSync(mainTemp, { recursive: true, force: true });

  // Copy .cjs service files from src/services/ to dist-electron/services/
  // These are hand-written CJS files (not compiled from .ts) that main.ts requires directly.
  const SVC_SRC = resolve(SRC, 'services');
  const SVC_OUT = resolve(OUT, 'services');
  const cjsFiles = readdirSync(SVC_SRC).filter(f => f.endsWith('.cjs'));
  if (cjsFiles.length > 0) {
    mkdirSync(SVC_OUT, { recursive: true });
    for (const f of cjsFiles) {
      const srcPath = resolve(SVC_SRC, f);
      copyFileSync(srcPath, resolve(SVC_OUT, f));
      console.log(`  services/${f} copied`);
    }
  }

  let content = readFileSync(resolve(OUT, 'main.cjs'), 'utf-8');
  // src/main.ts requires '../lib/scheduleParser' (correct in src/, wrong in dist-electron/)
  if (content.includes('../lib/scheduleParser')) {
    content = content.split('../lib/scheduleParser').join('./lib/scheduleParser');
    const { writeFileSync: wfs } = await import('fs');
    wfs(resolve(OUT, 'main.cjs'), content);
    console.log('  ../lib/scheduleParser → ./lib/scheduleParser (dist path fix)');
  }
  if (content.includes('./services/') || content.includes('./gameDetection')) {
    console.log('  ✅ Services left as external require() (expected)');
  }

  // Pre-compile src/main/terminalRelay.ts — main.cjs requires it at runtime (line 26)
  console.log('\n=== Compiling main/terminalRelay ===');
  {
    const srcPath = resolve(SRC, 'main', 'terminalRelay.ts');
    const outPath = resolve(OUT, 'main', 'terminalRelay.js');
    mkdirSync(dirname(outPath), { recursive: true });
    execSync(
      `npx esbuild "${srcPath}" --outfile="${outPath}" --format=cjs --platform=node --target=node22 2>&1`,
      { cwd: ROOT, stdio: 'inherit', shell: true }
    );
    console.log('  main/terminalRelay.ts → main/terminalRelay.js');
  }

  // Pre-compile src/main/ai/ files that main.cjs requires at runtime
  console.log('\n=== Compiling main/ai/ service files ===');
  const aiDir = resolve(SRC, 'main', 'ai');
  if (existsSync(aiDir)) {
    for (const entry of readdirSync(aiDir)) {
      if (entry.endsWith('.ts') && !entry.endsWith('.d.ts') && !entry.endsWith('.test.ts')) {
        const srcPath = resolve(aiDir, entry);
        const outPath = resolve(OUT, 'main', 'ai', entry.replace(/\.ts$/, '.js'));
        mkdirSync(dirname(outPath), { recursive: true });
        execSync(
          `npx esbuild "${srcPath}" --outfile="${outPath}" --format=cjs --platform=node --target=node22 2>&1`,
          { cwd: ROOT, stdio: 'inherit', shell: true }
        );
        console.log(`  main/ai/${entry} → ${entry.replace(/\.ts$/, '.js')}`);
      }
    }
  }

  console.log('✅ Build complete!');
}

main().catch((e) => {
  console.error('❌ Build failed:', e.message);
  process.exit(1);
});
