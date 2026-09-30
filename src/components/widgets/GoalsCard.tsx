import { WidgetCard, type WidgetCategory } from "./WidgetCard";

const CATEGORY: WidgetCategory = "analytics";

interface GoalsCardProps {
  goals: Array<{ title: string; done: boolean; due: string }>;
}

export function GoalsCard({ goals }: GoalsCardProps) {
  return (
    <WidgetCard category={CATEGORY}>
      {/* Kicker */}
      <div className="mb-4">
        <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-400">
          PRODUCTIVITY
        </span>
      </div>

      {/* Title + progress */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold text-zinc-100">Active Goals</h3>
        <span className="text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
          {goals.filter((g) => !g.done).length}/{goals.length}
        </span>
      </div>

      {/* Goal rows */}
      <div className="space-y-1">
        {goals.map((goal, i) => (
          <div
            key={i}
            className="flex items-center gap-3 h-10 rounded-lg border border-zinc-800/50 bg-zinc-950/40 px-3 py-2"
          >
            {/* Checkbox */}
            <div className="flex-shrink-0 flex items-center justify-center">
              <div
                className={`inline-flex h-4 w-4 rounded-[4px] border flex items-center justify-center transition-colors duration-150 ${
                  goal.done
                    ? "bg-pink-500 border-pink-500"
                    : "border-zinc-600"
                }`}
              >
                {goal.done && (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-zinc-950"
                  >
                    <path d="M2 4l2 2 4-4" />
                  </svg>
                )}
              </div>
            </div>

            {/* Title */}
            <span
              className={`text-[13px] flex-1 ${
                goal.done ? "text-zinc-600 line-through" : "text-zinc-100"
              }`}
            >
              {goal.title}
            </span>

            {/* Due meta */}
            <span className="text-[11px] text-zinc-600">{goal.due}</span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
