import { useState, useEffect, useRef, useCallback } from 'react';

interface DesignCommand {
  id: string;
  command: string;
  description: string;
  args: string;
}

const DESIGN_COMMANDS: DesignCommand[] = [
  { id: 'scrape-cari', command: 'deskflow-design scrape-cari', description: 'Fetch aesthetic references', args: '<query>' },
  { id: 'scrape-fonts', command: 'deskflow-design scrape-fonts', description: 'Fetch typography pairings', args: '<mood>' },
  { id: 'sync-tokens', command: 'deskflow-design sync-tokens', description: 'Write CSS variables to file', args: '--bg="#09090b" --primary="#06b6d4"' },
  { id: 'color-url', command: 'deskflow-design color-url', description: 'Generate Realtime Colors URL', args: '--bg="#09090b" --primary="#06b6d4"' },
  { id: 'get-motion', command: 'deskflow-design get-motion', description: 'Get motion boilerplate code', args: '<type>' },
  { id: 'list-motion', command: 'deskflow-design list-motion', description: 'List available motion templates', args: '' },
  { id: 'install', command: 'deskflow-design install', description: 'Install shadcn component', args: '<url>' },
];

interface TerminalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (command: string) => void;
}

export function TerminalCommandPalette({ isOpen, onClose, onExecute }: TerminalCommandPaletteProps) {
  const [input, setInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('deskflow-terminal-cmd-recent');
        setRecentCommands(stored ? JSON.parse(stored) : []);
      } catch { setRecentCommands([]); }
      setInput('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = input.trim()
    ? DESIGN_COMMANDS.filter(c =>
        c.command.toLowerCase().includes(input.toLowerCase()) ||
        c.description.toLowerCase().includes(input.toLowerCase()) ||
        c.id.toLowerCase().includes(input.toLowerCase())
      )
    : DESIGN_COMMANDS;

  const items = recentCommands.length > 0 && !input.trim()
    ? recentCommands.map(cmd => DESIGN_COMMANDS.find(c => c.command === cmd)).filter(Boolean) as DesignCommand[]
    : filtered;

  const handleSelect = useCallback((cmd: DesignCommand) => {
    const fullCmd = cmd.args ? `${cmd.command} ${cmd.args}` : cmd.command;
    onExecute(fullCmd);
    try {
      const recent = recentCommands.filter(r => r !== cmd.command);
      recent.unshift(cmd.command);
      localStorage.setItem('deskflow-terminal-cmd-recent', JSON.stringify(recent.slice(0, 5)));
    } catch {}
    onClose();
  }, [onExecute, onClose, recentCommands]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && items[selectedIndex]) { handleSelect(items[selectedIndex]); }
  };

  useEffect(() => { setSelectedIndex(0); }, [input]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4" onClick={onClose}>
      <div
        className="max-w-2xl mx-auto rounded-xl bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-700/60 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input Line */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/40">
          <span className="text-cyan-400 text-sm font-mono">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Design Command: "
            className="flex-1 bg-transparent text-zinc-200 text-sm font-mono placeholder-zinc-600 focus:outline-none"
          />
          <span className="text-[10px] text-zinc-600 font-mono">ESC</span>
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto py-1">
          {!input.trim() && recentCommands.length > 0 && (
            <div className="px-4 py-1.5">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono">Recent</span>
            </div>
          )}

          {items.length === 0 && input.trim() && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-zinc-500 font-mono">No matching commands</p>
            </div>
          )}

          {items.map((cmd, idx) => (
            <button
              key={cmd.id}
              onClick={() => handleSelect(cmd)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left font-mono transition-colors duration-75 ${
                idx === selectedIndex
                  ? 'bg-zinc-800/80 text-zinc-200'
                  : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-300'
              }`}
            >
              <span className="text-cyan-400 text-xs">{'> '}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs">{cmd.command}</span>
                {cmd.args && <span className="text-zinc-600 text-xs"> {cmd.args}</span>}
                <p className="text-[10px] text-zinc-500 truncate">{cmd.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-zinc-800/40 flex items-center gap-4 font-mono">
          <span className="text-[10px] text-zinc-600">
            <span className="text-zinc-500">↑↓</span> navigate
          </span>
          <span className="text-[10px] text-zinc-600">
            <span className="text-zinc-500">↵</span> execute
          </span>
          <span className="text-[10px] text-zinc-600">
            <span className="text-zinc-500">⌘K</span> toggle
          </span>
        </div>
      </div>
    </div>
  );
}
