import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Check } from 'lucide-react';
import type { InsightAtom } from '../../shared/insights';
import { REWIND_THEME_MAP, DEFAULT_THEME_ID } from './rewind-themes';
import type { RewindTheme } from './rewind-themes';

const DOMAIN_COLORS: Record<string, string> = {
  apps: '#3b82f6',
  browser: '#06b6d4',
  productivity: '#10b981',
  sleep: '#6366f1',
  git: '#f97316',
  ai: '#a855f7',
  external: '#ec4899',
  focus: '#f59e0b',
};

interface ShareCardProps {
  atom: InsightAtom;
  width?: number;
  themeId?: string;
}

export function ShareCard({ atom, width = 400, themeId }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const theme: RewindTheme = REWIND_THEME_MAP[themeId || DEFAULT_THEME_ID] || REWIND_THEME_MAP[DEFAULT_THEME_ID];
  const domainColor = DOMAIN_COLORS[atom.domain] || theme.accentHex;
  const direction = atom.comparison?.direction;

  const handleExport = async () => {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: theme.bgHex,
      });
      const link = document.createElement('a');
      link.download = `deskflow-insight-${atom.id.replace(/[^a-z0-9]/gi, '-')}.png`;
      link.href = dataUrl;
      link.click();
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch (err) {
      console.error('[ShareCard] export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative">
      <div
        ref={cardRef}
        style={{ width, background: theme.bgHex, fontFamily: 'Inter, system-ui, sans-serif', borderColor: theme.borderHex } as React.CSSProperties}
        className="rounded-xl p-6 overflow-hidden relative border"
      >
        {/* Accent glow */}
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-15 blur-3xl"
          style={{ background: theme.accentHex }}
        />
        <div
          className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10 blur-2xl"
          style={{ background: domainColor }}
        />

        {/* Brand mark */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: `${theme.accentHex}22`, color: theme.accentHex }}
          >
            D
          </div>
          <span className={`text-xs font-medium tracking-wide uppercase ${theme.muted}`}>DeskFlow Insight</span>
        </div>

        {/* Headline */}
        {atom.copy?.headline && (
          <h2 className={`text-2xl font-bold leading-tight mb-2 ${theme.headline}`}>
            {atom.copy.headline}
          </h2>
        )}

        {/* Subtext */}
        {atom.copy?.subtext && (
          <p className={`text-sm mb-5 ${theme.subtext}`}>{atom.copy.subtext}</p>
        )}

        {/* Comparison badge */}
        {direction && direction !== 'flat' && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            direction === 'up'
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-red-500/15 text-red-400'
          }`}>
            <span>{direction === 'up' ? '+' : ''}{atom.comparison?.deltaPct}%</span>
            <span className={theme.muted}>vs baseline</span>
          </div>
        )}

        {/* Score pills */}
        <div className={`flex gap-2 mt-5 pt-4 border-t`} style={{ borderColor: theme.borderHex }}>
          {[
            { label: 'Surprise', value: atom.surprise },
            { label: 'Relevance', value: atom.relevance },
            { label: 'Confidence', value: atom.confidence },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-[10px] uppercase tracking-wide ${theme.muted}`}>{s.label}</div>
              <div className="text-xs font-bold tabular-nums mt-0.5" style={{ color: theme.accentHex }}>
                {Math.round(s.value * 100)}
              </div>
            </div>
          ))}
        </div>

        {/* Watermark */}
        <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: `${theme.borderHex}80` }}>
          <span className={`text-[10px] ${theme.muted}`}>{atom.scope.start}</span>
          <span className={`text-[10px] ${theme.muted}`}>deskflow.app</span>
        </div>
        <p className={`text-[9px] text-center mt-2 ${theme.muted}`}>Your data stays on your device</p>
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-xs text-zinc-300 hover:bg-zinc-700/80 hover:text-zinc-100 transition-all disabled:opacity-50 backdrop-blur-sm"
      >
        {done ? (
          <><Check className="w-3.5 h-3.5 text-emerald-400" /> Saved</>
        ) : exporting ? (
          'Exporting...'
        ) : (
          <><Download className="w-3.5 h-3.5" /> Save PNG</>
        )}
      </button>
    </div>
  );
}
