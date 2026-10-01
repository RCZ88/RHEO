// Manual time backfill — the user writes the specification, the app generates
// the usage. Nothing is written to the database until Generate is pressed.
//
// Design notes:
// - No month, year or date range is hardcoded anywhere. The range is whatever the
//   user types; the default is just "today back a little" as a starting point.
// - "Reuse a past day" derives a template from rows that already exist, so a
//   template can never drift into a shape the user never actually had.
// - Generation is a pure preview first. planBackfill() is called on every spec
//   change; only the Generate button calls manualAssignCreate.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dices,
  History,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  planBackfill,
  summarise,
  enumerateDates,
  deriveDayTemplate,
  templateToSpecApps,
  localDayStart,
  type BackfillApp,
  type BackfillSpec,
  type GeneratedDay,
  type DayTemplate,
} from '@/lib/external/manualBackfill';
import type { TimeInterval } from '@/lib/external/manualTime';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function keyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toLocalIso(d: Date): string {
  return `${keyOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m ? `${m}m` : ''}`.trim() : `${m}m`;
}

interface KnownApp {
  app: string;
  category?: string;
  last_used?: string;
}

export default function ManualFillModal({
  open,
  onClose,
  onChanged,
  logs,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  /** Full log set, used only to build templates from days that already exist. */
  logs?: unknown[];
}) {
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return keyOf(d);
  }, [today]);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(() => keyOf(today));

  const [knownApps, setKnownApps] = useState<KnownApp[]>([]);
  const [apps, setApps] = useState<BackfillApp[]>([]);
  const [freeText, setFreeText] = useState('');

  const [weekdayHours, setWeekdayHours] = useState(7);
  const [weekendHours, setWeekendHours] = useState(4);
  const [intensity, setIntensity] = useState(1);
  const [variance, setVariance] = useState(0.5);
  const [chunksPerDay, setChunksPerDay] = useState(6);
  const [dayStartHour, setDayStartHour] = useState(8);
  const [dayEndHour, setDayEndHour] = useState(23);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));

  const [occupied, setOccupied] = useState<Record<string, TimeInterval[]>>({});
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [templateFrom, setTemplateFrom] = useState('');
  const [templateInfo, setTemplateInfo] = useState<DayTemplate | null>(null);

  const api = useCallback(() => (window as any).deskflowAPI, []);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const list = (await api()?.getKnownApps?.()) || [];
        setKnownApps(list);
        if (apps.length === 0 && list.length > 0) {
          // Seed the pool from real history so the common case needs no typing.
          const top = list.slice(0, 6);
          const total = top.reduce((s: number, a: KnownApp) => s + (a.last_used ? 1 : 1), 0);
          setApps(
            top.map((a: KnownApp, i: number) => ({
              app: a.app,
              category: a.category || 'other',
              weight: Math.max(1, Math.round((total - i) / 2)),
            }))
          );
        }
      } catch {
        /* known apps are optional */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Occupied intervals per day: anything real already logged, plus any earlier
  // manual entries. Generation must never propose writing over either.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const dates = enumerateDates(from, to);
      if (dates.length === 0) {
        setOccupied({});
        return;
      }
      setLoadingCtx(true);
      const map: Record<string, TimeInterval[]> = {};
      for (const d of dates) {
        try {
          const ctx = await api()?.manualAssignDayContext?.(d);
          const tracked: TimeInterval[] = (ctx?.tracked || [])
            .filter((t: any) => t.started_at && t.ended_at)
            .map((t: any) => ({ start: new Date(t.started_at), end: new Date(t.ended_at) }));
          const manual: TimeInterval[] = (ctx?.manual || [])
            .filter((m: any) => m.started_at && m.ended_at)
            .map((m: any) => ({ start: new Date(m.started_at), end: new Date(m.ended_at) }));
          map[d] = [...tracked, ...manual];
        } catch {
          map[d] = [];
        }
      }
      if (!cancelled) {
        setOccupied(map);
        setLoadingCtx(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, from, to]);

  const spec: BackfillSpec = useMemo(
    () => ({
      from,
      to,
      apps,
      weekdayHours,
      weekendHours,
      intensity,
      variance,
      chunksPerDay,
      dayStartHour,
      dayEndHour,
      seed,
    }),
    [from, to, apps, weekdayHours, weekendHours, intensity, variance, chunksPerDay, dayStartHour, dayEndHour, seed]
  );

  const days: GeneratedDay[] = useMemo(() => {
    try {
      return planBackfill(spec, occupied);
    } catch {
      return [];
    }
  }, [spec, occupied]);

  const totals = useMemo(() => summarise(days), [days]);
  const dateCount = enumerateDates(from, to).length;
  const invalidRange = dateCount === 0;

  const addApp = (name: string, category = 'other') => {
    const clean = name.trim();
    if (!clean) return;
    setApps((prev) =>
      prev.some((a) => a.app.toLowerCase() === clean.toLowerCase())
        ? prev
        : [...prev, { app: clean, category, weight: 1 }]
    );
    setFreeText('');
  };

  const shiftRange = (days_: number) => {
    const f = localDayStart(from);
    const t = localDayStart(to);
    f.setDate(f.getDate() + days_);
    t.setDate(t.getDate() + days_);
    setFrom(keyOf(f));
    setTo(keyOf(t));
  };

  /** Rebuild the spec from a day that already has rows on it. */
  const applyTemplate = () => {
    if (!templateFrom) return;
    const dayStart = localDayStart(templateFrom).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const rows = (logs as any[] || [])
      .filter((l) => {
        const t = new Date(l.timestamp).getTime();
        return isFinite(t) && t >= dayStart && t < dayEnd;
      })
      .map((l) => ({
        timestamp: l.timestamp,
        app: l.app,
        category: l.category,
        duration_ms: l.duration_ms,
        source: l.source,
      }));
    const tpl = deriveDayTemplate(rows);
    if (!tpl) {
      setTemplateInfo(null);
      return;
    }
    setTemplateInfo(tpl);
    setApps(templateToSpecApps(tpl));
    setWeekdayHours(Math.round((tpl.totalMinutes / 60) * 10) / 10);
    setWeekendHours(Math.round((tpl.totalMinutes / 60) * 10) / 10);
    setDayStartHour(Math.max(0, tpl.firstHour));
    setDayEndHour(Math.min(24, Math.max(tpl.lastHour + 1, tpl.firstHour + 1)));
  };

  const generate = async () => {
    const all = days.flatMap((d) => d.spans);
    if (all.length === 0) return;
    setGenerating(true);
    setResult(null);
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    try {
      for (let i = 0; i < all.length; i++) {
        const s = all[i];
        try {
          const res = await api()?.manualAssignCreate?.({
            startedAt: toLocalIso(s.start),
            endedAt: toLocalIso(s.end),
            mode: 'random',
            app: s.app,
            category: s.category,
          });
          if (res?.ok) created++;
          else {
            skipped++;
            if (errors.length < 5 && res?.error) errors.push(`${s.date}: ${res.error}`);
          }
        } catch (e: any) {
          skipped++;
          if (errors.length < 5) errors.push(`${s.date}: ${e?.message || e}`);
        }
        setProgress({ done: i + 1, total: all.length });
      }
      setResult({ created, skipped, errors });
      onChanged?.();
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  /** Remove every manual entry inside the current range. Real time untouched. */
  const undoRange = async () => {
    const dates = enumerateDates(from, to);
    let removed = 0;
    for (const d of dates) {
      try {
        const ctx = await api()?.manualAssignDayContext?.(d);
        for (const m of ctx?.manual || []) {
          const res = await api()?.manualAssignDelete?.(m.id);
          if (res?.ok) removed++;
        }
      } catch {
        /* keep going: a partial undo beats aborting */
      }
    }
    setConfirmUndo(false);
    setResult({ created: 0, skipped: removed, errors: [`Removed ${removed} manual ${removed === 1 ? 'entry' : 'entries'}`] });
    onChanged?.();
  };

  if (!open) return null;

  const Slider = ({
    label,
    value,
    min,
    max,
    step,
    suffix,
    onChange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    suffix?: string;
    onChange: (v: number) => void;
  }) => (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] text-zinc-400">{label}</span>
        <span className="text-[11px] text-zinc-300 font-mono tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-violet-500"
      />
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.97, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 8 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-900/95 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-800">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white">Fill time manually</h2>
              <p className="text-[11px] text-zinc-500">
                Describe the shape, the app generates the usage. Nothing is saved until you press Generate.
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* 1 — Period */}
            <section>
              <SectionTitle icon={CalendarDays} n={1} title="Pick the period" />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-[12px] text-zinc-200 [color-scheme:dark]"
                />
                <span className="text-zinc-600 text-xs">to</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-[12px] text-zinc-200 [color-scheme:dark]"
                />
                <div className="flex items-center gap-1">
                  <IconBtn onClick={() => shiftRange(-1)} title="Shift range back a day">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </IconBtn>
                  <IconBtn onClick={() => shiftRange(1)} title="Shift range forward a day">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </IconBtn>
                </div>
                <span className="text-[11px] text-zinc-500 ml-1">
                  {invalidRange ? (
                    <span className="text-red-400">End date is before start date</span>
                  ) : (
                    <>
                      {dateCount} {dateCount === 1 ? 'day' : 'days'}
                    </>
                  )}
                </span>
              </div>

              {/* Reuse a past day as the template */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-2">
                <History className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="text-[11px] text-zinc-400">Reuse a day you already have:</span>
                <input
                  type="date"
                  value={templateFrom}
                  onChange={(e) => setTemplateFrom(e.target.value)}
                  className="px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-200 [color-scheme:dark]"
                />
                <button
                  onClick={applyTemplate}
                  disabled={!templateFrom}
                  className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-200 disabled:opacity-40 transition-colors"
                >
                  Use as template
                </button>
                {templateInfo && (
                  <span className="text-[11px] text-emerald-400">
                    {templateInfo.apps.length} apps · {fmtHours(templateInfo.totalMinutes)}
                  </span>
                )}
              </div>
            </section>

            {/* 2 — Apps */}
            <section>
              <SectionTitle icon={Sparkles} n={2} title="Pick the apps and how likely each is" />
              <div className="space-y-1.5">
                {apps.length === 0 && (
                  <p className="text-[11px] text-zinc-500">No apps yet — add one below.</p>
                )}
                {apps.map((a, i) => (
                  <div key={`${a.app}-${i}`} className="flex items-center gap-2.5">
                    <span className="text-[12px] text-zinc-200 w-44 truncate" title={a.app}>
                      {a.app}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={a.weight}
                      onChange={(e) =>
                        setApps((prev) => prev.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))
                      }
                      className="flex-1 accent-violet-500"
                    />
                    <span className="text-[11px] text-zinc-500 font-mono tabular-nums w-6 text-right">{a.weight}</span>
                    <button
                      onClick={() => setApps((prev) => prev.filter((_, j) => j !== i))}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addApp(freeText);
                  }}
                  placeholder="Add an app by name…"
                  className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-[12px] text-zinc-200 placeholder:text-zinc-600"
                />
                <button
                  onClick={() => addApp(freeText)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-200 transition-colors"
                >
                  Add
                </button>
              </div>
              {knownApps.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {knownApps
                    .filter((k) => !apps.some((a) => a.app.toLowerCase() === k.app.toLowerCase()))
                    .slice(0, 10)
                    .map((k) => (
                      <button
                        key={k.app}
                        onClick={() => addApp(k.app, k.category || 'other')}
                        className="px-2 py-0.5 rounded-md bg-zinc-800/60 hover:bg-zinc-700 text-[10px] text-zinc-400 transition-colors"
                      >
                        + {k.app}
                      </button>
                    ))}
                </div>
              )}
            </section>

            {/* 3 — Shape */}
            <section>
              <SectionTitle icon={Clock} n={3} title="Shape the day" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Slider label="Weekday length" value={weekdayHours} min={0} max={16} step={0.5} suffix="h" onChange={setWeekdayHours} />
                <Slider label="Weekend length" value={weekendHours} min={0} max={16} step={0.5} suffix="h" onChange={setWeekendHours} />
                <Slider label="Intensity" value={intensity} min={0.3} max={1.5} step={0.05} suffix="×" onChange={setIntensity} />
                <Slider label="Day-to-day variance" value={variance} min={0} max={1} step={0.05} onChange={setVariance} />
                <Slider label="Sessions per day" value={chunksPerDay} min={1} max={20} step={1} onChange={setChunksPerDay} />
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[11px] text-zinc-400">Awake window</span>
                    <span className="text-[11px] text-zinc-300 font-mono tabular-nums">
                      {pad(dayStartHour)}:00–{pad(dayEndHour)}:00
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={dayStartHour}
                      onChange={(e) => setDayStartHour(Math.max(0, Math.min(23, Number(e.target.value))))}
                      className="w-14 px-1.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-200 [color-scheme:dark]"
                    />
                    <span className="text-zinc-600 text-[11px]">to</span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={dayEndHour}
                      onChange={(e) => setDayEndHour(Math.max(1, Math.min(24, Number(e.target.value))))}
                      className="w-14 px-1.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-200 [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 4 — Randomness */}
            <section>
              <SectionTitle icon={Dices} n={4} title="Randomness" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-zinc-400">Seed</span>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value) || 0)}
                  className="w-28 px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-200 font-mono [color-scheme:dark]"
                />
                <button
                  onClick={() => setSeed(Math.floor(Math.random() * 100000))}
                  className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-200 flex items-center gap-1.5 transition-colors"
                >
                  <Dices className="w-3 h-3" /> Re-roll
                </button>
                <span className="text-[11px] text-zinc-600">
                  Same seed always regenerates the identical result
                </span>
              </div>
            </section>

            {/* 5 — Preview */}
            <section>
              <SectionTitle icon={Check} n={5} title="Preview" />
              {loadingCtx && (
                <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking what is already logged…
                </p>
              )}
              <div className="flex flex-wrap gap-4 mb-2.5 text-[11px]">
                <Stat label="Total" value={fmtHours(totals.placedMinutes)} accent="text-white" />
                <Stat label="Days" value={String(totals.days)} />
                <Stat label="Sessions" value={String(totals.spanCount)} />
                {totals.placedMinutes < totals.plannedMinutes && (
                  <span className="text-amber-400/90 self-center text-[10px]">
                    {(totals.plannedMinutes - totals.placedMinutes) / 60 < 1
                      ? `${totals.plannedMinutes - totals.placedMinutes}m`
                      : `${((totals.plannedMinutes - totals.placedMinutes) / 60).toFixed(1)}h`}{' '}
                    could not fit — those hours are already taken
                  </span>
                )}
              </div>

              {days.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-1">
                  {days.map((d) => {
                    const ratio = d.plannedMinutes / Math.max(1, totals.plannedMinutes / Math.max(1, totals.days) * 2);
                    const bg =
                      d.placedMinutes === 0
                        ? 'bg-zinc-800/60'
                        : `rgba(139,92,246,${Math.min(0.85, 0.25 + ratio * 0.5).toFixed(2)})`;
                    return (
                      <div
                        key={d.date}
                        title={`${d.date}${d.isWeekend ? ' (weekend)' : ''} — ${fmtHours(d.placedMinutes)}, ${
                          d.spans.length
                        } sessions`}
                        className="aspect-square rounded-[5px] border border-white/5 flex items-center justify-center"
                        style={{ background: bg }}
                      >
                        <span className="text-[9px] font-mono text-white/70">{d.date.slice(-2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {days.length > 0 && (
                <div className="mt-2.5 max-h-32 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-2 space-y-0.5">
                  {days.slice(0, 12).map((d) => (
                    <div key={d.date} className="flex gap-2 text-[10px] font-mono">
                      <span className="text-zinc-500 w-[86px] shrink-0">
                        {d.date}
                        {d.isWeekend ? ' we' : ''}
                      </span>
                      <span className="text-zinc-600 truncate">
                        {d.spans.length
                          ? d.spans
                              .slice(0, 5)
                              .map((s) => `${s.app} ${hhmm(s.start)}-${hhmm(s.end)}`)
                              .join('  ·  ')
                          : '— nothing fit —'}
                      </span>
                    </div>
                  ))}
                  {days.length > 12 && (
                    <div className="text-[10px] text-zinc-600 pt-0.5">+ {days.length - 12} more days</div>
                  )}
                </div>
              )}
            </section>

            {result && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-[11px]">
                {result.created > 0 && (
                  <p className="text-emerald-400">
                    Created {result.created} {result.created === 1 ? 'entry' : 'entries'}.
                  </p>
                )}
                {result.skipped > 0 && (
                  <p className="text-amber-400">
                    Skipped {result.skipped} (already covered by something else).
                  </p>
                )}
                {result.errors.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-zinc-500">
                    {result.errors.map((e, i) => (
                      <li key={i}>· {e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-zinc-800 bg-zinc-950/40">
            <div className="text-[11px] text-zinc-500">
              {generating && progress
                ? `Writing ${progress.done}/${progress.total}…`
                : `${fmtHours(totals.placedMinutes)} across ${totals.days} ${totals.days === 1 ? 'day' : 'days'}`}
            </div>
            <div className="flex items-center gap-2">
              {!confirmUndo ? (
                <button
                  onClick={() => setConfirmUndo(true)}
                  className="px-3 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                >
                  Undo range
                </button>
              ) : (
                <>
                  <span className="text-[11px] text-red-400">Remove all manual entries in this range?</span>
                  <button
                    onClick={() => setConfirmUndo(false)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={undoRange}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-[11px] text-white"
                  >
                    Remove
                  </button>
                </>
              )}
              <button
                onClick={generate}
                disabled={generating || invalidRange || totals.spanCount === 0 || apps.length === 0}
                className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-[12px] font-medium text-white transition-colors flex items-center gap-1.5"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Generate {totals.spanCount > 0 ? totals.spanCount : ''}
              </button>
            </div>
          </div>

          {apps.length === 0 && (
            <div className="px-5 py-2 border-t border-zinc-800 bg-amber-500/5">
              <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Add at least one app before generating.
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SectionTitle({ icon: Icon, n, title }: { icon: any; n: number; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-[12px] font-medium text-zinc-200 mb-2.5">
      <span className="w-5 h-5 rounded-md bg-violet-500/15 text-violet-400 text-[10px] font-semibold flex items-center justify-center">
        {n}
      </span>
      <Icon className="w-3.5 h-3.5 text-zinc-500" />
      {title}
    </h3>
  );
}

function IconBtn({ children, onClick, title }: { children: any; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
    >
      {children}
    </button>
  );
}

function Stat({ label, value, accent = 'text-zinc-200' }: { label: string; value: string; accent?: string }) {
  return (
    <span>
      <span className="text-zinc-500">{label} </span>
      <span className={`font-mono tabular-nums ${accent}`}>{value}</span>
    </span>
  );
}
