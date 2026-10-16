import { build } from 'vite';
process.chdir('/home/clementzhao/dev/rheo');
try {
  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      outDir: '/tmp/opencode/vite-scratch',
      emptyOutDir: true,
      write: false,
      ssr: 'src/main.ts',
      lib: { entry: 'src/main.ts', formats: ['cjs'], fileName: () => 'main.cjs' },
      rollupOptions: { external: ['better-sqlite3','active-win','electron','electron-updater'] },
    },
  });
  console.log('MAIN BUILD OK');
} catch (e) {
  console.log('MAIN BUILD FAILED:', e.message.split('\n').slice(0,4).join('\n'));
  process.exitCode = 1;
}
