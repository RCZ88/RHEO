import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    build: {
      outDir: 'dist-electron',
      lib: {
        entry: 'src/main.ts',
        fileName: 'main',
      },
      rollupOptions: {
        external: ['better-sqlite3', 'electron', 'active-win', 'node-pty', 'dotenv', 'ws', 'crypto', 'os', 'path', 'fs', 'child_process', 'util', 'url', 'stream', 'events', 'net', 'http', 'https', 'tls', 'zlib', 'assert', 'querystring', 'buffer'],
        output: {
          entryFileNames: 'main.cjs',
        },
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist-electron',
      lib: {
        entry: 'src/preload.ts',
        fileName: 'preload',
      },
    },
  },
  renderer: {
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: 'index.html',
      },
    },
  },
});
