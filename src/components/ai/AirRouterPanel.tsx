/**
 * AirRouterPanel — a live console for the local ai-router.
 *
 * WHY THIS EXISTS
 * The router's whole value is invisible by default: you ask for `reasoning`,
 * it quietly answers from Groq, and you never learn that Gemini was on cooldown.
 * That is great for reliability and terrible for trust — a user cannot tell a
 * smart router from a flaky one. This panel makes the decision legible:
 * which providers are live, what each group would route to right now, and which
 * nodes were skipped and WHY.
 *
 * DESIGN INTENT (PAINT L0.3)
 * 1. Skills: LAMINAR (App UI — zero latitude) + humancentred-UIUX (all five
 *    states) + impeccable (typography/spatial/interaction). No new dependency:
 *    Collapsible/Button/Badge already ship in `components/ui`.
 * 2. The ONE idea: the router is a DECISION ENGINE, so the panel is a
 *    decision readout — not a provider list. Groups lead, providers are evidence.
 * 3. Meaning: `ready` vs `no_key` vs `disabled` are genuinely different user
 *    situations (working / needs a key / deliberately off), so each gets a
 *    distinct treatment and a plain-English label — never a raw enum. Skipped
 *    nodes show the router's own reason because that reason is the lesson.
 *    "Local" providers are marked because privacy is a real user concern.
 * 4. Fits the parent: this is a developer/AI surface inside the AI page, so it
 *    is dense and composed — no bounce, no decorative loop, one accent hue.
 *
 * Motion: L2 Responsive. Only opacity/transform transitions on the toggle,
 * honouring prefers-reduced-motion. No ambient loops (LAMINAR §6).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ChevronDown, CircleDot, KeyRound, Plug, PowerOff, RefreshCw, RotateCcw, ServerOff, Zap,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  airRouterStatusLabel, airRouterStatusTone,
  type AirRouterChainEntry, type AirRouterGroup, type AirRouterProvider, type AirRouterStatus,
} from '@/services/providers/airouter-types';

const POLL_MS = 8000;

/* ------------------------------------------------------------------ types */

type Tone = 'ready' | 'warn' | 'muted' | 'error';

// Mirrors RouterStatus in src/services/aiRouterProcess.ts.
type RouterProc = {
  state: 'running' | 'stopped' | 'starting' | 'external' | 'error';
  healthy: boolean;
  pid: number | null;
  managed: boolean;
  baseUrl: string;
  message?: string;
  detail?: string;
  logFile?: string;
};

interface Loaded {
  status: AirRouterStatus | null;
  groups: Record<string, AirRouterGroup>;
  aliases: Record<string, string>;
}

const EMPTY: Loaded = { status: null, groups: {}, aliases: {} };

/* ----------------------------------------------------------------- helpers */

/** LAMINAR §2: one signal hue per surface. Status reads as tone, not hue. */
function toneClass(tone: Tone): string {
  switch (tone) {
    case 'ready':
      return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    case 'warn':
      return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    case 'error':
      return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
    default:
      return 'text-[var(--color-muted-foreground)] border-[var(--color-border)] bg-transparent';
  }
}

function dotClass(tone: Tone): string {
  switch (tone) {
    case 'ready':
      return 'bg-emerald-400';
    case 'warn':
      return 'bg-amber-400';
    case 'error':
      return 'bg-rose-400';
    default:
      return 'bg-[var(--color-muted-foreground)]';
  }
}

