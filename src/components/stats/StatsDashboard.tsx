import { useMemo, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BarChart3, Loader2, AlertCircle } from 'lucide-react';
import { KpiRow, type KpiData } from './KpiRow';
import { deriveStats, type AnalyticsRawData, type DerivedStats } from './deriveStats';

const NEON = {
  lime: '#00FF66',
  cyan: '#00F0FF',
  magenta: '#FF007A',
  crimson: '#FF2A4B',
} as const;

const TOOL_COLORS: Record<string, string> = {
  'claude-code': NEON.lime,
  'opencode': NEON.cyan,
  'cursor': '#A78BFA',
  'gemini': '#34D399',
  'codex': '#FBBF24',
  'qwen': '#FB923C',
  'aider': NEON.magenta,
  'kilocode': '#2DD4BF',
};

const TOOL_GLOWS: Record<string, string> = {
  'claude-code': 'rgba(0,255,102,0.4)',
  'opencode': 'rgba(0,240,255,0.4)',
  'cursor': 'rgba(167,139,250,0.4)',
  'gemini': 'rgba(52,211,153,0.4)',
  'codex': 'rgba(251,191,36,0.4)',
  'qwen': 'rgba(251,146,60,0.4)',
  'aider': 'rgba(255,0,122,0.4)',
  'kilocode': 'rgba(45,212,191,0.4)',
};

const FALLBACK_COLORS = [NEON.lime, NEON.cyan, '#A78BFA', '#34D399', '#FBBF24', '#FB923C', NEON.magenta, '#2DD4BF'];
const FALLBACK_GLOWS = ['rgba(0,255,102,0.4)', 'rgba(0,240,255,0.4)', 'rgba(167,139,250,0.4)', 'rgba(52,211,153,0.4)', 'rgba(251,191,36,0.4)', 'rgba(251,146,60,0.4)', 'rgba(255,0,122,0.4)', 'rgba(45,212,191,0.4)'];

const TOOL_NAME_MAP: Record<string, string> = {
  'claude-code': 'Claude Code',
  'opencode': 'OpenCode',
  'cursor': 'Cursor',
  'gemini': 'Gemini',
  'codex': 'Codex',
  'qwen': 'Qwen',
  'aider': 'Aider',
  'kilocode': 'KiloCode',
};

interface StatsDashboardProps {
  rawData?: AnalyticsRawData | null;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  timeframeDays?: number;
}

