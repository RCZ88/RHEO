import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip } from 'chart.js';
import type { ChartOptions } from 'chart.js';
import {
  Sparkles, TrendingUp, TrendingDown, Percent, Receipt, CalendarDays,
  ArrowDownLeft, ArrowUpRight, RefreshCw, Trash2, LoaderCircle, BookOpenText,
  CheckCircle2, AlertTriangle, RotateCcw, Handshake, Zap, CircleDollarSign,
  Wallet, PieChart,
} from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import { AnimatedGradientText } from '../ui/animated-gradient-text';
import { convertAmount, formatCurrency } from './currency-data';
import { cleanRecapSummary } from '../../shared/recap';

ChartJS.register(ArcElement, ChartTooltip);

type RecapGenStage = 'reading' | 'analyzing' | 'writing' | 'saving' | 'done';

const STAGE_LABEL: Record<RecapGenStage, string> = {
  reading: 'Reading transactions…',
  analyzing: 'Analyzing your month…',
  writing: 'Writing your story…',
  saving: 'Saving…',
  done: 'Done',
};

const STAGE_DESC: Record<RecapGenStage, string> = {
  reading: 'Pulling this month\'s income, expenses and wallets.',
  analyzing: 'Computing categories, wallet deltas and follow-through.',
  writing: 'The AI is composing your narrative from real numbers.',
  saving: 'Freezing the recap into this month\'s history.',
  done: '',
};

const STAGE_WIDTH: Record<RecapGenStage, string> = {
  reading: '18%',
  analyzing: '45%',
  writing: '78%',
  saving: '92%',
  done: '100%',
};

