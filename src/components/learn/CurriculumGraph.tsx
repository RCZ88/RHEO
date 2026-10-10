import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, RotateCcw, BookOpen } from 'lucide-react';
import type { RenderableNode, NodeProgress, MasteryLevel } from '../../shared/learn/types';

const LEVEL_COLORS: Record<MasteryLevel, string> = {
  L0: '#5B6472',
  L1: '#5B8DEF',
  L2: '#23B5B5',
  L3: '#3CCB7F',
  L4: '#A78BFA',
  L5: '#F5C04E',
};

const LEVEL_ORDER: MasteryLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];

interface LayoutNode {
  id: string;
  title: string;
  mastery_target: MasteryLevel;
  currentLevel: MasteryLevel;
  x: number;
  y: number;
  prereq: string[];
}

interface LayoutEdge {
  from: string;
  to: string;
}

function layoutDag(nodes: LayoutNode[]): LayoutNode[] {
  const sorted = nodes.slice();
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  nodes.forEach((n) => {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  });
  nodes.forEach((n) => {
    (n.prereq || []).forEach((p) => {
      if (adj[p]) {
        adj[p].push(n.id);
        inDegree[n.id] = (inDegree[n.id] || 0) + 1;
      }
    });
  });

  const layers: string[][] = [];
  const queue: string[] = [];

  nodes.forEach((n) => {
    if (inDegree[n.id] === 0) queue.push(n.id);
  });

  const visited = new Set<string>();
  while (queue.length > 0) {
    const layer: string[] = [];
    const next: string[] = [];
    for (const id of queue) {
      if (!visited.has(id)) {
        visited.add(id);
        layer.push(id);
        (adj[id] || []).forEach((child) => {
          inDegree[child]--;
          if (inDegree[child] === 0) next.push(child);
        });
      }
    }
    if (layer.length > 0) layers.push(layer);
    queue.length = 0;
    queue.push(...next);
  }

  const result = nodes.map((n) => {
    const layerIdx = layers.findIndex((l) => l.includes(n.id));
    const colInLayer = layers[layerIdx]?.indexOf(n.id) || 0;
    const layerSize = layers[layerIdx]?.length || 1;
    return {
      ...n,
      x: layerIdx * 220 + 60,
      y: layerSize > 1 ? (colInLayer - (layerSize - 1) / 2) * 100 + 60 : 60,
    };
  });

  return result;
}

interface Props {
  nodes: RenderableNode[];
  progress: Record<string, NodeProgress>;
  selectedNode: string | null;
  onSelectNode: (id: string) => void;
  onExit?: () => void;
}

export function CurriculumGraph({ nodes, progress, selectedNode, onSelectNode, onExit }: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const graphNodes: LayoutNode[] = useMemo(() => {
    return nodes.map((n) => ({
      id: n.id,
      title: n.title,
      mastery_target: n.mastery_target,
      currentLevel: progress[n.id]?.level || 'L0',
      x: 0,
      y: 0,
      prereq: n.prereq || [],
    }));
  }, [nodes, progress]);

  const layouted = useMemo(() => layoutDag(graphNodes), [graphNodes]);

  const edges: LayoutEdge[] = useMemo(() => {
    const e: LayoutEdge[] = [];
    layouted.forEach((n) => {
      (n.prereq || []).forEach((p) => {
        e.push({ from: p, to: n.id });
      });
    });
    return e;
  }, [layouted]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setScale((s) => Math.max(0.3, Math.min(2, s - e.deltaY * 0.001)));
    }
  }, []);

  const minX = Math.min(...layouted.map((n) => n.x)) - 40;
  const maxX = Math.max(...layouted.map((n) => n.x)) + 40;
  const minY = Math.min(...layouted.map((n) => n.y)) - 40;
  const maxY = Math.max(...layouted.map((n) => n.y)) + 40;
  const svgW = Math.max(400, maxX - minX + 80);
  const svgH = Math.max(300, maxY - minY + 80);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onExit && (
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition"
              title="Back to reader"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Reader
            </button>
          )}
          <span className="text-xs text-zinc-500 truncate">Prerequisite DAG — nodes colored by mastery</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setScale((s) => Math.min(2, s + 0.2))} className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition" aria-label="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setScale((s) => Math.max(0.3, s - 0.2))} className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition" aria-label="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition" aria-label="Reset zoom">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto ws-scroll bg-zinc-900/20 light:bg-[var(--ws-surface-raised)]"
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          width={svgW * scale}
          height={svgH * scale}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="mx-auto"
          style={{ minWidth: svgW * scale, minHeight: svgH * scale }}
        >
          <g transform={`translate(${offset.x}, ${offset.y})`}>
            {/* Edges */}
            {edges.map((edge, i) => {
              const from = layouted.find((n) => n.id === edge.from);
              const to = layouted.find((n) => n.id === edge.to);
              if (!from || !to) return null;
              return (
                <line
                  key={`edge-${i}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={selectedNode === edge.from || selectedNode === edge.to ? '#6366f1' : '#3f3f46'}
                  strokeWidth={selectedNode === edge.from || selectedNode === edge.to ? 2 : 1}
                  strokeOpacity={0.6}
                />
              );
            })}

            {/* Nodes */}
            {layouted.map((n) => {
              const color = LEVEL_COLORS[n.currentLevel] || '#5B6472';
              const isSelected = n.id === selectedNode;
              const isLocked = (n.prereq || []).some((p) => {
                const pNode = nodes.find((nn) => nn.id === p);
                const pLevel = pNode?.progress?.level || 'L0';
                return LEVEL_ORDER.indexOf(pLevel) < LEVEL_ORDER.indexOf(n.mastery_target);
              });
              return (
                <g
                  key={n.id}
                  onClick={() => !isLocked && onSelectNode(n.id)}
                  className={isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}
                >
                  {/* Node body */}
                  <rect
                    x={n.x - 80}
                    y={n.y - 16}
                    width={160}
                    height={32}
                    rx={8}
                    fill={isSelected ? 'rgba(99, 102, 241, 0.15)' : isLocked ? 'rgba(63, 63, 70, 0.3)' : 'rgba(24, 24, 27, 0.8)'}
                    stroke={isSelected ? '#6366f1' : isLocked ? '#3f3f46' : color + '40'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  {/* Level indicator dot */}
                  <circle cx={n.x - 68} cy={n.y} r={4} fill={color} />
                  {/* Title */}
                  <text
                    x={n.x - 58}
                    y={n.y + 4}
                    fill={isLocked ? '#52525b' : '#e4e4e7'}
                    fontSize={11}
                    textAnchor="start"
                    className="select-none"
                  >
                    {n.title.length > 18 ? n.title.slice(0, 17) + '…' : n.title}
                  </text>
                  {/* Target badge */}
                  <text
                    x={n.x + 74}
                    y={n.y + 4}
                    fill={color + '80'}
                    fontSize={9}
                    textAnchor="end"
                    className="select-none"
                  >
                    {n.mastery_target}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
