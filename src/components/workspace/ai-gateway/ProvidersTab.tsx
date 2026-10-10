// AI Gateway — ProvidersTab: per-provider detail + Setup/Verify lifecycle.
import { useState, useEffect, useCallback } from 'react';
import { LogIn, BadgeCheck, XCircle, LogOut, Ban, CheckCircle2, Loader2, AlertTriangle, ExternalLink, Globe } from 'lucide-react';
import { WorkspaceSection, WorkspaceCard } from '../_ds/containers';
import { WS_BTN_PRIMARY, WS_BTN_SECONDARY, WS_BTN_GHOST, WS_BTN_DANGER } from '../_ds/forms';
import { EmptyState } from '../_ds/primitives';
import {
  gatewayApi, coerceAdapters, indexReports,
  type GatewayAdapterInfo, type GatewayStatusReport, type GatewayEnvelope,
} from './gatewayApi';
import { statusMeta } from './ProviderCard';

export function ProvidersTab({ providerId, onProviderChange }: {
  providerId: string;
  onProviderChange: (id: string) => void;
}) {
  const [adapters, setAdapters] = useState<GatewayAdapterInfo[]>([]);
  const [reports, setReports] = useState<Record<string, GatewayStatusReport>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [a, s] = await Promise.all([gatewayApi.listProviders(), gatewayApi.allStatuses()]);
    if (a.success) {
      setAdapters(coerceAdapters(a.data));
      setLoadError(null);
    } else {
      // Previously swallowed: the select just rendered empty with no explanation.
      setLoadError(a.error || `${a.channel} returned an unusable payload`);
    }
    if (s.success) setReports(indexReports(s.data));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const off = gatewayApi.onProviderStatus(() => refresh());
    return () => { try { off(); } catch {} };
  }, [refresh]);

  const adapter = adapters.find((a) => a.id === providerId) || adapters[0];
  const report = adapter ? reports[adapter.id] : undefined;
  const meta = statusMeta(report?.status || 'needs_setup');

  const run = async (label: string, fn: () => Promise<GatewayEnvelope<any>>) => {
    setBusy(label); setMsg(null);
    const r = await fn();
    setBusy(null);
    if (r.success) {
      const data = (r.data || {}) as any;
      if (label === 'setup' && data.mode === 'external') {
        setMsg({ kind: 'ok', text: 'Browser automation unavailable — login page opened in your system browser instead.' });
      } else if (label === 'verify' && !data.sessionValid) {
        setMsg({ kind: 'err', text: r.error || 'Login not detected yet.' });
      } else {
        setMsg({ kind: 'ok', text: label === 'verify' ? 'Session verified and saved.' : 'Done.' });
      }
    } else {
      // Branch on the payload: the handlers return {success:false}, they do not throw.
      setMsg({ kind: 'err', text: r.error || `${r.channel} failed with no message` });
    }
    refresh();
  };

  if (loadError) {
    return (
      <WorkspaceSection title="Provider">
        <div className="rounded-xl bg-red-500/10 ring-1 ring-red-500/20 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-red-300 font-mono break-words whitespace-pre-wrap">{loadError}</p>
            <button onClick={refresh} className="mt-1.5 text-[11px] text-red-200 underline underline-offset-2">Retry</button>
          </div>
        </div>
      </WorkspaceSection>
    );
  }

  if (!loading && adapters.length === 0) {
    return (
      <WorkspaceSection title="Provider">
        <EmptyState
          icon={<Globe className="w-5 h-5" />}
          title="No providers to configure"
          hint="aigateway:list-providers returned an empty adapter list."
        />
      </WorkspaceSection>
    );
  }

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <WorkspaceSection title="Provider">
        <select
          value={adapter?.id || ''}
          onChange={(e) => onProviderChange(e.target.value)}
          disabled={adapters.length === 0}
          aria-label="Provider"
          className="w-full min-w-0 bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 disabled:opacity-50"
        >
          {adapters.length === 0
            ? <option value="">Loading providers…</option>
            : adapters.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </WorkspaceSection>

      {adapter && (
        <WorkspaceCard variant="default" accent="cyan">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="text-[12px] font-medium text-zinc-200 truncate">{adapter.name}</h4>
            {report && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${meta.cls}`}>{meta.label}</span>}
          </div>
          <p className="text-[11px] text-zinc-400 mb-1 break-all">{adapter.url}</p>
          {adapter.notes && <p className="text-[10px] text-zinc-500 mb-3">{adapter.notes}</p>}

          {/* Two columns on a narrow panel, three only when there is room. */}
          <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-2 mb-3 text-center">
            <div className="min-w-0 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/60 ring-1 ring-zinc-800/60 p-2">
              <div className="text-[13px] font-semibold text-zinc-200 font-mono truncate">
                {adapter.rateLimit.requestsPerMinute}/min
              </div>
              <div className="text-[9px] text-zinc-500 uppercase">rate</div>
            </div>
            <div className="min-w-0 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/60 ring-1 ring-zinc-800/60 p-2">
              <div className="text-[13px] font-semibold text-zinc-200 font-mono truncate">
                {report?.requestsRemaining != null ? report.requestsRemaining : (adapter.dailyBudget ?? '—')}
              </div>
              <div className="text-[9px] text-zinc-500 uppercase">left today</div>
            </div>
            <div className="min-w-0 col-span-2 min-[420px]:col-span-1 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/60 ring-1 ring-zinc-800/60 p-2">
              <div className="text-[13px] font-semibold text-zinc-200 font-mono truncate">
                {report?.sessionValid ? 'yes' : 'no'}
              </div>
              <div className="text-[9px] text-zinc-500 uppercase">session</div>
            </div>
          </div>

          {/* Setup flow */}
          <div className="rounded-xl bg-zinc-950 light:bg-[var(--ws-surface)]/60 ring-1 ring-zinc-800/60 p-3 mb-3">
            <p className="text-[11px] text-zinc-300 font-medium mb-1">1 · Setup — log in inside the opened browser window</p>
            <p className="text-[10px] text-zinc-500 mb-2 break-words">
              Opens {adapter.loginUrl || adapter.url} in the automated browser (real Chrome/Chromium, persistent profile).
              Solve any CAPTCHA / 2FA manually there.
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => run('setup', () => gatewayApi.setupProvider(adapter.id))} disabled={busy === 'setup'}
                className={`${WS_BTN_SECONDARY} !text-[10px]`}>
                {busy === 'setup' ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />} Setup
              </button>
              <button onClick={() => run('verify', () => gatewayApi.verifySetup(adapter.id))} disabled={busy === 'verify'}
                className={`${WS_BTN_PRIMARY} !text-[10px]`}>
                {busy === 'verify' ? <Loader2 className="w-3 h-3 animate-spin" /> : <BadgeCheck className="w-3 h-3" />} Verify & Save
              </button>
              {(adapter.loginUrl || adapter.url) && (
                <a href={adapter.loginUrl || adapter.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 ml-auto">
                  <ExternalLink className="w-3 h-3" /> login page
                </a>
              )}
            </div>
          </div>

          {msg && (
            <div className={`rounded-xl p-2.5 mb-3 flex items-start gap-2 ${msg.kind === 'ok' ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20' : 'bg-red-500/10 ring-1 ring-red-500/20'}`}>
              {msg.kind === 'ok'
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                : <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />}
              <p className={`text-[11px] min-w-0 break-words ${msg.kind === 'ok' ? 'text-emerald-200' : 'text-red-300'}`}>{msg.text}</p>
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => run(report?.status === 'disabled' ? 'enable' : 'disable',
                () => gatewayApi.setDisabled(adapter.id, report?.status !== 'disabled'))}
              disabled={busy === 'disable' || busy === 'enable'}
              className={`${WS_BTN_GHOST} !text-[10px]`}
            >
              <Ban className="w-3 h-3" /> {report?.status === 'disabled' ? 'Enable' : 'Disable'}
            </button>
            {report?.browserRunning && (
              <button onClick={() => run('close', () => gatewayApi.closeProvider(adapter.id))} disabled={busy === 'close'}
                className={`${WS_BTN_GHOST} !text-[10px]`}>
                <XCircle className="w-3 h-3" /> Close window
              </button>
            )}
            <button onClick={() => run('logout', () => gatewayApi.logoutProvider(adapter.id))} disabled={busy === 'logout'}
              className={`${WS_BTN_DANGER} !text-[10px] ml-auto`}>
              <LogOut className="w-3 h-3" /> Clear session
            </button>
          </div>
          {report?.lastError && (
            <p className="text-[10px] text-red-300/90 mt-2 break-words">{report.lastError}</p>
          )}
        </WorkspaceCard>
      )}
    </div>
  );
}