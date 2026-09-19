// HandbookReference.tsx — Quick-reference cheat sheet view for the Terminal Handbook
// Shows all commands in a compact, scannable format grouped by depth
import React, { useState, useEffect, useMemo } from 'react';
import { getHandbookData, DEPTH_META } from '../../services/learn/handbook-data';
import type { HandbookData, HandbookCommand } from '../../services/learn/handbook-data';

function CopyBtn({ text, copied, onCopy }: { text: string; copied: string | null; onCopy: (t: string) => void }) {
  return (
    <button
      onClick={() => onCopy(text)}
      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border transition-colors ${copied === text ? 'text-emerald-400 border-emerald-400' : 'text-zinc-500 border-zinc-800/60 hover:text-emerald-400'}`}
    >
      {copied === text ? '✓' : '⧉'}
    </button>
  );
}

export function HandbookReference() {
  const [data, setData] = useState<HandbookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    getHandbookData().then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCmd(text);
      setTimeout(() => setCopiedCmd(null), 1500);
    } catch {}
  };

  const grouped = useMemo(() => {
    if (!data) return {};
    const groups: Record<string, HandbookCommand[]> = {};
    const cmds = filter === 'all' ? data.commands : data.commands.filter(c => c.depth === filter);
    cmds.forEach(c => {
      if (!groups[c.depth]) groups[c.depth] = [];
      groups[c.depth].push(c);
    });
    return groups;
  }, [data, filter]);

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <p className="text-zinc-500 text-sm font-mono">Loading reference...</p>
      </div>
    );
  }

  const depthOrder = ['core', 'daily', 'power', 'rescue', 'sudo'];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-950 p-6">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-[21px] font-semibold text-zinc-100 tracking-[-0.3px] mb-1">Quick Reference</h2>
        <p className="text-zinc-400 text-sm">All commands at a glance, grouped by depth.</p>
      </div>

      {/* Depth filter pills */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`font-mono text-[11px] px-3 py-1.5 rounded-full border transition-colors ${filter === 'all' ? 'text-zinc-100 bg-zinc-800 border-zinc-800/60' : 'text-zinc-500 border-transparent hover:text-zinc-400'}`}
        >
          All ({data.commands.length})
        </button>
        {depthOrder.map(d => {
          const meta = DEPTH_META[d];
          const count = data.commands.filter(c => c.depth === d).length;
          return (
            <button
              key={d}
              onClick={() => setFilter(filter === d ? 'all' : d)}
              className={`font-mono text-[11px] px-3 py-1.5 rounded-full border transition-colors ${filter === d ? meta.color + ' border-current' : 'text-zinc-500 border-transparent hover:text-zinc-400'}`}
            >
              {meta.icon} {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Command table */}
      <div className="flex-1 overflow-y-auto">
        {depthOrder.map(d => {
          const cmds = grouped[d];
          if (!cmds || cmds.length === 0) return null;
          const meta = DEPTH_META[d];
          return (
            <div key={d} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className={`font-mono text-[10px] uppercase tracking-wider font-semibold ${meta.color.split(' ')[0]}`}>{meta.icon} {meta.label}</span>
                <span className="font-mono text-[10px] text-zinc-500">— {meta.description}</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800/60 rounded-xl overflow-hidden">
                {cmds.map((cmd, i) => {
                  const doesRow = cmd.rows?.find(r => r.tag.toLowerCase() === 'does');
                  return (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 ${i < cmds.length - 1 ? 'border-b border-zinc-800/60' : ''} hover:bg-zinc-800/50 transition-colors`}>
                      <code className="text-emerald-400 font-mono text-[12px] shrink-0 min-w-[180px]">{cmd.command}</code>
                      <span className="text-zinc-400 text-[12px] flex-1 truncate">{doesRow?.value || cmd.description}</span>
                      <CopyBtn text={cmd.command} copied={copiedCmd} onCopy={handleCopy} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="mt-4 pt-3 border-t border-zinc-800/60 font-mono text-[11px] text-zinc-500">
        {data.stats.totalCommands} commands across {data.stats.totalSections} sections
      </div>
    </div>
  );
}
