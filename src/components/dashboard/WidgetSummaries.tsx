import * as React from "react";
// ============================================================
// RHEO Dashboard — Widget Summary Components
// Rich, compact card views using real shadcn Progress/Badge
// LAMINAR: design.md wins over all skill defaults
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from "motion/react";
import { Bar } from 'react-chartjs-2';
import {
  AlertCircle, Clock, Target, Zap, BarChart3, Moon, Brain,
  Flame, TrendingUp, Calendar, Sparkles, ArrowRight, Check,
  Bot, Wallet, BookOpen, Activity, Lock,
} from 'lucide-react';
import { useDashboardDataContext } from './DashboardContext';
import { CATEGORY_COLORS } from '../CategoryColors';

// ── Progress bar (shadcn-style) ──
function ProgressBar({ value, color = 'var(--page-accent)', height = 6 }: { value: number; color?: string; height?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, backgroundColor: 'var(--border-subtle)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

// ── Stat value display ──
function StatValue({ value, label, icon: Icon, accent }: { value: string | number; label: string; icon?: React.ComponentType<any>; accent?: string }) {
  return (
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent || 'var(--page-accent)'}15`, color: accent || 'var(--page-accent)' }}>
          <Icon size={16} />
        </div>
      )}
      <div>
        <div className="font-display text-[22px] font-bold leading-none text-[var(--text-primary)]">{value}</div>
        <div className="mt-1 text-[11px] text-[var(--text-muted)]">{label}</div>
      </div>
    </div>
  );
}

// ── Goals Summary ──
export function GoalsSummary() {
  const ctx = useDashboardDataContext();
  const navigate = useNavigate();
  const completed = ctx.goals.filter(g => g.status === 'done').length;
  const total = ctx.goals.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/goals')}>
      <StatValue value={`${completed}/${total}`} label="goals completed" icon={Target} />
      <ProgressBar value={pct} />
      {ctx.goals.length === 0 && (
        <p className="text-[11px] text-[var(--text-muted)]">No goals yet — click to add</p>
      )}
      {ctx.goals.length > 0 && (
        <div className="space-y-1.5">
          {ctx.goals.slice(0, 3).map((goal) => (
            <div key={goal.id} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full flex items-center justify-center ${goal.status === 'done' ? 'bg-[var(--success)]' : 'bg-[var(--text-muted)]/30'}`}>
                {goal.status === 'done' && <Check size={8} className="text-white" />}
              </div>
              <span className={`text-[12px] flex-1 truncate ${goal.status === 'done' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}`}>
                {goal.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Deadlines Summary ──
export function DeadlinesSummary() {
  const ctx = useDashboardDataContext();
  const navigate = useNavigate();
  const upcoming = ctx.deadlines.filter(d => d.status !== 'completed');
  const urgent = upcoming.filter(d => {
    const due = new Date(d.due_date);
    const days = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 2;
  }).length;

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/goals')}>
      <div className="flex items-center justify-between">
        <StatValue value={upcoming.length} label="upcoming" icon={Calendar} accent="var(--warning)" />
        {urgent > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--error)]/10 text-[var(--error)] text-[11px] font-medium">
            <AlertCircle size={11} />
            {urgent} urgent
          </div>
        )}
      </div>
      {upcoming.length > 0 && (
        <div className="space-y-1.5">
          {upcoming.slice(0, 3).map((dl) => {
            const days = Math.ceil((new Date(dl.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const isUrgent = days <= 2;
            return (
              <div key={dl.id} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isUrgent ? 'bg-[var(--error)]' : 'bg-[var(--warning)]'}`} />
                <span className="text-[12px] text-[var(--text-secondary)] truncate flex-1">{dl.title}</span>
                <span className={`text-[11px] font-mono ${isUrgent ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
                  {days === 0 ? 'Today' : days === 1 ? '1d' : `${days}d`}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {upcoming.length === 0 && (
        <p className="text-[11px] text-[var(--text-muted)]">No upcoming deadlines</p>
      )}
    </div>
  );
}

// ── Focus Summary ──
export function FocusSummary() {
  const ctx = useDashboardDataContext();
  const navigate = useNavigate();

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/focus')}>
      <StatValue value={`${ctx.focusMinutes}m`} label="focus today" icon={Zap} accent="var(--success)" />
      <div className="flex items-center gap-4">
        <div className="relative w-14 h-14">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
            <motion.circle
              cx="18" cy="18" r="15" fill="none"
              stroke="var(--success)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 15}
              initial={{ strokeDashoffset: 2 * Math.PI * 15 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 15 * (1 - ctx.focusProgress / 100) }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-mono font-bold text-[var(--success)]">
              {Math.round(ctx.focusProgress)}%
            </span>
          </div>
        </div>
        <div>
          <div className="text-[12px] text-[var(--text-secondary)]">Daily target</div>
          <div className="text-[11px] text-[var(--text-muted)]">250 min</div>
        </div>
      </div>
    </div>
  );
}

// ── Tier Breakdown Summary ──
export function TierBreakdownSummary() {
  const ctx = useDashboardDataContext();
  const navigate = useNavigate();
  const total = ctx.overview?.totalSeconds || 1;
  const prod = ctx.overview?.productiveSeconds || 0;
  const neut = ctx.overview?.neutralSeconds || 0;
  const dist = ctx.overview?.distractingSeconds || 0;

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/stats')}>
      <StatValue value={`${Math.round(total / 3600)}h`} label="total tracked" icon={BarChart3} />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
          <span className="text-[11px] text-[var(--text-secondary)] flex-1">Productive</span>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">{Math.round(prod / 3600)}h</span>
        </div>
        <ProgressBar value={(prod / total) * 100} color="var(--success)" height={4} />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--warning)]" />
          <span className="text-[11px] text-[var(--text-secondary)] flex-1">Neutral</span>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">{Math.round(neut / 3600)}h</span>
        </div>
        <ProgressBar value={(neut / total) * 100} color="var(--warning)" height={4} />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--error)]" />
          <span className="text-[11px] text-[var(--text-secondary)] flex-1">Distracting</span>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">{Math.round(dist / 3600)}h</span>
        </div>
        <ProgressBar value={(dist / total) * 100} color="var(--error)" height={4} />
      </div>
    </div>
  );
}

// ── Sleep Summary ──
export function SleepSummary() {
  const ctx = useDashboardDataContext();
  const navigate = useNavigate();

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/external')}>
      <StatValue value={`${ctx.avgSleep}h`} label="avg sleep" icon={Moon} accent="var(--info)" />
      <div className="flex items-end gap-1 h-14">
        {ctx.sleepData.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <motion.div
              className="w-full rounded-t-sm bg-[var(--info)]/60"
              initial={{ height: 0 }}
              animate={{ height: `${(day.hours / 10) * 100}%` }}
              transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            />
            <span className="text-[9px] text-[var(--text-muted)]">{day.label}</span>
          </div>
        ))}
      </div>
      {ctx.sleepDebt > 0 && (
        <div className="flex items-center gap-1 text-[11px] text-[var(--error)]">
          <AlertCircle size={11} />
          -{ctx.sleepDebt}h debt
        </div>
      )}
    </div>
  );
}

