import React, { useMemo, useState, useCallback } from 'react';

interface HeatmapCell {
  date: string;
  value: number;
  details: {
    nodesStudied: number;
    quizzesTaken: number;
    cardsReviewed: number;
    masteryGain: number;
  };
}

interface Props {
  data: HeatmapCell[];
  meta: {
    data_source?: string;
    date_range?: string;
    color_scale?: string;
    cell_size?: number;
  };
  onCellClick?: (date: string, details: HeatmapCell['details']) => void;
}

const HEATMAP_COLORS = [
  '#292524',
  'rgba(111,179,143,0.25)',
  'rgba(111,179,143,0.45)',
  'rgba(111,179,143,0.65)',
  'rgba(111,179,143,0.85)',
  '#6fb38f',
];

export function HeatmapBlock({ data, meta, onCellClick }: Props) {
  const { cell_size = 12 } = meta;
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const weeks = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const groups: HeatmapCell[][] = [];
    for (let i = 0; i < sorted.length; i += 7) {
      groups.push(sorted.slice(i, i + 7));
    }
    return groups;
  }, [data]);

  const getColor = useCallback((cell: HeatmapCell) => {
    const idx = Math.min(5, Math.floor(cell.value * 5));
    return HEATMAP_COLORS[idx];
  }, []);

  const handleMouseEnter = (e: React.MouseEvent, cell: HeatmapCell) => {
    setHoveredCell(cell);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-100">Study Activity</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5" style={{ fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.05em' }}>
            {meta.date_range?.replace(/_/g, ' ') || 'last 90 days'}
          </p>
        </div>
      </div>

      <div className="flex gap-[3px] overflow-x-auto pb-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell, di) => (
              <div
                key={di}
                className="rounded-[3px] transition-all duration-150 hover:scale-[1.3] hover:z-10"
                style={{
                  width: cell_size,
                  height: cell_size,
                  background: getColor(cell),
                  cursor: onCellClick ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => handleMouseEnter(e, cell)}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredCell(null)}
                onClick={() => onCellClick?.(cell.date, cell.details)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span className="text-[11px] text-zinc-600" style={{ fontFamily: '"JetBrains Mono", monospace' }}>Less</span>
        {HEATMAP_COLORS.map((c, i) => (
          <div key={i} className="rounded-[2px]" style={{ width: cell_size, height: cell_size, background: c }} />
        ))}
        <span className="text-[11px] text-zinc-600" style={{ fontFamily: '"JetBrains Mono", monospace' }}>More</span>
      </div>

      {hoveredCell && (
        <div
          className="fixed z-50 rounded-lg border border-zinc-800 p-3 text-[13px] shadow-lg"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 12,
            background: 'var(--ws-surface-overlay)',
            minWidth: '180px',
          }}
        >
          <div className="font-medium text-zinc-100 mb-1.5">{formatDate(hoveredCell.date)}</div>
          <div className="text-zinc-400 space-y-0.5 leading-relaxed">
            {hoveredCell.details.nodesStudied > 0 && <div>📚 {hoveredCell.details.nodesStudied} nodes studied</div>}
            {hoveredCell.details.quizzesTaken > 0 && <div>📝 {hoveredCell.details.quizzesTaken} quizzes</div>}
            {hoveredCell.details.cardsReviewed > 0 && <div>🎴 {hoveredCell.details.cardsReviewed} cards reviewed</div>}
            {hoveredCell.details.masteryGain > 0 && <div>⬆️ {hoveredCell.details.masteryGain.toFixed(1)} mastery gain</div>}
          </div>
        </div>
      )}
    </div>
  );
}
