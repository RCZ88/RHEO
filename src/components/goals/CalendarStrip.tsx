import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Goal } from '../../types/goals';

const CAT_COLORS: Record<string, string> = {
  work: '#ec4899', personal: '#8b5cf6', health: '#34d399',
  learning: '#22d3ee', finance: '#fbbf24', relationships: '#fb7185',
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === formatDate(new Date());
}

function getDaysAround(center: Date, range: number): { dateStr: string; dayName: string; dayNum: number; isToday: boolean }[] {
  const days: { dateStr: string; dayName: string; dayNum: number; isToday: boolean }[] = [];
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = -range; i <= range; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    const dateStr = formatDate(d);
    days.push({ dateStr, dayName: names[d.getDay()], dayNum: d.getDate(), isToday: isToday(dateStr) });
  }
  return days;
}

interface Dot { color: string; shape: 'circle' | 'diamond'; }

function getDotsForDate(dateStr: string, weekGoals?: Record<string, Goal[]>, marks?: Map<string, { color: string; label: string }[]>): Dot[] {
  const dots: Dot[] = [];
  const dayGoals = weekGoals?.[dateStr] || [];
  const categories = [...new Set(dayGoals.map(g => g.category))];
  categories.slice(0, 2).forEach(cat => { dots.push({ color: CAT_COLORS[cat] || '#6b7280', shape: 'circle' }); });
  const dayMarks = marks?.get(dateStr) || [];
  dayMarks.forEach(m => { if (dots.length < 3) dots.push({ color: m.color, shape: 'diamond' }); });
  return dots;
}

interface CalendarStripProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  goalDates?: Set<string>;
  marks?: Map<string, { color: string; label: string }[]>;
  weekGoals?: Record<string, Goal[]>;
}

const DAY_RANGE = 14;

export function CalendarStrip({ selectedDate, onDateChange, goalDates, marks, weekGoals }: CalendarStripProps) {
  const centerDate = useMemo(() => new Date(selectedDate + 'T00:00:00'), [selectedDate]);
  const days = useMemo(() => getDaysAround(centerDate, DAY_RANGE), [centerDate]);

  const shiftWeek = (delta: number) => {
    const d = new Date(centerDate);
    d.setDate(d.getDate() + delta * 7);
    onDateChange(formatDate(d));
  };

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => shiftWeek(-1)} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors shrink-0" aria-label="Previous week">
        <ChevronLeft size={16} />
      </button>
      <div className="flex-1 flex gap-1 overflow-x-auto">
        {days.map(({ dateStr, dayName, dayNum, isToday: today }) => {
          const selected = dateStr === selectedDate;
          const dots = getDotsForDate(dateStr, weekGoals, marks);
          return (
            <motion.button
              key={dateStr}
              onClick={() => onDateChange(dateStr)}
              whileTap={{ scale: 0.95 }}
              className={`flex flex-col items-center gap-0.5 py-2 px-2.5 rounded-xl min-w-[48px] transition-all duration-200 relative ${
                selected ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                  : today ? 'bg-zinc-800/40 text-zinc-300 border border-zinc-700/30'
                    : 'bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] text-zinc-500 border border-transparent hover:bg-zinc-800/30 hover:text-zinc-300'
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider">{dayName}</span>
              <span className={`text-[15px] font-semibold tabular-nums ${selected ? 'text-white' : ''}`}>{dayNum}</span>
              {dots.length > 0 && (
                <span className="flex gap-0.5 mt-0.5">
                  {dots.slice(0, 3).map((dot, i) => (
                    <span key={i} className={dot.shape === 'diamond' ? 'w-1 h-1 rotate-45' : 'w-1 h-1 rounded-full'} style={{ background: dot.color }} />
                  ))}
                </span>
              )}
              {today && !selected && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400" />}
            </motion.button>
          );
        })}
      </div>
      <button onClick={() => shiftWeek(1)} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors shrink-0" aria-label="Next week">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
