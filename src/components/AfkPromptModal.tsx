import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { stopwatch } from '../lib/stopwatchStore';
import { Activity, AlertCircle, BookOpen, Brain, Check, ChevronDown, Clock, Coffee, Dumbbell, Loader2, Lock, Minus, Moon, Plus, Sparkles, Sun, Tv, Unlock, X } from 'lucide-react';

interface ExternalActivity {
  id: number;
  name: string;
  type: string;
  color: string;
  icon: string;
}

interface Segment {
  id: number;
  activityId: string | null;
  durationSeconds: number;
  /**
   * A locked slot keeps its exact duration. Adding or removing a slot
   * redistributes the gap again, and that used to overwrite EVERY duration, so a
   * carefully built 30m/45m split collapsed back to even shares the moment you
   * added a third slot. Locking pins the slots you have already decided and lets
   * the remainder be shared out around them.
   */
  locked?: boolean;
}

const ACTIVITY_ICONS: Record<string, typeof Moon> = {
  Moon, Sun, Brain, Coffee, Tv, BookOpen, Dumbbell, Sparkles,
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

export default function AfkPromptModal({
  allActivities,
  totalDurationSeconds,
  periodStart,
  periodEnd,
  idleStartMs,
  returnMs,
  queueRemaining,
  onConfirm,
  onDismiss,
  onNotAfk,
  defaultNotAfk,
  children,
  adjacentGaps = [],
  onFillGapRequest,
  filledGapStarts = [],
  onGapsDone,
}: {
  allActivities: ExternalActivity[];
  totalDurationSeconds: number;
  periodStart: string;
  periodEnd: string;
  idleStartMs: number | null;
  returnMs: number;
  queueRemaining: number;
  /** Resolves true only when the rows were actually written. */
  onConfirm: (segments: { activityId: string; startedAt: string; endedAt: string }[]) => boolean | Promise<boolean>;
  onDismiss: () => void;
  onNotAfk: () => void;
  defaultNotAfk?: boolean;
  children?: React.ReactNode;
  adjacentGaps?: Array<{ start: string; end: string; durationSeconds: number; relation: 'before' | 'after' }>;
  onFillGapRequest?: (gaps: Array<{ start: Date; end: Date; duration_seconds: number }>) => void;
  filledGapStarts?: string[];
  onGapsDone?: () => void;
}) {
  const visibleActivities = allActivities;
  const [showSegmentEditor, setShowSegmentEditor] = useState(!defaultNotAfk);
  const segCounter = useRef(1);
  const [segments, setSegments] = useState<Segment[]>(() => [{
    id: segCounter.current,
    activityId: null,
    durationSeconds: totalDurationSeconds,
  }]);
  const [pickingId, setPickingId] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const minPerSegment = 60;

  const [liveElapsed, setLiveElapsed] = useState(() => formatElapsed(totalDurationSeconds));
  useEffect(() => {
    if (!periodStart) return;
    const int = setInterval(() => {
      setLiveElapsed(formatElapsed(Math.floor((Date.now() - new Date(periodStart).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(int);
  }, [periodStart]);

  function onDividerMouseDown(idx: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const bar = barRef.current;
    if (!bar) return;

    // Arrow, not a `function` declaration: a hoisted declaration can be called
    // before the `if (!bar) return` above, so TypeScript conservatively discards
    // the narrowing and reports `bar` as possibly null inside the closure.
    const onMouseMove = (ev: MouseEvent) => {
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));

      setSegments(prev => {
        if (idx >= prev.length - 1) return prev;
        // A locked slot is pinned: dragging its edge would move it, so the drag
        // is refused rather than silently overwriting the lock.
        if (prev[idx]?.locked || prev[idx + 1]?.locked) return prev;
        const sumPrev = prev.slice(0, idx).reduce((s, seg) => s + seg.durationSeconds, 0);
        const pairTotal = prev[idx].durationSeconds + prev[idx + 1].durationSeconds;
        const midRaw = Math.round(pct * totalDurationSeconds - sumPrev);
        const clamped = Math.max(minPerSegment, Math.min(pairTotal - minPerSegment, midRaw));
        return prev.map((seg, i) => {
          if (i === idx) return { ...seg, durationSeconds: clamped };
          if (i === idx + 1) return { ...seg, durationSeconds: pairTotal - clamped };
          return seg;
        });
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Share `totalDurationSeconds` across `count` slots, leaving locked ones alone.
   *
   * Replaces the old `redistributeEven`, which recomputed every slot from
   * scratch and so silently discarded the user's split whenever the number of
   * slots changed. Locked durations are subtracted first and the remainder is
   * divided only among the unlocked slots, so pinning one slot never moves it.
   *
   * If the locks leave too little for a legal minimum on the rest, the locks are
   * trimmed from the end rather than emitting a negative or zero-length slot.
   */
  function redistribute(count: number, current: Segment[]): number[] {
    if (count === 0) return [];
    const lockedDurations = current.filter(s => s.locked).map(s => s.durationSeconds);
    const unlockedCount = count - lockedDurations.length;
    if (unlockedCount <= 0) {
      return [...lockedDurations, ...Array.from({ length: count - lockedDurations.length }, () => 0)];
    }

    let lockedTotal = lockedDurations.reduce((s, d) => s + d, 0);
    let unlockedTotal = totalDurationSeconds - lockedTotal;
    if (unlockedTotal < unlockedCount * minPerSegment) {
      let deficit = unlockedCount * minPerSegment - unlockedTotal;
      for (let i = lockedDurations.length - 1; i >= 0 && deficit > 0; i--) {
        const take = Math.min(deficit, Math.max(0, lockedDurations[i] - minPerSegment));
        lockedDurations[i] -= take;
        deficit -= take;
      }
      lockedTotal = lockedDurations.reduce((s, d) => s + d, 0);
      unlockedTotal = totalDurationSeconds - lockedTotal;
    }

    const per = Math.floor(unlockedTotal / unlockedCount);
    const rem = unlockedTotal - per * unlockedCount;
    const shares = Array.from({ length: unlockedCount }, (_, i) => per + (i === unlockedCount - 1 ? rem : 0));

    const out: number[] = [];
    let k = 0;
    for (const seg of current) out.push(seg.locked ? lockedDurations.shift()! : shares[k++]);
    return out;
  }

  function setSegmentDuration(id: number, newSeconds: number) {
    setSegments(prev => {
      if (prev.find(s => s.id === id)?.locked) return prev;
      const otherCount = prev.length - 1;
      if (otherCount === 0) {
        return prev.map(s => s.id === id ? { ...s, durationSeconds: newSeconds } : s);
      }
      const maxAllowed = totalDurationSeconds - otherCount * minPerSegment;
      const clamped = Math.max(minPerSegment, Math.min(maxAllowed, Math.round(newSeconds)));
      const remaining = totalDurationSeconds - clamped;
      const perOther = Math.floor(remaining / otherCount);
      const remainder = remaining - perOther * otherCount;
      let remainderAssigned = false;
      return prev.map(s => {
        if (s.id === id) return { ...s, durationSeconds: clamped };
        if (!remainderAssigned) {
          remainderAssigned = true;
          return { ...s, durationSeconds: perOther + remainder };
        }
        return { ...s, durationSeconds: perOther };
      });
    });
  }

  function addSegment() {
    segCounter.current += 1;
    setSegments(prev => {
      const next = [...prev, { id: segCounter.current, activityId: null, durationSeconds: 0 }];
      // Distribute against the PREVIOUS segments: those are the ones carrying the
      // `locked` flags, and the newly appended slot has none.
      const shares = redistribute(next.length, prev);
      return next.map((seg, i) => ({ ...seg, durationSeconds: shares[i] ?? 0 }));
    });
  }

  function removeSegment(id: number) {
    setSegments(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) return filtered;
      const shares = redistribute(filtered.length, filtered);
      return filtered.map((s, i) => ({ ...s, durationSeconds: shares[i] ?? s.durationSeconds }));
    });
  }

  /** Pin or unpin a slot so redistribution leaves its duration alone. */
  function toggleLock(id: number) {
    setSegments(prev => prev.map(s => (s.id === id ? { ...s, locked: !s.locked } : s)));
  }

  function pickActivity(id: number, activityId: string) {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, activityId } : s));
    setPickingId(null);
  }

  async function handleSave() {
    const filled = segments.filter(s => s.activityId);
    if (filled.length === 0) return;
    setIsSaving(true);
    setSaveError(null);

    // Walk the cursor across EVERY segment, not just the filled ones.
    //
    // This used to iterate `filled` only, so leaving the middle segment blank
    // made the third segment inherit the second one's slot: it was written with
    // timestamps overlapping segment one and with segment two's window silently
    // missing from external_sessions. Skipping a middle segment is a normal thing
    // to do ("I was in a meeting for the first half"), so this corrupted the
    // timeline exactly when the user was being selective. The cursor must track
    // wall-clock position regardless of whether a segment gets written.
    const cursor = new Date(periodStart);
    const result: { activityId: string; startedAt: string; endedAt: string }[] = [];
    for (const seg of segments) {
      const segStart = cursor.toISOString();
      cursor.setTime(cursor.getTime() + seg.durationSeconds * 1000);
      if (seg.activityId) {
        result.push({ activityId: seg.activityId, startedAt: segStart, endedAt: cursor.toISOString() });
      }
    }

    const ok = await onConfirm(result);
    setIsSaving(false);
    // Only claim success when the write actually succeeded. `onConfirm` resolves
    // false when the batch insert was rejected — previously the modal showed
    // "Saved" regardless, so a failed write was indistinguishable from a good one
    // and the user reasonably concluded the app had lost their answer.
    if (ok) {
      // The gap has now been re-attributed to the activities the user picked,
      // so the day's unfilled total must stop being counted. Gated on `ok` for
      // the same reason `setSaved` is: resetting after a REJECTED write would
      // discard the very time the user is still trying to account for.
      stopwatch.resetAfterAfkFill();
      setSaved(true);
    } else {
      setSaveError("Couldn't save. Your answer was not recorded — try again.");
    }
  }

  const totalFormatted = formatElapsed(totalDurationSeconds);
  const filledCount = segments.filter(s => s.activityId).length;
  const hasAnyActivity = segments.some(s => s.activityId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[min(680px,85vh)] overflow-y-auto shadow-2xl shadow-black/40"
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative gradient bar removed — single signal hue only */}

        <div className="p-5">
          {/* ── Header ── */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 ring-1 ring-amber-500/20">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-zinc-100 tracking-[-0.01em]">While you were away</h3>
                <p className="text-[11px] text-zinc-500 mt-1 font-mono tabular-nums">
                  {idleStartMs ? (
                    <>{formatTime(idleStartMs)} <span className="text-zinc-600">→</span> {formatTime(returnMs)}</>
                  ) : (
                    <><span className="text-amber-300 font-mono font-medium tabular-nums">{liveElapsed}</span> total</>
                  )}
                  <span className="text-zinc-600 ml-1">({totalFormatted})</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {queueRemaining > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 text-[11px]"
                >
                  <Activity className="w-3 h-3" />
                  <span>+{queueRemaining}</span>
                </motion.div>
              )}
              <button onClick={onDismiss} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Timeline ── */}
          <div className="mb-5">
            <div
              ref={barRef}
              className="flex h-10 rounded-xl overflow-hidden bg-zinc-800 select-none border border-zinc-700/30"
            >
              {segments.flatMap((seg, i) => {
                const act = visibleActivities.find(a => a.id.toString() === seg.activityId);
                const pct = totalDurationSeconds > 0 ? (seg.durationSeconds / totalDurationSeconds) : 0;
                const elems = [
                  <motion.div
                    key={seg.id}
                    layout
                    className="h-full flex items-center justify-center text-[11px] font-medium text-white/80 truncate px-1 transition-colors relative"
                    style={{ flex: `${pct} 1 0%`, backgroundColor: act?.color || 'var(--color-card-sunken)' }}
                  >
                    <span className="truncate drop-shadow-sm">{pct > 0.1 ? formatElapsed(seg.durationSeconds) : ''}</span>
                  </motion.div>,
                ];
                if (i < segments.length - 1) {
                  elems.push(
                    <div
                      key={`d${seg.id}`}
                      className="w-[9px] cursor-col-resize shrink-0 flex items-center justify-center hover:bg-white/[0.1] active:bg-white/[0.15] transition-colors group"
                      onMouseDown={e => onDividerMouseDown(i, e)}
                    >
                      <div className="w-px h-6 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors pointer-events-none" />
                    </div>,
                  );
                }
                return elems;
              })}
            </div>
            <div className="relative text-[10px] text-zinc-500 mt-1.5 h-4">
              {(() => {
                const total = totalDurationSeconds;
                const edges: { time: string; pct: number }[] = [];
                edges.push({ time: formatTime(new Date(periodStart).getTime()), pct: 0 });
                let cum = 0;
                for (let i = 0; i < segments.length - 1; i++) {
                  cum += segments[i].durationSeconds;
                  edges.push({ time: formatTime(new Date(new Date(periodStart).getTime() + cum * 1000).getTime()), pct: total > 0 ? (cum / total) * 100 : 0 });
                }
                edges.push({ time: formatTime(new Date(periodEnd).getTime()), pct: 100 });
                return edges.map((e, i) => (
                  <span
                    key={i}
                    className={`absolute font-mono tabular-nums ${i === 0 ? 'text-left' : i === edges.length - 1 ? 'text-right' : 'text-center'}`}
                    style={{ left: `${e.pct}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
                  >
                    {e.time}
                  </span>
                ));
              })()}
            </div>
          </div>

          {/* ── Segment Editor ── */}
          {(!defaultNotAfk || showSegmentEditor) && (
            <div className="space-y-2 mb-4">
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {segments.map(seg => {
                  const act = visibleActivities.find(a => a.id.toString() === seg.activityId);
                  const isPicking = pickingId === seg.id;
                  return (
                    <motion.div key={seg.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                      {/* A slot is one decision, not five controls side by side.
                          The old row laid [ - 30 min + ] and [ Choose activity ]
                          on one line at equal weight, so the number that people
                          fiddle with competed with the choice they actually came
                          to make. The activity is now the hero; duration and lock
                          sit underneath it as a secondary toolbar. */}
                      <div
                        className={`relative rounded-xl border overflow-hidden transition-colors duration-150 ${
                          seg.locked
                            ? 'bg-amber-500/[0.07] border-amber-500/25'
                            : isPicking
                              ? 'bg-zinc-800/70 border-zinc-600/50'
                              : 'bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border-white/[0.06] hover:border-white/[0.12]'
                        }`}
                      >
                        {/* activity colour rail */}
                        <div
                          className="absolute inset-y-0 left-0 w-[3px] transition-opacity"
                          style={{ backgroundColor: act?.color || 'transparent', opacity: act ? 1 : 0 }}
                        />

                        {/* ── hero: what were you doing? ── */}
                        <button
                          onClick={() => setPickingId(isPicking ? null : seg.id)}
                          className="w-full flex items-center gap-3 pl-5 pr-3.5 py-3 text-left group"
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white/10"
                            style={{ backgroundColor: act?.color || 'var(--color-card-sunken)' }}
                          />
                          <span
                            className={`text-sm truncate transition-colors ${
                              act ? 'text-zinc-100 font-medium' : 'text-zinc-500'
                            }`}
                          >
                            {act ? act.name : 'What were you doing?'}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 ml-auto shrink-0 text-zinc-600 transition-transform duration-200 group-hover:text-zinc-400 ${
                              isPicking ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {/* ── secondary: how long, and is it pinned? ── */}
                        <div className="flex items-center gap-1 pl-5 pr-3 pb-2.5">
                          <div className={`flex items-center gap-0.5 ${seg.locked ? 'opacity-40 pointer-events-none' : ''}`}>
                            <button
                              aria-label="Decrease by a minute"
                              onClick={() => setSegmentDuration(seg.id, seg.durationSeconds - 60)}
                              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <div className="flex items-baseline gap-1 px-2 py-1 rounded-lg bg-black/25 light:bg-black/[0.03] border border-white/[0.05]">
                              <input
                                type="number"
                                min={1}
                                max={Math.floor(totalDurationSeconds / 60)}
                                value={Math.round(seg.durationSeconds / 60)}
                                onChange={e => {
                                  const mins = parseInt(e.target.value) || 1;
                                  setSegmentDuration(seg.id, mins * 60);
                                }}
                                className="w-8 text-center text-xs text-zinc-200 font-mono tabular-nums bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="text-[10px] text-zinc-600">min</span>
                            </div>
                            <button
                              aria-label="Increase by a minute"
                              onClick={() => setSegmentDuration(seg.id, seg.durationSeconds + 60)}
                              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Pin this slot's duration. Adding or removing a slot
                              redistributes the gap again; a locked slot keeps its
                              length and the rest share out whatever is left. */}
                          <button
                            onClick={() => toggleLock(seg.id)}
                            role="switch"
                            aria-checked={!!seg.locked}
                            className={`ml-1 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                              seg.locked
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06]'
                            }`}
                          >
                            {seg.locked ? <Lock size={11} /> : <Unlock size={11} />}
                            {seg.locked ? 'Pinned' : 'Pin'}
                          </button>

                          {segments.length > 1 && (
                            <button
                              onClick={() => removeSegment(seg.id)}
                              aria-label="Remove this slot"
                              className="ml-auto p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline activity picker */}
                      <AnimatePresence>
                        {isPicking && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-1.5 ml-2 pl-4 border-l-2 border-zinc-700/30">
                              <div className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/30 max-h-48 overflow-y-auto">
                                {visibleActivities.length === 0 ? (
                                  <div className="flex flex-col items-center py-4 text-zinc-600">
                                    <Activity className="w-8 h-8 mb-2 opacity-40" />
                                    <p className="text-xs">No activities yet</p>
                                    <p className="text-[10px] text-zinc-700">Add them on the External page</p>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {visibleActivities.map(act => {
                                      const Icon = ACTIVITY_ICONS[act.icon] || Activity;
                                      return (
                                        <button
                                          key={act.id}
                                          onClick={() => pickActivity(seg.id, act.id.toString())}
                                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-xs ${
                                            seg.activityId === act.id.toString()
                                              ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30'
                                              : 'hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                                          }`}
                                        >
                                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: act.color }} />
                                          <Icon className="w-3 h-3 shrink-0 opacity-60" />
                                          <span className="truncate">{act.name}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>

              {/* Add segment */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={addSegment}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors border border-dashed border-zinc-700/40 hover:border-zinc-600/50"
              >
                <Plus className="w-4 h-4" />
                <span>Split into another activity</span>
              </motion.button>
            </div>
          )}

          {/* ── Collapsed disclosure for short AFK ── */}
          {defaultNotAfk && !showSegmentEditor && (
            <button
              onClick={() => setShowSegmentEditor(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/50 transition-colors border border-dashed border-zinc-700/30 mb-4"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Actually, I did something — log it</span>
            </button>
          )}

          {children}

          {/* ── Adjacent Gaps (shown after save) ── */}
          {saved && adjacentGaps.length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <div className="flex items-center gap-1.5 text-amber-400/80 text-[10px] mb-2">
                <Sparkles className="w-3 h-3" />
                <span>Untracked time around your session</span>
              </div>
              <div className="flex flex-col gap-1.5 mb-3">
                {adjacentGaps.map((g) => {
                  const isFilled = filledGapStarts.includes(g.start);
                  const durMin = Math.round(g.durationSeconds / 60);
                  const h = Math.floor(durMin / 60);
                  const m = durMin % 60;
                  const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
                  const s = new Date(g.start);
                  const e = new Date(g.end);
                  const rangeStr = `${s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
                  return (
                    <div key={g.start} className={`flex items-center justify-between gap-2 p-2 rounded-lg ${isFilled ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-zinc-800/40 border border-zinc-700/30'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] ${g.relation === 'before' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {g.relation === 'before' ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[11px] text-zinc-300 font-medium">{g.relation === 'before' ? 'Before idle' : 'After return'}</div>
                          <div className="text-[9px] text-zinc-500 font-mono truncate">{rangeStr}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${g.relation === 'before' ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{durStr}</span>
                        {isFilled ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-400"><Check className="w-3 h-3" /> Filled</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              {adjacentGaps.some(g => !filledGapStarts.includes(g.start)) && (
                <button
                  onClick={() => {
                    const unfilled = adjacentGaps
                      .filter(ag => !filledGapStarts.includes(ag.start))
                      .map(ag => ({ start: new Date(ag.start), end: new Date(ag.end), duration_seconds: ag.durationSeconds }));
                    onFillGapRequest?.(unfilled);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-[11px] font-medium text-amber-200 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 transition-colors mb-2"
                >
                  Fill all {adjacentGaps.filter(g => !filledGapStarts.includes(g.start)).length} gaps
                </button>
              )}
              <button
                onClick={onGapsDone}
                className="w-full px-3 py-2 rounded-xl text-[11px] font-medium text-zinc-300 bg-zinc-500/10 border border-zinc-700/50 hover:bg-zinc-500/20 transition-colors"
              >
                {adjacentGaps.every(g => filledGapStarts.includes(g.start)) ? 'Done' : 'Skip — fill later'}
              </button>
            </div>
          )}

          {/* ── Action Bar ── */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
            {/* Dismiss */}
            <button
              onClick={onDismiss}
              className="px-3 py-2 rounded-xl text-xs text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 transition-colors"
            >
              {queueRemaining > 0 ? `Skip (${queueRemaining} more)` : 'Discard'}
            </button>

            <div className="flex-1" />

            {/* Not AFK */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onNotAfk}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                defaultNotAfk
                  ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/30'
              }`}
            >
              I wasn't AFK
            </motion.button>

            {/* Save */}
            {saved ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-5 py-2 rounded-xl text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-2"
              >
                <Check className="w-3.5 h-3.5" />
                Saved
              </motion.div>
            ) : (
              <motion.button
                onClick={handleSave}
                disabled={!hasAnyActivity || isSaving}
                className={`px-5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                  hasAnyActivity && !isSaving
                    ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {isSaving ? 'Saving...' : `Save${filledCount > 0 ? ` (${filledCount})` : ''}`}
              </motion.button>
            )}
            {saveError && (
              <div className='flex items-start gap-2 px-4 pb-3'>
                <AlertCircle className='h-3.5 w-3.5 shrink-0 text-red-400 mt-px' />
                <span className='text-[11px] text-red-300'>{saveError}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
