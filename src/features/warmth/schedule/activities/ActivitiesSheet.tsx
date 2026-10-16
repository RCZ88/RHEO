import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, RefreshCw, CalendarRange } from 'lucide-react';
import type { ScheduleActivitySeries, Semester, ActivityRange, ActivityView } from './ActivityTypes';
import { ActivitiesTimetable } from './ActivitiesTimetable';
import { ActivitiesList } from './ActivitiesList';
import { SemesterCard } from './SemesterCard';
import { ActivityForm, type Draft } from './ActivityForm';

const RANGE_LABEL: Record<ActivityRange, string> = {
  month: 'This month',
  semester: 'This semester',
  all: 'All',
};

export function ActivitiesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [series, setSeries] = useState<ScheduleActivitySeries[]>([]);
  const [semester, setSemester] = useState<Semester | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [range, setRange] = useState<ActivityRange>('month');
  const [view, setView] = useState<ActivityView>('timetable');
  const [showEnded, setShowEnded] = useState(false);
  const [showSemesterCard, setShowSemesterCard] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleActivitySeries | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const api = (window as any).deskflowAPI;

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await api?.scheduleActivityListSeries?.({
        range: range === 'semester' && !semester ? 'all' : range,
        includeArchived: showEnded,
        semesterStart: semester?.startDate,
        semesterEnd: semester?.endDate,
      });
      if (res?.success) setSeries(res.series || []);
      else setError(true);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [api, range, showEnded, semester]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const s = await api?.scheduleActivityGetSemester?.();
        if (s?.semester) setSemester(s.semester);
        else setShowSemesterCard(true);
      } catch { /* semester is optional */ }
    })();
    void load();
  }, [open, load]);

  useEffect(() => { if (open) void load(); }, [open, range, showEnded]);

  const saveDraft = async (d: Draft, addAnother: boolean) => {
    const sessions = d.sessions.flatMap(s => s.days.map(day => ({
      dayOfWeek: day, startTime: s.startTime, endTime: s.endTime, exceptions: [],
    })));
    if (editing?.seriesId) {
      await api?.scheduleActivityUpdateSeries?.(editing.seriesId, {
        title: d.title, category: d.category, sessions,
        startDate: d.startDate, endDate: d.endDate,
        location: d.location, instructor: d.instructor,
        linkedPhaseId: d.linkedPhaseId || null,
        linkedGoalIds: d.linkedGoalIds,
      });
      setToast(`Updated ${d.title}`);
    } else {
      await api?.scheduleActivityCreateSeries?.({
        title: d.title, category: d.category, sessions,
        startDate: d.startDate, endDate: d.endDate,
        location: d.location, instructor: d.instructor,
        linkedPhaseId: d.linkedPhaseId || null,
        linkedGoalIds: d.linkedGoalIds,
      });
      setToast(`Added ${d.title}`);
    }
    await load();
    if (addAnother) { setEditing(null); }
  };

  const saveSemester = async (s: Semester) => {
    await api?.scheduleActivitySetSemester?.(s);
    setSemester(s);
    setShowSemesterCard(false);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/50"
            />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              role="dialog" aria-label="Activities"
              className="fixed right-0 top-0 z-50 flex h-full w-[min(60vw,760px)] flex-col border-l border-zinc-800 bg-zinc-900/95 backdrop-blur-xl"
            >
              {/* header */}
              <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/60 p-3">
                <div className="flex gap-0.5 rounded-md border border-zinc-800 bg-zinc-900/60 p-0.5">
                  {(Object.keys(RANGE_LABEL) as ActivityRange[]).map(r => {
                    const disabled = r === 'semester' && !semester;
                    return (
                      <button
                        key={r} type="button" disabled={disabled}
                        onClick={() => setRange(r)}
                        title={disabled ? 'Set your semester dates to use this filter' : undefined}
                        aria-pressed={range === r}
                        className={`h-8 rounded px-2 text-[11px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          range === r ? 'bg-zinc-700/80 text-white' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >{RANGE_LABEL[r]}</button>
                    );
                  })}
                </div>

                <div className="flex gap-0.5 rounded-md border border-zinc-800 bg-zinc-900/60 p-0.5">
                  {(['timetable', 'list'] as ActivityView[]).map(v => (
                    <button
                      key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                      className={`h-8 rounded px-2 text-[11px] capitalize transition-colors ${
                        view === v ? 'bg-zinc-700/80 text-white' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >{v}</button>
                  ))}
                </div>

                <span className="flex-1" />

                <button
                  type="button" onClick={() => { setEditing(null); setFormOpen(true); }}
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-cyan-500/15 px-2.5 text-[11px] text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 min-h-[44px]"
                ><Plus size={12} /> Add</button>
                <button type="button" onClick={onClose} aria-label="Close activities"
                  className="p-2 rounded text-zinc-500 hover:text-zinc-200 min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <X size={14} />
                </button>
              </div>

              {/* body */}
              <div className="min-h-0 flex-1 overflow-auto ws-scroll p-3 space-y-3">
                {showSemesterCard && !semester && (
                  <SemesterCard onSet={saveSemester} onDismiss={() => setShowSemesterCard(false)} isFirstTime={series.length === 0} />
                )}

                {error ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-[12px] text-zinc-400">Couldn't load your activities.</p>
                    <button type="button" onClick={() => void load()}
                      className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 text-[11px] text-zinc-300 hover:border-zinc-600 min-h-[44px]">
                      <RefreshCw size={11} /> Retry
                    </button>
                  </div>
                ) : view === 'timetable' ? (
                  <ActivitiesTimetable series={series} loading={loading}
                    onOpen={s => { setEditing(s); setFormOpen(true); }} onError={() => setError(true)} />
                ) : (
                  <ActivitiesList series={series} loading={loading}
                    onOpen={s => { setEditing(s); setFormOpen(true); }} />
                )}

                <button
                  type="button" onClick={() => setShowEnded(v => !v)} aria-pressed={showEnded}
                  className="mx-auto flex h-8 items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 min-h-[44px]"
                >
                  <CalendarRange size={11} /> {showEnded ? 'Hide ended' : 'Show ended'}
                </button>
              </div>

              {toast && (
                <div className="shrink-0 border-t border-zinc-800/60 p-2 text-[11px] text-cyan-300">{toast}</div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ActivityForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        editing={editing}
        semester={semester}
        allSeries={series}
        onSave={(d) => saveDraft(d, false)}
        onSaveAndAddAnother={(d) => saveDraft(d, true)}
      />
    </>
  );
}