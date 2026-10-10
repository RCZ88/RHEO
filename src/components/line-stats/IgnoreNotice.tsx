/**
 * IgnoreNotice — makes every exclusion VISIBLE.
 *
 * The whole point of `normaliseLineStats` is that the numbers are explainable.
 * A "Total Files: 812" figure that silently swallowed 979 `.bak` files and 15
 * backup trees is indistinguishable from a broken scanner, so the count of what
 * was removed — and why — is rendered next to the count itself, with samples.
 */

import { useState } from 'react';
import { EyeOff, ChevronDown, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { BACKUP_FILE_PATTERNS, TOTAL_EXCLUDED, type ExclusionReport } from './lineStatsFilter';

interface Props {
  report: ExclusionReport | null;
  /** Tailwind accent for the callout border/text, so each surface keeps its own hue. */
  accent?: 'cyan' | 'purple';
}

const ACCENT = {
  cyan: { ring: 'ring-cyan-500/25', text: 'text-cyan-400', btn: 'hover:text-cyan-300' },
  purple: { ring: 'ring-purple-500/25', text: 'text-purple-400', btn: 'hover:text-purple-300' },
};

export default function IgnoreNotice({ report, accent = 'cyan' }: Props) {
  const [open, setOpen] = useState(false);
  if (!report) return null;
  const c = ACCENT[accent];
  const excluded = TOTAL_EXCLUDED(report);
  if (excluded === 0 && report.orphanDigits === 0) return null;

  const groups: { label: string; n: number; items: { path: string; reason: string }[] }[] = [
    { label: 'duplicate rows (same resolved path)', n: report.duplicates, items: report.samples.duplicate },
    { label: 'backup / copy files', n: report.backups, items: report.samples.backup },
    { label: 'digit-suffixed copies', n: report.digitCopies, items: report.samples.digitCopy },
    { label: 'ignored directories', n: report.ignoredDirs, items: report.samples.ignoreDir },
  ].filter(g => g.n > 0);

  return (
    <div className={`rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ${c.ring} px-3 py-2`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 text-left">
        {open ? <ChevronDown className={`w-3.5 h-3.5 ${c.text} shrink-0`} /> : <ChevronRight className={`w-3.5 h-3.5 ${c.text} shrink-0`} />}
        <ShieldCheck className={`w-3.5 h-3.5 ${c.text} shrink-0`} />
        <span className="text-[11px] text-zinc-400">
          {excluded > 0 && <><span className="text-zinc-200 font-medium tabular-nums">{excluded}</span> of {report.inputFiles} scanned rows excluded</>}
          {excluded > 0 && report.orphanDigits > 0 && ' · '}
          {report.orphanDigits > 0 && <><span className="text-zinc-200 font-medium tabular-nums">{report.orphanDigits}</span> kept with a digit-suffixed name</>}
        </span>
        <span className={`text-[10px] ${c.text} ml-auto shrink-0 ${c.btn}`}>why?</span>
      </button>

      {open && (
        <div className="mt-2 pt-2 border-t border-zinc-800/70 space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {groups.map(g => (
              <div key={g.label} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800/40">
                <EyeOff className="w-3 h-3 text-zinc-600 shrink-0" />
                <span className="text-[10px] text-zinc-500 truncate">{g.label}</span>
                <span className="text-[10px] text-zinc-200 tabular-nums font-medium ml-auto">{g.n}</span>
              </div>
            ))}
          </div>

          {groups.map(g => (
            <div key={g.label}>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">{g.label} — {g.n}</div>
              <ul className="space-y-0.5 max-h-24 overflow-y-auto">
                {g.items.map((s, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-[10px]">
                    <span className="text-zinc-400 font-mono truncate" title={s.path}>{s.path}</span>
                    <span className="text-zinc-600 shrink-0">{s.reason}</span>
                  </li>
                ))}
                {g.n > g.items.length && (
                  <li className="text-[10px] text-zinc-700">+{g.n - g.items.length} more</li>
                )}
              </ul>
            </div>
          ))}

          {report.orphanDigits > 0 && (
            <div className="flex items-start gap-1.5 text-[10px] text-amber-400/90">
              <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
              <span>
                Kept (not excluded): a name ending in digits with no un-digitised original in the scan.
                Turn off "digit-suffixed copies" in the ignore settings to include the copies and exclude the originals,
                or leave it on to hide the copies. Samples: {report.samples.orphanDigit.map(s => s.path).join(', ') || '—'}
              </span>
            </div>
          )}

          <details className="text-[10px] text-zinc-600">
            <summary className="cursor-pointer hover:text-zinc-400">Backup patterns in use ({BACKUP_FILE_PATTERNS.length})</summary>
            <div className="mt-1 font-mono text-zinc-500 leading-relaxed">
              {BACKUP_FILE_PATTERNS.map(p => p.label).join('  ·  ')}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}