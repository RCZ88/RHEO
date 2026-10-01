import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ScanLine, BarChart3, FileCode, Code, MessageSquare, Minus, RefreshCw, PieChart, Search, ArrowUpDown, FileText, Settings } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, TooltipProps } from 'recharts';
import { WorkspaceCard, WorkspaceSection, WorkspaceToolbar } from './_ds/containers';
import { listContainer, riseItem } from './_ds/motion';
import { NumberTicker } from '../ui/number-ticker';
import type { LineStatsData, LineCountResult } from '../../types/line-stats';

const NEON_COLORS = ['#00FF66', '#00F0FF', '#FF007A', '#FF2A4B', '#A855F7', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#14B8A6'];
const HATCHED_COLORS = ['url(#stripeCyan)', 'url(#stripeEmerald)', 'url(#stripePurple)', 'url(#stripeAmber)', 'url(#stripePink)', 'url(#stripeRose)'];

const DEFAULT_EXCLUDES = [
  { key: 'md', label: 'Markdown', ext: '.md' },
  { key: 'json', label: 'JSON', ext: '.json' },
  { key: 'lock', label: 'Lock files', ext: '.lock' },
  { key: 'min', label: 'Minified', ext: '.min.js' },
];

type SortKey = 'filePath' | 'fileType' | 'totalLines' | 'codeLines' | 'commentLines' | 'blankLines' | 'codePercent';
type SortDir = 'asc' | 'desc';

function GlassTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[rgba(20,22,30,0.80)] backdrop-blur-xl border border-[rgba(255,255,255,0.12)] rounded-xl px-3.5 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
      <div className="text-[11px] font-semibold text-zinc-100 mb-1.5">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-[10px] py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color, boxShadow: `0 0 6px ${entry.color}` }} />
          <span className="text-zinc-400 capitalize">{entry.name}:</span>
          <span className="text-zinc-100 font-mono font-medium">{entry.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[rgba(20,22,30,0.80)] backdrop-blur-xl border border-[rgba(255,255,255,0.12)] rounded-xl px-3.5 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 text-[11px]">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color, boxShadow: `0 0 8px ${d.color}` }} />
        <span className="font-semibold text-zinc-100">{d.name}</span>
      </div>
      <div className="text-[10px] text-zinc-400 mt-1">{d.codeLines.toLocaleString()} code lines • {d.count} files</div>
      <div className="text-[10px] text-zinc-500">{d.percent}%</div>
    </div>
  );
}

interface Props {
  projectId?: string;
  projectPath?: string;
}

