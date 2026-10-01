import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Clock, ArrowRight, Loader2, Palette, Type, Package, Wand2 } from 'lucide-react';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  activeTerminalId: string | null;
  onExecuteCommand: (action: string, args: string) => void;
}

const BUILTIN_COMMANDS: Command[] = [
  { id: 'generate-theme', label: 'Generate Theme', description: 'Scrape CARI for aesthetic descriptors and generate CSS variables', icon: <Palette className="w-4 h-4" />, action: 'generate theme' },
  { id: 'typography-pairs', label: 'Get Typography Pairs', description: 'Search FontsInUse for font pairings matching a mood', icon: <Type className="w-4 h-4" />, action: 'typography' },
  { id: 'install-component', label: 'Install Component', description: 'Install a shadcn component from a registry URL', icon: <Package className="w-4 h-4" />, action: 'install' },
  { id: 'motion-template', label: 'Get Motion Template', description: 'Get GSAP, Lenis, or Vanta boilerplate code', icon: <Wand2 className="w-4 h-4" />, action: 'motion' },
];

const RECENT_KEY = 'deskflow-command-palette-recent';

function getRecentCommands(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveRecentCommand(action: string) {
  try {
    const recent = getRecentCommands().filter(r => r !== action);
    recent.unshift(action);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
  } catch {}
}

export function CommandPalette({ isOpen, onClose, activeTerminalId, onExecuteCommand }: CommandPaletteProps) {
  const [input, setInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRecentCommands(getRecentCommands());
      setInput('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const isCommandMode = input.startsWith('>');
  const commandText = isCommandMode ? input.slice(1).trim() : '';

  const filteredCommands = isCommandMode
    ? BUILTIN_COMMANDS.filter(cmd =>
        cmd.action.toLowerCase().includes(commandText.toLowerCase()) ||
        cmd.label.toLowerCase().includes(commandText.toLowerCase())
      )
    : BUILTIN_COMMANDS;

  const showRecent = !isCommandMode && !input && recentCommands.length > 0;
  const displayItems = showRecent ? recentCommands : filteredCommands.map(c => c.action);

  const handleSelect = useCallback((action: string) => {
    if (isCommandMode) {
      const args = commandText;
      setIsExecuting(true);
      saveRecentCommand(action);
      onExecuteCommand(action, args);
      setTimeout(() => { setIsExecuting(false); onClose(); }, 500);
    } else {
      setInput(`> ${action} `);
      inputRef.current?.focus();
    }
  }, [isCommandMode, commandText, onExecuteCommand, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, displayItems.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (displayItems[selectedIndex]) handleSelect(displayItems[selectedIndex]);
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [input]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/60 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/40">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isCommandMode ? 'Type a command...' : 'Type > for commands, or search...'}
            className="flex-1 bg-transparent text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none"
          />
          {isExecuting && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[10px] font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-64 overflow-y-auto py-1">
          {showRecent && (
            <div className="px-3 py-1.5">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Recent</span>
            </div>
          )}

          {displayItems.length === 0 && isCommandMode && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-zinc-500">No matching commands</p>
            </div>
          )}

          {displayItems.map((item, idx) => {
            const cmd = BUILTIN_COMMANDS.find(c => c.action === item);
            return (
              <button
                key={`${item}-${idx}`}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                  idx === selectedIndex
                    ? 'bg-zinc-800/80 text-zinc-200'
                    : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-300'
                }`}
              >
                {cmd ? (
                  <span className="text-zinc-500">{cmd.icon}</span>
                ) : (
                  <Clock className="w-4 h-4 text-zinc-600" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium">{cmd?.label || item}</span>
                  {cmd && (
                    <p className="text-[10px] text-zinc-500 truncate">{cmd.description}</p>
                  )}
                </div>
                <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-zinc-800/40 flex items-center gap-4">
          <span className="text-[10px] text-zinc-600">
            <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono">↑↓</kbd> navigate
          </span>
          <span className="text-[10px] text-zinc-600">
            <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono">↵</kbd> execute
          </span>
          <span className="text-[10px] text-zinc-600">
            <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono">&gt;</kbd> command mode
          </span>
        </div>
      </div>
    </div>
  );
}
