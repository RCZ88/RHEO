#!/usr/bin/env node
// Compile main.ts -> dist-electron/main.cjs using electron-vite programmatically
const { build } = require('electron-vite');
const path = require('path');

const config = {
  main: {
    build: {
      outDir: 'dist-electron',
      lib: {
        entry: 'src/main.ts',
        fileName: () => 'main.cjs',
      },
      rollupOptions: {
        external: ['better-sqlite3', 'electron', 'active-win', 'node-pty', 'dotenv', 'ws', 'tailwindcss', 'crypto', 'os', 'path', 'fs', 'child_process', 'util', 'url', 'stream', 'events', 'net', 'http', 'https', 'tls', 'zlib', 'assert', 'querystring', 'buffer'],
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
};

console.log('Building main.ts -> dist-electron/main.cjs...');
build(config).then(() => {
  console.log('Build complete!');
}).catch(e => {
  console.error('Build error:', e.message || e);
  process.exit(1);
});
