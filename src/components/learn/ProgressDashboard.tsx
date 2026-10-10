import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Brain, MessageSquare, TrendingUp, Flame, StickyNote, Loader2, Sparkles } from 'lucide-react';
import { HeatmapBlock } from './blocks/HeatmapBlock';
import { BlurFade } from '../ui/blur-fade';
import { springy } from './motion';

const api = (window as any).deskflowAPI;

interface HeatmapCell {
  date: string;
  value: number;
  details: { nodesStudied: number; quizzesTaken: number; cardsReviewed: number; masteryGain: number };
}

interface DashboardData {
  total_answers: number;
  total_questions: number;
  avg_confidence: number;
  recent_notes: any[];
  open_proposals: any[];
  active_conversations: number;
  streak_days: number;
  top_nodes: { node_id: string; title: string; count: number }[];
}

function LedgerCard({ icon, label, value, accent, delay }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
  delay: number;
}) {
  return (
    <BlurFade delay={delay}>
      <motion.div
        whileHover={{ y: -2 }}
        transition={springy}
        className="rounded-xl border border-zinc-800 bg-[#1c1917] shadow-inner p-5 relative overflow-hidden"
      >
        {/* Inner glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        <div className="relative flex items-start gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-zinc-500 mb-1">{label}</p>
            <p className="text-2xl font-serif font-semibold text-zinc-100 leading-none">{value}</p>
          </div>
        </div>
      </motion.div>
    </BlurFade>
  );
}

interface ProgressDashboardProps {
  embedded?: boolean;
}

export function ProgressDashboard({ embedded = false }: ProgressDashboardProps) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashResult, heatResult] = await Promise.all([
        api.learnGetTutorDashboard(),
        api.learnGetStudyHeatmap({ days: 90 }),
      ]);
      if (dashResult.ok) setDashboard(dashResult.data);
      if (heatResult.ok) setHeatmap(heatResult.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (embedded) {
    return (
      <div className="space-y-4">
        <HeatmapBlock
          data={heatmap}
          meta={{ date_range: 'last_90_days', cell_size: 13 }}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <LedgerCard
            icon={<BookOpen className="w-5 h-5 text-amber-400" />}
            label="Cards Due"
            value={dashboard?.total_answers ?? 0}
            accent="bg-amber-500/10"
            delay={0.12}
          />
          <LedgerCard
            icon={<MessageSquare className="w-5 h-5 text-sky-400" />}
            label="Q&A Total"
            value={dashboard?.total_questions ?? 0}
            accent="bg-sky-500/10"
            delay={0.16}
          />
          <LedgerCard
            icon={<Flame className="w-5 h-5 text-clay-400" />}
            label="Day Streak"
            value={dashboard?.streak_days ?? 0}
            accent="bg-clay-500/10"
            delay={0.20}
          />
          <LedgerCard
            icon={<TrendingUp className="w-5 h-5 text-sage-400" />}
            label="Avg Confidence"
            value={`${Math.round((dashboard?.avg_confidence ?? 0) * 100)}%`}
            accent="bg-sage-400/10"
            delay={0.24}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-medium text-zinc-200">Active Learning</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Active conversations</span>
                <span className="text-zinc-300 font-medium">{dashboard?.active_conversations ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Open proposals</span>
                <span className="text-zinc-300 font-medium">{dashboard?.open_proposals?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Notes taken</span>
                <span className="text-zinc-300 font-medium">{dashboard?.recent_notes?.length ?? 0}</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-medium text-zinc-200">Most Studied</h3>
            </div>
            {dashboard?.top_nodes && dashboard.top_nodes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dashboard.top_nodes.slice(0, 6).map((node) => (
                  <span
                    key={node.node_id}
                    className="px-2.5 py-1 rounded-full bg-zinc-800/60 border border-zinc-700/40 text-[11px] text-zinc-300"
                  >
                    {node.title} ({node.count})
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-600">No study data yet.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <BlurFade inView>
        <header className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-400 mb-1">Scholar's Ledger</p>
          <h2 className="font-serif text-3xl font-semibold text-glow">Your Progress</h2>
          <p className="text-sm text-zinc-500 mt-1">Study analytics, streaks, and mastery overview.</p>
        </header>
      </BlurFade>

      {/* Heatmap */}
      <BlurFade delay={0.08}>
        <div className="mb-8">
          <HeatmapBlock
            data={heatmap}
            meta={{ date_range: 'last_90_days', cell_size: 13 }}
          />
        </div>
      </BlurFade>

      {/* Ledger Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <LedgerCard
          icon={<BookOpen className="w-5 h-5 text-amber-400" />}
          label="Cards Due"
          value={dashboard?.total_answers ?? 0}
          accent="bg-amber-500/10"
          delay={0.12}
        />
        <LedgerCard
          icon={<MessageSquare className="w-5 h-5 text-sky-400" />}
          label="Q&A Total"
          value={dashboard?.total_questions ?? 0}
          accent="bg-sky-500/10"
          delay={0.16}
        />
        <LedgerCard
          icon={<Flame className="w-5 h-5 text-clay-400" />}
          label="Day Streak"
          value={dashboard?.streak_days ?? 0}
          accent="bg-clay-500/10"
          delay={0.20}
        />
        <LedgerCard
          icon={<TrendingUp className="w-5 h-5 text-sage-400" />}
          label="Avg Confidence"
          value={`${Math.round((dashboard?.avg_confidence ?? 0) * 100)}%`}
          accent="bg-sage-400/10"
          delay={0.24}
        />
      </div>

      {/* Bottom row: Active conversations + Top nodes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BlurFade delay={0.28}>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-medium text-zinc-200">Active Learning</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Active conversations</span>
                <span className="text-zinc-300 font-medium">{dashboard?.active_conversations ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Open proposals</span>
                <span className="text-zinc-300 font-medium">{dashboard?.open_proposals?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Notes taken</span>
                <span className="text-zinc-300 font-medium">{dashboard?.recent_notes?.length ?? 0}</span>
              </div>
            </div>
          </div>
        </BlurFade>

        <BlurFade delay={0.32}>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-medium text-zinc-200">Most Studied</h3>
            </div>
            {dashboard?.top_nodes && dashboard.top_nodes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dashboard.top_nodes.slice(0, 6).map((node) => (
                  <span
                    key={node.node_id}
                    className="px-2.5 py-1 rounded-full bg-zinc-800/60 border border-zinc-700/40 text-[11px] text-zinc-300"
                  >
                    {node.title} ({node.count})
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-600">No study data yet.</p>
            )}
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
