import { useState, useMemo } from 'react';
import { Network, Folder, FileText, ChevronRight, ChevronDown, CheckCircle, Clock, AlertTriangle, Circle } from 'lucide-react';
import { useWorkspaceContext } from '../hooks/useWorkspaceContext';
import { ModuleTreeNode, CallGraphNode } from '../services/ContextStateTypes';

export function WorkspaceMindMap({ projectPath }: { projectPath: string }) {
  const { getModuleTree, getCallGraph, findSymbol, workspaceState, getDashboard, buildIndex, isIndexing } = useWorkspaceContext(projectPath);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'files' | 'calls' | 'status'>('files');
  const [searchQuery, setSearchQuery] = useState('');

  const tree = useMemo(() => getModuleTree(), [getModuleTree]);
  const dashboard = useMemo(() => getDashboard(), [getDashboard]);

  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree;
    return tree.filter(node =>
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.path.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tree, searchQuery]);

  return (
    <div className="h-full flex flex-col bg-zinc-950 light:bg-[var(--ws-surface)] text-zinc-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60">
        <Network className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-zinc-200">Context Map</h2>

        {/* View tabs */}
        <div className="flex gap-1 ml-4">
          {([
            { key: 'files' as const, label: 'Files' },
            { key: 'calls' as const, label: 'Calls' },
            { key: 'status' as const, label: 'Status' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors duration-150 ${
                viewMode === tab.key
                  ? 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status badges */}
        <div className="ml-auto flex items-center gap-3 text-[10px]">
          {dashboard.completion > 0 && (
            <span className="text-emerald-400">{dashboard.completion}% done</span>
          )}
          {dashboard.inProgress.length > 0 && (
            <span className="text-amber-400">{dashboard.inProgress.length} active</span>
          )}
          {dashboard.blocked.length > 0 && (
            <span className="text-red-400">{dashboard.blocked.length} blocked</span>
          )}
        </div>

        {/* Reindex button */}
        <button
          onClick={() => buildIndex()}
          disabled={isIndexing}
          className="px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 disabled:opacity-50 transition-colors"
        >
          {isIndexing ? 'Indexing...' : 'Reindex'}
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-zinc-800/40">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files or symbols..."
          className="w-full px-3 py-1.5 rounded-lg bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800/60 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {viewMode === 'files' && (
          <FileTreeView nodes={filteredTree} onSelect={setSelectedSymbol} selectedId={selectedSymbol} />
        )}
        {viewMode === 'calls' && selectedSymbol && (
          <CallGraphView rootId={selectedSymbol} getCallGraph={getCallGraph} />
        )}
        {viewMode === 'calls' && !selectedSymbol && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <Network className="w-8 h-8 mb-2 text-zinc-600" />
            <p className="text-xs">Select a symbol from the Files view to see its call graph</p>
          </div>
        )}
        {viewMode === 'status' && (
          <StatusView dashboard={dashboard} />
        )}
      </div>
    </div>
  );
}

// ─── File Tree View ──────────────────────────────────────────────

