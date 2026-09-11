#!/usr/bin/env node
// Build ONLY main.ts -> dist-electron/main.cjs using electron-vite programmatic API
// This avoids the renderer build that destroys dist-electron/ and fails on @/ aliases
const { build } = require('electron-vite');
const path = require('path');
const fs = require('fs');

// Ensure dist-electron exists
if (!fs.existsSync('dist-electron')) {
  fs.mkdirSync('dist-electron', { recursive: true });
}

// Write a minimal config that ONLY builds main (no preload, no renderer)
const config = {
  configFile: path.resolve('electron.vite.config.ts'),
  main: {
    build: {
      outDir: 'dist-electron',
      lib: {
        entry: 'src/main.ts',
        fileName: () => 'main.cjs',
      },
      rollupOptions: {
        external: [
          'better-sqlite3', 'electron', 'active-win', 'node-pty', 'dotenv', 'ws',
          'crypto', 'os', 'path', 'fs', 'child_process', 'util', 'url', 'stream',
          'events', 'net', 'http', 'https', 'tls', 'zlib', 'assert', 'querystring', 'buffer'
        ],
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist-electron',
      lib: {
        entry: 'src/preload.ts',
        fileName: () => 'preload.cjs',
      },
    },
  },
  renderer: {
    // Disable renderer build entirely
    build: {
      outDir: 'dist',
      emptyOutDir: false,
    },
  },
};

// Override outDir for renderer to a temp dir so it doesn't touch dist-electron
config.renderer.build.outDir = 'dist-renderer-temp';

console.log('Building main.ts -> dist-electron/main.cjs...');
build(config).then(() => {
  console.log('Build complete!');
  // Verify main.cjs exists
  if (fs.existsSync('dist-electron/main.cjs')) {
    const stat = fs.statSync('dist-electron/main.cjs');
    console.log('main.cjs: ' + (stat.size / 1024).toFixed(0) + ' KB');
    // Check patches are present
    const content = fs.readFileSync('dist-electron/main.cjs', 'utf8');
    console.log('app.isQuitting present:', content.includes('app.isQuitting = true'));
    console.log('tray.destroy present:', content.includes('tray.destroy()'));
  } else {
    console.error('main.cjs NOT created!');
  }
}).catch(e => {
  console.error('Build error:', e.message || e);
  process.exit(1);
});
