import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppWindow, CalendarClock, Check, Clock, Dices, FolderKanban, Grid3X3, Layers, Pencil, Sparkles, Trash2, X, AlertTriangle, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { freeSpans, scatterChunks, type TimeInterval } from '@/lib/external/manualTime';
import { CustomConfirmDialog } from '@/components/ai/canvas/CustomConfirmDialog';
import type { ManualAssignment } from '@/types/deskflow-api';

const MS_MIN = 60 * 1000;

function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function dateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatHM(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = minutes / 60;
    return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)}h`;
  }
  return `${Math.round(minutes)}m`;
}

export function ManualAssignModal({
  open,
  initialDate,
  initialGap,
  onClose,
  onChanged,
}: {
  open: boolean;
  initialDate?: Date;
  initialGap?: { start: Date; end: Date } | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [day, setDay] = useState<Date>(initialDate ?? new Date());
  const [mode, setMode] = useState<'random' | 'custom'>('random');
  const [loading, setLoading] = useState(false);
  const [tracked, setTracked] = useState<TimeInterval[]>([]);
  const [external, setExternal] = useState<Array<{ started_at: string; ended_at: string; activity_name: string }>>([]);
  const [manual, setManual] = useState<ManualAssignment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ManualAssignment | null>(null);

  // Random mode inputs
  const [spanStart, setSpanStart] = useState<string>('09:00');
  const [spanEnd, setSpanEnd] = useState<string>('17:00');
  const [totalMinutes, setTotalMinutes] = useState<number>(120);
  const [chunkCount, setChunkCount] = useState<number>(4);
  const [preview, setPreview] = useState<TimeInterval[]>([]);

  // App pool: where random chunks get their app identity from
  type KnownApp = { app: string; category?: string; last_used?: string | null; is_browser_tracking?: boolean };
  type FocusGroupLite = { id: number | string; name?: string; allowed_apps?: string[]; allowed_domains?: string[]; allowed_categories?: string[] };
  const [poolSource, setPoolSource] = useState<'focus' | 'category' | 'known'>('known');
  const [knownApps, setKnownApps] = useState<KnownApp[]>([]);
  const [focusGroups, setFocusGroups] = useState<FocusGroupLite[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [chunkApps, setChunkApps] = useState<string[]>([]);

  // Custom mode: painted 30-min cells within free spans (index = minutes/30)
  const [painted, setPainted] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    if (initialDate) setDay(initialDate);
    if (initialGap) {
      setSpanStart(format(initialGap.start, 'HH:mm'));
      setSpanEnd(format(initialGap.end, 'HH:mm'));
      setTotalMinutes(Math.max(30, Math.round((initialGap.end.getTime() - initialGap.start.getTime()) / MS_MIN)));
    }
    setError(null);
    setSuccess(null);
    setPreview([]);
    setPreviewNotice(null);
    setPainted(new Set());
    setPendingDelete(null);
  }, [open, initialDate, initialGap]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    (window as any).deskflowAPI?.manualAssignDayContext?.(dateKey(day))
      .then((ctx: { tracked: Array<{ started_at: string; ended_at: string; app?: string | null }>; external: Array<{ started_at: string; ended_at: string; activity_name: string }>; manual: ManualAssignment[] }) => {
        if (cancelled) return;
        setTracked((ctx.tracked || []).map((t) => ({
          start: new Date(t.started_at),
          end: new Date(t.ended_at),
          app: t.app || null,
        })));
        setExternal(ctx.external || []);
        setManual(ctx.manual || []);
      })
      .catch(() => {
        if (!cancelled) {
          setTracked([]);
          setManual([]);
          setError('Failed to load day context');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, day]);

  // Load the app pool sources (known apps + focus groups) once per open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (window as any).deskflowAPI?.getKnownApps?.()
      .then((apps: KnownApp[]) => { if (!cancelled) setKnownApps(apps || []); })
      .catch(() => { if (!cancelled) setKnownApps([]); });
    (window as any).deskflowAPI?.focusGroup?.list?.()
      .then((groups: FocusGroupLite[]) => { if (!cancelled) setFocusGroups(groups || []); })
      .catch(() => { if (!cancelled) setFocusGroups([]); });
    return () => { cancelled = true; };
  }, [open]);

  const dayStart = useMemo(() => {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [day]);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // ---- App pool (random mode) ----
  // The current app names in the pool, per pool source.
  const poolApps = useMemo<string[]>(() => {
    if (poolSource === 'focus') {
      const g = focusGroups.find((grp) => String(grp.id) === selectedGroupId);
      return g?.allowed_apps || [];
    }
    if (poolSource === 'category') {
      return knownApps.filter((k) => selectedCategories.includes(k.category || '')).map((k) => k.app);
    }
    // 'known' — real apps from the tracking logs, most recently used first.
    return knownApps.map((k) => k.app);
  }, [poolSource, focusGroups, selectedGroupId, knownApps, selectedCategories]);

  const uniquePoolApps = useMemo(() => Array.from(new Set(poolApps)), [poolApps]);

  // Default every pool app to weight 1 when the pool changes; keep user edits.
  useEffect(() => {
    if (uniquePoolApps.length === 0) return;
    setWeights((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const app of uniquePoolApps) {
        if (typeof next[app] !== 'number' || next[app] < 0) {
          next[app] = 1;
          changed = true;
        }
      }
      // Drop weights for apps no longer in the pool.
      for (const key of Object.keys(next)) {
        if (!uniquePoolApps.includes(key)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [uniquePoolApps]);

  const poolCategory = useMemo(() => {
    const map: Record<string, string> = {};
    for (const k of knownApps) if (!map[k.app]) map[k.app] = k.category || 'neutral';
    return map;
  }, [knownApps]);

  const setWeight = (app: string, value: number) => {
    setWeights((prev) => ({ ...prev, [app]: Math.max(0, value || 0) }));
  };

  const resetWeights = () => {
    setWeights(Object.fromEntries(uniquePoolApps.map((a) => [a, 1])));
  };

  // Weighted random pick from the pool.
  const weightedPick = useMemo(
    () => (): string => {
      const apps = uniquePoolApps;
      if (apps.length === 0) return '';
      const total = apps.reduce((s, a) => s + (weights[a] ?? 1), 0);
      if (total <= 0) return apps[Math.floor(Math.random() * apps.length)];
      let r = Math.random() * total;
      for (const a of apps) {
        r -= weights[a] ?? 1;
        if (r <= 0) return a;
      }
      return apps[apps.length - 1];
    },
    [uniquePoolApps, weights]
  );

  const dayEnd = useMemo(() => new Date(dayStart.getTime() + 24 * 60 * 60 * 1000), [dayStart]);

  // Existing manual assignments as intervals — they occupy space too.
  const manualIntervals = useMemo<TimeInterval[]>(
    () => manual.map((m) => ({ start: new Date(m.started_at), end: new Date(m.ended_at) })),
    [manual]
  );

  // Free spans for the whole day (min 30 min to be paintable). Existing
  // manual assignments count as occupied — the Free stat must reflect what
  // is actually paintable, not just what auto-tracking logged.
  const free = useMemo(
    () => freeSpans(dayStart, dayEnd, [...tracked, ...manualIntervals], 30),
    [dayStart, dayEnd, tracked, manualIntervals]
  );

  const freeMinutes = useMemo(
    () => free.reduce((sum, f) => sum + (f.end.getTime() - f.start.getTime()) / MS_MIN, 0),
    [free]
  );

  const manualMinutes = useMemo(
    () => manual.reduce((sum, m) => sum + m.duration_seconds / 60, 0),
    [manual]
  );

  const trackedMinutes = useMemo(
    () => tracked.reduce((sum, t) => sum + (t.end.getTime() - t.start.getTime()) / MS_MIN, 0),
    [tracked]
  );

  const externalMinutes = useMemo(
    () => external.reduce((sum, ex) => sum + (new Date(ex.ended_at).getTime() - new Date(ex.started_at).getTime()) / MS_MIN, 0),
    [external]
  );

  // Cell index → time helpers for custom painting (48 cells of 30 min)
  const cellStart = (idx: number) => new Date(dayStart.getTime() + idx * 30 * MS_MIN);

  const isCellFree = (idx: number): boolean => {
    const s = cellStart(idx);
    const e = new Date(s.getTime() + 30 * MS_MIN);
    for (const occ of [...tracked, ...manualIntervals]) {
      if (occ.start.getTime() < e.getTime() && occ.end.getTime() > s.getTime()) return false;
    }
    return true;
  };

  const isCellManual = (idx: number): boolean => {
    const s = cellStart(idx);
    const e = new Date(s.getTime() + 30 * MS_MIN);
    for (const m of manualIntervals) {
      if (m.start.getTime() < e.getTime() && m.end.getTime() > s.getTime()) return true;
    }
    return false;
  };

  const toggleCell = (idx: number) => {
    if (!isCellFree(idx)) return;
    setPainted((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const paintedMinutes = useMemo(() => painted.size * 30, [painted]);

  // Build painted blocks as contiguous runs → intervals.
  const paintedBlocks = useMemo(() => {
    const sorted = Array.from(painted).sort((a, b) => a - b);
    const blocks: TimeInterval[] = [];
    let runStart: number | null = null;
    let prev: number | null = null;
    for (const idx of sorted) {
      if (runStart === null) runStart = idx;
      else if (prev !== null && idx !== prev + 1) {
        blocks.push({ start: cellStart(runStart), end: new Date(cellStart(prev).getTime() + 30 * MS_MIN) });
        runStart = idx;
      }
      prev = idx;
    }
    if (runStart !== null && prev !== null) {
      blocks.push({ start: cellStart(runStart), end: new Date(cellStart(prev).getTime() + 30 * MS_MIN) });
    }
    return blocks;
  }, [painted, dayStart]);

  const runPreview = () => {
    const start = new Date(dayStart);
    const [sh, sm] = spanStart.split(':').map(Number);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(dayStart);
    const [eh, em] = spanEnd.split(':').map(Number);
    end.setHours(eh, em, 0, 0);
    if (end.getTime() <= start.getTime()) {
      setError('Span end must be after span start');
      setPreview([]);
      setPreviewNotice(null);
      return;
    }
    if ((totalMinutes || 0) <= 0) {
      setError('Enter a total greater than 0');
      setPreview([]);
      setPreviewNotice(null);
      return;
    }
    setError(null);
    const chunks = scatterChunks({
      spanStart: start,
      spanEnd: end,
      totalMinutes: totalMinutes || 0,
      chunkCount: chunkCount || 1,
      occupied: [...tracked, ...manualIntervals],
      minChunkMinutes: 15,
    });
    setChunkApps(chunks.map(() => weightedPick()));
    const placed = chunks.reduce((s, c) => s + (c.end.getTime() - c.start.getTime()) / MS_MIN, 0);
    if (chunks.length === 0) {
      setPreviewNotice('No free space in this span — every minute is already tracked or assigned.');
    } else if (placed < (totalMinutes || 0) - 0.6) {
      setPreviewNotice(`Only ${formatMinutes(placed)} of ${formatMinutes(totalMinutes || 0)} could fit in the free space.`);
    } else {
      setPreviewNotice(null);
    }
    setPreview(chunks);
  };

  const applyRandom = async () => {
    if (preview.length === 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    let failed = false;
    try {
      for (let i = 0; i < preview.length; i++) {
        const chunk = preview[i];
        const app = chunkApps[i] || null;
        const res = await (window as any).deskflowAPI?.manualAssignCreate?.({
          startedAt: toLocalIso(chunk.start),
          endedAt: toLocalIso(chunk.end),
          mode: 'random',
          app,
          category: app ? poolCategory[app] || null : null,
        });
        if (res && res.ok === false) {
          failed = true;
          setError(`${res.error || 'Assignment rejected'} (${formatHM(chunk.start)} — ${formatHM(chunk.end)})`);
          break;
        }
      }
      // Refresh regardless — chunks before the failure were saved and must
      // show on the strip; the stale preview is cleared so retry regenerates
      // against the fresh day context instead of re-attempting overlaps.
      const ctx = await (window as any).deskflowAPI?.manualAssignDayContext?.(dateKey(day));
      setManual(ctx?.manual || []);
      setPreview([]);
      setPreviewNotice(null);
      if (!failed) {
        setSuccess(`Assigned ${formatMinutes(preview.reduce((s, c) => s + (c.end.getTime() - c.start.getTime()) / MS_MIN, 0))} across ${preview.length} block${preview.length === 1 ? '' : 's'}`);
      }
      onChanged?.();
    } catch (err: any) {
      failed = true;
      setError(err?.message || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  const applyCustom = async () => {
    if (paintedBlocks.length === 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    let failed = false;
    try {
      for (const block of paintedBlocks) {
        const res = await (window as any).deskflowAPI?.manualAssignCreate?.({
          startedAt: toLocalIso(block.start),
          endedAt: toLocalIso(block.end),
          mode: 'custom',
        });
        if (res && res.ok === false) {
          failed = true;
          setError(`${res.error || 'Assignment rejected'} (${formatHM(block.start)} — ${formatHM(block.end)})`);
          // Drop only the rejected block's cells so the rest stay paintable.
          setPainted((prev) => {
            const next = new Set(prev);
            for (let i = 0; i < 48; i++) {
              const s = cellStart(i);
              const e = new Date(s.getTime() + 30 * MS_MIN);
              if (block.start.getTime() < e.getTime() && block.end.getTime() > s.getTime()) next.delete(i);
            }
            return next;
          });
          break;
        }
      }
      const ctx = await (window as any).deskflowAPI?.manualAssignDayContext?.(dateKey(day));
      setManual(ctx?.manual || []);
      if (!failed) {
        setPainted(new Set());
        setSuccess(`Added ${formatMinutes(paintedBlocks.reduce((s, b) => s + (b.end.getTime() - b.start.getTime()) / MS_MIN, 0))} of manual time`);
      }
      onChanged?.();
    } catch (err: any) {
      failed = true;
      setError(err?.message || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  const deleteAssignment = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await (window as any).deskflowAPI?.manualAssignDelete?.(id);
      if (res && res.ok === false) {
        setError(res.error || 'Delete failed');
        return;
      }
      const ctx = await (window as any).deskflowAPI?.manualAssignDayContext?.(dateKey(day));
      setManual(ctx?.manual || []);
      setSuccess('Manual assignment removed');
      onChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Delete failed');
    }
  };

  const prevDay = () => {
    setDay(new Date(dayStart.getTime() - 24 * 60 * 60 * 1000));
    setPainted(new Set());
    setPreview([]);
    setPreviewNotice(null);
    setSuccess(null);
    setError(null);
  };
  const nextDay = () => {
    setDay(new Date(dayStart.getTime() + 24 * 60 * 60 * 1000));
    setPainted(new Set());
    setPreview([]);
    setPreviewNotice(null);
    setSuccess(null);
    setError(null);
  };

  // Escape closes the modal — unless the delete-confirm dialog is open (it
  // owns Escape while visible).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pendingDelete) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, pendingDelete, onClose]);

  // Changing any random-mode input invalidates the current preview — never
  // apply a preview generated for different parameters.
  useEffect(() => {
    setPreview([]);
    setPreviewNotice(null);
    setChunkApps([]);
  }, [spanStart, spanEnd, totalMinutes, chunkCount, poolSource, selectedGroupId, selectedCategories, weights]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close manual time modal"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative flex max-h-[85vh] w-full max-w-[680px] flex-col rounded-xl border border-white/10 bg-zinc-900/60 backdrop-blur-xl"
          >
            <div className="border-b border-white/10 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-medium text-zinc-100">
                    Manual Time
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
                    <CalendarClock className="h-4 w-4 text-violet-400/80" />
                    Fill empty spans with claimed time — never overwrites real tracking
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Day picker */}
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={prevDay}
                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  aria-label="Previous day"
                >
                  ‹
                </button>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-200">
                  {format(dayStart, 'EEE, MMM d')}
                </div>
                <button
                  onClick={nextDay}
                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  aria-label="Next day"
                >
                  ›
                </button>

                {dayStart.getTime() !== todayStart.getTime() && (
                  <button
                    onClick={() => {
                      setDay(new Date());
                      setPainted(new Set());
                      setPreview([]);
                      setPreviewNotice(null);
                    }}
                    className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  >
                    Today
                  </button>
                )}

                <div className="flex-1" />

                {/* Mode toggle */}
                <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                  <button
                    onClick={() => setMode('random')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      mode === 'random' ? 'bg-violet-500/25 text-violet-200' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Dices className="h-3.5 w-3.5" />
                    Random
                  </button>
                  <button
                    onClick={() => setMode('custom')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      mode === 'custom' ? 'bg-violet-500/25 text-violet-200' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Custom
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* 24h strip */}
              <div className="mb-1 flex text-[10px] text-zinc-600">
                {Array.from({ length: 25 }, (_, i) => (
                  <div key={i} className="flex-1 text-left pl-0.5">{i}:00</div>
                ))}
              </div>
              <div className="relative mb-4 h-12 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/40">
                {/* hour ticks */}
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-white/[0.04]"
                    style={{ left: `${(i / 24) * 100}%` }}
                  />
                ))}
                {/* tracked blocks (sky) */}
                {tracked.map((t, i) => (
                  <div
                    key={`t${i}`}
                    className="absolute top-0 bottom-0 bg-sky-500/40"
                    style={{
                      left: `${((t.start.getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000)) * 100}%`,
                      width: `${((t.end.getTime() - t.start.getTime()) / (24 * 60 * 60 * 1000)) * 100}%`,
                    }}
                    title={`Tracked: ${t.app || 'app'} (${formatHM(t.start)} — ${formatHM(t.end)})`}
                  />
                ))}
                {/* external blocks (amber) */}
                {external.map((ex, i) => (
                  <div
                    key={`x${i}`}
                    className="absolute top-0 bottom-0 bg-amber-500/40"
                    style={{
                      left: `${((new Date(ex.started_at).getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000)) * 100}%`,
                      width: `${((new Date(ex.ended_at).getTime() - new Date(ex.started_at).getTime()) / (24 * 60 * 60 * 1000)) * 100}%`,
                    }}
                    title={`External: ${ex.activity_name} (${formatHM(new Date(ex.started_at))} — ${formatHM(new Date(ex.ended_at))})`}
                  />
                ))}
                {/* manual blocks (violet) */}
                {manual.map((m) => (
                  <div
                    key={`m${m.id}`}
                    className="absolute top-0 bottom-0 bg-violet-500/60"
                    style={{
                      left: `${((new Date(m.started_at).getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000)) * 100}%`,
                      width: `${((new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()) / (24 * 60 * 60 * 1000)) * 100}%`,
                    }}
                    title={`Manual (${m.mode})${m.app ? ` · ${m.app}` : ''}: ${formatHM(new Date(m.started_at))} — ${formatHM(new Date(m.ended_at))}`}
                  />
                ))}
                {/* random preview */}
                {preview.map((c, i) => (
                  <div
                    key={`p${i}`}
                    className="absolute top-0 bottom-0 animate-pulse bg-violet-300/80"
                    style={{
                      left: `${((c.start.getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000)) * 100}%`,
                      width: `${((c.end.getTime() - c.start.getTime()) / (24 * 60 * 60 * 1000)) * 100}%`,
                    }}
                    title={`Preview: ${formatHM(c.start)} — ${formatHM(c.end)}${chunkApps[i] ? ` · ${chunkApps[i]}` : ''}`}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="mb-4 flex items-center gap-4 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-500/40" /> App tracking</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/40" /> External</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-500/60" /> Manual</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-300/80" /> Preview</span>
              </div>

              {/* Summary stats */}
              <div className="mb-4 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-lg font-semibold text-zinc-100">{formatMinutes(freeMinutes)}</div>
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500">Free</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-lg font-semibold text-sky-200">{formatMinutes(trackedMinutes)}</div>
                  <div className="text-[11px] uppercase tracking-wider text-sky-400/70">App</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-lg font-semibold text-amber-200">{formatMinutes(externalMinutes)}</div>
                  <div className="text-[11px] uppercase tracking-wider text-amber-400/70">External</div>
                </div>
                <div className="rounded-xl border border-violet-400/20 bg-violet-400/10 p-3">
                  <div className="text-lg font-semibold text-violet-200">{formatMinutes(manualMinutes)}</div>
                  <div className="text-[11px] uppercase tracking-wider text-violet-400/70">Manual</div>
                </div>
              </div>

              {/* Already filled today — shows what time is occupied so the user knows what can't be assigned */}
              {(tracked.length > 0 || manual.length > 0) && (
                <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                      <Activity className="h-3.5 w-3.5 text-zinc-500" />
                      Already filled today
                    </div>
                    <span className="text-[11px] text-zinc-500">
                      {formatMinutes(
                        tracked.reduce((s, t) => s + (t.end.getTime() - t.start.getTime()) / MS_MIN, 0) +
                        manual.reduce((s, m) => s + m.duration_seconds / 60, 0)
                      )} occupied
                    </span>
                  </div>
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                    {tracked.map((t, i) => (
                      <div
                        key={`ft${i}`}
                        className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-400"
                        title={`Tracked: ${formatHM(t.start)} — ${formatHM(t.end)}`}
                      >
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
                        <span>{formatHM(t.start)} – {formatHM(t.end)}</span>
                        {t.app && <span className="truncate max-w-[80px] text-zinc-500">{t.app}</span>}
                        <span className="text-zinc-600">
                          ({formatMinutes((t.end.getTime() - t.start.getTime()) / MS_MIN)})
                        </span>
                      </div>
                    ))}
                    {external.map((ex, i) => (
                      <div
                        key={`fx${i}`}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-400/15 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300/90"
                        title={`External: ${ex.activity_name} (${formatHM(new Date(ex.started_at))} — ${formatHM(new Date(ex.ended_at))})`}
                      >
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        <span>{formatHM(new Date(ex.started_at))} – {formatHM(new Date(ex.ended_at))}</span>
                        <span className="truncate max-w-[80px] text-amber-400/60">{ex.activity_name}</span>
                        <span className="text-amber-500/40">
                          ({formatMinutes((new Date(ex.ended_at).getTime() - new Date(ex.started_at).getTime()) / MS_MIN)})
                        </span>
                      </div>
                    ))}
                    {manual.map((m) => (
                      <div
                        key={`fm${m.id}`}
                        className="flex items-center gap-1.5 rounded-lg border border-violet-400/15 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-300/90"
                        title={`Manual (${m.mode})${m.app ? ` · ${m.app}` : ''}: ${formatHM(new Date(m.started_at))} — ${formatHM(new Date(m.ended_at))}`}
                      >
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                        <span>{formatHM(new Date(m.started_at))} – {formatHM(new Date(m.ended_at))}</span>
                        {m.app && <span className="truncate max-w-[80px] text-violet-400/60">{m.app}</span>}
                        <span className="text-violet-500/40">
                          ({formatMinutes(m.duration_seconds / 60)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-8 text-sm text-zinc-500">
                  <Clock className="mr-2 h-4 w-4 animate-spin" /> Loading day…
                </div>
              ) : mode === 'random' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-zinc-400">Span start</span>
                      <input
                        type="time"
                        value={spanStart}
                        onChange={(e) => setSpanStart(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-400/40"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-zinc-400">Span end</span>
                      <input
                        type="time"
                        value={spanEnd}
                        onChange={(e) => setSpanEnd(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-400/40"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-zinc-400">Total minutes to assign</span>
                      <input
                        type="number"
                        min={15}
                        step={15}
                        value={totalMinutes}
                        onChange={(e) => setTotalMinutes(Number(e.target.value) || 0)}
                        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-400/40"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-zinc-400">Number of chunks</span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={chunkCount}
                        onChange={(e) => setChunkCount(Number(e.target.value) || 1)}
                        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-400/40"
                      />
                    </label>
                  </div>

                  {/* App pool: where random chunks get their app identity */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                      <Layers className="h-3.5 w-3.5 text-violet-300" />
                      App pool
                    </div>
                    <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                      {([
                        { key: 'focus', label: 'Focus group', icon: FolderKanban },
                        { key: 'category', label: 'Category', icon: Grid3X3 },
                        { key: 'known', label: 'Known apps', icon: AppWindow },
                      ] as const).map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => setPoolSource(key)}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                            poolSource === key ? 'bg-violet-500/25 text-violet-200' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>

                    {poolSource === 'focus' && (
                      <div className="mt-3">
                        <label className="mb-1 block text-xs text-zinc-500">Select a focus group</label>
                        <select
                          value={selectedGroupId}
                          onChange={(e) => { setSelectedGroupId(e.target.value); setSelectedCategories([]); }}
                          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-400/40"
                        >
                          <option value="">{focusGroups.length === 0 ? 'No focus groups' : 'Choose a group…'}</option>
                          {focusGroups.map((g) => (
                            <option key={String(g.id)} value={String(g.id)}>
                              {g.name || `Group ${g.id}`}
                            </option>
                          ))}
                        </select>
                        {uniquePoolApps.length === 0 && selectedGroupId && (
                          <p className="mt-2 text-[11px] text-zinc-500">
                            This group has no allowed apps — add apps to the group, or pick another pool source.
                          </p>
                        )}
                      </div>
                    )}

                    {poolSource === 'category' && (
                      <div className="mt-3">
                        <div className="mb-1 block text-xs text-zinc-500">Pick categories</div>
                        <div className="flex flex-wrap gap-2">
                          {Array.from(new Set(knownApps.map((k) => k.category || 'neutral'))).map((cat) => (
                            <button
                              key={cat}
                              onClick={() =>
                                setSelectedCategories((prev) =>
                                  prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                                )
                              }
                              className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                                selectedCategories.includes(cat)
                                  ? 'border-violet-400/60 bg-violet-500/25 text-violet-100'
                                  : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:bg-white/5'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                          {knownApps.length === 0 && <span className="text-xs text-zinc-500">No known apps yet</span>}
                        </div>
                        {selectedCategories.length === 0 && (
                          <p className="mt-2 text-[11px] text-zinc-500">Pick at least one category to build the pool.</p>
                        )}
                      </div>
                    )}

                    {poolSource === 'known' && (
                      <p className="mt-3 text-[11px] text-zinc-500">
                        All {uniquePoolApps.length} real apps from your tracking logs (most recently used first).
                      </p>
                    )}

                    {uniquePoolApps.length > 0 && (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs text-zinc-500">Ratios — how likely each app is picked</span>
                          <button
                            onClick={resetWeights}
                            className="text-[11px] text-violet-300/80 underline-offset-2 hover:underline"
                          >
                            Reset to equal
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {uniquePoolApps.slice(0, 12).map((app) => (
                            <div key={app} className="flex items-center gap-3">
                              <span className="w-40 truncate text-xs text-zinc-300" title={app}>
                                {app}
                              </span>
                              <input
                                type="range"
                                min={0}
                                max={10}
                                step={1}
                                value={weights[app] ?? 1}
                                onChange={(e) => setWeight(app, Number(e.target.value))}
                                className="flex-1 accent-violet-400"
                              />
                              <span className="w-8 text-right text-xs tabular-nums text-zinc-400">
                                {weights[app] ?? 1}
                              </span>
                            </div>
                          ))}
                          {uniquePoolApps.length > 12 && (
                            <p className="pt-1 text-[11px] text-zinc-500">
                              +{uniquePoolApps.length - 12} more apps (weight 1)
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 text-xs text-violet-200/90">
                    <Sparkles className="h-4 w-4 shrink-0 text-violet-300" />
                    Random mode scatters {chunkCount} block{chunkCount === 1 ? '' : 's'} totaling {formatMinutes(totalMinutes || 0)} inside the span, assigning each to an app from the pool weighted by your ratios — skipping anything already tracked or assigned.
                  </div>

                  {previewNotice && (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
                      {previewNotice}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={runPreview}
                      disabled={saving}
                      className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-violet-400 disabled:opacity-50"
                    >
                      Generate preview
                    </button>
                    {preview.length > 0 && (
                      <button
                        onClick={applyRandom}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        Assign {preview.length} block{preview.length === 1 ? '' : 's'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 text-xs text-violet-200/90">
                    <Pencil className="h-4 w-4 shrink-0 text-violet-300" />
                    Click 30-minute cells below to paint exact blocks. Tracked or already-assigned cells are locked. Painted time: {formatMinutes(paintedMinutes)}.
                  </div>

                  <div className="grid grid-cols-12 gap-1.5">
                    {Array.from({ length: 48 }, (_, idx) => {
                      const free = isCellFree(idx);
                      const paintedCell = painted.has(idx);
                      const hour = Math.floor(idx / 2);
                      const half = idx % 2 === 1;
                      return (
                        <button
                          key={idx}
                          onClick={() => toggleCell(idx)}
                          disabled={!free}
                          title={free ? `${formatHM(cellStart(idx))} — ${formatHM(new Date(cellStart(idx).getTime() + 30 * MS_MIN))}` : isCellManual(idx) ? 'Already assigned — locked' : 'Tracked — locked'}
                          className={`flex h-8 items-center justify-center rounded-md border text-[9px] font-medium transition ${
                            paintedCell
                              ? 'border-violet-400/60 bg-violet-500/50 text-violet-100'
                              : free
                                ? 'border-white/10 bg-white/[0.03] text-zinc-500 hover:border-violet-400/40 hover:bg-violet-400/10'
                                : 'cursor-not-allowed border-white/5 bg-zinc-800/60 text-zinc-700'
                          }`}
                        >
                          {half ? '·' : hour}
                        </button>
                      );
                    })}
                  </div>

                  {paintedBlocks.length > 0 && (
                    <button
                      onClick={applyCustom}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Add {paintedBlocks.length} block{paintedBlocks.length === 1 ? '' : 's'} ({formatMinutes(paintedMinutes)})
                    </button>
                  )}
                </div>
              )}

              {/* Existing manual assignments */}
              {manual.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Existing manual assignments
                  </div>
                  <div className="space-y-2">
                    {manual.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-2.5"
                      >
                        <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-violet-400" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-zinc-200">
                            {formatHM(new Date(m.started_at))} — {formatHM(new Date(m.ended_at))}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {m.mode} • {formatMinutes(m.duration_seconds / 60)}
                          </div>
                        </div>
                        <button
                          onClick={() => setPendingDelete(m)}
                          className="rounded-lg border border-white/10 p-1.5 text-zinc-500 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300"
                          aria-label={`Delete assignment ${formatHM(new Date(m.started_at))}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
                  {error}
                </div>
              )}
              {success && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                  <Check className="h-4 w-4 shrink-0 text-emerald-300" />
                  {success}
                </div>
              )}
            </div>
          </motion.div>

          <CustomConfirmDialog
            open={!!pendingDelete}
            title="Remove manual assignment?"
            message={
              pendingDelete
                ? `Remove the manual block ${formatHM(new Date(pendingDelete.started_at))} — ${formatHM(new Date(pendingDelete.ended_at))} (${formatMinutes(pendingDelete.duration_seconds / 60)})? Only the claimed time is removed — real tracked time is never touched.`
                : ''
            }
            confirmLabel="Remove"
            variant="danger"
            onConfirm={() => {
              if (pendingDelete) deleteAssignment(pendingDelete.id);
              setPendingDelete(null);
            }}
            onCancel={() => setPendingDelete(null)}
          />
        </div>
      )}
    </AnimatePresence>
  );
}