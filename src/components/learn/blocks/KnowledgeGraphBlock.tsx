import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

cytoscape.use(dagre);

const LEVEL_COLORS: Record<string, string> = {
  L0: '#5B6472', L1: '#5B8DEF', L2: '#23B5B5',
  L3: '#3CCB7F', L4: '#A78BFA', L5: '#F5C04E',
};

interface GraphNode {
  id: string;
  label: string;
  mastery_level?: string;
  part?: number;
  type?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout?: string;
  onNodeSelect?: (nodeId: string) => void;
}

export function KnowledgeGraphBlock({ nodes, edges, layout = 'dagre', onNodeSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const initGraph = useCallback(() => {
    if (!containerRef.current || nodes.length === 0) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map(n => ({
          data: { id: n.id, label: n.label, mastery: n.mastery_level || 'L0', part: n.part || 0, type: n.type || 'concept' },
        })),
        ...edges.map(e => ({
          data: { id: e.id, source: e.source, target: e.target, label: e.label || '', type: e.type || 'prerequisite' },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele: any) => LEVEL_COLORS[ele.data('mastery')] || LEVEL_COLORS.L0,
            'border-width': 2,
            'border-color': '#44403c',
            'border-opacity': 0.8,
            'width': 40,
            'height': 40,
            'label': 'data(label)',
            'color': '#f5f5f4',
            'font-size': '11px',
            'font-family': 'Inter, system-ui, sans-serif',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'text-background-color': '#1c1917',
            'text-background-opacity': 0.9,
            'text-background-padding': '4px',
            'text-background-shape': 'roundrectangle',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#d97706',
            'shadow-blur': 15,
            'shadow-color': '#d97706',
            'shadow-opacity': 0.4,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#57534e',
            'target-arrow-color': '#57534e',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
            'label': 'data(label)',
            'color': '#a8a29e',
            'font-size': '9px',
            'text-background-color': '#1c1917',
            'text-background-opacity': 0.8,
            'text-background-padding': '2px',
          },
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#d97706',
            'target-arrow-color': '#d97706',
            'width': 2.5,
            'shadow-blur': 8,
            'shadow-color': '#d97706',
            'shadow-opacity': 0.3,
          },
        },
        {
          selector: '.dimmed',
          style: {
            'opacity': 0.2,
            'transition-property': 'opacity',
            'transition-duration': '0.3s',
          },
        },
      ],
      layout: { name: layout, padding: 20, spacingFactor: 1.2, animate: true, animationDuration: 500, rankDir: 'TB' } as any,
      minZoom: 0.3,
      maxZoom: 2.5,
      wheelSensitivity: 0.3,
    });

    cy.on('tap', 'node', (evt) => {
      const nodeId = evt.target.id();
      onNodeSelect?.(nodeId);
      cy.elements().removeClass('dimmed highlighted');
      const path = cy.elements().aStar({ root: cy.getElementById(nodeId), goal: cy.getElementById(nodeId), directed: true });
      if (path.found) {
        path.path.addClass('highlighted');
        cy.elements().not(path.path).addClass('dimmed');
      }
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('dimmed highlighted');
      }
    });

    cy.on('mouseover', 'node', (evt) => {
      evt.target.animate({ style: { 'border-color': '#d97706', 'border-width': 3 } }, { duration: 200 });
    });

    cy.on('mouseout', 'node', (evt) => {
      evt.target.animate({ style: { 'border-color': '#44403c', 'border-width': 2 } }, { duration: 200 });
    });

    cyRef.current = cy;
    return () => { cy.destroy(); };
  }, [nodes, edges, layout, onNodeSelect]);

  useEffect(() => {
    const cleanup = initGraph();
    return cleanup;
  }, [initGraph]);

  useEffect(() => {
    if (!cyRef.current || !searchTerm) return;
    const cy = cyRef.current;
    const matches = cy.nodes().filter((n: any) => n.data('label').toLowerCase().includes(searchTerm.toLowerCase()));
    cy.elements().addClass('dimmed');
    matches.removeClass('dimmed');
    if (matches.length > 0) cy.fit(matches, 50);
  }, [searchTerm]);

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-700/50 bg-zinc-800/60 text-zinc-200 text-[13px] outline-none focus:border-amber-500/50 placeholder-zinc-600"
        />
        <button onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)} className="w-7 h-7 rounded-md border border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 flex items-center justify-center text-sm transition-all">+</button>
        <button onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)} className="w-7 h-7 rounded-md border border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 flex items-center justify-center text-sm transition-all">−</button>
        <button onClick={() => cyRef.current?.fit(undefined, 50)} className="w-7 h-7 rounded-md border border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 flex items-center justify-center text-sm transition-all">⊘</button>
      </div>
      <div ref={containerRef} className="w-full h-[400px]" />
      <div className="flex gap-4 px-4 py-2.5 border-t border-zinc-800 text-[11px] text-zinc-500 flex-wrap">
        {Object.entries(LEVEL_COLORS).map(([level, color]) => (
          <div key={level} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span>{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
