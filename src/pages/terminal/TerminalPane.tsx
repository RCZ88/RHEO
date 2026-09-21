import { X } from 'lucide-react';
import { PaneNode } from '../components/TerminalWindow';
import { TerminalLayout, getLeafIds, getGroupTrees } from '../components/TerminalWindow';

export function TerminalPane({ terminalId, tabName, agent, isActive, onClose, onFocus }: { terminalId: string; tabName: string; agent: string; isActive: boolean; onClose?: () => void; onFocus?: () => void }) {
  return (
    <div className={`flex-1 flex flex-col border-r border-zinc-800/50 ${isActive ? 'bg-zinc-900' : 'bg-zinc-950/50'}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/50 border-b border-zinc-800/50">
        <span className="text-[11px] font-medium text-zinc-300 truncate">{tabName}</span>
        <span className="text-[9px] text-zinc-500">{agent}</span>
        {onClose && <button onClick={onClose} className="ml-2 text-zinc-500 hover:text-zinc-300"><X className="w-3 h-3" /></button>}
      </div>
      <div className="flex-1 min-h-0">
        {/* Terminal content rendered via terminal emulator */}
      </div>
    </div>
  );
}
