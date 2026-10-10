import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart3, DollarSign, Zap, AlertTriangle, Activity, Cpu, TrendingUp,
  Code2, FileText, Timer, Wrench, Loader2, GitCommitHorizontal, MessageSquare,
  Sparkles, Inbox, AlertCircle, Clock,
} from 'lucide-react';
import { WorkspaceCard } from './workspace/_ds/containers';
import { format } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  Tooltip, Legend, Filler,
);

/* ────────────────────────────────────────────────────────────────────────────
 * LAMINAR §1/§2: the only colour source is a token. Chrome is monochrome zinc;
 * data wears exactly ONE signal hue (--page-accent, §8). Emerald/rose are
 * reserved for SEMANTIC states (success / error) and never used as decoration.
 *
 * Chart.js paints into a <canvas>, which cannot resolve `var(--x)` — so the
 * token is read off the document once and cached. getAccent() is the bridge.
 * ──────────────────────────────────────────────────────────────────────────── */
let ACCENT_CACHE: string | null = null;
const ACCENT_FALLBACK = '#ec4899';
function getAccent(): string {
  if (ACCENT_CACHE) return ACCENT_CACHE;
  if (typeof document === 'undefined') return ACCENT_FALLBACK;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--page-accent').trim();
  ACCENT_CACHE = v || ACCENT_FALLBACK;
  return ACCENT_CACHE;
}
/** Canvas needs a concrete colour; alpha variants are derived from the hue. */
function alpha(hex: string, a: number) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(236,72,153,${a})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})`;
}

const WORKSPACE_CATEGORIES = ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'];

/** Semantic tone per status. §2 — emerald = success/filled, rose = error. */
type Tone = 'good' | 'bad' | 'warn' | 'idle';
const STATUS_TONE: Record<string, Tone> = {
  Fixed: 'good', Completed: 'good', active: 'good', running: 'good', resolved: 'good',
  Cancelled: 'idle', Irrelevant: 'idle', stopped: 'idle', Unknown: 'idle',
  NEW: 'bad', error: 'bad', Declined: 'bad', Rejected: 'bad',
  'Not Started': 'warn', Pending: 'warn', 'In Progress': 'warn',
  'AI Attempted Fix': 'warn', 'User Testing': 'warn',
};
const toneOf = (status: string): Tone => STATUS_TONE[status] ?? 'idle';
const TONE_CLASS: Record<Tone, string> = {
  good: 'bg-emerald-400',
  bad: 'bg-rose-400',
  warn: 'bg-amber-400',
  idle: 'bg-zinc-600',
};

const fmtNum = (n: number) => {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
};
const fmtCost = (n: number) => {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(3);
  if (n > 0) return '$' + n.toFixed(4);
  return '$0.00';
};
const fmtSec = (s: number) => {
  if (!Number.isFinite(s)) return '—';
  if (s >= 3600) return (s / 3600).toFixed(1) + 'h';
  if (s >= 60) return (s / 60).toFixed(1) + 'm';
  return s.toFixed(1) + 's';
};
const safeDayLabel = (d: unknown) => {
  if (typeof d !== 'string' || !d) return '—';
  try { return format(new Date(d + 'T00:00:00'), 'MMM d'); } catch { return d; }
};

/* ─── Animation ─────────────────────────────────────────────────────────────── */
const EASE = [0.16, 1, 0.3, 1] as const;
function useEnter(delay: number) {
  const reduce = useReducedMotion();
  return reduce
    ? {}
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 },
        transition: { delay, duration: 0.25, ease: EASE } };
}

/* ─── Panel: the four states ────────────────────────────────────────────────── */
type PanelState = 'loading' | 'error' | 'empty' | 'ready';

function Panel({
  title, subtitle, icon: Icon, state, error, onRetry, children, footer,
}: {
  title: string; subtitle?: string; icon?: React.ComponentType<{ className?: string }>;
  state: PanelState; error?: string | null; onRetry?: () => void;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  const enter = useEnter(0);

  return (
    <motion.div {...enter}>
      <WorkspaceCard className="h-full flex flex-col">
        <div className="flex items-start gap-2.5 mb-4 shrink-0">
          {Icon && (
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-zinc-400" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className="flex-1 min-h-[132px] flex flex-col justify-center">
          {state === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-2 py-6" role="status" aria-live="polite">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
              <span className="text-xs text-zinc-600">Loading…</span>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center" role="alert">
              <AlertCircle className="w-5 h-5 text-rose-400" />
              <p className="text-xs text-zinc-400 max-w-[26ch] leading-relaxed">
                {error || 'This data could not be loaded.'}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-1 text-[11px] font-medium text-zinc-300 border border-zinc-700 rounded-lg px-2.5 py-1 hover:border-zinc-600 hover:text-white transition-colors"
                >
                  Try again
                </button>
              )}
              <p className="text-[10px] text-zinc-600">Not zero — unavailable.</p>
            </div>
          )}

          {state === 'empty' && (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <Inbox className="w-5 h-5 text-zinc-700" />
              <p className="text-xs text-zinc-500">Nothing recorded yet</p>
              <p className="text-[10px] text-zinc-600 max-w-[28ch] leading-relaxed">
                This is a genuine zero for this period — not a failed read.
              </p>
            </div>
          )}

          {state === 'ready' && children}
        </div>

        {state === 'ready' && footer && <div className="mt-3 pt-3 shrink-0">{footer}</div>}
      </WorkspaceCard>
    </motion.div>
  );
}

/* ─── RankBars — the core replacement ──────────────────────────────────────────
 * One measure split across N categories. Length is the only channel a human
 * reads accurately, so it is a ranked bar list, never an angle-based donut.
 * ONE signal hue for categorical data; a semantic dot for status lists.
 * ──────────────────────────────────────────────────────────────────────────── */
interface Datum { label: string; value: number; tone?: Tone }

function RankBars({
  data, formatValue = fmtNum, max: maxOverride, semantic = false, limit = 8,
}: {
  data: Datum[]; formatValue?: (n: number) => string;
  max?: number; semantic?: boolean; limit?: number;
}) {
  const reduce = useReducedMotion();
  const rows = data.slice(0, limit);
  const total = data.reduce((a, d) => a + (Number.isFinite(d.value) ? d.value : 0), 0);
  const max = maxOverride ?? Math.max(...rows.map(d => d.value), 0);

  if (rows.length === 0) return null;

  return (
    <ul className="w-full flex flex-col gap-2.5">
      {rows.map((d, i) => {
        const widthPct = max > 0 ? Math.max((d.value / max) * 100, 0) : 0;
        const sharePct = total > 0 ? (d.value / total) * 100 : 0;
        const fill = semantic ? undefined : 'var(--page-accent)';
        const fillClass = semantic ? TONE_CLASS[d.tone ?? 'idle'] : '';
        return (
          <li key={d.label} className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-x-2.5 gap-y-1">
            <span className="text-[10px] text-zinc-600 tabular-nums text-right">
              {i + 1}
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                {semantic && (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${fillClass}`} aria-hidden />
                )}
                <span className="text-xs text-zinc-300 truncate" title={d.label}>{d.label}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${fillClass}`}
                  style={fill ? { backgroundColor: fill } : undefined}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={reduce ? { duration: 0 } : { duration: 0.4, delay: i * 0.04, ease: EASE }}
                />
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs text-zinc-300 font-mono tabular-nums leading-none">
                {formatValue(d.value)}
              </div>
              {total > 0 && (
                <div className="text-[10px] text-zinc-600 font-mono tabular-nums mt-0.5">
                  {sharePct >= 0.1 ? sharePct.toFixed(0) + '%' : '<1%'}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ─── Stat tile ─────────────────────────────────────────────────────────────── */
function KpiTile({ icon: Icon, value, label, sub, delay = 0 }: {
  icon: React.ComponentType<{ className?: string }>;
  value: string; label: string; sub?: string; delay?: number;
}) {
  const enter = useEnter(delay);
  return (
    <motion.div {...enter} className="rounded-xl p-4 border border-zinc-800/40 bg-zinc-900/40">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-zinc-800">
          <Icon className="w-4 h-4 text-zinc-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold text-zinc-100 font-mono tracking-tight leading-none">{value}</div>
          <div className="text-xs text-zinc-500 mt-1">{label}</div>
          {sub && <div className="text-[10px] text-zinc-600 mt-0.5 font-mono">{sub}</div>}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Progress card ─────────────────────────────────────────────────────────── */
function ProgressCard({ title, icon: Icon, items, state }: {
  title: string; icon: React.ComponentType<{ className?: string }>;
  items: { label: string; done: number; total: number }[];
  state: 'ready' | 'empty';
}) {
  return (
    <WorkspaceCard className="h-full flex flex-col">
      <div className="flex items-center gap-2.5 mb-4 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">{title}</h3>
      </div>

      {state === 'empty' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-6 text-center">
          <Inbox className="w-5 h-5 text-zinc-700" />
          <p className="text-xs text-zinc-500">Nothing tracked yet</p>
        </div>
      ) : (
        <div className="space-y-4 flex-1 flex flex-col justify-center">
          {items.map((item) => {
            // Division-by-zero guard: a 0-total row must never produce NaN%.
            const total = Number.isFinite(item.total) ? item.total : 0;
            const done = Number.isFinite(item.done) ? item.done : 0;
            const pct = total > 0 ? Math.min((done / total) * 100, 100) : 0;
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="text-zinc-500 tabular-nums font-mono">{done} / {total}</span>
                </div>
                <div
                  className="h-1.5 rounded-full bg-zinc-800 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={item.label}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: 'var(--page-accent)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4, ease: EASE }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WorkspaceCard>
  );
}

/* ─── Time-series chart options ─────────────────────────────────────────────── */
function timeSeriesOptions(yTitle: string) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#e4e4e7',
        bodyColor: '#a1a1aa',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 8,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: 'rgba(255,255,255,0.08)' },
        ticks: { color: '#71717a', font: { size: 10 }, maxRotation: 0, autoSkipPadding: 12 },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.06)' },
        border: { display: false },
        ticks: { color: '#71717a', font: { size: 10 }, padding: 8 },
        title: { display: true, text: yTitle, color: '#71717a', font: { size: 10 } },
      },
    },
  };
}

/* ─── Main component ────────────────────────────────────────────────────────── */
export default function AnalyticsDashboard({
  aiUsage, sessions, problems, requests, dailyStats, appStats,
  promptHistory, loading, period, variant = 'full',
  projectLanguages, codeStats, codeActivity,
  error = null, onRetry,
}: {
  aiUsage?: any; sessions?: any[]; problems?: any[]; requests?: any[];
  dailyStats?: any[]; appStats?: any[]; promptHistory?: any[]; loading: boolean;
  period: string; variant?: 'project' | 'workspace' | 'full';
  projectLanguages?: { language: string; count: number }[]; codeStats?: any; codeActivity?: any;
  error?: string | null; onRetry?: () => void;
}) {
  // `sessions` was typed required but callers can hand us undefined on a failed
  // read. Every consumer below is now total.
  const sessionList = useMemo(() => (Array.isArray(sessions) ? sessions : []), [sessions]);
  const problemList = useMemo(() => (Array.isArray(problems) ? problems : []), [problems]);
  const requestList = useMemo(() => (Array.isArray(requests) ? requests : []), [requests]);
  const promptList = useMemo(() => (Array.isArray(promptHistory) ? promptHistory : []), [promptHistory]);
  const dailyList = useMemo(() => (Array.isArray(dailyStats) ? dailyStats : []), [dailyStats]);
  const appList = useMemo(() => (Array.isArray(appStats) ? appStats : []), [appStats]);
  const langList = useMemo(() => (Array.isArray(projectLanguages) ? projectLanguages : []), [projectLanguages]);

  /** Group any array by a key, descending by count. Total on any input shape. */
  const tally = (list: any[], key: string, fallback = 'Unknown'): Datum[] => {
    const counts = new Map<string, number>();
    for (const row of list) {
      const raw = row?.[key];
      const k = typeof raw === 'string' && raw.trim() ? raw : fallback;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value, tone: toneOf(label) }))
      .sort((a, b) => b.value - a.value);
  };

  const byToolTokens = useMemo<Datum[]>(() => {
    const byTool = aiUsage?.byTool;
    if (!byTool || typeof byTool !== 'object') return [];
    return Object.entries(byTool)
      .map(([tool, data]: [string, any]) => ({ label: tool, value: Number(data?.tokens) || 0 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [aiUsage]);

  const byToolCost = useMemo<Datum[]>(() => {
    const byTool = aiUsage?.byTool;
    if (!byTool || typeof byTool !== 'object') return [];
    return Object.entries(byTool)
      .map(([tool, data]: [string, any]) => ({ label: tool, value: Number(data?.cost) || 0 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [aiUsage]);

  const sessionsByAgent = useMemo(() => tally(sessionList, 'agent'), [sessionList]);
  const sessionsByStatus = useMemo(() => tally(sessionList, 'status'), [sessionList]);
  const problemsByStatus = useMemo(() => tally(problemList, 'status'), [problemList]);
  const requestsByStatus = useMemo(() => tally(requestList, 'status'), [requestList]);

  const categoryDist = useMemo<Datum[]>(() => {
    if (appList.length === 0) return [];
    const totals = new Map<string, number>();
    for (const stat of appList) {
      const cat = typeof stat?.category === 'string' && stat.category ? stat.category : 'Other';
      const ms = Number(stat?.total_ms);
      totals.set(cat, (totals.get(cat) ?? 0) + (Number.isFinite(ms) ? ms : 0));
    }
    return [...totals.entries()]
      .map(([label, ms]) => ({ label, value: +(ms / 3600).toFixed(2), tone: toneOf(label) }))
      .sort((a, b) => b.value - a.value);
  }, [appList]);

  const languageDist = useMemo<Datum[]>(() => {
    if (langList.length === 0) return [];
    return langList
      .map(l => ({ label: String(l?.language ?? 'Unknown'), value: Number(l?.count) || 0 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [langList]);

  const dailyTrend = useMemo(() => {
    if (dailyList.length === 0) return { labels: [] as string[], values: [] as number[] };
    const dayTotals = new Map<string, number>();
    for (const stat of dailyList) {
      if (!WORKSPACE_CATEGORIES.includes(stat?.category)) continue;
      const day = stat?.day || stat?.date;
      if (typeof day !== 'string' || !day) continue;
      const sec = Number(stat?.total_sec);
      dayTotals.set(day, (dayTotals.get(day) ?? 0) + (Number.isFinite(sec) ? sec : 0));
    }
    const sorted = [...dayTotals.keys()].sort();
    return {
      labels: sorted.map(safeDayLabel),
      values: sorted.map(d => +(dayTotals.get(d)! / 3600).toFixed(2)),
    };
  }, [dailyList]);

  const responseTiming = useMemo(() => {
    if (promptList.length === 0) return { avgResponse: null as number | null, avgThink: null as number | null, count: 0 };
    const bySession = new Map<string, any[]>();
    for (const msg of promptList) {
      const sid = msg?.session_id;
      if (!sid) continue;
      if (!bySession.has(sid)) bySession.set(sid, []);
      bySession.get(sid)!.push(msg);
    }
    let totalResponse = 0, nResponse = 0, totalThink = 0, nThink = 0;
    for (const msgs of bySession.values()) {
      const sorted = [...msgs].sort(
        (a, b) => new Date(a?.created_at ?? 0).getTime() - new Date(b?.created_at ?? 0).getTime(),
      );
      for (let i = 0; i < sorted.length - 1; i++) {
        const t0 = new Date(sorted[i]?.created_at ?? 0).getTime();
        const t1 = new Date(sorted[i + 1]?.created_at ?? 0).getTime();
        if (!Number.isFinite(t0) || !Number.isFinite(t1)) continue;
        const gap = (t1 - t0) / 1000;
        if (sorted[i]?.role === 'user' && sorted[i + 1]?.role === 'assistant' && gap >= 0 && gap < 600) {
          totalResponse += gap; nResponse++;
        } else if (sorted[i]?.role === 'assistant' && sorted[i + 1]?.role === 'user' && gap >= 0 && gap < 7200) {
          totalThink += gap; nThink++;
        }
      }
    }
    return {
      avgResponse: nResponse > 0 ? totalResponse / nResponse : null,
      avgThink: nThink > 0 ? totalThink / nThink : null,
      count: nResponse,
    };
  }, [promptList]);

  const summary = useMemo(() => {
    const totalTokens = Number(aiUsage?.totalTokens) || 0;
    const totalCost = Number(aiUsage?.totalCost) || 0;
    const activeSessions = sessionList.filter(s => s?.status === 'active' || s?.status === 'running').length;
    const openProblems = problemList.filter(p => !['Fixed', 'Irrelevant'].includes(p?.status)).length;
    const openRequests = requestList.filter(r => !['Completed', 'Cancelled'].includes(r?.status)).length;
    const toolsUsed = aiUsage?.byTool && typeof aiUsage.byTool === 'object' ? Object.keys(aiUsage.byTool).length : 0;
    return {
      totalTokens, totalCost, sessionCount: sessionList.length, activeSessions,
      problemCount: problemList.length, openProblems,
      requestCount: requestList.length, openRequests, toolsUsed,
    };
  }, [aiUsage, sessionList, problemList, requestList]);

  const codeDaily = useMemo(() => {
    const daily = codeActivity?.daily;
    if (!Array.isArray(daily) || daily.length === 0) return { labels: [] as string[], added: [] as number[], removed: [] as number[], hours: [] as number[] };
    return {
      labels: daily.map((r: any) => safeDayLabel(r?.date)),
      added: daily.map((r: any) => Number(r?.linesAdded) || 0),
      removed: daily.map((r: any) => Number(r?.linesRemoved) || 0),
      hours: daily.map((r: any) => {
        const ms = Number(r?.durationMs);
        return Number.isFinite(ms) ? +(ms / 3600000).toFixed(2) : 0;
      }),
    };
  }, [codeActivity]);

  const topFiles = useMemo(() => {
    const files = codeActivity?.topFiles;
    if (!Array.isArray(files)) return [];
    return files
      .map((f: any) => ({
        path: typeof f?.file_path === 'string' ? f.file_path : '(unknown)',
        added: Number(f?.linesAdded) || 0,
        removed: Number(f?.linesRemoved) || 0,
        seconds: (Number(f?.durationMs) || 0) / 1000,
      }))
      .slice(0, 6);
  }, [codeActivity]);

  /**
   * error → 'error'; else if we have data → 'ready'; else if still fetching →
   * 'loading'; else → 'empty'. Ordering matters: showing 'empty' while a fetch
   * is in flight is how a failed read masquerades as a genuine zero.
   */
  const panelState = (has: boolean): PanelState =>
    error ? 'error' : has ? 'ready' : loading ? 'loading' : 'empty';

  /* ─── Project variant ─────────────────────────────────────────────────────── */
  if (variant === 'project') {
    return (
      <div className="space-y-4">
        <KpiTile icon={Activity} value={String(summary.sessionCount)} label="Sessions"
          sub={summary.activeSessions > 0 ? `${summary.activeSessions} active` : undefined} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Sessions by Agent" subtitle="Which agents ran" icon={Cpu}
            state={panelState(sessionsByAgent.length > 0)} error={error} onRetry={onRetry}>
            <RankBars data={sessionsByAgent} formatValue={fmtNum} />
          </Panel>
          <Panel title="Session Status" subtitle="Active vs completed" icon={Activity}
            state={panelState(sessionsByStatus.length > 0)} error={error} onRetry={onRetry}>
            <RankBars data={sessionsByStatus} semantic />
          </Panel>
        </div>
      </div>
    );
  }

  /* ─── Full / workspace variant ────────────────────────────────────────────── */
  const accent = getAccent();
  const hasCodeSection = Boolean(codeStats || codeActivity);

  return (
    <div className="space-y-5">
      {/* KPI row — values are facts, so they stay legible even when a panel errors */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiTile icon={Zap} value={fmtNum(summary.totalTokens)} label="Total Tokens"
          sub={summary.toolsUsed > 0 ? `${summary.toolsUsed} tools` : undefined} delay={0} />
        <KpiTile icon={DollarSign} value={fmtCost(summary.totalCost)} label="Total Cost" delay={0.04} />
        <KpiTile icon={Activity} value={String(summary.sessionCount)} label="Sessions"
          sub={summary.activeSessions > 0 ? `${summary.activeSessions} active` : undefined} delay={0.08} />
        <KpiTile icon={AlertTriangle} value={String(summary.problemCount)} label="Problems"
          sub={summary.openProblems > 0 ? `${summary.openProblems} open` : undefined} delay={0.12} />
        <KpiTile icon={FileText} value={String(summary.requestCount)} label="Requests"
          sub={summary.openRequests > 0 ? `${summary.openRequests} open` : undefined} delay={0.16} />
      </div>

      {/* Spend & effort */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Tokens by Tool" subtitle="Ranked by share of usage" icon={Zap}
          state={panelState(byToolTokens.length > 0)} error={error} onRetry={onRetry}>
          <RankBars data={byToolTokens} formatValue={fmtNum} />
        </Panel>
        <Panel title="Cost by Tool" subtitle="Ranked by spend" icon={DollarSign}
          state={panelState(byToolCost.length > 0)} error={error} onRetry={onRetry}
          footer={<p className="text-[10px] text-zinc-600">Total {fmtCost(summary.totalCost)} across {summary.toolsUsed} tools</p>}>
          <RankBars data={byToolCost} formatValue={fmtCost} />
        </Panel>
      </div>

      {/* Activity & pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Activity by Category" subtitle="Hours tracked, by type" icon={BarChart3}
          state={panelState(categoryDist.length > 0)} error={error} onRetry={onRetry}>
          <RankBars data={categoryDist} formatValue={(n) => n.toFixed(1) + 'h'} />
        </Panel>
        <Panel title="Sessions by Agent" subtitle="Which agents ran" icon={Cpu}
          state={panelState(sessionsByAgent.length > 0)} error={error} onRetry={onRetry}>
          <RankBars data={sessionsByAgent} formatValue={fmtNum} />
        </Panel>
      </div>

      {/* The one genuine time series */}
      <Panel title="Daily Activity" subtitle={`Hours tracked per day · ${period}`} icon={TrendingUp}
        state={panelState(dailyTrend.values.length > 0)} error={error} onRetry={onRetry}>
        <div className="h-[200px] w-full">
          <Bar
            data={{
              labels: dailyTrend.labels,
              datasets: [{
                label: 'Hours',
                data: dailyTrend.values,
                backgroundColor: alpha(accent, 0.55),
                borderColor: accent,
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.7,
                categoryPercentage: 0.85,
              }],
            }}
            options={timeSeriesOptions('Hours')}
          />
        </div>
      </Panel>

      {/* Status — semantic, not categorical */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Session Status" subtitle="Active vs completed" icon={Activity}
          state={panelState(sessionsByStatus.length > 0)} error={error} onRetry={onRetry}>
          <RankBars data={sessionsByStatus} semantic />
        </Panel>
        <Panel title="Problems by Status" subtitle="Issue pipeline" icon={AlertTriangle}
          state={panelState(problemsByStatus.length > 0)} error={error} onRetry={onRetry}>
          <RankBars data={problemsByStatus} semantic />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Requests by Status" subtitle="Feature request pipeline" icon={FileText}
          state={panelState(requestsByStatus.length > 0)} error={error} onRetry={onRetry}>
          <RankBars data={requestsByStatus} semantic />
        </Panel>
        <Panel title="Response Timing" subtitle="Where the round trip goes" icon={Timer}
          state={panelState(responseTiming.avgResponse !== null || responseTiming.avgThink !== null)}
          error={error} onRetry={onRetry}>
          <div className="flex flex-col items-center justify-center gap-4 py-2">
            <div className="text-center">
              <div className="text-3xl font-bold text-zinc-100 font-mono">
                {responseTiming.avgResponse !== null ? fmtSec(responseTiming.avgResponse) : '—'}
              </div>
              <div className="text-xs text-zinc-500 mt-1">Avg response</div>
              <div className="text-[10px] text-zinc-600">prompt → reply</div>
            </div>
            <div className="w-10 h-px bg-zinc-800" />
            <div className="text-center">
              <div className="text-3xl font-bold text-zinc-100 font-mono">
                {responseTiming.avgThink !== null ? fmtSec(responseTiming.avgThink) : '—'}
              </div>
              <div className="text-xs text-zinc-500 mt-1">Avg think</div>
              <div className="text-[10px] text-zinc-600">reply → next prompt</div>
            </div>
            {responseTiming.count > 0 && (
              <p className="text-[10px] text-zinc-600 font-mono">n = {responseTiming.count} pairs</p>
            )}
          </div>
        </Panel>
      </div>

      {/* Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProgressCard title="Problems Progress" icon={AlertTriangle} state={problemList.length > 0 ? 'ready' : 'empty'}
          items={problemList.length > 0 ? [
            { label: 'Fixed', done: problemList.filter(p => p?.status === 'Fixed').length, total: problemList.length },
            { label: 'In progress', done: problemList.filter(p => ['In Progress', 'AI Attempted Fix', 'User Testing'].includes(p?.status ?? '')).length, total: problemList.length },
          ] : []} />
        <ProgressCard title="Requests Progress" icon={FileText} state={requestList.length > 0 ? 'ready' : 'empty'}
          items={requestList.length > 0 ? [
            { label: 'Completed', done: requestList.filter(r => r?.status === 'Completed').length, total: requestList.length },
            { label: 'In progress', done: requestList.filter(r => r?.status === 'In Progress').length, total: requestList.length },
          ] : []} />
      </div>

      {/* Languages */}
      {languageDist.length > 0 && (
        <Panel title="Language Distribution" subtitle="Files by language, across projects" icon={Code2}
          state={panelState(languageDist.length > 0)} error={error} onRetry={onRetry}>
          <RankBars data={languageDist} formatValue={fmtNum} limit={8} />
        </Panel>
      )}

      {/* Code activity */}
      {hasCodeSection && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiTile icon={Clock} value={fmtSec(Math.round((Number(codeActivity?.totalDurationMs) || 0) / 1000))} label="Active coded time" delay={0} />
            <KpiTile icon={GitCommitHorizontal} value={`+${fmtNum(Number(codeActivity?.totalLinesAdded) || 0)}`} label="Lines added" delay={0.04} />
            <KpiTile icon={GitCommitHorizontal} value={`-${fmtNum(Number(codeActivity?.totalLinesRemoved) || 0)}`} label="Lines removed" delay={0.08} />
          </div>

          {codeDaily.labels.length > 0 && (
            <Panel title="Coding Activity" subtitle="Lines changed and active time per day" icon={Wrench}
              state={panelState(codeDaily.labels.length > 0)} error={error} onRetry={onRetry}>
              <div className="h-[220px] w-full">
                <Line
                  data={{
                    labels: codeDaily.labels,
                    datasets: [
                      {
                        label: 'Lines added',
                        data: codeDaily.added,
                        borderColor: accent,
                        backgroundColor: alpha(accent, 0.12),
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        tension: 0.3,
                        fill: true,
                      },
                      {
                        label: 'Lines removed',
                        data: codeDaily.removed.map(v => -v),
                        borderColor: '#71717a',
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        tension: 0.3,
                        fill: false,
                      },
                    ],
                  }}
                  options={{
                    ...timeSeriesOptions('Lines'),
                    plugins: {
                      ...timeSeriesOptions('Lines').plugins,
                      legend: {
                        display: true,
                        position: 'bottom' as const,
                        labels: { color: '#a1a1aa', font: { size: 10 }, usePointStyle: true, boxWidth: 6, padding: 12 },
                      },
                    },
                  }}
                />
              </div>
            </Panel>
          )}

          {topFiles.length > 0 && (
            <WorkspaceCard>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">Most edited files</h3>
              </div>
              <ul className="flex flex-col gap-1.5">
                {topFiles.map((f, i) => (
                  <li key={`${f.path}-${i}`} className="flex items-center justify-between gap-3 text-xs bg-zinc-800/30 rounded-lg px-3 py-2">
                    <span className="text-zinc-300 truncate font-mono" title={f.path}>
                      {f.path.split(/[\\/]/).pop()}
                    </span>
                    <span className="text-zinc-500 font-mono tabular-nums shrink-0 flex gap-2">
                      <span className="text-emerald-400">+{f.added}</span>
                      <span className="text-rose-400">-{f.removed}</span>
                      <span>{fmtSec(f.seconds)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </WorkspaceCard>
          )}
        </div>
      )}

      {/* Per-tool table */}
      {byToolTokens.length > 0 && aiUsage?.byTool && (
        <WorkspaceCard>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: alpha(accent, 0.12) }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: accent }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">AI usage by tool</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">Per-tool breakdown</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-500 font-medium py-2 pr-4">Tool</th>
                  <th className="text-right text-zinc-500 font-medium py-2 pr-4">Tokens</th>
                  <th className="text-right text-zinc-500 font-medium py-2 pr-4">Cost</th>
                  <th className="text-right text-zinc-500 font-medium py-2 pr-4">Sessions</th>
                  <th className="text-right text-zinc-500 font-medium py-2">Messages</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(aiUsage.byTool)
                  .sort(([, a]: any[], [, b]: any[]) => (Number(b?.tokens) || 0) - (Number(a?.tokens) || 0))
                  .map(([tool, data]: [string, any]) => (
                    <tr key={tool} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors">
                      <td className="py-2 pr-4">
                        <span className="text-zinc-300">{tool}</span>
                      </td>
                      <td className="text-right text-zinc-400 py-2 pr-4 font-mono tabular-nums">{fmtNum(Number(data?.tokens) || 0)}</td>
                      <td className="text-right text-zinc-400 py-2 pr-4 font-mono tabular-nums">{fmtCost(Number(data?.cost) || 0)}</td>
                      <td className="text-right text-zinc-400 py-2 pr-4 font-mono tabular-nums">{Number(data?.sessions) || 0}</td>
                      <td className="text-right text-zinc-400 py-2 font-mono tabular-nums">{Number(data?.messageCount) || 0}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </WorkspaceCard>
      )}
    </div>
  );
}