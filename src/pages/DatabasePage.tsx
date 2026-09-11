import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Table2, Download, Database, Clock, ArrowLeft, ArrowRight, Network, ChevronRight } from 'lucide-react';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { CurrentCanvas } from '../components/CurrentCanvas';
import { renderPartition } from '../lib/renderers/partition';
import { startPhaseClock } from '../lib/currentPhase';

const TABLE_CATEGORIES: Record<string, { label: string; color: string }> = {
  core:       { label: 'Core Tracking',   color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  stats:      { label: 'Aggregated',      color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  ide:        { label: 'IDE / Projects',  color: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  ai:         { label: 'AI Usage',        color: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' },
  ai_chat:    { label: 'AI Chat',         color: 'bg-pink-500/15 text-pink-300 border-pink-500/30' },
  context:    { label: 'Context Brain',   color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  workspace:  { label: 'Terminal',        color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  finance:    { label: 'Finance',         color: 'bg-lime-500/15 text-lime-300 border-lime-500/30' },
  learn:      { label: 'Learn (Lyceum)',  color: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  content:    { label: 'Content Engine',  color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  focus:      { label: 'Focus',           color: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
  external:   { label: 'External',        color: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  conductor:  { label: 'Conductor',       color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  composition:{ label: 'Compositions',    color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  other:      { label: 'Other',           color: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
};

const TCM: Record<string, string> = {
  logs:'core',sessions:'core',daily_stats:'core',browser_sessions:'core',productivity_sessions:'core',daily_aggregates:'core',
  stats_hourly:'stats',stats_daily:'stats',daily_rollup:'stats',app_totals:'stats',
  projects:'ide',ides:'ide',extensions:'ide',tools:'ide',project_line_stats:'ide',project_tools:'ide',code_activity:'ide',commits:'ide',ai_attribution:'ide',dora_metrics:'ide',
  ai_usage:'ai',ai_briefs:'ai',ai_interests:'ai',ai_feature_usage:'ai',ai_debug_events:'ai',
  ai_chat_messages:'ai_chat',ai_chat_threads:'ai_chat',ai_chat_memories:'ai_chat',ai_context_captures:'ai_chat',ai_context_groups:'ai_chat',ai_memory_context:'ai_chat',
  context_entities:'context',context_facts:'context',context_episodes:'context',context_embeddings:'context',context_extraction_jobs:'context',user_context_profile:'context',user_context_signals:'context',context_backfill_meta:'context',agent_memories:'context',
  terminal_sessions:'workspace',terminal_messages:'workspace',terminal_layouts:'workspace',terminal_presets:'workspace',terminal_bindings:'workspace',session_parsed_items:'workspace',workspace_state:'workspace',workspace_problems:'workspace',workspace_requests:'workspace',agent_prompts:'workspace',bug_reports:'workspace',touched_files:'workspace',
  finance_accounts:'finance',finance_wallets:'finance',finance_categories:'finance',finance_transactions:'finance',finance_settings:'finance',finance_crypto_prices:'finance',finance_crypto_history:'finance',finance_subscriptions:'finance',finance_transfer_routes:'finance',finance_daily_summaries:'finance',finance_wallet_snapshots:'finance',crypto_asset_history:'finance',finance_ft_persons:'finance',finance_fixed_expenses:'finance',finance_fixed_expense_payments:'finance',finance_budgets:'finance',finance_monthly_recaps:'finance',audit_log:'finance',
  learn_lessons:'learn',learn_nodes:'learn',learn_node_prereqs:'learn',learn_sources:'learn',learn_chunks:'learn',learn_progress:'learn',learn_evidence:'learn',learn_tutor_cache:'learn',learn_media_cache:'learn',learn_profile:'learn',learn_notes:'learn',learn_actions:'learn',learn_conversations:'learn',learn_decks:'learn',learn_cards:'learn',learn_card_reviews:'learn',learn_viz_state:'learn',learn_sessions:'learn',learn_intents:'learn',learn_goals:'learn',learn_streaks:'learn',learn_achievements:'learn',learn_lesson_stats:'learn',learn_timer_queue:'learn',learn_velocity:'learn',learn_branches:'learn',learn_permissions:'learn',
  content_ideas:'content',content_episodes:'content',themes:'content',content_frameworks:'content',content_videos:'content',content_lessons:'content',video_reflections:'content',video_characteristics:'content',process_timeline:'content',score_calibrations:'content',scoring_schemes:'content',content_takes:'content',take_segments:'content',take_evaluations:'content',presentations:'content',presentation_slides:'content',
  deep_focus_sessions:'focus',deep_focus_events:'focus',focus_groups:'focus',focus_group_usage:'focus',focus_goal_config:'focus',
  external_activities:'external',external_sessions:'external',external_settings:'external',activity_log:'external',schedule_entries:'external',deadlines:'external',schedule_templates:'external',
  conductor_missions:'conductor',conductor_nodes:'conductor',conductor_messages:'conductor',conductor_escalations:'conductor',conductor_configs:'conductor',conductor_metrics:'conductor',conductor_templates:'conductor',conductor_budgets:'conductor',conductor_sessions:'conductor',
  composition_rules:'composition',composition_versions:'composition',composition_schedules:'composition',composition_conditions:'composition',composition_actions:'composition',composition_tag_links:'composition',composition_execution_log:'composition',composition_event_outbox:'composition',composition_execution_status:'composition',composition_settings:'composition',
  category_overrides:'other',domain_category_overrides:'other',goals:'other',goal_reviews:'other',life_phases:'other',life_timeline_meta:'other',notes:'other',routing_costs:'other',manual_time_assignments:'other',browser_profiles:'other',schema_migrations:'other',
};

const ARCH_GROUPS = [
  { id:'core',     label:'Core Tracking',     color:'#10b981', tables:['logs','sessions','daily_stats','browser_sessions','productivity_sessions'] },
  { id:'stats',    label:'Aggregated Stats',  color:'#06b6d4', tables:['stats_hourly','stats_daily','daily_rollup','app_totals'] },
  { id:'ide',      label:'IDE / Projects',    color:'#8b5cf6', tables:['projects','ides','extensions','tools','code_activity','commits','ai_attribution','dora_metrics'] },
  { id:'ai',       label:'AI Usage & Chat',   color:'#d946ef', tables:['ai_usage','ai_chat_messages','ai_chat_threads','ai_context_captures'] },
  { id:'context',  label:'Context Brain',     color:'#f59e0b', tables:['context_entities','context_facts','context_episodes','user_context_profile','agent_memories'] },
  { id:'workspace',label:'Terminal',          color:'#6366f1', tables:['terminal_sessions','terminal_messages','workspace_state','workspace_problems','workspace_requests'] },
  { id:'finance',  label:'Finance',           color:'#84cc16', tables:['finance_accounts','finance_wallets','finance_transactions','finance_categories','finance_subscriptions'] },
  { id:'learn',    label:'Learn (Lyceum)',    color:'#f97316', tables:['learn_lessons','learn_nodes','learn_progress','learn_cards','learn_streaks'] },
  { id:'content',  label:'Content Engine',    color:'#f43f5e', tables:['content_ideas','content_episodes','themes','content_lessons','content_videos'] },
  { id:'focus',    label:'Focus',             color:'#14b8a6', tables:['deep_focus_sessions','focus_groups','focus_group_usage'] },
  { id:'external', label:'External',          color:'#0ea5e9', tables:['external_activities','external_sessions','schedule_entries','deadlines'] },
  { id:'conductor',label:'Conductor',         color:'#eab308', tables:['conductor_missions','conductor_nodes','conductor_messages'] },
];

export default function DatabasePage() {
  useEffect(() => { startPhaseClock(); }, []);
  const [activeTab, setActiveTab] = useState<'browse'|'architecture'|'changes'>('browse');
  const [tables, setTables] = useState<string[]>([]);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [selectedTable, setSelectedTable] = useState('');
  const [tableSchema, setTableSchema] = useState<any[]>([]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableSearch, setTableSearch] = useState('');
  const [tableLoading, setTableLoading] = useState(false);
  const [tableDataPage, setTableDataPage] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [recentChanges, setRecentChanges] = useState<any[]>([]);
  const [changesLoading, setChangesLoading] = useState(false);
  const PAGE_SIZE = 50;
  const api = (window as any).deskflowAPI;

  const fetchTables = useCallback(async () => {
    if (!api?.getDatabaseTables) return;
    try {
      const res = await api.getDatabaseTables();
      if (res?.tables) {
        setTables(res.tables);
        const counts: Record<string, number> = {};
        for (const t of res.tables) {
          try { const c = await api.getTableDataCount(t); counts[t] = c?.total ?? 0; }
          catch { counts[t] = 0; }
        }
        setTableCounts(counts);
      }
    } catch {}
  }, [api]);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  const fetchTableSchema = useCallback(async (name: string) => {
    if (!api?.getTableSchema) return;
    try { const s = await api.getTableSchema(name); setTableSchema(Array.isArray(s) ? s : []); }
    catch { setTableSchema([]); }
  }, [api]);

  const fetchTableData = useCallback(async (name: string, page = 0) => {
    if (!api?.getTableData) return;
    setTableLoading(true);
    try {
      const offset = page * PAGE_SIZE;
      const [data, count] = await Promise.all([api.getTableData(name, PAGE_SIZE + 1, offset), api.getTableDataCount(name)]);
      setTableData(Array.isArray(data) ? data : []);
      setTotalRows(count?.total ?? 0);
      setTableDataPage(page);
    } catch { setTableData([]); setTotalRows(0); }
    finally { setTableLoading(false); }
  }, [api]);

  const fetchRecentChanges = useCallback(async (name: string) => {
    if (!api?.getTableChanges) return;
    setChangesLoading(true);
    try { const r = await api.getTableChanges(name, 25); setRecentChanges(r?.changes ?? []); }
    catch { setRecentChanges([]); }
    finally { setChangesLoading(false); }
  }, [api]);

  useEffect(() => {
    if (!selectedTable) return;
    if (activeTab === 'browse') { fetchTableSchema(selectedTable); fetchTableData(selectedTable); }
    if (activeTab === 'changes') fetchRecentChanges(selectedTable);
  }, [selectedTable, activeTab, fetchTableSchema, fetchTableData, fetchRecentChanges]);

  const filteredTables = useMemo(() => {
    if (!tableSearch) return tables;
    const q = tableSearch.toLowerCase();
    return tables.filter(t => t.toLowerCase().includes(q));
  }, [tables, tableSearch]);

  const tablesByCategory = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const t of filteredTables) { const c = TCM[t] || 'other'; (g[c] ??= []).push(t); }
    return g;
  }, [filteredTables]);

  const hasNextPage = tableData.length > PAGE_SIZE;
  const displayRows = hasNextPage ? tableData.slice(0, PAGE_SIZE) : tableData;

  const exportCSV = useCallback(() => {
    if (!selectedTable || !displayRows.length) return;
    const cols = Object.keys(displayRows[0]);
    const csv = [cols.join(','), ...displayRows.map(r => cols.map(c => {
      const v = String(r[c] ?? '');
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${selectedTable}.csv`; a.click();
  }, [selectedTable, displayRows]);

  const tabs = [
    { id: 'browse' as const, label: 'Browse', icon: Table2 },
    { id: 'architecture' as const, label: 'Architecture', icon: Network },
    { id: 'changes' as const, label: 'Recent Changes', icon: Clock },
  ];

  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-hidden" data-page="database">
      <CurrentCanvas accent="#a78bfa" render={renderPartition} />
      <div className="relative z-10 flex flex-col h-full min-h-0">
        <div className="flex-shrink-0">
          <SectionHeader title="Database" icon={<Database className="w-5 h-5" />} />
          <div className="flex items-center gap-1 px-5 pt-2">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-150 ${
                  activeTab === tab.id ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 border border-transparent'
                }`}>
                <tab.icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-zinc-600">{tables.length} tables</span>
          </div>
        </div>
        <div className="flex gap-4 flex-1 min-h-0 p-5 pt-3">
          {activeTab === 'browse' && (
            <BrowseTab tablesByCategory={tablesByCategory} tableSearch={tableSearch} setTableSearch={setTableSearch}
              selectedTable={selectedTable} setSelectedTable={setSelectedTable} tableCounts={tableCounts}
              tableSchema={tableSchema} tableData={displayRows} tableLoading={tableLoading}
              totalRows={totalRows} tableDataPage={tableDataPage} hasNextPage={hasNextPage}
              fetchTableData={fetchTableData} exportCSV={exportCSV} fetchRecentChanges={fetchRecentChanges}
              setActiveTab={setActiveTab} PAGE_SIZE={PAGE_SIZE} />
          )}
          {activeTab === 'architecture' && (
            <GlassCard className="flex-1 p-4 overflow-hidden h-full min-h-0">
              <ArchitectureView tables={tables} tableCounts={tableCounts}
                onSelectTable={(t) => { setSelectedTable(t); setActiveTab('browse'); }} />
            </GlassCard>
          )}
          {activeTab === 'changes' && (
            <GlassCard className="flex-1 p-4 overflow-auto h-full min-h-0">
              <ChangesView tablesByCategory={tablesByCategory} tableSearch={tableSearch} setTableSearch={setTableSearch}
                selectedTable={selectedTable} onSelectTable={setSelectedTable} tableCounts={tableCounts}
                recentChanges={recentChanges} changesLoading={changesLoading} onFetchChanges={fetchRecentChanges} />
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}


function BrowseTab({ tablesByCategory, tableSearch, setTableSearch, selectedTable, setSelectedTable, tableCounts, tableSchema, tableData, tableLoading, totalRows, tableDataPage, hasNextPage, fetchTableData, exportCSV, fetchRecentChanges, setActiveTab, PAGE_SIZE }: any) {
  return (
    <>
      <GlassCard className="w-64 flex-shrink-0 p-3 h-full min-h-0 flex flex-col">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <VoiceInputWrapper>
            <input type="text" placeholder="Filter tables..." value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600" />
          </VoiceInputWrapper>
        </div>
        <div className="space-y-0.5 overflow-y-auto min-h-0 flex-1">
          {Object.entries(tablesByCategory).map(([cat, tbls]: [string, string[]]) => (
            <div key={cat}>
              <div className="flex items-center gap-1.5 px-2 pt-2 pb-0.5">
                <span className={`text-[9px] font-semibold uppercase tracking-wider ${TABLE_CATEGORIES[cat]?.color ?? TABLE_CATEGORIES.other.color}`}>
                  {TABLE_CATEGORIES[cat]?.label ?? cat}
                </span>
                <span className="text-[9px] text-zinc-600">({tbls.length})</span>
              </div>
              {tbls.map(table => (
                <button key={table} onClick={() => setSelectedTable(table)}
                  className={`w-full text-left px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    selectedTable === table ? 'bg-purple-500/15 text-purple-300' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}>
                  <span className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 truncate">
                      <Table2 className="w-3 h-3 flex-shrink-0 opacity-50" />
                      <span className="truncate">{table}</span>
                    </span>
                    {tableCounts[table] !== undefined && (
                      <span className="text-[9px] text-zinc-600 ml-1 flex-shrink-0">{tableCounts[table]}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard className="flex-1 p-4 overflow-auto h-full min-h-0">
        {selectedTable ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">{selectedTable}</h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {tableSchema.length} columns · {totalRows.toLocaleString()} rows
                  {totalRows > PAGE_SIZE && ` · page ${tableDataPage + 1} of ${Math.ceil(totalRows / PAGE_SIZE)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { fetchRecentChanges(selectedTable); setActiveTab('changes'); }}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Changes
                </button>
                <button onClick={exportCSV} disabled={!tableData.length}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors disabled:opacity-30 flex items-center gap-1.5">
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              </div>
            </div>
            {tableSchema.length > 0 && (
              <div className="mb-4 overflow-x-auto">
                <div className="flex gap-1.5 flex-wrap">
                  {tableSchema.map((col: any, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/50 border border-zinc-700/30 text-[10px]">
                      <span className="text-zinc-300 font-mono">{col.name || col.column_name}</span>
                      <span className="text-zinc-600">{col.type || col.data_type}</span>
                      {col.pk === 1 && <span className="text-amber-500/60 text-[8px]">PK</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {tableLoading ? <LoadingState /> : tableData.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800/60">
                        {Object.keys(tableData[0]).map(col => (
                          <th key={col} className="text-left text-zinc-500 font-medium py-2 pr-4 whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, i) => (
                        <tr key={i} className="border-b border-zinc-800/30 hover:bg-zinc-800/20">
                          {Object.entries(row).map(([col, val], j) => (
                            <td key={j} className="py-1.5 pr-4 text-zinc-400 max-w-[200px] truncate">
                              {val === null ? <span className="text-zinc-700 italic">null</span> :
                               typeof val === 'string' && val.length > 80 ? val.slice(0, 80) + '\u2026' : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800/40">
                  <button onClick={() => fetchTableData(selectedTable, tableDataPage - 1)} disabled={tableDataPage === 0}
                    className="px-3 py-1 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400 hover:text-white disabled:opacity-30 transition-colors flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> Previous
                  </button>
                  <span className="text-xs text-zinc-500">
                    {tableDataPage * PAGE_SIZE + 1}–{Math.min((tableDataPage + 1) * PAGE_SIZE, totalRows)} of {totalRows.toLocaleString()}
                  </span>
                  <button onClick={() => fetchTableData(selectedTable, tableDataPage + 1)} disabled={!hasNextPage}
                    className="px-3 py-1 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400 hover:text-white disabled:opacity-30 transition-colors flex items-center gap-1">
                    Next <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </>
            ) : <EmptyState icon={<Database className="w-12 h-12" />} title="No data" description="This table is empty" />}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600">
            <Database className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-xs">Select a table to browse</p>
          </div>
        )}
      </GlassCard>
    </>
  );
}


function ArchitectureView({ tables, tableCounts, onSelectTable }: {
  tables: string[]; tableCounts: Record<string, number>; onSelectTable: (t: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<(() => void) | null>(null);
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [hoveredFk, setHoveredFk] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fitScale, setFitScale] = useState(1);
  const [fitPan, setFitPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [fkData, setFkData] = useState<Record<string, { id: number; seq: number; table: string; from: string; to: string; on_update: string; on_delete: string; match: string }[]>>({});
  const [fkLoading, setFkLoading] = useState(false);

  // Fetch all foreign keys from DB
  useEffect(() => {
    const api = (window as any).deskflowAPI;
    if (!api?.getTableForeignKeys) return;
    setFkLoading(true);
    (async () => {
      const result: Record<string, any[]> = {};
      try {
        for (const t of tables) {
          const res = await api.getTableForeignKeys(t);
          if (res?.fks && Array.isArray(res.fks) && res.fks.length > 0) {
            result[t] = res.fks;
          }
        }
      } catch {}
      setFkData(result);
      setFkLoading(false);
    })();
  }, [tables]);

  // Build edge list from FK data
  const fkEdges = useMemo(() => {
    const edges: { from: string; to: string; label: string }[] = [];
    for (const [source, fks] of Object.entries(fkData)) {
      for (const fk of fks) {
        edges.push({
          from: source,
          to: fk.table,
          label: `${fk.from} → ${fk.to}`,
        });
      }
    }
    return edges;
  }, [fkData]);

  const GW = 280, GH = 38, RW = 26, PAD = 26, GX = 44, GY = 40;

  const groups = useMemo(() => {
    const cols = 3;
    return ARCH_GROUPS.map((g, i) => ({
      ...g,
      x: (i % cols) * (GW + GX),
      y: Math.floor(i / cols) * (300 + GY),
      h: GH + g.tables.length * RW + PAD,
    }));
  }, []);

  // Content bounding box
  const contentBounds = useMemo(() => {
    let maxX = 0, maxY = 0;
    for (const g of groups) {
      maxX = Math.max(maxX, g.x + GW);
      maxY = Math.max(maxY, g.y + g.h);
    }
    return { w: maxX + 20, h: maxY + 20 };
  }, [groups]);

  // Auto-fit on mount and resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const cw = rect.width, ch = rect.height;
      if (cw < 10 || ch < 10) return;
      const scaleX = cw / contentBounds.w;
      const scaleY = ch / contentBounds.h;
      const s = Math.min(scaleX, scaleY, 1);
      const px = (cw - contentBounds.w * s) / 2;
      const py = (ch - contentBounds.h * s) / 2;
      setFitScale(s);
      setFitPan({ x: px, y: py });
      setZoom(s);
      setPan({ x: px, y: py });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [contentBounds]);

  // Native wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setZoom(z => Math.min(2, Math.max(0.15, z + delta)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    wheelRef.current = () => el.removeEventListener('wheel', onWheel);
    return () => { if (wheelRef.current) wheelRef.current(); };
  }, []);

  const center = (name: string) => {
    for (const g of groups) {
      const idx = g.tables.indexOf(name);
      if (idx !== -1) return { x: g.x + GW / 2, y: g.y + GH + idx * RW + RW / 2 };
    }
    return null;
  };

  const fkPath = (a: {x:number;y:number}, b: {x:number;y:number}) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const bend = Math.min(dist * 0.35, 80);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const nx = -dy / dist * bend, ny = dx / dist * bend;
    const cx = mx + nx * 0.3, cy = my + ny * 0.3;
    return `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`;
  };

  const onDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: dragStart.current.panX + (e.clientX - dragStart.current.x), y: dragStart.current.panY + (e.clientY - dragStart.current.y) });
  }, [dragging]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Network className="w-4 h-4 text-purple-400" /> Database Architecture
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {tables.length} tables · {ARCH_GROUPS.length} domains · {fkEdges.length} relationships · scroll to zoom, drag to pan
            {fkLoading && <span className="ml-2 text-amber-500/70 animate-pulse">loading FKs...</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} className="w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors flex items-center justify-center">+</button>
          <span className="text-[10px] text-zinc-600 w-10 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.15, z - 0.15))} className="w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors flex items-center justify-center">-</button>
          <button onClick={() => { setZoom(fitScale); setPan({ ...fitPan }); }} className="px-2.5 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-[10px] text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors">Fit</button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden rounded-xl border border-zinc-800/50 relative" style={{ cursor: dragging ? 'grabbing' : 'grab', background: 'linear-gradient(135deg, #08080c 0%, #0c0c14 50%, #0a0a10 100%)', minHeight: '340px' }}>
        <svg ref={svgRef} width="100%" height="100%" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={() => setDragging(false)} onMouseLeave={() => { setDragging(false); setHoveredTable(null); setHoveredFk(null); }}>
          <defs>
            {ARCH_GROUPS.map(g => (
              <linearGradient key={`grad-${g.id}`} id={`grad-${g.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={g.color} stopOpacity="0.16" />
                <stop offset="100%" stopColor={g.color} stopOpacity="0.03" />
              </linearGradient>
            ))}
            {ARCH_GROUPS.map(g => (
              <linearGradient key={`hdr-${g.id}`} id={`hdr-${g.id}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={g.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={g.color} stopOpacity="0.06" />
              </linearGradient>
            ))}
            <filter id="glow-fk" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="card-shadow" x="-8%" y="-4%" width="116%" height="112%">
              <feDropShadow dx="0" dy="3" stdDeviation="8" floodColor="#000" floodOpacity="0.5" />
            </filter>
          </defs>
          <pattern id="dot-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="14" cy="14" r="0.6" fill="#27272a" fillOpacity="0.4" />
          </pattern>
          <rect width="200%" height="200%" x="-50%" y="-50%" fill="url(#dot-grid)" opacity="0.5" />
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* FK relationships — curved bezier paths with glow */}
            {fkEdges.map((edge, i) => {
              const a = center(edge.from), b = center(edge.to);
              if (!a || !b) return null;
              const hl = hoveredTable === edge.from || hoveredTable === edge.to || hoveredFk === i;
              const fromGroup = ARCH_GROUPS.find(g => g.tables.includes(edge.from));
              const color = hl ? (fromGroup?.color ?? '#a78bfa') : '#52525b';
              return (
                <g key={i} onMouseEnter={() => setHoveredFk(i)} onMouseLeave={() => setHoveredFk(null)}>
                  {hl && <path d={fkPath(a, b)} fill="none" stroke={color} strokeWidth={5} opacity={0.2} filter="url(#glow-fk)" />}
                  <path d={fkPath(a, b)} fill="none" stroke={color} strokeWidth={hl ? 1.8 : 0.8} strokeDasharray={hl ? undefined : '8 5'} opacity={hl ? 0.85 : 0.25} strokeLinecap="round" />
                  <circle cx={b.x} cy={b.y} r={hl ? 3 : 1.8} fill={color} opacity={hl ? 0.9 : 0.35} />
                </g>
              );
            })}
            {/* Domain group cards */}
            {groups.map(g => (
              <g key={g.id} filter="url(#card-shadow)">
                {/* Card body with gradient fill */}
                <rect x={g.x} y={g.y} width={GW} height={g.h} rx={14} fill="#111114" stroke={g.color} strokeWidth={0.8} strokeOpacity={0.25} />
                <rect x={g.x} y={g.y} width={GW} height={g.h} rx={14} fill={`url(#grad-${g.id})`} />
                {/* Header bar with gradient */}
                <rect x={g.x} y={g.y} width={GW} height={GH + 2} rx={14} fill={`url(#hdr-${g.id})`} />
                <rect x={g.x} y={g.y + GH - 10} width={GW} height={12} fill={`url(#hdr-${g.id})`} />
                {/* Header accent line */}
                <rect x={g.x + 10} y={g.y + GH - 1} width={GW - 20} height={1} rx={0.5} fill={g.color} fillOpacity={0.2} />
                {/* Domain label */}
                <text x={g.x + 16} y={g.y + 25} fill={g.color} fontSize={12.5} fontWeight={700} letterSpacing="0.03em">{g.label}</text>
                {/* Table count badge */}
                <rect x={g.x + GW - 36} y={g.y + 11} width={24} height={17} rx={9} fill={g.color} fillOpacity={0.12} stroke={g.color} strokeWidth={0.5} strokeOpacity={0.2} />
                <text x={g.x + GW - 24} y={g.y + 23.5} fill={g.color} fontSize={9} fontWeight={600} textAnchor="middle">{g.tables.length}</text>
                {/* Table rows */}
                {g.tables.map((t, ti) => {
                  const ty = g.y + GH + 6 + ti * RW;
                  const hl = hoveredTable === t;
                  const cnt = tableCounts[t] ?? 0;
                  return (
                    <g key={t} onMouseEnter={() => setHoveredTable(t)} onMouseLeave={() => setHoveredTable(null)} onClick={() => onSelectTable(t)} style={{ cursor: 'pointer' }}>
                      {/* Hover background pill */}
                      {hl && <rect x={g.x + 8} y={ty} width={GW - 16} height={RW - 3} rx={7} fill={g.color} fillOpacity={0.1} />}
                      {/* Left accent indicator */}
                      <circle cx={g.x + 18} cy={ty + RW / 2 - 1.5} r={hl ? 3 : 2} fill={hl ? g.color : '#3f3f46'} opacity={hl ? 1 : 0.45} />
                      {/* Table name */}
                      <text x={g.x + 28} y={ty + 15} fill={hl ? '#f4f4f5' : '#a1a1aa'} fontSize={11} fontFamily="'JetBrains Mono', monospace" fontWeight={hl ? 600 : 400}>{t}</text>
                      {/* Row count */}
                      {cnt > 0 && (
                        <text x={g.x + GW - 16} y={ty + 15} fill="#52525b" fontSize={9} fontFamily="'JetBrains Mono', monospace" textAnchor="end">{cnt >= 10000 ? `${(cnt / 1000).toFixed(0)}k` : cnt >= 1000 ? `${(cnt / 1000).toFixed(1)}k` : cnt.toLocaleString()}</text>
                      )}
                    </g>
                  );
                })}
              </g>
            ))}
          </g>
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 flex-shrink-0">
        {ARCH_GROUPS.map(g => (
          <div key={g.id} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color, boxShadow: `0 0 6px ${g.color}40` }} />
            <span className="text-[10px] text-zinc-500">{g.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangesView({ tablesByCategory, tableSearch, setTableSearch, selectedTable, onSelectTable, tableCounts, recentChanges, changesLoading, onFetchChanges }: any) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const fmtTime = (val: any) => { if (!val) return null; try { const d = new Date(val); return isNaN(d.getTime()) ? String(val) : d.toLocaleString(); } catch { return String(val); } };
  const timeKey = (r: any) => r.updated_at || r.created_at || r.started_at || r.ended_at || r.ts || r.last_seen_at;

  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="w-56 flex-shrink-0 flex flex-col min-h-0">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input type="text" placeholder="Filter..." value={tableSearch} onChange={e => setTableSearch(e.target.value)}
            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600" />
        </div>
        <div className="space-y-0.5 overflow-y-auto min-h-0 flex-1">
          {Object.entries(tablesByCategory).map(([cat, tbls]: [string, string[]]) => (
            <div key={cat}>
              <div className="px-2 pt-2 pb-0.5">
                <span className={`text-[9px] font-semibold uppercase tracking-wider ${TABLE_CATEGORIES[cat]?.color ?? TABLE_CATEGORIES.other.color}`}>
                  {TABLE_CATEGORIES[cat]?.label ?? cat}
                </span>
              </div>
              {tbls.map(t => (
                <button key={t} onClick={() => onSelectTable(t)}
                  className={`w-full text-left px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    selectedTable === t ? 'bg-purple-500/15 text-purple-300' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}>
                  <span className="flex items-center justify-between">
                    <span className="truncate">{t}</span>
                    {tableCounts[t] !== undefined && <span className="text-[9px] text-zinc-600">{tableCounts[t]}</span>}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        {selectedTable ? (
          changesLoading ? <LoadingState /> : recentChanges.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">{selectedTable} — Recent Changes</h3>
                <span className="text-[10px] text-zinc-500">{recentChanges.length} most recent rows</span>
              </div>
              {recentChanges.map((row: any, i: number) => {
                const ts = timeKey(row);
                const isExpanded = expandedIdx === i;
                const previewCols = Object.keys(row).slice(0, 4);
                return (
                  <div key={i} className="rounded-lg border border-zinc-800/40 bg-zinc-900/30 overflow-hidden">
                    <button onClick={() => setExpandedIdx(isExpanded ? null : i)}
                      className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] text-zinc-600 w-5 text-right">#{i + 1}</span>
                        <div className="flex gap-3">
                          {previewCols.map(c => (
                            <span key={c} className="text-[10px]">
                              <span className="text-zinc-600">{c}:</span>{' '}
                              <span className="text-zinc-300 font-mono max-w-[120px] inline-block truncate align-bottom">
                                {row[c] === null ? 'null' : String(row[c])}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ts && <span className="text-[9px] text-zinc-600">{fmtTime(ts)}</span>}
                        <ChevronRight className={`w-3 h-3 text-zinc-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-zinc-800/30 pt-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {Object.entries(row).map(([k, v]) => (
                            <div key={k} className="flex gap-2 text-[10px]">
                              <span className="text-zinc-600 font-mono flex-shrink-0">{k}</span>
                              <span className="text-zinc-300 font-mono break-all">
                                {v === null ? <span className="text-zinc-700 italic">null</span> : typeof v === 'string' && v.length > 120 ? v.slice(0, 120) + '\u2026' : String(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<Clock className="w-12 h-12" />} title="No recent changes" description="No timestamped data found for this table" />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600">
            <Clock className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-xs">Select a table to view recent changes</p>
          </div>
        )}
      </div>
    </div>
  );
}
