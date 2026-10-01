import { FileCode, ScanLine } from 'lucide-react';

interface Props {
  onScan: () => void;
}

export default function EmptyLineStats({ onScan }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70">
      <div className="p-4 rounded-xl bg-zinc-800/50 mb-4">
        <FileCode className="w-10 h-10 text-zinc-600" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">No scan data yet</h3>
      <p className="text-xs text-zinc-500 mb-5 text-center max-w-xs">Analyze your codebase to see file counts, line breakdowns, and language distribution.</p>
      <button onClick={onScan}
        className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-medium hover:bg-cyan-500/20 transition-colors">
        <ScanLine className="w-3.5 h-3.5" /> Scan Project
      </button>
    </div>
  );
}
