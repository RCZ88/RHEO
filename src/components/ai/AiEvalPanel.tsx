import { useState, useEffect, useCallback } from 'react';
import { Play, Plus, Trash2, FlaskConical, Check, X, ChevronDown, ChevronRight, RefreshCw, AlertTriangle, FileJson, History } from 'lucide-react';

console.log('%c[AiEvalPanel] v1.0 loaded', 'color: #a78bfa; font-weight: bold');

// Mirrors src/services/aiEval.ts. Kept structurally in sync with that file.
interface EvalCase {
  id: string; feature: string; name: string; systemPrompt: string; prompt: string;
  maxTokens?: number; expectContains?: string[]; expectNotContains?: string[];
  checks?: Array<{ kind: string; value?: string; path?: string; ms?: number; label?: string }>;
  enabled: boolean; createdAt: number;
}
interface CaseResult {
  id: string; name: string; feature: string; status: 'pass' | 'fail' | 'error';
  score: number; latencyMs: number | null; costUsd: number | null;
  provider: string | null; model: string | null; output: string;
  failures: string[]; error?: string; at: number;
}
interface EvalRun {
  id: string; label: string; startedAt: number; finishedAt: number | null;
  total: number; passed: number; failed: number; errored: number;
  meanScore: number; totalCostUsd: number; judgeMode?: string;
  deltaPassRate?: number | null; regressions?: string[];
}

const FEATURES = ['researchDigest', 'goalAssistant', 'resumeBuilder', 'category', 'colors', 'lifeAssistant', 'monthlyRecap', 'contentEngine', 'vision', 'presentation'];

// PAINT P4: all chrome colour comes from tokens. --page-accent resolves to
// #8b5cf6 on [data-page="ai"]; hardcoding violet-* would drift the moment the
// page accent changes, which is exactly the rot LAMINAR §8 exists to prevent.
const ACCENT_TEXT = 'text-[var(--page-accent)]';
const ACCENT_CHIP = 'text-[var(--page-accent)] bg-[color-mix(in_srgb,var(--page-accent)_10%,transparent)] border-[color-mix(in_srgb,var(--page-accent)_22%,transparent)]';
const card = 'bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5';
const inputCls = 'w-full bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] light:bg-white border border-zinc-800/50 light:border-[var(--ws-border)] rounded px-2 py-1 text-[10px] text-zinc-200 light:text-[var(--text-primary)] outline-none placeholder:text-zinc-600 light:text-[var(--text-muted)]';
const btn = 'flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors disabled:opacity-50';
const btnGhost = `${btn} text-zinc-300 light:text-[var(--text-secondary)] bg-zinc-800 light:bg-[color-mix(in_srgb,var(--ws-surface-sunken)_40%,transparent)] border-zinc-700 light:border-[color-mix(in_srgb,var(--ws-border)_30%,transparent)] hover:bg-zinc-700 light:hover:bg-stone-200/40`;
// PAINT Gate E: every interactive element gets hover + focus-visible + an
// explicit press, and the focus ring is the page accent rather than the UA
// default, which would be blue on every other surface in the app.
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-background)] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none';

type Tab = 'cases' | 'runs';

