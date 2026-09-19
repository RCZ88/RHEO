export default function TokenMeter({ value, max = 4000, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct > 85 ? 'from-red-500 to-orange-500' : pct > 55 ? 'from-amber-400 to-orange-500' : 'from-emerald-400 to-teal-500';
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1.5">
        <span className="text-white/50">{label || 'Estimated tokens'}</span>
        <span className="text-white/80 font-mono">{value.toLocaleString()} / {max.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className={'h-full rounded-full bg-gradient-to-r transition-all ' + color} style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}
