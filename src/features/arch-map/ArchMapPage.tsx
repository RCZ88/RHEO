import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, RefreshCw, Layers, FileCode, Box, Puzzle, Database, Zap, ArrowRight, ChevronDown, ChevronRight, X, ExternalLink, Code2, GitBranch, ArrowUpRight } from 'lucide-react';

interface ArchNode {
  id: string;
  type: 'page' | 'component' | 'feature' | 'service' | 'hook' | 'store' | 'util' | 'ipc';
  name: string;
  filePath: string;
  lineCount: number;
  route?: string;
  description?: string;
  imports: string[];
  exports: string[];
  features: string[];
  ipcHandlers: string[];
  ipcCalls: string[];
  childComponents: string[];
}

interface ArchEdge {
  from: string;
  to: string;
  type: 'import' | 'ipc' | 'state' | 'render' | 'route';
  label?: string;
}

interface ArchMap {
  nodes: ArchNode[];
  edges: ArchEdge[];
  stats: {
    totalPages: number;
    totalComponents: number;
    totalFeatures: number;
    totalServices: number;
    totalHooks: number;
    totalIpcHandlers: number;
    totalLines: number;
    generatedAt: string;
  };
}

const NODE_COLORS: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  page: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: 'text-cyan-400', text: 'text-cyan-300' },
  component: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', icon: 'text-violet-400', text: 'text-violet-300' },
  feature: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: 'text-emerald-400', text: 'text-emerald-300' },
  service: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: 'text-amber-400', text: 'text-amber-300' },
  hook: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', icon: 'text-pink-400', text: 'text-pink-300' },
  store: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: 'text-orange-400', text: 'text-orange-300' },
  util: { bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', icon: 'text-zinc-400', text: 'text-zinc-300' },
  ipc: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', icon: 'text-rose-400', text: 'text-rose-300' },
};

const EDGE_COLORS: Record<string, string> = {
  import: '#8b5cf6',
  ipc: '#f59e0b',
  render: '#22d3ee',
  state: '#10b981',
  route: '#ef4444',
};

const TYPE_ICONS: Record<string, any> = {
  page: FileCode,
  component: Box,
  feature: Puzzle,
  service: Database,
  hook: Zap,
  store: Layers,
  util: Code2,
  ipc: GitBranch,
};

const FEATURE_LABELS: Record<string, string> = {
  'state-management': 'State',
  'lifecycle': 'Lifecycle',
  'event-handlers': 'Events',
  'data-fetching': 'Fetch',
  'performance': 'Perf',
  'animation': 'Motion',
  'styled': 'Styled',
  'database': 'DB',
  'navigation': 'Nav',
  'storage': 'Storage',
  'error-handling': 'Errors',
  'debugging': 'Debug',
  'tooltip': 'Tooltip',
  'modal': 'Modal',
  'visualization': 'Chart',
  'realtime': 'Realtime',
};