// ── Mastery Summary ──
export function MasterySummary() {
  const ctx = useDashboardDataContext();
  const navigate = useNavigate();
  const pct = ctx.masteryTotal > 0 ? Math.round((ctx.masteryMastered / ctx.masteryTotal) * 100) : 0;

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/learn')}>
      <StatValue value={`${ctx.masteryMastered}/${ctx.masteryTotal}`} label="nodes mastered" icon={Brain} accent="var(--page-accent)" />
      <ProgressBar value={pct} />
      <div className="flex items-center gap-2">
        <div className="text-[11px] text-[var(--text-muted)]">Proficiency ≥ 4</div>
        <div className="text-[11px] font-mono text-[var(--page-accent)]">{pct}%</div>
      </div>
    </div>
  );
}

// ── Activity Feed Summary ──
export function ActivityFeedSummary() {
  const ctx = useDashboardDataContext();
  const navigate = useNavigate();
  const recent = ctx.recentSessions?.slice(0, 5) || [];

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/stats')}>
      <StatValue value={ctx.recentSessions?.length || 0} label="recent sessions" icon={Clock} />
      <div className="space-y-1.5">
        {recent.map((session: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              session.tier === 'productive' ? 'bg-[var(--success)]' :
              session.tier === 'distracting' ? 'bg-[var(--error)]' : 'bg-[var(--warning)]'
            }`} />
            <span className="text-[12px] text-[var(--text-secondary)] truncate flex-1">
              {session.app || session.name || 'Unknown'}
            </span>
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              {Math.round((session.durationSeconds || 0) / 60)}m
            </span>
          </div>
        ))}
        {recent.length === 0 && (
          <p className="text-[11px] text-[var(--text-muted)]">No recent sessions</p>
        )}
      </div>
    </div>
  );
}

// ── Momentum Summary ──
export function MomentumSummary() {
  const ctx = useDashboardDataContext();
  const navigate = useNavigate();
  const score = ctx.momentum?.score || ctx.productivityScore || 0;

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/insights')}>
      <StatValue value={score} label="momentum score" icon={Flame} accent="var(--page-accent)" />
      <ProgressBar value={score} />
      <div className={`text-[12px] font-medium ${
        ctx.momentum?.trend === 'up' ? 'text-[var(--success)]' :
        ctx.momentum?.trend === 'down' ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'
      }`}>
        {ctx.momentum?.trend === 'up' ? '↑ Rising' :
         ctx.momentum?.trend === 'down' ? '↓ Falling' : '→ Stable'}
      </div>
    </div>
  );
}

// ── Schedule Summary ──
export function ScheduleSummary() {
  const ctx = useDashboardDataContext();
  const navigate = useNavigate();
  const today = new Date().getDay();
  const todaySchedule = ctx.schedule.filter(s => s.day_of_week === today);

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/settings')}>
      <StatValue value={todaySchedule.length} label="events today" icon={Calendar} accent="var(--warning)" />
      <div className="space-y-1.5">
        {todaySchedule.slice(0, 3).map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--page-accent)]" />
            <span className="text-[12px] text-[var(--text-secondary)] truncate flex-1">
              {entry.title}
            </span>
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              {entry.start_time}
            </span>
          </div>
        ))}
        {todaySchedule.length === 0 && (
          <p className="text-[11px] text-[var(--text-muted)]">No events today</p>
        )}
      </div>
    </div>
  );
}

// ── Insights Summary ──
export function InsightsSummary() {
  const ctx = useDashboardDataContext();
  const navigate = useNavigate();
  const topInsight = ctx.aiInsights?.[0];

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/insights')}>
      <div className="flex items-start gap-2">
        <Sparkles size={14} className="text-[var(--page-accent)] mt-0.5" />
        <div>
          {topInsight ? (
            <>
              <div className="text-[12px] text-[var(--text-secondary)] line-clamp-2">
                {topInsight.copy?.headline || topInsight.title || 'No insights yet'}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                {ctx.aiInsights.length} insight{ctx.aiInsights.length !== 1 ? 's' : ''} available
              </div>
            </>
          ) : (
            <p className="text-[11px] text-[var(--text-muted)]">Analyzing your patterns...</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Productivity Chart Summary ──
export function ProductivityChartSummary() {
  const ctx = useDashboardDataContext();
  const navigate = useNavigate();
  const data = ctx.weeklyHeatmap || [];
  const chartData = data.slice(-7);

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/stats')}>
      <StatValue value={`${data.length}d`} label="weekly trend" icon={TrendingUp} />
      <div className="h-36 w-full">
        <Bar
          data={{
            labels: chartData.map((d: any) => d.date ? new Date(d.date).toLocaleDateString('en', { weekday: 'narrow' }) : ''),
            datasets: [{
              label: 'Productive Hours',
              data: chartData.map((d: any) => d.productiveHours || 0),
              backgroundColor: 'rgba(139, 92, 246, 0.6)',
              borderColor: '#8b5cf6',
              borderWidth: 1,
              borderRadius: 4,
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { display: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af', font: { size: 9 } } },
              y: { display: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
            },
          }}
        />
      </div>
    </div>
  );
}

// ── Status Band Summary ──
export function StatusBandSummary() {
  const ctx = useDashboardDataContext();

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${
          ctx.isCurrentlyProductive ? 'bg-[var(--success)]' :
          ctx.isDistracting ? 'bg-[var(--warning)]' : 'bg-[var(--text-muted)]'
        }`} />
        <div className="flex-1">
          <div className="font-display text-[22px] font-bold leading-none text-[var(--text-primary)]">
            {formatTime(ctx.displayTimeMs)}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {ctx.currentAppName || 'No app detected'}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-muted)]">Productivity</span>
        <span className="text-[13px] font-mono font-semibold text-[var(--page-accent)]">
          {ctx.productivityScore}/100
        </span>
      </div>
      <ProgressBar value={ctx.productivityScore} />
    </div>
  );
}

