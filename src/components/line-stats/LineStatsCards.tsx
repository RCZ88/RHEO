import { useEffect, useState, useRef } from 'react';
import { FileCode, Code, MessageSquare, Minus } from 'lucide-react';
import { TOTAL_EXCLUDED, type ExclusionReport } from './lineStatsFilter';

interface Props {
  totalFiles: number;
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  /** When present, the "Total Files" card states how many rows were removed and why. */
  report?: ExclusionReport | null;
}

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = 0;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(fromRef.current + (value - fromRef.current) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span>{display.toLocaleString()}</span>;
}

const cards = [
  { key: 'files', label: 'Total Files', sub: 'scanned files', icon: FileCode, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  { key: 'code', label: 'Code Lines', sub: 'actual code', icon: Code, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { key: 'comments', label: 'Comment Lines', sub: 'documentation', icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { key: 'blank', label: 'Blank Lines', sub: 'whitespace', icon: Minus, color: 'text-zinc-400', bg: 'bg-zinc-400/10' },
];

export default function LineStatsCards({ totalFiles, codeLines, commentLines, blankLines, report }: Props) {
  const values: Record<string, number> = { files: totalFiles, code: codeLines, comments: commentLines, blank: blankLines };
  const subs: Record<string, string> = {
    files: report && TOTAL_EXCLUDED(report) > 0
      ? `of ${report.inputFiles} scanned — ${TOTAL_EXCLUDED(report)} excluded`
      : 'scanned files',
    code: 'actual code',
    comments: 'documentation',
    blank: 'whitespace',
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.key} className="rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${card.bg}`}>
              <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
            </div>
            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{card.label}</span>
          </div>
          <div className={`text-xl font-bold ${card.color} tabular-nums`}>
            <AnimatedNumber value={values[card.key]} />
          </div>
          <div className="text-[10px] text-zinc-600 mt-0.5">{subs[card.key] || card.sub}</div>
        </div>
      ))}
    </div>
  );
}
