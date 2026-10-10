import { FileCode, ScanLine, ShieldCheck } from 'lucide-react';

interface Props {
  onScan: () => void;
  /** How many directories the ignore list already covers — shown so the first
   *  scan's smaller numbers are explained before they ever appear. */
  ignoreCount?: number;
}

export default function EmptyLineStats({ onScan, ignoreCount }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70">
      <div className="p-4 rounded-xl bg-zinc-800/50 mb-4">
        <FileCode className="w-10 h-10 text-zinc-600" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">No scan data yet</h3>
      <p className="text-xs text-zinc-500 mb-3 text-center max-w-xs">Analyze your codebase to see file counts, line breakdowns, and language distribution.</p>
      {typeof ignoreCount === 'number' && (
        <div className="flex items-start gap-1.5 text-[10px] text-zinc-600 mb-5 max-w-sm text-center">
          <ShieldCheck className="w-3 h-3 mt-px shrink-0 text-zinc-700" />
          <span className="text-left">
            The scan skips {ignoreCount} build/dependency/backup directories
            (<span className="font-mono">node_modules</span>, <span className="font-mono">dist</span>, <span className="font-mono">agent/backups</span>, …),
            backup copies, and duplicate rows. Anything removed is listed under the scan button afterwards.
          </span>
        </div>
      )}
      <button onClick={onScan}
        className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-medium hover:bg-cyan-500/20 transition-colors">
        <ScanLine className="w-3.5 h-3.5" /> Scan Project
      </button>
    </div>
  );
}