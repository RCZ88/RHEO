import { useState } from 'react';
import { Monitor, GripVertical, Move, Split, LayoutGrid } from 'lucide-react';

interface PaneNode {
  id?: string;
  type: 'leaf' | 'split';
  direction?: 'row' | 'col';
  children?: PaneNode[];
  ratio?: number;
}

export function TerminalMapView({
  layout,
  terminalTabs,
  activeTerminalId,
  onMoveTerminal,
  onActivateTerminal,
}: {
  layout: PaneNode | null;
  terminalTabs: Record<string, { name: string; agent: string }>;
  activeTerminalId: string | null;
  onMoveTerminal: (terminalId: string, targetGroupId: string) => void;
  onActivateTerminal: (id: string) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(targetId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
    if (sourceId && sourceId !== targetId) {
      onMoveTerminal(sourceId, targetId);
    }
    setDraggedId(null);
    setDropTarget(null);
  };

  const renderNode = (node: PaneNode, depth = 0): React.ReactNode => {
    if (node.type === 'leaf' && node.id) {
      const info = terminalTabs[node.id];
      const isActive = activeTerminalId === node.id;
      const isDragged = draggedId === node.id;
      const isDropTarget2 = dropTarget === node.id;
      return (
        <div
          key={node.id}
          draggable
          onDragStart={(e) => handleDragStart(e, node.id!)}
          onDragOver={(e) => handleDragOver(e, node.id!)}
          onDrop={(e) => handleDrop(e, node.id!)}
          onDragLeave={() => setDropTarget(null)}
          onClick={() => onActivateTerminal(node.id!)}
          className={`relative rounded-xl p-3 cursor-pointer transition-all ${
            isActive ? 'bg-zinc-800/80 ring-1 ring-inset ring-green-500/40' :
            isDropTarget2 ? 'bg-zinc-800/60 ring-1 ring-inset ring-cyan-500/40' :
            'bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 hover:bg-zinc-800/40'
          } ${isDragged ? 'opacity-40' : 'opacity-100'}`}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-3 h-3 text-zinc-600 shrink-0 cursor-grab" />
            <Monitor className={`w-4 h-4 shrink-0 ${isActive ? 'text-green-400' : 'text-zinc-500'}`} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-200 truncate">{info?.name || node.id}</p>
              <p className="text-[10px] text-zinc-500">{info?.agent || 'none'}</p>
            </div>
            {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
          </div>
        </div>
      );
    }

    if (node.type === 'split' && node.children) {
      return (
        <div
          key={`split-${depth}`}
          className={`flex gap-2 p-2 rounded-xl bg-zinc-950 light:bg-[var(--ws-surface)]/30 ring-1 ring-inset ring-zinc-800/40 ${
            node.direction === 'col' ? 'flex-col' : 'flex-row'
          }`}
        >
          <div className="flex items-center gap-1 mb-1 px-1">
            <Split className="w-3 h-3 text-zinc-600" />
            <span className="text-[10px] text-zinc-600 uppercase">{node.direction}</span>
          </div>
          {node.children.map((child, i) => (
            <div key={i} className="flex-1 min-w-0">
              {renderNode(child, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  if (!layout) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
        <LayoutGrid className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-xs">No terminal layout</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Terminal Map</h3>
        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
          <Move className="w-3 h-3" />
          <span>Drag to reorder</span>
        </div>
      </div>
      {renderNode(layout)}
    </div>
  );
}
