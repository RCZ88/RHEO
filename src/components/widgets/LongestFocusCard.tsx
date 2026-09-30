import { WidgetCard, type WidgetCategory } from "./WidgetCard";
import { fmtSec } from "./StatusBand";

const CATEGORY: WidgetCategory = "analytics";

interface LongestFocusCardProps {
  valueMs: number;
  sessionName: string;
  date: string;
}

export function LongestFocusCard({ valueMs, sessionName, date }: LongestFocusCardProps) {
  return (
    <WidgetCard category={CATEGORY}>
      {/* Kicker */}
      <div className="mb-3">
        <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-400">
          ANALYTICS
        </span>
      </div>

      {/* Centered stat — restraint IS the design */}
      <div className="flex flex-col items-center py-4">
        <div className="text-[40px] font-bold leading-none tracking-tight tabular-nums text-zinc-100 font-['JetBrains_Mono']">
          {fmtSec(valueMs)}
        </div>
        <div className="mt-2 text-[12px] text-zinc-400">{sessionName}</div>
        <div className="mt-1 text-[11px] text-zinc-600">{date}</div>
      </div>
    </WidgetCard>
  );
}
