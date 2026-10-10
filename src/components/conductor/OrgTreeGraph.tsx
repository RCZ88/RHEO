import { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Cog, Hammer, FlaskConical, Search, GitMerge, User } from 'lucide-react';

export type ConductorRoleVM = 'director' | 'planner' | 'worker' | 'qa' | 'auditor' | 'resolver';
export type ConductorStatusVM = 'pending' | 'spawning' | 'running' | 'blocked' | 'awaiting-review' | 'done' | 'failed' | 'killed';

export interface ConductorNodeVM {
  id: string;
  parentId: string | null;
  role: ConductorRoleVM;
  objective: string;
  status: ConductorStatusVM;
  depth: number;
  retries: number;
}

export interface ConductorMessageVM {
  id: string;
  ts: number;
  from: string;
  to: string;
  type: string;
  summary: string;
}

const ROLE_META: Record<ConductorRoleVM, { icon: any; color: string; label: string }> = {
  director: { icon: Crown, color: '#8b5cf6', label: 'Director' },
  planner: { icon: Cog, color: '#3b82f6', label: 'Planner' },
  worker: { icon: Hammer, color: '#22d3ee', label: 'Worker' },
  qa: { icon: FlaskConical, color: '#14b8a6', label: 'QA' },
  auditor: { icon: Search, color: '#f59e0b', label: 'Auditor' },
  resolver: { icon: GitMerge, color: '#f43f5e', label: 'Resolver' },
};

const STATUS_COLOR: Record<ConductorStatusVM, string> = {
  pending: '#71717a',
  spawning: '#a1a1aa',
  running: '#22d3ee',
  blocked: '#f59e0b',
  'awaiting-review': '#8b5cf6',
  done: '#10b981',
  failed: '#ef4444',
  killed: '#52525b',
};

const NODE_W = 176;
const NODE_H = 60;
const LEVEL_H = 140;
const BOSS_POS = { x: 70, y: 40 };

function StatusPill({ status }: { status: ConductorStatusVM }) {
  const color = STATUS_COLOR[status];
  const pulsing = status === 'running' || status === 'spawning' || status === 'awaiting-review';
  const pillStyle: React.CSSProperties = { color };
  const dotStyle: React.CSSProperties = { width: 6, height: 6, borderRadius: 9999, background: color, display: 'inline-block' };
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-medium" style={pillStyle}>
      <span className={pulsing ? 'animate-pulse' : ''} style={dotStyle} />
      {status}
    </span>
  );
}