export default function CodeStatsTab({ projectId, projectPath }: Props) {
  const [data, setData] = useState<LineStatsData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [excludes, setExcludes] = useState<Record<string, boolean>>(Object.fromEntries(DEFAULT_EXCLUDES.map(e => [e.key, true])));
  const [customExts, setCustomExts] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('codeLines');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadCached = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await (window as any).deskflowAPI?.getProjectLineStats?.(projectId);
      if (result?.success && result.data) setData(result.data);
    } catch {}
  }, [projectId]);

  useEffect(() => { loadCached(); }, [loadCached]);

  const handleScan = async () => {
    if (!projectPath || !projectId) return;
    setIsScanning(true);
    setError(null);
    try {
      const excludeExtensions: string[] = [];
      for (const item of DEFAULT_EXCLUDES) { if (excludes[item.key]) excludeExtensions.push(item.ext); }
      if (customExts.trim()) customExts.split(',').map(e => e.trim()).filter(Boolean).forEach(e => { if (!e.startsWith('.')) e = '.' + e; excludeExtensions.push(e); });
      const result = await (window as any).deskflowAPI?.countProjectLines?.(projectPath, projectId, { excludeExtensions, excludePatterns: [] });
      if (result?.success) {
        setData({ files: result.data.files, summary: result.data.summary, scannedAt: new Date().toISOString(), totalFiles: result.data.totalFiles });
      } else {
        setError(result?.error || 'Scan failed');
      }
    } catch (e: any) { setError(e.message || 'Scan failed'); }
    finally { setIsScanning(false); }
  };

  const totals = useMemo(() => data ? data.files.reduce((acc, f) => ({
    totalLines: acc.totalLines + f.totalLines, codeLines: acc.codeLines + f.codeLines,
    commentLines: acc.commentLines + f.commentLines, blankLines: acc.blankLines + f.blankLines,
  }), { totalLines: 0, codeLines: 0, commentLines: 0, blankLines: 0 }) : null, [data]);

  const codePercent = totals && totals.totalLines > 0 ? ((totals.codeLines / totals.totalLines) * 100).toFixed(1) : '0';

  const fileTypes = useMemo(() => {
    if (!data) return ['all'];
    const types = new Set(data.files.map(f => f.fileType));
    return ['all', ...Array.from(types).sort()];
  }, [data]);

  const sortedFiles = useMemo(() => {
    if (!data) return [];
    let filtered = data.files.filter(f => {
      if (filterType !== 'all' && f.fileType !== filterType) return false;
      if (searchQuery && !f.filePath.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      if (sortKey === 'codePercent') {
        aVal = a.totalLines > 0 ? (a.codeLines / a.totalLines) * 100 : 0;
        bVal = b.totalLines > 0 ? (b.codeLines / b.totalLines) * 100 : 0;
      } else {
        aVal = (a as any)[sortKey];
        bVal = (b as any)[sortKey];
      }
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [data, sortKey, sortDir, filterType, searchQuery]);

  const languageData = useMemo(() => {
    if (!data?.summary) return [];
    return Object.entries(data.summary)
      .map(([name, s], i) => ({ name, codeLines: s.codeLines, count: s.count, color: NEON_COLORS[i % NEON_COLORS.length], percent: totals && totals.codeLines > 0 ? ((s.codeLines / totals.codeLines) * 100).toFixed(1) : '0' }))
      .sort((a, b) => b.codeLines - a.codeLines);
  }, [data, totals]);

  const topFilesData = useMemo(() => {
    if (!data?.files) return [];
    return [...data.files].sort((a, b) => b.codeLines - a.codeLines).slice(0, 15);
  }, [data]);

  const timeAgo = () => {
    if (!data?.scannedAt) return 'Never';
    const diff = Math.floor((Date.now() - new Date(data.scannedAt).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(data.scannedAt).toLocaleDateString();
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BarChart3 className="w-12 h-12 text-zinc-700 mb-4" />
        <p className="text-sm text-zinc-500">Select a project to view code stats</p>
      </div>
    );
  }

  return (
    <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-5">
      <svg width="0" height="0" className="absolute">
        <defs>
          <pattern id="stripeCyan" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#00F0FF" /><rect width="3" height="6" fill="transparent" />
          </pattern>
          <pattern id="stripeEmerald" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#10B981" /><rect width="3" height="6" fill="transparent" />
          </pattern>
          <pattern id="stripePurple" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#A855F7" /><rect width="3" height="6" fill="transparent" />
          </pattern>
          <pattern id="stripeAmber" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#F59E0B" /><rect width="3" height="6" fill="transparent" />
          </pattern>
          <pattern id="stripePink" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#EC4899" /><rect width="3" height="6" fill="transparent" />
          </pattern>
          <pattern id="stripeRose" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#FF2A4B" /><rect width="3" height="6" fill="transparent" />
          </pattern>
        </defs>
      </svg>

      {/* Toolbar */}
      <motion.div variants={riseItem}>
        <WorkspaceToolbar className="justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid w-7 h-7 place-items-center rounded-lg bg-purple-500/15 text-purple-400">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <span className="text-[13px] font-semibold text-zinc-200 tracking-tight">Code Stats</span>
            <span className="text-[10px] text-zinc-600">Last scan: {timeAgo()}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleScan} disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors disabled:opacity-50">
              {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
              {isScanning ? 'Scanning...' : data ? 'Re-scan' : 'Scan Project'}
            </button>
          </div>
        </WorkspaceToolbar>
        {showSettings && (
          <div className="flex items-center gap-3 mt-2 px-1">
            {DEFAULT_EXCLUDES.map(item => (
              <label key={item.key} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={excludes[item.key]} onChange={(e) => setExcludes(prev => ({ ...prev, [item.key]: e.target.checked }))} className="accent-purple-500 w-3 h-3" />
                <span className="text-[10px] text-zinc-500">{item.label}</span>
              </label>
            ))}
            <input type="text" value={customExts} onChange={(e) => setCustomExts(e.target.value)} placeholder=".log,.tmp"
              className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-[10px] text-zinc-400 placeholder-zinc-700 focus:outline-none" />
          </div>
        )}
      </motion.div>

      {error && (
        <motion.div variants={riseItem}>
          <div className="rounded-xl bg-[rgba(255,42,75,0.08)] border border-[rgba(255,42,75,0.25)] p-3 text-xs text-rose-300">{error}</div>
        </motion.div>
      )}

      {/* Empty state */}
      {!data && !isScanning ? (
        <motion.div variants={riseItem}>
          <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-[rgba(24,24,27,0.40)] border border-[rgba(63,63,70,0.30)]">
            <div className="p-4 rounded-xl bg-zinc-800/50 mb-4">
              <FileCode className="w-10 h-10 text-zinc-600" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-1">No scan data yet</h3>
            <p className="text-xs text-zinc-500 mb-5 text-center max-w-xs">Analyze your codebase to see file counts, line breakdowns, and language distribution.</p>
            <button onClick={handleScan}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-medium hover:bg-purple-500/20 transition-colors">
              <ScanLine className="w-3.5 h-3.5" /> Scan Project
            </button>
          </div>
        </motion.div>
      ) : totals ? (
        <>
          {/* Bento stat cards */}
          <motion.div variants={riseItem} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: 'files', label: 'Total Files', value: data!.totalFiles, icon: FileCode, color: '#00F0FF', sub: 'scanned files' },
              { key: 'code', label: 'Code Lines', value: totals.codeLines, icon: Code, color: '#00FF66', sub: 'actual code' },
              { key: 'comments', label: 'Comment Lines', value: totals.commentLines, icon: MessageSquare, color: '#A855F7', sub: 'documentation' },
              { key: 'blank', label: 'Blank Lines', value: totals.blankLines, icon: Minus, color: '#52525B', sub: 'whitespace' },
            ].map(card => (
              <WorkspaceCard key={card.key}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="grid w-6 h-6 place-items-center rounded-md" style={{ backgroundColor: `${card.color}18` }}>
                    <card.icon className="w-3 h-3" style={{ color: card.color }} />
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{card.label}</span>
                </div>
                <div className="text-xl font-bold tabular-nums tracking-tight" style={{ color: card.color }}>
                  <NumberTicker value={card.value} duration={1000} />
                </div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{card.sub}</div>
              </WorkspaceCard>
            ))}
          </motion.div>

          {/* Bento row: language donut + top files hatched bar */}
          <motion.div variants={riseItem} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Language Distribution — Donut */}
            <WorkspaceCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="grid w-6 h-6 place-items-center rounded-md bg-purple-500/15">
                    <PieChart className="w-3 h-3 text-purple-400" />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Language Distribution</span>
                </div>
                <span className="text-[10px] text-zinc-500">{languageData.length} types</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="shrink-0 w-[180px] h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie data={languageData} dataKey="codeLines" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}
                        stroke="none"
                      >
                        {languageData.map((entry, i) => (
                          <Cell key={entry.name} fill={entry.color} style={{ filter: `drop-shadow(0 0 6px ${entry.color}80)` }} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 w-full space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {languageData.slice(0, 10).map(lang => (
                    <div key={lang.name} className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-zinc-800/40 transition-colors">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: lang.color, boxShadow: `0 0 6px ${lang.color}80` }} />
                      <span className="text-[11px] text-zinc-300 truncate flex-1 min-w-0">{lang.name}</span>
                      <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">{lang.percent}%</span>
                      <span className="text-[10px] text-zinc-600 tabular-nums w-16 text-right shrink-0">{lang.codeLines.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </WorkspaceCard>

            {/* Top Files — Hatched Bar Chart */}
            <WorkspaceCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="grid w-6 h-6 place-items-center rounded-md bg-emerald-500/15">
                    <BarChart3 className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Top Files by Code</span>
                </div>
                <span className="text-[10px] text-zinc-500">Top 15</span>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(200, topFilesData.length * 24 + 20)}>
                <BarChart data={topFilesData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="barGlow" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" hide />
                  <YAxis dataKey="filePath" type="category" width={120} tick={({ x, y, payload }) => {
                    const name = payload.value.split(/[/\\]/).pop() || payload.value;
                    return <text x={x} y={y} fill="#a1a1aa" fontSize={10} textAnchor="end" dominantBaseline="middle">{name}</text>;
                  }} axisLine={false} tickLine={false} />
                  <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="codeLines" shape={(props: any) => {
                    const { x, y, width, height, fill } = props;
                    const colorIndex = props.index % 6;
                    return (
                      <g>
                        <rect x={x} y={y + 1} width={width} height={height - 2} fill={`url(#stripe${['Cyan','Emerald','Purple','Amber','Pink','Rose'][colorIndex]})`} rx={3} />
                        <rect x={x} y={y + 1} width={width < 4 ? width : 4} height={height - 2} fill={['#00F0FF','#10B981','#A855F7','#F59E0B','#EC4899','#FF2A4B'][colorIndex]} rx={3} />
                        <rect x={x} y={y + 1} width={width} height={2} fill={['#00F0FF','#10B981','#A855F7','#F59E0B','#EC4899','#FF2A4B'][colorIndex]}
                          style={{ filter: `drop-shadow(0 -2px 6px ${['#00F0FF','#10B981','#A855F7','#F59E0B','#EC4899','#FF2A4B'][colorIndex]}80)` }} rx={1} />
                      </g>
                    );
                  }} />
                </BarChart>
              </ResponsiveContainer>
            </WorkspaceCard>
          </motion.div>

          {/* File Detail Table */}
          <motion.div variants={riseItem}>
            <WorkspaceCard variant="inset" className="!p-0 overflow-hidden">
              <div className="p-3 border-b border-[rgba(63,63,70,0.35)] flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                  <input type="text" placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/30" />
                </div>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                  className="bg-zinc-950/50 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-400 focus:outline-none focus:ring-1 focus:ring-purple-500/30">
                  {fileTypes.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>)}
                </select>
              </div>
              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur-sm">
                    <tr className="border-b border-[rgba(63,63,70,0.35)] text-zinc-500 uppercase tracking-wider text-[10px]">
                      {[
                        { key: 'filePath' as SortKey, label: 'File' },
                        { key: 'fileType' as SortKey, label: 'Type' },
                        { key: 'totalLines' as SortKey, label: 'Total' },
                        { key: 'codeLines' as SortKey, label: 'Code' },
                        { key: 'commentLines' as SortKey, label: 'Comments' },
                        { key: 'blankLines' as SortKey, label: 'Blank' },
                        { key: 'codePercent' as SortKey, label: '% Code' },
                      ].map(col => (
                        <th key={col.key} className={`text-left px-3 py-2 font-medium cursor-pointer hover:text-zinc-300 ${col.key === 'codePercent' || col.key === 'totalLines' || col.key === 'codeLines' || col.key === 'commentLines' || col.key === 'blankLines' ? 'text-right' : ''}`}
                          onClick={() => { if (sortKey === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(col.key); setSortDir('desc'); } }}>
                          <span className={`flex items-center gap-1 ${col.key === 'codePercent' || col.key === 'totalLines' || col.key === 'codeLines' || col.key === 'commentLines' || col.key === 'blankLines' ? 'justify-end' : ''}`}>
                            {col.label}
                            <ArrowUpDown className={`w-3 h-3 ${sortKey === col.key ? 'text-purple-400' : 'text-zinc-600'}`} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFiles.map((file, i) => {
                      const pct = file.totalLines > 0 ? (file.codeLines / file.totalLines) * 100 : 0;
                      const fileName = file.filePath.split(/[/\\]/).pop() || file.filePath;
                      return (
                        <tr key={file.filePath} title={file.filePath}
                          className={`border-b border-[rgba(63,63,70,0.15)] hover:bg-zinc-800/40 transition-colors ${i % 2 === 0 ? 'bg-transparent' : 'bg-zinc-900/30'}`}>
                          <td className="px-3 py-2"><div className="flex items-center gap-1.5"><FileText className="w-3 h-3 text-zinc-600 shrink-0" /><span className="text-zinc-300 truncate max-w-[180px]">{fileName}</span></div></td>
                          <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-400 text-[10px]">{file.fileType}</span></td>
                          <td className="px-3 py-2 text-right text-zinc-300 tabular-nums">{file.totalLines.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: '#00FF66' }}>{file.codeLines.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums" style={{ color: '#A855F7' }}>{file.commentLines.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-zinc-500 tabular-nums">{file.blankLines.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-14 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#00FF66', boxShadow: `0 0 6px ${'#00FF66'}80` }} />
                              </div>
                              <span className="text-zinc-500 tabular-nums w-7 text-right text-[10px]">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {sortedFiles.length === 0 && <div className="p-6 text-center text-zinc-600 text-xs">No files match your filters</div>}
              <div className="px-3 py-1.5 border-t border-[rgba(63,63,70,0.35)] text-[10px] text-zinc-600 flex items-center justify-between">
                <span>Showing {sortedFiles.length} of {data!.files.length} files</span>
                <span className="text-zinc-600">{data!.totalFiles} files scanned</span>
              </div>
            </WorkspaceCard>
          </motion.div>
        </>
      ) : null}
    </motion.div>
  );
}
