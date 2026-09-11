import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sparkles, Wand2, BookOpen, Paintbrush, LayoutPanelTop, Code2, Rabbit, RefreshCw,
  Trash2, Play, Square, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';

type LibraryId = string;

interface SourceConfig {
  enabled: boolean;
  apiKey?: string;
  registryUrl?: string;
  mcpCommand?: string;
  autoStart: boolean;
  mcpEnabled?: boolean;
}

interface LibraryConfigModalProps {
  open: boolean;
  onClose: () => void;
  config: Record<string, any>;
  onSave: (config: Record<string, any>) => void;
  onConnectionChanged?: (id: LibraryId, status: 'connected' | 'error' | 'idle', itemCount?: number) => void;
}

const SOURCES: { id: LibraryId; label: string; accent: string; icon: any; desc: string }[] = [
  { id: '21st-dev', label: '21st.dev', accent: '#22d3ee', icon: Sparkles, desc: 'MCP-based component library' },
  { id: 'aceternity', label: 'Aceternity UI', accent: '#a78bfa', icon: Wand2, desc: 'HTTP registry-based library' },
  { id: 'refero', label: 'Refero', accent: '#34d399', icon: BookOpen, desc: 'MCP-based design system browser (Pro)' },
  { id: 'cult-ui', label: 'Cult UI', accent: '#f97316', icon: Paintbrush, desc: 'Premium shadcn registry components' },
  { id: 'fragments-ui', label: 'Fragments UI', accent: '#06b6d4', icon: LayoutPanelTop, desc: '66 components, 11 MCP tools, free' },
  { id: 'shadcn-ui-mcp', label: 'shadcn/ui MCP', accent: '#38bdf8', icon: Code2, desc: 'Multi-framework component docs' },
  { id: 'aidesigner', label: 'AIDesigner', accent: '#c084fc', icon: Sparkles, desc: 'Generate/refine designs via MCP' },
  { id: 'reactbits', label: 'React Bits', accent: '#f472b6', icon: Rabbit, desc: '135+ animated components, no API key' },
  { id: 'swishy-motion', label: 'Swishy Motion', accent: '#fbbf24', icon: Sparkles, desc: 'Kinetic typography presets + easing curves' },
  { id: 'variant', label: 'Variant', accent: '#c084fc', icon: Paintbrush, desc: 'Visual theme exploration canvas (opens variant.com)' },
];

function defaultConfig(id: LibraryId): SourceConfig {
  const cmdMap: Record<string, string> = {
    '21st-dev': 'npx -y @21st-dev/magic@latest',
    aceternity: '',
    refero: 'npx -y @refero/mcp@latest',
    'fragments-ui': 'npx -y @usefragments/mcp',
    'shadcn-ui-mcp': 'npx -y @jpisnice/shadcn-ui-mcp-server',
    'aidesigner': '',
    'reactbits': '',
    'cult-ui': '',
    'swishy-motion': '',
    'variant': '',
  };
  const registryUrls: Record<string, string> = {
    aceternity: 'https://ui.aceternity.com/registry',
    'cult-ui': 'https://www.cult-ui.com/r',
    'reactbits': 'https://reactbits.dev/registry',
    'swishy-motion': '',
    'variant': 'https://variant.com',
  };
  const apiKeys = ['21st-dev', 'refero', 'aidesigner'];
  return {
    enabled: false,
    apiKey: apiKeys.includes(id) ? '' : undefined,
    registryUrl: registryUrls[id],
    mcpCommand: cmdMap[id],
    autoStart: false,
  };
}

