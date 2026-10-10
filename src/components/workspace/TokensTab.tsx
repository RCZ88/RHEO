import { useState, useEffect, useMemo } from 'react';
import { ExternalLink, Copy, Check, Download, Loader2 } from 'lucide-react';

interface ColorEntry {
  id: string;
  color: string;
  role: string;
  label: string;
}

interface TokensTabProps {
  colorEntries: ColorEntry[];
  projectPath?: string;
}

const ROLE_MAP: Record<string, string> = {
  background: 'bg',
  surface: 'text',
  primary: 'primary',
  accent: 'accent',
  secondary: 'secondary',
};

function mapRole(role: string): string {
  return ROLE_MAP[role] || role;
}

function getHex(entry: ColorEntry): string {
  return entry.color || '#000000';
}

export function TokensTab({ colorEntries, projectPath }: TokensTabProps) {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [targetFile, setTargetFile] = useState<'globals.css' | 'tailwind.config.js'>('globals.css');
  const [copied, setCopied] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const mappedColors = useMemo(() => {
    return colorEntries.map(c => ({ ...c, _mappedRole: mapRole(c.role), _hex: getHex(c) }));
  }, [colorEntries]);

  const realtimeColorsUrl = useMemo(() => {
    const bg = mappedColors.find(c => c._mappedRole === 'bg')?._hex.replace('#', '') || '09090b';
    const text = mappedColors.find(c => c._mappedRole === 'text')?._hex.replace('#', '') || 'ffffff';
    const primary = mappedColors.find(c => c._mappedRole === 'primary')?._hex.replace('#', '') || '06b6d4';
    const secondary = mappedColors.find(c => c._mappedRole === 'secondary')?._hex.replace('#', '') || 'a78bfa';
    const accent = mappedColors.find(c => c._mappedRole === 'accent')?._hex.replace('#', '') || 'f97316';
    return `https://www.realtimecolors.com?colors=${bg}-${text}-${primary}-${secondary}-${accent}`;
  }, [mappedColors]);

  const cssVariables = useMemo(() => {
    const lines = [':root {'];
    for (const c of mappedColors) {
      lines.push(`  --${c._mappedRole}: ${c._hex};`);
    }
    lines.push('}');
    return lines.join('\n');
  }, [mappedColors]);

  const handleSync = async () => {
    if (!projectPath) { setSyncMessage('No project path set'); setSyncStatus('error'); return; }
    setSyncStatus('syncing');
    try {
      const dapi = (window as any).deskflowAPI;
      const result = await dapi?.designSuiteSyncTokens?.(cssVariables, projectPath, targetFile);
      if (result?.success) {
        setSyncStatus('success');
        setSyncMessage(result.message || 'Tokens synced successfully');
      } else {
        setSyncStatus('error');
        setSyncMessage(result?.message || 'Sync failed');
      }
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage('Network error');
    }
    setTimeout(() => setSyncStatus('idle'), 3000);
  };

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(cssVariables);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([cssVariables], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = targetFile;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: CSS Variables + Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-300">CSS Variables</h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 text-[10px] hover:bg-zinc-700 hover:text-zinc-300 transition-colors duration-150"
              >
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 text-[10px] hover:bg-zinc-700 hover:text-zinc-300 transition-colors duration-150"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
            </div>
          </div>

          <pre className="p-3 rounded-xl bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-800/60 text-[11px] font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap">
            {cssVariables}
          </pre>

          {/* Target File Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500">Sync to:</span>
            <select
              value={targetFile}
              onChange={(e) => setTargetFile(e.target.value as any)}
              className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
            >
              <option value="globals.css">globals.css</option>
              <option value="tailwind.config.js">tailwind.config.js</option>
            </select>
          </div>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncStatus === 'syncing' || !projectPath}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/20 disabled:opacity-50 transition-colors duration-150"
          >
            {syncStatus === 'syncing' ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing...</>
            ) : syncStatus === 'success' ? (
              <><Check className="w-3.5 h-3.5" /> {syncMessage}</>
            ) : syncStatus === 'error' ? (
              <><span className="text-red-400">{syncMessage}</span></>
            ) : (
              'Sync to Project'
            )}
          </button>
          {!projectPath && (
            <p className="text-[10px] text-zinc-600 text-center">Open a project to enable sync</p>
          )}
        </div>

        {/* Right: Realtime Colors Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-300">Live Preview</h3>
            <a
              href={realtimeColorsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-cyan-400 transition-colors duration-150"
            >
              Open in Realtime Colors
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface)]" style={{ minHeight: 280 }}>
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
              </div>
            )}
            <iframe
              src={realtimeColorsUrl}
              className="w-full border-0"
              style={{ height: 280 }}
              onLoad={() => setIframeLoaded(true)}
              title="Realtime Colors Preview"
            />
          </div>

          {/* Color Swatches */}
          <div className="flex gap-2 flex-wrap">
            {mappedColors.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800/60">
                <div
                  className="w-3 h-3 rounded-full border border-zinc-700"
                  style={{ backgroundColor: c._hex }}
                />
                <span className="text-[10px] text-zinc-400">{c._mappedRole}</span>
                <span className="text-[9px] font-mono text-zinc-500">{c._hex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
