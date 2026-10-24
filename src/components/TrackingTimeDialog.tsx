import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider, SliderControl, SliderTrack, SliderIndicator, SliderThumb } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Clock, AlertTriangle, Check } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LogRow {
  id: number;
  timestamp: string;
  app: string;
  category?: string;
  duration_ms: number;
  title?: string;
  domain?: string | null;
  is_browser_tracking?: number;
}

interface AppDaySummary {
  app: string;
  recordedMs: number;
  rowCount: number;
}

interface TrackingTimeDialogProps {
  open: boolean;
  onClose: () => void;
  initialDate?: Date;
  initialApp?: string | null;
  initialMode?: 'correct' | 'fill' | 'manual';
  onChanged?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fmtMs(ms: number): string {
  if (ms < 0) return '-' + fmtMs(-ms);
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtMsExact(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TrackingTimeDialog({
  open,
  onClose,
  initialDate,
  initialApp,
  initialMode = 'correct',
  onChanged,
}: TrackingTimeDialogProps) {
  const [mode, setMode] = useState<'correct' | 'fill' | 'manual'>(initialMode);
  const [day, setDay] = useState<Date>(initialDate ?? new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [apps, setApps] = useState<AppDaySummary[]>([]);
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<string | null>(initialApp ?? null);
  const [targetMs, setTargetMs] = useState<number>(0);
  const [committing, setCommitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manual-time tab state
  const [manualStart, setManualStart] = useState('09:00');
  const [manualEnd, setManualEnd] = useState('10:00');
  const [manualApp, setManualApp] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  // Load logs for the day
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    (async () => {
      try {
        const all = (await window.deskflowAPI.getLogs()) as LogRow[];
        if (cancelled) return;
        const dk = dayKey(day);
        const dayLogs = all.filter((l) => (l.timestamp || '').slice(0, 10) === dk);
        setLogs(dayLogs);
        // Build app summaries
        const map = new Map<string, { ms: number; n: number }>();
        for (const l of dayLogs) {
          const key = l.domain || l.app || 'Unknown';
          const cur = map.get(key) || { ms: 0, n: 0 };
          cur.ms += l.duration_ms || 0;
          cur.n += 1;
          map.set(key, cur);
        }
        const summaries: AppDaySummary[] = Array.from(map.entries())
          .map(([app, v]) => ({ app, recordedMs: v.ms, rowCount: v.n }))
          .sort((a, b) => b.recordedMs - a.recordedMs);
        setApps(summaries);
        if (!selectedApp && summaries.length > 0) setSelectedApp(summaries[0].app);
        else if (selectedApp && !summaries.find((s) => s.app === selectedApp)) {
          setSelectedApp(summaries.length > 0 ? summaries[0].app : null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load tracking data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, day]);

  // Sync target to selected app's recorded total when app changes
  useEffect(() => {
    if (!selectedApp) { setTargetMs(0); return; }
    const s = apps.find((a) => a.app === selectedApp);
    if (s) setTargetMs(s.recordedMs);
  }, [selectedApp, apps]);

  const selectedSummary = useMemo(() => apps.find((a) => a.app === selectedApp) || null, [apps, selectedApp]);
  const recordedMs = selectedSummary?.recordedMs ?? 0;
  const deltaMs = targetMs - recordedMs;
  // Capacity: 24h minus other apps' recorded time (rough v1 capacity)
  const otherAppsMs = useMemo(() => apps.filter((a) => a.app !== selectedApp).reduce((s, a) => s + a.recordedMs, 0), [apps, selectedApp]);
  const capacityMs = Math.max(0, 86400000 - otherAppsMs);

  const selectedSessions = useMemo(() => {
    if (!selectedApp) return [];
    return logs.filter((l) => (l.domain || l.app) === selectedApp).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  }, [logs, selectedApp]);

  // Commit: scale the selected app's sessions proportionally to hit targetMs
  const handleCommit = async () => {
    if (!selectedApp || selectedSessions.length === 0) return;
    if (targetMs === recordedMs) { setSuccessMsg('No change needed.'); return; }
    setCommitting(true);
    setError(null);
    try {
      const factor = recordedMs > 0 ? targetMs / recordedMs : 1;
      // Scale each session, preserving at least 1s per session, then fix remainder on the last
      const scaled = selectedSessions.map((s, i) => {
        let ms = Math.round((s.duration_ms || 0) * factor);
        if (ms < 1000 && targetMs > 0) ms = 1000;
        return { id: s.id, ms };
      });
      // Fix rounding remainder on the last session
      const sumScaled = scaled.reduce((a, s) => a + s.ms, 0);
      const remainder = targetMs - sumScaled;
      if (scaled.length > 0) scaled[scaled.length - 1].ms = Math.max(1000, scaled[scaled.length - 1].ms + remainder);
      // Apply updates
      for (const s of scaled) {
        const orig = selectedSessions.find((x) => x.id === s.id)!;
        await window.deskflowAPI.updateAppLog(s.id, {
          timestamp: orig.timestamp,
          duration_ms: s.ms,
          title: orig.title || orig.app,
        });
      }
      setSuccessMsg(`Saved: ${fmtMs(recordedMs)} → ${fmtMs(targetMs)} (${deltaMs >= 0 ? '+' : ''}${fmtMs(deltaMs)})`);
      onChanged?.();
      // Reload
      const all = (await window.deskflowAPI.getLogs()) as LogRow[];
      const dk = dayKey(day);
      const dayLogs = all.filter((l) => (l.timestamp || '').slice(0, 10) === dk);
      setLogs(dayLogs);
      const map = new Map<string, { ms: number; n: number }>();
      for (const l of dayLogs) {
        const key = l.domain || l.app || 'Unknown';
        const cur = map.get(key) || { ms: 0, n: 0 };
        cur.ms += l.duration_ms || 0; cur.n += 1; map.set(key, cur);
      }
      setApps(Array.from(map.entries()).map(([app, v]) => ({ app, recordedMs: v.ms, rowCount: v.n })).sort((a, b) => b.recordedMs - a.recordedMs));
    } catch (e: any) {
      setError(e?.message || 'Failed to save correction');
    } finally {
      setCommitting(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualApp.trim()) { setError('App name is required'); return; }
    const [sh, sm] = manualStart.split(':').map(Number);
    const [eh, em] = manualEnd.split(':').map(Number);
    const start = new Date(day); start.setHours(sh, sm, 0, 0);
    const end = new Date(day); end.setHours(eh, em, 0, 0);
    if (end <= start) { setError('End must be after start'); return; }
    setManualSaving(true); setError(null);
    try {
      await window.deskflowAPI.manualAssignCreate({
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        mode: 'custom',
        app: manualApp.trim(),
        category: 'Manual',
      });
      setSuccessMsg(`Added ${fmtMs(end.getTime() - start.getTime())} to ${manualApp.trim()}`);
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || 'Failed to add manual time');
    } finally {
      setManualSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[960px] w-[960px] max-h-[760px] min-h-[560px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-zinc-800/60">
          <DialogTitle className="text-base font-semibold text-zinc-100">Tracking time</DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            {day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-3">
            <TabsTrigger value="correct">Correct recorded time</TabsTrigger>
            <TabsTrigger value="fill">Fill gaps</TabsTrigger>
            <TabsTrigger value="manual">Add manual time</TabsTrigger>
          </TabsList>

          {/* ── Correct recorded time ── */}
          <TabsContent value="correct" className="flex-1 flex min-h-0 px-4 pb-4 pt-3 gap-4">
            {/* Left: app list */}
            <div className="w-[240px] shrink-0 flex flex-col gap-2 min-h-0">
              <input
                type="search"
                placeholder="Search apps…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 px-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              />
              <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                {loading && (
                  <div className="space-y-2">
                    {[0,1,2,3].map(i => <div key={i} className="h-10 rounded-lg bg-zinc-800/40 animate-pulse" />)}
                  </div>
                )}
                {!loading && apps.length === 0 && (
                  <div className="text-xs text-zinc-500 text-center py-8">No tracked sessions on this day.</div>
                )}
                {!loading && apps.filter((a) => !search || a.app.toLowerCase().includes(search.toLowerCase())).map((a) => (
                  <button
                    key={a.app}
                    onClick={() => setSelectedApp(a.app)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${selectedApp === a.app ? 'bg-cyan-500/10 border-cyan-500/30 text-zinc-100' : 'bg-zinc-800/30 border-zinc-700/30 text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-600/40'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{a.app}</span>
                      <span className="text-xs text-zinc-500 tabular-nums shrink-0">{a.rowCount}</span>
                    </div>
                    <div className="text-xs text-zinc-500 tabular-nums mt-0.5">{fmtMs(a.recordedMs)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: slider + commit */}
            <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
              {!selectedApp && !loading && (
                <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">Select an app to correct its recorded time.</div>
              )}
              {selectedApp && (
                <>
                  {/* Recorded vs target */}
                  <div className="rounded-lg bg-zinc-800/30 border border-zinc-700/40 p-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">Recorded</div>
                        <div className="text-2xl font-semibold tabular-nums text-zinc-100">{fmtMs(recordedMs)}</div>
                      </div>
                      <div className="text-zinc-600 text-lg">→</div>
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">Target</div>
                        <div className="text-2xl font-semibold tabular-nums text-cyan-400">{fmtMs(targetMs)}</div>
                      </div>
                      <div className={`text-sm font-medium tabular-nums ${deltaMs >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {deltaMs >= 0 ? '+' : ''}{fmtMs(deltaMs)}
                      </div>
                    </div>
                  </div>

                  {/* Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-zinc-400 font-medium">Total duration</label>
                      <span className="text-xs text-zinc-500 tabular-nums">0 – {fmtMs(capacityMs)}</span>
                    </div>
                    <Slider
                      value={[targetMs]}
                      min={0}
                      max={capacityMs}
                      step={60000}
                      onValueChange={(v: number | readonly number[]) => {
                        const arr = Array.isArray(v) ? v : [v];
                        setTargetMs(arr[0] ?? 0);
                      }}
                      className="w-full"
                    >
                      <SliderControl>
                        <SliderTrack>
                          <SliderIndicator className="bg-cyan-400/80" />
                        </SliderTrack>
                        <SliderThumb className="border-cyan-400/40 focus-visible:ring-cyan-400/30" />
                      </SliderControl>
                    </Slider>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={fmtMsExact(targetMs)}
                        onChange={(e) => {
                          const parts = e.target.value.split(':').map(Number);
                          if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
                            setTargetMs((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000);
                          }
                        }}
                        className="w-28 h-8 text-xs font-mono tabular-nums bg-zinc-800/50 border-zinc-700/50"
                      />
                      <span className="text-xs text-zinc-500">HH:MM:SS (exact)</span>
                      <button
                        onClick={() => setTargetMs(recordedMs)}
                        className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 underline"
                      >
                        Reset to recorded
                      </button>
                    </div>
                  </div>

                  {/* Preview diff */}
                  <div className="rounded-lg bg-zinc-800/20 border border-zinc-700/30 p-3 text-xs text-zinc-400 space-y-1">
                    <div className="font-medium text-zinc-300 mb-1">Preview</div>
                    <div className="flex justify-between"><span>Sessions in this app/day</span><span className="tabular-nums">{selectedSessions.length}</span></div>
                    <div className="flex justify-between"><span>Recorded total</span><span className="tabular-nums">{fmtMs(recordedMs)}</span></div>
                    <div className="flex justify-between"><span>Target total</span><span className="tabular-nums text-cyan-400">{fmtMs(targetMs)}</span></div>
                    <div className="flex justify-between"><span>Change</span><span className={`tabular-nums ${deltaMs >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{deltaMs >= 0 ? '+' : ''}{fmtMs(deltaMs)}</span></div>
                    <div className="flex justify-between"><span>Other apps (untouched)</span><span className="tabular-nums">{fmtMs(otherAppsMs)}</span></div>
                    <div className="flex justify-between"><span>Day capacity used after</span><span className="tabular-nums">{fmtMs(targetMs + otherAppsMs)} / 24h</span></div>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
                    </div>
                  )}
                  {successMsg && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400 flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 shrink-0" /> {successMsg}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-auto">
                    <Button
                      onClick={handleCommit}
                      disabled={committing || targetMs === recordedMs || selectedSessions.length === 0}
                      className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-40"
                    >
                      {committing ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Applying…</> : 'Apply correction'}
                    </Button>
                    <span className="text-[10px] text-zinc-600">Scales this app's sessions proportionally. Aggregates rebuild on next stats refresh.</span>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ── Fill gaps ── */}
          <TabsContent value="fill" className="flex-1 flex flex-col min-h-0 px-4 pb-4 pt-3">
            <div className="text-sm text-zinc-400 mb-3">Detected gaps for this day. Assign an app to fill a gap, or skip it.</div>
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              <div className="text-xs text-zinc-500 text-center py-8">Gap queue integration pending — use the existing Fill gaps flow for now.</div>
            </div>
          </TabsContent>

          {/* ── Add manual time ── */}
          <TabsContent value="manual" className="flex-1 flex flex-col min-h-0 px-4 pb-4 pt-3 gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">App</label>
                <Input value={manualApp} onChange={(e) => setManualApp(e.target.value)} placeholder="e.g. zen" className="h-9 text-sm bg-zinc-800/50 border-zinc-700/50" />
              </div>
              <div />
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Start</label>
                <Input value={manualStart} onChange={(e) => setManualStart(e.target.value)} placeholder="HH:MM" className="h-9 text-xs font-mono bg-zinc-800/50 border-zinc-700/50" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">End</label>
                <Input value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} placeholder="HH:MM" className="h-9 text-xs font-mono bg-zinc-800/50 border-zinc-700/50" />
              </div>
            </div>
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
              </div>
            )}
            {successMsg && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 shrink-0" /> {successMsg}
              </div>
            )}
            <div className="mt-auto">
              <Button
                onClick={handleManualAdd}
                disabled={manualSaving || !manualApp.trim()}
                className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-40"
              >
                {manualSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Adding…</> : 'Add manual time'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-4 py-3 border-t border-zinc-800/60">
          <span className="text-[10px] text-zinc-600 mr-auto">Day: {dayKey(day)}</span>
          <Button variant="ghost" onClick={onClose} className="text-zinc-400">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TrackingTimeDialog;