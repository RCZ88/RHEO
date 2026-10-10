import { useCallback, useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import type { PaneNode } from './TerminalWindow';

interface MapEditorProps {
  layout: PaneNode;
  onLayoutChange: (layout: PaneNode) => void;
  hoveredPane: string | null;
  setHoveredPane: (id: string | null) => void;
}

interface FlattenedPane {
  id: string;
  terminalId?: string;
  index: number;
}

/**
 * Flatten the PaneNode tree into an array of leaf nodes
 */
function flattenPanes(node: PaneNode): FlattenedPane[] {
  const result: FlattenedPane[] = [];
  let index = 0;

  function traverse(n: PaneNode) {
    if (n.type === 'leaf') {
      result.push({
        id: n.terminalId || `pane-${index}`,
        terminalId: n.terminalId,
        index,
      });
      index++;
    } else if (n.children) {
      n.children.forEach(traverse);
    }
  }

  traverse(node);
  return result;
}

/**
 * Find a leaf node by terminalId in the tree and replace it
 */
function replaceLeafInTree(
  node: PaneNode,
  targetId: string,
  newNode: PaneNode
): PaneNode {
  if (node.type === 'leaf' && node.terminalId === targetId) {
    return newNode;
  }
  if (node.children) {
    return {
      type: node.type,
      terminalId: node.terminalId,
      direction: node.direction,
      splitRatio: node.splitRatio,
      children: [
        replaceLeafInTree(node.children[0], targetId, newNode),
        replaceLeafInTree(node.children[1], targetId, newNode),
      ],
    };
  }
  return node;
}

/**
 * Swap two leaves in the tree
 */
export function swapLeavesInTree(node: PaneNode, id1: string, id2: string): PaneNode {
  // First, find both nodes and extract them
  let node1: PaneNode | null = null;
  let node2: PaneNode | null = null;

  function find(n: PaneNode) {
    if (n.type === 'leaf') {
      if (n.terminalId === id1) node1 = n;
      if (n.terminalId === id2) node2 = n;
    } else if (n.children) {
      n.children.forEach(find);
    }
  }

  find(node);

  if (!node1 || !node2) return node;

  // Now swap them by replacing id1 with a temp marker, then id2 with id1, then temp with id2
  const tempNode1: PaneNode = { type: 'leaf', terminalId: '__TEMP__' };
  const newNode1: PaneNode = { type: 'leaf', terminalId: id2 };
  const newNode2: PaneNode = { type: 'leaf', terminalId: id1 };

  let temp = replaceLeafInTree(node, id1, tempNode1);
  temp = replaceLeafInTree(temp, id2, newNode1);
  temp = replaceLeafInTree(temp, '__TEMP__', newNode2);

  return temp;
}

/**
 * Create a split from a drag-to-split gesture
 */
function createSplitFromDrag(
  node: PaneNode,
  sourceId: string,
  targetId: string,
  direction: 'horizontal' | 'vertical'
): PaneNode {
  // Find the target leaf and replace it with a split
  function replaceSplit(n: PaneNode): PaneNode {
    if (n.type === 'leaf' && n.terminalId === targetId) {
      const sourcePane: PaneNode = { type: 'leaf', terminalId: sourceId };
      return {
        type: 'split',
        direction,
        splitRatio: 0.5,
        children: [sourcePane, n],
      };
    }
    if (n.children) {
      return {
        type: n.type,
        terminalId: n.terminalId,
        direction: n.direction,
        splitRatio: n.splitRatio,
        children: [replaceSplit(n.children[0]), replaceSplit(n.children[1])],
      };
    }
    return n;
  }

  return replaceSplit(node);
}

export function MapEditor({
  layout,
  onLayoutChange,
  hoveredPane,
  setHoveredPane,
}: MapEditorProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<'swap' | 'split-h' | 'split-v' | null>(null);

  const panes = useMemo(() => flattenPanes(layout), [layout]);

  const sensors = useSensors(
    useSensor(PointerSensor)
  );

  const handleDragStart = useCallback(
    (e: any) => {
      setDraggedId(e.active.id);
      setDropMode('swap');
    },
    []
  );

  const handleDragOver = useCallback(
    (e: any) => {
      if (e.over) {
        const element = document.getElementById(e.over.id as string);
        if (!element) { setDropMode('swap'); return; }

        const rect = element.getBoundingClientRect();
        const initial = e.active?.rect?.current?.initial;
        const delta = e.delta || { x: 0, y: 0 };

        if (initial) {
          const pointerX = initial.left + delta.x + initial.width / 2;
          const pointerY = initial.top + delta.y + initial.height / 2;

          const relX = (pointerX - rect.left) / rect.width;
          const relY = (pointerY - rect.top) / rect.height;

          if (relY < 0.25) setDropMode('split-h');
          else if (relY > 0.75) setDropMode('split-h');
          else if (relX < 0.25) setDropMode('split-v');
          else if (relX > 0.75) setDropMode('split-v');
          else setDropMode('swap');
        } else {
          setDropMode('swap');
        }
      }
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const sourceId = active.id as string;
        const targetId = over.id as string;

        let newLayout = layout;

        if (dropMode === 'swap') {
          newLayout = swapLeavesInTree(layout, sourceId, targetId);
        } else if (dropMode === 'split-h') {
          newLayout = createSplitFromDrag(layout, sourceId, targetId, 'horizontal');
        } else if (dropMode === 'split-v') {
          newLayout = createSplitFromDrag(layout, sourceId, targetId, 'vertical');
        }

        onLayoutChange(newLayout);
      }

      setDraggedId(null);
      setDropMode(null);
    },
    [layout, dropMode, onLayoutChange]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="relative w-full aspect-square bg-zinc-900 light:bg-[var(--ws-surface-raised)] rounded border border-zinc-700 overflow-hidden">
        <div className="absolute inset-2 grid grid-cols-2 gap-1">
          {panes.map((pane, idx) => (
            <DraggablePane
              key={pane.id}
              pane={pane}
              index={idx}
              isDragged={draggedId === pane.id}
              isHovered={hoveredPane === pane.id}
              onMouseEnter={() => setHoveredPane(pane.id)}
              onMouseLeave={() => setHoveredPane(null)}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {draggedId && (
          <div className="bg-blue-600 rounded-lg border border-blue-500/70 shadow-xl p-2">
            <div className="text-xs text-white font-semibold">
              Dragging: {draggedId}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface DraggablePaneProps {
  pane: FlattenedPane;
  index: number;
  isDragged: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function DraggablePane({
  pane,
  index,
  isDragged,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}: DraggablePaneProps) {
  const [isDropTarget, setIsDropTarget] = useState(false);

  return (
    <div
      id={pane.id}
      draggable
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDragEnter={() => setIsDropTarget(true)}
      onDragLeave={() => setIsDropTarget(false)}
      className={`relative bg-zinc-800 rounded border transition-all cursor-grab active:cursor-grabbing ${
        isDragged
          ? 'opacity-50 border-blue-400'
          : isHovered
          ? 'border-green-500'
          : isDropTarget
          ? 'border-yellow-500 bg-zinc-700'
          : 'border-zinc-700'
      }`}
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent('focus-terminal', {
            detail: { terminalId: pane.terminalId || pane.id },
          })
        );
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] text-zinc-500 font-semibold">T{index + 1}</span>
      </div>
      {isHovered && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-700 text-zinc-200 text-xs px-2 py-1 rounded whitespace-nowrap z-10">
          <div className="font-medium">{pane.terminalId || pane.id}</div>
          <div className="text-[10px] text-zinc-400">Drag to rearrange</div>
        </div>
      )}
    </div>
  );
}
