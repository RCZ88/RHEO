// PhoneStatsPanel.tsx — the desktop half of the phone-stats feature.
//
// The sync server has served GET /v1/phone/telemetry/live and /summary since the
// feature was specced, but there was no IPC channel, no preload binding and no UI
// calling them — so `phone_telemetry` had no producer AND no consumer, and the
// feature was invisible from both ends.
//
// Four states are all handled explicitly (empty / loading / error / populated), and
// a "never reported" state is distinct from "reported 0 seconds" — a phone that has
// simply never pushed is the common case and must not read as "0 minutes today".
import { useState, useEffect, useCallback } from 'react';
import { Smartphone, RefreshCw, BatteryFull, BatteryMedium, BatteryLow, Loader2, AlertTriangle, WifiOff } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface PhoneLive {
  device_name: string | null;
  device_platform: string | null;
  device_platform_version: string | null;
  current_battery: number | null;
  battery_state: string | null;
  today_deskflow_foreground_sec: number;
  today_deskflow_background_sec: number;
  last_seen: string | null;
  is_online: boolean;
}

interface PhoneDaily {
  date: string;
  foreground_sec: number;
  background_sec: number;
  avg_battery: number | null;
  latest_battery: number | null;
}

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return '0m';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtLastSeen(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return 'unknown';
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function BatteryIcon({ pct }: { pct: number }) {
  if (pct <= 20) return <BatteryLow className="w-4 h-4 text-rose-400" />;
  if (pct <= 60) return <BatteryMedium className="w-4 h-4 text-amber-400" />;
  return <BatteryFull className="w-4 h-4 text-emerald-400" />;
}

export function PhoneStatsPanel() {
  const [live, setLive] = useState<PhoneLive | null>(null);
  const [daily, setDaily] = useState<PhoneDaily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    const api = (window as any).deskflowAPI;
    if (!api?.phoneTelemetryLive) {
      setError('This build predates phone telemetry. Rebuild to see phone stats.');
      setLoading(false);
      return;
    }
    try {
      const liveRes = await api.phoneTelemetryLive();
      if (liveRes.success) {
        setLive(liveRes.live);
        setError('');
      } else {
        setError(liveRes.error || 'Could not reach the sync server');
      }
      const sumRes = await api.phoneTelemetrySummary();
      if (sumRes.success) setDaily(sumRes.daily || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load phone stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // `is_online` decays server-side, so poll rather than fetch once.
    const t = setInterval(fetchStats, 60_000);
    return () => clearInterval(t);
  }, [fetchStats]);

  const neverReported = !live || !live.last_seen;

  return (
    <GlassCard className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Phone</h3>
          {!loading && !error && !neverReported && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                live!.is_online ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-500/15 text-zinc-500'
              }`}
            >
              {live!.is_online ? 'online' : 'offline'}
            </span>
          )}
        </div>
        <button
          onClick={fetchStats}
          className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Refresh phone stats"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && neverReported && (
        <div className="flex items-start gap-2 text-xs text-zinc-500 bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <WifiOff className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            No phone has reported yet. Pair a device, then open the phone app once —
            it pushes battery and usage on every app switch.
          </span>
        </div>
      )}

      {!loading && !error && !neverReported && live && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">In app today</div>
              <div className="text-lg font-semibold text-zinc-100 tabular-nums">
                {fmtDuration(live.today_deskflow_foreground_sec)}
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">In background</div>
              <div className="text-lg font-semibold text-zinc-400 tabular-nums">
                {fmtDuration(live.today_deskflow_background_sec)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 truncate">
              {live.device_name || live.device_platform || 'Phone'}
              {live.device_platform_version ? ` · ${live.device_platform_version}` : ''}
            </span>
            {live.current_battery != null && (
              <span className="flex items-center gap-1.5 text-zinc-300 tabular-nums shrink-0 ml-2">
                <BatteryIcon pct={live.current_battery} />
                {Math.round(live.current_battery)}%
              </span>
            )}
          </div>

          <div className="text-[10px] text-zinc-600">Last report {fmtLastSeen(live.last_seen)}</div>

          {daily.length > 1 && (
            <div className="space-y-1 pt-1 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Recent</div>
              {daily.slice(0, 7).map((d) => (
                <div key={d.date} className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500 w-16 shrink-0 tabular-nums">{d.date.slice(5)}</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-400 rounded-full"
                      style={{
                        width: `${Math.min(100, (d.foreground_sec / Math.max(1, ...daily.map((x) => x.foreground_sec))) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-zinc-400 w-14 text-right shrink-0 tabular-nums">
                    {fmtDuration(d.foreground_sec)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}

export default PhoneStatsPanel;