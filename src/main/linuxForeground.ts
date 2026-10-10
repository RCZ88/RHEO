// This file used to be an 80-line stale CommonJS build artifact that had been
// committed by mistake as TypeScript source: it contained tsc's `__importDefault`
// boilerplate, `Object.defineProperty(exports, "__esModule")`, and a bare
// `exports.getLinuxForegroundWindow = ...`. Under package.json's `"type": "module"`
// that is a real defect, not a cosmetic warning — `exports` does not exist in ESM,
// so the line was treated as an assignment to an undeclared global.
//
// It was also INCOMPLETE: src/main.ts uses five symbols from this module and the
// file defined one. The real implementation is src/linuxForeground.ts (614 lines),
// which exports all five:
//
//     getLinuxForegroundWindow · lastStrategyUsed · lastStrategyTrace
//     probeLinuxTrackingEnvironment · LINUX_DETECT_BUILD
//
// scripts/build.mjs compiles every .ts under src/main/ into dist-electron/main/, so
// the stale copy was being shipped alongside the real one. Re-export the real module
// instead of keeping a divergent second copy of it.
export * from '../linuxForeground'