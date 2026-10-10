import { useState } from 'react';
import { RefreshCw, Settings, ScanLine } from 'lucide-react';
import IgnoreSettings from './IgnoreSettings';
import type { FilterSettings } from './lineStatsFilter';

interface Props {
  onScan: (options: { excludeExtensions: string[]; excludePatterns: string[] }) => void;
  isScanning: boolean;
  lastScanned: string | null;
  hasData: boolean;
  settings: FilterSettings;
  settingsReady: boolean;
  onSettingsChange: (patch: Partial<FilterSettings>) => void;
  onSettingsReset: () => void;
  ignoreSummary?: React.ReactNode;
}

const DEFAULT_EXCLUDES = [
  { key: 'md', label: 'Markdown', ext: '.md', on: true },
  { key: 'json', label: 'JSON', ext: '.json', on: true },
  { key: 'lock', label: 'Lock files', ext: '.lock', on: true },
  { key: 'min', label: 'Minified', ext: '.min.js', on: true },
];

export default function ScanControls({ onScan, isScanning, lastScanned, hasData, settings, settingsReady, onSettingsChange, onSettingsReset, ignoreSummary }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [excludes, setExcludes] = useState<Record<string, boolean>>(Object.fromEntries(DEFAULT_EXCLUDES.map(e => [e.key, e.on])));
  const [customExts, setCustomExts] = useState('');

  const handleScan = () => {
    const excludeExtensions: string[] = [];
    for (const item of DEFAULT_EXCLUDES) { if (excludes[item.key]) excludeExtensions.push(item.ext); }
    if (customExts.trim()) customExts.split(',').map(e => e.trim()).filter(Boolean).forEach(e => { if (!e.startsWith('.')) e = '.' + e; excludeExtensions.push(e); });
    onScan({ excludeExtensions, excludePatterns: [] });
  };

  const timeAgo = () => {
    if (!lastScanned) return 'Never';
    const diff = Math.floor((Date.now() - new Date(lastScanned).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(lastScanned).toLocaleDateString();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleScan} disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
            {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
            {isScanning ? 'Scanning...' : hasData ? 'Re-scan' : 'Scan Project'}
          </button>
          <span className="text-[10px] text-zinc-600">Last: {timeAgo()}</span>
          <button onClick={() => setShowSettings(!showSettings)} title="Scan settings"
            className={`p-1 rounded transition-colors ${showSettings ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-600 hover:text-zinc-400'}`}>
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
        {ignoreSummary}
      </div>
      {showSettings && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            {DEFAULT_EXCLUDES.map(item => (
              <label key={item.key} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={excludes[item.key]} onChange={(e) => setExcludes(prev => ({ ...prev, [item.key]: e.target.checked }))} className="accent-cyan-500 w-3 h-3" />
                <span className="text-[10px] text-zinc-500">{item.label}</span>
              </label>
            ))}
            <input type="text" value={customExts} onChange={(e) => setCustomExts(e.target.value)} placeholder=".log,.tmp"
              className="w-24 bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded px-2 py-0.5 text-[10px] text-zinc-400 placeholder-zinc-700 focus:outline-none" />
          </div>
          <IgnoreSettings
            accent="cyan"
            settings={settings}
            ready={settingsReady}
            onChange={onSettingsChange}
            onReset={onSettingsReset}
          />
        </div>
      )}
    </div>
  );
}