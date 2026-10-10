import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush } from 'recharts';

interface Props {
  meta: {
    node_id?: string;
    lesson_id?: string;
    date_range?: string;
    show_target_line?: boolean;
    target_level?: string;
    height?: number;
  };
  events: Array<{
    date: string;
    type: string;
    score?: number;
    description?: string;
    from_level?: string;
    to_level?: string;
  }>;
  series: Array<{ date: string; value: number; target: number }>;
}

const LEVEL_VALUES: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
const LEVEL_COLORS: Record<string, string> = {
  L0: '#5B6472', L1: '#5B8DEF', L2: '#23B5B5', L3: '#3CCB7F', L4: '#A78BFA', L5: '#F5C04E',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-zinc-800 p-3 text-[13px] shadow-lg" style={{ background: 'var(--ws-surface-overlay)' }}>
      <div className="font-medium text-zinc-100 mb-1.5">{new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5 mb-0.5 text-zinc-400">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span>{entry.name}: {entry.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

export function MasteryTimelineBlock({ meta, events, series }: Props) {
  const { show_target_line = true, target_level = 'L3', height = 320 } = meta;
  const targetValue = LEVEL_VALUES[target_level] || 3;

  const chartData = useMemo(() => {
    return series.map(s => ({
      date: s.date,
      mastery: s.value,
      target: s.target,
      level: Object.entries(LEVEL_VALUES).find(([, v]) => v === Math.round(s.value))?.[0] || 'L0',
    }));
  }, [series]);

  return (
    <div className="rounded-xl border border-zinc-800 p-4 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-medium text-zinc-100">Mastery Progression</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{meta.node_id ? 'Per-node tracking' : 'Aggregate across curriculum'}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          Actual
          {show_target_line && <><span className="ml-2 w-2.5 h-[2px] bg-zinc-600" />Target ({target_level})</>}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="masteryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            stroke="#52525b" tick={{ fill: '#a8a29e', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#292524' }} />
          <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tickFormatter={(v) => `L${v}`}
            stroke="#52525b" tick={{ fill: '#a8a29e', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#292524' }} />
          <Tooltip content={<CustomTooltip />} />
          {show_target_line && <ReferenceLine y={targetValue} stroke="#52525b" strokeDasharray="5 5" strokeWidth={1} />}
          <Area type="monotone" dataKey="mastery" stroke="#d97706" strokeWidth={2} fill="url(#masteryGradient)" dot={false}
            activeDot={{ r: 5, fill: '#d97706', stroke: '#1c1917', strokeWidth: 2 }} />
          <Brush dataKey="date" height={24} stroke="#292524" fill="rgba(41,37,36,0.3)" tickFormatter={() => ''} />
        </AreaChart>
      </ResponsiveContainer>

      {events.length > 0 && (
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <div className="text-xs font-medium text-zinc-500 mb-2">Key Events</div>
          <div className="flex flex-col gap-1.5">
            {events.slice(0, 5).map((evt, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: evt.to_level ? LEVEL_COLORS[evt.to_level] : '#52525b' }} />
                <span className="text-zinc-600 min-w-[70px]" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  {new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span>{evt.description || `${evt.type}${evt.to_level ? ` → ${evt.to_level}` : ''}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
