import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Key, Link2, Table2, AlertTriangle, Maximize2, RotateCcw, X, Columns3, GitBranch } from 'lucide-react';

/**
 * Interactive ERD.
 *
 * Everything is derived from the real schema returned by `getErdSchema()`
 * (PRAGMA table_info / foreign_key_list / index_list). Relationships are drawn
 * ONLY from declared foreign keys — never inferred from column-name similarity.
 * Tables with no FK constraint are surfaced as such rather than being given
 * invented edges.
 *
 * With ~178 tables a flat graph is unreadable, so the default view is grouped by
 * domain; drilling in reveals individual tables and their relationships.
 */

export interface ErdColumn {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  pkOrdinal: number;
  defaultValue: string | null;
}
export interface ErdForeignKey {
  id: number;
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[] | null;
  targetsPrimaryKey: boolean;
  onUpdate: string;
  onDelete: string;
}
export interface ErdIndex {
  name: string;
  unique: boolean;
  origin: string;
  partial: boolean;
}
export interface ErdTable {
  name: string;
  columns: ErdColumn[];
  primaryKey: string[];
  foreignKeys: ErdForeignKey[];
  indexes: ErdIndex[];
  rowCount: number;
  cardinality: string;
  hasDeclaredForeignKeys: boolean;
}
export interface ErdSchema {
  tables: ErdTable[];
  relationships: ErdForeignKey[];
  tablesWithoutForeignKeys: string[];
  totalColumns: number;
  generatedAt: string;
  error?: string;
}

type Node = { id: string; x: number; y: number; w: number; h: number };
type Edge = {
  id: string;
  from: string;
  to: string;
  fromCols: string[];
  toCols: string[] | null;
  targetsPk: boolean;
  cardinality: string;
  onDelete: string;
  onUpdate: string;
};

const CARD_W = 232;
const HEADER_H = 30;
const ROW_H = 19;
const MAX_ROWS = 14; // columns beyond this collapse into a "+N more" row

export interface ErdDomain {
  id: string;
  label: string;
  color: string;
  tables: string[];
}

