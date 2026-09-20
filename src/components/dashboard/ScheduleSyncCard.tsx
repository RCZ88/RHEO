import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Link2, Unlink } from 'lucide-react';
import { AnimatedShinyText } from '../ui/animated-shiny-text';
import type { ScheduleEntry, Goal } from './types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_COLORS: Record<string, string> = {
  class: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  lab: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  study: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  exam: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  meeting: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  other: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

interface ScheduleSyncCardProps {
  schedule: ScheduleEntry[];
  goals: Goal[];
  loading?: boolean;
}

export function ScheduleSyncCard({ schedule, goals, loading = false }: ScheduleSyncCardProps) {
  const today = new Date().getDay();

  const todaySchedule = useMemo(() =>
    schedule.filter(s => s.day_of_week === today).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [schedule, today]
  );

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const getBlockStatus = (entry: ScheduleEntry) => {
    const [sh, sm] = entry.start_time.split(':').map(Number);
    const [eh, em] = entry.end_time.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (nowMinutes >= startMin && nowMinutes < endMin) return 'active';
    if (nowMinutes >= endMin) return 'past';
    return 'upcoming';
  };

  const linkedGoalCount = useMemo(() => {
    const scheduleIds = new Set(todaySchedule.map(s => s.id));
    return goals.filter(g => g.linkedScheduleId && scheduleIds.has(g.linkedScheduleId)).length;
  }, [todaySchedule, goals]);

  if (loading) {
    return (
      <div className="relative rounded-xl overflow-hidden  p-5 min-h-[200px]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-sky-500/30 via-sky-500/10 to-transparent" />
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-zinc-800 rounded w-1/3" />
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-zinc-800/30 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden  p-5 min-h-[200px] flex flex-col">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-sky-500/30 via-sky-500/10 to-transparent" />

      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <Clock size={12} className="text-sky-400" />
          </div>
          <AnimatedShinyText className="text-[13px] font-semibold" gradientFrom="#0ea5e9" gradientTo="#38bdf8">
            {DAY_NAMES[today]}&apos;s Schedule
          </AnimatedShinyText>
        </div>
        {linkedGoalCount > 0 && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 font-mono tabular-nums">
            <Link2 size={9} /> {linkedGoalCount} linked
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
        {todaySchedule.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Clock size={16} className="text-zinc-700 mb-1.5" />
            <p className="text-[12px] text-zinc-600 font-sans">Nothing scheduled today</p>
          </div>
        ) : (
          todaySchedule.map((entry) => {
            const status = getBlockStatus(entry);
            const isLinked = goals.some(g => g.linkedScheduleId === entry.id);
            const categoryColor = CATEGORY_COLORS[entry.category || 'other'] || CATEGORY_COLORS.other;

            return (
              <motion.div key={entry.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all duration-150 ${
                  status === 'active' ? 'bg-sky-500/[0.06] border-sky-500/20' : status === 'past' ? 'bg-zinc-900/20 border-zinc-800/30 opacity-50' : 'bg-zinc-900/30 border-zinc-800/30 hover:border-zinc-700/40'
                }`}>
                <div className="w-16 text-right shrink-0">
                  <p className="font-mono text-[11px] font-semibold text-zinc-400 tabular-nums">{entry.start_time}</p>
                  <p className="font-mono text-[10px] text-zinc-600 tabular-nums">{entry.end_time}</p>
                </div>
                <div className="w-px h-8 shrink-0" style={{ background: status === 'active' ? 'rgba(56, 189, 248, 0.5)' : 'rgba(63, 63, 70, 0.5)' }} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-medium truncate font-sans ${status === 'active' ? 'text-sky-200' : 'text-zinc-300'}`}>{entry.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[9px] px-1 py-0 rounded ${categoryColor}`}>{entry.category || 'other'}</span>
                    {entry.location && <span className="text-[9px] text-zinc-600 truncate font-sans">{entry.location}</span>}
                  </div>
                </div>
                <div className="shrink-0">
                  {isLinked ? <Link2 size={10} className="text-emerald-400/70" /> : <Unlink size={10} className="text-zinc-700" />}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
