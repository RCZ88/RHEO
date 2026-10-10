import React from 'react';

export function FinChartDemo() {
  const candles = [
    { x: 20, open: 60, close: 40, high: 35, low: 65, up: false },
    { x: 45, open: 45, close: 30, high: 25, low: 50, up: true },
    { x: 70, open: 35, close: 50, high: 30, low: 55, up: false },
    { x: 95, open: 40, close: 25, high: 20, low: 45, up: true },
    { x: 120, open: 30, close: 45, high: 25, low: 50, up: true },
    { x: 145, open: 50, close: 35, high: 30, low: 55, up: false },
  ];
  return (
    <div className="flex items-center justify-center py-2">
      <svg viewBox="0 0 180 80" className="w-full max-w-[200px]">
        {candles.map((c, i) => (
          <g key={i}>
            <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={c.up ? 'var(--color-mem-400)' : '#ef4444'} strokeWidth="1" />
            <rect x={c.x - 6} y={Math.min(c.open, c.close)} width="12" height={Math.abs(c.open - c.close) || 2} rx="1" fill={c.up ? '#6fb38f' : '#ef4444'} />
          </g>
        ))}
      </svg>
    </div>
  );
}
