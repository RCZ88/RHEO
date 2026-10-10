import { useState, useRef, useEffect } from 'react';
import { Search, Sparkles, Wand2, BookOpen, MoreVertical, Play, Square, ExternalLink } from 'lucide-react';

interface DesignLibrary {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  icon: any;
  status: 'idle' | 'connecting' | 'connected' | 'error';
  itemCount: number;
  accentColor: string;
}

interface DesignLibrarySourcesProps {
  libraries: DesignLibrary[];
  onBrowse: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onConfigure?: (id: string) => void;
  onStartServer?: (id: string) => void;
  onStopServer?: (id: string) => void;
}

export default function DesignLibrarySources({ libraries, onBrowse, onToggle, onConfigure, onStartServer, onStopServer }: DesignLibrarySourcesProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getStatusText = (status: DesignLibrary['status'], itemCount: number) => {
    switch (status) {
      case 'connected': return `Connected · ${itemCount} items`;
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection error';
      default: return 'Not connected';
    }
  };

  const getStatusColor = (status: DesignLibrary['status']) => {
    switch (status) {
      case 'connected': return '#22d3ee';
      case 'connecting': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const openMenu = (id: string) => {
    const btn = buttonRefs.current.get(id);
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setMenuPos({ x: rect.right - 160, y: rect.bottom + 4 });
    }
    setMenuOpen(id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-zinc-200">Design Library Sources</h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {libraries.map((library) => {
          const Icon = library.icon;
          const isConnected = library.status === 'connected';
          const isConnecting = library.status === 'connecting';
          const canBrowse = isConnected && library.enabled;

          return (
            <div
              key={library.id}
              className="group relative overflow-hidden rounded-xl p-4 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-800/60 flex flex-col gap-2 transition-all hover:-translate-y-0.5 hover:border-zinc-700"
            >
              {/* accent strip */}
              <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5" style={{ background: `linear-gradient(to right, ${library.accentColor}, ${library.accentColor}00)` }} />
              {/* hover glow in source accent */}
              <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: `0 0 28px -8px ${library.accentColor}66, inset 0 0 0 1px ${library.accentColor}33` }} />
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg" style={{ backgroundColor: `${library.accentColor}1a` }}>
                    <Icon className="w-4 h-4" style={{ color: library.accentColor }} />
                  </span>
                  <span className="text-sm font-semibold text-zinc-100">{library.label}</span>
                </div>
                <button
                  ref={(el) => { if (el) buttonRefs.current.set(library.id, el); }}
                  onClick={() => menuOpen === library.id ? setMenuOpen(null) : openMenu(library.id)}
                  className="p-1 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/60 transition-colors duration-150"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Status */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStatusColor(library.status) }} />
                <span className={library.status === 'connected' ? 'text-zinc-400' : library.status === 'error' ? 'text-red-400' : 'text-zinc-600'}>
                  {getStatusText(library.status, library.itemCount)}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-zinc-500 line-clamp-2">{library.description}</p>

              {/* Actions */}
              <div className="flex gap-2 mt-1">
                {canBrowse && (
                  <button onClick={() => onBrowse(library.id)} className="flex-1 px-2 py-1.5 rounded-lg bg-zinc-800/60 text-zinc-300 text-[10px] font-medium hover:bg-zinc-700/60 transition-colors">
                    Browse
                  </button>
                )}
                {isConnected && onStopServer && (
                  <button onClick={() => onStopServer(library.id)} className="px-2 py-1.5 rounded-lg bg-red-900/30 text-red-400 text-[10px] font-medium hover:bg-red-900/50 transition-colors">
                    <Square className="w-3 h-3" />
                  </button>
                )}
                {!isConnected && !isConnecting && onStartServer && (
                  <button onClick={() => onStartServer(library.id)} className="px-2 py-1.5 rounded-lg bg-emerald-900/30 text-emerald-400 text-[10px] font-medium hover:bg-emerald-900/50 transition-colors">
                    <Play className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dropdown Menu — rendered via portal-like fixed positioning */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="fixed z-[9999] w-40 py-1 rounded-lg bg-zinc-800 border border-zinc-700/60 shadow-xl"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            onClick={() => { const id = menuOpen; setMenuOpen(null); onConfigure?.(id); }}
            className="w-full px-3 py-1.5 text-xs text-left text-zinc-300 hover:bg-zinc-700/60 transition-colors"
          >
            Configure
          </button>
          <button
            onClick={() => { const id = menuOpen; const lib = libraries.find(l => l.id === id); setMenuOpen(null); if (lib) onToggle(id, !lib.enabled); }}
            className="w-full px-3 py-1.5 text-xs text-left text-zinc-300 hover:bg-zinc-700/60 transition-colors"
          >
            {libraries.find(l => l.id === menuOpen)?.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      )}
    </div>
  );
}
