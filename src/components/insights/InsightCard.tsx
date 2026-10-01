import * as React from "react";
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Award, BarChart3, Zap, Flame, Target, Moon, Timer, Activity } from 'lucide-react';
import type { InsightAtom } from '../../shared/insights';
import type { RewindTheme } from './rewind-themes';
import { REWIND_THEME_MAP, DEFAULT_THEME_ID } from './rewind-themes';

// ─── Kind-specific icon lookup ───────────────────────────
const KIND_ICONS: Record<string, React.FC<{ className?: string }>> = {
  superlative: Zap,
  record: Award,
  streak: Flame,
  anomaly: Activity,
  ratio: BarChart3,
  pattern: Target,
  delta: Activity,
  milestone: Award,
};

const KIND_LABELS: Record<string, string> = {
  superlative: 'TOP APP',
  record: 'NEW RECORD',
  streak: 'STREAK',
  anomaly: 'ANOMALY',
  ratio: 'PRODUCTIVITY',
  pattern: 'PATTERN',
  delta: 'CHANGE',
  milestone: 'MILESTONE',
};

// ═══════════════════════════════════════════════════════════
//  COMPACT MODE (unchanged — per-kind unique layouts)
// ═══════════════════════════════════════════════════════════

function SuperlativeCardCompact({ atom }: { atom: InsightAtom }) {
  const direction = atom.comparison?.direction;
  return (
    <div className="relative rounded-xl border border-indigo-500/20 bg-[#0a0a0f] p-4 min-w-[220px] max-w-[280px] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(99,102,241,0.12)_0%,transparent_70%)]" />
      <div className="relative z-10 text-center">
        <span className="text-[9px] uppercase tracking-[0.15em] text-indigo-400/60 font-medium">TOP APP</span>
        <div className="mt-2 mb-1">
          <span className="text-4xl font-bold text-white tabular-nums tracking-tight" style={{ textShadow: '0 0 30px rgba(99,102,241,0.3)' }}>
            {atom.value}
          </span>
          {atom.unit && <span className="text-sm text-zinc-500 ml-1">{atom.unit}</span>}
        </div>
        <div className="h-px w-12 mx-auto bg-gradient-to-r from-transparent via-amber-500/60 to-transparent my-2" />
        <p className="text-[11px] text-zinc-400 font-medium">{atom.copy?.headline?.replace(/\d+\s*\w*\s*/, '') || 'Top app'}</p>
        {direction && direction !== 'flat' && (
          <div className={`inline-flex items-center gap-1 mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${
            direction === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {direction === 'up' ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {Math.abs(atom.comparison?.deltaPct || 0)}%
          </div>
        )}
      </div>
    </div>
  );
}

function RecordCardCompact({ atom }: { atom: InsightAtom }) {
  return (
    <div className="relative rounded-xl border border-amber-500/20 bg-[#0f0a05] p-4 min-w-[220px] max-w-[280px] overflow-hidden">
      <div className="absolute top-3 right-3">
        <div className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
          <span className="text-[8px] uppercase tracking-[0.2em] text-amber-400 font-bold">NEW RECORD</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <Award className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <span className="text-2xl font-bold text-white tabular-nums">{atom.value}</span>
          {atom.unit && <span className="text-xs text-zinc-500 ml-1">{atom.unit}</span>}
        </div>
      </div>
      <p className="text-[11px] text-zinc-400 mt-2">{atom.copy?.subtext}</p>
    </div>
  );
}

function StreakCardCompact({ atom }: { atom: InsightAtom }) {
  return (
    <div className="relative rounded-xl border border-emerald-500/20 bg-[#050f0a] p-4 min-w-[220px] max-w-[280px] overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 via-emerald-400 to-emerald-600 rounded-l-xl" />
      <div className="pl-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.15em] text-emerald-400/60 font-medium">STREAK</span>
          <span className="text-[9px] text-zinc-600">days</span>
        </div>
        <div className="mt-1">
          <span className="text-3xl font-bold text-emerald-400 tabular-nums">{atom.value}</span>
        </div>
        <p className="text-[11px] text-zinc-400 mt-1">{atom.copy?.subtext}</p>
      </div>
    </div>
  );
}

function AnomalyCardCompact({ atom }: { atom: InsightAtom }) {
  return (
    <div className="relative rounded-xl border border-orange-500/20 bg-[#0f0805] p-4 min-w-[220px] max-w-[280px] overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(249,115,22,1) 10px, rgba(249,115,22,1) 11px)' }} />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[9px] uppercase tracking-[0.15em] text-orange-400/60 font-medium">ANOMALY</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-orange-400 tabular-nums">{atom.value}</span>
          <span className="text-xs text-zinc-500">switches</span>
        </div>
        <p className="text-[11px] text-zinc-400 mt-2">{atom.copy?.subtext}</p>
      </div>
    </div>
  );
}

function RatioCardCompact({ atom }: { atom: InsightAtom }) {
  const ratio = typeof atom.value === 'number' ? atom.value : 0;
  return (
    <div className="relative rounded-xl border border-rose-500/20 bg-[#0f0508] p-4 min-w-[220px] max-w-[280px] overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] uppercase tracking-[0.15em] text-rose-400/60 font-medium">PRODUCTIVITY</span>
        <span className="text-2xl font-bold text-white tabular-nums">{ratio}%</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all"
          style={{ width: `${Math.min(100, ratio)}%` }}
        />
      </div>
      <p className="text-[11px] text-zinc-400 mt-2">{atom.copy?.subtext}</p>
    </div>
  );
}

function PatternCardCompact({ atom }: { atom: InsightAtom }) {
  return (
    <div className="relative rounded-xl border border-indigo-500/20 bg-[#08080f] p-4 min-w-[220px] max-w-[280px] overflow-hidden">
      <svg className="absolute bottom-0 left-0 right-0 h-12 opacity-10" viewBox="0 0 200 40" preserveAspectRatio="none">
        <path d="M0 30 Q25 10 50 25 T100 20 T150 25 T200 15 V40 H0Z" fill="currentColor" className="text-indigo-400" />
      </svg>
      <div className="relative z-10">
        <span className="text-[9px] uppercase tracking-[0.15em] text-indigo-400/60 font-medium">PATTERN</span>
        <div className="mt-2">
          <span className="text-3xl font-bold text-indigo-400 tabular-nums">{atom.value}</span>
          {atom.unit && <span className="text-xs text-zinc-500 ml-1">{atom.unit}</span>}
        </div>
        <p className="text-[11px] text-zinc-400 mt-1">{atom.copy?.subtext}</p>
      </div>
    </div>
  );
}

function DeltaCardCompact({ atom }: { atom: InsightAtom }) {
  const direction = atom.comparison?.direction;
  return (
    <div className="relative rounded-xl border border-cyan-500/20 bg-[#050a0f] p-4 min-w-[220px] max-w-[280px] overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] uppercase tracking-[0.15em] text-cyan-400/60 font-medium">CHANGE</span>
        {direction && direction !== 'flat' && (
          <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            direction === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {direction === 'up' ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {Math.abs(atom.comparison?.deltaPct || 0)}%
          </div>
        )}
      </div>
      <span className="text-3xl font-bold text-cyan-400 tabular-nums">{atom.value}</span>
      {atom.unit && <span className="text-xs text-zinc-500 ml-1">{atom.unit}</span>}
      <p className="text-[11px] text-zinc-400 mt-2">{atom.copy?.subtext}</p>
    </div>
  );
}

const COMPACT_CARDS: Record<string, React.FC<{ atom: InsightAtom }>> = {
  superlative: SuperlativeCardCompact,
  record: RecordCardCompact,
  streak: StreakCardCompact,
  anomaly: AnomalyCardCompact,
  ratio: RatioCardCompact,
  pattern: PatternCardCompact,
  delta: DeltaCardCompact,
  milestone: RecordCardCompact,
};

// ═══════════════════════════════════════════════════════════
//  FULL MODE — themed, per-kind rich layouts
// ═══════════════════════════════════════════════════════════

function formatValue(atom: InsightAtom): string {
  if (atom.unit === 'pct') return `${atom.value}%`;
  if (atom.unit === 'usd') return `$${atom.value}`;
  if (atom.unit === 'hr') return `${atom.value}h`;
  if (atom.unit === 'min') return `${atom.value}m`;
  return `${atom.value}`;
}

function DirectionPill({ atom, theme }: { atom: InsightAtom; theme: RewindTheme }) {
  const dir = atom.comparison?.direction;
  if (!dir || dir === 'flat') return null;
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
      dir === 'up' ? `${theme.pillUp} text-emerald-400` : `${theme.pillDown} text-red-400`
    }`}>
      {dir === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {dir === 'up' ? '+' : ''}{atom.comparison?.deltaPct}%
      <span className={`${theme.muted} font-normal`}>vs baseline</span>
    </div>
  );
}

function ScorePills({ atom, theme }: { atom: InsightAtom; theme: RewindTheme }) {
  const scores = [
    { label: 'Surprise', val: atom.surprise },
    { label: 'Relevance', val: atom.relevance },
    { label: 'Confidence', val: atom.confidence },
  ];
  return (
    <div className="flex gap-6 mt-5">
      {scores.map(s => (
        <div key={s.label} className="text-center">
          <div className={`text-[10px] uppercase tracking-wider ${theme.muted}`}>{s.label}</div>
          <div className={`text-lg font-bold tabular-nums mt-0.5 ${theme.accent}`}>
            {Math.round(s.val * 100)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ ratio, theme }: { ratio: number; theme: RewindTheme }) {
  return (
    <div className={`h-2 rounded-full overflow-hidden ${theme.progressBg}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${theme.progressFill}`}
        style={{ width: `${Math.min(100, ratio)}%` }}
      />
    </div>
  );
}

/** Full-mode superlative — big centered number with glow */
function SuperlativeFull({ atom, theme }: { atom: InsightAtom; theme: RewindTheme }) {
  const Icon = KIND_ICONS[atom.kind] || Zap;
  return (
    <div className="relative rounded-xl border p-8 text-center overflow-hidden" style={{ borderColor: theme.borderHex, background: theme.bgHex }}>
      <div className={`absolute inset-0 ${theme.glow}`} />
      <div className="relative z-10">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${theme.accentBg} mb-5`}>
          <Icon className={`w-3.5 h-3.5 ${theme.accent}`} />
          <span className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${theme.label}`}>{KIND_LABELS[atom.kind]}</span>
        </div>
        <div className={`text-6xl font-bold tabular-nums tracking-tight mb-2 ${theme.value}`} style={{ textShadow: `0 0 40px ${theme.accentHex}33` }}>
          {formatValue(atom)}
        </div>
        {atom.copy?.headline && (
          <h3 className={`text-lg font-semibold mt-4 ${theme.headline}`}>{atom.copy.headline}</h3>
        )}
        {atom.copy?.subtext && (
          <p className={`text-sm mt-2 ${theme.subtext}`}>{atom.copy.subtext}</p>
        )}
        <DirectionPill atom={atom} theme={theme} />
        <div className={`mt-6 pt-5 border-t ${theme.divider}`}>
          <ScorePills atom={atom} theme={theme} />
        </div>
      </div>
    </div>
  );
}

/** Full-mode record — icon card with big value and record badge */
function RecordFull({ atom, theme }: { atom: InsightAtom; theme: RewindTheme }) {
  const Icon = KIND_ICONS[atom.kind] || Award;
  return (
    <div className="relative rounded-xl border p-8 overflow-hidden" style={{ borderColor: theme.borderHex, background: theme.bgHex }}>
      <div className={`absolute inset-0 ${theme.glow}`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${theme.accentBg}`}>
            <Icon className={`w-3.5 h-3.5 ${theme.accent}`} />
            <span className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${theme.label}`}>{KIND_LABELS[atom.kind]}</span>
          </div>
          <div className={`px-3 py-1 rounded-full ${theme.accentBg} border`} style={{ borderColor: theme.borderHex }}>
            <span className={`text-[9px] uppercase tracking-[0.2em] font-bold ${theme.accent}`}>{atom.kind === 'milestone' ? 'MILESTONE' : 'NEW RECORD'}</span>
          </div>
        </div>
        <div className={`text-5xl font-bold tabular-nums mb-3 ${theme.value}`}>
          {formatValue(atom)}
        </div>
        {atom.copy?.headline && (
          <h3 className={`text-lg font-semibold ${theme.headline}`}>{atom.copy.headline}</h3>
        )}
        {atom.copy?.subtext && (
          <p className={`text-sm mt-2 ${theme.subtext}`}>{atom.copy.subtext}</p>
        )}
        <DirectionPill atom={atom} theme={theme} />
        <div className={`mt-6 pt-5 border-t ${theme.divider}`}>
          <ScorePills atom={atom} theme={theme} />
        </div>
      </div>
    </div>
  );
}

/** Full-mode streak — left accent bar, big green number */
function StreakFull({ atom, theme }: { atom: InsightAtom; theme: RewindTheme }) {
  const Icon = KIND_ICONS[atom.kind] || Flame;
  return (
    <div className="relative rounded-xl border overflow-hidden" style={{ borderColor: theme.borderHex, background: theme.bgHex }}>
      <div className={`absolute inset-0 ${theme.glow}`} />
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-500 via-emerald-400 to-emerald-600 rounded-l-xl" />
      <div className="relative z-10 p-8 pl-10">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${theme.accentBg} mb-5`}>
          <Icon className={`w-3.5 h-3.5 ${theme.accent}`} />
          <span className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${theme.label}`}>{KIND_LABELS[atom.kind]}</span>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-5xl font-bold tabular-nums text-emerald-400">{atom.value}</span>
          <span className={`text-lg ${theme.muted}`}>days</span>
        </div>
        {atom.copy?.headline && (
          <h3 className={`text-lg font-semibold ${theme.headline}`}>{atom.copy.headline}</h3>
        )}
        {atom.copy?.subtext && (
          <p className={`text-sm mt-2 ${theme.subtext}`}>{atom.copy.subtext}</p>
        )}
        <div className={`mt-6 pt-5 border-t ${theme.divider}`}>
          <ScorePills atom={atom} theme={theme} />
        </div>
      </div>
    </div>
  );
}

/** Full-mode anomaly — hatch pattern, warning icon */
function AnomalyFull({ atom, theme }: { atom: InsightAtom; theme: RewindTheme }) {
  const Icon = KIND_ICONS[atom.kind] || Activity;
  return (
    <div className="relative rounded-xl border p-8 overflow-hidden" style={{ borderColor: theme.borderHex, background: theme.bgHex }}>
      <div className={`absolute inset-0 ${theme.glow}`} />
      {/* Diagonal hatch */}
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 12px, ${theme.accentHex} 12px, ${theme.accentHex} 13px)` }} />
      <div className="relative z-10">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${theme.accentBg} mb-5`}>
          <Icon className={`w-3.5 h-3.5 ${theme.accent}`} />
          <span className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${theme.label}`}>{KIND_LABELS[atom.kind]}</span>
        </div>
        <div className={`text-5xl font-bold tabular-nums mb-2 ${theme.value}`}>
          {formatValue(atom)}
        </div>
        {atom.copy?.headline && (
          <h3 className={`text-lg font-semibold mt-3 ${theme.headline}`}>{atom.copy.headline}</h3>
        )}
        {atom.copy?.subtext && (
          <p className={`text-sm mt-2 ${theme.subtext}`}>{atom.copy.subtext}</p>
        )}
        <DirectionPill atom={atom} theme={theme} />
        <div className={`mt-6 pt-5 border-t ${theme.divider}`}>
          <ScorePills atom={atom} theme={theme} />
        </div>
      </div>
    </div>
  );
}

/** Full-mode ratio — progress bar hero */
function RatioFull({ atom, theme }: { atom: InsightAtom; theme: RewindTheme }) {
  const Icon = KIND_ICONS[atom.kind] || BarChart3;
  const ratio = typeof atom.value === 'number' ? atom.value : 0;
  return (
    <div className="relative rounded-xl border p-8 overflow-hidden" style={{ borderColor: theme.borderHex, background: theme.bgHex }}>
      <div className={`absolute inset-0 ${theme.glow}`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${theme.accentBg}`}>
            <Icon className={`w-3.5 h-3.5 ${theme.accent}`} />
            <span className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${theme.label}`}>{KIND_LABELS[atom.kind]}</span>
          </div>
          <span className={`text-3xl font-bold tabular-nums ${theme.value}`}>{ratio}%</span>
        </div>
        <ProgressBar ratio={ratio} theme={theme} />
        {atom.copy?.headline && (
          <h3 className={`text-lg font-semibold mt-5 ${theme.headline}`}>{atom.copy.headline}</h3>
        )}
        {atom.copy?.subtext && (
          <p className={`text-sm mt-2 ${theme.subtext}`}>{atom.copy.subtext}</p>
        )}
        <div className={`mt-6 pt-5 border-t ${theme.divider}`}>
          <ScorePills atom={atom} theme={theme} />
        </div>
      </div>
    </div>
  );
}

/** Full-mode pattern — wave decoration */
function PatternFull({ atom, theme }: { atom: InsightAtom; theme: RewindTheme }) {
  const Icon = KIND_ICONS[atom.kind] || Target;
  return (
    <div className="relative rounded-xl border p-8 overflow-hidden" style={{ borderColor: theme.borderHex, background: theme.bgHex }}>
      <div className={`absolute inset-0 ${theme.glow}`} />
      {/* Wave decoration */}
      <svg className="absolute bottom-0 left-0 right-0 h-20 opacity-[0.06]" viewBox="0 0 400 80" preserveAspectRatio="none">
        <path d="M0 60 Q50 20 100 50 T200 40 T300 50 T400 30 V80 H0Z" fill={theme.accentHex} />
      </svg>
      <div className="relative z-10">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${theme.accentBg} mb-5`}>
          <Icon className={`w-3.5 h-3.5 ${theme.accent}`} />
          <span className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${theme.label}`}>{KIND_LABELS[atom.kind]}</span>
        </div>
        <div className={`text-5xl font-bold tabular-nums mb-3 ${theme.value}`}>
          {formatValue(atom)}
        </div>
        {atom.copy?.headline && (
          <h3 className={`text-lg font-semibold ${theme.headline}`}>{atom.copy.headline}</h3>
        )}
        {atom.copy?.subtext && (
          <p className={`text-sm mt-2 ${theme.subtext}`}>{atom.copy.subtext}</p>
        )}
        <DirectionPill atom={atom} theme={theme} />
        <div className={`mt-6 pt-5 border-t ${theme.divider}`}>
          <ScorePills atom={atom} theme={theme} />
        </div>
      </div>
    </div>
  );
}

/** Full-mode delta — change indicator */
function DeltaFull({ atom, theme }: { atom: InsightAtom; theme: RewindTheme }) {
  const Icon = KIND_ICONS[atom.kind] || Activity;
  return (
    <div className="relative rounded-xl border p-8 overflow-hidden" style={{ borderColor: theme.borderHex, background: theme.bgHex }}>
      <div className={`absolute inset-0 ${theme.glow}`} />
      <div className="relative z-10">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${theme.accentBg} mb-5`}>
          <Icon className={`w-3.5 h-3.5 ${theme.accent}`} />
          <span className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${theme.label}`}>{KIND_LABELS[atom.kind]}</span>
        </div>
        <div className={`text-5xl font-bold tabular-nums mb-2 ${theme.value}`}>
          {formatValue(atom)}
        </div>
        {atom.copy?.headline && (
          <h3 className={`text-lg font-semibold mt-3 ${theme.headline}`}>{atom.copy.headline}</h3>
        )}
        {atom.copy?.subtext && (
          <p className={`text-sm mt-2 ${theme.subtext}`}>{atom.copy.subtext}</p>
        )}
        <DirectionPill atom={atom} theme={theme} />
        <div className={`mt-6 pt-5 border-t ${theme.divider}`}>
          <ScorePills atom={atom} theme={theme} />
        </div>
      </div>
    </div>
  );
}

const FULL_CARDS: Record<string, React.FC<{ atom: InsightAtom; theme: RewindTheme }>> = {
  superlative: SuperlativeFull,
  record: RecordFull,
  streak: StreakFull,
  anomaly: AnomalyFull,
  ratio: RatioFull,
  pattern: PatternFull,
  delta: DeltaFull,
  milestone: RecordFull,
};

// ═══════════════════════════════════════════════════════════
//  MAIN EXPORT
// ═══════════════════════════════════════════════════════════

interface InsightCardProps {
  atom: InsightAtom;
  compact?: boolean;
  onClick?: () => void;
  themeId?: string;
}

export function InsightCard({ atom, compact = false, onClick, themeId }: InsightCardProps) {
  // Compact mode: use existing per-kind compact cards
  if (compact) {
    const CompactCard = COMPACT_CARDS[atom.kind] || DeltaCardCompact;
    return (
      <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="cursor-pointer"
      >
        <CompactCard atom={atom} />
      </motion.div>
    );
  }

  // Full mode: themed per-kind cards
  const theme = REWIND_THEME_MAP[themeId || DEFAULT_THEME_ID] || REWIND_THEME_MAP[DEFAULT_THEME_ID];
  const FullCard = FULL_CARDS[atom.kind] || DeltaFull;

  return <FullCard atom={atom} theme={theme} />;
}