export default function ArchMapPage() {
  const [mapData, setMapData] = useState<ArchMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'graph'>('tree');
  const [showEdges, setShowEdges] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const loadMap = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await (window as any).deskflowAPI?.archMap?.generate({ force });

      // THE BUG: `archMap:generate` in main.ts:22785 returns
      //   { success: true, data: { nodes, edges, stats } }
      // but this used to do `setMapData(data)` — storing the WRAPPER. So
      // `mapData.nodes` was ALWAYS undefined and the first `.filter` threw
      // `Cannot read properties of undefined (reading 'filter')` on every
      // single load. The page was not intermittently broken; it never worked.
      //
      // DEFAULT_SYSTEM_PROMPT.md §5c documents the return as `{ nodes, edges,
      // stats }`, so the two sides genuinely disagree. Accept BOTH shapes
      // rather than picking a winner: normalising here fixes the crash without
      // changing an IPC contract that other code (or a future fix to main.ts)
      // may still depend on.
      if (res?.success === false) {
        console.warn('arch-map:generate reported failure:', res?.error);
        setMapData(null);
        return;
      }
      const map = res?.data ?? res;
      if (map && Array.isArray(map.nodes)) {
        // NORMALISE ONCE, HERE, AT THE ONLY WRITE SITE.
        //
        // Guarding each read site is the wrong shape: there are six of them and
        // a seventh arrives with every feature request, and `mapData?.nodes.find`
        // shows why — the optional chain protects `mapData` but NOT `nodes`, so
        // it still throws one token later. If `mapData` is only ever assigned a
        // fully-formed object, every reader is safe by construction and no
        // reader needs a guard at all.
        setMapData({
          ...map,
          nodes: map.nodes,
          edges: Array.isArray(map.edges) ? map.edges : [],
          stats: map.stats ?? {},
        });
      } else {
        // Malformed payload: degrade to empty instead of crashing the page on
        // the next `.filter`. A guard on the OBJECT is not a guard on its
        // fields — this is the same trap as the AFK threshold and the
        // rankings UTC/local bugs in MEMORY.md.
        console.warn('arch-map:generate returned no nodes array', map);
        setMapData(null);
      }
    } catch (e) {
      console.warn('arch-map:generate failed', e);
      setMapData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMap(); }, [loadMap]);

  const filteredNodes = useMemo(() => {
    if (!mapData) return [];
    // Guard the ARRAY, not just the wrapper. `if (!mapData)` passes happily
    // when mapData exists but carries no nodes, and the next line throws.
    let nodes = Array.isArray(mapData.nodes) ? mapData.nodes : [];
    if (!nodes.length) return [];
    if (search) {
      const q = search.toLowerCase();
      nodes = nodes.filter((n) =>
        n.name.toLowerCase().includes(q) ||
        n.filePath.toLowerCase().includes(q) ||
        n.route?.toLowerCase().includes(q)
      );
    }
    if (selectedType) nodes = nodes.filter((n) => n.type === selectedType);
    return nodes;
  }, [mapData, search, selectedType]);

  const pages = useMemo(() => filteredNodes.filter((n) => n.type === 'page'), [filteredNodes]);
  const components = useMemo(() => filteredNodes.filter((n) => n.type === 'component'), [filteredNodes]);
  const features = useMemo(() => filteredNodes.filter((n) => n.type === 'feature'), [filteredNodes]);
  const services = useMemo(() => filteredNodes.filter((n) => n.type === 'service'), [filteredNodes]);

  const getConnectedNodes = useCallback((nodeId: string) => {
    if (!mapData || !Array.isArray(mapData.nodes)) return [];
    const connected = new Set<string>();
    for (const edge of (Array.isArray(mapData.edges) ? mapData.edges : [])) {
      if (edge.from === nodeId) connected.add(edge.to);
      if (edge.to === nodeId) connected.add(edge.from);
    }
    return mapData.nodes.filter((n) => connected.has(n.id));
  }, [mapData]);

  const getNodeEdges = useCallback((nodeId: string) => {
    if (!mapData || !Array.isArray(mapData.edges)) return [];
    return mapData.edges.filter((e) => e.from === nodeId || e.to === nodeId);
  }, [mapData]);

  const togglePage = (pageId: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const typeCounts = useMemo(() => {
    if (!mapData || !Array.isArray(mapData.nodes)) return {};
    const counts: Record<string, number> = {};
    for (const n of mapData.nodes) {
      counts[n.type] = (counts[n.type] || 0) + 1;
    }
    return counts;
  }, [mapData]);

  if (loading && !mapData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
          <span className="text-xs text-zinc-500">Scanning codebase...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Architecture Map</h2>
            <p className="text-[10px] text-zinc-500">
              {mapData?.stats.totalPages} pages · {mapData?.stats.totalComponents} components · {mapData?.stats.totalLines.toLocaleString()} lines
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadMap(true)} disabled={loading} className="p-1.5 rounded-lg border border-zinc-700/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 disabled:opacity-40 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages, components, features..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-700/50 bg-zinc-950 light:bg-[var(--ws-surface)]/60 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex items-center gap-1">
          {Object.entries(typeCounts).sort(([, a], [, b]) => b - a).map(([type, count]) => {
            const colors = NODE_COLORS[type] || NODE_COLORS.component;
            const Icon = TYPE_ICONS[type] || Box;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(selectedType === type ? null : type)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border transition-all ${selectedType === type ? `${colors.bg} ${colors.border} ${colors.text}` : 'border-zinc-700/30 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'}`}
              >
                <Icon className="w-3 h-3" />
                {count}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex gap-4">
        {/* Left: Tree View */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-1 scrollbar-thin">
          {pages.map((page) => {
            const colors = NODE_COLORS.page;
            const isExpanded = expandedPages.has(page.id);
            const pageChildren = (Array.isArray(mapData?.edges) ? mapData.edges : [])
              .filter((e) => e.from === page.id && e.type === 'render')
              .map((e) => (Array.isArray(mapData?.nodes) ? mapData.nodes : []).find((n) => n.id === e.to))
              .filter(Boolean) as ArchNode[] || [];
            const pageIpcEdges = getNodeEdges(page.id).filter((e) => e.type === 'ipc');

            return (
              <div key={page.id} className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}>
                <button
                  onClick={() => togglePage(page.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
                  <FileCode className={`w-3.5 h-3.5 ${colors.icon}`} />
                  <span className={`text-xs font-medium ${colors.text}`}>{page.name}</span>
                  {page.route && <span className="text-[10px] text-zinc-600 font-mono">{page.route}</span>}
                  <span className="text-[10px] text-zinc-600 ml-auto">{page.lineCount}L</span>
                  <span className="text-[10px] text-zinc-600">{pageChildren.length}C</span>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-2 space-y-1.5 border-t border-white/[0.03]">
                    {/* Features */}
                    {page.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {page.features.map((f) => (
                          <span key={f} className="px-1.5 py-0.5 rounded-md bg-zinc-800/50 text-[9px] text-zinc-400">
                            {FEATURE_LABELS[f] || f}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* IPC Handlers */}
                    {page.ipcHandlers.length > 0 && (
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-amber-500/70 uppercase tracking-wider">IPC Handlers</span>
                        {page.ipcHandlers.map((h) => (
                          <div key={h} className="flex items-center gap-1.5 text-[10px] text-amber-400/80 font-mono pl-2">
                            <GitBranch className="w-2.5 h-2.5" />
                            {h}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* IPC Calls */}
                    {page.ipcCalls.length > 0 && (
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-rose-500/70 uppercase tracking-wider">IPC Calls</span>
                        {page.ipcCalls.map((c) => (
                          <div key={c} className="flex items-center gap-1.5 text-[10px] text-rose-400/80 font-mono pl-2">
                            <ArrowUpRight className="w-2.5 h-2.5" />
                            {c}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Child Components */}
                    {pageChildren.length > 0 && (
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-violet-500/70 uppercase tracking-wider">Components ({pageChildren.length})</span>
                        <div className="grid grid-cols-2 gap-1">
                          {pageChildren.map((child) => {
                            const cc = NODE_COLORS[child.type] || NODE_COLORS.component;
                            const CIcon = TYPE_ICONS[child.type] || Box;
                            return (
                              <button
                                key={child.id}
                                onClick={() => setSelectedNode(child)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${cc.border} bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] hover:bg-zinc-800/50 transition-colors text-left`}
                              >
                                <CIcon className={`w-2.5 h-2.5 ${cc.icon} shrink-0`} />
                                <span className="text-[10px] text-zinc-300 truncate">{child.name}</span>
                                <span className="text-[9px] text-zinc-600 ml-auto shrink-0">{child.lineCount}L</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Connections */}
                    {showEdges && pageIpcEdges.length > 0 && (
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-amber-500/70 uppercase tracking-wider">Connections</span>
                        {pageIpcEdges.map((edge, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] pl-2">
                            <ArrowRight className="w-2.5 h-2.5 text-amber-500/60" />
                            <span className="text-zinc-400">{edge.label}</span>
                            <span className="text-zinc-600">→</span>
                            <span className="text-zinc-500">{edge.from === page.id ? mapData?.nodes.find((n) => n.id === edge.to)?.name : mapData?.nodes.find((n) => n.id === edge.from)?.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Imports */}
                    <details className="group">
                      <summary className="text-[9px] text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors">
                        Imports ({page.imports.length})
                      </summary>
                      <div className="pl-2 pt-1 space-y-0.5">
                        {page.imports.map((imp, i) => (
                          <div key={i} className="text-[9px] text-zinc-600 font-mono truncate">{imp}</div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            );
          })}

          {/* Standalone components (not rendered by any page) */}
          {components.length > 0 && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
              <div className="px-3 py-2 flex items-center gap-2">
                <Box className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-medium text-violet-300">Standalone Components</span>
                <span className="text-[10px] text-zinc-600">{components.length}</span>
              </div>
              <div className="px-3 pb-2 grid grid-cols-2 gap-1">
                {components.slice(0, 50).map((comp) => (
                  <button
                    key={comp.id}
                    onClick={() => setSelectedNode(comp)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-violet-500/20 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] hover:bg-zinc-800/50 transition-colors text-left"
                  >
                    <Box className="w-2.5 h-2.5 text-violet-400 shrink-0" />
                    <span className="text-[10px] text-zinc-300 truncate">{comp.name}</span>
                    <span className="text-[9px] text-zinc-600 ml-auto shrink-0">{comp.lineCount}L</span>
                  </button>
                ))}
                {components.length > 50 && (
                  <span className="text-[10px] text-zinc-600 col-span-2 pl-2">+{components.length - 50} more...</span>
                )}
              </div>
            </div>
          )}

          {/* Services */}
          {services.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
              <div className="px-3 py-2 flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-medium text-amber-300">Services</span>
                <span className="text-[10px] text-zinc-600">{services.length}</span>
              </div>
              <div className="px-3 pb-2 grid grid-cols-2 gap-1">
                {services.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => setSelectedNode(svc)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-amber-500/20 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] hover:bg-zinc-800/50 transition-colors text-left"
                  >
                    <Database className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                    <span className="text-[10px] text-zinc-300 truncate">{svc.name}</span>
                    <span className="text-[9px] text-zinc-600 ml-auto shrink-0">{svc.lineCount}L</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Detail Panel */}
        {selectedNode && (
          <div className="w-80 shrink-0 rounded-xl border border-zinc-700/40 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] p-3 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {(() => {
                  const colors = NODE_COLORS[selectedNode.type];
                  const Icon = TYPE_ICONS[selectedNode.type] || Box;
                  return (
                    <>
                      <div className={`p-1.5 rounded-lg ${colors.bg} border ${colors.border}`}>
                        <Icon className={`w-3.5 h-3.5 ${colors.icon}`} />
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-zinc-100">{selectedNode.name}</h3>
                        <p className="text-[10px] text-zinc-500">{selectedNode.type} · {selectedNode.lineCount} lines</p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <button onClick={() => setSelectedNode(null)} className="p-1 rounded-md hover:bg-zinc-800 transition-colors">
                <X className="w-3 h-3 text-zinc-500" />
              </button>
            </div>

            {/* Route */}
            {selectedNode.route && (
              <div className="mb-2 px-2 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <span className="text-[10px] text-cyan-400 font-mono">{selectedNode.route}</span>
              </div>
            )}

            {/* File Path */}
            <div className="mb-3 px-2 py-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/30">
              <span className="text-[10px] text-zinc-400 font-mono">{selectedNode.filePath}</span>
            </div>

            {/* Features */}
            {selectedNode.features.length > 0 && (
              <div className="mb-3">
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Features</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedNode.features.map((f) => (
                    <span key={f} className="px-1.5 py-0.5 rounded-md bg-zinc-800/50 text-[9px] text-zinc-400">
                      {FEATURE_LABELS[f] || f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* IPC */}
            {(selectedNode.ipcHandlers.length > 0 || selectedNode.ipcCalls.length > 0) && (
              <div className="mb-3 space-y-1">
                {selectedNode.ipcHandlers.length > 0 && (
                  <div>
                    <span className="text-[9px] text-amber-500/70 uppercase tracking-wider">Handles IPC</span>
                    <div className="mt-1 space-y-0.5">
                      {selectedNode.ipcHandlers.map((h) => (
                        <div key={h} className="text-[10px] text-amber-400/80 font-mono pl-2">{h}</div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedNode.ipcCalls.length > 0 && (
                  <div>
                    <span className="text-[9px] text-rose-500/70 uppercase tracking-wider">Calls IPC</span>
                    <div className="mt-1 space-y-0.5">
                      {selectedNode.ipcCalls.map((c) => (
                        <div key={c} className="text-[10px] text-rose-400/80 font-mono pl-2">{c}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Exports */}
            {selectedNode.exports.length > 0 && (
              <div className="mb-3">
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Exports</span>
                <div className="mt-1 space-y-0.5">
                  {selectedNode.exports.map((e) => (
                    <div key={e} className="text-[10px] text-zinc-400 font-mono pl-2">{e}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Child Components */}
            {selectedNode.childComponents.length > 0 && (
              <div className="mb-3">
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Renders ({selectedNode.childComponents.length})</span>
                <div className="mt-1 space-y-0.5">
                  {selectedNode.childComponents.map((c) => (
                    <div key={c} className="text-[10px] text-violet-400/80 font-mono pl-2">{`<${c}>`}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Connections */}
            {(() => {
              const edges = getNodeEdges(selectedNode.id);
              if (edges.length === 0) return null;
              return (
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Connections ({edges.length})</span>
                  <div className="mt-1 space-y-0.5">
                    {edges.map((edge, i) => {
                      const otherId = edge.from === selectedNode.id ? edge.to : edge.from;
                      const other = mapData?.nodes.find((n) => n.id === otherId);
                      const direction = edge.from === selectedNode.id ? '→' : '←';
                      return (
                        <button
                          key={i}
                          onClick={() => other && setSelectedNode(other)}
                          className="w-full flex items-center gap-1.5 text-[10px] pl-2 hover:bg-zinc-800/50 rounded py-0.5 transition-colors"
                        >
                          <span className="text-zinc-600">{direction}</span>
                          <span style={{ color: EDGE_COLORS[edge.type] }} className="font-mono">{edge.label || edge.type}</span>
                          <span className="text-zinc-500 truncate">{other?.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
