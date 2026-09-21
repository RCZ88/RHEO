import { motion } from 'framer-motion';
import { Key, RefreshCw, ChevronRight } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { SearchableSection } from './shared';
import { DEFAULT_SHORTCUTS } from './constants';

export function ShortcutSection(props: any) {
  const { shortcuts, setShortcuts, recordingKey, setRecordingKey, SHORTCUT_CONFIG, restoreDefaults } = props;

  return (
    <div data-section="settings.shortcuts" className="space-y-4">
      <SearchableSection terms={['shortcut', 'keybind', 'hotkey', 'keyboard', 'key', 'bind', 'ctrl', 'command']} search={settingsSearch}>
      <GlassCard className="space-y-4">
        <div><h2 className="text-lg font-semibold mb-1">Keyboard Shortcuts</h2><p className="text-xs text-zinc-500">Customize keyboard shortcuts for app actions</p></div>
        {(() => { const groups: Record<string, [string, any][]> = {}; Object.entries(shortcuts).forEach(([key, shortcut]) => { const config = SHORTCUT_CONFIG[key]; if (!config) return; const g = config.group || 'Other'; if (!groups[g]) groups[g] = []; groups[g].push([key, config]); }); return Object.entries(groups).map(([groupName, items]) => <div key={groupName} className="space-y-2"><h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mt-3 mb-1">{groupName}</h3>{items.map(([key, config]) => <div key={key} className="flex items-center justify-between py-2 border-b border-zinc-700/20 last:border-0"><div className="flex-1 min-w-0 pr-4"><div className="text-sm font-medium text-zinc-200">{config.label}</div><div className="text-xs text-zinc-500 mt-0.5">{config.description}</div></div><button onClick={() => setRecordingKey(key)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-mono transition-colors duration-150 ${recordingKey === key ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200'}`}>{recordingKey === key ? <span className="animate-pulse text-xs">Recording...</span> : <><Key className="w-3.5 h-3.5" /><span className="text-xs">{shortcut}</span></>}</button>)}); })(); })()}
        {typeof shortcuts !== 'object' || !Object.keys(shortcuts).length ? <div className="py-8 text-center text-sm text-zinc-500">Failed to load shortcuts. Using defaults.</div> : null}
        <div className="pt-4 border-t border-zinc-700/30"><button onClick={restoreDefaults} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors text-sm"><RefreshCw className="w-3.5 h-3.5" />Restore Defaults</button></div>
      </GlassCard>
      </SearchableSection>
    </div>
  );
}