export default function OrgTreeGraph({
  nodes, recentMessages, selectedId, onSelect,
}: {
  nodes: ConductorNodeVM[];
  recentMessages: ConductorMessageVM[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(Math.max(600, entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const byDepth: Record<number, ConductorNodeVM[]> = {};
    let maxDepth = 0;
    for (const n of nodes) {
      byDepth[n.depth] = byDepth[n.depth] || [];
      byDepth[n.depth].push(n);
      maxDepth = Math.max(maxDepth, n.depth);
    }
    const pos: Record<string, { x: number; y: number }> = {};
    Object.keys(byDepth).forEach((dStr) => {
      const d = Number(dStr);
      const row = byDepth[d];
      const slotW = width / (row.length + 1);
      row.forEach((n, i) => {
        pos[n.id] = { x: slotW * (i + 1), y: 130 + d * LEVEL_H };
      });
    });
    const height = 130 + (maxDepth + 1) * LEVEL_H;
    return { pos, height };
  }, [nodes, width]);

  function resolvePos(actorId: string): { x: number; y: number } {
    if (actorId === 'boss') return BOSS_POS;
    if (actorId === 'conductor' || actorId === 'system') return { x: width - 90, y: 40 };
    return layout.pos[actorId] || { x: width / 2, y: 40 };
  }

  const now = Date.now();
  const liveMessages = recentMessages.filter((m) => now - m.ts < 3200);

  const MSG_COLOR: Record<string, string> = {
    ESCALATE: '#ef4444',
    MERGE_CONFLICT: '#ef4444',
    MERGE_OK: '#10b981',
    REPORT: '#f59e0b',
    DIRECTIVE: '#8b5cf6',
  };

  const wrapStyle: React.CSSProperties = { height: Math.max(320, layout.height) };

  return (
    <div ref={wrapRef} className="relative w-full overflow-x-hidden overflow-y-auto" style={wrapStyle}>
      <svg width={width} height={Math.max(320, layout.height)} className="absolute inset-0">
        <g>
          <circle cx={BOSS_POS.x} cy={BOSS_POS.y} r={20} fill="#18181b" stroke="#3f3f46" strokeWidth={1.5} />
          <foreignObject x={BOSS_POS.x - 20} y={BOSS_POS.y - 20} width={40} height={40}>
            <div className="w-full h-full flex items-center justify-center">
              <User size={16} color="#e4e4e7" />
            </div>
          </foreignObject>
          <text x={BOSS_POS.x} y={BOSS_POS.y + 34} textAnchor="middle" fontSize={10} fill="#a1a1aa">Boss (you)</text>

          <circle cx={width - 90} cy={40} r={20} fill="#18181b" stroke="#3f3f46" strokeWidth={1.5} />
          <foreignObject x={width - 110} y={20} width={40} height={40}>
            <div className="w-full h-full flex items-center justify-center">
              <Cog size={16} color="#e4e4e7" />
            </div>
          </foreignObject>
          <text x={width - 90} y={74} textAnchor="middle" fontSize={10} fill="#a1a1aa">Conductor</text>
        </g>

        {nodes.map((n) => {
          if (!n.parentId) return null;
          const from = layout.pos[n.parentId];
          const to = layout.pos[n.id];
          if (!from || !to) return null;
          const midY = (from.y + to.y) / 2;
          return (
            <path
              key={`edge-${n.id}`}
              d={`M ${from.x} ${from.y + NODE_H / 2} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y - NODE_H / 2}`}
              fill="none"
              stroke="#3f3f46"
              strokeWidth={1.5}
            />
          );
        })}

        {liveMessages.map((m) => {
          const from = resolvePos(m.from);
          const to = resolvePos(m.to);
          const color = MSG_COLOR[m.type] || '#22d3ee';
          return (
            <circle key={`pulse-${m.id}`} r={4} fill={color}>
              <animateMotion dur="1.1s" repeatCount="1" fill="freeze" path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} />
              <animate attributeName="opacity" values="1;1;0" dur="1.1s" repeatCount="1" fill="freeze" />
            </circle>
          );
        })}

        {nodes.map((n) => {
          const p = layout.pos[n.id];
          if (!p) return null;
          const meta = ROLE_META[n.role];
          const Icon = meta.icon;
          const selected = selectedId === n.id;
          const foStyle: React.CSSProperties = { overflow: 'visible' };
          const cardStyle: React.CSSProperties = { boxShadow: selected ? `0 0 0 2px ${meta.color}` : '0 0 0 1px rgba(63,63,70,0.8)' };
          const badgeStyle: React.CSSProperties = { width: 18, height: 18, background: `${meta.color}22` };
          return (
            <foreignObject key={n.id} x={p.x - NODE_W / 2} y={p.y - NODE_H / 2} width={NODE_W} height={NODE_H} style={foStyle}>
              <button
                onClick={() => onSelect(n.id)}
                className="w-full h-full rounded-lg bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] px-2.5 py-1.5 text-left flex flex-col justify-center gap-0.5 transition-shadow"
                style={cardStyle}
              >
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center rounded-md" style={badgeStyle}>
                    <Icon size={11} color={meta.color} />
                  </span>
                  <span className="text-[10px] font-semibold text-zinc-200">{meta.label}</span>
                  {n.retries > 0 && (
                    <span className="ml-auto text-[9px] text-amber-400">↻{n.retries}</span>
                  )}
                </div>
                <div className="text-[9.5px] text-zinc-400 truncate">{n.objective}</div>
                <StatusPill status={n.status} />
              </button>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}