interface RecapPanelProps {
  dataSection?: string;
  displayCurrency: string;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const MONO = { fontFamily: "'JetBrains Mono', monospace" };

function monthLabel(month: string): string {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month;
  const d = new Date(`${month}-01T00:00:00`);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function shortMonth(month: string): string {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month;
  const d = new Date(`${month}-01T00:00:00`);
  return d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

export function RecapPanel({ dataSection, displayCurrency, onNotify }: RecapPanelProps) {
  const [months, setMonths] = useState<string[]>([]);
  const [recaps, setRecaps] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [recap, setRecap] = useState<any>(null);
  const [listLoading, setListLoading] = useState(true);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState<RecapGenStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | 'regen' | 'delete'>(null);

  const api = window.deskflowAPI as any;

  const loadMonths = useCallback(async () => {
    try {
      const r = await api?.financeRecapMonthsWithData?.();
      if (r?.ok) setMonths(r.data || []);
    } catch { /* keep current */ }
  }, [api]);

  const loadRecaps = useCallback(async () => {
    try {
      const r = await api?.financeRecapList?.();
      if (r?.ok) setRecaps(r.data || []);
    } catch { /* keep current */ }
  }, [api]);

  useEffect(() => {
    (async () => {
      setListLoading(true);
      await Promise.all([loadMonths(), loadRecaps()]);
      const today = new Date();
      const cur = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      setListLoading(false);
    })();
  }, [loadMonths, loadRecaps]);

  const monthsWithData = useMemo(() => months.slice(0, 12), [months]);

  // Default to the most recent month with data; fall back to the current month
  useEffect(() => {
    if (selectedMonth) return;
    if (monthsWithData.length > 0) {
      setSelectedMonth(monthsWithData[0]);
    } else {
      const today = new Date();
      setSelectedMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    }
  }, [monthsWithData, selectedMonth]);

  const existingRecap = useMemo(
    () => recaps.find((r: any) => r.month === selectedMonth) || recap || null,
    [recaps, recap, selectedMonth]
  );

  useEffect(() => {
    if (!selectedMonth) return;
    let cancelled = false;
    setFetchLoading(true);
    api?.financeRecapGet?.(selectedMonth)
      .then((r: any) => { if (!cancelled) setRecap(r?.ok ? r.data : null); })
      .catch(() => { if (!cancelled) setRecap(null); })
      .finally(() => { if (!cancelled) setFetchLoading(false); });
    return () => { cancelled = true; };
  }, [selectedMonth, api]);

  const refresh = useCallback(async () => {
    await Promise.all([loadMonths(), loadRecaps()]);
    const r = await api?.financeRecapGet?.(selectedMonth);
    setRecap(r?.ok ? r.data : null);
  }, [api, selectedMonth, loadMonths, loadRecaps]);

  // Live stage progress while generating
  useEffect(() => {
    const off = api?.onRecapProgress?.((data: any) => {
      if (!data?.month || data.month !== selectedMonth) return;
      setGenStage(data.stage || null);
      if (data.stage === 'done') setGenerating(false);
    });
    return () => { if (typeof off === 'function') off(); };
  }, [api, selectedMonth]);

  // Defensive clean for legacy rows stored before the parser existed
  const narrative = useMemo(() => {
    const cleaned = cleanRecapSummary(recap?.summary);
    return cleaned || String(recap?.summary || '').trim();
  }, [recap?.summary]);

  const handleGenerate = useCallback(async (force: boolean) => {
    if (!selectedMonth || generating) return;
    if (existingRecap && !force) {
      setConfirmAction('regen');
      return;
    }
    setGenerating(true);
    setGenStage(null);
    setError(null);
    try {
      const r = await api?.financeRecapGenerate?.(selectedMonth, force);
      if (r?.ok) {
        await refresh();
        onNotify?.(force ? `Recap regenerated for ${monthLabel(selectedMonth)}` : `Recap generated for ${monthLabel(selectedMonth)}`, 'success');
      } else {
        setError(r?.error || 'Generation failed');
        onNotify?.(r?.error || 'Generation failed', 'error');
      }
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
      onNotify?.(e?.message || 'Generation failed', 'error');
    } finally {
      setGenerating(false);
      setConfirmAction(null);
    }
  }, [selectedMonth, generating, existingRecap, api, refresh, onNotify]);

  const handleDelete = useCallback(async () => {
    if (!selectedMonth) return;
    try {
      const r = await api?.financeRecapDelete?.(selectedMonth);
      if (r?.ok) {
        setRecap(null);
        await refresh();
        onNotify?.(`Recap deleted for ${monthLabel(selectedMonth)}`, 'info');
      } else {
        onNotify?.(r?.error || 'Delete failed', 'error');
      }
    } catch (e: any) {
      onNotify?.(e?.message || 'Delete failed', 'error');
    } finally {
      setConfirmAction(null);
    }
  }, [selectedMonth, api, refresh, onNotify]);

  const stats = recap?.stats || null;
  const cur = stats?.displayCurrency || displayCurrency;
  const conv = useCallback((v: number) => convertAmount(v || 0, cur, displayCurrency), [cur, displayCurrency]);
  const fmt = useCallback((v: number) => formatCurrency(conv(v), displayCurrency), [conv, displayCurrency]);

  const savingsRate = stats && stats.income?.total > 0 ? ((stats.income.total - stats.expense.total) / stats.income.total) * 100 : 0;
  const essentialsPct = stats && stats.expense?.total > 0 && stats.topCategories?.length
    ? (stats.topCategories.slice(0, 3).reduce((s: number, c: any) => s + (c.amount || 0), 0) / stats.expense.total) * 100
    : 0;
  const avgDaily = stats && stats.activeDays > 0 ? stats.expense.total / stats.activeDays : 0;
  const topDeltas = stats?.walletBalanceDelta?.length
    ? [...stats.walletBalanceDelta].filter((w: any) => w.delta !== 0).sort((a: any, b: any) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3)
    : [];

  const renderStatsGrid = () => {
    if (!stats) return null;
    const cells = [
      { label: 'Income', icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />, value: stats.income.total, formatter: (v: number) => fmt(v) },
      { label: 'Expenses', icon: <TrendingDown className="w-3.5 h-3.5 text-rose-400" />, value: stats.expense.total, formatter: (v: number) => fmt(v) },
      { label: 'Net Flow', icon: stats.net >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" /> : <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />, value: stats.net, formatter: (v: number) => fmt(v), accent: stats.net >= 0 ? 'text-cyan-300' : 'text-rose-300' },
      { label: 'Savings Rate', icon: <Percent className="w-3.5 h-3.5 text-sky-400" />, value: savingsRate, formatter: (v: number) => `${v.toFixed(1)}%` },
      { label: 'Essentials %', icon: <Receipt className="w-3.5 h-3.5 text-violet-400" />, value: essentialsPct, formatter: (v: number) => `${v.toFixed(1)}%` },
      { label: 'Biggest Spend', icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />, value: stats.biggestExpense?.amount || 0, formatter: (v: number) => fmt(v) },
      { label: 'Avg Daily', icon: <CalendarDays className="w-3.5 h-3.5 text-teal-400" />, value: avgDaily, formatter: (v: number) => fmt(v) },
      { label: 'Active Days', icon: <CalendarDays className="w-3.5 h-3.5 text-zinc-400" />, value: stats.activeDays || 0, formatter: (v: number) => `${Math.round(v)}` },
    ];
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cells.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-zinc-800/80 bg-[rgba(24,24,27,0.60)] backdrop-blur-xl p-4"
          >
            <div className="flex items-center gap-1.5 mb-2">
              {c.icon}
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{c.label}</span>
            </div>
            <NumberTicker value={c.value} formatter={c.formatter} className={`text-lg font-semibold font-mono ${c.accent || 'text-zinc-100'}`} />
          </motion.div>
        ))}
      </div>
    );
  };

