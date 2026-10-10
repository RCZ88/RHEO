import { useMemo } from 'react';
import { FileText, AlertTriangle, Lock } from 'lucide-react';

export function FileBoundaryMap({ nodes }: { nodes: any[] }) {
  const fileMap = useMemo(() => {
    const map: Record<string, { owners: string[]; overlap: boolean }> = {};
    for (const node of nodes) {
      for (const boundary of node.boundaries || []) {
        if (!map[boundary]) map[boundary] = { owners: [], overlap: false };
        map[boundary].owners.push(node.id);
        if (map[boundary].owners.length > 1) map[boundary].overlap = true;
      }
    }
    return map;
  }, [nodes]);

  return (
    <div className="flex flex-col gap-2 p-3 min-h-0 overflow-y-auto">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">File Boundaries</h3>
      {Object.entries(fileMap).length === 0 && (
        <p className="text-[10px] text-zinc-500 py-4 text-center">No file boundaries defined</p>
      )}
      {Object.entries(fileMap).map(([filePath, info]) => (
        <div key={filePath} className={`flex items-center gap-2 py-2 px-3 rounded-lg ${info.overlap ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : 'bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70'}`}>
          <FileText className={`w-3.5 h-3.5 shrink-0 ${info.overlap ? 'text-amber-400' : 'text-zinc-500'}`} />
          <span className="text-xs text-zinc-200 flex-1 truncate">{filePath}</span>
          {info.overlap && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          <div className="flex items-center gap-1">
            {info.owners.map((ownerId: string, i: number) => (
              <div key={i} className="w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center text-[8px] text-zinc-300" title={ownerId}>
                {ownerId.slice(0, 2)}
              </div>
            ))}
          </div>
          {!info.overlap && <Lock className="w-3 h-3 text-emerald-400 shrink-0" />}
        </div>
      ))}
    </div>
  );
}
