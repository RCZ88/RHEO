import * as React from "react";
// ============================================================
// RHEO Dashboard — Widget Summary Components
// Rich, compact card views using real shadcn Progress/Badge
// LAMINAR: design.md wins over all skill defaults
// ============================================================

import { useNavigate } from 'react-router-dom';
import { motion } from "motion/react";
import { Bar } from 'react-chartjs-2';
import {
  AlertCircle, Clock, Target, Zap, BarChart3, Moon, Brain,
  Flame, TrendingUp, Calendar, Sparkles, ArrowRight, Check,
} from 'lucide-react';
import { useDashboardDataContext } from './DashboardContext';

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
