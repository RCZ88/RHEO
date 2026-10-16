import { useState, useMemo } from 'react';
import { ArrowUpDown, Search, FileText, ShieldCheck } from 'lucide-react';
import type { LineCountResult } from '../../types/line-stats';
import { TOTAL_EXCLUDED, type ExclusionReport } from './lineStatsFilter';

type SortKey = 'filePath' | 'fileType' | 'totalLines' | 'codeLines' | 'commentLines' | 'blankLines' | 'codePercent';
type SortDir = 'asc' | 'desc';

interface Props {
  files: LineCountResult[];
  /** Optional: lets the footer state how many rows were already removed upstream. */
  report?: ExclusionReport | null;
}

export default function FileDetailTable({ files, report }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('codeLines');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fileTypes = useMemo(() => {
    const types = new Set(files.map(f => f.fileType));
    return ['all', ...Array.from(types).sort()];
  }, [files]);

  const sortedFiles = useMemo(() => {
    let filtered = files.filter(f => {
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
  }, [files, sortKey, sortDir, filterType, searchQuery]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => (
    <ArrowUpDown className={`w-3 h-3 ml-1 ${sortKey === col ? 'text-cyan-400' : 'text-zinc-600'}`} />
  );

  return (
    <div className="rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 overflow-hidden">
      <div className="p-3 border-b border-zinc-800/70 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <input type="text" placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 light:bg-[var(--ws-surface-50)] border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="bg-zinc-950 light:bg-[var(--ws-surface-50)] border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
          {fileTypes.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-zinc-900/90 light:bg-[var(--ws-surface-raised)] backdrop-blur-sm">
            <tr className="border-b border-zinc-800/70 text-zinc-500 uppercase tracking-wider">
              <th className="text-left px-3 py-2 font-medium cursor-pointer hover:text-zinc-300" onClick={() => handleSort('filePath')}><span className="flex items-center">File <SortIcon col="filePath" /></span></th>
              <th className="text-left px-3 py-2 font-medium cursor-pointer hover:text-zinc-300" onClick={() => handleSort('fileType')}><span className="flex items-center">Type <SortIcon col="fileType" /></span></th>
              <th className="text-right px-3 py-2 font-medium cursor-pointer hover:text-zinc-300" onClick={() => handleSort('totalLines')}><span className="flex items-center justify-end">Total <SortIcon col="totalLines" /></span></th>
              <th className="text-right px-3 py-2 font-medium cursor-pointer hover:text-zinc-300" onClick={() => handleSort('codeLines')}><span className="flex items-center justify-end">Code <SortIcon col="codeLines" /></span></th>
              <th className="text-right px-3 py-2 font-medium cursor-pointer hover:text-zinc-300" onClick={() => handleSort('commentLines')}><span className="flex items-center justify-end">Comments <SortIcon col="commentLines" /></span></th>
              <th className="text-right px-3 py-2 font-medium cursor-pointer hover:text-zinc-300" onClick={() => handleSort('blankLines')}><span className="flex items-center justify-end">Blank <SortIcon col="blankLines" /></span></th>
              <th className="text-right px-3 py-2 font-medium cursor-pointer hover:text-zinc-300" onClick={() => handleSort('codePercent')}><span className="flex items-center justify-end">% Code <SortIcon col="codePercent" /></span></th>
            </tr>
          </thead>
          <tbody>
            {sortedFiles.map((file, i) => {
              const codePercent = file.totalLines > 0 ? (file.codeLines / file.totalLines) * 100 : 0;
              const fileName = file.filePath.split(/[/\\]/).pop() || file.filePath;
              return (
                <tr key={file.filePath} title={file.filePath}
                  className={`border-b border-zinc-800/30 hover:bg-zinc-800/40 ${i % 2 === 0 ? 'bg-zinc-900/30 light:bg-[var(--ws-surface-raised)]' : 'bg-zinc-900/60 light:bg-[var(--ws-surface-raised)]'}`}>
                  <td className="px-3 py-2"><div className="flex items-center gap-1.5"><FileText className="w-3 h-3 text-zinc-600" /><span className="text-zinc-300 truncate max-w-[180px]">{fileName}</span></div></td>
                  <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-400">{file.fileType}</span></td>
                  <td className="px-3 py-2 text-right text-zinc-300 tabular-nums">{file.totalLines.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-emerald-400 tabular-nums">{file.codeLines.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-purple-400 tabular-nums">{file.commentLines.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-zinc-500 tabular-nums">{file.blankLines.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 rounded-full" style={{ width: `${codePercent}%` }} /></div>
                      <span className="text-zinc-500 tabular-nums w-7 text-right">{codePercent.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sortedFiles.length === 0 && <div className="p-6 text-center text-zinc-600 text-xs">No files match your filters</div>}
      <div className="px-3 py-1.5 border-t border-zinc-800/70 text-[10px] text-zinc-600 flex items-center gap-3">
        <span>Showing {sortedFiles.length} of {files.length} files</span>
        {report && TOTAL_EXCLUDED(report) > 0 && (
          <span className="flex items-center gap-1 text-zinc-500" title={`${report.duplicates} duplicate, ${report.backups} backup, ${report.digitCopies} digit copy, ${report.ignoredDirs} in ignored directories`}>
            <ShieldCheck className="w-3 h-3 text-zinc-600" />
            {TOTAL_EXCLUDED(report)} rows excluded upstream ({report.inputFiles} scanned)
          </span>
        )}
      </div>
    </div>
  );
}
