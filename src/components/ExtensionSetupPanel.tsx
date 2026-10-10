import { useState, useEffect, useCallback } from 'react';
import {
  Check, Copy, FolderOpen, ChevronDown, ChevronRight,
  Loader2, AlertTriangle, Radio, RefreshCw,
} from 'lucide-react';

/**
 * ExtensionSetupPanel — guided install for the DeskFlow Browser Bridge.
 *
 * DESIGN INTENT
 * -------------
 * The idea is that setup should mirror the physical act: GET the thing → PUT it
 * in the browser → PROVE it worked. Three numbered steps, each of which
 * disappears once it is satisfied, so the panel shrinks from instructions into a
 * single green line of proof.
 *
 * Why it is built this way (each choice has a reason, not a preference):
 *
 *  - The path is VERIFIED on disk before it is shown, and is copyable in one
 *    click. A confident-but-wrong path is worse than no path: it sends the user
 *    into a file dialog to hunt a ~90-character string and they give up.
 *    "Show the folder" opens the OS file manager with the folder already
 *    selected, because manual path-hunting is where setup actually dies.
 *
 *  - The browser's extensions URL is COPYABLE, not clickable. `chrome://` and
 *    friends are internal URLs that the OS handler refuses to open, so an
 *    "open" button there fails silently and looks broken. The user pastes it.
 *
 *  - Firefox gets a DIFFERENT set of steps and is told to pick `manifest.json`
 *    (a file) rather than the folder, because that is the real difference
 *    between the two flows. Giving a Firefox user the Chromium instructions
 *    fails invisibly — there is no error, the add-on just never appears.
 *
 *  - Step 3 turns green ONLY on a real HTTP POST from the extension carrying
 *    its identity, re-read every few seconds. It is a confirmation, not a
 *    decoration, and it goes back to amber if the extension stops reporting.
 *
 * Fits the surrounding Settings→Tracking section: same zinc surfaces, same
 * emerald/sky signal colours, same divider rhythm. Motion is L1 — a single
 * pulse on the live dot and nothing else, because this is a settings surface
 * where a looping animation would compete with the data for attention.
 */

type Guide = {
  id: string;
  label: string;
  page: string;
  kind: 'chromium' | 'firefox';
  steps: string[];
};

type SetupData = {
  extensionDir: string | null;
  /** Built .zip/.xpi for Firefox/Zen "Install Add-on From File". Null if absent. */
  extensionPackage?: string | null;
  /** Profiles that were seen recently but have since gone silent — i.e. the
   *  extension is probably installed but its host permission was never granted. */
  staleProfileCount?: number;
  extensionMissingReason: string;
  manifestName: string;
  browsers: Guide[];
  connected: Array<{ profileId: string; browserName: string | null; profileName: string | null; ageMs: number | null }>;
  trackingEnabled: boolean;
  serverPort: number;
};

const POLL_MS = 4000;

