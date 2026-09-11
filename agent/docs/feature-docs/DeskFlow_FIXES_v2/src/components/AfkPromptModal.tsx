import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, Plus, X, CalendarRange, Check, Minus } from 'lucide-react';

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
}

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
}: {
  allActivities: ExternalActivity[];
  totalDurationSeconds: number;
  periodStart: string;
  periodEnd: string;
  idleStartMs: number | null;
  returnMs: number;
  queueRemaining: number;
  onConfirm: (segments: { activityId: string; startedAt: string; endedAt: string }[]) => void;
  onDismiss: () => void;
  onNotAfk: () => void;
  defaultNotAfk?: boolean;
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

    function onMouseMove(ev: MouseEvent) {
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));

      setSegments(prev => {
        if (idx >= prev.length - 1) return prev;
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
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function redistributeEven(count: number): Omit<Segment, 'activityId'>[] {
    if (count === 0) return [];
    const per = Math.floor(totalDurationSeconds / count);
    const rem = totalDurationSeconds - per * count;
    return Array.from({ length: count }, (_, i) => ({
      durationSeconds: per + (i === count - 1 ? rem : 0),
    }));
  }

  function setSegmentDuration(id: number, newSeconds: number) {
    setSegments(prev => {
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
      const even = redistributeEven(prev.length + 1);
      return [...prev, { id: segCounter.current, activityId: null, durationSeconds: 0 }].map((s, i) => ({
        ...s,
        durationSeconds: even[i].durationSeconds,
      }));
    });
  }

  function removeSegment(id: number) {
    setSegments(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) return filtered;
      const even = redistributeEven(filtered.length);
      return filtered.map((s, i) => ({ ...s, durationSeconds: even[i].durationSeconds }));
    });
  }

  function pickActivity(id: number, activityId: string) {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, activityId } : s));
    setPickingId(null);
  }

  function handleSave() {
    const filled = segments.filter(s => s.activityId);
    if (filled.length === 0) return;
    const cursor = new Date(periodStart);
    const result = filled.map(seg => {
      const segStart = cursor.toISOString();
      cursor.setTime(cursor.getTime() + seg.durationSeconds * 1000);
      return { activityId: seg.activityId!, startedAt: segStart, endedAt: cursor.toISOString() };
    });
    onConfirm(result);
  }

  const totalFormatted = formatElapsed(totalDurationSeconds);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 10 }}
        transition={{ type: 'spring', duration: 0.4, bounce: 0.25 }}
        className="bg-zinc-900/95 border border-zinc-700/50 rounded-xl w-full max-w-xl max-h-[min(640px,85vh)] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-indigo-500/40 via-emerald-500/40 to-indigo-500/40" />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 ring-1 ring-amber-500/20">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Back from a break?</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
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
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 text-[11px]">
                  <CalendarRange className="w-3 h-3" />
                  <span>+{queueRemaining}</span>
                </div>
              )}
              <button onClick={onDismiss} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Timeline bar */}
          <div className="mb-5">
            <div
              ref={barRef}
              className="flex h-8 rounded-lg overflow-hidden bg-zinc-800 select-none"
            >
              {segments.flatMap((seg, i) => {
                const act = visibleActivities.find(a => a.id.toString() === seg.activityId);
                const pct = totalDurationSeconds > 0 ? (seg.durationSeconds / totalDurationSeconds) : 0;
                const elems = [
                  <div
                    key={seg.id}
                    className="h-full flex items-center justify-center text-[10px] font-medium text-white/80 truncate px-1 transition-colors"
                    style={{ flex: `${pct} 1 0%`, backgroundColor: act?.color || '#52525b' }}
                  >
                    <span className="truncate">{pct > 0.12 ? formatElapsed(seg.durationSeconds) : ''}</span>
                  </div>,
                ];
                if (i < segments.length - 1) {
                  elems.push(
                    <div
                      key={`d${seg.id}`}
                      className="w-[7px] cursor-col-resize shrink-0 flex items-center justify-center hover:bg-white/[0.07] active:bg-white/[0.12] transition-colors"
                      onMouseDown={e => onDividerMouseDown(i, e)}
                    >
                      <div className="w-px h-5 rounded-full bg-white/25 pointer-events-none" />
                    </div>,
                  );
                }
                return elems;
              })}
            </div>
            {/* Edge times — positioned at divider locations */}
            <div className="relative text-[10px] text-zinc-500 mt-1 h-4">
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
                    className={`absolute ${i === 0 ? 'text-left' : i === edges.length - 1 ? 'text-right' : 'text-center'}`}
                    style={{ left: `${e.pct}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
                  >
                    {e.time}
                  </span>
                ));
              })()}
            </div>
          </div>

          {/* Segments */}
          <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
            {segments.map(seg => {
              const act = visibleActivities.find(a => a.id.toString() === seg.activityId);
              const isPicking = pickingId === seg.id;
              return (
                <div key={seg.id}>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700/30">
                    {/* Duration control */}
                    <div className="flex items-center gap-1 w-[5.5rem] shrink-0">
                      <button
                        onClick={() => setSegmentDuration(seg.id, seg.durationSeconds - 60)}
                        className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={Math.floor(totalDurationSeconds / 60)}
                        value={Math.round(seg.durationSeconds / 60)}
                        onChange={e => {
                          const mins = parseInt(e.target.value) || 1;
                          setSegmentDuration(seg.id, mins * 60);
                        }}
                        className="w-12 text-center text-[11px] text-zinc-400 font-mono tabular-nums bg-transparent border border-zinc-700/30 rounded px-1 py-0.5 focus:outline-none focus:border-zinc-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-zinc-600 w-5">min</span>
                      <button
                        onClick={() => setSegmentDuration(seg.id, seg.durationSeconds + 60)}
                        className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => setPickingId(isPicking ? null : seg.id)}
                      className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700/60 transition text-left"
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: act?.color || '#52525b' }} />
                      <span className={`text-sm ${act ? 'text-zinc-200' : 'text-zinc-500 italic'}`}>
                        {act ? act.name : 'Choose activity'}
                      </span>
                    </button>
                    {segments.length > 1 && (
                      <button onClick={() => removeSegment(seg.id)} className="p-1 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Inline activity picker */}
                  {isPicking && (
                    <div className="mt-1.5 ml-16 pl-3 border-l-2 border-zinc-700/40">
                      <div className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/30 max-h-48 overflow-y-auto">
                        {visibleActivities.length === 0 ? (
                          <p className="text-xs text-zinc-600 py-2 text-center">No activities — add on External page</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-1">
                            {visibleActivities.map(act => (
                              <button
                                key={act.id}
                                onClick={() => pickActivity(seg.id, act.id.toString())}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition text-xs ${
                                  seg.activityId === act.id.toString()
                                    ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30'
                                    : 'hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: act.color }} />
                                <span className="truncate">{act.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add segment */}
          <button
            onClick={addSegment}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition border border-dashed border-zinc-700/40 mb-4"
          >
            <Plus className="w-4 h-4" />
            <span>Add another activity</span>
          </button>

          {/* I wasn't AFK — primary when defaultNotAfk */}
          <button
            onClick={onNotAfk}
            className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium transition mb-2 ${
              defaultNotAfk
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-700/40'
            }`}
          >
            I wasn't AFK — continue tracking
          </button>

          {/* Disclosure to show segment editor (only when defaultNotAfk) */}
          {defaultNotAfk && !showSegmentEditor && (
            <button
              onClick={() => setShowSegmentEditor(true)}
              className="w-full px-4 py-2 rounded-xl text-sm text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/50 transition mb-2"
            >
              Actually, let me log it
            </button>
          )}

          {/* Segment editor (hidden when defaultNotAfk and not expanded) */}
          {showSegmentEditor && (
            <>
              {/* Add another activity */}
              <button
                onClick={handleAdd}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition border border-zinc-700/30 hover:border-zinc-600/50 mb-3"
              >
                <Plus className="w-4 h-4" />
                <span>Add another activity</span>
              </button>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={!segments.some(s => s.activityId)}
                className="w-full px-4 py-2.5 rounded-xl text-sm font-medium transition bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed mb-2"
              >
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  Save {segments.filter(s => s.activityId).length} {segments.filter(s => s.activityId).length === 1 ? 'activity' : 'activities'}
                </span>
              </button>
            </>
          )}

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="w-full px-4 py-2 rounded-xl text-sm text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 transition border border-transparent hover:border-zinc-700/30"
          >
            {queueRemaining > 0 ? `Skip — next (${queueRemaining} more)` : 'Nothing special — just AFK'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
