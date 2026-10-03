import { useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, Bed, Sunrise, Clock, CheckCircle2, Sparkles, Sunset, LoaderCircle } from 'lucide-react';
import { DurationPicker } from './DurationPicker';

interface TimeState {
  hours: number;
  minutes: number;
}

export interface AdjacentSleepGap {
  start: string;
  end: string;
  durationSeconds: number;
  relation: 'before' | 'after';
}

function fmtGapRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const day = s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const st = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const et = e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} · ${st} – ${et}`;
}

function fmtGapDur(seconds: number) {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function localDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function SleepDetectionModal({
  data,
  customBedtime,
  customWaketime,
  fellAsleepAt,
  wakeUpAt,
  onBedtimeChange,
  onWaketimeChange,
  onFellAsleepAtChange,
  onWakeUpAtChange,
  sleepDate,
  onSleepDateChange,
  onConfirm,
  onDismiss,
  adjacentGaps = [],
  step = 'sleep',
  onDone,
  activities = [],
  sessions = [],
  onFillGapRequest,
  onFillGap,
  filledGapStarts = [],
}: {
  data: { gapMinutes: number; suggestedBedtime: string; suggestedWakeTime: string };
  customBedtime: TimeState;
  customWaketime: TimeState;
  fellAsleepAt: TimeState;
  wakeUpAt: TimeState;
  onBedtimeChange: (v: TimeState) => void;
  onWaketimeChange: (v: TimeState) => void;
  onFellAsleepAtChange: (v: TimeState) => void;
  onWakeUpAtChange: (v: TimeState) => void;
  sleepDate: string;
  onSleepDateChange: (v: string) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  adjacentGaps?: AdjacentSleepGap[];
  step?: 'sleep' | 'gaps';
  onDone?: () => void;
  activities?: Array<{ id: string | number; name: string; category?: string }>;
  sessions?: Array<{ app?: string; activity?: string; [k: string]: unknown }>;
  onFillGapRequest?: (gaps: Array<{ start: string; end: string; duration_seconds: number }>) => void;
  /** Open the splitter for ONE named gap, so before/after can be done separately. */
  onFillGap?: (gap: { start: string; end: string; duration_seconds: number }) => void;
  filledGapStarts?: string[];
}) {
  console.log('%c[SleepDetectionModal] v1.4 date picker + GapFillModal integration', 'color: #fbbf24; font-weight: bold');

  const [dateManuallySet, setDateManuallySet] = useState(false);

  const handleDone = onDone || onDismiss;

  if (step === 'gaps') {
    const allFilled = adjacentGaps.length > 0 && adjacentGaps.every(g => filledGapStarts?.includes(g.start));
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
          transition={{ type: 'spring', duration: 0.4, bounce: 0.25 }}
          className="bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-xl w-full max-w-lg max-h-[min(680px,90vh)] overflow-y-auto shadow-2xl"
        >
          <div className="p-5 sm:p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 ring-1 ring-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-zinc-100 tracking-[-0.01em]">
                    {allFilled ? 'All gaps accounted for' : adjacentGaps.length > 0 ? 'Fill in the gaps' : 'Nothing untracked'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {adjacentGaps.length > 0
                      ? 'Time around your sleep that wasn\u2019t tracked'
                      : 'No untracked time around this sleep'}
                  </p>
                </div>
              </div>
              <button onClick={handleDone} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-200 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {adjacentGaps.length === 0 ? (
              <div className="py-8 rounded-xl border border-dashed border-white/[0.08] text-center">
                <Moon className="w-6 h-6 mx-auto mb-2.5 text-zinc-700" />
                <p className="text-[13px] text-zinc-400">No untracked gaps around this sleep</p>
                <p className="text-[11px] text-zinc-600 mt-1">Everything either side was already logged</p>
              </div>
            ) : (
              <>
                {/* The two gaps only make sense as two sides of one night, so this
                    is drawn as a timeline with the sleep itself in the middle
                    rather than as a flat list of two unrelated-looking cards. */}
                <div className="relative pl-10">
                  <div className="absolute left-[13px] top-3 bottom-3 w-px bg-white/[0.07]" />

                  {adjacentGaps.map((g, i) => {
                    const isFilled = filledGapStarts?.includes(g.start);
                    const before = g.relation === 'before';
                    const durMin = Math.round(g.durationSeconds / 60);
                    const h = Math.floor(durMin / 60);
                    const m = durMin % 60;
                    const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
                    const Node = before ? Sunset : Sunrise;
                    return (
                      <div key={g.start}>
                        <div className={`relative flex items-start gap-3 pb-3 ${isFilled ? 'opacity-55' : ''}`}>
                          <div className={`absolute -left-10 top-0.5 w-[27px] h-[27px] rounded-full flex items-center justify-center ring-4 ring-zinc-900/95 ${
                            isFilled
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : before
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-emerald-500/15 text-emerald-400'
                          }`}>
                            <Node className="w-3.5 h-3.5" />
                          </div>
                          <div className={`flex-1 min-w-0 rounded-xl border px-3.5 py-3 transition-colors ${
                            isFilled ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-white/[0.07] bg-white/[0.02]'
                          }`}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[13px] font-medium text-zinc-200">
                                {before ? 'Before you slept' : 'After you woke'}
                              </span>
                              <span className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                                before ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'
                              }`}>
                                {durStr}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono tabular-nums mt-1">{fmtGapRange(g.start, g.end)}</div>
                            <div className="flex items-center gap-2 mt-2">
                              {isFilled ? (
                                <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Filled
                                </span>
                              ) : (
                                <button
                                  onClick={() => onFillGap?.({ start: g.start, end: g.end, duration_seconds: g.durationSeconds })}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                                    before
                                      ? 'bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                                      : 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                                  }`}
                                >
                                  Fill this gap
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* the sleep block sits between the two flanks */}
                        {i === 0 && adjacentGaps.length > 1 && adjacentGaps[1].relation === 'after' && (
                          <div className="relative flex items-center gap-3 pb-3">
                            <div className="absolute -left-10 top-0.5 w-[27px] h-[27px] rounded-full bg-violet-500/15 text-violet-300 flex items-center justify-center ring-4 ring-zinc-900/95">
                              <Moon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-white/[0.05] bg-black/20">
                              <span className="text-[13px] text-zinc-300">Asleep</span>
                              <span className="text-[11px] text-zinc-600 font-mono tabular-nums ml-auto">logged</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {adjacentGaps.some(g => !filledGapStarts?.includes(g.start)) && (
                  <button
                    onClick={() => {
                      const unfilled = adjacentGaps
                        .filter(g => !filledGapStarts?.includes(g.start))
                        .map(g => ({ start: g.start, end: g.end, duration_seconds: g.durationSeconds }));
                      onFillGapRequest?.(unfilled);
                    }}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-[13px] font-medium text-zinc-900 bg-zinc-100 hover:bg-white active:scale-[0.99] transition-all"
                  >
                    Fill {adjacentGaps.filter(g => !filledGapStarts?.includes(g.start)).length === 1 ? 'this gap' : 'next gap'}
                  </button>
                )}
              </>
            )}
            <button
              onClick={handleDone}
              className="w-full mt-2 px-4 py-2.5 rounded-xl text-[13px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] border border-white/[0.07] transition-colors"
            >
              {allFilled ? 'Done' : 'Skip — fill later from External page'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }
  const durBed = customBedtime.hours * 60 + customBedtime.minutes;
  let durWake = customWaketime.hours * 60 + customWaketime.minutes;
  if (durWake <= durBed) durWake += 24 * 60;
  const totalInactive = durWake - durBed;

  const asleep = fellAsleepAt.hours * 60 + fellAsleepAt.minutes;
  let awake = wakeUpAt.hours * 60 + wakeUpAt.minutes;
  if (awake < asleep) awake += 24 * 60;
  const actualSleep = Math.max(0, awake - asleep);

  const asleepFromOff = (() => {
    let a = fellAsleepAt.hours * 60 + fellAsleepAt.minutes;
    let b = customBedtime.hours * 60 + customBedtime.minutes;
    if (a < b) a += 24 * 60;
    return a - b;
  })();

  const wakeToOn = (() => {
    let w = wakeUpAt.hours * 60 + wakeUpAt.minutes;
    let o = customWaketime.hours * 60 + customWaketime.minutes;
    if (o < w) o += 24 * 60;
    return o - w;
  })();

  function makeDayAwareDates() {
    const base = new Date(sleepDate + 'T12:00:00');
    const bedMin = customBedtime.hours * 60 + customBedtime.minutes;
    const fallMin = fellAsleepAt.hours * 60 + fellAsleepAt.minutes;
    const wakeMin = wakeUpAt.hours * 60 + wakeUpAt.minutes;
    const onMin = customWaketime.hours * 60 + customWaketime.minutes;

    let fallDay = fallMin < bedMin ? 1 : 0;
    let fallAdj = fallMin + fallDay * 1440;
    let wakeDay = wakeMin < fallAdj ? fallDay + 1 : fallDay;
    let wakeAdj = wakeMin + wakeDay * 1440;
    let onDay = onMin < wakeAdj ? wakeDay + 1 : wakeDay;

    return { bedMin, fallMin, wakeMin, onMin, fallDay, wakeDay, onDay, base };
  }

  function fmtWithDay(h: number, m: number, dayOffset: number) {
    const base = new Date(sleepDate + 'T12:00:00');
    const d = new Date(base);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${day} · ${time}`;
  }

  function fmtDur(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

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
        transition={{ type: 'spring', duration: 0.4, bounce: 0.25 }}
        className="bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-xl w-full max-w-lg max-h-[min(680px,90vh)] overflow-y-auto shadow-2xl"
      >
        {/* Decorative bar */}
        <div className="h-1 bg-gradient-to-r from-indigo-500/40 via-violet-500/40 to-indigo-500/40" />

        <div className="p-5">
          {/* ── Header ── */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 ring-1 ring-indigo-500/20">
                <Moon className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Were you sleeping?</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Inactive for <span className="text-indigo-300 font-medium">{fmtDur(data.gapMinutes)}</span>
                </p>
              </div>
            </div>
            <button onClick={onDismiss} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* ── Timeline visualization ── */}
          <div className="mb-5">
            <div className="flex h-8 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700/30">
              <div className="flex-1 flex items-center justify-center text-[10px] text-zinc-500 bg-zinc-800/50">Pre-sleep</div>
              <div className="flex-[3] flex items-center justify-center text-xs text-indigo-300 bg-indigo-900/40 font-medium">Sleep</div>
              <div className="flex-[0.8] flex items-center justify-center text-[10px] text-zinc-500 bg-zinc-800/50">Wake</div>
            </div>
            {(() => {
              const { fallDay, wakeDay, onDay } = makeDayAwareDates();
              return (
                <div className="flex justify-between mt-1.5 text-[10px] text-zinc-600 font-mono tabular-nums">
                  <span>{fmtWithDay(customBedtime.hours, customBedtime.minutes, 0)}</span>
                  <span>{fmtWithDay(fellAsleepAt.hours, fellAsleepAt.minutes, fallDay)}</span>
                  <span>{fmtWithDay(wakeUpAt.hours, wakeUpAt.minutes, wakeDay)}</span>
                  <span>{fmtWithDay(customWaketime.hours, customWaketime.minutes, onDay)}</span>
                </div>
              );
            })()}
          </div>

          {/* ── Date selector with auto-fix ── */}
          <div className="mb-5">
            <label className="block text-[11px] text-zinc-500 text-center mb-1.5">Sleep belongs to</label>
            <p className="text-[10px] text-zinc-600 text-center mb-2">
              {dateManuallySet ? 'Date set manually' : 'Auto-fixed: bedtime before noon = previous day'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const d = new Date(sleepDate + 'T00:00:00');
                  d.setDate(d.getDate() - 1);
                  onSleepDateChange(localDateStr(d));
                  setDateManuallySet(true);
                }}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <input
                type="date"
                value={sleepDate}
                onChange={(e) => {
                  onSleepDateChange(e.target.value);
                  setDateManuallySet(true);
                }}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 text-center"
              />
              <button
                onClick={() => {
                  const d = new Date(sleepDate + 'T00:00:00');
                  d.setDate(d.getDate() + 1);
                  onSleepDateChange(localDateStr(d));
                  setDateManuallySet(true);
                }}
                disabled={sleepDate === localDateStr(new Date())}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>

          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30">
              <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] mb-1">
                <Clock className="w-3 h-3" />
                <span>Total inactive</span>
              </div>
              <span className="text-sm font-semibold text-zinc-100">{fmtDur(totalInactive)}</span>
            </div>
            <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
              <div className="flex items-center gap-1.5 text-indigo-400/70 text-[10px] mb-1">
                <Bed className="w-3 h-3" />
                <span>Actual sleep</span>
              </div>
              <span className="text-sm font-semibold text-indigo-300">{fmtDur(actualSleep)}</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <div className="flex items-center gap-1.5 text-amber-500/60 text-[10px] mb-1">
                <span className="text-[11px]">🌙</span>
                <span>Pre-sleep</span>
              </div>
              <span className="text-sm font-semibold text-amber-300">+{fmtDur(asleepFromOff)}</span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <div className="flex items-center gap-1.5 text-emerald-500/60 text-[10px] mb-1">
                <Sunrise className="w-3 h-3" />
                <span>Wake→App</span>
              </div>
              <span className="text-sm font-semibold text-emerald-300">+{fmtDur(wakeToOn)}</span>
            </div>
          </div>

          {/* ── Duration pickers ── */}
          <div className="bg-zinc-800/30 rounded-xl p-4 mb-5 border border-zinc-700/30">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-zinc-500 text-center mb-2">Device Off</label>
                <DurationPicker
                  hours={customBedtime.hours}
                  minutes={customBedtime.minutes}
                  onChange={(h, m) => onBedtimeChange({ hours: h, minutes: m })}
                  maxHours={23}
                  hourLabel="Hr"
                  minuteLabel="Min"
                  wrap
                />
              </div>
              <div>
                <label className="block text-[11px] text-amber-500/70 text-center mb-2">Fell asleep</label>
                <DurationPicker
                  hours={fellAsleepAt.hours}
                  minutes={fellAsleepAt.minutes}
                  onChange={(h, m) => onFellAsleepAtChange({ hours: h, minutes: m })}
                  maxHours={23}
                  hourLabel="Hr"
                  minuteLabel="Min"
                  wrap
                />
              </div>
              <div>
                <label className="block text-[11px] text-amber-500/70 text-center mb-2">Woke up</label>
                <DurationPicker
                  hours={wakeUpAt.hours}
                  minutes={wakeUpAt.minutes}
                  onChange={(h, m) => onWakeUpAtChange({ hours: h, minutes: m })}
                  maxHours={23}
                  hourLabel="Hr"
                  minuteLabel="Min"
                  wrap
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 text-center mb-2">Device On</label>
                <DurationPicker
                  hours={customWaketime.hours}
                  minutes={customWaketime.minutes}
                  onChange={(h, m) => onWaketimeChange({ hours: h, minutes: m })}
                  maxHours={23}
                  hourLabel="Hr"
                  minuteLabel="Min"
                  wrap
                />
              </div>
            </div>
          </div>

          {/* ── Untracked time around sleep (with Fill buttons) ── */}
          {adjacentGaps.length > 0 && (
            <div className="mb-5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <div className="flex items-center gap-1.5 text-amber-400/80 text-[10px] mb-2">
                <Sparkles className="w-3 h-3" />
                <span>Untracked time around your sleep</span>
              </div>
              <div className="flex flex-col gap-1.5 mb-2">
                {adjacentGaps.map((g) => {
                  const isFilled = filledGapStarts?.includes(g.start);
                  return (
                    <div key={g.start} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-zinc-400">
                        {g.relation === 'before' ? 'Before sleep' : 'After wake'}
                        <span className="text-zinc-600 ml-1.5 font-mono">{fmtGapRange(g.start, g.end)}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`font-medium ${g.relation === 'before' ? 'text-amber-300' : 'text-emerald-300'}`}>
                          {fmtGapDur(g.durationSeconds)}
                        </span>
                        {isFilled && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Filled
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {adjacentGaps.some(g => !filledGapStarts?.includes(g.start)) && (
                <button
                  onClick={() => {
                    const unfilled = adjacentGaps
                      .filter(g => !filledGapStarts?.includes(g.start))
                      .map(g => ({ start: g.start, end: g.end, duration_seconds: g.durationSeconds }));
                    onFillGapRequest?.(unfilled);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg text-[11px] font-medium text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 transition-all mt-2"
                >
                  Fill all {adjacentGaps.filter(g => !filledGapStarts?.includes(g.start)).length} gaps
                </button>
              )}
              <p className="mt-2 text-[10px] text-zinc-500">
                Fill these now or after confirming your sleep.
              </p>
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/30 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-600/20"
            >
              Confirm Sleep
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