function formatNum(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

export function StatsDashboard({ rawData, loading, error, onRetry, timeframeDays }: StatsDashboardProps) {
  const stats = useMemo(() => {
    if (!rawData) return null;
    return deriveStats(rawData, timeframeDays);
  }, [rawData, timeframeDays]);

  const isEmpty = !loading && !error && !!stats && !stats.hasData;

  const kpiData: KpiData = {
    totalTokens: stats?.totalTokens || '—',
    totalCost: stats?.totalCost || '—',
    activeSessions: stats?.activeSessions || '—',
    toolsModels: stats?.toolsModels || '—',
    totalTokensNum: stats?.totalTokensNum || 0,
    totalCostNum: stats?.totalCostNum || 0,
    activeSessionsNum: stats?.activeSessionsNum || 0,
    toolsModelsNum: stats?.toolsModelsNum || 0,
    dailyAvgTokens: stats?.dailyAvgTokens || '—',
    dailyAvgCost: stats?.dailyAvgCost || '—',
    dailyAvgMessages: stats?.dailyAvgMessages || '—',
    dailyAvgTokensNum: stats?.dailyAvgTokensNum || 0,
    dailyAvgCostNum: stats?.dailyAvgCostNum || 0,
    dailyAvgMessagesNum: stats?.dailyAvgMessagesNum || 0,
    activeDays: stats?.activeDays || 0,
    loading,
    empty: isEmpty,
    error,
    onRetry,
  };

  return (
    <div className="space-y-3">
      <KpiRow data={kpiData} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StripedBarCard
          title="Tokens by Tool"
          loading={loading}
          empty={isEmpty}
          error={error}
          onRetry={onRetry}
          items={stats?.tokensByTool?.labels?.map((label, i) => ({
            key: label,
            label: TOOL_NAME_MAP[label] || label,
            value: stats?.tokensByTool?.values?.[i] ?? 0,
            color: TOOL_COLORS[label] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
            glow: TOOL_GLOWS[label] || FALLBACK_GLOWS[i % FALLBACK_GLOWS.length],
          })) || []}
          formatValue={(v) => formatNum(v)}
          delay={0.2}
        />
        <StripedBarCard
          title="Sessions by Agent"
          loading={loading}
          empty={isEmpty}
          error={error}
          onRetry={onRetry}
          items={stats?.sessionsByAgent?.labels?.map((label, i) => ({
            key: label,
            label: TOOL_NAME_MAP[label] || label,
            value: stats?.sessionsByAgent?.values?.[i] ?? 0,
            color: TOOL_COLORS[label] || FALLBACK_COLORS[(i + 1) % FALLBACK_COLORS.length],
            glow: TOOL_GLOWS[label] || FALLBACK_GLOWS[(i + 1) % FALLBACK_GLOWS.length],
          })) || []}
          formatValue={(v) => String(v)}
          delay={0.25}
        />
      </div>
    </div>
  );
}

function StripedBarCard({
  title,
  loading,
  empty,
  error,
  onRetry,
  items,
  formatValue,
  delay = 0,
}: {
  title: string;
  loading?: boolean;
  empty?: boolean;
  error?: string;
  onRetry?: () => void;
  items: { key: string; label: string; value: number; color: string; glow: string }[];
  formatValue: (v: number) => string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const sorted = useMemo(() => [...items].sort((a, b) => b.value - a.value), [items]);
  const maxValue = sorted[0]?.value || 1;

  return (
    <motion.div
      initial={reduce ? undefined : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-xl p-5 min-h-[220px] flex flex-col bg-[linear-gradient(135deg,rgba(20,22,30,0.9)_0%,rgba(11,12,16,0.95)_100%)] light:bg-none light:bg-[var(--color-card)] border border-[rgba(255,255,255,0.08)] light:border-[var(--ws-border)] shadow-[0px_20px_40px_-10px_rgba(0,0,0,0.5)] light:shadow-none"
    >
      {/* LAMINAR §7.1: no decorative chrome gradient. Depth comes from the
          hairline above, not a white wash. */}
      <div className="flex items-center justify-between mb-5 relative">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">{title}</h3>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[rgba(255,255,255,0.05)] light:bg-[var(--ws-surface-sunken)] border border-[rgba(255,255,255,0.08)] light:border-[var(--ws-border)]">
          <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 text-[var(--text-muted)] animate-spin" />
              <span className="text-[11px] text-[var(--text-muted)]">Loading...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <AlertCircle className="w-5 h-5 text-[#FF2A4B] light:text-[var(--error)]" />
            <button onClick={onRetry} className="text-xs transition-colors text-[#FF2A4B] light:text-[var(--error)]">
              {error}
            </button>
          </div>
        ) : empty || sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>No data available</span>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((item, i) => {
              const pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
              return (
                <div key={item.key} className="flex items-center gap-3 group">
                  <span className="text-[11px] w-4 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 h-7 rounded-lg overflow-hidden relative bg-[rgba(255,255,255,0.03)] light:bg-[var(--ws-surface-sunken)]">
                    <motion.div
                      initial={reduce ? undefined : { width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-lg relative hue-bar"
                      style={{
                        '--hue': item.color,
                        '--hue-glow': item.glow,
                        background: 'repeating-linear-gradient(45deg, var(--hue-fill) 0px, var(--hue-fill) 2px, transparent 2px, transparent 6px)',
                        borderTop: '2px solid var(--hue-cap)',
                        boxShadow: '0px -2px 8px var(--hue-flare)',
                      } as CSSProperties}
                    />
                    {/* Glow overlay on hover */}
                    <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none hue-bar"
                      style={{ '--hue': item.color, '--hue-glow': item.glow, boxShadow: 'inset 0 0 20px var(--hue-hover)' } as CSSProperties} />
                  </div>
                  <span className="text-[11px] w-24 truncate text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                    {item.label}
                  </span>
                  <span className="text-[11px] w-16 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {formatValue(item.value)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export { deriveStats };
export type { AnalyticsRawData, DerivedStats };
