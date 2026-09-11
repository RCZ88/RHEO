import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Circle, CheckCircle2, Undo2, MoreVertical, Pencil, Archive } from 'lucide-react';
import type { Commitment, DayCompletion, StreakStats } from './types';
import { WARM_COLORS } from './covenantColors';
import { StreakFlame } from './StreakFlame';
import { TotalPracticeStat } from './TotalPracticeStat';
import { JournalDrawer } from './JournalDrawer';
import { nextMilestone } from './streak';
import { todayStr } from './storage';

export function buildRecentDates(c: Commitment, completions: DayCompletion[]): string[] {
  return completions.filter(x => x.commitmentId === c.id).map(x => x.date).sort();
}

interface CommitmentCardProps {
  commitment: Commitment;
  stats: StreakStats;
  isDoneToday: boolean;
  hasJournalToday: boolean;
  onToggleToday: (requireJournalFirst: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  recentDates: string[];
}

export function CommitmentCard({ commitment, stats, isDoneToday, hasJournalToday, onToggleToday, onEdit, onDelete, recentDates }: CommitmentCardProps) {
  const c = WARM_COLORS[commitment.color];
  const reduce = useReducedMotion();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const next = useMemo(() => nextMilestone(stats.totalCompletions), [stats.totalCompletions]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);
  const hasTarget = commitment.targetDays && commitment.targetDays > 0;
  const targetProgress = hasTarget ? Math.min(1, stats.totalCompletions / commitment.targetDays!) : 1;
  const needsJournal = commitment.requireJournal && !hasJournalToday;

  const handleToggle = () => {
    if (needsJournal && !isDoneToday) {
      setDrawerOpen(true);
      return;
    }
    onToggleToday(false);
  };

  const handleJournalSaved = () => {
    onToggleToday(true);
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
      setMenuOpen(false);
    } else {
      setConfirmDelete(true);
    }
  };

  return (
    <motion.div
      className="relative rounded-xl p-5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/50 overflow-hidden group hover:border-zinc-700/60 transition-colors duration-300"
      whileHover={reduce ? undefined : { y: -2 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <span
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full transition-all duration-300 group-hover:opacity-80"
        style={{ background: c.hex, opacity: 0.45 }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(100% 100% at 0% 0%, ${c.hex}08, transparent)` }}
      />
      <div className="relative z-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <StreakFlame streak={stats.current} color={commitment.color} size={48} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{commitment.name}</h3>
                {commitment.detection.enabled && (
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-medium border ${
                    commitment.detection.mode === 'avoidance'
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {commitment.detection.mode === 'avoidance' ? 'avoid' : 'auto'}
                  </span>
                )}
              </div>
              {commitment.description && (
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2">{commitment.description}</p>
              )}
              {commitment.detection.mode === 'avoidance' && hasTarget && (
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  {stats.totalCompletions} / {commitment.targetDays} days clear
                </p>
              )}
              {next && commitment.detection.mode !== 'avoidance' && (
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  {next} days &middot; <span className={c.text}>{next - stats.totalCompletions} more to go</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <motion.button
              onClick={handleToggle}
              whileTap={reduce ? undefined : { scale: 0.88 }}
              title={isDoneToday ? 'Undo completion' : needsJournal ? 'Write journal to confirm' : 'Mark complete'}
              className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                isDoneToday
                  ? 'bg-[#6fb38f] text-white shadow-sm shadow-[#6fb38f]/30'
                  : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200 border border-zinc-700/40'
              }`}
            >
              {isDoneToday ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Circle className="w-4.5 h-4.5" />}
            </motion.button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setMenuOpen(o => !o); setConfirmDelete(false); }}
                className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-50 w-36 rounded-lg bg-zinc-900 border border-zinc-700/60 shadow-xl shadow-black/30 overflow-hidden">
                  <button
                    onClick={() => { onEdit(); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-[12px] transition-colors ${
                      confirmDelete ? 'bg-red-500/20 text-red-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
                    }`}
                  >
                    <Archive className="w-3.5 h-3.5" /> {confirmDelete ? 'Confirm archive?' : 'Archive'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {(needsJournal || isDoneToday) && (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {needsJournal && !isDoneToday && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Journal required
              </span>
            )}
            {commitment.autoConfirmWhenClean && commitment.detection.mode === 'avoidance' && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Auto-confirm
              </span>
            )}
          </div>
        )}

        {hasTarget && (
          <div className="mt-3 h-1 rounded-full bg-zinc-800/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${targetProgress * 100}%`, background: c.hex }}
            />
          </div>
        )}

        <TotalPracticeStat stats={stats} />

        <button
          onClick={() => setDrawerOpen(o => !o)}
          className="mt-2 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {drawerOpen ? 'Close journal' : 'Journal entry'}
        </button>
        {drawerOpen && (
          <div className="mt-2">
            <JournalDrawer commitmentId={commitment.id} date={todayStr()} onSave={handleJournalSaved} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
