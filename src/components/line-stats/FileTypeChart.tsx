import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartData {
  name: string;
  code: number;
  comments: number;
  blank: number;
  count: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded-lg p-3 shadow-xl">
      <div className="text-xs font-semibold text-zinc-100 mb-1.5">{label} ({data.count} files)</div>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-[10px]">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-zinc-400 capitalize">{entry.name}:</span>
          <span className="text-zinc-200 font-mono">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  summary: Record<string, { count: number; codeLines: number; commentLines: number; blankLines: number }>;
}

export default function FileTypeChart({ summary }: Props) {
  const data: ChartData[] = Object.entries(summary)
    .map(([name, stats]) => ({
      name,
      code: stats.codeLines,
      comments: stats.commentLines,
      blank: stats.blankLines,
      count: stats.count,
    }))
    .sort((a, b) => (b.code + b.comments + b.blank) - (a.code + a.comments + a.blank))
    .slice(0, 12);

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 p-4">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Lines by File Type</h3>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
          <XAxis type="number" hide />
          <YAxis
            dataKey="name"
            type="category"
            width={90}
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="code" stackId="a" fill="#34d399" radius={[0, 3, 3, 0]} name="code" />
          <Bar dataKey="comments" stackId="a" fill="#a855f7" name="comments" />
          <Bar dataKey="blank" stackId="a" fill="#52525b" radius={[3, 0, 0, 3]} name="blank" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