export default function LibraryConfigModal({ open, onClose, config: externalConfig, onSave, onConnectionChanged }: LibraryConfigModalProps) {
  const [sources, setSources] = useState<Record<LibraryId, SourceConfig>>(() => {
    const initial: Record<string, SourceConfig> = {};
    for (const s of SOURCES) initial[s.id] = defaultConfig(s.id);
    return initial as Record<LibraryId, SourceConfig>;
  });
  const [connStatus, setConnStatus] = useState<Record<LibraryId, 'idle' | 'testing' | 'running' | 'error'>>(() => {
    const initial: Record<string, string> = {};
    for (const s of SOURCES) initial[s.id] = 'idle';
    return initial as Record<LibraryId, 'idle' | 'testing' | 'running' | 'error'>;
  });
  const [connMsg, setConnMsg] = useState<Record<LibraryId, string>>(() => {
    const initial: Record<string, string> = {};
    for (const s of SOURCES) initial[s.id] = '';
    return initial as Record<LibraryId, string>;
  });
  const [loading, setLoading] = useState<Record<LibraryId, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const s of SOURCES) initial[s.id] = false;
    return initial as Record<LibraryId, boolean>;
  });

  useEffect(() => {
    if (!open) return;
    const allIds = SOURCES.map(s => s.id);
    const merged = Object.fromEntries(allIds.map(id => [
      id,
      { ...defaultConfig(id), ...(externalConfig?.sources?.[id] || {}) },
    ] as [string, SourceConfig])) as Record<LibraryId, SourceConfig>;
    setSources(merged);
    const idle = Object.fromEntries(allIds.map(id => [id, 'idle' as const]));
    const empty = Object.fromEntries(allIds.map(id => [id, '']));
    setConnStatus(idle);
    setConnMsg(empty);
    setLoading(Object.fromEntries(allIds.map(id => [id, false])));
    loadCurrentStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadCurrentStatus = async () => {
    const dapi = (window as any).deskflowAPI;
    for (const id of SOURCES.map(s => s.id)) {
      try {
        const status = await dapi?.mcpServerStatus?.(id);
        if (status?.status === 'running') {
          setConnStatus(p => ({ ...p, [id]: 'running' }));
          setConnMsg(p => ({ ...p, [id]: `Running · ${status.toolCount || 0} tools` }));
        }
      } catch {}
    }
  };

  const updateSource = (id: LibraryId, partial: Partial<SourceConfig>) => {
    setSources(p => ({ ...p, [id]: { ...p[id], ...partial } }));
  };

  const handleTestStart = async (id: LibraryId) => {
    setConnStatus(p => ({ ...p, [id]: 'testing' }));
    setConnMsg(p => ({ ...p, [id]: 'Starting...' }));
    const dapi = (window as any).deskflowAPI;
    try {
      if (id === 'aceternity') {
        const reg = await dapi?.aceternityFetchRegistry?.();
        if (reg?.success) {
          setConnStatus(p => ({ ...p, [id]: 'running' }));
          setConnMsg(p => ({ ...p, [id]: `Connected · ${reg.total || 0} components` }));
          onConnectionChanged?.(id, 'connected', reg.total || 0);
        } else {
          setConnStatus(p => ({ ...p, [id]: 'error' }));
          setConnMsg(p => ({ ...p, [id]: reg?.error || 'Registry fetch failed' }));
          onConnectionChanged?.(id, 'error');
        }
        return;
      }
      const result = await dapi?.mcpStartServer?.(id);
      if (result?.success) {
        const status = await dapi?.mcpServerStatus?.(id);
        if (status?.status === 'running') {
          setConnStatus(p => ({ ...p, [id]: 'running' }));
          setConnMsg(p => ({ ...p, [id]: `Running · ${status.toolCount || 0} tools` }));
          onConnectionChanged?.(id, 'connected', status.toolCount || 0);
        } else {
          setConnStatus(p => ({ ...p, [id]: 'error' }));
          setConnMsg(p => ({ ...p, [id]: status?.error || 'Server failed to start' }));
          onConnectionChanged?.(id, 'error');
        }
      } else {
        setConnStatus(p => ({ ...p, [id]: 'error' }));
        setConnMsg(p => ({ ...p, [id]: result?.error || 'Start failed' }));
        onConnectionChanged?.(id, 'error');
      }
    } catch (e) {
      setConnStatus(p => ({ ...p, [id]: 'error' }));
      setConnMsg(p => ({ ...p, [id]: String(e) }));
      onConnectionChanged?.(id, 'error');
    }
  };

  const handleStop = async (id: LibraryId) => {
    setLoading(p => ({ ...p, [id]: true }));
    const dapi = (window as any).deskflowAPI;
    try {
      await dapi?.mcpStopServer?.(id);
      setConnStatus(p => ({ ...p, [id]: 'idle' }));
      setConnMsg(p => ({ ...p, [id]: '' }));
      onConnectionChanged?.(id, 'idle');
    } catch {}
    setLoading(p => ({ ...p, [id]: false }));
  };

  const handleClearCache = async (id: LibraryId) => {
    const dapi = (window as any).deskflowAPI;
    try {
      await dapi?.setDesignLibraryConfig?.({ version: 1, sources: { [id]: { cacheCleared: Date.now() } } });
      setConnMsg(p => ({ ...p, [id]: 'Cache cleared' }));
    } catch {}
  };

  const handleRefresh = async (id: LibraryId) => {
    setLoading(p => ({ ...p, [id]: true }));
    await handleTestStart(id);
    setLoading(p => ({ ...p, [id]: false }));
  };

  const handleSave = () => {
    onSave({ version: 1, sources: { ...sources } });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/60 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800/60 shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">Design Library Sources</h2>
                <p className="text-sm text-zinc-500 mt-1">Configure connection and cache settings for all sources</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-zinc-800/60 transition-colors duration-150"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {SOURCES.map(source => {
                const cfg = sources[source.id] || defaultConfig(source.id);
                const status = connStatus[source.id] || 'idle';
                const message = connMsg[source.id] || '';
                const busy = loading[source.id] || status === 'testing';
                const Icon = source.icon;
                const isRunning = status === 'running';

                return (
                  <div key={source.id} className="rounded-xl bg-zinc-800/40 border border-zinc-700/40 p-5 space-y-4">
                    {/* Source Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" style={{ color: source.accent }} />
                        <div>
                          <span className="text-sm font-semibold text-zinc-200">{source.label}</span>
                          <p className="text-xs text-zinc-500">{source.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updateSource(source.id, { enabled: !cfg.enabled })}
                        className={`relative w-10 h-5 rounded-full transition-colors duration-150 ${
                          cfg.enabled ? 'bg-zinc-700' : 'bg-zinc-700/50'
                        }`}
                        style={cfg.enabled ? { backgroundColor: `${source.accent}40` } : {}}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform duration-150 bg-zinc-400 ${
                            cfg.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                          style={cfg.enabled ? { backgroundColor: source.accent } : {}}
                        />
                      </button>
                    </div>

                    {/* MCP Command + API Key */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">MCP Command</label>
                        <input
                          type="text"
                          value={cfg.mcpCommand || ''}
                          onChange={e => updateSource(source.id, { mcpCommand: e.target.value })}
                          placeholder="npx -y @package/mcp"
                          className="w-full px-2.5 py-1.5 bg-zinc-900/60 border border-zinc-700/60 rounded-lg
                            text-xs font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600
                            transition-colors duration-150"
                        />
                      </div>
                      {(source.id === '21st-dev' || source.id === 'refero' || source.id === 'aidesigner') && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">API Key</label>
                          <input
                            type="password"
                            value={cfg.apiKey || ''}
                            onChange={e => updateSource(source.id, { apiKey: e.target.value })}
                            placeholder="sk-..."
                            className="w-full px-2.5 py-1.5 bg-zinc-900/60 border border-zinc-700/60 rounded-lg
                              text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600
                              transition-colors duration-150"
                          />
                        </div>
                      )}
                      {source.id === 'aceternity' && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Registry URL</label>
                          <input
                            type="text"
                            value={cfg.registryUrl || ''}
                            onChange={e => updateSource(source.id, { registryUrl: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-zinc-900/60 border border-zinc-700/60 rounded-lg
                              text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600
                              transition-colors duration-150"
                          />
                        </div>
                      )}
                    </div>

                    {/* Auto-start Toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Auto-start on launch</span>
                      <button
                        onClick={() => updateSource(source.id, { autoStart: !cfg.autoStart })}
                        className={`relative w-8 h-4 rounded-full transition-colors duration-150 ${
                          cfg.autoStart ? 'bg-zinc-700' : 'bg-zinc-700/50'
                        }`}
                        style={cfg.autoStart ? { backgroundColor: `${source.accent}40` } : {}}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform duration-150 bg-zinc-400 ${
                            cfg.autoStart ? 'translate-x-4' : 'translate-x-0'
                          }`}
                          style={cfg.autoStart ? { backgroundColor: source.accent } : {}}
                        />
                      </button>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isRunning ? (
                        <button
                          onClick={() => handleStop(source.id)}
                          disabled={loading[source.id]}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50
                            transition-colors duration-150"
                        >
                          <Square className="w-3 h-3" />
                          Stop
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTestStart(source.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            bg-zinc-700/60 text-zinc-300 hover:bg-zinc-600/60 disabled:opacity-50
                            transition-colors duration-150"
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          {busy ? 'Starting...' : source.id === 'aceternity' ? 'Test Registry' : 'Start Server'}
                        </button>
                      )}
                      <button
                        onClick={() => handleRefresh(source.id)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          bg-zinc-700/60 text-zinc-400 hover:bg-zinc-600/60 disabled:opacity-50
                          transition-colors duration-150"
                      >
                        <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                      <button
                        onClick={() => handleClearCache(source.id)}
                        disabled={loading[source.id]}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          bg-zinc-700/60 text-zinc-400 hover:bg-zinc-600/60 transition-colors duration-150"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear Cache
                      </button>

                      {/* Status Indicator */}
                      {message && (
                        <span className={`inline-flex items-center gap-1 text-xs ml-auto ${
                          status === 'running' ? 'text-emerald-400' :
                          status === 'error' ? 'text-red-400' :
                          'text-zinc-500'
                        }`}>
                          {status === 'running' ? <CheckCircle2 className="w-3 h-3" /> :
                           status === 'error' ? <AlertCircle className="w-3 h-3" /> :
                           <Loader2 className="w-3 h-3 animate-spin" />}
                          {message}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-6 border-t border-zinc-800/60 shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium
                  text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60
                  transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg text-xs font-medium
                  bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30
                  transition-colors duration-150"
              >
                Save Configuration
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