function ProviderRow({ provider }: { provider: AirRouterProvider }) {
  const tone = airRouterStatusTone(provider.status);
  const isLocal = provider.privacy?.toLowerCase().includes('local')
    || provider.name === 'ollama' || provider.name === 'lmstudio' || provider.name === 'llamacpp';

  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <CircleDot className={`mt-0.5 size-3.5 shrink-0 ${tone === 'muted' ? 'text-[var(--color-muted-foreground)]' : tone === 'ready' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : 'text-rose-400'}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`font-mono text-[11px] font-medium ${tone === 'muted' ? 'text-[var(--color-muted-foreground)]' : 'text-[var(--color-foreground)]'}`}>
            {provider.name}
          </span>
          {isLocal && provider.status === 'ready' && (
            <span className="rounded-full border border-[var(--color-border)] px-1.5 py-px font-mono text-[9px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
              local
            </span>
          )}
          <span className="text-[10px] text-[var(--color-muted-foreground)]">
            {airRouterStatusLabel(provider.status, provider.status_detail)}
          </span>
          {typeof provider.ewma_ms === 'number' && (
            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              · {Math.round(provider.ewma_ms)}ms
            </span>
          )}
        </div>
        {/* Privacy is the one field worth surfacing unprompted — it changes what
            a user should type into the router at all. */}
        {provider.privacy && provider.status === 'ready' && (
          <p className="mt-0.5 text-[10px] leading-snug text-[var(--color-muted-foreground)]">
            {provider.privacy}
          </p>
        )}
      </div>
    </li>
  );
}

function ChainEntryRow({ entry }: { entry: AirRouterChainEntry }) {
  return (
    <li className="flex items-center gap-2 py-1">
      <span className={`size-1.5 shrink-0 rounded-full ${entry.available ? 'bg-emerald-400' : 'bg-[var(--color-muted-foreground)]'}`} aria-hidden />
      <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{entry.provider}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[var(--color-foreground)]">{entry.model}</span>
      {typeof entry.priority === 'number' && (
        <span className="shrink-0 font-mono text-[9px] text-[var(--color-muted-foreground)]">p{entry.priority}</span>
      )}
    </li>
  );
}

function GroupRow({ name, group }: { name: string; group: AirRouterGroup }) {
  const chain = group.chain ?? [];
  const skipped = group.skipped ?? [];
  const readyCount = chain.filter((c) => c.available).length;

  return (
    <Collapsible className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--color-accent-5)]">
        <Zap className="size-3.5 shrink-0 text-[var(--page-accent)]" aria-hidden />
        <span className="font-mono text-[11px] font-medium text-[var(--color-foreground)]">{name}</span>
        {/* The number that matters: how many ways this request can succeed. */}
        <span className={`rounded-full px-1.5 py-px font-mono text-[9px] ${readyCount > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {readyCount} live
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-[10px] text-[var(--color-muted-foreground)]">
          {group.description}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-[var(--color-muted-foreground)] transition-transform duration-200" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-[var(--color-border)] px-3 py-2">
        <ul className="divide-y divide-[var(--color-border)]">
          {chain.map((entry, i) => (
            <ChainEntryRow key={`${entry.provider}-${entry.model}-${i}`} entry={entry} />
          ))}
        </ul>
        {skipped.length > 0 && (
          <div className="mt-2 border-t border-[var(--color-border)] pt-2">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <PowerOff className="size-3" aria-hidden /> Skipped
            </p>
            <ul className="space-y-0.5">
              {skipped.map((s, i) => (
                <li key={`${s.provider}-${i}`} className="flex flex-wrap gap-x-2 text-[10px]">
                  <span className="font-mono text-[var(--color-muted-foreground)]">{s.provider}</span>
                  <span className="text-amber-400/90">{s.reason || 'unavailable'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ---------------------------------------------------------------- component */

export function AirRouterPanel({ baseUrl }: { baseUrl?: string }) {
  const [data, setData] = useState<Loaded>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const api = useMemo(
    () => (window as any).deskflowAPI?.airouter as
      | {
          status: (o?: unknown) => Promise<any>;
          groups: (o?: unknown) => Promise<any>;
          resetProvider: (p: string, o?: unknown) => Promise<any>;
          resetCooldowns: (o?: unknown) => Promise<any>;
          processStatus: () => Promise<RouterProc>;
          start: () => Promise<RouterProc>;
          stop: () => Promise<RouterProc>;
          restart: () => Promise<RouterProc>;
          diagnose: () => Promise<{ ok: boolean; detail?: string }>;
        }
      | undefined,
    []
  );

  // ---- process controls: the app can own the router, no terminal needed ----
  const [proc, setProc] = useState<RouterProc | null>(null);
  const [procBusy, setProcBusy] = useState<'start' | 'stop' | 'restart' | null>(null);

  const loadProc = useCallback(async () => {
    if (!api?.processStatus) return;
    try { setProc(await api.processStatus()); } catch { /* non-fatal */ }
  }, [api]);

  // TDZ FIX. `runProc` needs `load`, and `load` is declared ~20 lines BELOW it.
  // That is legal inside a closure body but NOT in the dependency array: the
  // array is evaluated during render, so `load` was still in its temporal dead
  // zone and the whole panel threw
  //     ReferenceError: Cannot access 'load2' before initialization
  // (esbuild renamed it, which is why the stack trace said `load2` and not
  // `load`.) A ref reads `load` at CALL time, never at render time, so the
  // ordering stops mattering and `runProc` also stops being recreated.
  const loadRef = useRef<((isRefresh?: boolean) => Promise<void>) | null>(null);

  const runProc = useCallback(async (action: 'start' | 'stop' | 'restart') => {
    if (!api || procBusy) return;
    setProcBusy(action);
    setError(null);
    try {
      const fn = action === 'start' ? api.start : action === 'stop' ? api.stop : api.restart;
      const res = await fn();
      setProc(res);
      // A failed launch explains itself better than a generic "not reachable",
      // so surface the supervisor's own message when there is one.
      if (res?.state === 'error' && res?.message) setError(res.message);
      await loadRef.current?.();
    } catch (err: any) {
      setError(err?.message || `Could not ${action} the router`);
    } finally {
      if (mounted.current) setProcBusy(null);
    }
  }, [api, procBusy]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    if (!api) {
      setError('Router console is unavailable in this build. Rebuild to enable it.');
      setLoading(false);
      return;
    }
    try {
      const [statusRes, groupsRes] = await Promise.all([
        api.status({ baseUrl }),
        api.groups({ baseUrl }),
      ]);

      // An offline router is a normal state, not an exception. Status wins
      // because it is the one that carries the reason.
      const offline =
        !statusRes?.ok
          ? statusRes?.error || 'Router is not reachable'
          : !groupsRes?.ok
            ? groupsRes?.error || 'Router is not reachable'
            : null;

      if (offline) {
        setError(offline);
        setData(EMPTY);
      } else {
        setError(null);
        setData({
          status: { ok: true, ...statusRes },
          groups: groupsRes?.groups ?? {},
          aliases: groupsRes?.aliases ?? {},
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Could not read the router');
      setData(EMPTY);
    } finally {
      if (!mounted.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, baseUrl]);

  // Publish `load` into the ref AFTER it exists, every time it is redefined.
  // `runProc` reads loadRef.current at call time, which is what keeps it out of
  // runProc's dependency array and out of the temporal dead zone.
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    void load();
    void loadProc();
    const pid = window.setInterval(() => void loadProc(), 5000);
    return () => window.clearInterval(pid);
  }, [loadProc]);

  useEffect(() => {
    mounted.current = true;
    // Polling is a functional loop (status is live state), which LAMINAR §6
    // permits. It stops when the panel unmounts.
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [load]);

  const providers = useMemo(() => {
    const all = data.status?.providers ?? [];
    // Live first, then needs-a-key, then deliberately-off. This ordering IS the
    // story: what will serve me, what could serve me, what did I switch off.
    const rank = (p: AirRouterProvider) =>
      p.status === 'ready' ? 0 : p.status === 'no_key' ? 1 : p.status === 'disabled' ? 3 : 2;
    return [...all].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [data.status]);

  const counts = useMemo(() => {
    const live = providers.filter((p) => p.status === 'ready').length;
    const needsKey = providers.filter((p) => p.status === 'no_key').length;
    const off = providers.filter((p) => p.status === 'disabled').length;
    return { live, needsKey, off, total: providers.length };
  }, [providers]);

  const handleReset = useCallback(async (provider?: string) => {
    if (!api) return;
    if (provider) await api.resetProvider(provider, { baseUrl });
    else await api.resetCooldowns({ baseUrl });
    void load(true);
  }, [api, baseUrl, load]);

  /* --- offline: the empty state a user WILL hit, so it must be good --- */
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted-foreground)]">
          <RefreshCw className="size-3.5 animate-spin" aria-hidden />
          Checking the router…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2.5">
          <ServerOff className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-[var(--color-foreground)]">Router offline</p>
            {/* Copy rule: [Thing] [state] because [reason]. [Action to fix]. */}
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
              DeskFlow cannot reach the AI router because {error.replace(/\.$/, '')}. Start it with{' '}
              <code className="rounded bg-black/20 px-1 font-mono text-[10px]">airouter run</code> from the
              ai-router folder, then retry.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void runProc(proc?.managed === false && proc?.state === 'external' ? 'start' : 'start')}
                disabled={!!procBusy}
                className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'h-7 text-[11px]')}
              >
                <Zap className="size-3" aria-hidden />
                {procBusy === 'start' ? 'Starting…' : 'Start router'}
              </button>
              <button type="button" onClick={() => void load()} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-[11px]')}>
                <RefreshCw className="size-3" aria-hidden /> Retry
              </button>
            </div>
            {proc?.state === 'external' && (
              <p className="mt-1.5 text-[10px] leading-snug text-[var(--color-muted-foreground)]">
                The router is already running outside DeskFlow, so DeskFlow will not stop it. Use Stop only for a router DeskFlow started.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const groupNames = Object.keys(data.groups).sort();
  const cfg = data.status?.config;

  return (
    <div className="space-y-3">
      {/* Summary strip: the three numbers that decide whether failover is real */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Plug className="size-3.5 text-emerald-400" aria-hidden />
            <span className="text-[12px] font-medium text-[var(--color-foreground)]">Router online</span>
            {data.status?.version && (
              <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">v{data.status.version}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Process controls. Start/Restart are always available; Stop only
                makes sense for a router THIS app spawned, so it is disabled for
                an external one rather than silently doing nothing. */}
            <button
              type="button"
              onClick={() => void runProc(proc?.healthy ? 'restart' : 'start')}
              disabled={!!procBusy}
              title={
                proc?.state === 'error' && proc.message
                  ? proc.message
                  : proc?.healthy
                    ? 'Restart the router (DeskFlow-managed processes only)'
                    : 'Start the ai-router service'
              }
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'h-7 text-[11px]')}
            >
              {proc?.healthy ? <RotateCcw className="size-3" aria-hidden /> : <Zap className="size-3" aria-hidden />}
              {procBusy === 'start' ? 'Starting…' : procBusy === 'restart' ? 'Restarting…' : proc?.healthy ? 'Restart' : 'Start'}
            </button>
            <button
              type="button"
              onClick={() => void runProc('stop')}
              disabled={!!procBusy || !proc?.managed}
              title={proc?.managed ? 'Stop the router DeskFlow started' : 'The router is not managed by DeskFlow'}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-[11px]')}
            >
              <PowerOff className="size-3" aria-hidden />
              {procBusy === 'stop' ? 'Stopping…' : 'Stop'}
            </button>
            <button type="button" onClick={() => void handleReset()} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 text-[11px]')}>
              <RotateCcw className="size-3" aria-hidden /> Clear cooldowns
            </button>
            <button type="button" onClick={() => void load(true)} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-[11px]')}>
              <RefreshCw className={`size-3 ${refreshing ? 'animate-spin' : ''}`} aria-hidden /> Refresh
            </button>
          </div>
        </div>

        {/* Process state is separate from provider state: a stopped router makes
            every provider read "offline", which looks like a provider outage but
            is actually a missing sidecar. Say which one it is. */}
        {proc && !proc.healthy && proc.state !== 'starting' && (
          <p className="mt-2 text-[10px] leading-snug text-[var(--color-muted-foreground)]">
            {proc.state === 'error'
              ? proc.message || 'The router could not be started.'
              : 'The router is not running, so every provider below reads offline. Start it to restore AI calls.'}
            {proc.logFile && <> Log: <span className="font-mono">{proc.logFile}</span></>}
          </p>
        )}
        {proc?.healthy && proc.state === 'external' && (
          <p className="mt-2 text-[10px] leading-snug text-[var(--color-muted-foreground)]">
            Running outside DeskFlow (pid {proc.pid ?? 'unknown'}) — DeskFlow will not stop a process it did not start.
          </p>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: 'Live', value: counts.live, tone: 'ready' as Tone },
            { label: 'Needs key', value: counts.needsKey, tone: 'warn' as Tone },
            { label: 'Off', value: counts.off, tone: 'muted' as Tone },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-lg border px-2.5 py-2 ${toneClass(stat.tone)}`}>
              <div className="flex items-center gap-1.5">
                <span className={`size-1.5 rounded-full ${dotClass(stat.tone)}`} aria-hidden />
                <span className="text-[10px] uppercase tracking-wide">{stat.label}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-lg leading-none">{stat.value}</div>
            </div>
          ))}
        </div>

        {cfg && (
          <p className="mt-2.5 text-[10px] text-[var(--color-muted-foreground)]">
            Default group <span className="font-mono text-[var(--color-foreground)]">{cfg.default_group}</span> ·
            strategy <span className="font-mono text-[var(--color-foreground)]">{cfg.strategy}</span> ·
            up to <span className="font-mono text-[var(--color-foreground)]">{cfg.max_attempts}</span> attempts
          </p>
        )}
      </div>

      {/* Groups lead: a group is what you actually ask for */}
      <section>
        <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
          <Activity className="size-3" aria-hidden /> Model groups
        </h3>
        <div className="space-y-1.5">
          {groupNames.length === 0 && (
            <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-[11px] text-[var(--color-muted-foreground)]">
              The router is running but reports no groups. Add some to config/providers.yaml.
            </p>
          )}
          {groupNames.map((name) => (
            <GroupRow key={name} name={name} group={data.groups[name]} />
          ))}
        </div>
      </section>

      {/* Providers are the evidence behind each group decision */}
      <section>
        <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
          <KeyRound className="size-3" aria-hidden /> Providers ({counts.total})
        </h3>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5">
          <ul className="divide-y divide-[var(--color-border)]">
            {providers.map((p) => (
              <ProviderRow key={p.name} provider={p} />
            ))}
          </ul>
          {counts.needsKey > 0 && (
            <p className="mt-2 border-t border-[var(--color-border)] py-2 text-[10px] leading-relaxed text-[var(--color-muted-foreground)]">
              {counts.needsKey} provider{counts.needsKey === 1 ? '' : 's'} will never be routed to until its key is
              in the ai-router <code className="rounded bg-black/20 px-1 font-mono">.env</code>. Adding a key
              widens every group automatically.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default AirRouterPanel;