function FileTreeView({ nodes, onSelect, selectedId, depth = 0 }: {
  nodes: ModuleTreeNode[];
  onSelect: (id: string) => void;
  selectedId: string | null;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (path: string) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
        <Folder className="w-8 h-8 mb-2 text-zinc-600" />
        <p className="text-xs">No files indexed yet</p>
        <p className="text-[10px] text-zinc-600 mt-1">Click "Reindex" to scan the project</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {nodes.map(node => (
        <div key={node.path}>
          <div
            className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors duration-100 ${
              node.type === 'file' ? 'text-zinc-300 hover:bg-zinc-800/40' : 'text-cyan-400 font-medium hover:bg-zinc-800/40'
            }`}
            style={{ marginLeft: depth * 16 }}
            onClick={() => {
              if (node.type === 'directory') toggle(node.path);
              if (node.symbols?.length === 1) onSelect(node.symbols[0].id);
            }}
          >
            {node.type === 'directory' ? (
              expanded[node.path] ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />
            ) : (
              <FileText className="w-3 h-3 shrink-0 text-zinc-600" />
            )}
            <span className="text-xs truncate">{node.name}</span>
            {node.symbols && node.symbols.length > 0 && (
              <span className="text-[10px] text-zinc-600 ml-auto">{node.symbols.length}</span>
            )}
          </div>

          {node.type === 'directory' && expanded[node.path] && node.children && (
            <FileTreeView nodes={Object.values(node.children)} onSelect={onSelect} selectedId={selectedId} depth={depth + 1} />
          )}

          {node.type === 'file' && expanded[node.path] === undefined && node.symbols && node.symbols.length > 0 && (
            <div style={{ marginLeft: (depth + 1) * 16 }}>
              {node.symbols.slice(0, 10).map(sym => (
                <div
                  key={sym.id}
                  className={`flex items-center gap-2 py-0.5 px-2 rounded cursor-pointer transition-colors duration-100 text-[11px] ${
                    selectedId === sym.id ? 'bg-cyan-500/10 text-cyan-400' : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300'
                  }`}
                  onClick={() => onSelect(sym.id)}
                >
                  <span className="w-3 text-center">{sym.kind === 'function' ? 'ƒ' : sym.kind === 'class' ? 'C' : sym.kind === 'interface' ? 'I' : '◇'}</span>
                  <span className="truncate">{sym.name}</span>
                </div>
              ))}
              {node.symbols.length > 10 && (
                <div className="text-[10px] text-zinc-600 px-2 py-0.5">+{node.symbols.length - 10} more</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Call Graph View ─────────────────────────────────────────────

function CallGraphView({ rootId, getCallGraph }: { rootId: string; getCallGraph: (id: string, depth?: number) => CallGraphNode | null }) {
  const graph = useMemo(() => getCallGraph(rootId, 2), [rootId, getCallGraph]);

  if (!graph) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
        <Network className="w-8 h-8 mb-2 text-zinc-600" />
        <p className="text-xs">Symbol not found</p>
      </div>
    );
  }

  const renderNode = (node: CallGraphNode, depth: number = 0): React.ReactNode => (
    <div key={node.symbol.id} style={{ marginLeft: depth * 20 }} className="my-1">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/40">
        <span className="text-[10px] text-cyan-400 font-medium">{node.symbol.kind}</span>
        <span className="text-xs font-medium text-zinc-200">{node.symbol.name}</span>
        <span className="text-[10px] text-zinc-600">{node.symbol.file}:{node.symbol.lineStart}</span>
      </div>
      {node.callers.length > 0 && (
        <div className="mt-1">
          <span className="text-[10px] text-zinc-600 ml-2">← called by</span>
          {node.callers.map(caller => renderNode(caller, depth + 1))}
        </div>
      )}
      {node.callees.length > 0 && (
        <div className="mt-1">
          <span className="text-[10px] text-zinc-600 ml-2">→ calls</span>
          {node.callees.map(callee => renderNode(callee, depth + 1))}
        </div>
      )}
    </div>
  );

  return <div className="py-2">{renderNode(graph)}</div>;
}

// ─── Status View ─────────────────────────────────────────────────

function StatusView({ dashboard }: { dashboard: { completion: number; blocked: string[]; inProgress: string[]; recentActivity: any[] } }) {
  return (
    <div className="space-y-4">
      {/* Completion bar */}
      <div className="p-3 rounded-xl bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-300">Overall Progress</span>
          <span className="text-xs text-cyan-400">{dashboard.completion}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${dashboard.completion}%` }}
          />
        </div>
      </div>

      {/* In Progress */}
      {dashboard.inProgress.length > 0 && (
        <div className="p-3 rounded-xl bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800/40">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3 h-3 text-amber-400" />
            <span className="text-xs font-medium text-zinc-300">In Progress</span>
          </div>
          <div className="space-y-1">
            {dashboard.inProgress.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-zinc-400">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocked */}
      {dashboard.blocked.length > 0 && (
        <div className="p-3 rounded-xl bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-xs font-medium text-zinc-300">Blocked</span>
          </div>
          <div className="space-y-1">
            {dashboard.blocked.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-zinc-400">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {dashboard.recentActivity.length > 0 && (
        <div className="p-3 rounded-xl bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800/40">
          <div className="flex items-center gap-2 mb-2">
            <Circle className="w-3 h-3 text-zinc-500" />
            <span className="text-xs font-medium text-zinc-300">Recent Activity</span>
          </div>
          <div className="space-y-2">
            {dashboard.recentActivity.map((session: any, i: number) => (
              <div key={i} className="text-[11px]">
                <div className="text-zinc-400">{session.summary}</div>
                <div className="text-zinc-600 text-[10px] mt-0.5">
                  {session.filesModified?.length || 0} files · {new Date(session.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboard.completion === 0 && dashboard.inProgress.length === 0 && dashboard.blocked.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
          <CheckCircle className="w-8 h-8 mb-2 text-zinc-600" />
          <p className="text-xs">No workspace state tracked yet</p>
          <p className="text-[10px] text-zinc-600 mt-1">Start a session to begin tracking progress</p>
        </div>
      )}
    </div>
  );
}
