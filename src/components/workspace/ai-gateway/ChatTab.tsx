// AI Gateway — ChatTab: send a prompt to a provider via browser automation.
import { useState, useEffect, useCallback } from 'react';
import { Send, Loader2, AlertTriangle, Eraser, Copy, Check } from 'lucide-react';
import { WorkspaceSection, WorkspaceCard } from '../_ds/containers';
import { WS_BTN_PRIMARY, WS_BTN_GHOST } from '../_ds/forms';
import { EmptyState } from '../_ds/primitives';
import { gatewayApi, type GatewayAdapterInfo, type GatewayStatusReport } from './gatewayApi';
import { statusMeta } from './ProviderCard';

export function ChatTab({ providerId, onProviderChange }: {
  providerId: string;
  onProviderChange: (id: string) => void;
}) {
  const [adapters, setAdapters] = useState<GatewayAdapterInfo[]>([]);
  const [reports, setReports] = useState<Record<string, GatewayStatusReport>>({});
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [answer, setAnswer] = useState<{ text: string; strategy: string; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const [a, s] = await Promise.all([gatewayApi.listProviders(), gatewayApi.allStatuses()]);
    if (a.success) setAdapters(a.data || []);
    if (s.success) {
      const map: Record<string, GatewayStatusReport> = {};
      for (const r of s.data || []) map[r.provider] = r;
      setReports(map);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!sending) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [sending]);

  const report = reports[providerId];
  const meta = statusMeta(report?.status || 'needs_setup');
  const canSend = !!prompt.trim() && !sending && report?.status === 'ready';

  const send = async () => {
    if (!canSend) return;
    setSending(true); setError(null); setAnswer(null);
    const r = await gatewayApi.sendPrompt({ provider: providerId, prompt: prompt.trim() });
    setSending(false);
    if (r.success && r.data) {
      setAnswer({ text: r.data.text, strategy: r.data.completionStrategy, ms: r.data.durationMs });
      setPrompt('');
    } else {
      setError(r.error || 'Send failed');
    }
    refresh();
  };

  const copyAnswer = async () => {
    if (!answer) return;
    try { await navigator.clipboard.writeText(answer.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div className="flex flex-col gap-3">
      <WorkspaceSection title="Chat via browser automation">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={providerId}
            onChange={(e) => onProviderChange(e.target.value)}
            className="bg-zinc-950 border border-zinc-800/70 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
          >
            {adapters.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {report && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>
          )}
          <button
            onClick={() => gatewayApi.clearConversation(providerId)}
            className={`${WS_BTN_GHOST} !text-[10px] !py-1 !px-2 ml-auto`}
            title="Open a fresh conversation thread"
          >
            <Eraser className="w-3 h-3" /> New thread
          </button>
        </div>

        {!report || report.status !== 'ready' ? (
          <div className="mt-2">
            <EmptyState
              title={report?.status === 'unavailable' ? 'Browser automation unavailable' : 'Provider not ready'}
              hint={
                report?.status === 'unavailable'
                  ? 'Install playwright + a browser, then restart. The External AI Bridge still works elsewhere.'
                  : report?.lastError || 'Go to Providers → pick this provider → Setup & Verify first.'
              }
            />
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
              placeholder="Type a prompt… (Ctrl+Enter to send)"
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-800/70 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 resize-y"
            />
            <div className="flex items-center gap-2">
              <button onClick={send} disabled={!canSend} className={`${WS_BTN_PRIMARY} !text-[11px] disabled:opacity-40`}>
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {sending ? `Waiting… ${elapsed}s` : 'Send'}
              </button>
              {report.queueDepth > 0 && <span className="text-[10px] text-amber-300">{report.queueDepth} queued</span>}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-2 rounded-xl bg-red-500/10 ring-1 ring-red-500/20 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-300 flex-1">{error}</p>
          </div>
        )}

        {answer && (
          <WorkspaceCard variant="default" accent="cyan" className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-zinc-500">
                {(answer.ms / 1000).toFixed(1)}s · detected via {answer.strategy.replace('_', ' ')}
              </span>
              <button onClick={copyAnswer} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300" title="Copy response">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[12px] text-zinc-200 whitespace-pre-wrap leading-relaxed">{answer.text}</p>
          </WorkspaceCard>
        )}
      </WorkspaceSection>
    </div>
  );
}
