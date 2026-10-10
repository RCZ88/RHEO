import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import type { PaneNode } from './TerminalWindow';

interface TerminalMiniMapProps {
  layouts: PaneNode[];
  activeTerminalId: string | null;
  activeGroupIndex?: number;
  onGroupSelect?: (index: number) => void;
  onTerminalSelect: (id: string) => void;
  onTerminalMove: (fromId: string, toId: string) => void;
  onSplit: (terminalId: string, direction: 'horizontal' | 'vertical') => void;
  onToggleDirection: (groupIndex: number, path: number[]) => void;
  onMoveToGroup?: (terminalId: string, targetGroupIndex: number) => void;
}

interface FlattenedItem {
  id: string;
  terminalId?: string;
  index: number;
}

function flattenLayout(node: PaneNode): FlattenedItem[] {
  const result: FlattenedItem[] = [];
  let index = 0;
  function traverse(n: PaneNode) {
    if (n.type === 'leaf') {
      result.push({ id: n.terminalId || `pane-${index}`, terminalId: n.terminalId, index });
      index++;
    } else if (n.children) {
      n.children.forEach(traverse);
    }
  }
  traverse(node);
  return result;
}

function GroupDropTarget({ groupIndex, groupLabel, visible }: { groupIndex: number; groupLabel: string; visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-${groupIndex}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex items-center justify-center text-[9px] rounded transition-all py-1 ${
        visible
          ? isOver
            ? 'bg-green-600/40 text-green-300 border border-green-500'
            : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700'
          : 'hidden'
      }`}
    >
      {groupLabel}
    </div>
  );
}

// Extract group count from a pane tree for cross-group drag targets
function getInternalGroups(layout: PaneNode): string[] {
  if (layout.type === 'leaf') return ['G1'];
  if (layout.children) return layout.children.map((_, i) => `G${i + 1}`);
  return ['G1'];
}

export function TerminalMiniMap({
  layouts,
  activeTerminalId,
  activeGroupIndex,
  onGroupSelect,
  onTerminalSelect,
  onTerminalMove,
  onSplit,
  onToggleDirection,
  onMoveToGroup,
}: TerminalMiniMapProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<'swap' | 'split-h' | 'split-v' | null>(null);
  const [selGroup, setSelGroup] = useState(0);

  // Number of groups: use layouts array length OR children count of the root tree
  const groupCount = Math.max(layouts.length, layouts[0] && layouts[0].children ? layouts[0].children.length : 1);

  // Sync from parent
  const effectiveGroup = typeof activeGroupIndex === 'number' ? activeGroupIndex : selGroup;
  useEffect(() => {
    if (typeof activeGroupIndex === 'undefined' && selGroup >= groupCount) {
      setSelGroup(Math.max(0, groupCount - 1));
    }
  }, [groupCount, selGroup, activeGroupIndex]);

  const handleGroupSelect = useCallback((index: number) => {
    if (onGroupSelect) {
      onGroupSelect(index);
    } else {
      setSelGroup(index);
    }
  }, [onGroupSelect]);

  // Auto-switch to group containing active terminal (only when uncontrolled)
  useEffect(() => {
    if (!activeTerminalId || groupCount <= 1 || typeof activeGroupIndex !== 'undefined') return;
    for (let i = 0; i < groupCount; i++) {
      const term = flattenLayout(layouts[i]);
      if (term.some(t => t.terminalId === activeTerminalId)) {
        setSelGroup(i);
        break;
      }
    }
  }, [activeTerminalId, layouts, groupCount, activeGroupIndex]);

  const currentLayout = groupCount > 0 ? layouts[effectiveGroup] : null;
  const terminals = currentLayout ? flattenLayout(currentLayout) : [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggedId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    if (event.over) {
      const element = document.getElementById(event.over.id as string);
      if (!element) { setDropMode(null); return; }
      const rect = element.getBoundingClientRect();
      const delta = event.delta || { x: 0, y: 0 };
      const active = event.active;
      const pointerX = (active?.rect?.current?.initial?.left || 0) + delta.x + (active?.rect?.current?.initial?.width || 0) / 2;
      const pointerY = (active?.rect?.current?.initial?.top || 0) + delta.y + (active?.rect?.current?.initial?.height || 0) / 2;
      const relX = (pointerX - rect.left) / rect.width;
      const relY = (pointerY - rect.top) / rect.height;
      if (relY < 0.25) setDropMode('split-h');
      else if (relY > 0.75) setDropMode('split-h');
      else if (relX < 0.25) setDropMode('split-v');
      else if (relX > 0.75) setDropMode('split-v');
      else setDropMode('swap');
    } else {
      setDropMode(null);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const sourceId = active.id as string;
        const targetId = over.id as string;
        // Check if target is a group droppable (cross-group move)
        const groupMatch = targetId.match(/^group-(\d+)$/);
        if (groupMatch) {
          const targetGroupIndex = parseInt(groupMatch[1], 10);
          if (onMoveToGroup) onMoveToGroup(sourceId, targetGroupIndex);
        } else if (dropMode === 'swap') onTerminalMove(sourceId, targetId);
        else if (dropMode === 'split-h') onSplit(targetId, 'horizontal');
        else if (dropMode === 'split-v') onSplit(targetId, 'vertical');
      }
      setDraggedId(null);
      setDropMode(null);
    },
    [dropMode, onTerminalMove, onSplit, onMoveToGroup]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="relative w-full bg-zinc-900 light:bg-[var(--ws-surface-raised)] rounded border border-zinc-700 overflow-hidden h-full min-h-[60px]">
        {groupCount === 0 ? (
          <div className="flex items-center justify-center h-[100px] text-[10px] text-zinc-600">
            No terminals
          </div>
        ) : (
          <>
            {groupCount > 1 && (
              <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800">
                <button
                  onClick={() => handleGroupSelect(Math.max(0, effectiveGroup - 1))}
                  disabled={effectiveGroup === 0}
                  className="text-zinc-500 hover:text-white disabled:text-zinc-700 disabled:cursor-default transition-colors p-0.5"
                >
                  ◀
                </button>
                <span className="text-[10px] text-zinc-500">
                  {effectiveGroup + 1} / {groupCount}
                </span>
                <button
                  onClick={() => handleGroupSelect(Math.min(groupCount - 1, effectiveGroup + 1))}
                  disabled={effectiveGroup === groupCount - 1}
                  className="text-zinc-500 hover:text-white disabled:text-zinc-700 disabled:cursor-default transition-colors p-0.5"
                >
                  ▶
                </button>
              </div>
            )}
            <div className="h-full p-1 overflow-hidden">
              {currentLayout && (
                <div className="relative w-full h-full">
                  <TreePane
                    node={currentLayout}
                    terminals={terminals}
                    activeTerminalId={activeTerminalId}
                    onTerminalSelect={onTerminalSelect}
                    onToggleDirection={(path) => onToggleDirection(effectiveGroup, path)}
                    path={[]}
                  />
                </div>
              )}
            </div>
            {onMoveToGroup && (
              <div className="flex gap-1 px-1 pb-1">
                {Array.from({ length: groupCount }).map((_unused, gi) => (
                  <GroupDropTarget
                    key={gi}
                    groupIndex={gi}
                    groupLabel={gi === effectiveGroup ? `G${gi + 1} (current)` : `→ G${gi + 1}`}
                    visible={!!draggedId && groupCount > 1 && gi !== effectiveGroup}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {dropMode && (
          <div className={`absolute inset-0 pointer-events-none z-10 transition-opacity ${
            dropMode === 'swap' ? 'bg-blue-500/10 border-2 border-dashed border-blue-400' :
            dropMode === 'split-v' ? 'bg-gradient-to-r from-transparent via-green-500/20 to-transparent border-x-2 border-dashed border-green-500' :
            'bg-gradient-to-b from-transparent via-green-500/20 to-transparent border-y-2 border-dashed border-green-500'
          }`} />
        )}
        <div className="sticky bottom-0 left-0 right-0 flex flex-col gap-1 p-1 z-20">
          <div className="flex justify-center gap-1">
            {dropMode === 'swap' && <span className="text-[9px] text-blue-400 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] px-2 py-0.5 rounded">Swap</span>}
            {dropMode === 'split-v' && <span className="text-[9px] text-green-400 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] px-2 py-0.5 rounded">Split Vertically</span>}
            {dropMode === 'split-h' && <span className="text-[9px] text-green-400 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] px-2 py-0.5 rounded">Split Horizontally</span>}
          </div>
          
        </div>
      </div>
      <DragOverlay>
        {draggedId && (
          <div className="bg-blue-600/80 rounded-lg border border-blue-500/70 shadow-xl p-2 text-xs text-white">
            {terminals.find(t => t.id === draggedId) ? `T${terminals.findIndex(t => t.id === draggedId) + 1}` : draggedId}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function TreePane({
  node,
  terminals,
  activeTerminalId,
  onTerminalSelect,
  onToggleDirection,
  path,
}: {
  node: PaneNode;
  terminals: FlattenedItem[];
  activeTerminalId: string | null;
  onTerminalSelect: (id: string) => void;
  onToggleDirection: (path: number[]) => void;
  path: number[];
}) {
  if (node.type === 'leaf') {
    const index = terminals.findIndex(t => t.terminalId === node.terminalId);
    return (
      <LeafPane
        id={node.terminalId!}
        label={index >= 0 ? `T${index + 1}` : '?'}
        isActive={node.terminalId === activeTerminalId}
        onClick={() => onTerminalSelect(node.terminalId!)}
      />
    );
  }

  const dir = node.direction || 'vertical';
  return (
    <div className={`flex ${dir === 'horizontal' ? 'flex-row' : 'flex-col'} w-full h-full gap-0.5`}>
      <div className="flex-1 min-h-0 min-w-0">
        <TreePane
          node={node.children![0]}
          terminals={terminals}
          activeTerminalId={activeTerminalId}
          onTerminalSelect={onTerminalSelect}
          onToggleDirection={onToggleDirection}
          path={[...path, 0]}
        />
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleDirection(path); }}
        className={`flex-shrink-0 bg-zinc-700/50 hover:bg-green-600/60 transition-colors flex items-center justify-center z-10 ${
          dir === 'horizontal' ? 'w-3 cursor-pointer rounded' : 'h-3 cursor-pointer rounded'
        }`}
        title={`Toggle direction (currently ${dir})`}
      >
        <span className="text-[8px] text-zinc-400 leading-none">
          {dir === 'horizontal' ? '⇔' : '⇕'}
        </span>
      </button>
      <div className="flex-1 min-h-0 min-w-0">
        <TreePane
          node={node.children![1]}
          terminals={terminals}
          activeTerminalId={activeTerminalId}
          onTerminalSelect={onTerminalSelect}
          onToggleDirection={onToggleDirection}
          path={[...path, 1]}
        />
      </div>
    </div>
  );
}

function LeafPane({
  id,
  label,
  isActive,
  onClick,
}: {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id });
  const setRefs = useCallback((el: HTMLElement | null) => { setDragRef(el); setDropRef(el); }, [setDragRef, setDropRef]);

  return (
    <div
      ref={setRefs}
      id={id}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className={`w-full h-full bg-zinc-800 rounded border cursor-grab active:cursor-grabbing transition-all flex items-center justify-center select-none ${
        isDragging
          ? 'opacity-40 border-cyan-400'
          : isOver
          ? 'border-amber-400 bg-zinc-700/60'
          : isActive
          ? 'border-green-500 bg-zinc-700'
          : isHovered
          ? 'border-zinc-500 bg-zinc-700/50'
          : 'border-zinc-700'
      }`}
    >
      <span className={`text-[10px] font-semibold ${isActive ? 'text-green-400' : 'text-zinc-500'}`}>
        {label}
      </span>
    </div>
  );
}

export default TerminalMiniMap;