export function AiEvalPanel({ open }: { open: boolean }) {
  const api = (window as any).deskflowAPI;
  const [tab, setTab] = useState<Tab>('cases');
  const [cases, setCases] = useState<EvalCase[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<EvalRun | null>(null);
  const [results, setResults] = useState<CaseResult[]>([]);
  const [comparison, setComparison] = useState<{ previous: EvalRun | null; deltaPassRate: number | null; regressions: string[] } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // draft form
  const [dFeature, setDFeature] = useState('researchDigest');
  const [dName, setDName] = useState('');
  const [dPrompt, setDPrompt] = useState('');
  const [dSystem, setDSystem] = useState('');
  const [dContains, setDContains] = useState('');
  const [dNotContains, setDNotContains] = useState('');

  const loadCases = useCallback(async () => {
    if (!api?.aiEvalListCases) return;
    try {
      const res = await api.aiEvalListCases();
      if (res?.error) setError(res.error); else setCases(res?.cases || []);
    } catch (e: any) { setError(e?.message || 'Failed to load cases'); }
  }, [api]);

  const loadRuns = useCallback(async () => {
    if (!api?.aiEvalListRuns) return;
    try { const res = await api.aiEvalListRuns(); setRuns(res?.runs || []); }
    catch (e: any) { setError(e?.message || 'Failed to load runs'); }
  }, [api]);

  const refreshAll = useCallback(async () => { setLoading(true); await Promise.all([loadCases(), loadRuns()]); setLoading(false); }, [loadCases, loadRuns]);

  useEffect(() => { if (open) refreshAll(); }, [open, refreshAll]);

  const openRun = useCallback(async (runId: string) => {
    if (!api?.aiEvalGetRun) return;
    try {
      const res = await api.aiEvalGetRun(runId);
      setSelectedRun(res?.run || null);
      setResults(res?.results || []);
      const cmp = await api?.aiEvalCompareRuns?.(runId);
      setComparison(cmp ? { previous: cmp.previous, deltaPassRate: cmp.deltaPassRate, regressions: cmp.regressions || [] } : null);
      setExpandedId(null);
    } catch (e: any) { setError(e?.message || 'Failed to load run'); }
  }, [api]);

  const runSuite = useCallback(async () => {
    if (!api?.aiEvalRun) return;
    setRunning(true); setError(null); setNotice(null);
    try {
      const res = await api.aiEvalRun({ label: `Run ${new Date().toLocaleTimeString()}` });
      if (res?.error) { setError(res.error); }
      else {
        const r = res?.run;
        setNotice(`Run finished — ${r.passed}/${r.total} passed${r.errored ? `, ${r.errored} errored` : ''}`);
        await loadRuns();
        if (r?.id) await openRun(r.id);
      }
    } catch (e: any) { setError(e?.message || 'Run failed'); }
    finally { setRunning(false); }
  }, [api, loadRuns, openRun]);

  const addCase = useCallback(async () => {
    if (!api?.aiEvalSaveCase || !dName.trim() || !dPrompt.trim()) {
      setError('Name and prompt are required'); return;
    }
    try {
      const res = await api.aiEvalSaveCase({
        feature: dFeature, name: dName.trim(), prompt: dPrompt,
        systemPrompt: dSystem,
        expectContains: dContains.split('\n').map(s => s.trim()).filter(Boolean),
        expectNotContains: dNotContains.split('\n').map(s => s.trim()).filter(Boolean),
      });
      if (res?.error) setError(res.error);
      else {
        setDName(''); setDPrompt(''); setDSystem(''); setDContains(''); setDNotContains('');
        setShowAdd(false); setNotice('Case saved');
        await loadCases();
      }
    } catch (e: any) { setError(e?.message || 'Save failed'); }
  }, [api, dFeature, dName, dPrompt, dSystem, dContains, dNotContains, loadCases]);

  const removeCase = useCallback(async (id: string) => {
    if (armedDelete !== id) { setArmedDelete(id); window.setTimeout(() => setArmedDelete(null), 3000); return; }
    try { await api?.aiEvalDeleteCase?.(id); setArmedDelete(null); await loadCases(); }
    catch (e: any) { setError(e?.message || 'Delete failed'); }
  }, [api, armedDelete, loadCases]);

  const removeRun = useCallback(async (id: string) => {
    if (armedDelete !== id) { setArmedDelete(id); window.setTimeout(() => setArmedDelete(null), 3000); return; }
    try { await api?.aiEvalDeleteRun?.(id); setArmedDelete(null); setSelectedRun(null); setResults([]); await loadRuns(); }
    catch (e: any) { setError(e?.message || 'Delete failed'); }
  }, [api, armedDelete, loadRuns]);

  if (!open) return null;

  const hasBackend = !!api?.aiEvalListCases;

  // PAINT P6: liveliness L2 (Responsive). A dev tool gets reactivity, not
  // personality — the only motion is the run spinner, which is the correct
  // budget for a data surface. Gate E requires a reduced-motion fallback, so
  // the spinner freezes rather than disappearing (it still reads as "busy").
  return (
    <div className="h-full overflow-y-auto bg-zinc-950 light:bg-white/40 px-4 py-3 space-y-3 text-xs motion-reduce:[&_.animate-spin]:animate-none">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FlaskConical className={`w-3.5 h-3.5 ${ACCENT_TEXT}`} aria-hidden />
        <span className="font-medium text-zinc-200 light:text-[var(--text-primary)]">AI Eval Harness</span>
        <span className="text-[10px] text-zinc-600 light:text-[var(--text-muted)] border border-zinc-800 light:border-[var(--ws-border)] rounded-full px-1.5 py-0.5">regression</span>
        <span className="text-[10px] text-zinc-500 light:text-[var(--text-muted)]">{cases.filter(c => c.enabled).length} cases · {runs.length} runs</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={refreshAll} aria-label="Refresh cases and runs" className={`${btnGhost} ${focusRing}`}><RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}  aria-hidden /></button>
          <button onClick={runSuite} disabled={running || !hasBackend || cases.filter(c => c.enabled).length === 0}
            aria-busy={running}
            className={`${btn} ${ACCENT_CHIP} hover:bg-[color-mix(in_srgb,var(--page-accent)_20%,transparent)] ${focusRing}`}>
            <Play className="w-3 h-3"  aria-hidden /> {running ? 'Running…' : 'Run all'}
          </button>
        </div>
      </div>

      {!hasBackend && (
        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-px" aria-hidden />
          <span>The eval backend is not registered, so cases cannot load. Run <code>npm run build</code>, then reopen DeskFlow so the main process picks up the eval handlers.</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/20">
          <AlertTriangle className="w-3 h-3 shrink-0"  aria-hidden /> {error}
        </div>
      )}
      {notice && !error && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
          <Check className="w-3 h-3 shrink-0"  aria-hidden /> {notice}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5">
        {([['cases', 'Cases', cases.length], ['runs', 'Run history', runs.length]] as const).map(([id, txt, n]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${focusRing} ${tab === id ? ACCENT_CHIP : 'text-zinc-600 light:text-[var(--text-muted)] bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] border-zinc-800/40 hover:text-zinc-400'}`}>
            {txt} ({n})
          </button>
        ))}
      </div>

      {tab === 'cases' ? (
        <>
          <button onClick={() => setShowAdd(v => !v)} aria-expanded={showAdd} className={`flex items-center gap-1.5 text-[10px] text-zinc-400 light:text-[var(--text-muted)] hover:text-zinc-300 light:text-[var(--text-secondary)] transition-colors ${focusRing}`}>
            {showAdd ? <ChevronDown className="w-3 h-3"  aria-hidden /> : <ChevronRight className="w-3 h-3"  aria-hidden />}
            <Plus className="w-3 h-3"  aria-hidden /> Add case
          </button>

          {showAdd && (
            <div className={`${card} space-y-1.5`}>
              <div className="grid grid-cols-2 gap-1.5">
                <select value={dFeature} onChange={e => setDFeature(e.target.value)} className={inputCls}>
                  {FEATURES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input value={dName} onChange={e => setDName(e.target.value)} placeholder="Case name" className={inputCls} />
              </div>
              <textarea value={dPrompt} onChange={e => setDPrompt(e.target.value)} placeholder="Prompt to send" rows={3} className={`${inputCls} resize-y`} />
              <textarea value={dSystem} onChange={e => setDSystem(e.target.value)} placeholder="System prompt (optional)" rows={2} className={`${inputCls} resize-y`} />
              <div className="grid grid-cols-2 gap-1.5">
                <textarea value={dContains} onChange={e => setDContains(e.target.value)} placeholder={'Must contain (one per line)\ne.g. JSON with a "summary" field'} rows={3} className={`${inputCls} resize-y`} />
                <textarea value={dNotContains} onChange={e => setDNotContains(e.target.value)} placeholder={'Must NOT contain (one per line)\ne.g. "I cannot"'} rows={3} className={`${inputCls} resize-y`} />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={addCase} disabled={!dName.trim() || !dPrompt.trim()} className={`${btn} text-emerald-300 bg-emerald-500/10 border-emerald-500/20`}>
                  <Check className="w-3 h-3"  aria-hidden /> Save case
                </button>
                <span className="text-[9px] text-zinc-600 light:text-[var(--text-muted)]">
                  A case with no checks reports as untested, never as passing.
                </span>
              </div>
            </div>
          )}

          {loading && cases.length === 0 ? (
            <div className="py-6 text-center text-[10px] text-zinc-500 light:text-[var(--text-muted)]">Loading…</div>
          ) : cases.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-1 text-zinc-500 light:text-[var(--text-muted)]">
              <FileJson className={`w-4 h-4 ${ACCENT_TEXT}`} aria-hidden />
              <span>No eval cases yet — add one above, or seed the starter suite from the console.</span>
            </div>
          ) : (
            <div className="border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg overflow-hidden divide-y divide-zinc-800/30">
              {cases.map(c => (
                <div key={c.id} className={`flex items-center gap-2 px-2.5 py-1.5 ${c.enabled ? '' : 'opacity-50'}`}>
                  <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${ACCENT_CHIP}`}>{c.feature}</span>
                  <span className="text-[10px] text-zinc-200 light:text-[var(--text-primary)] truncate flex-1">{c.name}</span>
                  <span className="text-[9px] text-zinc-600 light:text-[var(--text-muted)] shrink-0">
                    {(c.expectContains?.length || 0) + (c.expectNotContains?.length || 0) + (c.checks?.length || 0)} checks
                  </span>
                  <button onClick={() => removeCase(c.id)}
                    className={`${btn} shrink-0 ${armedDelete === c.id ? 'text-white bg-rose-600 border-rose-500' : 'text-rose-300 bg-rose-500/10 border-rose-500/20'}`}>
                    <Trash2 className="w-3 h-3"  aria-hidden /> {armedDelete === c.id ? 'Confirm?' : ''}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {runs.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-1 text-zinc-500 light:text-[var(--text-muted)]">
              <History className={`w-4 h-4 ${ACCENT_TEXT}`} aria-hidden />
              <span>No eval runs yet — pick a case and press Run to score the model against it. — press “Run all”.</span>
            </div>
          ) : (
            <div className="border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg overflow-hidden divide-y divide-zinc-800/30">
              {runs.map(r => {
                const rate = r.total ? r.passed / r.total : 0;
                const isSel = selectedRun?.id === r.id;
                return (
                  <div key={r.id} className={`px-2.5 py-1.5 ${isSel ? 'bg-zinc-800/60 light:bg-[var(--ws-surface-sunken)]/20' : ''}`}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => isSel ? (setSelectedRun(null), setResults([])) : openRun(r.id)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                        {isSel ? <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0"  aria-hidden /> : <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0"  aria-hidden />}
                        <span className="text-[10px] text-zinc-200 light:text-[var(--text-primary)] truncate">{r.label}</span>
                        <span className={`text-[9px] font-mono shrink-0 ${rate === 1 ? 'text-emerald-300' : rate >= 0.5 ? 'text-amber-300' : 'text-rose-300'}`}>
                          {r.passed}/{r.total}
                        </span>
                        {r.errored > 0 && <span className="text-[9px] font-mono text-orange-300 shrink-0">{r.errored} err</span>}
                        <span className="text-[9px] text-zinc-600 light:text-[var(--text-muted)] font-mono shrink-0 ml-auto">{new Date(r.startedAt).toLocaleString()}</span>
                      </button>
                      <button onClick={() => removeRun(r.id)}
                        className={`${btn} shrink-0 ${armedDelete === r.id ? 'text-white bg-rose-600 border-rose-500' : 'text-rose-300 bg-rose-500/10 border-rose-500/20'}`}>
                        <Trash2 className="w-3 h-3"  aria-hidden />
                      </button>
                    </div>
                    {isSel && comparison && comparison.deltaPassRate != null && (
                      <div className="mt-1 ml-5 text-[9px] flex items-center gap-2 flex-wrap">
                        <span className={comparison.deltaPassRate >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                          vs previous: {comparison.deltaPassRate >= 0 ? '+' : ''}{(comparison.deltaPassRate * 100).toFixed(0)}% pass rate
                        </span>
                        {comparison.regressions.length > 0 && (
                          <span className="text-rose-300">regressed: {comparison.regressions.join(', ')}</span>
                        )}
                      </div>
                    )}
                    {isSel && (
                      <div className="mt-1 ml-5 space-y-1">
                        {results.map(x => (
                          <div key={x.id}>
                            <button onClick={() => setExpandedId(expandedId === x.id ? null : x.id)}
                              className="w-full flex items-center gap-2 text-left py-0.5">
                              {x.status === 'pass' ? <Check className="w-3 h-3 text-emerald-400 shrink-0"  aria-hidden />
                                : x.status === 'fail' ? <X className="w-3 h-3 text-rose-400 shrink-0"  aria-hidden />
                                : <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0"  aria-hidden />}
                              <span className="text-[10px] text-zinc-300 light:text-[var(--text-secondary)] truncate flex-1">{x.name}</span>
                              <span className="text-[9px] font-mono text-zinc-500 shrink-0">{(x.score * 100).toFixed(0)}%</span>
                              {x.latencyMs != null && <span className="text-[9px] font-mono text-zinc-500 shrink-0">{Math.round(x.latencyMs)}ms</span>}
                            </button>
                            {expandedId === x.id && (
                              <div className="ml-5 mb-1 space-y-1">
                                {x.error && <div className="text-[9px] text-orange-300">{x.error}</div>}
                                {x.failures.length > 0 && (
                                  <ul className="text-[9px] text-rose-300 space-y-0.5 list-disc pl-3">
                                    {x.failures.map((f, i) => <li key={i}>{f}</li>)}
                                  </ul>
                                )}
                                {x.provider && <div className="text-[9px] text-zinc-600 light:text-[var(--text-muted)] font-mono">{x.provider} / {x.model}</div>}
                                {x.output && (
                                  <pre className="text-[9px] leading-relaxed text-zinc-400 light:text-[var(--text-secondary)] bg-black/20 border border-zinc-800/30 light:border-[var(--ws-border)] rounded p-1.5 overflow-auto max-h-48 whitespace-pre-wrap break-words font-mono">
                                    {x.output}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
