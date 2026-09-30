// RHEO Dashboard — Browser Widget
// 3×2 widget showing browser activity from BrowserActivityPage
// LAMINAR: solid token surface, hairline, radius 10
import { motion } from 'motion/react';
import { Globe, Shield, Clock } from 'lucide-react';
import { WidgetJumpButton } from './WidgetJumpButton';

interface BrowserWidgetProps {
  stats?: {
    topSites: { domain: string; visits: number; category: string }[];
    categories: { name: string; pct: number }[];
    tracking: boolean;
  };
  loading?: boolean;
  error?: string | null;
}

export function BrowserWidget({ stats, loading, error }: BrowserWidgetProps) {
  const topSites = stats?.topSites ?? [];
  const categories = stats?.categories ?? [];
  const tracking = stats?.tracking ?? false;

  if (loading) {
    return (
      <div className="rounded-[10px] border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="h-4 w-20 rounded bg-zinc-800" />
        <div className="flex-1" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[10px] border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2 text-[13px] text-zinc-400">
          <Globe size={14} />
          <span>Browser</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[12px] text-zinc-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full relative">
      <div className="absolute top-0 left-[2px] right-[2px] h-[1px] -z-10 bg-gradient-to-r from-white/[0.06] via-white/[0.02] to-transparent rounded-t-[10px]" />
      <div className="absolute inset-0 -z-10 rounded-[10px] pointer-events-none" style={{
        boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.03), inset 0 -1px 0 0 rgba(0,0,0,0.2)',
      }} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <Globe size={14} className="text-sky-400" />
          </div>
          <span className="text-[13px] font-semibold text-zinc-200">Browser</span>
        </div>
        <WidgetJumpButton widgetId="browser-widget" iconOnly />
        {tracking && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400">
            <Shield size={10} />
            <span>Tracking</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {topSites.slice(0, 3).map((site, i) => (
          <div key={site.domain} className="p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] text-zinc-500">{i + 1}</span>
              <span className="text-[11px] text-zinc-300 truncate">{site.domain}</span>
            </div>
            <div className="text-[10px] text-zinc-500 tabular-nums">{site.visits} visits</div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-[var(--ws-border)]">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Category Split</div>
        <div className="space-y-1">
          {categories.slice(0, 3).map(c => (
            <div key={c.name} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 w-16 truncate shrink-0">{c.name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full bg-sky-500/60 rounded-full" style={{ width: `${c.pct}%` }} />
              </div>
              <span className="text-[10px] text-zinc-500 tabular-nums w-8 text-right">{c.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
