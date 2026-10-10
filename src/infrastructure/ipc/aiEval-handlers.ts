import electron_1 from 'electron';
// ── WHY THIS IS A STATIC IMPORT, NOT require() ─────────────────────────────
// This was `const E = () => require('../../services/aiEval')`. The path was
// correct FOR THIS SOURCE FILE (src/infrastructure/ipc/ is two levels below
// src/), but WRONG FOR THE OUTPUT: the build leaves a bare require() in
// dist-electron/main.cjs, where it resolves to two levels ABOVE the repo root.
// The app died at boot:
//
//     Cannot find module '../../services/aiEval'
//
// A relative require resolves against the EMITTED file, not the source file.
// Any `require('../../x')` in this tree has that bug — the ones in
// airouter-handlers.ts survive only because they sit inside `catch {}`, which
// turns a crash into a SILENT no-op. Silence is worse than a crash.
//
// A static import is inlined by the bundler, so there is no path left to
// misresolve. aiEval.ts has no top-level side effects (verified: no module-
// scope calls, no DB handle at import time), so eager import costs nothing.
import * as Eval from '../../services/aiEval';
const E = () => Eval;

// ===================================================================
// AI Eval Harness IPC — golden cases, run execution, run history.
//
// Registered from main.ts (NOT via infrastructure/ipc/index.ts, which main.ts
// never calls — it imports each handler module directly).
//
// Every handler resolves userPreferences lazily so a provider change in Settings
// takes effect without a restart. All failures return { error } rather than
// throwing: the renderer renders the message, and a rejected promise here would
// surface as an unhandled rejection with no context.
// ===================================================================

export interface EvalHandlerDeps {
  /** Live user preferences; the router needs the configured provider chain. */
  getUserPreferences: () => any;
  /** migrateProviderNames is main.ts-local; supplied by the caller. */
  migrateProviderNames: (raw: string) => any;
}

export function registerAiEvalHandlers(deps: EvalHandlerDeps) {
  const { getUserPreferences, migrateProviderNames } = deps;

  function providersState(): any {
    const prefs = getUserPreferences() || {};
    const state = migrateProviderNames(JSON.parse(prefs.aiProviders || 'null'));
    if (!state?.providers?.some((p: any) => p.enabled)) {
      throw new Error('No AI provider configured — enable one in Settings first');
    }
    return state;
  }

  // ---- cases ----
  electron_1.ipcMain.handle('ai-eval:list-cases', (_e, feature?: string) => {
    try { return { cases: E().listCases(feature) }; }
    catch (err: any) { return { cases: [], error: err?.message }; }
  });

  electron_1.ipcMain.handle('ai-eval:save-case', (_e, c: any) => {
    try { return E().saveCase(c || {}); }
    catch (err: any) { return { ok: false, error: err?.message }; }
  });

  electron_1.ipcMain.handle('ai-eval:delete-case', (_e, id: string) => {
    try { return E().deleteCase(String(id || '')); }
    catch (err: any) { return { deleted: 0, error: err?.message }; }
  });

  electron_1.ipcMain.handle('ai-eval:seed-cases', () => {
    try { return E().seedStarterCases(); }
    catch (err: any) { return { seeded: 0, error: err?.message }; }
  });

  // ---- running ----
  // This one is deliberately AWAITED inside the handler rather than fired and
  // forgotten: the renderer shows per-case results the moment it resolves, and
  // a detached promise would lose every error to the void.
  electron_1.ipcMain.handle('ai-eval:run', async (_e, opts: any) => {
    try {
      const state = providersState();
      const out = await E().runEval({
        label: opts?.label,
        feature: opts?.feature,
        caseIds: Array.isArray(opts?.caseIds) ? opts.caseIds : undefined,
        providersState: state,
        // Structural only for now. A judge mode is accepted so the signature
        // does not change when one lands, but it is not silently pretended.
        judge: 'structural',
      });
      return { run: out, results: out.results };
    } catch (err: any) {
      return { error: err?.message || 'Eval run failed' };
    }
  });

  // ---- history ----
  electron_1.ipcMain.handle('ai-eval:list-runs', (_e, limit?: number) => {
    try { return { runs: E().listRuns(limit || 20) }; }
    catch (err: any) { return { runs: [], error: err?.message }; }
  });

  electron_1.ipcMain.handle('ai-eval:get-run', (_e, runId: string) => {
    try { return E().getRun(String(runId || '')); }
    catch (err: any) { return { run: null, results: [], error: err?.message }; }
  });

  electron_1.ipcMain.handle('ai-eval:compare-runs', (_e, runId: string) => {
    try { return E().compareRuns(String(runId || '')); }
    catch (err: any) { return { run: null, previous: null, deltaPassRate: null, regressions: [], error: err?.message }; }
  });

  electron_1.ipcMain.handle('ai-eval:delete-run', (_e, runId: string) => {
    try { return E().deleteRun(String(runId || '')); }
    catch (err: any) { return { deleted: 0, error: err?.message }; }
  });

  electron_1.ipcMain.handle('ai-eval:stats', () => {
    try { return E().evalStats(); }
    catch (err: any) { return { cases: 0, runs: 0, lastRun: null, error: err?.message }; }
  });

  console.log('[DeskFlow] ✅ AI Eval handlers registered');
}
