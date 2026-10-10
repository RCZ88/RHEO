import { useState, useRef, useEffect, useCallback } from 'react';
import { ImagePlus, X, CheckCircle2, AlertCircle, Loader2, Copy, Save, Eye, Layers, Palette, AlignStartVertical, Type, BarChart3, Download } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import type { CritiqueResult, AnalyzeProgress, VisionHealth } from './types';

type PageState = 'empty' | 'loading' | 'partial' | 'error' | 'populated';

function severityColor(s: string): string {
  switch (s) {
    case 'high': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'med': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'low': return 'text-green-400 bg-green-500/10 border-green-500/30';
    default: return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30';
  }
}

function tabularNum(n: number): string {
  return n.toFixed(1);
}

export function CritiquePage() {
  const [state, setState] = useState<PageState>('empty');
  const [errorMsg, setErrorMsg] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [result, setResult] = useState<CritiqueResult | null>(null);
  const [progress, setProgress] = useState<AnalyzeProgress | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [overlayLayers, setOverlayLayers] = useState({ boxes: true, contrast: true, spacing: true, palette: false });
  const [sidecarOk, setSidecarOk] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const checkHealth = useCallback(async () => {
    try {
      const h: VisionHealth = await (window as any).deskflowAPI.vision.health();
      setSidecarOk(h.status === 'ok');
      if (h.status !== 'ok') {
        await (window as any).deskflowAPI.vision.startSidecar();
        await new Promise(r => setTimeout(r, 1500));
        const h2: VisionHealth = await (window as any).deskflowAPI.vision.health();
        setSidecarOk(h2.status === 'ok');
      }
    } catch {
      setSidecarOk(false);
    }
  }, []);

  useEffect(() => { checkHealth(); }, [checkHealth]);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    if ((window as any).deskflowAPI?.vision?.onProgress) {
      cleanup = (window as any).deskflowAPI.vision.onProgress((data: AnalyzeProgress) => {
        setProgress(data);
        if (state === 'loading') setState('partial');
        if (data.partial) {
          setResult(prev => prev ? deepMerge(prev, data.partial) : data.partial as CritiqueResult);
        }
      });
    }
    return () => { if (cleanup) cleanup(); };
  }, [state]);

  function deepMerge(base: CritiqueResult, partial: Partial<CritiqueResult>): CritiqueResult {
    return { ...base, ...partial, scores: { ...base.scores, ...partial.scores }, meta: { ...base.meta, ...partial.meta } };
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setState('loading');
    setProgress(null);
    setResult(null);
    setErrorMsg('');

    try {
      if (!sidecarOk) {
        await (window as any).deskflowAPI.vision.startSidecar();
        await new Promise(r => setTimeout(r, 1500));
      }

      const reader = new FileReader();
      const b64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { jobId: jid } = await (window as any).deskflowAPI.vision.analyze({
        image_path: b64,
        passes: ['cv', 'ocr'],
        use_cache: true,
      });
      setJobId(jid);

      let polled = false;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
          const res: CritiqueResult = await (window as any).deskflowAPI.vision.getResult(jid);
          if (res && res.scores) {
            setResult(res);
            setState('populated');
            polled = true;
            break;
          }
        } catch { }
      }
      if (!polled) {
        setState('error');
        setErrorMsg('Analysis timed out. The sidecar may still be processing.');
      }
    } catch (err: any) {
      setState('error');
      setErrorMsg(err.message || 'Analysis failed');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleFile(file);
      }
    }
  }

  async function handleCopyJSON() {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  }

  function handleSaveReport() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `critique-${result.image.hash.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setState('empty');
    setImageUrl(null);
    setImageFile(null);
    setResult(null);
    setProgress(null);
    setJobId(null);
    setErrorMsg('');
  }

  return (
    <div className="flex flex-col h-full" onPaste={handlePaste}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Critique</h2>
          {sidecarOk === false && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/10 text-red-400 border border-red-500/30">
              <AlertCircle className="w-2.5 h-2.5" /> Sidecar Down
            </span>
          )}
          {sidecarOk === true && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-500/10 text-green-400 border border-green-500/30">
              <CheckCircle2 className="w-2.5 h-2.5" /> Ready
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {result && (
            <>
              <button onClick={handleCopyJSON} className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors" title="Copy JSON">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleSaveReport} className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors" title="Save Report">
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {state !== 'empty' && (
            <button onClick={handleReset} className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors" title="New Analysis">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* States */}
      {state === 'empty' && (
        <div
          ref={dropRef}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-dashed border-zinc-700/50 hover:border-zinc-500/50 rounded-xl m-5 transition-colors"
        >
          <ImagePlus className="w-10 h-10 text-zinc-600" />
          <div className="text-center">
            <p className="text-sm text-zinc-400">Drop an image or click to browse</p>
            <p className="text-[11px] text-zinc-600 mt-1">Paste from clipboard also works</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

      {(state === 'loading' || state === 'partial') && (
        <div className="flex-1 flex flex-col gap-4 p-5">
          {imageUrl && (
            <div className="relative rounded-xl overflow-hidden border border-zinc-800/60 max-h-[300px]">
              <img src={imageUrl} alt="Uploaded" className="w-full h-full object-contain" />
            </div>
          )}
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            <p className="text-sm text-zinc-400">
              {progress?.pass
                ? `Running ${progress.pass}... ${progress.pct}%`
                : 'Starting analysis...'}
            </p>
            {progress && (
              <div className="w-full max-w-xs h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full transition-all duration-300" style={{ width: `${progress.pct}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-5">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-red-300">{errorMsg}</p>
          <button onClick={handleReset} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700/80 transition-colors">
            Try Again
          </button>
        </div>
      )}

      {state === 'populated' && result && (
        <div className="flex-1 flex gap-4 p-5 min-h-0 overflow-hidden">
          {/* Left: Image + Overlays */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <div className="relative rounded-xl overflow-hidden border border-zinc-800/60 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)]">
              {imageUrl && <img src={imageUrl} alt="Uploaded" className="w-full object-contain max-h-[400px]" />}
              {overlayLayers.boxes && result.elements?.map((el) => (
                <div key={el.id}
                  className="absolute border border-cyan-500/60 bg-cyan-500/10 pointer-events-none"
                  style={{ left: el.bbox[0], top: el.bbox[1], width: el.bbox[2], height: el.bbox[3] }}
                />
              ))}
              {overlayLayers.contrast && result.contrast_issues?.map((ci, i) => (
                <div key={`ci-${i}`}
                  className="absolute border-2 border-red-400/60 pointer-events-none"
                  style={{ left: ci.bbox[0], top: ci.bbox[1], width: ci.bbox[2], height: ci.bbox[3] }}
                />
              ))}
            </div>
            {/* Overlay toggles */}
            <div className="flex gap-2">
              {([
                { key: 'boxes', icon: Layers, label: 'Elements' },
                { key: 'contrast', icon: Eye, label: 'Contrast' },
                { key: 'spacing', icon: AlignStartVertical, label: 'Spacing' },
                { key: 'palette', icon: Palette, label: 'Palette' },
              ] as const).map(l => (
                <button key={l.key}
                  onClick={() => setOverlayLayers(prev => ({ ...prev, [l.key]: !prev[l.key] }))}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${overlayLayers[l.key] ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/60'}`}
                >
                  <l.icon className="w-3 h-3" /> {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Results rail */}
          <div className="w-[360px] shrink-0 flex flex-col gap-3 overflow-y-auto ws-scroll">
            {/* Scores */}
            <GlassCard className="p-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-3">Scores</h3>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'layout', label: 'Layout' },
                  { key: 'color', label: 'Color' },
                  { key: 'contrast', label: 'Contrast' },
                  { key: 'spacing', label: 'Spacing' },
                  { key: 'hierarchy', label: 'Hierarchy' },
                  { key: 'overall', label: 'Overall' },
                ] as const).map(s => (
                  <div key={s.key} className="flex flex-col items-center gap-1 p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/40">
                    <span className="text-[18px] font-bold tabular-nums text-zinc-100">{tabularNum(result.scores[s.key as keyof typeof result.scores])}</span>
                    <span className="text-[9px] text-zinc-500">{s.label}</span>
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${result.scores[s.key as keyof typeof result.scores]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Palette */}
            {result.palette?.length > 0 && (
              <GlassCard className="p-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Palette</h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.palette.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 p-1 rounded bg-zinc-800/40 border border-zinc-700/40">
                      <span className="w-4 h-4 rounded" style={{ backgroundColor: c.hex }} />
                      <span className="text-[10px] font-mono tabular-nums text-zinc-400">{c.hex}</span>
                      <span className="text-[9px] text-zinc-600">{c.role}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Contrast Issues */}
            {result.contrast_issues?.length > 0 && (
              <GlassCard className="p-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Contrast Issues ({result.contrast_issues.length})</h3>
                <div className="space-y-1.5">
                  {result.contrast_issues.map((ci, i) => (
                    <div key={i} className="flex items-start gap-2 p-1.5 rounded bg-zinc-800/40 border border-zinc-700/40">
                      <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${severityColor(ci.severity)}`}>{ci.wcag_level}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-zinc-300">{ci.fg} on {ci.bg}</p>
                        <p className="text-[10px] text-zinc-500 tabular-nums">{ci.ratio.toFixed(2)}:1 (need {ci.required}:1)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* OCR Text */}
            {result.ocr_text?.length > 0 && (
              <GlassCard className="p-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">OCR ({result.ocr_text.length} spans)</h3>
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {result.ocr_text.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-1 rounded bg-zinc-800/30">
                      <span className="text-[11px] text-zinc-300 truncate">{s.text}</span>
                      <span className="text-[9px] text-zinc-600 tabular-nums ml-auto">{s.confidence.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Spacing Issues */}
            {result.spacing_issues?.length > 0 && (
              <GlassCard className="p-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Spacing ({result.spacing_issues.length})</h3>
                <div className="space-y-1.5">
                  {result.spacing_issues.map((si, i) => (
                    <div key={i} className={`p-1.5 rounded border ${severityColor(si.severity).split(' ')[0]} bg-zinc-800/40 border-zinc-700/40`}>
                      <p className="text-[11px] text-zinc-300 capitalize">{si.kind.replace('_', ' ')}</p>
                      <p className="text-[10px] text-zinc-500 tabular-nums">{si.measured_px}px / {si.threshold_px}px threshold — {si.note}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Description */}
            {result.description && (
              <GlassCard className="p-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Description</h3>
                <p className="text-[11px] text-zinc-300 leading-relaxed">{result.description}</p>
              </GlassCard>
            )}

            {/* Meta */}
            {result.meta && (
              <GlassCard className="p-3">
                <p className="text-[9px] text-zinc-600 font-mono tabular-nums">
                  Passes: {result.meta.passes_run.join(', ')} | Timings: {Object.entries(result.meta.timings_ms || {}).map(([k, v]) => `${k}=${v}ms`).join(', ')}
                  {result.meta.cache_hits?.length ? ` | Cached: ${result.meta.cache_hits.join(', ')}` : ''}
                </p>
              </GlassCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
