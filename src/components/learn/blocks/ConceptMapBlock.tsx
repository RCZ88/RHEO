import React, { useState } from 'react';

interface ConceptMapNode {
  id: string;
  label: string;
  description?: string;
  mastery_target?: string;
  misconception?: string;
  children?: ConceptMapNode[];
  collapsed?: boolean;
}

interface Props {
  meta: {
    root: ConceptMapNode;
    max_depth?: number;
    color_by_mastery?: boolean;
    collapsible?: boolean;
    layout?: string;
  };
}

const LEVEL_COLORS: Record<string, string> = {
  L0: '#5B6472', L1: '#5B8DEF', L2: '#23B5B5',
  L3: '#3CCB7F', L4: '#A78BFA', L5: '#F5C04E',
};

function TreeNode({ node, depth = 0, isLast = true, parentColor = '#57534e' }: {
  node: ConceptMapNode;
  depth?: number;
  isLast?: boolean;
  parentColor?: string;
}) {
  const [collapsed, setCollapsed] = useState(node.collapsed ?? depth > 1);
  const hasChildren = node.children && node.children.length > 0;
  const color = node.mastery_target ? LEVEL_COLORS[node.mastery_target] : '#a8a29e';

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-2">
        {/* Connector */}
        <div className="flex flex-col items-center w-5 flex-shrink-0">
          <div className="w-3 h-[1.5px] mt-[18px] ml-auto" style={{ background: parentColor }} />
          {!isLast && <div className="w-[1.5px] flex-1 min-h-5" style={{ background: 'rgba(41,37,36,0.6)' }} />}
        </div>

        {/* Node */}
        <div className="flex-1 pb-2">
          <div
            onClick={() => hasChildren && setCollapsed(!collapsed)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium text-zinc-100 transition-all cursor-pointer max-w-full"
            style={{
              borderColor: color,
              background: `color-mix(in srgb, ${color} 8%, transparent)`,
            }}
            onMouseOver={(e) => {
              if (hasChildren) (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb, ${color} 15%, transparent)`;
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb, ${color} 8%, transparent)`;
            }}
          >
            {hasChildren && (
              <span className="text-[10px] transition-transform duration-200" style={{ color, transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
            )}
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <div>
              <div>{node.label}</div>
              {node.description && <div className="text-xs text-zinc-500 mt-0.5 leading-snug">{node.description}</div>}
              {node.misconception && (
                <div className="text-[11px] text-red-400 mt-1 px-2 py-1 rounded-md bg-red-500/8 border border-dashed border-red-500/30">
                  ⚠️ {node.misconception}
                </div>
              )}
            </div>
          </div>

          {!collapsed && hasChildren && (
            <div className="mt-2 ml-1">
              {node.children!.map((child, i) => (
                <TreeNode key={child.id} node={child} depth={depth + 1} isLast={i === node.children!.length - 1} parentColor={color} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConceptMapBlock({ meta }: Props) {
  const { root } = meta;
  const [zoom, setZoom] = useState(1);

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
          <span className="text-base">🗺️</span>
          Concept Map
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.5))} className="w-6 h-6 rounded-md border border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 flex items-center justify-center text-xs transition-all">−</button>
          <span className="text-xs text-zinc-500 flex items-center justify-center min-w-[40px]" style={{ fontFamily: '"JetBrains Mono", monospace' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(z * 1.2, 2))} className="w-6 h-6 rounded-md border border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 flex items-center justify-center text-xs transition-all">+</button>
          <button onClick={() => setZoom(1)} className="w-6 h-6 rounded-md border border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 flex items-center justify-center text-xs transition-all">⟲</button>
        </div>
      </div>

      <div className="p-5 overflow-auto max-h-[500px]">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', transition: 'transform 0.2s ease' }}>
          <TreeNode node={root} depth={0} isLast={true} />
        </div>
      </div>

      <div className="flex gap-4 px-4 py-2.5 border-t border-zinc-800 text-[11px] text-zinc-500 flex-wrap">
        {Object.entries(LEVEL_COLORS).map(([level, color]) => (
          <div key={level} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span>{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