export default function ErdCanvas({
  schema,
  domains,
  loading,
  onReload,
}: {
  schema: ErdSchema | null;
  domains: ErdDomain[];
  loading: boolean;
  onReload: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, px: 0, py: 0 });
  const [nodePos, setNodePos] = useState<Record<string, Node>>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [focusGroup, setFocusGroup] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const tableByName = useMemo(() => {
    const m: Record<string, ErdTable> = {};
    for (const t of schema?.tables || []) m[t.name] = t;
    return m;
  }, [schema]);

  const groupOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const g of domains) for (const t of g.tables) if (tableByName[t]) m[t] = g.id;
    return m;
  }, [domains, tableByName]);

  // Tables not named by any domain still deserve a home.
  const groups = useMemo<ErdDomain[]>(() => {
    const known = new Set(domains.flatMap((g) => g.tables));
    const rest = (schema?.tables || []).map((t) => t.name).filter((t) => !known.has(t));
    return rest.length ? [...domains, { id: 'other', label: 'Other / Internal', color: '#71717a', tables: rest }] : domains;
  }, [domains, schema]);

  const visibleTables = useMemo(() => {
    const all = schema?.tables || [];
    if (!focusGroup) return [];
    return all.filter((t) => groupOf[t.name] === focusGroup);
  }, [focusGroup, groupOf, schema]);

  // ---- edges: ONLY declared FKs -------------------------------------------
  const edges = useMemo<Edge[]>(() => {
    const out: Edge[] = [];
    for (const fk of schema?.relationships || []) {
      if (!tableByName[fk.fromTable] || !tableByName[fk.toTable]) continue;
      out.push({
        id: `${fk.fromTable}::${fk.id}`,
        from: fk.fromTable,
        to: fk.toTable,
        fromCols: fk.fromColumns,
        toCols: fk.toColumns,
        targetsPk: fk.targetsPrimaryKey,
        cardinality: tableByName[fk.fromTable]?.cardinality || '1:N',
        onDelete: fk.onDelete,
        onUpdate: fk.onUpdate,
      });
    }
    return out;
  }, [schema, tableByName]);

  // ---- layout --------------------------------------------------------------
  const measure = useCallback((name: string) => {
    const t = tableByName[name];
    if (!t) return { w: CARD_W, h: HEADER_H + 40 };
    const shown = Math.min(t.columns.length, MAX_ROWS) + (t.columns.length > MAX_ROWS ? 1 : 0);
    return { w: CARD_W, h: HEADER_H + shown * ROW_H + 10 };
  }, [tableByName]);

  /** Layered layout: roots (nothing points at them) on the left, depth grows right. */
  const autoLayout = useCallback((names: string[]) => {
    const nameSet = new Set(names);
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, string[]>();
    for (const e of edges) {
      if (!nameSet.has(e.from) || !nameSet.has(e.to)) continue;
      incoming.set(e.to, (incoming.get(e.to) || 0) + 1);
      outgoing.set(e.from, [...(outgoing.get(e.from) || []), e.to]);
    }
    const depth = new Map<string, number>();
    const visit = (n: string, guard = new Set<string>()): number => {
      if (depth.has(n)) return depth.get(n)!;
      if (guard.has(n)) return 0; // cycle guard
      guard.add(n);
      const parents = (outgoing.get(n) || []).map((c) => visit(c, guard));
      const d = parents.length ? Math.max(...parents) + 1 : 0;
      depth.set(n, d);
      return d;
    };
    for (const n of names) visit(n);

    const byDepth = new Map<number, string[]>();
    for (const n of names) {
      const d = depth.get(n) || 0;
      byDepth.set(d, [...(byDepth.get(d) || []), n]);
    }
    const next: Record<string, Node> = {};
    const COL_GAP = CARD_W + 130;
    const ROW_GAP = 26;
    let colX = 0;
    for (const d of [...byDepth.keys()].sort((a, b) => a - b)) {
      const col = (byDepth.get(d) || []).slice().sort();
      let y = 0;
      for (const n of col) {
        const m = measure(n);
        next[n] = { id: n, x: colX, y, ...m };
        y += m.h + ROW_GAP;
      }
      const colH = Math.max(...col.map((n) => next[n].h + ROW_GAP), 200);
      colX += COL_GAP;
      void colH;
    }
    setNodePos(next);
    return next;
  }, [edges, measure]);

  // Lay out whenever the visible set changes.
  useEffect(() => {
    if (focusGroup) autoLayout(visibleTables.map((t) => t.name));
  }, [focusGroup, visibleTables, autoLayout]);

  // Group-grid layout for the overview.
  useEffect(() => {
    if (focusGroup) return;
    const next: Record<string, Node> = {};
    const GAP_X = 300;
    const GAP_Y = 210;
    const PER_ROW = 4;
    groups.forEach((g, i) => {
      next['g:' + g.id] = {
        id: 'g:' + g.id,
        x: (i % PER_ROW) * GAP_X,
        y: Math.floor(i / PER_ROW) * GAP_Y,
        w: 264,
        h: 128,
      };
    });
    setNodePos(next);
  }, [groups, focusGroup, tableByName]);

  // ---- viewport ------------------------------------------------------------
  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const nodes = Object.values(nodePos);
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + n.w));
    const maxY = Math.max(...nodes.map((n) => n.y + n.h));
    const pad = 40;
    const s = Math.min(
      el.clientWidth / Math.max(1, maxX - minX + pad * 2),
      el.clientHeight / Math.max(1, maxY - minY + pad * 2),
      1.1,
    );
    setZoom(Math.max(0.15, s));
    setPan({
      x: (el.clientWidth - (maxX - minX) * s) / 2 - minX * s,
      y: (el.clientHeight - (maxY - minY) * s) / 2 - minY * s,
    });
  }, [nodePos]);

  useEffect(() => {
    if (Object.keys(nodePos).length) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusGroup]);

  // ---- interactions --------------------------------------------------------
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const el = wrapRef.current;
    if (!el) return;
    if (e.ctrlKey || e.metaKey || !e.shiftKey) {
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setZoom((z) => {
        const next = Math.min(2.2, Math.max(0.12, z * (e.deltaY < 0 ? 1.1 : 0.9)));
        setPan((p) => ({ x: mx - ((mx - p.x) * next) / z, y: my - ((my - p.y) * next) / z }));
        return next;
      });
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  const startPan = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-erd-card]')) return;
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y });
  };

  const startNodeDrag = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const start = { x: e.clientX, y: e.clientY };
    const origin = nodePos[id];
    const move = (ev: PointerEvent) => {
      setNodePos((p) => ({
        ...p,
        [id]: { ...origin, x: origin.x + (ev.clientX - start.x) / zoom, y: origin.y + (ev.clientY - start.y) / zoom },
      }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const connected = useMemo(() => {
    if (!selectedTable) return null;
    const s = new Set<string>([selectedTable]);
    for (const e of edges) {
      if (e.from === selectedTable) s.add(e.to);
      if (e.to === selectedTable) s.add(e.from);
    }
    return s;
  }, [selectedTable, edges]);

  // ---- render --------------------------------------------------------------
  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-zinc-500 min-h-[400px]">Reading schema…</div>;
  }
  if (schema?.error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[400px] text-sm">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <span className="text-zinc-400">{schema.error}</span>
        <button onClick={onReload} className="px-3 h-8 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800">Retry</button>
      </div>
    );
  }

  const orphans = schema?.tablesWithoutForeignKeys || [];
  const nodes = Object.values(nodePos);
  const bounds = nodes.length
    ? {
        minX: Math.min(...nodes.map((n) => n.x)),
        minY: Math.min(...nodes.map((n) => n.y)),
        maxX: Math.max(...nodes.map((n) => n.x + n.w)),
        maxY: Math.max(...nodes.map((n) => n.y + n.h)),
      }
    : { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-2">
      {/* toolbar */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <span className="text-xs text-zinc-500">
          <span className="text-zinc-300 font-medium">{schema?.tables.length ?? 0}</span> tables ·{' '}
          <span className="text-zinc-300 font-medium">{edges.length}</span> declared relationships ·{' '}
          <span className="text-zinc-300 font-medium">{schema?.totalColumns ?? 0}</span> columns
        </span>

        {focusGroup ? (
          <button
            onClick={() => { setFocusGroup(null); setSelectedTable(null); setSelectedEdge(null); }}
            className="px-2.5 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> All domains
          </button>
        ) : null}

        {selectedTable ? (
          <button
            onClick={() => { setSelectedTable(null); setSelectedEdge(null); }}
            className="px-2.5 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Clear selection
          </button>
        ) : null}

        <div className="flex-1" />
        {focusGroup ? (
          <button
            onClick={() => autoLayout(visibleTables.map((t) => t.name))}
            className="px-2.5 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-1"
            title="Re-run the layered auto layout"
          >
            <GitBranch className="w-3 h-3" /> Auto layout
          </button>
        ) : null}
        <button onClick={fit} className="px-2.5 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-1" title="Fit to view">
          <Maximize2 className="w-3 h-3" /> Fit
        </button>
        <button
          onClick={() => { setNodePos({}); setSelectedTable(null); setSelectedEdge(null); setFocusGroup(null); setPan({ x: 40, y: 40 }); setZoom(0.75); }}
          className="px-2.5 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-1"
          title="Reset layout"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))} className="w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800">+</button>
          <span className="text-[10px] text-zinc-500 w-11 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.max(0.12, z - 0.15))} className="w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800">−</button>
        </div>
      </div>

      {/* honesty banner */}
        {/* `text-amber-200/90` is a LIGHT amber — it exists to sit on a dark
             banner. On Warm Paper it measured 1.05:1, i.e. invisible, which is the
             "this text is not visible" report. The dark value is left untouched and
             light gets the --warning token, which is already theme-aware
             (#fbbf24 dark / #92400e light, the latter darkened one step precisely
             so it passes on cream). Measured on the composited banner: 11.90:1 dark
             -> unchanged, 1.05:1 -> 5.13:1 light. */}
      {orphans.length ? (
        <div className="shrink-0 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/25 light:border-[color-mix(in_srgb,var(--warning)_28%,transparent)] text-[11px] text-amber-200/90 light:text-[color-mix(in_srgb,var(--warning)_92%,transparent)]">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0 text-amber-400 light:text-[var(--warning)]" />
          <span>
            <strong className="font-semibold">{orphans.length} of {schema?.tables.length} tables declare no foreign key.</strong>{' '}
            Their links are not drawn, because this diagram only renders real constraints — not guesses from column names.
            {' '}
            <span className="text-amber-300/70 light:text-[color-mix(in_srgb,var(--warning)_78%,transparent)] font-mono text-[10px]">{orphans.slice(0, 6).join(', ')}{orphans.length > 6 ? ` +${orphans.length - 6} more` : ''}</span>
          </span>
        </div>
      ) : null}

      <div
        ref={wrapRef}
        onWheel={onWheel}
        onMouseDown={startPan}
        onMouseMove={(e) => { if (dragging) setPan({ x: dragStart.px + (e.clientX - dragStart.x), y: dragStart.py + (e.clientY - dragStart.y) }); }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        className="flex-1 overflow-hidden rounded-xl border border-zinc-800/50 relative select-none"
        style={{ cursor: dragging ? 'grabbing' : 'grab', minHeight: 'min(66vh, 700px)', background: 'var(--ws-erdbg)' }}
      >
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
          onMouseDown={(e) => { if (!(e.target as Element).closest('[data-erd-edge]')) { setSelectedEdge(null); } }}
        >
          <defs>
            <pattern id="erd-dots" width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="13" cy="13" r="0.6" fill="var(--ws-erdbg-dot)" fillOpacity="0.45" />
            </pattern>
            <marker id="erd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ws-accent-text)" />
            </marker>
            <marker id="erd-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#a78bfa" />
            </marker>
          </defs>
          <rect x={-2000} y={-2000} width={bounds.maxX - bounds.minX + 4000} height={bounds.maxY - bounds.minY + 4000} fill="url(#erd-dots)" />

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {focusGroup
              ? edges.map((e) => {
                  const a = nodePos[e.from];
                  const b = nodePos[e.to];
                  if (!a || !b) return null;
                  const dim = connected && !(connected.has(e.from) && connected.has(e.to));
                  const on = !dim;
                  const x1 = a.x + a.w;
                  const y1 = a.y + HEADER_H / 2 + 6;
                  const x2 = b.x;
                  const y2 = b.y + HEADER_H / 2 + 6;
                  const mid = Math.max(30, (x2 - x1) / 2);
                  const d = `M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`;
                  const active = selectedEdge?.id === e.id;
                  return (
                    <g key={e.id} data-erd-edge={e.id} style={{ cursor: 'pointer' }}
                       onClick={(ev) => { ev.stopPropagation(); setSelectedEdge(e); setSelectedTable(null); }}>
                      <path d={d} fill="none" stroke="transparent" strokeWidth={14 / zoom} />
                      <path
                        d={d}
                        fill="none"
                        stroke={active ? '#c4b5fd' : on && !connected ? '#52525b' : '#a78bfa'}
                        strokeWidth={(active ? 2.4 : 1.4) / zoom}
                        strokeDasharray={e.cardinality === '1:1' ? `${6 / zoom} ${4 / zoom}` : undefined}
                        markerEnd={`url(#${on && !connected || active ? 'erd-arrow-on' : 'erd-arrow'})`}
                        opacity={dim ? 0.15 : 1}
                      />
                    </g>
                  );
                })
              : null}
          </g>
        </svg>

        {/* node layer */}
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
          {!focusGroup
            ? groups.map((g) => {
                const n = nodePos['g:' + g.id];
                if (!n) return null;
                const tables = g.tables.map((name) => tableByName[name]).filter(Boolean);
                const fkCount = tables.reduce((a, t) => a + t.foreignKeys.length, 0);
                const orphan = tables.filter((t) => !t.hasDeclaredForeignKeys).length;
                return (
                  <div
                    key={g.id}
                    data-erd-card={g.id}
                    onPointerDown={(e) => startNodeDrag(e, 'g:' + g.id)}
                    onDoubleClick={() => setFocusGroup(g.id)}
                    onClick={() => setFocusGroup(g.id)}
                    className="absolute rounded-xl border cursor-pointer overflow-hidden"
                    style={{
                      left: n.x, top: n.y, width: n.w, minHeight: n.h,
                      borderColor: g.color + '55',
                      background: `linear-gradient(160deg, ${g.color}14, var(--ws-erdbg-end) 70%)`,
                    }}
                  >
                    <div className="px-3 py-2 text-[12px] font-semibold flex items-center gap-1.5" style={{ color: g.color, borderBottom: `1px solid ${g.color}30` }}>
                      <Table2 className="w-3.5 h-3.5" /> {g.label}
                    </div>
                    <div className="px-3 py-2 text-[11px] text-zinc-400 space-y-1">
                      <div>{tables.length} tables · {fkCount} FK relationships</div>
                      {orphan ? (
                        <div className="flex items-center gap-1 text-amber-300/80">
                          <AlertTriangle className="w-3 h-3" /> {orphan} without FK constraints
                        </div>
                      ) : null}
                      <div className="text-[10px] text-zinc-600">click to open</div>
                    </div>
                  </div>
                );
              })
            : null}

          {focusGroup
            ? visibleTables.map((t) => {
                const n = nodePos[t.name];
                if (!n) return null;
                const dim = connected && !connected.has(t.name);
                const sel = selectedTable === t.name;
                const fkCols = new Set(t.foreignKeys.flatMap((f) => f.fromColumns));
                const shown = t.columns.slice(0, MAX_ROWS);
                const rest = t.columns.length - shown.length;
                return (
                  <div
                    key={t.name}
                    data-erd-card={t.name}
                    onPointerDown={(e) => startNodeDrag(e, t.name)}
                    onClick={(e) => { e.stopPropagation(); setSelectedTable(sel ? null : t.name); setSelectedEdge(null); }}
                    className="absolute rounded-lg overflow-hidden text-[11px] font-mono"
                    style={{
                      left: n.x, top: n.y, width: n.w,
                      /* Hardcoded #101016 / #3f3f46 / #0009: an ERD node is CHROME, so
                         it follows the theme. The inner label below is text-zinc-200,
                         which the light blankets already remap to ink. */
                      border: `1px solid ${sel ? 'var(--page-accent)' : 'var(--ws-border-strong)'}`,
                      background: 'var(--ws-surface-raised)',
                      boxShadow: sel
                        ? '0 0 0 1px color-mix(in srgb, var(--page-accent) 35%, transparent)'
                        : '0 6px 18px rgb(28 25 23 / 0.09)',
                      opacity: dim ? 0.28 : 1,
                      transition: 'opacity 140ms ease',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="flex items-center gap-1.5 px-2.5" style={{ height: HEADER_H, background: 'var(--ws-surface-sunken)', borderBottom: '1px solid var(--ws-border)' }}>
                      <Table2 className="w-3 h-3 text-zinc-500 shrink-0" />
                      <span className="font-semibold text-zinc-200 truncate">{t.name}</span>
                      <span className="ml-auto text-[9px] text-zinc-600 shrink-0">{t.rowCount.toLocaleString()} rows</span>
                    </div>
                    <div className="py-0.5">
                      {shown.map((c) => (
                        <div key={c.name} className="flex items-center gap-1.5 px-2.5" style={{ height: ROW_H }}>
                          {c.primaryKey ? <Key className="w-2.5 h-2.5 text-amber-400 shrink-0" /> : <span className="w-2.5 shrink-0" />}
                          {fkCols.has(c.name) ? <Link2 className="w-2.5 h-2.5 text-sky-400 shrink-0" /> : <span className="w-2.5 shrink-0" />}
                          <span className={c.primaryKey ? 'text-amber-200' : 'text-zinc-300'}>{c.name}</span>
                          <span className="ml-auto text-[9px] text-zinc-600 truncate max-w-[86px]">
                            {c.type || '—'}{c.notNull ? ' NN' : ''}
                          </span>
                        </div>
                      ))}
                      {rest > 0 ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpanded((p) => ({ ...p, [t.name]: !p[t.name] })); }}
                          className="w-full text-left px-2.5 text-[10px] text-zinc-500 hover:text-zinc-300"
                        >
                          {expanded[t.name] ? '▾ fewer' : `+${rest} more columns`}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            : null}
        </div>
      </div>

      {/* detail panel */}
      {selectedEdge ? (
        <div className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] px-3 py-2 text-[11px] flex items-center gap-3 flex-wrap">
          <Link2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-mono text-zinc-200">
            {selectedEdge.fromCols.join(', ')}
          </span>
          <span className="text-zinc-500">→</span>
          <span className="font-mono text-zinc-200">
            {selectedEdge.to}.{selectedEdge.toCols?.join(', ') || 'PK'}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">{selectedEdge.cardinality}</span>
          <span className="text-zinc-500">ON DELETE {selectedEdge.onDelete}</span>
          <span className="text-zinc-500">ON UPDATE {selectedEdge.onUpdate}</span>
          <span className="text-zinc-600">declared foreign key</span>
          <button onClick={() => setSelectedEdge(null)} className="ml-auto text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : selectedTable ? (
        <div className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] px-3 py-2 text-[11px] flex items-center gap-3 flex-wrap">
          <Columns3 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="font-mono text-zinc-200">{selectedTable}</span>
          <span className="text-zinc-500">{tableByName[selectedTable]?.columns.length} columns · {tableByName[selectedTable]?.rowCount.toLocaleString()} rows</span>
          {tableByName[selectedTable]?.primaryKey.length ? (
            <span className="text-amber-300">PK: {tableByName[selectedTable]!.primaryKey.join(', ')}</span>
          ) : <span className="text-zinc-600">no primary key</span>}
          {tableByName[selectedTable]?.hasDeclaredForeignKeys ? (
            <span className="text-sky-300">{tableByName[selectedTable]!.foreignKeys.length} outgoing FK</span>
          ) : (
            <span className="text-amber-300/90">no declared foreign keys</span>
          )}
          <button onClick={() => setSelectedTable(null)} className="ml-auto text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : null}
    </div>
  );
}