// ── Follow Through Summary ──
export function FollowThroughSummary() {
  const ctx = useDashboardDataContext();
  const navigate = useNavigate();

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/finance')}>
      <StatValue value={`${ctx.dashboardCurrency} ${ctx.ftData?.totalExpense?.toFixed(2) || '0.00'}`} label="tracked expenses" icon={ArrowRight} accent="var(--success)" />
      {ctx.ftData?.breakdown && (
        <div className="text-[11px] text-[var(--text-muted)]">
          {ctx.ftData.breakdown.length} categories
        </div>
      )}
    </div>
  );
}

// ── Calendar Summary ──
export function CalendarSummary() {
  const navigate = useNavigate();
  const today = new Date();

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/settings')}>
      <div className="text-center">
        <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
          {today.toLocaleDateString('en', { weekday: 'long' })}
        </div>
        <div className="font-display text-[28px] font-bold leading-none text-[var(--text-primary)]">
          {today.getDate()}
        </div>
        <div className="text-[11px] text-[var(--text-muted)]">
          {today.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

// ── Pinned Activities Summary ──
export function PinnedActivitiesSummary() {
  const navigate = useNavigate();

  return (
    <div className="cursor-pointer space-y-3" onClick={() => navigate('/external')}>
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {['Coding', 'Reading', 'Exercise'].map((name, i) => (
          <div
            key={i}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--page-accent)]/30 transition-colors"
          >
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Usage Summary ──
export function AiUsageSummary() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const api = (window as any).deskflowAPI;

  useEffect(() => {
    (async () => {
      try {
        const s = await api?.aiContextStats?.();
        setStats(s || null);
      } catch { setError(true); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-3">
      {loading && <AiUsageSkeleton />}
      {error && (
        <div className="flex items-center gap-2 text-[var(--error)] text-[13px]">
          <AlertCircle size={14} /><span>AI stats unavailable</span>
        </div>
      )}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <StatValue value={stats.sessionCount ?? '—'} label="Sessions" icon={Bot} accent="var(--accent-primary)" />
          <StatValue value={stats.totalTokens ? (stats.totalTokens / 1e6).toFixed(1) + 'M' : '—'} label="Tokens" icon={Activity} accent="var(--accent-primary)" />
          <div className="col-span-2 mt-1">
            <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1.5">Top Models</div>
            {(stats.models || []).slice(0, 5).map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <span className="text-[12px] text-[var(--text-secondary)]">{m.name}</span>
                <span className="text-[12px] font-mono text-[var(--text-muted)]">{(m.tokens / 1e6).toFixed(1)}M</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AiUsageSkeleton() {
  return <div className="space-y-2"><div className="h-8 w-full rounded bg-[var(--border-subtle)]" /><div className="h-8 w-3/4 rounded bg-[var(--border-subtle)]" /></div>;
}

// ── Console Summary ──
export function ConsoleSummary() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[var(--error)] text-[13px]">
        <Lock size={14} /><span>Terminal stats not yet connected</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-[var(--border-subtle)] p-3 text-center">
          <div className="font-display text-[22px] font-bold text-[var(--text-muted)]">—</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Commands</div>
        </div>
        <div className="rounded-lg bg-[var(--border-subtle)] p-3 text-center">
          <div className="font-display text-[22px] font-bold text-[var(--text-muted)]">—</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Sessions</div>
        </div>
      </div>
      <div className="text-[11px] text-[var(--text-muted)]">Connect via terminal IPC to enable</div>
    </div>
  );
}

// ── Finance Summary ──
export function FinanceSummary() {
  const { ftData } = useDashboardDataContext();
  const api = (window as any).deskflowAPI;
  const [homeData, setHomeData] = useState<any>(null);

  useEffect(() => {
    api?.getHomeSummary?.().then((r: any) => r?.success && setHomeData(r.data)).catch(() => {});
  }, []);

  const balance = homeData?.totalBalance ?? ftData?.totalExpense ?? null;
  const txnCount = homeData?.walletCount ?? 0;

  return (
    <div className="space-y-3">
      <StatValue value={balance != null ? `$${balance.toLocaleString()}` : '—'} label="Total Balance" icon={Wallet} accent="var(--resume-success)" />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-muted)]">Transactions</span>
        <span className="text-[22px] font-bold font-display text-[var(--text-primary)]">{txnCount}</span>
      </div>
      {homeData?.trends?.focus && (
        <div className="flex items-end gap-1 mt-1">
          {homeData.trends.focus.slice(-7).map((v: number, i: number) => (
            <div key={i} className="flex-1 bg-[var(--page-accent)]/20 rounded-t" style={{ height: Math.max(4, v * 2) }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Learn Summary ──
export function LearnSummary() {
  const { masteryMastered, masteryTotal } = useDashboardDataContext();
  const api = (window as any).deskflowAPI;
  const [homeData, setHomeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api?.getHomeSummary?.().then((r: any) => r?.success && setHomeData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const dueCount = homeData?.dueReviews ?? 0;
  const masteryPct = masteryTotal > 0 ? Math.round((masteryMastered / masteryTotal) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatValue value={dueCount} label="Due Reviews" icon={BookOpen} accent="var(--color-primary)" />
        <StatValue value={`${masteryPct}%`} label="Mastery" icon={Brain} accent="var(--color-primary)" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-muted)]">Streak</span>
        <span className="flex items-center gap-1 text-[13px] font-semibold text-[var(--text-primary)]">
          <Flame size={14} className="text-amber-400" /> Active
        </span>
      </div>
      {loading && <div className="h-2 rounded bg-[var(--border-subtle)]" />}
    </div>
  );
}

// ── Browser Summary ──
export function BrowserSummary() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const api = (window as any).deskflowAPI;

  useEffect(() => {
    (async () => {
      try {
        const s = await api?.getBrowserCategoryStats?.('week');
        setStats(s || null);
      } catch { setError(true); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="space-y-2"><div className="h-8 w-full rounded bg-[var(--border-subtle)]" /><div className="h-8 w-3/4 rounded bg-[var(--border-subtle)]" /></div>;
  if (error || !stats) return (
    <div className="flex items-center gap-2 text-[var(--error)] text-[13px]">
      <AlertCircle size={14} /><span>Browser stats unavailable</span>
    </div>
  );

  const topSites = (stats.topSites || stats.topDomains || []).slice(0, 3);
  const categories = Object.entries(stats.categories || {}).slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Top Sites</div>
      {topSites.map((s: any, i: number) => (
        <div key={i} className="flex items-center justify-between py-0.5">
          <span className="text-[12px] text-[var(--text-secondary)] truncate mr-2">{s.name || s.domain}</span>
          <span className="text-[12px] font-mono text-[var(--text-muted)] shrink-0">{s.minutes ?? s.time ?? '—'}m</span>
        </div>
      ))}
      <div className="mt-1 space-y-1">
        {categories.map(([cat, val]: [string, any], i: number) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-muted)] w-16 truncate">{cat}</span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, backgroundColor: 'var(--border-subtle)' }}>
              <motion.div className="h-full rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat]?.text || 'var(--page-accent)' }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (val?.percent ?? 0) * 100)}%` }} transition={{ duration: 0.3 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Brain Summary ──
export function BrainSummary() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const api = (window as any).deskflowAPI;

  useEffect(() => {
    (async () => {
      try {
        const s = await api?.aiContextStats?.();
        setStats(s || null);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="space-y-2"><div className="h-8 w-full rounded bg-[var(--border-subtle)]" /><div className="h-8 w-3/4 rounded bg-[var(--border-subtle)]" /></div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatValue value={stats?.nodeCount ?? stats?.nodes?.length ?? '—'} label="Nodes" icon={Brain} accent="var(--resume-info)" />
        <StatValue value={stats?.retrievalsToday ?? '—'} label="Retrievals" icon={Activity} accent="var(--resume-info)" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-muted)]">Connections</span>
        <span className="text-[13px] font-mono font-bold text-[var(--text-primary)]">{stats?.connectionDensity ?? '—'}</span>
      </div>
    </div>
  );
}

// ── Covenant Summary ──
export function CovenantSummary() {
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const api = (window as any).deskflowAPI;

  useEffect(() => {
    (async () => {
      try {
        const r = await api?.getCovenantStats?.();
        setActive(r?.active ?? 0);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-3">
      {loading && <div className="h-8 w-full rounded bg-[var(--border-subtle)]" />}
      {!loading && (
        <>
          <StatValue value={active} label="Active" icon={Target} accent="var(--resume-warning)" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-muted)]">Completion</span>
            <span className="text-[13px] font-mono font-bold text-[var(--text-primary)]">{active > 0 ? 'In Progress' : 'None'}</span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">Connect via covenant IPC to enable</div>
        </>
      )}
    </div>
  );
}

// ── Health Summary ──
export function HealthSummary() {
  const { sleepData, avgSleep } = useDashboardDataContext();
  const api = (window as any).deskflowAPI;
  const [homeData, setHomeData] = useState<any>(null);

  useEffect(() => {
    api?.getHomeSummary?.().then((r: any) => r?.success && setHomeData(r.data)).catch(() => {});
  }, []);

  const lastNightHours = sleepData?.[0]?.hours ?? homeData?.sleepSeconds ? Math.round(homeData.sleepSeconds / 3600) : null;
  const consistency = avgSleep ? Math.round((1 - Math.abs(avgSleep - 8) / 8) * 100) : 0;
  const gapCount = (sleepData?.[0]?.hours ? 0 : 1);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatValue value={lastNightHours ?? '—'} label="Last Night" icon={Moon} accent="var(--resume-success)" />
        <StatValue value={`${consistency}%`} label="Consistency" icon={Check} accent="var(--resume-success)" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-muted)]">Sleep Gaps</span>
        <span className="text-[13px] font-bold font-display text-[var(--text-primary)]">{gapCount}</span>
      </div>
      {homeData?.trends?.focus && (
        <div className="flex items-end gap-0.5 mt-1">
          {[6, 5, 4, 3, 2, 1, 0].map((_, i) => {
            const day = sleepData?.[i]?.hours ?? 0;
            return <div key={i} className="flex-1 rounded-t" style={{ height: Math.max(2, (day ?? 0) * 3), backgroundColor: day > 0 ? 'var(--resume-success)' : 'var(--border-subtle)', opacity: 0.7 }} />;
          })}
        </div>
      )}
    </div>
  );
}