  const renderSpendingByCategory = () => {
    if (!stats) return null;
    const source = stats.spendingByCategory?.length ? stats.spendingByCategory : (stats.topCategories || []);
    if (!source.length) return null;
    const items = source
      .map((c: any) => ({
        name: String(c.name ?? c.categoryName ?? 'Uncategorized'),
        amount: Number(c.amount) || 0,
        color: String(c.color ?? c.categoryColor ?? '#888888'),
      }))
      .filter((c: any) => c.amount > 0);
    if (!items.length) return null;
    const total = items.reduce((s: number, c: any) => s + c.amount, 0);
    const top = items.slice(0, 6);
    const topSum = top.reduce((s: number, c: any) => s + c.amount, 0);
    const rows = topSum < total ? [...top, { name: 'Other', amount: total - topSum, color: '#71717a' }] : top;

    const donutData = {
      labels: rows.map((r: any) => r.name),
      datasets: [{
        data: rows.map((r: any) => conv(r.amount)),
        backgroundColor: rows.map((r: any) => r.color),
        hoverBackgroundColor: rows.map((r: any) => r.color),
        hoverOffset: 6,
        borderWidth: 0,
      }],
    };

    const donutOptions: ChartOptions<'doughnut'> = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(24,24,27,0.95)',
          titleColor: '#fff',
          bodyColor: '#a1a1aa',
          borderColor: 'rgba(113,113,122,0.3)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: (items: any[]) => (items[0]?.label ? String(items[0].label) : ''),
            label: (ctx: any) => {
              const value = Number(ctx.parsed) || 0;
              const pct = total > 0 ? ((Number(ctx.parsed) || 0) / conv(total) * 100).toFixed(1) : '0.0';
              return `${fmt(value)} (${pct}%)`;
            },
          },
        },
      },
    };

    return (
      <div className="rounded-xl border border-zinc-800/80 bg-[rgba(24,24,27,0.60)] backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-bold font-caslon text-zinc-200">Spending by Category</h3>
          <span className="text-[10px] text-zinc-500 ml-auto" style={MONO}>top {rows.length} of {items.length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
          {/* Donut + center total */}
          <div className="md:col-span-2 relative w-full max-w-[240px] h-[220px] mx-auto">
            <Doughnut data={donutData} options={donutOptions} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-semibold font-mono text-zinc-100">{fmt(total)}</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">spent</span>
            </div>
          </div>
          {/* Animated bars */}
          <div className="md:col-span-3 space-y-3 self-center">
            {rows.map((r: any, i: number) => {
              const pct = total > 0 ? (r.amount / total) * 100 : 0;
              return (
                <div key={r.name}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs text-zinc-300 truncate">{r.name}</span>
                    <span className="text-[11px] font-medium text-zinc-400" style={MONO}>
                      {fmt(r.amount)} <span className="text-zinc-600">· {pct.toFixed(1)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: r.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderOnBehalf = () => {
    if (!stats?.followThrough?.length) return null;
    const maxAbs = Math.max(...stats.followThrough.map((p: any) => Math.abs(p.net || 0)), 1);
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-[rgba(24,24,27,0.60)] backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Handshake className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold font-caslon text-zinc-200">Follow Through</h3>
          <span className="text-[10px] text-zinc-500 ml-auto" style={MONO}>net per person</span>
        </div>
        <div className="space-y-3">
          {stats.followThrough.map((p: any) => {
            const net = p.net || 0;
            const pct = (Math.abs(net) / maxAbs) * 100;
            return (
              <div key={p.id}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-zinc-300">{p.name}</span>
                  <span className={`text-xs font-medium ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} style={MONO}>
                    {net >= 0 ? '+' : ''}{fmt(net)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderNarrative = () => {
    if (!narrative) return null;
    const paragraphs = narrative.split(/\n{2,}/).map((s: string) => s.trim()).filter(Boolean);
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-[rgba(24,24,27,0.60)] backdrop-blur-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpenText className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold font-caslon text-zinc-200">The Month&apos;s Story</h3>
          {recap.status === 'failed' && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
              <AlertTriangle className="w-3 h-3" /> generated with fallback
            </span>
          )}
        </div>
        <div className="space-y-3">
          {paragraphs.map((p: string, i: number) => (
            <p key={i} className="text-sm leading-relaxed text-zinc-300 font-serif">{p}</p>
          ))}
        </div>
      </div>
    );
  };

  const renderInsights = () => {
    if (!stats) return null;
    const cards: { title: string; icon: React.ReactNode; content: React.ReactNode }[] = [];
    if (stats.biggestExpense) {
      cards.push({
        title: 'Biggest Spend',
        icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
        content: (
          <div>
            <p className="text-sm font-semibold text-zinc-100">{fmt(stats.biggestExpense.amount)}</p>
            <p className="text-xs text-zinc-500 mt-1 truncate">{stats.biggestExpense.description || 'Untitled'}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{stats.biggestExpense.category} · {stats.biggestExpense.date}</p>
          </div>
        ),
      });
    }
    if (topDeltas.length) {
      cards.push({
        title: 'Wallet Deltas',
        icon: <Wallet className="w-3.5 h-3.5 text-cyan-400" />,
        content: (
          <div className="space-y-1.5">
            {topDeltas.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 truncate">{w.name}</span>
                <span className={`text-xs font-medium flex items-center gap-1 ${w.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {w.delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                  {fmt(w.delta)}
                </span>
              </div>
            ))}
          </div>
        ),
      });
    }
    if (stats.biggestExpense) {
      cards.push({
        title: 'Costliest Day',
        icon: <CircleDollarSign className="w-3.5 h-3.5 text-rose-400" />,
        content: (
          <div>
            <p className="text-sm font-semibold text-zinc-100">{stats.biggestExpense.date}</p>
            <p className="text-xs text-zinc-500 mt-1">{fmt(stats.biggestExpense.amount)} spent in one day</p>
          </div>
        ),
      });
    }
    if (!cards.length) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + 0.05 * i, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-zinc-800/80 bg-[rgba(24,24,27,0.60)] backdrop-blur-xl p-4"
          >
            <div className="flex items-center gap-1.5 mb-3">
              {c.icon}
              <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{c.title}</h3>
            </div>
            {c.content}
          </motion.div>
        ))}
      </div>
    );
  };

  const renderEmpty = () => {
    if (months.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-[rgba(24,24,27,0.40)] backdrop-blur-xl p-10 text-center">
          <BookOpenText className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">No monthly data yet</p>
          <p className="text-xs text-zinc-600 mt-1">Add some transactions first — the recap will appear here at the end of the month.</p>
        </div>
      );
    }
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-[rgba(24,24,27,0.60)] backdrop-blur-xl p-10 text-center"
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />
        <AnimatedGradientText colorFrom="#34d399" colorTo="#22d3ee" className="text-2xl font-bold tracking-tight font-caslon">
          {monthLabel(selectedMonth)} Recap
        </AnimatedGradientText>
        <p className="text-xs text-zinc-500 mt-3 max-w-sm mx-auto">A monthly narrative of your money — generated from real transactions, spending, wallets and follow-through.</p>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          disabled={generating}
          onClick={() => handleGenerate(false)}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold px-6 py-2.5 shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:opacity-50"
        >
          {generating ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? (genStage ? STAGE_LABEL[genStage] : 'Generating…') : 'Generate this month’s recap'}
        </motion.button>
      </motion.div>
    );
  };

  return (
    <div data-section={dataSection} className="space-y-4">
      {/* Month selector */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] uppercase tracking-wider text-zinc-500 mr-1" style={MONO}>Month</label>
        <input
          type="month"
          value={selectedMonth}
          max={new Date().toISOString().slice(0, 7)}
          onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-200 text-xs px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        />
        <div className="flex flex-wrap gap-1.5">
          {monthsWithData.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${m === selectedMonth
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}`}
            >
              {shortMonth(m)}
            </button>
          ))}
        </div>
      </div>

      {listLoading ? (
        <div className="space-y-4">
          <div className="h-24 rounded-xl bg-zinc-900/60 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-zinc-900/60 animate-pulse" />)}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
          <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
          <p className="text-sm text-rose-300">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Dismiss
          </button>
        </div>
      ) : !existingRecap && !fetchLoading ? (
        renderEmpty()
      ) : fetchLoading ? (
        <div className="space-y-4">
          <div className="h-24 rounded-xl bg-zinc-900/60 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-zinc-900/60 animate-pulse" />)}
          </div>
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-[rgba(24,24,27,0.60)] backdrop-blur-xl p-6">
            <div className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 px-3 py-1 text-[10px] font-medium text-amber-300" style={MONO}>
                <Sparkles className="w-3 h-3" /> // {selectedMonth} recap //
              </span>
              {recap?.providerId && (
                <span className="text-[10px] text-zinc-600" style={MONO}>{recap.providerId}</span>
              )}
            </div>
            <AnimatedGradientText colorFrom="#34d399" colorTo="#22d3ee" className="text-3xl font-bold tracking-tight font-caslon">
              {recap?.title || `${monthLabel(selectedMonth)} in Numbers`}
            </AnimatedGradientText>
            {recap?.createdAt && (
              <p className="text-[11px] text-zinc-600 mt-2" style={MONO}>
                saved {recap.createdAt.replace('T', ' ').slice(0, 16)}
              </p>
            )}
          </div>

          {stats && renderStatsGrid()}
          {stats && renderSpendingByCategory()}
          {stats && renderOnBehalf()}
          {renderNarrative()}
          {stats && renderInsights()}

          {/* APEX insight — computed from real stats, falls back to explainer copy */}
          <div className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-[rgba(24,24,27,0.60)] backdrop-blur-xl p-5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent animate-gradient bg-size-[200%_100%]" style={{ backgroundSize: '200% 100%' }} />
            <p className="text-[10px] font-medium text-amber-300 tracking-widest mb-2" style={MONO}>// APEX //</p>
            {recap?.apex ? (
              <>
                <h4 className="text-sm font-semibold text-zinc-100 font-caslon">{recap.apex.title}</h4>
                <p className="text-xs leading-relaxed text-zinc-400 mt-1">{recap.apex.text}</p>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-zinc-500">
                This recap is written by an AI reading your real transactions, wallets, subscriptions and follow-through.
                Regenerate it anytime — the old narrative is replaced, the numbers stay frozen as history.
              </p>
            )}
          </div>

          {/* Live generation stages */}
          {generating && genStage && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] backdrop-blur-xl p-4">
              <div className="flex items-center gap-2">
                <LoaderCircle className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span className="text-xs font-medium text-emerald-300">{STAGE_LABEL[genStage]}</span>
              </div>
              {STAGE_DESC[genStage] && (
                <p className="text-[11px] text-zinc-500 mt-1">{STAGE_DESC[genStage]}</p>
              )}
              <div className="mt-2.5 h-1 rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                  initial={{ width: '8%' }}
                  animate={{ width: STAGE_WIDTH[genStage] }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          )}

          {/* Footer bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800/80 bg-[rgba(24,24,27,0.60)] backdrop-blur-xl px-4 py-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400" style={MONO}>
              <CheckCircle2 className="w-3 h-3" /> saved
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500" style={MONO}>
              {shortMonth(selectedMonth)} · {displayCurrency}
            </span>
            <span className="text-[10px] text-zinc-600 ml-auto" style={MONO}>Month&apos;s End</span>
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-medium px-3 py-1.5 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 animate-pulse"
            >
              {generating ? <LoaderCircle className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {generating ? (genStage ? STAGE_LABEL[genStage] : 'Generating…') : 'Regenerate'}
            </button>
            <button
              onClick={() => setConfirmAction('delete')}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 text-zinc-500 text-[11px] px-3 py-1.5 hover:border-rose-500/40 hover:text-rose-400 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </>
      )}

      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmAction(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm mx-4 rounded-xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-xl p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3">
                {confirmAction === 'regen' ? (
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                ) : (
                  <Trash2 className="w-4 h-4 text-rose-400" />
                )}
                <h3 className="text-sm font-semibold text-zinc-100">
                  {confirmAction === 'regen' ? 'Regenerate recap?' : 'Delete recap?'}
                </h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed mb-4">
                {confirmAction === 'regen'
                  ? `The existing recap for ${monthLabel(selectedMonth)} will be overwritten with a fresh narrative.`
                  : `The recap for ${monthLabel(selectedMonth)} will be permanently removed. The underlying transactions stay untouched.`}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmAction === 'regen' ? handleGenerate(true) : handleDelete()}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white ${confirmAction === 'regen' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-rose-500 hover:bg-rose-400'}`}
                >
                  {confirmAction === 'regen' ? 'Regenerate' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