export default function ExtensionSetupPanel({
  onStatusChange,
  compact = false,
}: {
  onStatusChange?: () => void;
  /** When true (e.g. on the Websites tab) the connected state collapses to a
   *  one-line status strip. Progressive disclosure: a permanent block of install
   *  instructions sitting above a data table is noise once data is flowing. */
  compact?: boolean;
}) {
  const [data, setData] = useState<SetupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Which browser's instructions are open. Null = none yet, so the panel does not
  // present a wall of text for a user who only has one browser.
  const [openBrowser, setOpenBrowser] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [revealMsg, setRevealMsg] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // Lets the compact strip expand back into the full 3-step panel in place,
  // so "Setup details" works without a route change to Settings.
  const [expandedCompact, setExpandedCompact] = useState(false);

  const load = useCallback(async () => {
    if (!window.deskflowAPI?.getExtensionSetup) {
      setLoadError('This build cannot show setup instructions. Restart DeskFlow to update.');
      setLoading(false);
      return;
    }
    try {
      const d = await window.deskflowAPI.getExtensionSetup();
      setData(d);
      setLoadError(null);
      onStatusChange?.();
    } catch (e: any) {
      setLoadError(e?.message || 'Could not read extension setup information.');
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    load();
    // The compact strip does not need 4s freshness, and every tick reaps profiles
    // (a conditional UPDATE on the single-writer DB). Slow it down so two mounted
    // panels cannot turn into a write every few seconds.
    const ms = compact ? POLL_MS * 3 : POLL_MS;
    const t = setInterval(load, ms);
    return () => clearInterval(t);
  }, [load, compact]);

  // "Copied" is a promise to the user; it must visibly keep for a moment and then
  // clear itself, otherwise it is indistinguishable from a dead button.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (text: string, key: string) => {
    let ok = false;
    try {
      // navigator.clipboard is unavailable here — the app CSP has no
      // clipboard-write directive, so a renderer-side copy silently no-ops.
      ok = (await window.deskflowAPI?.copyToClipboard?.(text)) ?? false;
    } catch { ok = false; }
    if (ok) setCopied(key);
    else setLoadError('Could not copy. Select the text and copy it manually.');
  };

  const reveal = async () => {
    try {
      const r = await window.deskflowAPI?.revealExtensionFolder?.();
      if (r?.ok) {
        setRevealMsg('Opened in your file manager');
      } else {
        setRevealMsg(r?.error || 'Could not open the folder');
      }
    } catch (e: any) {
      setRevealMsg(e?.message || 'Could not open the folder');
    }
    setTimeout(() => setRevealMsg(null), 4000);
  };

  const isConnected = (data?.connected?.length || 0) > 0;

  // Once something is connected this panel has done its job. Getting out of the
  // way is the respectful outcome: Settings should not permanently hold a wall of
  // install instructions for a feature that is already working.
  if (isConnected && dismissed) return null;

  // ── COMPACT + CONNECTED ───────────────────────────────────────────────────
  // One line. The Websites tab is a data surface; the job here is only to say
  // "this is live, and here are the browsers responsible" plus a way to expand.
  // Everything else (path, per-browser steps) lives behind the expander and in
  // Settings, so a working setup never occupies a data table's header space.
  if (compact && isConnected && !expandedCompact) {
    return (
      <div
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20"
        data-section="activity.websites.extension-status"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inset-0 rounded-full bg-emerald-400" />
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60 motion-reduce:hidden" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-zinc-200 truncate">
            Tracking {data!.connected.map(c => c.profileName || c.browserName || 'browser').join(', ')}
          </p>
          <p className="text-[11px] text-zinc-500">
            Recording from {data!.connected.length} browser{data!.connected.length > 1 ? 's' : ''}
            {data!.trackingEnabled ? '' : ' · recording is paused'}
          </p>
        </div>
        <button
          onClick={() => setExpandedCompact(true)}
          className="shrink-0 text-[11px] px-2 py-1 rounded-md border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          Setup details
        </button>
      </div>
    );
  }

  const Step = ({ n, title, done, children }: any) => (
    <div className="flex gap-3">
      <div className="shrink-0 pt-0.5">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold ${
          done
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
        }`}>
          {done ? <Check className="w-3 h-3" strokeWidth={3} /> : n}
        </div>
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <p className={`text-sm font-medium ${done ? 'text-zinc-400' : 'text-zinc-200'}`}>{title}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );

  const PathRow = ({ value, copyKey, label }: { value: string; copyKey: string; label: string }) => (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] light:bg-zinc-100/50 border border-zinc-700/50">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-0.5">{label}</p>
        <p className="text-[11px] font-mono text-zinc-300 break-all select-all">{value}</p>
      </div>
      <button
        onClick={() => copy(value, copyKey)}
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
      >
        {copied === copyKey
          ? <><Check className="w-3 h-3 text-emerald-400" strokeWidth={3} /> Copied</>
          : <><Copy className="w-3 h-3" /> Copy</>}
      </button>
    </div>
  );

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] light:bg-zinc-100/40 overflow-hidden" data-section="settings.tracking.extension-setup">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-zinc-700/40">
        <div className="relative flex h-2.5 w-2.5 shrink-0 mt-1.5">
          <span className={`absolute inset-0 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {!isConnected && (
            <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-60 motion-reduce:hidden" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-200">
            {isConnected ? 'Browser tracking is connected' : 'Set up browser tracking'}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isConnected
              ? `${data!.connected.length} browser${data!.connected.length > 1 ? 's' : ''} reporting. You can close this.`
              : 'Three steps. It takes about a minute and you only do it once per browser.'}
          </p>
        </div>
        {isConnected && (
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 text-[11px] px-2 py-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Hide
          </button>
        )}
      </div>

      <div className="px-4 py-4">
        {/* ERROR — plain language, plus a way out. Never a raw code. */}
        {loadError && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/25">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-amber-200">{loadError}</p>
                <button
                  onClick={() => { setLoadError(null); load(); }}
                  className="mt-2 flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500/25 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOADING — skeleton matching the three-step shape. */}
        {loading && !data && (
          <div className="space-y-4" aria-busy="true" aria-label="Loading setup">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-zinc-800 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-zinc-800 animate-pulse" />
                  <div className="h-9 rounded-lg bg-zinc-800/60 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {data && (
          <>
            {/* STEP 1 — get the folder */}
            <Step n={1} title="Copy the extension folder path" done={isConnected}>
              {data.extensionDir ? (
                <>
                  <PathRow value={data.extensionDir} copyKey="dir" label="Select this folder in the file picker" />
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <button
                      onClick={reveal}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                    >
                      <FolderOpen className="w-3 h-3" /> Show me the folder
                    </button>
                    {revealMsg && <span className="text-[11px] text-zinc-500">{revealMsg}</span>}
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/25">
                  <p className="text-xs text-amber-200">{data.extensionMissingReason}</p>
                </div>
              )}
            </Step>

            {/* STEP 2 — put it in the browser */}
            <Step n={2} title="Load it in your browser" done={isConnected}>
              {data.browsers.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No supported browser was detected on this computer. You can still load the folder
                  into any Chromium-based browser manually.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {data.browsers.map(b => {
                    const open = openBrowser === b.id;
                    return (
                      <div key={b.id} className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] overflow-hidden">
                        <button
                          onClick={() => setOpenBrowser(open ? null : b.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/50 transition-colors"
                          aria-expanded={open}
                        >
                          {open
                            ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                          <span className="text-sm font-medium text-zinc-200 flex-1">{b.label}</span>
                          <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                            {b.kind === 'firefox' ? 'temporary add-on' : 'load unpacked'}
                          </span>
                        </button>
                        {open && (
                          <div className="px-3 pb-3 space-y-2.5">
                            <PathRow value={b.page} copyKey={`page-${b.id}`} label="Type this in the address bar" />
                            <ol className="space-y-1.5">
                              {b.steps.map((s, i) => (
                                <li key={i} className="flex gap-2 text-xs text-zinc-400">
                                  <span className="text-zinc-600 shrink-0 w-3">{i + 1}.</span>
                                  <span className={i === b.steps.length - 1 ? 'text-zinc-200' : ''}>{s}</span>
                                </li>
                              ))}
                            </ol>
                            {b.kind === 'firefox' && (
                              <div className="space-y-2">
                                {data.extensionPackage ? (
                                  <PathRow
                                    value={data.extensionPackage}
                                    copyKey={`pkg-${b.id}`}
                                    label="Select this file in the picker"
                                  />
                                ) : (
                                  <p className="text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-md px-2.5 py-1.5">
                                    The installable .zip has not been built yet. Run
                                    <span className="font-mono"> node scripts/build-extension-package.mjs</span>
                                    , or zip the browser-extension folder yourself with
                                    <span className="font-mono"> manifest.json </span>
                                    at the top level.
                                  </p>
                                )}
                                <div className="space-y-1.5">
                                  <p className="text-[11px] text-zinc-600">
                                    {b.label} is Firefox-based, so there is no &ldquo;Developer mode&rdquo; and no
                                    &ldquo;Load unpacked&rdquo; — those are Chromium-only. You pick a .zip file, not a folder.
                                  </p>
                                  {/* RESEARCHED (zen-extension-compat-02102026/RESULT.md):
                                      Zen 1.17b+ removed the toolbar extension button entirely.
                                      This is the single most common reason people think the
                                      extension "isn't there". Saying it here beats making the
                                      user rediscover it. */}
                                  <p className="text-[11px] text-zinc-500">
                                    <span className="text-zinc-300">Finding it:</span> extensions are not on
                                    the toolbar. Open a normal web page (not a new tab), click the
                                    settings icon in the address bar, find
                                    <span className="text-zinc-300"> DeskFlow Browser Bridge</span>, then
                                    right-click it and choose <span className="text-zinc-300">Pin to Toolbar</span>.
                                  </p>
                                  {/* The permission grant must NOT depend on opening the popup,
                                      because that is exactly what the user cannot find. */}
                                  <div className="space-y-1.5">
                                    <p className="text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-md px-2.5 py-1.5">
                                      <span className="font-medium">Still sending nothing?</span> Firefox-family
                                      browsers make site access opt-in. Open <span className="font-mono">about:addons</span>,
                                      find DeskFlow Browser Bridge, and turn on access for
                                      <span className="font-mono"> localhost</span>. Without this the
                                      extension is installed but every request is blocked.
                                    </p>
                                    {/* Self-service diagnostics. Users were having to ask
                                        what to open; the answer belongs in the panel. */}
                                    <p className="text-[11px] text-zinc-500">
                                      <span className="text-zinc-300">Something broken?</span> Open
                                      <span className="font-mono text-zinc-400"> about:debugging#/runtime/this-firefox</span>,
                                      click <span className="text-zinc-300">Inspect</span> on DeskFlow Browser
                                      Bridge, and read the <span className="text-zinc-300">Console</span> — that is
                                      where the real error is.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            <p className="text-[11px] text-zinc-600">
                              Firefox temporary add-ons are removed when you close the browser. For a permanent
                              install, use a signed build of the extension.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Step>

            {/* STEP 3 — confirmation. Only green on a real signal. */}
            <Step n={3} title="Confirm it's connected" done={isConnected}>
              {isConnected ? (
                <div className="space-y-1.5">
                  {data.connected.map(c => (
                    <div key={c.profileId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/[0.07] border border-emerald-500/25">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="absolute inset-0 rounded-full bg-emerald-400" />
                        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60 motion-reduce:hidden" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {c.profileName || c.browserName || 'Browser'}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {c.browserName} · reporting
                          {c.ageMs != null ? ` · ${Math.max(0, Math.round(c.ageMs / 1000))}s ago` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1.5 pt-0.5">
                    <Radio className="w-3 h-3" />
                    This updates by itself. If the dot goes grey, the extension stopped reporting.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border border-dashed border-zinc-700/60">
                  {loading
                    ? <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin shrink-0" />
                    : <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                  <p className="text-xs text-zinc-400">
                    Waiting for the extension to report in…
                  </p>
                </div>
              )}
              {data.serverPort ? (
                <p className="text-[11px] text-zinc-600 mt-2">
                  DeskFlow is listening on port {data.serverPort} for the extension to connect to.
                </p>
              ) : null}
            </Step>
          </>
        )}
      </div>
    </div>
  );
}
