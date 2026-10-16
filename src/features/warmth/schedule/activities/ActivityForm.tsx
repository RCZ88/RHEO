import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Trash2, AlertTriangle, ChevronDown } from 'lucide-react';
import type { ScheduleActivitySeries, ScheduleSession, Semester } from './ActivityTypes';
import { CATEGORY_LABEL } from './ActivitiesTimetable';

const DAYS = [
  { idx: 1, label: 'M' }, { idx: 2, label: 'T' }, { idx: 3, label: 'W' },
  { idx: 4, label: 'T' }, { idx: 5, label: 'F' }, { idx: 6, label: 'S' }, { idx: 0, label: 'S' },
];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CATEGORIES = ['class', 'club', 'sport', 'other'] as const;

interface Draft {
  seriesId?: string;
  title: string;
  category: 'class' | 'club' | 'sport' | 'other';
  sessions: Array<{ days: number[]; startTime: string; endTime: string }>;
  startDate: string;
  endDate: string;
  location: string;
  instructor: string;
  linkedPhaseId: string;
  linkedGoalIds: string[];
  notes: string;
}

const emptySession = () => ({ days: [1], startTime: '09:00', endTime: '10:00' });

/* Local-clock YYYY-MM-DD. `toISOString()` is UTC and off-by-one for hours each
   day at UTC+7, so the "next occurrence" preview would jump a day. */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtShort = (d: Date) => `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;

/** Next N occurrences across all sessions. Pure — takes the draft, no IPC, so
    the preview updates on every keystroke without a round trip. */
function nextOccurrences(draft: Draft, count = 3): string[] {
  const out: string[] = [];
  const start = draft.startDate ? new Date(draft.startDate + 'T00:00:00') : new Date();
  const end = draft.endDate ? new Date(draft.endDate + 'T23:59:59') : null;
  if (Number.isNaN(start.getTime())) return [];
  const cursor = new Date(start);
  /* 21 days covers the next 3 weekly occurrences including every selected day. */
  for (let i = 0; i < 21 && out.length < count; i++) {
    const dow = cursor.getDay();
    for (const s of draft.sessions) {
      if (out.length >= count) break;
      if (!s.days.includes(dow)) continue;
      if (end && cursor > end) break;
      if (s.startTime && s.endTime && s.endTime <= s.startTime) continue;
      out.push(fmtShort(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Overlap check — advisory only, never blocks the save (spec §5). */
function findOverlaps(draft: Draft, all: ScheduleActivitySeries[], selfId?: string): string[] {
  const toMin = (t: string) => {
    const [h, m] = String(t || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const mine = draft.sessions.flatMap(s => s.days.map(d => ({ ...s, d })));
  const out: string[] = [];
  for (const other of all) {
    if (other.seriesId === selfId) continue;
    for (const o of other.sessions) {
      for (const m of mine) {
        if (m.d !== o.dayOfWeek) continue;
        if (toMin(m.startTime) < toMin(o.endTime) && toMin(o.startTime) < toMin(m.endTime)) {
          out.push(`${other.title}, ${DAY_SHORT[o.dayOfWeek]} ${o.startTime}`);
          break;
        }
      }
    }
  }
  return [...new Set(out)];
}

export function ActivityForm({
  open, onClose, editing, semester, allSeries, onSave, onSaveAndAddAnother,
}: {
  open: boolean;
  onClose: () => void;
  editing?: ScheduleActivitySeries | null;
  semester?: Semester | null;
  allSeries: ScheduleActivitySeries[];
  onSave: (d: Draft) => Promise<void>;
  onSaveAndAddAnother: (d: Draft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    title: '', category: 'class', sessions: [emptySession()],
    startDate: semester?.startDate ?? iso(new Date()),
    endDate: semester?.endDate ?? '',
    location: '', instructor: '', linkedPhaseId: '', linkedGoalIds: [], notes: '',
  }));
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const initialRef = useRef(JSON.stringify(draft));

  /* Re-seed when the form opens, or when editing a different series. */
  useEffect(() => {
    if (!open) return;
    const seeded: Draft = editing ? {
      seriesId: editing.seriesId,
      title: editing.title,
      category: editing.category,
      /* Collapse sessions that share days into draft rows. */
      sessions: editing.sessions.map(s => ({ days: [s.dayOfWeek], startTime: s.startTime, endTime: s.endTime })),
      startDate: editing.startDate ?? semester?.startDate ?? iso(new Date()),
      endDate: editing.endDate ?? semester?.endDate ?? '',
      location: editing.location ?? '',
      instructor: editing.instructor ?? '',
      linkedPhaseId: editing.linkedPhaseId ?? '',
      linkedGoalIds: editing.linkedGoalIds ?? [],
      notes: '',
    } : {
      title: '', category: 'class', sessions: [emptySession()],
      startDate: semester?.startDate ?? iso(new Date()),
      endDate: semester?.endDate ?? '',
      location: '', instructor: '', linkedPhaseId: '', linkedGoalIds: [], notes: '',
    };
    setDraft(seeded);
    setError(null);
    setMoreOpen(false);
    setTouched(false);
    initialRef.current = JSON.stringify(seeded);
  }, [open, editing, semester]);

  const preview = useMemo(() => nextOccurrences(draft), [draft]);
  const overlaps = useMemo(() => findOverlaps(draft, allSeries, editing?.seriesId), [draft, allSeries, editing?.seriesId]);
  const dirty = JSON.stringify(draft) !== initialRef.current;

  const validate = () => {
    if (!draft.title.trim()) return 'Give it a name.';
    if (!draft.sessions.length) return 'Add at least one time.';
    for (const s of draft.sessions) {
      if (!s.days.length) return 'Pick at least one day for each time.';
      if (s.endTime <= s.startTime) return 'End time must be after start time.';
    }
    if (draft.endDate && draft.startDate && draft.endDate < draft.startDate) {
      return 'End date must be after the start date.';
    }
    return null;
  };

  /* Enter saves, but never from inside a textarea where Enter means newline. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (dirty && !window.confirm('You have unsaved changes. Close anyway?')) return;
      onClose();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(false); }
  };

  const submit = async (addAnother: boolean) => {
    const v = validate();
    if (v) { setError(v); return; }            // form is NOT cleared on error
    setError(null); setSaving(true);
    try {
      if (addAnother) {
        await onSaveAndAddAnother(draft);
        const next: Draft = { ...draft, title: '' };   // keep type + dates + times
        setDraft(next);
        initialRef.current = JSON.stringify(next);
        setTouched(false);
      } else {
        await onSave(draft);
        onClose();
      }
    } catch (e: any) {
      setError(e?.message || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const setSession = (i: number, patch: Partial<Draft['sessions'][number]>) => {
    setTouched(true);
    setDraft(d => ({ ...d, sessions: d.sessions.map((s, idx) => idx === i ? { ...s, ...patch } : s) }));
  };

  const toggleDay = (i: number, day: number) => {
    const cur = draft.sessions[i].days;
    setSession(i, { days: cur.includes(day) ? cur.filter(x => x !== day) : [...cur, day].sort() });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/60" onClick={() => {
        if (dirty && !window.confirm('You have unsaved changes. Close anyway?')) return;
        onClose();
      }} />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit activity' : 'Add activity'}
        className="relative w-full max-w-lg max-h-[90vh] overflow-auto ws-scroll rounded-xl border border-zinc-700 bg-zinc-900/95 backdrop-blur-xl p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-semibold text-zinc-200">
            {editing ? 'Edit activity' : 'Add activity'}
          </h2>
          <button type="button" onClick={() => {
            if (dirty && !window.confirm('You have unsaved changes. Close anyway?')) return;
            onClose();
          }} aria-label="Close" className="p-1 rounded text-zinc-500 hover:text-zinc-200 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3">
          {/* title */}
          <input
            value={draft.title}
            onChange={e => { setTouched(true); setDraft(d => ({ ...d, title: e.target.value })); }}
            placeholder="e.g. Advanced Algorithms"
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 text-[12px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-cyan-500/50 min-h-[44px]"
          />

          {/* type chips — label always shown, never colour alone */}
          <div className="flex gap-1.5">
            {CATEGORIES.map(c => (
              <button
                key={c} type="button"
                onClick={() => { setTouched(true); setDraft(d => ({ ...d, category: c })); }}
                aria-pressed={draft.category === c}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] border transition-colors min-h-[44px] ${
                  draft.category === c ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'text-zinc-500 border-zinc-700/50 hover:text-zinc-300'
                }`}
              >{CATEGORY_LABEL[c]}</button>
            ))}
          </div>

          {/* sessions */}
          {draft.sessions.map((s, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-zinc-800/60 p-2.5">
              <div className="flex items-center gap-1">
                {DAYS.map(d => {
                  const on = s.days.includes(d.idx);
                  return (
                    <button
                      key={d.idx} type="button"
                      onClick={() => toggleDay(i, d.idx)}
                      aria-pressed={on}
                      aria-label={DAY_SHORT[d.idx]}
                      className={`w-9 h-9 rounded-lg text-[11px] border transition-colors ${
                        on ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'text-zinc-500 border-zinc-700/50 hover:text-zinc-300'
                      }`}
                    >{d.label}</button>
                  );
                })}
                {draft.sessions.length > 1 && (
                  <button
                    type="button" onClick={() => { setTouched(true); setDraft(d => ({ ...d, sessions: d.sessions.filter((_, x) => x !== i) })); }}
                    aria-label="Remove this time" className="ml-auto p-2 text-zinc-600 hover:text-red-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  ><Trash2 size={12} /></button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="time" value={s.startTime}
                  onChange={e => setSession(i, { startTime: e.target.value })}
                  className="px-2 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-[11px] text-zinc-200 outline-none focus:border-cyan-500/50 min-h-[44px]"
                />
                <span className="text-zinc-600 text-[11px]">to</span>
                <input
                  type="time" value={s.endTime}
                  onChange={e => setSession(i, { endTime: e.target.value })}
                  className="px-2 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-[11px] text-zinc-200 outline-none focus:border-cyan-500/50 min-h-[44px]"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => { setTouched(true); setDraft(d => ({ ...d, sessions: [...d.sessions, emptySession()] })); }}
            className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 min-h-[44px]"
          ><Plus size={12} /> Add another time</button>

          {/* live next occurrences */}
          {preview.length > 0 && (
            <p className="text-[10px] text-zinc-500">Next: {preview.join(', ')}</p>
          )}

          {/* runs line */}
          <button
            type="button"
            onClick={() => setMoreOpen(o => !o)}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 min-h-[44px] flex items-center gap-1"
          >
            <ChevronDown size={12} className={moreOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            Runs: {draft.startDate} to {draft.endDate || 'ongoing'}{semester ? ' (semester)' : ''}
          </button>

          {/* more details — progressive disclosure */}
          <AnimatePresence initial={false}>
            {moreOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={draft.startDate} onChange={e => { setTouched(true); setDraft(d => ({ ...d, startDate: e.target.value })); }}
                    className="px-2 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-[11px] text-zinc-200 outline-none min-h-[44px]" />
                  <input type="date" value={draft.endDate} onChange={e => { setTouched(true); setDraft(d => ({ ...d, endDate: e.target.value })); }}
                    className="px-2 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-[11px] text-zinc-200 outline-none min-h-[44px]" />
                </div>
                <input value={draft.location} onChange={e => { setTouched(true); setDraft(d => ({ ...d, location: e.target.value })); }}
                  placeholder="Place" className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none min-h-[44px]" />
                <input value={draft.instructor} onChange={e => { setTouched(true); setDraft(d => ({ ...d, instructor: e.target.value })); }}
                  placeholder="Teacher or coach" className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none min-h-[44px]" />
                <textarea value={draft.notes} onChange={e => { setTouched(true); setDraft(d => ({ ...d, notes: e.target.value })); }}
                  placeholder="Notes" rows={2} className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* overlap warning — advisory, never blocks (spec §5) */}
          {overlaps.length > 0 && (
            <p className="flex items-start gap-1.5 text-[10px] text-amber-400">
              <AlertTriangle size={11} className="shrink-0 mt-0.5" />
              <span>Overlaps: {overlaps.join('; ')}</span>
            </p>
          )}

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button" onClick={() => submit(true)} disabled={saving}
              className="px-3 py-2 rounded-lg text-[11px] border border-zinc-700 text-zinc-400 hover:text-zinc-200 min-h-[44px] disabled:opacity-40"
            >Save and add another</button>
            <button
              type="button" onClick={() => submit(false)} disabled={saving}
              className="px-3 py-2 rounded-lg text-[11px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 min-h-[44px] disabled:opacity-40"
            >{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export type { Draft };