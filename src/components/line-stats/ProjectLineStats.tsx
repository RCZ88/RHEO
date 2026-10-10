import LineStatsCards from './LineStatsCards';
import FileTypeChart from './FileTypeChart';
import FileDetailTable from './FileDetailTable';
import ScanControls from './ScanControls';
import EmptyLineStats from './EmptyLineStats';
import IgnoreNotice from './IgnoreNotice';
import { useLineStats } from './useLineStats';
import type { ScanOptions } from '../../types/line-stats';

interface Props {
  projectId: string;
  projectPath: string;
}

export default function ProjectLineStats({ projectId, projectPath }: Props) {
  const ls = useLineStats(projectId, projectPath);
  const { data, report, isScanning, error } = ls;

  const handleScan = async (options: ScanOptions) => {
    await ls.scan(options.excludeExtensions || []);
  };

  const totals = data ? data.files.reduce((acc, f) => ({
    totalLines: acc.totalLines + f.totalLines, codeLines: acc.codeLines + f.codeLines,
    commentLines: acc.commentLines + f.commentLines, blankLines: acc.blankLines + f.blankLines,
  }), { totalLines: 0, codeLines: 0, commentLines: 0, blankLines: 0 }) : null;

  return (
    <div className="space-y-4">
      <ScanControls
        onScan={handleScan}
        isScanning={isScanning}
        lastScanned={data?.scannedAt || null}
        hasData={!!data}
        settings={ls.settings}
        settingsReady={ls.settingsReady}
        onSettingsChange={ls.updateSettings}
        onSettingsReset={ls.resetSettings}
        ignoreSummary={<IgnoreNotice report={report} accent="cyan" />}
      />
      {error && <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-400">{error}</div>}
      {!data && !isScanning ? (
        <EmptyLineStats onScan={() => handleScan({ excludeExtensions: ['.md', '.json', '.lock', '.min.js'] })} ignoreCount={ls.settings.ignoreDirs.length} />
      ) : totals && data ? (
        <>
          <LineStatsCards totalFiles={data.totalFiles} totalLines={totals.totalLines} codeLines={totals.codeLines} commentLines={totals.commentLines} blankLines={totals.blankLines} report={report} />
          <FileTypeChart summary={data.summary} />
          <FileDetailTable files={data.files} report={report} />
        </>
      ) : null}
    </div>
  );
}