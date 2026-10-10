import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

import { builtinModules } from 'node:module';

/** Every Node builtin, both bare and `node:`-prefixed, for rollup `external`. */
const nodeBuiltins = Object.fromEntries(builtinModules.map((m) => [m, true]));

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(async () => {
  const plugins = [react(), tailwindcss()];
  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    optimizeDeps: {
      exclude: ['better-sqlite3'],
      // probe-harness.html loads the same renderer as index.html for browser-mode
      // UI review. It must be scanned too, otherwise Vite never pre-bundles deps
      // that only it reaches and the module graph 404s before React mounts.
      entries: ['index.html', 'probe-harness.html'],
      // d3-force-3d is reached only through a LAZY chain
      // (ContextGraphView → CanvasGraph), so the dep scanner never walks into it
      // and it is left un-prebundled → 404 at import time. Name it explicitly.
      include: ['d3-force-3d'],
    },
    server: {
      fs: {
        // probe-harness.html is test-only scaffolding for browser-mode UI review
        // (see the file header). It must stay in the allow list or the dev server
        // 403s it and the harness is unreachable.
        allow: ['src', 'index.html', 'halo.html', 'probe-harness.html', 'public'],
        deny: ['**/agent/**', '**/TEMP/**', '**/dist-electron/**', '**/release/**', '**/rheo-landing*/**', '**/motion-lab/**', '**/browser-extension/**', '**/lecturer-feature/**', '**/graphify-out/**', '**/scripts/**', '**/resources/**', '**/backups/**'],
      },
    },
    base: './',
    build: {
      emptyOutDir: true,
      minify: false,
      sourcemap: true,
      rollupOptions: {
        // Node builtins MUST stay external in every Vite build here, not just the
        // Electron-main one. `src/linuxForeground.ts` imports `{ promisify } from
        // 'node:util'` on its line 2 (long-standing, in HEAD), and with the
        // builtin left unbundled it resolves to `__vite-browser-external`, which
        // exports no `promisify` — so Step 4 of scripts/build.mjs died with
        // `"promisify" is not exported by "__vite-browser-external"` and no main
        // bundle was ever produced. Marking them external keeps the runtime
        // `require(...)` that Electron main and the preload both expect.
        external: [
          'better-sqlite3',
          ...(Object.keys(nodeBuiltins).flatMap((m) => [m, `node:${m}`]) as string[]),
        ],
        // Three entries. The key MUST stay `index` — naming it `main` would rename
        // the bundle to assets/main.[hash].js, churning anything that reads the
        // filename out of dist/index.html. `halo` is the island's own window; without
        // this entry the island has no HTML document and can never appear.
        input: {
          index: 'index.html',
          halo: 'halo.html',
        },
        output: {
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
        },
        onwarn(warning, warn) {
          if (warning.code === 'CIRCULAR_DEPENDENCY') {
            console.error('\n=== CIRCULAR DEPENDENCY ===');
            console.error('importer:', warning.importer);
            console.error('ids:', warning.ids);
            console.error('==========================\n');
          }
          warn(warning);
        }
      }
    },
  };
})
