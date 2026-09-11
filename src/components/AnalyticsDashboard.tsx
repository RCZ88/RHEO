import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Database, BarChart3, DollarSign, Zap, AlertTriangle,
  Clock, Activity, Cpu, TrendingUp, Code2,
  PieChart as PieChartIcon, FileText, Timer, Wrench, Loader2, GitCommitHorizontal,
  Users, MessageSquare, Sparkles
} from 'lucide-react';
import { WorkspaceCard } from './workspace/_ds/containers';
import { WorkspaceSection } from './workspace/_ds/containers';
import { Chip } from './workspace/_ds/controls';
import { Skeleton } from './ui/skeleton';
import { format } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend, Filler,
  LogarithmicScale
} from 'chart.js';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Filler, LogarithmicScale);

// ─── Design tokens ────────────────────────────────────────────────────────────
const PURPLE = '#a855f7';
const TEAL   = '#22d3ee';
const EMERALD= '#34d399';
const AMBER  = '#f59e0b';
const ROSE   = '#fb7185';
const BLUE   = '#60a5fa';
const SLATE  = '#64748b';

const CHART_PALETTE = [
  'rgba(168, 85, 247, 0.75)', 'rgba(34, 211, 238, 0.75)', 'rgba(52, 211, 153, 0.75)',
  'rgba(251, 113, 133, 0.75)', 'rgba(245, 158, 11, 0.75)', 'rgba(96, 165, 250, 0.75)',
  'rgba(129, 140, 248, 0.75)', 'rgba(251, 146, 60, 0.75)', 'rgba(167, 139, 250, 0.75)',
  'rgba(74, 222, 128, 0.75)', 'rgba(244, 114, 182, 0.75)', 'rgba(163, 230, 53, 0.75)',
];
const CHART_BORDERS = CHART_PALETTE.map(c => c.replace('0.75)', '1)'));

const WORKSPACE_CATEGORIES = ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'];

const STATUS_COLORS: Record<string, string> = {
  'Fixed': 'rgba(52, 211, 153, 0.75)', 'Irrelevant': 'rgba(113, 113, 122, 0.75)',
  'In Progress': 'rgba(96, 165, 250, 0.75)', 'NEW': 'rgba(251, 113, 133, 0.75)',
  'Not Started': 'rgba(245, 158, 11, 0.75)', 'AI Attempted Fix': 'rgba(168, 85, 247, 0.75)',
  'User Testing': 'rgba(34, 211, 238, 0.75)', 'Completed': 'rgba(52, 211, 153, 0.75)',
  'Cancelled': 'rgba(113, 113, 122, 0.75)', 'Pending': 'rgba(245, 158, 11, 0.75)',
  'active': 'rgba(52, 211, 153, 0.75)', 'running': 'rgba(34, 211, 238, 0.75)',
  'completed': 'rgba(129, 140, 248, 0.75)', 'stopped': 'rgba(113, 113, 122, 0.75)',
  'error': 'rgba(251, 113, 133, 0.75)',
};

const getStatusColor = (status: string, fallbackIdx: number) =>
  STATUS_COLORS[status] || CHART_PALETTE[fallbackIdx % CHART_PALETTE.length];
const getStatusBorder = (status: string, fallbackIdx: number) =>
  getStatusColor(status, fallbackIdx).replace('0.75)', '1)');

const fmtNum = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
};
const fmtCost = (n: number) => {
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(3);
  if (n > 0) return '$' + n.toFixed(4);
  return '$0.00';
};
const fmtSec = (s: number) => {
  if (s >= 3600) return (s / 3600).toFixed(1) + 'h';
  if (s >= 60) return (s / 60).toFixed(1) + 'm';
  return s.toFixed(1) + 's';
};

// ─── Chart options ────────────────────────────────────────────────────────────
const doughnutOptions = {
  responsive: true, maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: { position: 'right' as const, labels: { color: '#71717a', font: { size: 10 }, padding: 10, usePointStyle: true, pointStyleWidth: 6 } },
    tooltip: { backgroundColor: 'rgba(9,9,11,0.95)', titleColor: '#e4e4e7', bodyColor: '#a1a1aa', borderColor: 'rgba(63,63,70,0.5)', borderWidth: 1, cornerRadius: 8, padding: 8, displayColors: true, boxPadding: 4 },
  },
};

const barOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(9,9,11,0.95)', titleColor: '#e4e4e7', bodyColor: '#a1a1aa', borderColor: 'rgba(63,63,70,0.5)', borderWidth: 1, cornerRadius: 8, padding: 8 } },
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(113,113,122,0.06)' }, border: { color: 'rgba(113,113,122,0.12)' } },
    y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(113,113,122,0.06)' }, border: { color: 'rgba(113,113,122,0.12)' } },
  },
};

const crosshairPlugin = {
  id: 'dashedCrosshair',
  afterDraw(chart: any) {
    const active = chart.tooltip?.getActiveElements?.();
    if (!active || !active.length) return;
    const { ctx, chartArea } = chart;
    const x = active[0].element.x;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();
    ctx.restore();
  },
};

// ─── Stat Card (compact KPI tile) ─────────────────────────────────────────────
function KpiTile({ icon: Icon, value, label, sub, accent, delay = 0 }: {
  icon: React.ComponentType<{ className?: string }>;
  value: string; label: string; sub?: string; accent?: string; delay?: number;
}) {
  const accentColors: Record<string, string> = {
    purple: 'bg-purple-500/15 text-purple-400', teal: 'bg-teal-500/15 text-teal-400',
    emerald: 'bg-emerald-500/15 text-emerald-400', amber: 'bg-amber-500/15 text-amber-400',
    rose: 'bg-rose-500/15 text-rose-400', blue: 'bg-blue-500/15 text-blue-400',
  };
  const iconCls = accent ? accentColors[accent] || accentColors.purple : 'bg-zinc-800 text-zinc-400';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}
      className="bg-zinc-900/60 backdrop-blur-xl rounded-xl p-4 border border-zinc-800/40 hover:border-zinc-700/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconCls}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold text-white font-mono tracking-tight">{value}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
          {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Chart Card shell ─────────────────────────────────────────────────────────
function ChartTile({ title, subtitle, icon: Icon, children, empty, emptyText, full = false }: {
  title: string; subtitle?: string; icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; empty: boolean; emptyText: string; full?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className={full ? 'col-span-1 lg:col-span-2' : ''}
    >
      <WorkspaceCard className={`min-h-[240px] ${full ? 'lg:col-span-2' : ''}`}>
        <div className="flex items-center gap-2.5 mb-3">
          {Icon && (
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center ring-1 ring-zinc-700/50">
              <Icon className="w-3.5 h-3.5 text-zinc-400" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-zinc-600 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="relative" style={{ height: empty ? 180 : 220 }}>
          {empty ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
              <BarChart3 className="w-7 h-7 mb-1 opacity-30" />
              <span className="text-xs">{emptyText}</span>
            </div>
          ) : children}
        </div>
      </WorkspaceCard>
    </motion.div>
  );
}

// ─── Progress bar card ────────────────────────────────────────────────────────
function ProgressCard({ title, icon: Icon, accent, items }: {
  title: string; icon: React.ComponentType<{ className?: string }>; accent?: string;
  items: { label: string; done: number; total: number; color: string; pendingColor: string }[];
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="bg-zinc-900/60 backdrop-blur-xl rounded-xl border border-zinc-800/40 p-4"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent ? `bg-${accent}-500/15` : 'bg-zinc-800'}`}>
          <Icon className={`w-3.5 h-3.5 ${accent ? `text-${accent}-400` : 'text-zinc-400'}`} />
        </div>
        <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const pct = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-400 font-medium">{item.label}</span>
                <span className="text-zinc-500 tabular-nums">{item.done} / {item.total}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                <div className="h-full rounded-full transition-all" style={{ width: `${(item.total - item.done) / item.total * 100}%`, backgroundColor: item.pendingColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Code activity stat card ──────────────────────────────────────────────────
function CodeStatCard({ icon: Icon, value, label, sub, accent, delay = 0 }: {
  icon: React.ComponentType<{ className?: string }>; value: string; label: string;
  sub?: string; accent?: string; delay?: number;
}) {
  const accentMap: Record<string, { bg: string; color: string }> = {
    emerald: { bg: 'bg-emerald-500/12', color: 'text-emerald-400' },
    cyan:    { bg: 'bg-cyan-500/10',  color: 'text-cyan-400' },
    rose:    { bg: 'bg-rose-500/10',  color: 'text-rose-400' },
    purple:  { bg: 'bg-purple-500/10', color: 'text-purple-400' },
  };
  const a = accentMap[accent] || accentMap.emerald;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}
      className="bg-zinc-900/60 backdrop-blur-xl rounded-xl p-4 border border-zinc-800/40"
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${a.bg}`}>
          <Icon className={`w-4.5 h-4.5 ${a.color}`} />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold text-white font-mono tracking-tight">{value}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
          {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AnalyticsDashboard({
  aiUsage, sessions, problems, requests, dailyStats, appStats,
  promptHistory, loading, period, variant = 'full',
  projectLanguages, codeStats, codeActivity,
}: {
  aiUsage?: any; sessions: any[]; problems?: any[]; requests?: any[];
  dailyStats?: any[]; appStats?: any[]; promptHistory?: any[]; loading: boolean;
  period: string; variant?: 'project' | 'workspace' | 'full';
  projectLanguages?: { language: string; count: number }[]; codeStats?: any; codeActivity?: any;
}) {
  const tokenByTool = useMemo(() => {
    if (!aiUsage?.byTool) return { labels: [], values: [] };
    const entries = Object.entries(aiUsage.byTool)
      .map(([tool, data]: [string, any]) => ({ tool, tokens: data?.tokens || 0 }))
      .sort((a, b) => b.tokens - a.tokens);
    return { labels: entries.map(e => e.tool), values: entries.map(e => e.tokens) };
  }, [aiUsage]);

  const costByTool = useMemo(() => {
    if (!aiUsage?.byTool) return { labels: [], values: [] };
    const entries = Object.entries(aiUsage.byTool)
      .map(([tool, data]: [string, any]) => ({ tool, cost: data?.cost || 0 }))
      .sort((a, b) => b.cost - a.cost);
    return { labels: entries.map(e => e.tool), values: entries.map(e => e.cost) };
  }, [aiUsage]);

  const sessionsByAgent = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) counts[s.agent || 'Unknown'] = (counts[s.agent || 'Unknown'] || 0) + 1;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { labels: entries.map(e => e[0]), values: entries.map(e => e[1]) };
  }, [sessions]);

  const sessionsByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) counts[s.status || 'Unknown'] = (counts[s.status || 'Unknown'] || 0) + 1;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { labels: entries.map(e => e[0]), values: entries.map(e => e[1]) };
  }, [sessions]);

  const categoryDist = useMemo(() => {
    if (!appStats?.length) return { labels: [], values: [] };
    const totals: Record<string, number> = {};
    for (const stat of appStats) { const cat = stat.category || 'Other'; totals[cat] = (totals[cat] || 0) + (stat.total_ms || 0); }
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    return { labels: entries.map(e => e[0]), values: entries.map(e => e[1]) };
  }, [appStats]);

  const languageDist = useMemo(() => {
    if (!projectLanguages?.length) return { labels: [], values: [] };
    const sorted = [...projectLanguages].sort((a, b) => b.count - a.count);
    return { labels: sorted.map(e => e.language), values: sorted.map(e => e.count) };
  }, [projectLanguages]);

  const problemsByStatus = useMemo(() => {
    if (!problems?.length) return { labels: [], values: [] };
    const counts: Record<string, number> = {};
    for (const p of problems) counts[p.status || 'Unknown'] = (counts[p.status || 'Unknown'] || 0) + 1;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { labels: entries.map(e => e[0]), values: entries.map(e => e[1]) };
  }, [problems]);

  const requestsByStatus = useMemo(() => {
    if (!requests?.length) return { labels: [], values: [] };
    const counts: Record<string, number> = {};
    for (const r of requests) counts[r.status || 'Unknown'] = (counts[r.status || 'Unknown'] || 0) + 1;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { labels: entries.map(e => e[0]), values: entries.map(e => e[1]) };
  }, [requests]);

  const dailyTrend = useMemo(() => {
    if (!dailyStats?.length) return { labels: [], values: [] };
    const dayTotals: Record<string, number> = {};
    for (const stat of dailyStats) {
      if (!WORKSPACE_CATEGORIES.includes(stat.category)) continue;
      const day = stat.day || stat.date; if (!day) continue;
      dayTotals[day] = (dayTotals[day] || 0) + (stat.total_sec || 0);
    }
    const sorted = Object.keys(dayTotals).sort();
    return {
      labels: sorted.map(d => { try { return format(new Date(d + 'T00:00:00'), 'MMM d'); } catch { return d; } }),
      values: sorted.map(d => +(dayTotals[d] / 3600).toFixed(2)),
    };
  }, [dailyStats]);

  const responseTiming = useMemo(() => {
    if (!promptHistory?.length) return { avgResponse: null, avgThink: null, count: 0 };
    const bySession: Record<string, any[]> = {};
    for (const msg of promptHistory) { const sid = msg.session_id; if (!sid) continue; if (!bySession[sid]) bySession[sid] = []; bySession[sid].push(msg); }
    let totalResponseGap = 0, responseGapCount = 0;
    let totalThinkGap = 0, thinkGapCount = 0;
    for (const msgs of Object.values(bySession)) {
      const sorted = [...msgs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      for (let i = 0; i < sorted.length - 1; i++) {
        const t0 = new Date(sorted[i].created_at).getTime();
        const t1 = new Date(sorted[i + 1].created_at).getTime();
        const gap = (t1 - t0) / 1000;
        if (sorted[i].role === 'user' && sorted[i + 1].role === 'assistant' && gap >= 0 && gap < 600) { totalResponseGap += gap; responseGapCount++; }
        else if (sorted[i].role === 'assistant' && sorted[i + 1].role === 'user' && gap >= 0 && gap < 7200) { totalThinkGap += gap; thinkGapCount++; }
      }
    }
    return {
      avgResponse: responseGapCount > 0 ? totalResponseGap / responseGapCount : null,
      avgThink: thinkGapCount > 0 ? totalThinkGap / thinkGapCount : null,
      count: responseGapCount,
    };
  }, [promptHistory]);

  const summaryStats = useMemo(() => {
    const totalTokens = aiUsage?.totalTokens || 0;
    const totalCost = aiUsage?.totalCost || 0;
    const sessionCount = sessions.length;
    const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'running').length;
    const problemCount = problems?.length || 0;
    const openProblems = problems ? problems.filter(p => !['Fixed', 'Irrelevant'].includes(p.status)).length : 0;
    const requestCount = requests?.length || 0;
    const openRequests = requests ? requests.filter(r => !['Completed', 'Cancelled'].includes(r.status)).length : 0;
    const toolsUsed = aiUsage?.byTool ? Object.keys(aiUsage.byTool).length : 0;
    return { totalTokens, totalCost, sessionCount, activeSessions, problemCount, openProblems, requestCount, openRequests, toolsUsed };
  }, [aiUsage, sessions, problems, requests]);

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        <span className="ml-3 text-sm text-zinc-500">Loading analytics...</span>
      </div>
    );
  }

  // ─── Project variant ────────────────────────────────────────────────────────
  if (variant === 'project') {
    return (
      <div className="space-y-4">
        <KpiTile icon={Activity} value={String(summaryStats.sessionCount)} label="Sessions"
          sub={summaryStats.activeSessions > 0 ? `${summaryStats.activeSessions} active` : undefined} accent="teal" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartTile title="Sessions by Agent" icon={Cpu} subtitle="AI agent usage distribution"
            empty={sessionsByAgent.values.length === 0} emptyText="No session data available">
            <Pie data={{ labels: sessionsByAgent.labels, datasets: [{ data: sessionsByAgent.values, backgroundColor: sessionsByAgent.labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]), borderColor: sessionsByAgent.labels.map((_, i) => CHART_BORDERS[i % CHART_BORDERS.length]), borderWidth: 1.5 }] }} options={doughnutOptions} />
          </ChartTile>
          <ChartTile title="Session Status" icon={Activity} subtitle="Active vs completed sessions"
            empty={sessionsByStatus.values.length === 0} emptyText="No status data available">
            <Doughnut data={{ labels: sessionsByStatus.labels, datasets: [{ data: sessionsByStatus.values, backgroundColor: sessionsByStatus.labels.map((l, i) => getStatusColor(l, i)), borderColor: sessionsByStatus.labels.map((l, i) => getStatusBorder(l, i)), borderWidth: 1.5 }] }} options={doughnutOptions} />
          </ChartTile>
        </div>
      </div>
    );
  }

  // ─── Workspace / Full variant ───────────────────────────────────────────────
  const hasAiData = aiUsage?.totalTokens > 0 || (aiUsage?.byTool ? Object.keys(aiUsage.byTool).length > 0 : false);
  const hasActivity = codeActivity && (codeActivity.totalEvents || 0) > 0;

  return (
    <div className="space-y-5">
      {/* ── KPI Row ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
      >
        <KpiTile icon={Zap} value={fmtNum(summaryStats.totalTokens)} label="Total Tokens"
          sub={`${summaryStats.toolsUsed} tools`} accent="purple" delay={0} />
        <KpiTile icon={DollarSign} value={fmtCost(summaryStats.totalCost)} label="Total Cost" delay={0.05} />
        <KpiTile icon={Activity} value={String(summaryStats.sessionCount)} label="Sessions"
          sub={summaryStats.activeSessions > 0 ? `${summaryStats.activeSessions} active` : undefined} accent="teal" delay={0.1} />
        <KpiTile icon={AlertTriangle} value={String(summaryStats.problemCount)} label="Problems"
          sub={summaryStats.openProblems > 0 ? `${summaryStats.openProblems} open` : undefined} accent="rose" delay={0.15} />
        <KpiTile icon={FileText} value={String(summaryStats.requestCount)} label="Requests"
          sub={summaryStats.openRequests > 0 ? `${summaryStats.openRequests} open` : undefined} accent="emerald" delay={0.2} />
      </motion.div>

      {/* ── Distribution Charts (2×2 grid) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartTile title="Token Distribution" icon={Zap} subtitle="Token usage by tool"
          empty={tokenByTool.values.length === 0} emptyText="No token data">
          <Pie data={{ labels: tokenByTool.labels, datasets: [{ data: tokenByTool.values, backgroundColor: tokenByTool.labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]), borderColor: tokenByTool.labels.map((_, i) => CHART_BORDERS[i % CHART_BORDERS.length]), borderWidth: 1.5 }] }} options={doughnutOptions} />
        </ChartTile>
        <ChartTile title="Cost Distribution" icon={DollarSign} subtitle="Spending by tool"
          empty={costByTool.values.length === 0} emptyText="No cost data">
          <Doughnut data={{ labels: costByTool.labels, datasets: [{ data: costByTool.values, backgroundColor: costByTool.labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]), borderColor: costByTool.labels.map((_, i) => CHART_BORDERS[i % CHART_BORDERS.length]), borderWidth: 1.5 }] }} options={doughnutOptions} />
        </ChartTile>
        <ChartTile title="Sessions by Agent" icon={Cpu} subtitle="Agent usage distribution"
          empty={sessionsByAgent.values.length === 0} emptyText="No session data">
          <Pie data={{ labels: sessionsByAgent.labels, datasets: [{ data: sessionsByAgent.values, backgroundColor: sessionsByAgent.labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]), borderColor: sessionsByAgent.labels.map((_, i) => CHART_BORDERS[i % CHART_BORDERS.length]), borderWidth: 1.5 }] }} options={doughnutOptions} />
        </ChartTile>
        <ChartTile title="Session Status" icon={Activity} subtitle="Active vs completed"
          empty={sessionsByStatus.values.length === 0} emptyText="No status data">
          <Doughnut data={{ labels: sessionsByStatus.labels, datasets: [{ data: sessionsByStatus.values, backgroundColor: sessionsByStatus.labels.map((l, i) => getStatusColor(l, i)), borderColor: sessionsByStatus.labels.map((l, i) => getStatusBorder(l, i)), borderWidth: 1.5 }] }} options={doughnutOptions} />
        </ChartTile>
      </div>

      {/* ── Activity & Problems row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartTile title="Activity by Category" icon={PieChartIcon} subtitle="Tracked time by type"
          empty={categoryDist.values.length === 0} emptyText="No activity data">
          <Doughnut data={{ labels: categoryDist.labels, datasets: [{ data: categoryDist.values, backgroundColor: categoryDist.labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]), borderColor: categoryDist.labels.map((_, i) => CHART_BORDERS[i % CHART_BORDERS.length]), borderWidth: 1.5 }] }} options={doughnutOptions} />
        </ChartTile>
        <ChartTile title="Problems by Status" icon={AlertTriangle} subtitle="Issue pipeline"
          empty={problemsByStatus.values.length === 0} emptyText="No problems">
          <Pie data={{ labels: problemsByStatus.labels, datasets: [{ data: problemsByStatus.values, backgroundColor: problemsByStatus.labels.map((l, i) => getStatusColor(l, i)), borderColor: problemsByStatus.labels.map((l, i) => getStatusBorder(l, i)), borderWidth: 1.5 }] }} options={doughnutOptions} />
        </ChartTile>
      </div>

      {/* ── Daily Activity Trend (full-width) ── */}
      <div className="lg:grid-cols-2 gap-4">
        <ChartTile title="Daily Activity Trend" icon={TrendingUp} subtitle="Hours tracked per day" full>
          {dailyTrend.values.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
              <span className="text-xs">No daily activity data</span>
            </div>
          ) : (
            <Bar data={{ labels: dailyTrend.labels, datasets: [{ data: dailyTrend.values, backgroundColor: `rgba(168, 85, 247, 0.6)`, borderColor: `rgba(168, 85, 247, 1)`, borderWidth: 1, borderRadius: 6, barPercentage: 0.7 }] }}
              options={{ ...barOptions, scales: { ...barOptions.scales, y: { ...barOptions.scales.y, title: { display: true, text: 'Hours', color: '#64748b', font: { size: 9 } } } }, plugins: { ...barOptions.plugins, tooltip: { ...barOptions.plugins.tooltip, callbacks: { label: (ctx: any) => ` ${ctx.parsed.y} hours` } } } }} />
          )}
        </ChartTile>
      </div>

      {/* ── Requests Progress ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartTile title="Requests by Status" icon={FileText} subtitle="Feature request pipeline"
          empty={requestsByStatus.values.length === 0} emptyText="No requests">
          <Doughnut data={{ labels: requestsByStatus.labels, datasets: [{ data: requestsByStatus.values, backgroundColor: requestsByStatus.labels.map((l, i) => getStatusColor(l, i)), borderColor: requestsByStatus.labels.map((l, i) => getStatusBorder(l, i)), borderWidth: 1.5 }] }} options={doughnutOptions} />
        </ChartTile>
        <ChartTile title="Response Timing" icon={Timer} subtitle="Avg AI response & think times"
          empty={responseTiming.avgResponse === null && responseTiming.avgThink === null} emptyText="No timing data">
          <div className="flex flex-col items-center justify-center h-full gap-5 py-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400 font-mono">{responseTiming.avgResponse !== null ? fmtSec(responseTiming.avgResponse) : '—'}</div>
              <div className="text-xs text-zinc-500 mt-1">Avg Response Time</div>
              <div className="text-[10px] text-zinc-600">prompt → reply</div>
            </div>
            <div className="w-12 h-px bg-zinc-800" />
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400 font-mono">{responseTiming.avgThink !== null ? fmtSec(responseTiming.avgThink) : '—'}</div>
              <div className="text-xs text-zinc-500 mt-1">Avg Think Time</div>
              <div className="text-[10px] text-zinc-600">reply → next prompt</div>
            </div>
            {responseTiming.count > 0 && <div className="text-[10px] text-zinc-600">Based on {responseTiming.count} response pairs</div>}
          </div>
        </ChartTile>
      </div>

      {/* ── Language Distribution ── */}
      {languageDist.labels.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartTile title="Language Distribution" icon={Code2} subtitle="Languages across projects"
            empty={false} emptyText="">
            <Doughnut data={{ labels: languageDist.labels, datasets: [{ data: languageDist.values, backgroundColor: languageDist.labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]), borderColor: languageDist.labels.map((_, i) => CHART_BORDERS[i % CHART_BORDERS.length]), borderWidth: 1.5 }] }} options={doughnutOptions} />
          </ChartTile>
          {/* Top languages as a ranked list */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            className="bg-zinc-900/60 backdrop-blur-xl rounded-xl border border-zinc-800/40 p-4"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center ring-1 ring-zinc-700/50">
                <Code2 className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">Top Languages</h3>
            </div>
            <div className="space-y-2">
              {languageDist.labels.slice(0, 8).map((lang, i) => {
                const pct = languageDist.values.reduce((a, b) => a + b, 0) > 0
                  ? Math.round((languageDist.values[i] / languageDist.values.reduce((a, b) => a + b, 0)) * 100)
                  : 0;
                return (
                  <div key={lang} className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 w-4 text-right tabular-nums">{i + 1}</span>
                    <div className="flex-1 h-6 rounded-lg bg-zinc-800/50 overflow-hidden relative">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-lg relative"
                        style={{ background: `repeating-linear-gradient(45deg, ${CHART_PALETTE[i % CHART_PALETTE.length]}40 0px, ${CHART_PALETTE[i % CHART_PALETTE.length]}40 2px, transparent 2px, transparent 6px)`, borderTop: `2px solid ${CHART_PALETTE[i % CHART_PALETTE.length]}` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-16 text-right tabular-nums">{lang}</span>
                    <span className="text-xs text-zinc-500 w-12 text-right tabular-nums font-mono">{languageDist.values[i]}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Code Activity Section ── */}
      {(codeStats || codeActivity) && (
        <div className="space-y-4">
          {/* Code KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
            <CodeStatCard icon={Clock} value={fmtSec(Math.round((codeActivity?.totalDurationMs || 0) / 1000))} label="Active Coded Time"
              sub={hasActivity ? `${codeActivity?.activeDays || 0} active days` : undefined} accent="emerald" delay={0} />
            <CodeStatCard icon={Code2} value={`+${fmtNum(codeActivity?.totalLinesAdded || 0)}`} label="Lines Added"
              sub={hasActivity ? `${fmtNum(codeActivity?.filesTouched || 0)} files` : undefined} accent="cyan" delay={0.05} />
            <CodeStatCard icon={GitCommitHorizontal} value={`-${fmtNum(codeActivity?.totalLinesRemoved || 0)}`} label="Lines Removed"
              sub={hasActivity ? `${fmtNum(codeActivity?.totalEdits || 0)} edits` : undefined} accent="rose" delay={0.1} />
          </div>

          {/* Coding Activity Chart */}
          {hasActivity && codeActivity?.daily && codeActivity.daily.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.35 }}
              className="bg-zinc-900/60 backdrop-blur-xl rounded-xl border border-zinc-800/40 p-4"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
                  <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">Coding Activity</h3>
                  <p className="text-[11px] text-zinc-600 mt-0.5">Live from the DeskFlow VS Code extension</p>
                </div>
              </div>
              <div className="relative" style={{ height: 220 }}>
                <Bar data={{
                  labels: codeActivity.daily.map((r: any) => { try { return format(new Date((r.date || '') + 'T00:00:00'), 'MMM d'); } catch { return r.date; } }),
                  datasets: [
                    { label: 'Active Time (h)', data: codeActivity.daily.map((r: any) => +(r.durationMs / 3600000).toFixed(2)), backgroundColor: `rgba(52, 211, 153, 0.55)`, borderColor: `rgba(52, 211, 153, 1)`, borderWidth: 1, borderRadius: 4 },
                    { label: 'Lines Added', data: codeActivity.daily.map((r: any) => r.linesAdded || 0), backgroundColor: `rgba(34, 211, 238, 0.55)`, borderColor: `rgba(34, 211, 238, 1)`, borderWidth: 1, borderRadius: 4 },
                    { label: 'Lines Removed', data: codeActivity.daily.map((r: any) => r.linesRemoved || 0), backgroundColor: `rgba(251, 113, 133, 0.55)`, borderColor: `rgba(251, 113, 133, 1)`, borderWidth: 1, borderRadius: 4 },
                  ],
                }} options={{
                  responsive: true, maintainAspectRatio: false,
                  interaction: { mode: 'index' as const, intersect: false },
                  scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b', font: { size: 9 } } },
                    y: { stacked: true, grid: { color: 'rgba(113,113,122,0.06)' }, border: { color: 'rgba(113,113,122,0.12)' }, ticks: { color: '#64748b', font: { size: 9 }, padding: 6 } },
                  },
                  plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(9,9,11,0.95)', titleColor: '#e4e4e7', bodyColor: '#a1a1aa', borderColor: 'rgba(63,63,70,0.5)', borderWidth: 1, cornerRadius: 8, padding: 8 } },
                }} />
              </div>
            </motion.div>
          )}

          {/* Top Files */}
          {codeActivity?.topFiles && codeActivity.topFiles.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.35 }}
              className="bg-zinc-900/60 backdrop-blur-xl rounded-xl border border-zinc-800/40 p-4"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center ring-1 ring-zinc-700/50">
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">Most Active Files</h3>
              </div>
              <div className="space-y-1.5 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
                {codeActivity.topFiles.slice(0, 6).map((file: any) => (
                  <div key={file.file_path} className="flex items-center justify-between text-xs bg-zinc-800/30 rounded-lg px-3 py-2">
                    <span className="text-zinc-300 truncate font-mono max-w-[200px]" title={file.file_path}>
                      {file.file_path.split(/[\\/]/).pop()}
                    </span>
                    <div className="flex items-center gap-3 text-zinc-500 flex-shrink-0">
                      <span className="text-emerald-400">+{file.linesAdded || 0}</span>
                      <span className="text-rose-400">-{file.linesRemoved || 0}</span>
                      <span className="text-cyan-400">{fmtSec((file.durationMs || 0) / 1000)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ── Problems & Requests Progress ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProgressCard title="Problems Progress" icon={AlertTriangle} accent="rose"
          items={problems?.length ? [{
            label: 'Fixed', done: problems.filter(p => p.status === 'Fixed').length, total: problems.length,
            color: 'rgba(52, 211, 153, 0.8)', pendingColor: 'rgba(59, 130, 246, 0.5)',
          }, {
            label: 'In Progress', done: problems.filter(p => ['In Progress', 'AI Attempted Fix'].includes(p.status)).length, total: problems.length,
            color: 'rgba(96, 165, 250, 0.6)', pendingColor: 'rgba(59, 130, 246, 0.3)',
          }] : []} />
        <ProgressCard title="Requests Progress" icon={FileText} accent="emerald"
          items={requests?.length ? [{
            label: 'Completed', done: requests.filter(r => r.status === 'Completed').length, total: requests.length,
            color: 'rgba(52, 211, 153, 0.8)', pendingColor: 'rgba(59, 130, 246, 0.5)',
          }, {
            label: 'In Progress', done: requests.filter(r => r.status === 'In Progress').length, total: requests.length,
            color: 'rgba(96, 165, 250, 0.6)', pendingColor: 'rgba(59, 130, 246, 0.3)',
          }] : []} />
      </div>

      {/* ── AI Usage Summary Table ── */}
      {hasAiData && aiUsage?.byTool && Object.keys(aiUsage.byTool).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.35 }}
          className="bg-zinc-900/60 backdrop-blur-xl rounded-xl border border-zinc-800/40 p-4"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center ring-1 ring-purple-500/20">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">AI Usage Summary</h3>
              <p className="text-[11px] text-zinc-600 mt-0.5">Per-tool breakdown</p>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3 mb-4">
            <div className="bg-zinc-800/40 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-purple-400 font-mono">{fmtNum(summaryStats.totalTokens)}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Total Tokens</div>
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-amber-400 font-mono">{fmtCost(summaryStats.totalCost)}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Total Cost</div>
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-emerald-400 font-mono">{summaryStats.toolsUsed}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Tools Used</div>
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-cyan-400 font-mono">{summaryStats.sessionCount}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Sessions</div>
            </div>
            <div className="bg-zinc-800/40 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-rose-400 font-mono">{responseTiming.avgResponse !== null ? fmtSec(responseTiming.avgResponse) : '—'}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Avg Response</div>
            </div>
          </div>
          <div className="overflow-x-auto border-t border-zinc-800/40 pt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800/40">
                  <th className="text-left text-zinc-500 font-medium py-2 pr-4">Tool</th>
                  <th className="text-right text-zinc-500 font-medium py-2 pr-4">Tokens</th>
                  <th className="text-right text-zinc-500 font-medium py-2 pr-4">Cost</th>
                  <th className="text-right text-zinc-500 font-medium py-2 pr-4">Sessions</th>
                  <th className="text-right text-zinc-500 font-medium py-2">Messages</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(aiUsage.byTool).sort(([, a]: any[], [, b]: any[]) => (b.tokens || 0) - (a.tokens || 0))
                  .map(([tool, data]: [string, any], i: number) => (
                    <tr key={tool} className="border-b border-zinc-800/20 hover:bg-zinc-800/20 transition-colors">
                      <td className="py-2 pr-4 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                        <span className="text-zinc-300">{tool}</span>
                      </td>
                      <td className="text-right text-zinc-400 py-2 pr-4 font-mono">{fmtNum(data.tokens || 0)}</td>
                      <td className="text-right text-zinc-400 py-2 pr-4 font-mono">{fmtCost(data.cost || 0)}</td>
                      <td className="text-right text-zinc-400 py-2 font-mono">{data.sessions || 0}</td>
                      <td className="text-right text-zinc-400 py-2 font-mono">{data.messageCount || 0}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
