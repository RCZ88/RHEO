import { WidgetCard, type WidgetCategory } from "./WidgetCard";

const CATEGORY: WidgetCategory = "schedule";

interface Deadline {
  title: string;
  daysLeft: number;
  dueDate: string;
}

interface DeadlinesCardProps {
  deadlines: Deadline[];
}

function urgencyClass(days: number): string {
  if (days <= 2) return "bg-red-500/10 text-red-400 border-red-500/20";
  if (days <= 7) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return "bg-zinc-800 text-zinc-400 border-zinc-700/50";
}

function fmtDays(days: number): string {
  if (days === 0) return "TODAY";
  if (days === 1) return "TOMORROW";
  return `T-${days}d`;
}

export function DeadlinesCard({ deadlines }: DeadlinesCardProps) {
  return (
    <WidgetCard category={CATEGORY}>
      {/* Kicker */}
      <div className="mb-4">
        <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-400">
          SCHEDULE
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[13px] font-semibold text-zinc-100 mb-4">Upcoming Deadlines</h3>

      {/* Deadline rows */}
      <div className="space-y-2">
        {deadlines.map((dl, i) => (
          <div
            key={i}
            className="flex items-center gap-3 h-12 rounded-lg border border-zinc-800/50 bg-zinc-950/40 px-3"
          >
            {/* Day-count chip */}
            <div
              className={`inline-flex items-center px-2 rounded text-[11px] font-semibold tabular-nums border flex-shrink-0 ${
                urgencyClass(dl.daysLeft)
              }`}
            >
              {fmtDays(dl.daysLeft)}
            </div>

            {/* Title */}
            <span className="text-[13px] text-zinc-100 flex-1 truncate">
              {dl.title}
            </span>

            {/* Due date */}
            <span className="text-[11px] text-zinc-600 flex-shrink-0">
              {dl.dueDate}
            </span>
          </div>
        ))}

        {deadlines.length === 0 && (
          <div className="text-[12px] text-zinc-600 italic py-2">
            No deadlines tracked yet.
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
