import { useMemo } from 'react';
import { Crown, Cog, Hammer, FlaskConical, Search, GitMerge, CheckCircle, XCircle, Clock } from 'lucide-react';

const ROLE_ICONS: Record<string, any> = {
  director: Crown, planner: Cog, worker: Hammer, qa: FlaskConical, auditor: Search, resolver: GitMerge,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-zinc-500', running: 'text-cyan-400', done: 'text-emerald-400', failed: 'text-red-400', blocked: 'text-amber-400', 'awaiting-review': 'text-blue-400',
};

export function DecisionTreeFlow({ nodes }: { nodes: any[] }) {
  const tree = useMemo(() => {
    const root = nodes.find((n: any) => n.parentId === null || n.parent_id === null);
    if (!root) return null;
    const buildTree = (parentId: string): any[] => {
      return nodes.filter((n: any) => (n.parentId || n.parent_id) === parentId).map((n: any) => ({
        ...n,
        children: buildTree(n.id),
      }));
    };
    return { ...root, children: buildTree(root.id) };
  }, [nodes]);

  const renderNode = (node: any, depth = 0): React.ReactNode => {
    const Icon = ROLE_ICONS[node.role] || Cog;
    const color = STATUS_COLORS[node.status] || 'text-zinc-500';
    return (
      <div key={node.id} className="flex flex-col">
        <div className={`flex items-center gap-2 py-1.5 px-3 rounded-lg bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70`} style={{ marginLeft: depth * 16 }}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          <span className="text-xs font-medium text-zinc-200">{node.roleConfig?.customName || node.role}</span>
          <span className={`text-[10px] ${color}`}>{node.status}</span>
          {node.status === 'running' && <Clock className="w-3 h-3 text-cyan-400 animate-pulse" />}
          {node.status === 'done' && <CheckCircle className="w-3 h-3 text-emerald-400" />}
          {node.status === 'failed' && <XCircle className="w-3 h-3 text-red-400" />}
          <span className="text-[10px] text-zinc-500 ml-auto">{(node.tokensUsed || node.tokens_used || 0).toLocaleString()} tok</span>
        </div>
        {node.children?.length > 0 && (
          <div className="flex flex-col gap-1 ml-4 mt-1 border-l border-zinc-800/50 pl-2">
            {node.children.map((child: any) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!tree) return <p className="text-xs text-zinc-500 py-8 text-center">No decision tree available</p>;

  return (
    <div className="flex flex-col gap-2 p-3 min-h-0 overflow-y-auto">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">Decision Flow</h3>
      {renderNode(tree)}
    </div>
  );
}
